// Wormkey Edge Gateway
// TLS termination, hostname routing, stream forwarding

package main

import (
	_ "embed"
	"bufio"
	"bytes"
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

//go:embed overlay.js
var overlayJS []byte

const (
	FrameOpenStream   = 0x01
	FrameStreamData   = 0x02
	FrameStreamEnd    = 0x03
	FrameStreamCancel = 0x04
	FrameResponseHdrs = 0x05
	FrameWSUpgrade    = 0x06
	FrameWSData       = 0x07
	FrameWSClose      = 0x08
	FramePing         = 0x09
	FramePong         = 0x0a
	ControlStreamID   = 0
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type tunnelConn struct {
	conn          *websocket.Conn
	slug          string
	ownerToken    string
	streamID      atomic.Uint32
	activeStreams atomic.Int32
	streams       sync.Map   // streamID -> *streamCtx
	writeMu       sync.Mutex // WebSocket writes must be serialized
	policyMu      sync.RWMutex
	policy        tunnelPolicy
	viewerMu      sync.RWMutex
	viewers       map[string]*viewerState
	kickedViewers map[string]struct{}
}

type tunnelPolicy struct {
	Public               bool     `json:"public"`
	MaxConcurrentViewers int      `json:"maxConcurrentViewers"`
	BlockPaths           []string `json:"blockPaths"`
	Password             string   `json:"password"`
}

type streamCtx struct {
	w         http.ResponseWriter
	done      chan struct{}
	flusher   http.Flusher
	setCookie string // slug for Set-Cookie so asset requests get routed
}

// overlayInjectWriter buffers HTML responses for owners and injects the overlay script before </body>.
type overlayInjectWriter struct {
	w      http.ResponseWriter
	slug   string
	status int
	buf    bytes.Buffer
	inject bool
}

func (o *overlayInjectWriter) Header() http.Header { return o.w.Header() }

func (o *overlayInjectWriter) WriteHeader(status int) {
	ct := o.w.Header().Get("Content-Type")
	if strings.Contains(strings.ToLower(ct), "text/html") {
		o.status = status
		o.inject = true
		return
	}
	o.w.WriteHeader(status)
}

func (o *overlayInjectWriter) Write(p []byte) (int, error) {
	if o.inject {
		o.buf.Write(p)
		return len(p), nil
	}
	return o.w.Write(p)
}

func (o *overlayInjectWriter) FlushInject() {
	if !o.inject {
		return
	}
	body := o.buf.Bytes()
	script := []byte(fmt.Sprintf(`<script defer src="/.wormkey/overlay.js?slug=%s"></script>`, url.QueryEscape(o.slug)))
	lower := bytes.ToLower(body)
	idx := bytes.Index(lower, []byte("</body>"))
	if idx >= 0 {
		var out bytes.Buffer
		out.Write(body[:idx])
		out.Write(script)
		out.Write(body[idx:])
		body = out.Bytes()
	} else {
		var out bytes.Buffer
		out.Write(body)
		out.Write(script)
		body = out.Bytes()
	}
	o.w.Header().Del("Transfer-Encoding")
	o.w.Header().Set("Content-Length", strconv.Itoa(len(body)))
	o.w.WriteHeader(o.status)
	o.w.Write(body)
}

type policyPatch struct {
	Public               *bool    `json:"public"`
	MaxConcurrentViewers *int     `json:"maxConcurrentViewers"`
	BlockPaths           []string `json:"blockPaths"`
}

type viewerState struct {
	ID         string `json:"id"`
	LastSeenAt string `json:"lastSeenAt"`
	Requests   int    `json:"requests"`
	IP         string `json:"ip,omitempty"`
}

type persistedSession struct {
	OwnerToken      string        `json:"ownerToken"`
	OwnerUrl        string        `json:"ownerUrl"`
	Policy          tunnelPolicy  `json:"policy"`
	KickedViewerIds []string      `json:"kickedViewerIds"`
	ActiveViewers   []viewerState `json:"activeViewers"`
	Closed          bool          `json:"closed"`
}

func fetchSession(controlPlaneURL, slug string) (persistedSession, int, error) {
	if controlPlaneURL == "" {
		return persistedSession{}, 0, fmt.Errorf("control plane url is empty")
	}
	url := strings.TrimRight(controlPlaneURL, "/") + "/sessions/by-slug/" + slug
	resp, err := http.Get(url)
	if err != nil {
		return persistedSession{}, 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return persistedSession{}, resp.StatusCode, nil
	}
	var sess persistedSession
	if err := json.NewDecoder(resp.Body).Decode(&sess); err != nil {
		return persistedSession{}, resp.StatusCode, err
	}
	return sess, resp.StatusCode, nil
}

func randomSecret(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return ""
	}
	return hex.EncodeToString(b)
}

// extractSlugFromHost extracts slug from host like "quiet-lime-82.wormkey.run" or "quiet-lime-82.wormkey.run:3002".
// Assumes format: slug.wormkey.run (at least 3 dot-separated parts).
func extractSlugFromHost(host string) string {
	host = strings.Split(host, ":")[0] // strip port
	parts := strings.Split(host, ".")
	if len(parts) < 3 {
		return ""
	}
	return parts[0]
}

func resolveSlug(r *http.Request) string {
	// 1. Path-based: /s/:slug (no wildcard TLS needed)
	if strings.HasPrefix(r.URL.Path, "/s/") {
		rest := r.URL.Path[3:] // skip "/s/"
		idx := strings.Index(rest, "/")
		var slug string
		if idx < 0 {
			slug = rest
			rest = ""
		} else {
			slug = rest[:idx]
			rest = rest[idx:]
		}
		if slug != "" {
			if rest == "" {
				r.URL.Path = "/"
			} else {
				r.URL.Path = rest
			}
			r.URL.RawPath = ""
			return slug
		}
	}
	// 2. Query fallback (?slug=)
	slug := r.URL.Query().Get("slug")
	if slug != "" {
		return slug
	}
	// 3. Cookie (for asset requests like /_next/... or /assets/...)
	if c, err := r.Cookie("wormkey_slug"); err == nil && c.Value != "" {
		return c.Value
	}
	if c, err := r.Cookie("wormkey"); err == nil && c.Value != "" {
		return c.Value
	}
	// 4. Host-based (slug.wormkey.run)
	if s := extractSlugFromHost(r.Host); s != "" {
		return s
	}
	return ""
}

// Interactive mascot SVG with ids for variant cycling (matches WormMascot COLOR_VARIANTS)
const mascotHTML = `<div id="worm-mascot-wrap" style="cursor:pointer;display:inline-block;margin:0 auto 0.5rem" onclick="wormCycle()" title="Click to change colors">
<svg width="80" height="94" viewBox="0 0 40 47" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block">
<path id="w-body" fill-rule="evenodd" clip-rule="evenodd" d="M16.1768 6.76665C16.8585 4.19156 19.0178 2.48157 21.1738 2.89262C22.9259 3.22675 24.1639 4.86419 24.3984 6.88579C33.3281 8.88981 40 16.8659 40 26.4004C39.9999 37.446 31.0456 46.4004 20 46.4004C8.95439 46.4004 0.000145094 37.446 0 26.4004C0 16.6623 6.96001 8.55093 16.1768 6.76665Z" fill="#D9D9D9"/>
<ellipse id="w-eyes" cx="20.2" cy="23.8" rx="5" ry="6.19" fill="#fff"/>
<ellipse id="w-pupil" cx="20.2" cy="23.8" rx="2.14" ry="3.1" fill="#161616"/>
<g transform="translate(12.8,18.36) rotate(-11)"><rect id="w-antenna-r" width="12.48" height="5.6" fill="#D9D9D9"/></g>
<path id="w-teeth1" d="M15.71 36.97H18.11L17.71 42.97H16.11L15.71 36.97Z" fill="#A3A3A3"/>
<path id="w-teeth2" d="M22.8 36.8H25.2L24.8 42.8H23.2L22.8 36.8Z" fill="#A3A3A3"/>
<path id="w-teeth3" d="M19.31 36.17H21.71L21.31 42.17H19.71L19.31 36.17Z" fill="#A3A3A3"/>
<path id="w-ant-l" d="M5.1 13.9L6.52 15.32M5.1 15.32L6.52 13.9" stroke="#D9D9D9" stroke-width="0.6" stroke-linecap="round"/>
<path id="w-ant-r" d="M33.1 13.9L34.52 15.32M33.1 15.32L34.52 13.9" stroke="#D9D9D9" stroke-width="0.6" stroke-linecap="round"/>
</svg>
</div>
<p class="worm-hint" style="font-size:10px;color:#525252;margin:-0.25rem 0 1rem">Click the worm</p>
<script>
var wormV=[{b:"#D9D9D9",e:"#fff",p:"#161616",t:"#A3A3A3",a:"#D9D9D9"},{b:"#FFEA2A",e:"#000",p:"#fff",t:"#F00",a:"#FFE62A"},{b:"#2067FF",e:"#000",p:"#fff",t:"#FF67FF",a:"#248BF3"},{b:"#6BFF20",e:"#fff",p:"#000",t:"#FFFF3C",a:"#9CF324"},{b:"#FF2A2D",e:"#000",p:"#FFEA2A",t:"#fff",a:"#D90407"},{b:"#A855F7",e:"#E9D5FF",p:"#581C87",t:"#F0ABFC",a:"#C084FC"},{b:"#000",e:"#9B9B9B",p:"#FFF",t:"#D9D9D9",a:"#010101"},{b:"#F97316",e:"#FED7AA",p:"#9A3412",t:"#FB923C",a:"#FDBA74"}];
var wormI=0;
function wormCycle(){wormI=(wormI+1)%8;var v=wormV[wormI];var d=document;["w-body","w-eyes","w-pupil","w-teeth1","w-teeth2","w-teeth3"].forEach(function(id){var el=d.getElementById(id);if(el)el.setAttribute("fill",id.startsWith("w-teeth")?v.t:id==="w-body"?v.b:id==="w-eyes"?v.e:v.p);});["w-antenna-r","w-ant-l","w-ant-r"].forEach(function(id){var el=d.getElementById(id);if(el)el.setAttribute(el.tagName==="rect"?"fill":"stroke",v.a);});var h=d.querySelector(".worm-hint");if(h)h.style.display="none";}
</script>`

func writeWormholeNotActive(w http.ResponseWriter) {
	writeErrorPage(w, http.StatusBadGateway, "Wormhole not active", "No tunnel is connected. Run <code>wormkey http &lt;port&gt;</code> to open a wormhole.")
}

func writeInvalidSlug(w http.ResponseWriter) {
	writeErrorPage(w, http.StatusNotFound, "Invalid wormhole link", "This link is invalid or the wormhole has expired.")
}

func writeLockedByOwner(w http.ResponseWriter) {
	writeErrorPage(w, http.StatusUnauthorized, "Wormhole locked", "The owner has locked this wormhole. Ask them to unlock it.")
}

func writePasswordRequired(w http.ResponseWriter) {
	writeErrorPage(w, http.StatusUnauthorized, "Password required", "This wormhole requires a password. Add <code>?wormkey_password=YOUR_PASSWORD</code> to the URL.")
}

func writeViewerRemoved(w http.ResponseWriter) {
	writeErrorPage(w, http.StatusForbidden, "Viewer removed", "You were removed by the owner.")
}

func writeTooManyViewers(w http.ResponseWriter) {
	writeErrorPage(w, http.StatusTooManyRequests, "Too many viewers", "This wormhole has reached its viewer limit. Try again later.")
}

func writePathBlocked(w http.ResponseWriter) {
	writeErrorPage(w, http.StatusForbidden, "Path blocked", "The owner has blocked access to this path.")
}

func writeTunnelWriteFailed(w http.ResponseWriter) {
	writeErrorPage(w, http.StatusBadGateway, "Connection lost", "The tunnel connection was lost. The owner may need to restart <code>wormkey</code>.")
}

func writeErrorPage(w http.ResponseWriter, status int, title, message string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(status)
	html := `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>` + title + `</title>
<style>
*{box-sizing:border-box}
body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif;background:#0f0f0f;color:#f4f4f4;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem}
.wrap{text-align:center;max-width:28rem}
h1{font-size:1.25rem;font-weight:600;margin:0 0 0.5rem}
p{color:#a3a3a3;margin:0;line-height:1.6}
code{background:#262626;padding:0.2em 0.4em;border-radius:4px;font-size:0.9em}
a{color:#60a5fa;text-decoration:none}
a:hover{text-decoration:underline}
</style>
</head>
<body>
<div class="wrap">
` + mascotHTML + `
<h1>` + title + `</h1>
<p>` + message + `</p>
<p style="margin-top:1.5rem"><a href="https://wormkey.run">wormkey.run</a></p>
</div>
</body>
</html>`
	_, _ = w.Write([]byte(html))
}

func setCookie(w http.ResponseWriter, name, value string, httpOnly bool) {
	v := fmt.Sprintf("%s=%s; Path=/; SameSite=Lax", name, value)
	if httpOnly {
		v += "; HttpOnly"
	}
	w.Header().Add("Set-Cookie", v)
}

func isOwner(r *http.Request, tc *tunnelConn) bool {
	if tc.ownerToken == "" {
		return false
	}
	c, err := r.Cookie("wormkey_owner")
	if err != nil || c.Value == "" {
		return false
	}
	return c.Value == tc.ownerToken
}

func getViewerID(w http.ResponseWriter, r *http.Request) string {
	c, err := r.Cookie("wormkey_viewer")
	if err == nil && c.Value != "" {
		return c.Value
	}
	id := randomSecret(6)
	if id == "" {
		id = fmt.Sprintf("viewer-%d", time.Now().UnixNano())
	}
	setCookie(w, "wormkey_viewer", id, false)
	return id
}

func (tc *tunnelConn) upsertViewer(id, ip string) {
	tc.viewerMu.Lock()
	defer tc.viewerMu.Unlock()
	v, ok := tc.viewers[id]
	if !ok {
		v = &viewerState{ID: id, Requests: 0, IP: ip}
		tc.viewers[id] = v
	}
	v.Requests++
	v.LastSeenAt = time.Now().UTC().Format(time.RFC3339)
	if ip != "" {
		v.IP = ip
	}
}

func (tc *tunnelConn) removeViewer(id string) {
	tc.viewerMu.Lock()
	defer tc.viewerMu.Unlock()
	delete(tc.viewers, id)
}

func (tc *tunnelConn) snapshotViewers() []viewerState {
	tc.viewerMu.RLock()
	defer tc.viewerMu.RUnlock()
	viewers := make([]viewerState, 0, len(tc.viewers))
	for _, v := range tc.viewers {
		viewers = append(viewers, *v)
	}
	return viewers
}

func (tc *tunnelConn) kickedIDs() []string {
	tc.viewerMu.RLock()
	defer tc.viewerMu.RUnlock()
	ids := make([]string, 0, len(tc.kickedViewers))
	for id := range tc.kickedViewers {
		ids = append(ids, id)
	}
	return ids
}

func hydrateFromControlPlane(controlPlaneURL, slug string, tc *tunnelConn) {
	if controlPlaneURL == "" {
		return
	}
	sess, status, err := fetchSession(controlPlaneURL, slug)
	if err != nil {
		return
	}
	if status != http.StatusOK {
		return
	}
	if tc.ownerToken == "" && sess.OwnerToken != "" {
		tc.ownerToken = sess.OwnerToken
	}
	tc.policyMu.Lock()
	if sess.Policy.MaxConcurrentViewers > 0 || sess.Policy.Public || len(sess.Policy.BlockPaths) > 0 || sess.Policy.Password != "" {
		tc.policy = sess.Policy
	}
	tc.policyMu.Unlock()
	tc.viewerMu.Lock()
	for _, id := range sess.KickedViewerIds {
		tc.kickedViewers[id] = struct{}{}
	}
	for _, viewer := range sess.ActiveViewers {
		v := viewer
		tc.viewers[v.ID] = &v
	}
	tc.viewerMu.Unlock()
}

func postJSON(url string, body any) {
	b, err := json.Marshal(body)
	if err != nil {
		return
	}
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(b))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
}

