"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { WormMascot } from "./components/WormMascot";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";

export default function Home() {
  const [copied, setCopied] = useState<string | null>(null);
  const [demoBarVisible, setDemoBarVisible] = useState(false);
  const [shakeTrigger, setShakeTrigger] = useState(0);
  const [npmVersion, setNpmVersion] = useState<string | null>(null);
  const year = useMemo(() => new Date().getFullYear(), []);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    fetch("https://registry.npmjs.org/wormkey")
      .then((r) => r.json())
      .then((pkg) => setNpmVersion(pkg["dist-tags"]?.latest ?? null))
      .catch(() => {});
  }, []);

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      setCopied(null);
    }
  };

  const installCmds = {
    npm: "npm i -g wormkey",
    pnpm: "pnpm add -g wormkey",
    yarn: "yarn global add wormkey",
    bun: "bun add -g wormkey",
  } as const;
  const [pkgManager, setPkgManager] = useState<keyof typeof installCmds>("npm");
  const installCmd = installCmds[pkgManager];
  const quickCmd = "wormkey http 3000";
  const envBlock = `# optional overrides
WORMKEY_CONTROL_PLANE_URL=https://wormkey-control-plane.onrender.com
WORMKEY_EDGE_URL=wss://t.wormkey.run/tunnel`;
  const reactImport = `import { WormkeyOverlay } from "wormkey";

export default function Layout({ children }) {
  return (
    <>
      {children}
      <WormkeyOverlay slug="YOUR_SLUG" />
    </>
  );
}`;

  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--fg)]">
      <main className="mx-auto max-w-xl px-6 pt-10 pb-16">
        <div className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_auto_1fr] items-center gap-4">
          <h1 className="flex items-start gap-1.5 text-xl font-semibold">
            <span>
              <span className="text-[var(--fg)]">Wormkey</span>
              <span className="font-normal text-[var(--muted-fg)]">.run</span>
            </span>
            <span className="rounded bg-[var(--code-bg)] px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wide text-[var(--muted-fg)] opacity-70 leading-tight">
              Beta
            </span>
          </h1>
          <div className="flex flex-col items-center justify-center">
            <WormMascot variant={2} className="opacity-90" shakeTrigger={shakeTrigger} />
            {/* Color picker - variant 2 is main
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[10px] text-[var(--muted-fg)]">mascot</span>
              {([1, 2, 3, 4, 5, 6, 7] as WormVariant[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setMascotVariant(v)}
                  className={`h-4 w-4 shrink-0 rounded-full transition-transform hover:scale-110 ${
                    mascotVariant === v
                      ? "ring-2 ring-[var(--fg)] ring-offset-2 ring-offset-[var(--bg)]"
                      : ""
                  }`}
                  style={{ backgroundColor: MASCOT_VARIANT_SWATCHES[v] }}
                  aria-label={`Variant ${v}`}
                  title={`Variant ${v}`}
                />
              ))}
            </div>
            */}
          </div>
          <div className="hidden md:flex items-center justify-end">
            <button
              type="button"
              onClick={() => setShakeTrigger((t) => t + 1)}
              className="cursor-not-allowed rounded-lg px-4 py-2 text-sm font-normal text-[var(--fg)] opacity-50 transition-colors hover:bg-white/10 hover:opacity-100"
              aria-disabled="true"
              title="Blog coming soon"
            >
              Blog
            </button>
          </div>
        </div>
        <p className="mt-12 text-sm leading-6 text-[var(--muted-fg)]">
          Share your localhost in one command. No account. No dashboard. Just a
          link.
        </p>

        <div className="mt-8 space-y-2">
          <div className="flex flex-col gap-2">
            <div className="flex gap-1">
              {(["npm", "pnpm", "yarn", "bun"] as const).map((pkg) => (
                <button
                  key={pkg}
                  onClick={() => setPkgManager(pkg)}
                  className={`rounded px-2.5 py-1 font-mono text-[11px] ${
                    pkgManager === pkg
                      ? "bg-[var(--code-bg)] text-[var(--fg)] shadow-[inset_0px_0px_0px_1px_rgba(59,59,59,0.1)]"
                      : "text-[var(--muted-fg)] hover:text-[var(--fg)]"
                  }`}
                >
                  {pkg}
                </button>
              ))}
            </div>
            <CodeBlock
              value={installCmd}
              language="bash"
              copied={copied === "install"}
              onCopy={() => copy(installCmd, "install")}
              dark={theme !== "light"}
            />
          </div>
          <CodeBlock
            value={quickCmd}
            language="bash"
            copied={copied === "run"}
            onCopy={() => copy(quickCmd, "run")}
            dark={theme !== "light"}
          />
        </div>

        <p className="mt-4 text-xs text-[var(--muted)]">
          Default: t.wormkey.run. Your app stays on your machine.
        </p>

        <section className="mt-10">
          <h2 className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
            Quick start
          </h2>
          <ol className="mt-3 space-y-2 text-sm text-[var(--muted-fg)]">
            <li>1. Start your app (e.g. port 3000)</li>
            <li>2. Run wormkey http 3000</li>
            <li>3. Share the printed URL</li>
          </ol>
        </section>

        <section className="mt-8">
          <h2 className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
            Next.js / React
          </h2>
          <p className="mt-2 text-sm text-[var(--muted-fg)]">
            Add the overlay component to your layout for owner controls.
          </p>
          <div className="mt-2">
            <CodeBlock
              value={reactImport}
              language="jsx"
              copied={copied === "react"}
              onCopy={() => copy(reactImport, "react")}
              multiline
              dark={theme !== "light"}
            />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
            Optional config
          </h2>
          <div className="mt-2">
            <CodeBlock
              value={envBlock}
              language="bash"
              copied={copied === "env"}
              onCopy={() => copy(envBlock, "env")}
              multiline
              dark={theme !== "light"}
            />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
            Owner overlay demo
          </h2>
          <p className="mt-2 text-sm text-[var(--muted-fg)]">
            See the control bar that tunnel owners get. Toggle to preview.
          </p>
          <button
            onClick={() => setDemoBarVisible((v) => !v)}
            className="mt-3 rounded-full border border-[var(--border)] bg-[var(--code-bg)] px-4 py-2 text-xs font-medium text-[var(--fg)] hover:bg-[var(--border)]"
          >
            {demoBarVisible ? "Hide demo" : "Show control bar demo"}
          </button>
        </section>

        <section className="mt-8">
          <h2 className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
            Owner overlay (script tag)
          </h2>
          <p className="mt-2 text-sm text-[var(--muted-fg)]">
            Or load the overlay script directly. Optional.
          </p>
          <CodeBlock
            value='<script defer src="https://t.wormkey.run/.wormkey/overlay.js?slug=YOUR_SLUG"></script>'
            language="html"
            copied={copied === "overlay"}
            onCopy={() =>
              copy(
                '<script defer src="https://t.wormkey.run/.wormkey/overlay.js?slug=YOUR_SLUG"></script>',
                "overlay"
              )
            }
            dark={theme !== "light"}
          />
        </section>

        {demoBarVisible && (
          <DemoControlBar onClose={() => setDemoBarVisible(false)} />
        )}

        <footer className="mt-12 flex items-center justify-between border-t border-[var(--border)] pt-6 text-xs text-[var(--muted)]">
          <span>
            made with love by{" "}
            <a
              href="https://x.com/metagravity0"
              target="_blank"
              rel="noreferrer"
              className="border-b border-transparent border-dotted hover:border-current hover:text-[var(--fg)]"
            >
              max
            </a>{" "}
            © {year}
          </span>
          <div className="flex items-center gap-4">
            {mounted && (
              <ThemeToggle
                isDark={theme !== "light"}
                onClick={() => setTheme(theme !== "light" ? "light" : "dark")}
              />
            )}
            <a
              href="https://www.npmjs.com/package/wormkey"
              target="_blank"
              rel="noreferrer"
              className="border-b border-transparent border-dotted hover:border-current hover:text-[#60a5fa]"
            >
              {npmVersion ? `v${npmVersion}` : "npm"}
            </a>
            <a
              href="https://github.com/max-pantom/worm"
              target="_blank"
              rel="noreferrer"
              className="border-b border-transparent border-dotted hover:border-current hover:text-[#60a5fa]"
            >
              github
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}

