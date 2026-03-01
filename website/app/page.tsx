"use client";

import { useMemo, useState } from "react";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function Home() {
  const [copied, setCopied] = useState<string | null>(null);

  const year = useMemo(() => new Date().getFullYear(), []);

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      setCopied(null);
    }
  };

  const installCmd = "npm i -g wormkey";
  const quickCmd = "wormkey http 3000";
  const envBlock = `# optional overrides
WORMKEY_CONTROL_PLANE_URL=https://wormkey-control-plane.onrender.com
WORMKEY_EDGE_URL=wss://t.wormkey.run/tunnel`;

  return (
    <div className="min-h-dvh bg-[radial-gradient(1200px_700px_at_50%_-100px,rgba(59,130,246,0.22),transparent_55%)] bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto max-w-3xl px-5 py-14 sm:py-16">
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/70 px-3 py-1 text-[12px] text-zinc-700 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Wormkey
          </div>

          <h1 className="mt-4 text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px]">
            Share your localhost in one command.
          </h1>

          <p className="mt-3 max-w-2xl text-[13px] leading-6 text-zinc-600 dark:text-zinc-400">
            Wormkey opens a secure tunnel from your machine to a public URL, so
            teammates can preview your dev server instantly. No account. No
            dashboard. Just a link.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <CodeRow
              label="Install"
              value={installCmd}
              copied={copied === "install"}
              onCopy={() => copy(installCmd, "install")}
            />
            <CodeRow
              label="Run"
              value={quickCmd}
              copied={copied === "run"}
              onCopy={() => copy(quickCmd, "run")}
            />
          </div>

          <p className="mt-3 text-[12px] leading-5 text-zinc-500 dark:text-zinc-500">
            Default tunnel host is{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              t.wormkey.run
            </span>
            . Your app stays on your machine. Wormkey only forwards requests.
          </p>
        </header>

        <section className="mb-10 grid gap-3 sm:grid-cols-3">
          <Card
            title="Fast setup"
            desc="Start your app, run one command, share the link."
          />
          <Card
            title="Reconnects"
            desc="Tunnel auto-reconnects on drop so sessions survive hiccups."
          />
          <Card
            title="Dev friendly"
            desc="Works with Vite, Next, CRA, APIs, and any HTTP server."
          />
        </section>

        <section className="mb-10">
          <h2 className="text-[14px] font-semibold tracking-tight">
            Quick start
          </h2>
          <div className="mt-3 space-y-2">
            <Step n="1">Start your app locally (example: port 3000).</Step>
            <Step n="2">
              Run <InlineCode>wormkey http 3000</InlineCode>
            </Step>
            <Step n="3">
              Share the printed URL. Anyone with the link can access it.
            </Step>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-[14px] font-semibold tracking-tight">
            Optional configuration
          </h2>
          <p className="mt-2 text-[12px] leading-5 text-zinc-600 dark:text-zinc-400">
            You usually don&apos;t need this. Use it if you self host the
            control plane or gateway.
          </p>

          <div className="mt-3 rounded-xl border border-zinc-200 bg-white/70 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/40">
            <pre className="overflow-x-auto text-[12px] leading-5 text-zinc-800 dark:text-zinc-200">
              {envBlock}
            </pre>
            <div className="mt-3 flex justify-end">
              <button
                className={clsx(
                  "rounded-lg border px-3 py-1.5 text-[12px] font-medium",
                  "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50",
                  "dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900",
                  copied === "env" &&
                    "border-blue-500 text-blue-600 dark:text-blue-400"
                )}
                onClick={() => copy(envBlock, "env")}
              >
                {copied === "env" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-[14px] font-semibold tracking-tight">
            Owner overlay
          </h2>
          <p className="mt-2 text-[12px] leading-5 text-zinc-600 dark:text-zinc-400">
            When you open your app through a Wormkey link, you can load the
            overlay script to unlock owner controls.
          </p>

          <CodeRow
            label="Script"
            value='<script defer src="https://t.wormkey.run/.wormkey/overlay.js?slug=YOUR_SLUG"></script>'
            copied={copied === "overlay"}
            onCopy={() =>
              copy(
                '<script defer src="https://t.wormkey.run/.wormkey/overlay.js?slug=YOUR_SLUG"></script>',
                "overlay"
              )
            }
          />

          <div className="mt-3 rounded-xl border border-zinc-200 bg-white/70 p-4 text-[12px] leading-5 text-zinc-600 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
            Overlay is optional. Core sharing works without it.
          </div>
        </section>

        <footer className="flex items-center justify-between border-t border-zinc-200 pt-6 text-[12px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
          <span>© {year} Wormkey</span>
          <div className="flex items-center gap-4">
            <a
              className="hover:text-blue-600 dark:hover:text-blue-400"
              href="https://www.npmjs.com/package/wormkey"
              target="_blank"
              rel="noreferrer"
            >
              npm
            </a>
            <a
              className="hover:text-blue-600 dark:hover:text-blue-400"
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
            >
              github
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 text-[12px] text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
      {children}
    </code>
  );
}

function Step({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-zinc-200 bg-white/70 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-[12px] font-semibold text-white">
        {n}
      </div>
      <div className="text-[12px] leading-5 text-zinc-700 dark:text-zinc-300">
        {children}
      </div>
    </div>
  );
}

function Card({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white/70 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </div>
      <div className="mt-1 text-[12px] leading-5 text-zinc-600 dark:text-zinc-400">
        {desc}
      </div>
    </div>
  );
}

function CodeRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-stretch justify-between gap-2 rounded-xl border border-zinc-200 bg-white/70 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-500">
          {label}
        </div>
        <code className="mt-1 block truncate text-[12px] text-zinc-800 dark:text-zinc-200">
          {value}
        </code>
      </div>
      <button
        onClick={onCopy}
        className={clsx(
          "shrink-0 rounded-lg border px-3 text-[12px] font-medium",
          "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50",
          "dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900",
          copied && "border-blue-500 text-blue-600 dark:text-blue-400"
        )}
        aria-label={`Copy ${label}`}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
