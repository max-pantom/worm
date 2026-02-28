// Wormkey Edge Gateway
// TLS termination, hostname routing, stream forwarding

package main

import (
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
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

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
	Policy          tunnelPolicy  `json:"policy"`
	KickedViewerIds []string      `json:"kickedViewerIds"`
	ActiveViewers   []viewerState `json:"activeViewers"`
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

func writeWormholeNotActive(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusBadGateway)
	_, _ = w.Write([]byte(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Wormhole not active</title></head>
<body style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:2rem;text-align:center">
<h1 style="font-size:1.25rem;font-weight:600">502 Wormhole not active</h1>
<p style="color:#64748b;margin-top:0.5rem">No tunnel is connected for this host. Run <code>wormkey http &lt;port&gt;</code> to open a wormhole.</p>
</body>
</html>`))
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
	url := strings.TrimRight(controlPlaneURL, "/") + "/sessions/by-slug/" + slug
	resp, err := http.Get(url)
	if err != nil {
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return
	}
	var sess persistedSession
	if err := json.NewDecoder(resp.Body).Decode(&sess); err != nil {
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
	controlPlaneURL := getEnv("WORMKEY_CONTROL_PLANE", "https://wormkey-control-plane.onrender.com")

	mux := http.NewServeMux()

	// Health
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		w.Write([]byte("ok"))
	})

	// Tunnel websocket endpoint
	mux.HandleFunc("/tunnel", handleTunnel(&tunnels, controlPlaneURL))

	mux.HandleFunc("/.wormkey/overlay.js", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache, must-revalidate")
		js := `(function(){
  var gatewayOrigin = (function(){
    var s = document.currentScript && document.currentScript.src;
    return s ? new URL(s).origin : window.location.origin;
  })();
  function getSlug(){
    var s = new URLSearchParams(window.location.search).get('slug');
    if (s) return s;
    var m = window.location.pathname.match(/^\/s\/([^\/]+)/);
    return m ? m[1] : null;
  }
  function buildUrl(path){
    var u = new URL(path, gatewayOrigin);
    var slug = getSlug();
    if (slug) u.searchParams.set('slug', slug);
    return u.toString();
  }

  function req(path, opts){
    return fetch(buildUrl(path), Object.assign({credentials:'include'}, opts || {}));
  }

  req('/.wormkey/me').then(function(r){ if (!r.ok) return; return r.json(); }).then(function(me){
    if (!me || !me.owner) return;
    var root = document.createElement('div');
    root.id = 'wormkey-bar';
    root.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:2147483647;font:12px ui-monospace, Menlo, monospace;background:#101820;color:#f4f4ef;border-radius:16px;padding:8px 10px;display:flex;gap:8px;align-items:center;box-shadow:0 8px 30px rgba(0,0,0,.25);max-width:calc(100vw - 24px)';

    var handle = document.createElement('button');
    handle.textContent = '::';
    handle.title = 'Drag';
    handle.style.cssText = 'border:0;background:transparent;color:#f4f4ef;cursor:grab;padding:2px 4px';
    root.appendChild(handle);

    var badge = document.createElement('strong');
    badge.textContent = 'Wormkey';
    root.appendChild(badge);

    var info = document.createElement('span');
    info.textContent = '...';
    info.style.opacity = '0.85';
    root.appendChild(info);

    var toggle = document.createElement('button');
    toggle.textContent = '-';
    toggle.title = 'Collapse';
    root.appendChild(toggle);

    var panel = document.createElement('div');
    panel.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap';
    root.appendChild(panel);

    var lock = document.createElement('button');
    lock.textContent = 'Lock';
    var rotate = document.createElement('button');
    rotate.textContent = 'Rotate';
    var close = document.createElement('button');
    close.textContent = 'Close';
    var maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.min = '1';
    maxInput.style.cssText = 'width:64px;border-radius:999px;border:0;padding:6px 8px';
    var maxSave = document.createElement('button');
    maxSave.textContent = 'Set max';
    var blockInput = document.createElement('input');
    blockInput.placeholder = '/admin';
    blockInput.style.cssText = 'width:110px;border-radius:999px;border:0;padding:6px 8px';
    var blockSave = document.createElement('button');
    blockSave.textContent = 'Block';
    var viewerSelect = document.createElement('select');
    viewerSelect.style.cssText = 'max-width:140px;border-radius:999px;border:0;padding:6px 8px';
    var kick = document.createElement('button');
    kick.textContent = 'Kick';

    [lock, rotate, close, maxSave, blockSave, kick].forEach(function(btn){
      btn.style.cssText = 'border:0;border-radius:999px;padding:5px 9px;cursor:pointer;background:#f4f4ef;color:#101820;font:12px ui-monospace, Menlo, monospace';
      panel.appendChild(btn);
    });
    panel.appendChild(maxInput);
    panel.appendChild(blockInput);
    panel.appendChild(viewerSelect);

    var collapsed = false;
    toggle.onclick = function(){
      collapsed = !collapsed;
      panel.style.display = collapsed ? 'none' : 'flex';
      toggle.textContent = collapsed ? '+' : '-';
      toggle.title = collapsed ? 'Expand' : 'Collapse';
    };

    var dragging = false;
    var dx = 0;
    var dy = 0;
    handle.onmousedown = function(ev){
      dragging = true;
      handle.style.cursor = 'grabbing';
      var rect = root.getBoundingClientRect();
      dx = ev.clientX - rect.left;
      dy = ev.clientY - rect.top;
      ev.preventDefault();
    };
    document.addEventListener('mousemove', function(ev){
      if (!dragging) return;
      root.style.left = Math.max(4, ev.clientX - dx) + 'px';
      root.style.top = Math.max(4, ev.clientY - dy) + 'px';
      root.style.bottom = 'auto';
    });
    document.addEventListener('mouseup', function(){
      dragging = false;
      handle.style.cursor = 'grab';
    });

    var state = null;
    function refresh(){
      req('/.wormkey/state').then(function(r){ if (!r.ok) throw new Error('state'); return r.json(); }).then(function(s){
        state = s;
        info.textContent = (s.policy.public ? 'Public' : 'Locked') + ' | viewers ' + s.activeViewers;
        lock.textContent = s.policy.public ? 'Lock' : 'Unlock';
        maxInput.value = String(s.policy.maxConcurrentViewers || 20);
        viewerSelect.innerHTML = '';
        (s.viewers || []).forEach(function(v){
          var opt = document.createElement('option');
          opt.value = v.id;
          opt.textContent = v.id + ' (' + v.requests + ')';
          viewerSelect.appendChild(opt);
        });
      }).catch(function(){ info.textContent = 'Unavailable'; });
    }

    lock.onclick = function(){
      if (!state) return;
      req('/.wormkey/policy', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body: JSON.stringify({ public: !state.policy.public })
      }).then(refresh);
    };

    rotate.onclick = function(){
      req('/.wormkey/rotate-password', { method:'POST' }).then(refresh);
    };

    maxSave.onclick = function(){
      var n = parseInt(maxInput.value, 10);
      if (!Number.isFinite(n) || n < 1) return;
      req('/.wormkey/policy', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body: JSON.stringify({ maxConcurrentViewers: n })
      }).then(refresh);
    };

    blockSave.onclick = function(){
      if (!state || !blockInput.value) return;
      var next = (state.policy.blockPaths || []).slice();
      if (next.indexOf(blockInput.value) === -1) next.push(blockInput.value);
      req('/.wormkey/policy', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body: JSON.stringify({ blockPaths: next })
      }).then(function(){ blockInput.value=''; refresh(); });
    };

    kick.onclick = function(){
      if (!viewerSelect.value) return;
      req('/.wormkey/kick?id=' + encodeURIComponent(viewerSelect.value), { method:'POST' }).then(refresh);
    };

    close.onclick = function(){
      req('/.wormkey/close', { method:'POST' }).then(function(){ info.textContent = 'Closed'; });
    };

    document.body.appendChild(root);
    refresh();
  }).catch(function(){});
})();`
		_, _ = w.Write([]byte(js))
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
		go syncClose(controlPlaneURL, slug)
		_ = tc.conn.Close()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
	})

	// Everything else should proxy
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

func handleTunnel(tunnels *sync.Map, controlPlaneURL string) http.HandlerFunc {
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
							// Prevent caching so cookie is always set on fresh load
							sc.w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
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
					tc.activeStreams.Add(-1)
					close(ctx.(*streamCtx).done)
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
			writeWormholeNotActive(w)
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
				http.Error(w, "Viewer removed by owner", 403)
				return
			}
			tc.upsertViewer(viewerID, r.RemoteAddr)
			go syncViewers(controlPlaneURL, slug, tc.snapshotViewers())
		}
		tc.policyMu.RLock()
		policy := tc.policy
		tc.policyMu.RUnlock()
		if !policy.Public && !owner {
			http.Error(w, "Locked by owner", 401)
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
				http.Error(w, "Password required", 401)
				return
			}
		}
		if !owner && policy.MaxConcurrentViewers > 0 && len(tc.snapshotViewers()) >= policy.MaxConcurrentViewers {
			http.Error(w, "Too many viewers", 429)
			return
		}
		if !owner && len(policy.BlockPaths) > 0 {
			for _, p := range policy.BlockPaths {
				if p != "" && strings.HasPrefix(r.URL.Path, p) {
					http.Error(w, "Path blocked", 403)
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
			http.Error(w, "Tunnel write failed", 502)
			return
		}
		done := make(chan struct{})
		flusher, _ := w.(http.Flusher)
		setCookie := ""
		if slugFromPath || r.URL.Query().Get("slug") != "" || extractSlugFromHost(r.Host) == slug {
			setCookie = slug
		}
		tc.activeStreams.Add(1)
		tc.streams.Store(streamID, &streamCtx{w: w, done: done, flusher: flusher, setCookie: setCookie})
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