func syncPolicy(controlPlaneURL, slug string, policy tunnelPolicy) {
	if controlPlaneURL == "" {
		return
	}
	url := strings.TrimRight(controlPlaneURL, "/") + "/sessions/by-slug/" + slug + "/policy"
	postJSON(url, map[string]any{
		"public":               policy.Public,
		"maxConcurrentViewers": policy.MaxConcurrentViewers,
		"blockPaths":           policy.BlockPaths,
		"password":             policy.Password,
	})
}

func syncViewers(controlPlaneURL, slug string, viewers []viewerState) {
	if controlPlaneURL == "" {
		return
	}
	url := strings.TrimRight(controlPlaneURL, "/") + "/sessions/by-slug/" + slug + "/viewers"
	postJSON(url, map[string]any{"viewers": viewers})
}

func syncKick(controlPlaneURL, slug, viewerID string) {
	if controlPlaneURL == "" {
		return
	}
	url := strings.TrimRight(controlPlaneURL, "/") + "/sessions/by-slug/" + slug + "/kick"
	postJSON(url, map[string]any{"viewerId": viewerID})
}

func syncClose(controlPlaneURL, slug string) {
	if controlPlaneURL == "" {
		return
	}
	url := strings.TrimRight(controlPlaneURL, "/") + "/sessions/by-slug/" + slug + "/close"
	postJSON(url, map[string]any{})
}

