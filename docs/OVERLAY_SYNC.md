# Overlay Control Bar Sync

Design: [Figma 1533-250](https://www.figma.com/design/7CEkYWa9qILAR44XxKckGe/Studio?node-id=1533-250) (full), [1533-236](https://www.figma.com/design/7CEkYWa9qILAR44XxKckGe/Studio?node-id=1533-236) (Copy Url tab), [1533-211](https://www.figma.com/design/7CEkYWa9qILAR44XxKckGe/Studio?node-id=1533-211) (tab bar)

The owner control bar exists in two places:

| Location | Purpose |
|----------|---------|
| `packages/gateway/overlay.js` | **Source of truth** – served at `/.wormkey/overlay.js`, used by real tunnels |
| `website/app/page.tsx` (`DemoControlBar`) | Demo on the landing page – toggle to preview |

## When you change the control bar

1. **Edit** `packages/gateway/overlay.js` – layout, buttons, styling, API calls.
2. **Rebuild** the gateway: `cd packages/gateway && go build -o /dev/null .`
3. **Update** `website/app/page.tsx` (`DemoControlBar`) – match layout/buttons for the demo.

The demo is non-functional (no real API calls). It only needs to look similar for the preview.

## Build error: `Cannot find module './682.js'`

This is a Next.js cache corruption. Fix:

```bash
cd website && rm -rf .next && npm run dev
```
