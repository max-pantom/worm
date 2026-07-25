import Link from "next/link";
import { BlogMascot } from "../BlogMascot";
import { ArticleCodeBlock } from "../../components/ArticleCodeBlock";

export const metadata = {
  title: "Wormkey 0.4 — built for agents, safer for everyone",
  description:
    "A security-first Wormkey release with remote controls, JSON output, request inspection, replay, and MCP.",
};

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-[var(--code-bg)] px-1.5 py-0.5 font-mono text-[13px] text-[var(--fg)]">
    {children}
  </code>
);

export default function WormkeyAgentNativePost() {
  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--fg)]">
      <main className="mx-auto max-w-xl px-4 pb-20 pt-10 sm:px-6">
        <Link
          href="/blog"
          className="mb-8 inline-flex min-h-[44px] items-center gap-2 py-2 text-sm text-[var(--muted-fg)] transition-colors hover:text-[var(--fg)]"
        >
          ← All posts
        </Link>

        <article>
          <header className="mb-10">
            <div className="mb-3 flex items-center gap-2 text-xs text-[var(--muted-fg)]">
              <span>July 25, 2026</span>
              <span aria-hidden="true">·</span>
              <span>Wormkey 0.4</span>
            </div>
            <h1 className="text-2xl font-bold leading-tight text-[var(--fg)]">
              Wormkey 0.4 — built for agents, safer for everyone
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted-fg)]">
              Today Wormkey became more than a command that opens a public URL.
              It became a proper handoff layer for unfinished software.
            </p>
          </header>

          <div className="space-y-6 text-[15px] leading-relaxed">
            <p className="text-[var(--muted-fg)]">
              Wormkey started with one promise: run one command, get one public
              link, share what is running on your machine. That part is still
              the center of the product. But the way software gets built is
              changing. More of it is being written, tested, and reviewed by
              agents that need stable output instead of decorated terminal
              text.
            </p>

            <p className="text-[var(--muted-fg)]">
              So this release does two things at once: it makes the tunnel safer
              for people, and much easier for agents to operate.
            </p>

            <h2 className="mt-10 text-lg font-bold text-[var(--fg)]">
              The security work came first
            </h2>

            <p className="text-[var(--muted-fg)]">
              The control plane now has three clear boundaries. Public routes
              only return safe tunnel status. Owner routes require the owner
              bearer token. Gateway synchronization uses a separate internal
              service key.
            </p>

            <p className="text-[var(--muted-fg)]">
              Session IDs, slugs, and credentials now use cryptographically
              secure randomness. Owner and tunnel tokens are stored as hashes.
              The gateway validates a session before completing its WebSocket
              upgrade.
            </p>

            <p className="text-[var(--muted-fg)]">
              Request forwarding is stricter too. Wormkey now limits request
              bodies and pending streams, strips unsafe forwarding headers,
              adds timeouts, and cancels the localhost request when the viewer
              disconnects.
            </p>

            <h2 className="mt-10 text-lg font-bold text-[var(--fg)]">
              The CLI can finally speak machine
            </h2>

            <p className="text-[var(--muted-fg)]">
              Agents should not need to scrape QR codes or guess whether a
              sentence means success. The new JSON mode writes one stable object
              to stdout while status messages stay on stderr.
            </p>

            <ArticleCodeBlock code="wormkey http 3000 --json --no-interactive" />
            <ArticleCodeBlock
              language="json"
              code={`{\n  "session_id": "sess_123",\n  "url": "https://quiet-lime-k7m4.wormkey.run",\n  "expires_at": "2026-07-25T21:00:00Z",\n  "status": "connected"\n}`}
            />

            <p className="text-[var(--muted-fg)]">
              Wormkey can also wait for your application before exposing it:
            </p>

            <ArticleCodeBlock code="wormkey http 3000 --wait-for /health --timeout 60s" />

            <p className="text-[var(--muted-fg)]">
              Or manage the application and tunnel as one process:
            </p>

            <ArticleCodeBlock code="wormkey run --port 3000 -- npm run dev" />

            <h2 className="mt-10 text-lg font-bold text-[var(--fg)]">
              A tunnel you can inspect
            </h2>

            <p className="text-[var(--muted-fg)]">
              Run <Code>wormkey http 3000 --inspect</Code> and Wormkey records
              request metadata locally: method, path, status, duration, request
              bytes, response bytes, and request ID.
            </p>

            <ArticleCodeBlock
              code={`wormkey logs --json\nwormkey inspect req_123\nwormkey replay req_123`}
            />

            <p className="text-[var(--muted-fg)]">
              That makes Wormkey useful for webhook work, API debugging, and
              agent loops where a failed request should become the next piece of
              context.
            </p>

            <h2 className="mt-10 text-lg font-bold text-[var(--fg)]">
              Remote controls and MCP
            </h2>

            <p className="text-[var(--muted-fg)]">
              Sessions now live in a secure multi-tunnel state file. You can
              list them, inspect them, and close one remotely even if the
              original terminal is gone.
            </p>

            <ArticleCodeBlock
              code={`wormkey list\nwormkey status quiet-lime-k7m4\nwormkey close quiet-lime-k7m4`}
            />

            <p className="text-[var(--muted-fg)]">
              The new <Code>@wormkey/mcp</Code> package exposes tools for
              starting, reading, listing, closing, inspecting, replaying, and
              waiting on tunnels. Coding agents can now use Wormkey without
              pretending to be a person at a terminal.
            </p>

            <h2 className="mt-10 text-lg font-bold text-[var(--fg)]">
              What Wormkey is becoming
            </h2>

            <p className="text-[var(--muted-fg)]">
              Deployment assumes software is ready to live somewhere. Wormkey
              assumes software is still being made, but needs to become briefly
              reachable, inspectable, and collaborative.
            </p>

            <p className="text-[var(--muted-fg)]">
              That is the category we are building toward:{" "}
              <strong className="text-[var(--fg)]">
                the handoff layer between local execution and external
                intelligence.
              </strong>
            </p>

            <div className="mt-10 flex gap-3 border-t border-[var(--border)] pt-8">
              <Link
                href="/release/0.4.0"
                className="inline-flex min-h-[44px] items-center rounded-lg border border-[var(--border)] bg-[var(--code-bg)] px-4 text-sm font-semibold text-[var(--fg)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                View release notes →
              </Link>
            </div>
          </div>
        </article>

        <div className="mt-16 flex justify-center">
          <BlogMascot />
        </div>
      </main>
    </div>
  );
}
