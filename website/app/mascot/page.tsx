"use client";

/**
 * Mascot showcase page.
 * - Colors: app/components/WormMascot.tsx (COLOR_VARIANTS, MASCOT_VARIANT_SWATCHES)
 * - Color bar: this file, below
 */

import React, { useState } from "react";
import Link from "next/link";
import { WormMascot, type WormVariant, MASCOT_VARIANT_SWATCHES } from "../components/WormMascot";

export default function MascotPage() {
  const [variant, setVariant] = useState<WormVariant>(2);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--bg)] p-6">
      <Link
        href="/"
        className="absolute left-6 top-6 text-sm text-[var(--muted-fg)] hover:text-[var(--fg)]"
      >
        ← Back
      </Link>

      <div className="scale-[5] shrink-0">
        <WormMascot variant={variant} />
      </div>

      {/* Color bar - fixed at bottom, overlay style */}
      <div className="fixed bottom-10 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[rgba(109,109,109,0.6)] px-4 py-2.5 backdrop-blur-[20px]">
          <div className="flex items-center gap-1.5">
            {([1, 2, 3, 4, 5, 6, 7] as WormVariant[]).map((v) => (
              <button
                key={v}
                onClick={() => setVariant(v)}
                className={`h-5 w-5 shrink-0 rounded-full transition-all hover:scale-110 ${
                  variant === v ? "ring-2 ring-white/80 ring-offset-2 ring-offset-[rgba(109,109,109,0.6)]" : ""
                }`}
                style={{ backgroundColor: MASCOT_VARIANT_SWATCHES[v] }}
                aria-label={`Variant ${v}`}
                title={`Variant ${v}`}
              />
            ))}
          </div>
        </div>
    </div>
  );
}
