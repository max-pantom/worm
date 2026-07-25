# Wormkey for AI Agents

Wormkey gives an agent a temporary public URL for software running locally. It is designed for previews, browser testing, webhook debugging, handoffs, and tools that need to reach an application before it is deployed.

## Install

```bash
npm install --global wormkey@0.4.0
```

Verify the CLI:

```bash
wormkey --version
```

## Start a machine-readable tunnel

Use JSON mode whenever another process needs to consume the result:

```bash
wormkey http 3000 --json --no-interactive
```

Wormkey writes one JSON object to stdout:

```json
{
  "session_id": "sess_123",
  "url": "https://quiet-lime-k7m4.wormkey.run",
  "owner_url": "https://wormkey.run/.wormkey/owner?slug=quiet-lime-k7m4&token=...",
  "expires_at": "2026-07-25T21:00:00.000Z",
  "pid": 4821,
  "status": "connected"
}
```

Status and connection messages are written to stderr. Do not parse decorated interactive output.

## Wait until the application is ready

Agents often start a development server and expose it before it is ready. Use a readiness path:

```bash
wormkey http 3000 \
  --wait-for /health \
  --timeout 60s \
  --json \
  --no-interactive
```

Wormkey waits for a successful local HTTP response before creating the public session.

To only test readiness:

```bash
wormkey wait-until-ready 3000 --path /health --timeout 60s
```

## Manage the process and tunnel together

Use `wormkey run` when the agent should own both lifecycles:

```bash
wormkey run \
  --port 3000 \
  --wait-for /health \
  --timeout 60s \
  --json \
  --no-interactive \
  -- npm run dev
```

When the child process exits, Wormkey closes the tunnel. When Wormkey receives `SIGINT` or `SIGTERM`, it terminates the child process and tunnel together.

## Write session information atomically

Use `--output` when another tool watches a file:

```bash
wormkey http 3000 \
  --json \
  --no-interactive \
  --output .wormkey/session.json
```

Wormkey writes through a temporary file and renames it into place.

## List, inspect, and close tunnels

```bash
wormkey list --json
wormkey status quiet-lime-k7m4 --json
wormkey close quiet-lime-k7m4 --json
```

`wormkey close` calls the authenticated control-plane endpoint. It works even when the original tunnel process is no longer available.

Local session state is stored in `~/.wormkey/sessions.json` with restrictive permissions.

## Inspect and replay requests

Start an inspectable tunnel:

```bash
wormkey http 3000 --inspect --json --no-interactive
```

Read request metadata:

```bash
wormkey logs --json
wormkey inspect req_123
```

Replay a captured request to the original local port:

```bash
wormkey replay req_123
```

Captured metadata includes the request ID, method, path, status, duration, request bytes, response bytes, timestamp, and local session ID.

## Restricted session tokens

Create a short-lived token for an agent:

```bash
wormkey token create quiet-lime-k7m4 \
  --name codex-preview \
  --scope tunnel:connect,tunnel:read \
  --max-ttl 2h
```

Available scopes:

- `tunnel:connect`
- `tunnel:read`
- `tunnel:close`

Tokens are returned once and stored as hashes by the control plane.

## MCP server

Install the MCP package:

```bash
npm install --global wormkey-mcp@0.4.0
```

Start it over stdio:

```bash
wormkey-mcp
```

Available tools:

| Tool | Purpose |
|---|---|
| `wormkey_start_tunnel` | Start a noninteractive HTTP tunnel |
| `wormkey_get_tunnel` | Read tunnel status |
| `wormkey_list_tunnels` | List locally known tunnels |
| `wormkey_close_tunnel` | Close a tunnel remotely |
| `wormkey_get_requests` | Read captured request logs |
| `wormkey_replay_request` | Replay a captured request |
| `wormkey_wait_until_ready` | Wait for a local HTTP service |

Set `WORMKEY_BIN` when the MCP server should use a non-default Wormkey executable.

## Recommended agent workflow

1. Start the application.
2. Wait for a health endpoint.
3. Open a JSON, noninteractive Wormkey tunnel.
4. Pass the public URL to a browser or reviewer.
5. Inspect failed requests and replay them locally.
6. Patch and retest the application.
7. Close the tunnel remotely.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `10` | Invalid arguments |
| `11` | Local service unavailable |
| `12` | Control plane unavailable |
| `13` | Gateway authentication failed |
| `14` | Tunnel expired |
| `15` | Policy rejected |
| `16` | Rate limited |

## Security guidance

- Treat `owner_url`, owner tokens, and restricted tokens as secrets.
- Do not commit `~/.wormkey/sessions.json` or generated session output.
- Use short expiration times for automated previews.
- Close tunnels after tests and review are complete.
- Enable request inspection only when captured request data is appropriate to store locally.