func main() {
	// In-memory: slug -> tunnel connection
	tunnels := sync.Map{} // slug string -> *tunnelConn
	closedSlugs := sync.Map{}
	controlPlaneURL := getEnv("WORMKEY_CONTROL_PLANE", "https://wormkey-control-plane.onrender.com")

	mux := http.NewServeMux()

	// Health
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		w.Write([]byte("ok"))
	})

	// Tunnel websocket endpoint
	mux.HandleFunc("/tunnel", handleTunnel(&tunnels, &closedSlugs, controlPlaneURL))

	mux.HandleFunc("/.wormkey/overlay.js", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache, must-revalidate")
		w.Write(overlayJS)
	})

	mux.HandleFunc("/.wormkey/owner", func(w http.ResponseWriter, r *http.Request) {
		slug := resolveSlug(r)
		if slug == "" {
			http.Error(w, "Missing slug", 400)
			return
		}
		val, ok := tunnels.Load(slug)
		if !ok {
			http.Error(w, "Tunnel not connected", 503)
			return
		}
		tc := val.(*tunnelConn)
		token := r.URL.Query().Get("token")
		if token == "" || token != tc.ownerToken {
			http.Error(w, "Invalid owner token", 401)
			return
		}
		setCookie(w, "wormkey_slug", slug, false)
		setCookie(w, "wormkey", slug, false)
		setCookie(w, "wormkey_owner", token, true)
		http.Redirect(w, r, "/s/"+slug, http.StatusFound)
	})

	mux.HandleFunc("/.wormkey/me", func(w http.ResponseWriter, r *http.Request) {
		slug := resolveSlug(r)
		owner := false
		if slug != "" {
			if val, ok := tunnels.Load(slug); ok {
				owner = isOwner(r, val.(*tunnelConn))
			}
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"owner":` + strconv.FormatBool(owner) + `}`))
	})

	mux.HandleFunc("/.wormkey/urls", func(w http.ResponseWriter, r *http.Request) {
		slug := resolveSlug(r)
		if slug == "" {
			http.Error(w, "Missing slug", 400)
			return
		}
		val, ok := tunnels.Load(slug)
		if !ok {
			http.Error(w, "Tunnel not connected", 503)
			return
		}
		tc := val.(*tunnelConn)
		if !isOwner(r, tc) {
			http.Error(w, "Forbidden", 403)
			return
		}
		sess, status, err := fetchSession(controlPlaneURL, slug)
		if err != nil || status != http.StatusOK {
			publicUrl := strings.TrimSuffix(getEnv("WORMKEY_PUBLIC_BASE_URL", getEnv("WORMKEY_PUBLIC_BASE", "http://localhost:3002")), "/") + "/s/" + slug
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{"publicUrl": publicUrl, "ownerUrl": ""})
			return
		}
		base := strings.TrimSuffix(getEnv("WORMKEY_PUBLIC_BASE_URL", getEnv("WORMKEY_PUBLIC_BASE", "http://localhost:3002")), "/")
		publicUrl := base + "/s/" + slug
		ownerUrl := sess.OwnerUrl
		if ownerUrl == "" && sess.OwnerToken != "" {
			ownerUrl = base + "/.wormkey/owner?slug=" + slug + "&token=" + sess.OwnerToken
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"publicUrl": publicUrl, "ownerUrl": ownerUrl})
	})

	mux.HandleFunc("/.wormkey/state", func(w http.ResponseWriter, r *http.Request) {
		slug := resolveSlug(r)
		val, ok := tunnels.Load(slug)
		if !ok {
			http.Error(w, "Tunnel not connected", 503)
			return
		}
		tc := val.(*tunnelConn)
		if !isOwner(r, tc) {
			http.Error(w, "Forbidden", 403)
			return
		}
		tc.policyMu.RLock()
		policy := tc.policy
		tc.policyMu.RUnlock()
		viewers := tc.snapshotViewers()
		out := map[string]any{
			"slug":            slug,
			"owner":           true,
			"activeViewers":   len(viewers),
			"activeStreams":   tc.activeStreams.Load(),
			"viewers":         viewers,
			"kickedViewerIds": tc.kickedIDs(),
			"policy":          policy,
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(out)
	})

	mux.HandleFunc("/.wormkey/policy", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", 405)
			return
		}
		slug := resolveSlug(r)
		val, ok := tunnels.Load(slug)
		if !ok {
			http.Error(w, "Tunnel not connected", 503)
			return
		}
		tc := val.(*tunnelConn)
		if !isOwner(r, tc) {
			http.Error(w, "Forbidden", 403)
			return
		}
		var patch policyPatch
		if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
			http.Error(w, "Invalid JSON", 400)
			return
		}
		tc.policyMu.Lock()
		if patch.Public != nil {
			tc.policy.Public = *patch.Public
		}
		if patch.MaxConcurrentViewers != nil {
			tc.policy.MaxConcurrentViewers = *patch.MaxConcurrentViewers
		}
		if patch.BlockPaths != nil {
			tc.policy.BlockPaths = patch.BlockPaths
		}
		policy := tc.policy
		tc.policyMu.Unlock()
		go syncPolicy(controlPlaneURL, slug, policy)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "policy": policy})
	})

	mux.HandleFunc("/.wormkey/kick", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", 405)
			return
		}
		slug := resolveSlug(r)
		val, ok := tunnels.Load(slug)
		if !ok {
			http.Error(w, "Tunnel not connected", 503)
			return
		}
		tc := val.(*tunnelConn)
		if !isOwner(r, tc) {
			http.Error(w, "Forbidden", 403)
			return
		}
		viewerID := r.URL.Query().Get("id")
		if viewerID == "" {
			http.Error(w, "Missing viewer id", 400)
			return
		}
		tc.viewerMu.Lock()
		tc.kickedViewers[viewerID] = struct{}{}
		delete(tc.viewers, viewerID)
		tc.viewerMu.Unlock()
		go syncKick(controlPlaneURL, slug, viewerID)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "viewerId": viewerID})
	})

	mux.HandleFunc("/.wormkey/rotate-password", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", 405)
			return
		}
		slug := resolveSlug(r)
		val, ok := tunnels.Load(slug)
		if !ok {
			http.Error(w, "Tunnel not connected", 503)
			return
		}
		tc := val.(*tunnelConn)
		if !isOwner(r, tc) {
			http.Error(w, "Forbidden", 403)
			return
		}
		pw := randomSecret(4)
		tc.policyMu.Lock()
		tc.policy.Password = pw
		policy := tc.policy
		tc.policyMu.Unlock()
		go syncPolicy(controlPlaneURL, slug, policy)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "password": pw})
	})

	mux.HandleFunc("/.wormkey/close", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", 405)
			return
		}
		slug := resolveSlug(r)
		val, ok := tunnels.Load(slug)
		if !ok {
			http.Error(w, "Tunnel not connected", 503)
			return
		}
		tc := val.(*tunnelConn)
		if !isOwner(r, tc) {
			http.Error(w, "Forbidden", 403)
			return
		}
		tunnels.Delete(slug)
		closedSlugs.Store(slug, struct{}{})
		go syncClose(controlPlaneURL, slug)
		_ = tc.conn.Close()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
	})

	// Everything else proxies to tunnel (or shows "not connected" when no slug)
	mux.HandleFunc("/", handleProxy(&tunnels, controlPlaneURL))

	port := os.Getenv("PORT")
	if port == "" {
		port = "3002" // local fallback only
	}
	addr := "0.0.0.0:" + port
	log.Println("listening on", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}

func (tc *tunnelConn) writeFrame(data []byte) error {
	tc.writeMu.Lock()
	defer tc.writeMu.Unlock()
	return tc.conn.WriteMessage(websocket.BinaryMessage, data)
}

func getEnv(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

func handleTunnel(tunnels *sync.Map, closedSlugs *sync.Map, controlPlaneURL string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Upgrade") != "websocket" {
			http.Error(w, "WebSocket required", 400)
			return
		}
		token := r.Header.Get("Authorization")
		if token == "" || !strings.HasPrefix(token, "Bearer ") {
			http.Error(w, "Missing or invalid token", 401)
			return
		}
		rawToken := strings.TrimSpace(token[7:])
		slug := rawToken
		ownerToken := ""
		if dot := strings.IndexByte(rawToken, '.'); dot > 0 {
			slug = rawToken[:dot]
			if dot+1 < len(rawToken) {
				ownerToken = rawToken[dot+1:]
			}
		}
		if len(slug) > 64 {
			slug = slug[:64]
		}
		if _, closed := closedSlugs.Load(slug); closed {
			http.Error(w, "Session closed", http.StatusGone)
			return
		}
		if sess, status, err := fetchSession(controlPlaneURL, slug); err == nil && status == http.StatusOK {
			if sess.Closed {
				closedSlugs.Store(slug, struct{}{})
				http.Error(w, "Session closed", http.StatusGone)
				return
			}
			if sess.OwnerToken != "" && ownerToken != "" && sess.OwnerToken != ownerToken {
				http.Error(w, "Invalid session token", http.StatusUnauthorized)
				return
			}
		}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("Upgrade error: %v", err)
			return
		}
		tc := &tunnelConn{conn: conn, slug: slug, ownerToken: ownerToken, viewers: map[string]*viewerState{}, kickedViewers: map[string]struct{}{}}
		tc.policy = tunnelPolicy{Public: true, MaxConcurrentViewers: 20}
		hydrateFromControlPlane(controlPlaneURL, slug, tc)
		if existing, ok := tunnels.Load(slug); ok {
			if prev, okPrev := existing.(*tunnelConn); okPrev && prev != tc {
				_ = prev.conn.Close()
			}
		}
		tunnels.Store(slug, tc)
		defer func() {
			if current, ok := tunnels.Load(slug); ok {
				if active, okActive := current.(*tunnelConn); okActive && active == tc {
					tunnels.Delete(slug)
				}
			}
			conn.Close()
		}()
		log.Printf("Tunnel connected: %s", slug)
		for {
			_, data, err := conn.ReadMessage()
			if err != nil {
				break
			}
			if len(data) < 5 {
				continue
			}
			ftype := data[0]
			streamID := binary.BigEndian.Uint32(data[1:5])
			payload := data[5:]
			switch ftype {
			case FramePing:
				pong := make([]byte, 5)
				pong[0] = FramePong
				binary.BigEndian.PutUint32(pong[1:5], ControlStreamID)
				_ = tc.writeFrame(pong)
			case FramePong:
			case FrameResponseHdrs:
				if ctx, ok := tc.streams.Load(streamID); ok {
					sc := ctx.(*streamCtx)
					lines := bytes.Split(payload, []byte("\r\n"))
					if len(lines) > 0 {
						status := 200
						parts := bytes.SplitN(lines[0], []byte(" "), 3)
						if len(parts) >= 2 {
							fmt.Sscanf(string(parts[1]), "%d", &status)
						}
						for i := 1; i < len(lines); i++ {
							line := lines[i]
							if len(line) == 0 {
								break
							}
							colon := bytes.IndexByte(line, ':')
							if colon > 0 {
								k := string(bytes.TrimSpace(line[:colon]))
								v := string(bytes.TrimSpace(line[colon+1:]))
								sc.w.Header().Set(k, v)
							}
						}
						if sc.setCookie != "" {
							// wormkey_slug ensures asset requests (/_next/..., /assets/...) route correctly
							sc.w.Header().Add("Set-Cookie", "wormkey_slug="+sc.setCookie+"; Path=/; SameSite=Lax")
						}
						sc.w.WriteHeader(status)
						if sc.flusher != nil {
							sc.flusher.Flush()
						}
					}
				}
			case FrameStreamData:
				if ctx, ok := tc.streams.Load(streamID); ok {
					sc := ctx.(*streamCtx)
					sc.w.Write(payload)
					if sc.flusher != nil {
						sc.flusher.Flush()
					}
				}
			case FrameStreamEnd:
				if ctx, ok := tc.streams.LoadAndDelete(streamID); ok {
					sc := ctx.(*streamCtx)
					if iw, ok := sc.w.(*overlayInjectWriter); ok {
						iw.FlushInject()
					}
					tc.activeStreams.Add(-1)
					close(sc.done)
				}
			case FrameStreamCancel:
				if ctx, ok := tc.streams.LoadAndDelete(streamID); ok {
					tc.activeStreams.Add(-1)
					close(ctx.(*streamCtx).done)
				}
			}
		}
	}
}

func handleProxy(tunnels *sync.Map, controlPlaneURL string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		slugFromPath := strings.HasPrefix(r.URL.Path, "/s/")
		slug := resolveSlug(r)
		if slug == "" {
			writeInvalidSlug(w)
			return
		}
		val, ok := tunnels.Load(slug)
		if !ok {
			writeWormholeNotActive(w)
			return
		}
		tc := val.(*tunnelConn)
		owner := isOwner(r, tc)
		viewerID := ""
		if !owner {
			viewerID = getViewerID(w, r)
			tc.viewerMu.RLock()
			_, kicked := tc.kickedViewers[viewerID]
			tc.viewerMu.RUnlock()
			if kicked {
				writeViewerRemoved(w)
				return
			}
			tc.upsertViewer(viewerID, r.RemoteAddr)
			go syncViewers(controlPlaneURL, slug, tc.snapshotViewers())
		}
		tc.policyMu.RLock()
		policy := tc.policy
		tc.policyMu.RUnlock()
		if !policy.Public && !owner {
			writeLockedByOwner(w)
			return
		}
		if !owner && policy.Password != "" {
			password := ""
			if c, err := r.Cookie("wormkey_pass"); err == nil {
				password = c.Value
			}
			if qp := r.URL.Query().Get("wormkey_password"); qp != "" {
				password = qp
				setCookie(w, "wormkey_pass", qp, true)
			}
			if password != policy.Password {
				writePasswordRequired(w)
				return
			}
		}
		if !owner && policy.MaxConcurrentViewers > 0 && len(tc.snapshotViewers()) >= policy.MaxConcurrentViewers {
			writeTooManyViewers(w)
			return
		}
		if !owner && len(policy.BlockPaths) > 0 {
			for _, p := range policy.BlockPaths {
				if p != "" && strings.HasPrefix(r.URL.Path, p) {
					writePathBlocked(w)
					return
				}
			}
		}
		streamID := tc.streamID.Add(1)
		var buf bytes.Buffer
		fmt.Fprintf(&buf, "%s %s HTTP/1.1\r\n", r.Method, r.URL.RequestURI())
		r.Header.Write(&buf)
		buf.WriteString("\r\n")
		frame := make([]byte, 5+buf.Len())
		frame[0] = FrameOpenStream
		binary.BigEndian.PutUint32(frame[1:5], streamID)
		copy(frame[5:], buf.Bytes())
		if err := tc.writeFrame(frame); err != nil {
			writeTunnelWriteFailed(w)
			return
		}
		done := make(chan struct{})
		flusher, _ := w.(http.Flusher)
		setCookie := ""
		if slugFromPath || r.URL.Query().Get("slug") != "" || extractSlugFromHost(r.Host) == slug {
			setCookie = slug
		}
		respW := http.ResponseWriter(w)
		if owner {
			respW = &overlayInjectWriter{w: w, slug: slug}
		}
		tc.activeStreams.Add(1)
		tc.streams.Store(streamID, &streamCtx{w: respW, done: done, flusher: flusher, setCookie: setCookie})
		sendStreamEnd := func() {
			f := make([]byte, 5)
			f[0] = FrameStreamEnd
			binary.BigEndian.PutUint32(f[1:5], streamID)
			tc.writeFrame(f)
		}
		if r.Body != nil && r.ContentLength != 0 {
			go func() {
				defer r.Body.Close()
				br := bufio.NewReader(r.Body)
				for {
					chunk := make([]byte, 32*1024)
					n, err := br.Read(chunk)
					if n > 0 {
						f := make([]byte, 5+n)
						f[0] = FrameStreamData
						binary.BigEndian.PutUint32(f[1:5], streamID)
						copy(f[5:], chunk[:n])
						tc.writeFrame(f)
					}
					if err == io.EOF {
						break
					}
					if err != nil {
						break
					}
				}
				sendStreamEnd()
			}()
		} else {
			if r.Body != nil {
				r.Body.Close()
			}
			sendStreamEnd()
		}
		<-done
	}
}
