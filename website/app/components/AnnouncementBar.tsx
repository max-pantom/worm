"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AnnouncementBar() {
  const pathname = usePathname();
  if (pathname === "/blog" || pathname === "/mascot") return null;

  return (
    <div className="border-b border-[var(--border)] bg-[var(--bg)]">
      <div className="mx-auto flex max-w-xl items-center justify-center px-4">
        <Link
          href="/blog"
          className="py-1.5 text-center text-[11px] text-[var(--muted-fg)] transition-colors hover:text-[var(--accent)] touch-manipulation"
        >
          <span className="opacity-70">New:</span>{" "}
          <span className="underline decoration-dotted underline-offset-2">
            How Wormkey works — and why I built it
          </span>
        </Link>
      </div>
    </div>
  );
}