function ThemeToggle({ isDark, onClick }: { isDark: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-4 w-4 hover:text-[var(--fg)]"
      aria-label="Toggle theme"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="overflow-visible">
        <g
          style={{
            transformOrigin: "50% 50%",
            transition: "opacity 0.4s ease, transform 0.4s ease",
            opacity: isDark ? 1 : 0,
            transform: isDark ? "scale(1) rotate(0deg)" : "scale(0.4) rotate(-120deg)",
            pointerEvents: isDark ? "auto" : "none",
          }}
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </g>
        <g
          style={{
            transformOrigin: "50% 50%",
            transition: "opacity 0.4s ease, transform 0.4s ease",
            opacity: isDark ? 0 : 1,
            transform: isDark ? "scale(0.4) rotate(120deg)" : "scale(1) rotate(0deg)",
            pointerEvents: isDark ? "none" : "auto",
          }}
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </g>
      </svg>
    </button>
  );
}

/** Demo of the owner control bar. Keep in sync with packages/gateway/overlay.js. Figma: node-id=1533-250 */
function DemoControlBar({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"copy" | "logs">("copy");
  const [viewers] = useState(3);
  const [position, setPosition] = useState<{ x?: number; bottom?: number; center?: boolean }>({ bottom: 10, center: true });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ dx: 0, dy: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);
  const mainUrl = "https://wormkey.run/s/swift-rose-67";
  const ownerUrl = "https://wormkey.run/.wormkey/owner?slug=swift-rose-67&to.....";

  const handleDragStart = (e: React.MouseEvent) => {
    setDragging(true);
    const el = (e.target as HTMLElement).closest("[data-wormkey-overlay]") as HTMLElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    setPosition({ x: rect.left, bottom: window.innerHeight - rect.bottom, center: false });
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const el = overlayRef.current;
      const h = el?.offsetHeight ?? 150;
      const newLeft = Math.max(0, Math.min(e.clientX - dragRef.current.dx, window.innerWidth - 300));
      const newBottom = window.innerHeight - (e.clientY - dragRef.current.dy + h);
      setPosition((p) => ({
        ...p,
        x: newLeft,
        bottom: Math.max(10, Math.min(newBottom, window.innerHeight - h)),
      }));
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  const barStyle: React.CSSProperties =
    position.center
      ? { left: "50%", transform: "translateX(-50%)", bottom: position.bottom ?? 10 }
      : { left: position.x ?? 10, bottom: position.bottom ?? 10 };

  return (
    <div
      ref={overlayRef}
      id="wormkey-demo-bar"
      data-wormkey-overlay
      className="fixed z-[2147483647] flex w-fit min-w-[380px] max-w-[calc(100vw-20px)] flex-col items-stretch justify-end gap-1"
      style={barStyle}
    >
      {/* Tab content panel - always visible; both tabs in DOM, show active */}
      <div className="flex w-full min-w-0 min-h-[44px] flex-col gap-1 rounded-[10px] bg-[rgba(109,109,109,0.2)] p-1 backdrop-blur-[5px]">
        <div className={activeTab === "copy" ? "flex flex-col gap-1" : "hidden"}>
          <div className="flex min-w-0 items-center overflow-hidden rounded-md bg-white/[0.02] p-2.5">
            <p className="min-w-0 flex-1 truncate text-[10px] font-medium text-white/80">
              Main_Url: <span className="text-white/50">{mainUrl}</span>
            </p>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(mainUrl);
              }}
              className="ml-2 shrink-0 rounded-md bg-white/15 px-2.5 py-1 text-[10px] hover:bg-white/20"
            >
              Copy
            </button>
          </div>
          <div className="flex min-w-0 items-center overflow-hidden rounded-md bg-white/[0.02] p-2.5">
            <p className="min-w-0 flex-1 truncate text-[10px] font-medium text-white/80">
              Owner: <span className="text-white/50">{ownerUrl}</span>
            </p>
            <button className="ml-2 shrink-0 rounded-md bg-white/15 px-2.5 py-1 text-[10px] hover:bg-white/20">
              Copy
            </button>
          </div>
        </div>
        <div className={activeTab === "logs" ? "flex items-center p-2.5 text-[10px] text-white/50" : "hidden"}>
          Logs will appear here.
        </div>
      </div>
      {/* Tab bar */}
      <div className="flex h-10 items-stretch gap-1 rounded-[10px] bg-[rgba(109,109,109,0.6)] p-1 text-[10px] font-medium text-white backdrop-blur-[20px]">
        <div
          role="button"
          tabIndex={0}
          onMouseDown={handleDragStart}
          className={`flex select-none items-center px-2.5 opacity-50 ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
          title="Drag to move"
        >
          Wormkey
        </div>
        <button
          onClick={() => setActiveTab("copy")}
          className="flex items-center justify-center rounded-md px-2.5 opacity-50 hover:opacity-70"
        >
          Copy Url
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className="flex items-center justify-center rounded-md px-2.5 opacity-50 hover:opacity-70"
        >
          Logs
        </button>
        <button onClick={onClose} className="flex items-center px-2.5 opacity-50 hover:opacity-70">
          Close Tunnel
        </button>
        <div className="w-px shrink-0 self-stretch bg-white/20" />
        <div className="tabbar-connected flex cursor-default items-center gap-1.5 px-2.5">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0 tabbar-shield">
            <path d="M8.04151 2.52766L5.69751 1.09866C5.26701 0.837156 4.73251 0.836656 4.30201 1.09866L1.95801 2.52716C1.52101 2.79366 1.24951 3.29266 1.24951 3.82916V6.16866C1.24951 6.70566 1.52101 7.20466 1.95801 7.47066L4.30201 8.89966C4.51701 9.03066 4.75851 9.09616 4.99951 9.09616C5.24051 9.09616 5.48201 9.03066 5.69701 8.89966L8.04101 7.47116C8.47801 7.20466 8.74951 6.70566 8.74951 6.16916V3.82966C8.74951 3.29266 8.47851 2.79366 8.04151 2.52766ZM7.14201 3.80966L4.76701 6.80966C4.67551 6.92516 4.53801 6.99466 4.39051 6.99916C4.38551 6.99916 4.38001 6.99916 4.37501 6.99916C4.23351 6.99916 4.09801 6.93916 4.00351 6.83366L2.87851 5.58366C2.69401 5.37816 2.71051 5.06216 2.91551 4.87766C3.12101 4.69266 3.43651 4.70966 3.62151 4.91466L4.35051 5.72466L6.35801 3.18916C6.52951 2.97316 6.84351 2.93616 7.06051 3.10716C7.27701 3.27866 7.31351 3.59316 7.14201 3.80966Z" fill="#5BFF6D" />
          </svg>
          <span className="text-[#5BFF6D]">Connected</span>
        </div>
        <div className="tabbar-views flex cursor-default items-center gap-1.5 px-2.5">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="tabbar-eye shrink-0">
            <path d="M8.75554 4.098C8.31704 3.317 7.07304 1.5 5.00004 1.5C2.92704 1.5 1.68304 3.317 1.25204 4.085C0.920543 4.6365 0.918043 5.3475 1.24404 5.9015C1.57554 6.527 2.79754 8.4995 5.00004 8.4995C7.07304 8.4995 8.31704 6.6825 8.74804 5.9145C9.08204 5.359 9.08204 4.6405 8.75554 4.0975V4.098ZM5.00004 6.5C4.17154 6.5 3.50004 5.8285 3.50004 5C3.50004 4.1715 4.17154 3.5 5.00004 3.5C5.82854 3.5 6.50004 4.1715 6.50004 5C6.50004 5.8285 5.82854 6.5 5.00004 6.5Z" fill="#A0A0A0" />
          </svg>
          <span className="text-[#A0A0A0]">{viewers}</span>
        </div>
      </div>
    </div>
  );
}

function CodeBlock({
  value,
  language,
  copied,
  onCopy,
  multiline,
  dark,
}: {
  value: string;
  language: string;
  copied: boolean;
  onCopy: () => void;
  multiline?: boolean;
  dark?: boolean;
}) {
  return (
    <div className="relative flex items-start justify-between gap-3 self-stretch rounded-md bg-[var(--code-bg)] p-2.5 shadow-[inset_0px_0px_0px_1px_rgba(59,59,59,0.1)] transition-shadow focus-within:shadow-[inset_0px_0px_0px_1px_rgba(59,59,59,0.25)]">
      <div className="min-w-0 flex-1 overflow-x-auto">
        <SyntaxHighlighter
          language={language}
          style={dark ? oneDark : oneLight}
          customStyle={{
            margin: 0,
            padding: 0,
            background: "transparent",
            fontSize: "11px",
            lineHeight: 1.5,
            fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
          }}
          codeTagProps={{
            className: multiline ? "" : "truncate block",
          }}
          PreTag="div"
          showLineNumbers={false}
        >
          {value}
        </SyntaxHighlighter>
      </div>
      <button
        onClick={onCopy}
        className={`shrink-0 font-mono text-[11px] transition-colors ${
          copied
            ? "text-[#60a5fa]"
            : "text-[var(--muted-fg)] hover:text-[var(--fg)]"
        }`}
        aria-label="Copy"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
