# Wormkey TODO

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
- [ ] Remove cookie-based routing fallback (once wildcard live)
- [ ] Only use cookie for owner identity
- [ ] Remove query-based routing entirely once wildcard is live

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
- [ ] Add fallback: "Wormhole closed or expired." (no raw gateway errors)

---

## Phase 3 – Stability Layer

**Goal:** Make wormholes resilient.

### 3.1 Reconnect Logic

**Currently:** If CLI disconnects, wormhole dies.

**Upgrade to:**

**CLI:**
- [ ] On disconnect: retry with exponential backoff
- [ ] Reuse sessionToken
- [ ] Re-register tunnel

**Control plane:**
- [ ] Session remains active until expiry or manual close

**Gateway:**
- [ ] On reconnect: rebind slug → new tunnelConnectionId

Now dev laptop sleep doesn't kill session instantly.

### 3.2 Idle Cleanup

- [ ] `session.lastSeenAt` update on each request
- [ ] Auto close if no traffic for X minutes
- [ ] Configurable idle timeout

Prevents zombie wormholes.

### 3.3 Rate Limiting (Edge Level)

**Minimum controls per session:**
- [ ] Max concurrent streams
- [ ] Max requests per second
- [ ] Return 429 when exceeded

This protects the dev server.

---

## Phase 4 – Access Control Layer

**Where Wormkey becomes differentiated.**

### 4.1 Basic Auth (`--auth`)

**CLI:** `wormkey http 3000 --auth`

**Control plane:**
- [ ] Generate random password
- [ ] Store hash
- [ ] auth_mode = basic

**Gateway:**
- [ ] Check Authorization header
- [ ] Reject unauthorized before tunnel forwarding

**Important:** Auth must be enforced at edge, not CLI.

### 4.2 Expiry (`--expires`)

**CLI:** `wormkey http 3000 --expires 30m`

**Control plane:**
- [ ] Set expires_at

**Gateway:**
- [ ] Check on every request
- [ ] After expiry → 410 Gone or custom expired page
- [ ] Close session automatically

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
- [ ] Sessions
- [ ] Policies
- [ ] Expiry

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
- [ ] If Content-Type text/html
- [ ] If owner cookie present
- [ ] Inject: `<script src="/.wormkey/overlay.js"></script>`

**Overlay:**
- [ ] Calls `/.wormkey/state`
- [ ] Renders control bar

Policy updates propagate via control plane → Redis → gateway.

*Phase 8 because it depends on stability and auth.*

---

## Architectural Checkpoint

**4 maturity levels:**

| Level | State |
|-------|-------|
| **1** | Local tunnel works ✓ |
| **2** | Public TLS + reconnect + WebSockets |
| **3** | Access control + expiry + rate limiting |
| **4** | Overlay + live policy control |

**Do not skip Level 2 stability before UI features.**

---

## Strategic Advice

You are at the dangerous point. The tunnel works. Temptation: add features.

**Correct move:** Stabilize the boundary.

**Before** fancy UI, replay, collaboration, analytics — **make:**
- Reconnect bulletproof
- WebSocket perfect
- Expiry reliable
- Rate limiting safe

A tunnel tool dies instantly if unstable.

---

## Suggested Immediate Next Task Order

1. Wildcard domain + TLS
2. Host-based slug routing ✓
3. Reconnect logic
4. WebSocket upgrade support
5. Basic auth
6. Expiry
7. Idle cleanup
8. Redis integration
9. Login/device flow
10. Overlay injection

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
