import Link from "next/link";
import { BlogMascot } from "./BlogMascot";
import { blogPosts } from "./posts";

export const metadata = {
  title: "Blog — Wormkey",
  description: "Notes about building Wormkey and making localhost shareable.",
};

export default function BlogIndexPage() {
  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--fg)]">
      <main className="mx-auto max-w-xl px-4 pb-20 pt-10 sm:px-6">
        <Link
          href="/"
          className="mb-8 inline-flex min-h-[44px] items-center gap-2 py-2 text-sm text-[var(--muted-fg)] transition-colors hover:text-[var(--fg)]"
        >
          ← Back
        </Link>

        <header className="mb-10">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted-fg)]">
            Wormkey blog
          </p>
          <h1 className="text-2xl font-bold leading-tight text-[var(--fg)]">
            Notes from inside the wormhole
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted-fg)]">
            What we are building, why it works this way, and what changed along
            the way.
          </p>
        </header>

        <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {blogPosts.map((post, index) => (
            <article key={post.slug} className="py-7">
              <div className="flex items-center gap-2 text-xs text-[var(--muted-fg)]">
                {index === 0 && (
                  <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                    Latest
                  </span>
                )}
                <span>{post.date}</span>
                <span aria-hidden="true">·</span>
                <span>{post.readingTime}</span>
              </div>
              <h2 className="mt-3 text-lg font-bold leading-snug text-[var(--fg)]">
                <Link
                  href={`/blog/${post.slug}`}
                  className="transition-colors hover:text-[var(--accent)]"
                >
                  {post.title}
                </Link>
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted-fg)]">
                {post.description}
              </p>
              <Link
                href={`/blog/${post.slug}`}
                className="mt-4 inline-flex min-h-[44px] items-center text-sm font-semibold text-[var(--fg)] transition-colors hover:text-[var(--accent)]"
              >
                Read post →
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-14 flex justify-center">
          <BlogMascot />
        </div>
      </main>
    </div>
  );
}
