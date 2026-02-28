# Wormkey Deployment

## The Problem: "control plane alive" when opening share link

If you visit `https://wormkey.run/s/slug` and see `{"status":"control plane alive"}`, **wormkey.run is pointing to the control plane instead of the gateway.**

## Architecture

| Domain | Service | Handles |
|--------|---------|---------|
| wormkey-control-plane.onrender.com | Control plane | `/sessions`, health |
| **wormkey.run** | **Gateway** | `/s/:slug`, `/tunnel`, `/.wormkey/*` |

The control plane returns `{"status":"control plane alive"}` for `GET /`. The gateway proxies `/s/:slug` to active tunnels. **wormkey.run must point to the gateway.**

## Fix: Point wormkey.run to the Gateway

### 1. Deploy the gateway

Create a **Web Service** on [Render](https://dashboard.render.com):

- **Root Directory:** `packages/gateway`
- **Runtime:** Go
- **Build Command:** `go build -o gateway .`
- **Start Command:** `./gateway`
- **Environment:** none (production defaults are built-in)

### 2. Point wormkey.run to the gateway

In Render: add **wormkey.run** as a custom domain on the gateway service. Update your DNS (CNAME to the Render URL).

### 3. Verify

1. `wormkey http 3000` (with a server on port 3000)
2. Open the share link (e.g. `https://wormkey.run/s/bold-sage-35`)
3. You should see your local app, not `{"status":"control plane alive"}`
