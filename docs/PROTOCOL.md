# Wormkey Tunnel Protocol (v0)

**Transport:** WebSocket (persistent outbound from CLI to Edge)

**Purpose:** Multiplex HTTP and WebSocket traffic between Edge Gateway and localhost through a single tunnel connection.

---

## Frame Format

All frames are binary over WebSocket. Each frame has a fixed header:

```
┌─────────────┬─────────────┬─────────────────────────────────┐
│  Type (1B)  │ StreamID(4B)│  Payload (variable)             │
└─────────────┴─────────────┴─────────────────────────────────┘
```

- **Type:** 1 byte, frame type identifier
- **StreamID:** 4 bytes, big-endian uint32. 0x00000000 reserved for control frames (PING/PONG)
- **Payload:** Variable length, type-specific

---

## Frame Types

| Type | Name | Direction | Description |
|------|------|-----------|-------------|
| 0x01 | OPEN_STREAM | Edge → CLI | New incoming request. Payload: HTTP method, path, headers |
| 0x02 | STREAM_DATA | Both | Request/response body chunk |
| 0x03 | STREAM_END | Both | End of stream |
| 0x04 | STREAM_CANCEL | Both | Abort stream |
| 0x05 | RESPONSE_HEADERS | CLI → Edge | Response status + headers |
| 0x06 | WS_UPGRADE | Edge → CLI | Upgrade stream to WebSocket proxy mode |
| 0x07 | WS_DATA | Both | Raw WebSocket frame (in duplex mode) |
| 0x08 | WS_CLOSE | Both | WebSocket close |
| 0x09 | PING | Both | Keepalive |
| 0x0A | PONG | Both | Keepalive response |

---

## Stream Lifecycle (HTTP)

1. **Edge receives HTTP request** → Sends `OPEN_STREAM` with streamId, method, path, headers
2. **CLI receives OPEN_STREAM** → Proxies request to localhost, gets response
3. **CLI sends RESPONSE_HEADERS** → Status code, headers
4. **CLI sends STREAM_DATA** (0+ chunks) → Response body
5. **CLI sends STREAM_END** → Stream complete

Edge may send `STREAM_CANCEL` at any time. CLI must stop forwarding and send `STREAM_END` or `STREAM_CANCEL`.

---

## WebSocket Upgrade

When Edge detects `Upgrade: websocket` on incoming request:

1. Edge sends `WS_UPGRADE` instead of `OPEN_STREAM`
2. CLI opens WebSocket connection to localhost
3. Stream switches to raw duplex: `WS_DATA` and `WS_CLOSE` only
4. No HTTP response headers—connection is upgraded

---

## Control Frames

**PING/PONG:** StreamID = 0. Used for keepalive and connection health. No payload required.

---

## Session Establishment

Before tunnel protocol:

1. CLI calls Control Plane `POST /sessions`
2. Receives: `sessionId`, `slug`, `publicUrl`, `edgeUrl`, `sessionToken`, `expiresAt`
3. CLI connects WebSocket to `edgeUrl` with `Authorization: Bearer <sessionToken>`
4. Edge validates token, binds `slug` → connection
5. Tunnel protocol begins

---

## Limits (v0)

- Max concurrent streams per session: 100
- Max request body size: 10MB
- Idle timeout: 5 minutes (no PING/PONG or stream activity)
- Reconnect: CLI may reconnect with same `sessionToken`; Edge rebinds slug to new connection
