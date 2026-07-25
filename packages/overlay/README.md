# wormkey-overlay

Helpers for adding the [Wormkey](https://wormkey.run) tunnel overlay to browser, React, and Express applications.

## Install

```bash
npm install wormkey-overlay
```

## Automatic browser loader

Add the Wormkey overlay URL to your page:

```html
<meta
  name="wormkey-overlay-url"
  content="https://wormkey.run/.wormkey/overlay.js?slug=YOUR_SLUG"
/>
```

Then import the automatic loader:

```js
import "wormkey-overlay/auto";
```

## React

```tsx
import { WormkeyOverlay } from "wormkey-overlay/react";

export function App() {
  return (
    <WormkeyOverlay
      gatewayUrl="https://wormkey.run"
      slug="YOUR_SLUG"
    />
  );
}
```

You can also pass `scriptUrl` directly or provide a custom `gatewayUrl`.

## Express

```ts
import express from "express";
import { wormkeyOverlayMiddleware } from "wormkey-overlay/express";

const app = express();

app.use(
  wormkeyOverlayMiddleware({
    scriptUrl:
      "https://wormkey.run/.wormkey/overlay.js?slug=YOUR_SLUG",
  }),
);
```

The middleware injects the overlay script into HTML responses.

## License

MIT
