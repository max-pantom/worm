# Wormkey

<p align="center">
  <strong>Open a wormhole to your localhost.</strong>
</p>

<p align="center">
  Expose your local server to a secure public URL in seconds. Share your work, demo to clients, or test webhooks—no deploy, no config.
</p>

<p align="center">
  <a href="https://wormkey.run">wormkey.run</a>
</p>

---

## What is Wormkey?

Wormkey creates a secure tunnel from the internet to your local machine. Run your app on `localhost`, share a URL, and anyone can access it—without deploying, port forwarding, or VPNs.

- **Instant** — One command, one URL
- **Secure** — TLS-terminated, owner-controlled
- **Simple** — No accounts required for basic use

---

## Quick Start

### 1. Install

```bash
npm install -g wormkey
# or
npx wormkey http 3000
```

### 2. Expose your app

```bash
# Start your local server (e.g. Next.js, Vite, etc.)
npm run dev

# In another terminal, open a wormhole
wormkey http 3000
```

You'll get a shareable URL:

```
Wormhole open.
https://wormkey.run/s/quiet-lime-82

Owner claim URL (open once for controls):
https://wormkey.run/.wormkey/owner?slug=quiet-lime-82&token=...
```

Share the first URL. Open the owner URL once to enable in-page controls when viewing through the tunnel.

---

## Integration

### Option A: Script tag (any framework)

Add to your app layout:

```html
<script defer src="https://wormkey.run/.wormkey/overlay.js?slug=YOUR_SLUG"></script>
```

When your app is viewed through the wormhole URL, a Wormkey control bar appears.

### Option B: React / Next.js

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
        <WormkeyOverlay slug={process.env.NEXT_PUBLIC_WORMKEY_SLUG} />
      </body>
    </html>
  );
}
```

### Option C: Auto-mount (meta tag)

```bash
npm install @wormkey/overlay
```

```ts
import "@wormkey/overlay/auto";
```

```html
<meta name="wormkey-overlay-url" content="https://wormkey.run/.wormkey/overlay.js?slug=YOUR_SLUG" />
```

---

## CLI Reference

| Command | Description |
|---------|-------------|
| `wormkey http <port>` | Expose a port via wormhole |
| `wormkey http 3000 --auth` | Require basic auth |
| `wormkey http 5173 --expires 30m` | Limit tunnel lifetime |

---

## Local Development

Run the full stack locally:

```bash
# Terminal 1: Control plane
cd packages/control-plane && npm install && npm run dev

# Terminal 2: Edge gateway
cd packages/gateway && go run .

# Terminal 3: CLI (from repo root)
cd packages/cli && npm install && npm run build
wormkey http 3000
```

| Component | Port | Role |
|-----------|------|------|
| **CLI** | — | Connects to Edge, forwards traffic to localhost |
| **Control Plane** | 3001 | Session creation, slug allocation |
| **Edge Gateway** | 3002 | TLS, routing, stream forwarding |

---

## Project Structure

```
worm/
├── docs/
│   ├── PROTOCOL.md   # Tunnel protocol specification
│   └── DEPLOY.md     # Production deployment guide
├── packages/
│   ├── cli/          # wormkey npm package (Node/TypeScript)
│   ├── control-plane/   # Session API (Node/Fastify)
│   ├── gateway/      # Edge gateway (Go)
│   └── overlay/      # Overlay helpers (React, Express, auto)
├── website/          # wormkey.run (Next.js)
└── README.md
```

---

## Environment

For local development, see `.env.example`. Key variables:

| Variable | Description |
|----------|-------------|
| `WORMKEY_CONTROL_PLANE_URL` | Control plane API URL |
| `WORMKEY_EDGE_URL` | Edge gateway WebSocket URL (e.g. `ws://localhost:3002/tunnel`) |

---

## Documentation

- [Protocol](docs/PROTOCOL.md) — Tunnel protocol specification
- [Deploy](docs/DEPLOY.md) — Production deployment (Render, Vercel)

---

## License

MIT

---

*Not a deploy platform. Not a hosting provider. Just a controlled wormhole.*
