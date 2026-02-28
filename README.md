# Wormkey

**Open a wormhole to your localhost.**

A developer tool that exposes a local server to a secure public URL instantly.

---

## Quick Start (Local Dev)

### 1. Start the stack

```bash
# Terminal 1: Control Plane
cd packages/control-plane && npm install && npm run dev

# Terminal 2: Edge Gateway
cd packages/gateway && go run .

# Terminal 3: CLI (from repo root)
cd packages/cli && npm install && npm run build
```

### 2. Open a wormhole

```bash
# Start a local server (e.g. on port 3000)
# In another terminal:
wormkey http 3000
```

You'll see:
```
Wormhole open.
http://localhost:3002?slug=quiet-lime-82
Owner claim URL (open once):
http://localhost:3002/.wormkey/owner?slug=quiet-lime-82&token=...
Path B integration (add in app layout):
<script defer src="http://localhost:3002/.wormkey/overlay.js?slug=quiet-lime-82"></script>
```

Visit that URL to reach your localhost.

Open the owner claim URL once to enable owner controls in your browser.

Add the Path B script tag to your app layout to render an in-page Wormkey control bar when your app is viewed through the wormhole URL.

Or install helper package and auto-mount:

```bash
npm install @wormkey/overlay
```

```ts
import "@wormkey/overlay/auto";
```

Provide the script URL via a meta tag:

```html
<meta name="wormkey-overlay-url" content="http://localhost:3002/.wormkey/overlay.js?slug=quiet-lime-82" />
```

**Or use the React component** (Next.js / React):

```bash
npm install wormkey
```

```tsx
// app/layout.tsx
import { WormkeyOverlay } from "wormkey";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <WormkeyOverlay
          gatewayUrl={process.env.NEXT_PUBLIC_WORMKEY_GATEWAY_URL ?? "https://wormkey.run"}
        />
      </body>
    </html>
  );
}
```

- `gatewayUrl` – Gateway base (default: `NEXT_PUBLIC_WORMKEY_GATEWAY_URL` or `https://wormkey.run`)
- `slug` – Optional; when viewing at `/s/:slug`, it’s read from the URL
- `scriptUrl` – Optional; full script URL if you prefer to pass it directly

---

## Architecture

| Component | Port | Role |
|-----------|------|------|
| **CLI** (`wormkey`) | — | Connects to Edge, forwards traffic to localhost |
| **Control Plane** | 3001 | Session creation, slug allocation |
| **Edge Gateway** | 3002 | TLS, routing, stream forwarding |

---

## Commands

```
wormkey login          # Authenticate (v0: not implemented)
wormkey http <port>    # Expose port via wormhole
wormkey http 3000 --auth
wormkey http 5173 --expires 30m
wormkey status         # Active tunnel (v0: not implemented)
wormkey close          # Close tunnel (v0: use Ctrl+C)
```

---

## Protocol

See [docs/PROTOCOL.md](docs/PROTOCOL.md) for the tunnel protocol specification.

---

## Project Structure

```
worm/
├── docs/
│   └── PROTOCOL.md      # Tunnel protocol v0
├── packages/
│   ├── cli/             # wormkey npm package (Node/TypeScript)
│   ├── control-plane/   # Session API (Node/Fastify)
│   ├── gateway/         # Edge gateway (Go)
│   └── overlay/         # Overlay helpers (React, Express, auto)
└── README.md
```

---

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `WORMKEY_CONTROL_PLANE` | http://localhost:3001 | Control plane URL |
| `WORMKEY_EDGE` | http://localhost:3002 | Edge URL (CLI override) |
| `WORMKEY_EDGE_URL` | http://localhost:3002 | Edge URL (control plane) |
| `WORMKEY_BASE_DOMAIN` | wormkey.run | Public domain |
| `PORT` | 3001 / 3002 | Service port |

---

*Not a deploy platform. Not a hosting provider. Just a controlled wormhole.*
