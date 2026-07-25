# Wormkey TODO

> Updated July 25, 2026 for Wormkey `0.4.0`.
>
> - `[x]` completed
> - `[ ]` still needed
> - ~~struck through~~ replaced by a newer implementation or intentionally retained for compatibility

> *You've proven data can flow through the wormhole. Now the problem shifts from transport to control and durability. The moment you expose localhost to the public internet, you're no longer solving routing — you're managing surface area under uncertainty. Stability before feature depth is what turns a clever tunnel into a dependable boundary system. If you treat each wormhole as a temporary public interface with lifecycle, identity, and policy, every later feature will layer cleanly instead of fracturing the core.*
>
> — mana

---

## Core Invariant ✓

**Phase 1 proves:**

```
Browser → Gateway → Tunnel → CLI → Localhost → Response
```

The hard conceptual problem is solved. Now we structure the next phases so Wormkey becomes a real product, not just a working pipe.

---

## Phase 2 – Real Internet Exposure

**Goal:** Move from local dev routing to actual public wormholes.

### 2.1 Wildcard Domain + TLS (First Priority)

**Need:**
- `*.wormkey.run` → Load balancer
- TLS cert for `*.wormkey.run`
- Gateway reading hostname instead of `?slug=`

**Current:** `localhost:3002?slug=quiet-lime-82`  
**Target:** `https://quiet-lime-82.wormkey.run`

**Gateway changes:**
- [x] Extract slug from `Host` header
- [ ] Make wildcard subdomains the default public URL
- ~~Remove cookie-based routing fallback~~ — retained as compatibility fallback for path-based URLs and asset routing
- [ ] Only use the owner cookie for owner identity after wildcard routing is the default
- ~~Remove query-based routing entirely~~ — retain only as a backwards-compatible fallback, never as authentication

This moves Wormkey from dev tool to internet product.

### 2.2 Session Binding Model Cleanup

**Strict model:**
```
slug -> sessionId
sessionId -> active tunnelConnectionId
```

**Gateway must:**
- [x] Reject requests if no active tunnel
- [x] Return clean 502 or Wormhole Closed page
- [x] Add branded closed, invalid, paused, blocked, removed, password, and limit pages with no raw gateway errors

---

## Phase 3 – Stability Layer

**Goal:** Make wormholes resilient.

### 3.1 Reconnect Logic

**Currently:** If CLI disconnects, wormhole dies.

**Upgrade to:**

**CLI:**
- [x] On disconnect: retry with exponential backoff
- [x] Reuse sessionToken
- [x] Re-register tunnel

**Control plane:**
- [x] Session remains active until expiry or manual close while the control-plane process is alive
- [ ] Persist sessions across control-plane restarts

**Gateway:**
- [x] On reconnect: rebind slug → new tunnel connection and close the previous connection

Now dev laptop sleep doesn't kill session instantly.

### 3.2 Idle Cleanup

- [ ] `session.lastSeenAt` update on each request
- [ ] Auto close if no traffic for X minutes
- [ ] Configurable idle timeout

Prevents zombie wormholes.

### 3.3 Rate Limiting (Edge Level)

**Minimum controls per session:**
- [x] Maximum pending streams in the CLI
- [ ] Maximum active streams at the edge
- [ ] Max requests per second
- [ ] Return 429 when exceeded
- [x] Maximum concurrent viewers with a branded 429 response
- [x] Request body limit and request timeout

This protects the dev server.

---

## Phase 4 – Access Control Layer

**Where Wormkey becomes differentiated.**

### 4.1 Basic Auth (`--auth`)

**CLI:** `wormkey http 3000 --auth`

**Control plane:**
- [x] Generate a cryptographically random password
- [ ] Store user-provided/basic-auth passwords with Argon2id
- [x] Set `authMode = basic`

**Gateway:**
- [x] Enforce tunnel-session authorization before WebSocket upgrade
- [x] Enforce owner authorization before owner actions
- [x] Enforce configured viewer password before tunnel forwarding
- [ ] Support standard browser Basic Authorization headers in addition to the current password flow

**Important:** Auth must be enforced at edge, not CLI.

### 4.2 Expiry (`--expires`)

**CLI:** `wormkey http 3000 --expires 30m`

**Control plane:**
- [x] Set `expiresAt`

**Gateway:**
- [ ] Check on every request
- [ ] After expiry → 410 Gone or custom expired page
- [x] Close the local CLI session automatically at expiry
- [ ] Close the gateway session automatically when the control plane reports expiry

---

## Phase 5 – WebSocket Upgrade Support

**Right now:** HTTP works.

**Next:**

**Gateway:**
- [ ] Detect `Upgrade: websocket`
- [ ] Convert to tunnel WS_UPGRADE frame
- [ ] Switch stream to raw duplex

**CLI:**
- [ ] Open WS connection to localhost
- [ ] Pipe frames both ways

Without this, Next.js dev HMR and Vite won't fully work. **Critical before public beta.**

---

## Phase 6 – Infrastructure Hardening

*Not needed for alpha, but soon.*

### 6.1 Redis

**For:**
- [ ] slug → session map
- [ ] session → active tunnel connection
- [ ] pub/sub for policy updates
- [ ] distributed gateway nodes

Without Redis you cannot scale beyond single gateway.

### 6.2 Postgres

**Right now:** Sessions live in memory.

