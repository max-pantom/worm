# Wormkey Website

Landing page for [wormkey.run](https://wormkey.run). Deploy to Vercel.

## Deploy

1. Push this repo and import the `website` folder as a Vercel project
2. Set root directory to `website`
3. Point `wormkey.run` to the Vercel deployment (DNS)

## Routing

`vercel.json` rewrites tunnel traffic to the gateway:

- `/s/*` → gateway (tunnel share URLs)
- `/tunnel` → gateway (WebSocket)
- `/.wormkey/*` → gateway (overlay, owner, etc.)

Update the `destination` URL in `vercel.json` if your gateway is not at `wormkey-gateway.onrender.com`.
