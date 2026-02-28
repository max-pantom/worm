"use client";

import { useEffect } from "react";

export interface WormkeyOverlayProps {
  /** Full overlay script URL, e.g. https://wormkey.run/.wormkey/overlay.js?slug=pale-snow-91 */
  scriptUrl?: string;
  /** Gateway base URL (e.g. https://wormkey.run). Use with slug. */
  gatewayUrl?: string;
  /** Slug for the wormhole. If omitted and viewing at /s/:slug, derived from URL. */
  slug?: string;
}

/**
 * Wormkey overlay bar for owners. Import in your RootLayout.
 * Loads the overlay script from the gateway; API requests go to the gateway (not the page origin).
 */
export function WormkeyOverlay({ scriptUrl, gatewayUrl, slug: slugProp }: WormkeyOverlayProps) {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const slug =
      slugProp ??
      (typeof window !== "undefined" && window.location.pathname.match(/^\/s\/([^/]+)/)?.[1]);
    const base = gatewayUrl?.replace(/\/$/, "") ?? process.env.NEXT_PUBLIC_WORMKEY_GATEWAY_URL;
    const url =
      scriptUrl ?? (base && slug ? `${base}/.wormkey/overlay.js?slug=${slug}` : null);

    if (!url) return;
    if (document.querySelector('[data-wormkey-overlay="1"]')) return;

    const script = document.createElement("script");
    script.src = url;
    script.defer = true;
    script.setAttribute("data-wormkey-overlay", "1");
    document.body.appendChild(script);
  }, [scriptUrl, gatewayUrl, slugProp]);

  return null;
}
