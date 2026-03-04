import Link from "next/link";
import { WormMascot } from "../components/WormMascot";

export const metadata = {
  title: "How Wormkey works — and why I built it",
  description:
    "A short story about building a localhost tunnel that just works. No account, no dashboard, no friction.",
};

export default function BlogPage() {
  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--fg)]">
      <main className="mx-auto max-w-xl px-6 pt-10 pb-20">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[var(--muted-fg)] hover:text-[var(--fg)] transition-colors mb-8"
        >
          ← Back
        </Link>

        <article>
          <header className="mb-10">
            <h1 className="text-2xl font-semibold text-[var(--fg)] leading-tight">
              How Wormkey works — and why I built it
            </h1>
            <p className="mt-2 text-sm text-[var(--muted-fg)]">
              A short story about building a localhost tunnel that just works.
            </p>
          </header>

          <div className="space-y-6 text-[var(--fg)] text-[15px] leading-relaxed">
            <p>
              I kept running into the same problem: I’d spin up a local app, want to share it with a teammate or client, and then hit a wall. Ngrok wanted me to sign up. Cloudflare Tunnel felt heavy. Some tools needed a dashboard, others wanted me to configure DNS. All I wanted was a link.
            </p>

            <p>
              So I built Wormkey. One command, one URL. No account, no dashboard, no friction.
            </p>

            <h2 className="text-lg font-semibold mt-10 mb-4 text-[var(--fg)]">
              How it works
            </h2>

            <p>
              When you run <code className="rounded bg-[var(--code-bg)] px-1.5 py-0.5 text-[13px] font-mono">wormkey http 3000</code>, three things happen:
            </p>

            <ol className="list-decimal list-inside space-y-3 text-[var(--fg)]">
              <li>
                <strong>Session</strong> — The CLI talks to a control plane and gets a unique slug (e.g. <code className="rounded bg-[var(--code-bg)] px-1 py-0.5 text-[13px] font-mono">quiet-lime-82</code>). No auth, no signup. Just a slug.
              </li>
              <li>
                <strong>Tunnel</strong> — The CLI opens a WebSocket to an edge gateway and keeps it open. Traffic flows through that pipe: HTTP, WebSocket, everything. Your app stays on your machine.
              </li>
              <li>
                <strong>Public URL</strong> — Anyone can hit <code className="rounded bg-[var(--code-bg)] px-1 py-0.5 text-[13px] font-mono">wormkey.run/s/quiet-lime-82</code> and reach your localhost. The gateway terminates TLS, routes by slug, and streams requests back and forth.
              </li>
            </ol>

            <p>
              The protocol is simple: binary frames over WebSocket. Open stream, send data, close stream. HTTP requests become streams. WebSocket upgrades become duplex pipes. No magic, just plumbing.
            </p>

            <h2 className="text-lg font-semibold mt-10 mb-4 text-[var(--fg)]">
              Why it exists
            </h2>

            <p>
              I wanted a tunnel tool that felt like <code className="rounded bg-[var(--code-bg)] px-1.5 py-0.5 text-[13px] font-mono">python -m http.server</code> — zero setup, instant share. Wormkey is that. Install it, run it, share the link. Done.
            </p>

            <p>
              It’s not a deploy platform. It’s not a hosting provider. It’s a controlled wormhole from your laptop to the internet. When you’re done, you close the tunnel and it’s gone.
            </p>

            <p>
              If that sounds useful, give it a try:
            </p>

            <pre className="rounded-lg bg-[var(--code-bg)] p-4 text-[13px] font-mono overflow-x-auto">
              <code>npm i -g wormkey{`\n`}wormkey http 3000</code>
            </pre>

            <p className="text-[var(--muted-fg)] text-sm mt-10">
              — Built for developers who just want to share.
            </p>
          </div>
        </article>

        <div className="mt-16 flex justify-center">
          <WormMascot variant={2} className="opacity-60" />
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--code-bg)] px-4 py-2 text-sm font-medium text-[var(--fg)] hover:opacity-90 transition-opacity"
          >
            Get started →
          </Link>
        </div>
      </main>
    </div>
  );
}