**Move to Postgres:**
- [ ] Users
- ~~Sessions~~ — temporary tunnel state should move to Redis first
- [ ] Policies
- ~~Expiry~~ — temporary expiry belongs with Redis-backed session TTLs
- [ ] Reserved domains
- [ ] Billing and audit logs

Memory only is not production safe.

---

## Phase 7 – Login / Device Flow

**Right now:** Session creation likely unauthenticated.

**Need:**

**CLI:** `wormkey login`

**Device flow:**
1. [ ] CLI prints: "Visit wormkey.run/device and enter code ABC123"
2. [ ] User logs in via browser
3. [ ] CLI polls for token
4. [ ] Store refresh token locally

Now sessions are tied to user.

---

## Phase 8 – In Page Overlay

*Once internet exposure is stable.*

**Gateway:**
- [x] If Content-Type is `text/html`
- [x] If owner cookie is present
- [x] Inject the optional overlay script

**Overlay:**
- [x] Calls `/.wormkey/state`
- [x] Renders the owner control bar
- [x] Supports pause, policy updates, viewer removal, password rotation, URL copy, and remote close

Policy updates currently synchronize gateway → control plane. Redis pub/sub remains future work for multiple gateway nodes.

*Phase 8 because it depends on stability and auth.*

---

## Architectural Checkpoint

**4 maturity levels:**

| Level | State |
|-------|-------|
| **1** | Local tunnel works ✓ |
| **2** | Public TLS + reconnect ✓ · raw WebSocket proxying remains |
| **3** | Access control ✓ · expiry partial · edge rate limiting remains |
| **4** | Overlay + live policy control ✓ |

**Do not skip Level 2 stability before UI features.**

---

## Strategic Advice

You are at the dangerous point. The tunnel works. Temptation: add features.

**Correct move:** Stabilize the boundary.

**Before** fancy UI, replay, collaboration, analytics — **make:**
- ~~Reconnect bulletproof~~ ✓
- WebSocket perfect
- Expiry reliable
- Rate limiting safe

A tunnel tool dies instantly if unstable.

---

## Suggested Immediate Next Task Order

1. Wildcard domain + TLS
2. Host-based slug routing ✓
3. Reconnect logic ✓
4. WebSocket upgrade support
5. Access control ✓ · standard Basic Authorization remains
6. Expiry partial
7. Idle cleanup
8. Redis integration
9. Login/device flow
10. Overlay injection ✓

That order minimizes architectural rewrites.

---

## Completed (Phase 1)

- [x] Protocol spec
- [x] CLI minimal tunnel client
- [x] Gateway minimal stream forwarder
- [x] Control plane session creation
- [x] End-to-end flow
- [x] Response headers fix
- [x] Cookie-based asset routing (to be removed once wildcard live)
- [x] WebSocket concurrent write mutex
- [x] Host-based slug extraction
- [x] 502 Wormhole not active fallback

---

## Completed Since Phase 1

### Security and authorization

- [x] Separate public, owner, and internal control-plane APIs
- [x] Owner bearer-token checks for session reads and mutations
- [x] Shared internal gateway credential
- [x] Cryptographically secure session IDs, slugs, owner tokens, and tunnel tokens
- [x] SHA-256 hashes for random bearer credentials
- [x] Session validation before gateway WebSocket upgrade
- [x] Unsafe forwarding-header removal
- [x] Request body limits, pending-stream limits, and request timeouts
- [x] Real cancellation with `AbortController`
- [x] Browser disconnect propagation through `STREAM_CANCEL`
- [x] Secure local state permissions
- [x] Unauthorized-access regression tests

### Reliable tunnel controls

- [x] Remote tunnel close without the original CLI process
- [x] Gateway polling that disconnects remotely closed sessions
- [x] Multiple locally tracked tunnel sessions
- [x] `wormkey list`
- [x] `wormkey status`
- [x] `wormkey close`
- [x] Structured request IDs
- [x] Gateway protocol and control-plane packages split under `internal/`

### Agent-native CLI

- [x] `--json`
- [x] `--no-interactive`
- [x] Atomic `--output` session files
- [x] Readiness waiting with `--wait-for` and `--timeout`
- [x] `wormkey run --port <port> -- <command>`
- [x] Deterministic exit-code definitions
- [x] Request inspection and JSON logs
- [x] Local request replay
- [x] Restricted, expiring session tokens
- [x] `@wormkey/mcp` with start, get, list, close, requests, replay, and readiness tools

### Product, docs, and delivery

- [x] Blog archive and Wormkey `0.4.0` release story
- [x] Release archive and individual release pages
- [x] Homepage announcement for the latest post
- [x] Homepage “Why Wormkey” security and access-boundary section
- [x] Agent documentation
- [x] `/llms.txt` and `/llm.txt`
- [x] GitHub Actions for TypeScript, Go, tests, vet, dependency review, npm audit, and CodeQL

---

## Current Priority Queue

1. [ ] Redis-backed sessions and TTLs
2. [ ] Edge request-rate and connection-rate limiting
3. [ ] True raw WebSocket proxying for HMR and application WebSockets
4. [ ] Gateway expiry enforcement on every request
5. [ ] Argon2id password hashing
6. [ ] Idle-session cleanup
7. [ ] Wildcard subdomains as the default generated URL
8. [ ] Login/device flow and reserved names
