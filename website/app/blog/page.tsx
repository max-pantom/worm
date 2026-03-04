import Link from "next/link";
import { BlogMascot } from "./BlogMascot";

export const metadata = {
  title: "How Wormkey works — and why I built it",
  description:
    "A short story about building a localhost tunnel that just works. No account, no dashboard, no friction.",
};

export default function BlogPage() {
  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--fg)]">
      <main className="mx-auto max-w-xl px-4 pt-10 pb-20 sm:px-6">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center gap-2 py-2 text-sm text-[var(--muted-fg)] transition-colors hover:text-[var(--fg)] touch-manipulation mb-8"
        >
          ← Back
        </Link>

        <article>
          <header className="mb-10">
            <h1 className="text-2xl font-bold text-[var(--fg)] leading-tight">
              How Wormkey works — and why I built it
            </h1>
            <p className="mt-2 text-sm text-[var(--muted-fg)]">
              A short story about building a localhost tunnel that just works.
            </p>
          </header>

          <div className="space-y-6 text-[15px] leading-relaxed">
            <h2 className="text-lg font-bold mb-4 text-[var(--fg)]">
              Why I built it
            </h2>

            <p className="text-[var(--muted-fg)]">
              A friend of mine couldn't share his demo because of something to do with Vercel. I don't know why exactly, but we tried a lot of things and couldn't get it to work. So I built Wormkey.
            </p>

            <p className="text-[var(--muted-fg)]">
              It's <strong className="text-[var(--fg)]">much faster</strong> than ngrok or Cloudflare Tunnel. It's <strong className="text-[var(--fg)]">more accessible for non-developers</strong> — no signup, no dashboard, no DNS. Just run a command and share the link. Easy.
            </p>

            <p className="text-[var(--muted-fg)]">
              It's not a deploy platform. It's not a hosting provider. It's a controlled wormhole from your laptop to the internet. When you're done, you close the tunnel and it's gone.
            </p>

            <h2 className="text-lg font-bold mt-10 mb-4 text-[var(--fg)]">
              How it works
            </h2>

            <p className="text-[var(--muted-fg)]">
              When you run <code className="rounded bg-[var(--code-bg)] px-1.5 py-0.5 text-[13px] font-mono text-[var(--fg)]">wormkey http 3000</code>, three things happen:
            </p>

            <ol className="list-decimal list-inside space-y-3 text-[var(--muted-fg)]">
              <li>
                <strong className="text-[var(--fg)]">Session</strong> — The CLI talks to a control plane and gets a unique slug (e.g. <code className="rounded bg-[var(--code-bg)] px-1 py-0.5 text-[13px] font-mono text-[var(--fg)]">quiet-lime-82</code>). No auth, no signup. Just a slug.
              </li>
              <li>
                <strong className="text-[var(--fg)]">Tunnel</strong> — The CLI opens a WebSocket to an edge gateway and keeps it open. Traffic flows through that pipe: HTTP, WebSocket, everything. Your app stays on your machine.
              </li>
              <li>
                <strong className="text-[var(--fg)]">Public URL</strong> — Anyone can hit <code className="rounded bg-[var(--code-bg)] px-1 py-0.5 text-[13px] font-mono text-[var(--fg)]">wormkey.run/s/quiet-lime-82</code> and reach your localhost. The gateway terminates TLS, routes by slug, and streams requests back and forth.
              </li>
            </ol>

            <p className="text-[var(--muted-fg)]">
              The protocol is simple: binary frames over WebSocket. Open stream, send data, close stream. HTTP requests become streams. WebSocket upgrades become duplex pipes. No magic, just plumbing.
            </p>

            <h2 className="text-lg font-bold mt-10 mb-4 text-[var(--fg)]">
              Architecture
            </h2>

            <p className="text-[var(--muted-fg)]">
              Here’s how the pieces fit together:
            </p>

            <div className="my-8 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--code-bg)] p-6">
              <svg
                viewBox="0 0 520 220"
                className="w-full min-w-[400px]"
                aria-label="Wormkey architecture diagram"
              >
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="8"
                    markerHeight="6"
                    refX="7"
                    refY="3"
                    orient="auto"
                  >
                    <polygon
                      points="0 0, 8 3, 0 6"
                      fill="var(--muted-fg)"
                    />
                  </marker>
                </defs>
                {/* Viewer */}
                <rect
                  x="20"
                  y="20"
                  width="90"
                  height="50"
                  rx="6"
                  fill="var(--bg)"
                  stroke="var(--border)"
                  strokeWidth="1.5"
                />
                <text x="65" y="50" textAnchor="middle" fill="var(--fg)" fontSize="11" fontWeight="500">
                  Viewer
                </text>
                <text x="65" y="64" textAnchor="middle" fill="var(--muted-fg)" fontSize="9">
                  browser
                </text>

                {/* Edge Gateway */}
                <rect
                  x="165"
                  y="20"
                  width="100"
                  height="50"
                  rx="6"
                  fill="var(--code-bg)"
                  stroke="var(--border)"
                  strokeWidth="1.5"
                />
                <text x="215" y="50" textAnchor="middle" fill="var(--fg)" fontSize="11" fontWeight="500">
                  Edge Gateway
                </text>
                <text x="215" y="64" textAnchor="middle" fill="var(--muted-fg)" fontSize="9">
                  TLS, routing
                </text>

                {/* CLI */}
                <rect
                  x="310"
                  y="20"
                  width="90"
                  height="50"
                  rx="6"
                  fill="var(--bg)"
                  stroke="var(--border)"
                  strokeWidth="1.5"
                />
                <text x="355" y="50" textAnchor="middle" fill="var(--fg)" fontSize="11" fontWeight="500">
                  CLI
                </text>
                <text x="355" y="64" textAnchor="middle" fill="var(--muted-fg)" fontSize="9">
                  wormkey
                </text>

                {/* Localhost */}
                <rect
                  x="445"
                  y="20"
                  width="75"
                  height="50"
                  rx="6"
                  fill="var(--bg)"
                  stroke="var(--border)"
                  strokeWidth="1.5"
                />
                <text x="482" y="50" textAnchor="middle" fill="var(--fg)" fontSize="11" fontWeight="500">
                  localhost
                </text>
                <text x="482" y="64" textAnchor="middle" fill="var(--muted-fg)" fontSize="9">
                  :3000
                </text>

                {/* Control Plane */}
                <rect
                  x="185"
                  y="130"
                  width="110"
                  height="50"
                  rx="6"
                  fill="var(--bg)"
                  stroke="var(--border)"
                  strokeWidth="1.5"
                />
                <text x="240" y="160" textAnchor="middle" fill="var(--fg)" fontSize="11" fontWeight="500">
                  Control Plane
                </text>
                <text x="240" y="174" textAnchor="middle" fill="var(--muted-fg)" fontSize="9">
                  session, slug
                </text>

                {/* Arrows: Viewer → Gateway */}
                <line x1="110" y1="45" x2="165" y2="45" stroke="var(--muted-fg)" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
                <text x="137" y="38" fill="var(--muted-fg)" fontSize="8">HTTPS</text>

                {/* Arrows: Gateway → CLI */}
                <line x1="310" y1="45" x2="265" y2="45" stroke="var(--muted-fg)" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
                <text x="287" y="38" fill="var(--muted-fg)" fontSize="8">WebSocket</text>

                {/* Arrows: CLI → Localhost */}
                <line x1="400" y1="45" x2="445" y2="45" stroke="var(--muted-fg)" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
                <text x="420" y="38" fill="var(--muted-fg)" fontSize="8">HTTP</text>

                {/* Arrows: CLI → Control Plane (get slug) */}
                <path d="M 310 70 L 270 130" stroke="var(--muted-fg)" strokeWidth="1.5" fill="none" strokeDasharray="4 2" markerEnd="url(#arrowhead)" />
                <text x="275" y="102" fill="var(--muted-fg)" fontSize="8">get slug</text>
              </svg>
            </div>

            <p className="text-[var(--muted-fg)]">
              If that sounds useful, give it a try:
            </p>

            <pre className="rounded-lg border border-[var(--border)] bg-[var(--code-bg)] p-4 text-[13px] font-mono text-[var(--fg)] overflow-x-auto">
              <code>npm i -g wormkey{`\n`}wormkey http 3000</code>
            </pre>

            <p className="text-[var(--muted-fg)] text-sm mt-10">
              — Built for developers who just want to share.
            </p>
          </div>
        </article>

        <div className="mt-16 flex justify-center">
          <BlogMascot />
        </div>

        <div className="mt-12 flex flex-col items-center gap-6">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--code-bg)] px-4 py-3 text-sm font-semibold text-[var(--fg)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] touch-manipulation sm:py-2"
          >
            Get started →
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-[var(--muted-fg)]">
            <a
              href="https://x.com/metagravity0"
              target="_blank"
              rel="noreferrer"
              className="border-b border-transparent border-dotted transition-colors hover:border-current hover:text-[var(--accent)] touch-manipulation"
            >
              X
            </a>
            <a
              href="https://github.com/max-pantom/worm"
              target="_blank"
              rel="noreferrer"
              className="border-b border-transparent border-dotted transition-colors hover:border-current hover:text-[var(--accent)] touch-manipulation"
            >
              GitHub
            </a>
            <a
              href="https://www.npmjs.com/package/wormkey"
              target="_blank"
              rel="noreferrer"
              className="border-b border-transparent border-dotted transition-colors hover:border-current hover:text-[var(--accent)] touch-manipulation"
            >
              npm
            </a>
            <Link
              href="/"
              className="border-b border-transparent border-dotted transition-colors hover:border-current hover:text-[var(--accent)] touch-manipulation"
            >
              wormkey.run
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
