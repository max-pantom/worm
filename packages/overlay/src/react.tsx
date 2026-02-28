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
 *
 * @example
 * // Option 1: Full script URL (from CLI output or session)
 * <WormkeyOverlay scriptUrl="https://wormkey.run/.wormkey/overlay.js?slug=pale-snow-91" />
 *
 * @example
 * // Option 2: Gateway + slug (slug from env or derived from URL when viewing at /s/:slug)
 * <WormkeyOverlay gatewayUrl="https://wormkey.run" slug={slug} />
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
