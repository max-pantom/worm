"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { latestBlogPost } from "../blog/posts";

export function AnnouncementBar() {
  const pathname = usePathname();
  if (
    pathname.startsWith("/blog") ||
    pathname.startsWith("/release") ||
    pathname === "/mascot"
  ) {
    return null;
  }

  return (
    <div className="border-b border-[var(--border)] bg-[var(--bg)]">
      <div className="mx-auto flex max-w-xl items-center justify-center px-4 py-2.5">
        <Link
          href={`/blog/${latestBlogPost.slug}`}
          className="text-center text-sm text-[var(--muted-fg)] transition-colors hover:text-[var(--accent)] touch-manipulation"
        >
          <span className="opacity-70">New:</span>{" "}
          <span className="underline decoration-dotted underline-offset-2">
            {latestBlogPost.title}
          </span>
        </Link>
      </div>
    </div>
  );
}
