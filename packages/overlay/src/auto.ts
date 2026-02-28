declare global {
  interface Window {
    __WORMKEY_OVERLAY_URL__?: string;
  }
}

export function auto(scriptUrl?: string): boolean {
  if (typeof document === "undefined") return false;

  const src =
    scriptUrl ??
    window.__WORMKEY_OVERLAY_URL__ ??
    document.querySelector('meta[name="wormkey-overlay-url"]')?.getAttribute("content") ??
    "";

  if (!src) return false;
  if (document.querySelector(`script[data-wormkey-overlay="1"]`)) return true;

  const script = document.createElement("script");
  script.defer = true;
  script.src = src;
  script.dataset.wormkeyOverlay = "1";
  document.head.appendChild(script);
  return true;
}

auto();
