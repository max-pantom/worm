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
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <h1 className="text-xl font-semibold">
            <span className="text-[var(--fg)]">Wormkey</span>
            <span className="font-normal text-[var(--muted-fg)]">.run</span>
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
          <div className="flex items-center justify-end">
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

/** Demo of the owner control bar. Keep in sync with packages/gateway/overlay.js */
function DemoControlBar({ onClose }: { onClose: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [viewers] = useState(2);
  const [maxViewers, setMaxViewers] = useState(20);
  const [blockPath, setBlockPath] = useState("");
  const [selectedViewer, setSelectedViewer] = useState("");
  const [position, setPosition] = useState<{ x: number; y?: number; bottom?: number }>({
    x: 12,
    bottom: 12,
  });
  const [dragging, setDragging] = useState(false);
  const dragOffsetRef = useRef({ dx: 0, dy: 0 });
  const barRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = barRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragOffsetRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    setPosition({ x: rect.left, y: rect.top });
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      setPosition({
        x: Math.max(4, Math.min(e.clientX - dragOffsetRef.current.dx, window.innerWidth - 200)),
        y: Math.max(4, Math.min(e.clientY - dragOffsetRef.current.dy, window.innerHeight - 80)),
      });
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  useEffect(() => {
    if (dragging) document.body.style.cursor = "grabbing";
    else document.body.style.cursor = "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [dragging]);

  const barStyle: React.CSSProperties =
    position.y !== undefined
      ? { left: position.x, top: position.y }
      : { left: position.x, bottom: position.bottom ?? 12 };

  return (
    <div
      ref={barRef}
      id="wormkey-demo-bar"
      className="fixed z-[2147483647] flex max-w-[calc(100vw-24px)] flex-wrap items-center gap-2 rounded-2xl bg-[#101820] px-2.5 py-2 text-[12px] font-mono text-[#f4f4ef] shadow-[0_8px_30px_rgba(0,0,0,.25)]"
      style={barStyle}
    >
      <button
        onMouseDown={handleMouseDown}
        className="cursor-grab select-none px-1 py-0.5 hover:opacity-80"
        title="Drag"
      >
        ::
      </button>
      <strong>Wormkey</strong>
      <span className="opacity-85">
        {isPublic ? "Public" : "Locked"} | viewers {viewers}
      </span>
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="px-1 py-0.5 hover:opacity-80"
        title={collapsed ? "Expand" : "Collapse"}
      >
        {collapsed ? "+" : "-"}
      </button>
      {!collapsed && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsPublic((p) => !p)}
            className="rounded-full bg-[#f4f4ef] px-2 py-1.5 text-[#101820] hover:opacity-90"
          >
            {isPublic ? "Lock" : "Unlock"}
          </button>
          <button className="rounded-full bg-[#f4f4ef] px-2 py-1.5 text-[#101820] hover:opacity-90">
            Rotate
          </button>
          <button
            onClick={onClose}
            className="rounded-full bg-[#f4f4ef] px-2 py-1.5 text-[#101820] hover:opacity-90"
          >
            Close
          </button>
          <input
            type="number"
            min={1}
            value={maxViewers}
            onChange={(e) => setMaxViewers(Number(e.target.value) || 20)}
            className="w-16 rounded-full border-0 bg-[#f4f4ef] px-2 py-1.5 text-[#101820]"
          />
          <button className="rounded-full bg-[#f4f4ef] px-2 py-1.5 text-[#101820] hover:opacity-90">
            Set max
          </button>
          <input
            placeholder="/admin"
            value={blockPath}
            onChange={(e) => setBlockPath(e.target.value)}
            className="w-[110px] rounded-full border-0 bg-[#f4f4ef] px-2 py-1.5 text-[#101820] placeholder:text-[#71717a]"
          />
          <button className="rounded-full bg-[#f4f4ef] px-2 py-1.5 text-[#101820] hover:opacity-90">
            Block
          </button>
          <select
            value={selectedViewer}
            onChange={(e) => setSelectedViewer(e.target.value)}
            className="max-w-[140px] rounded-full border-0 bg-[#f4f4ef] px-2 py-1.5 text-[#101820]"
          >
            <option value="">Select viewer</option>
            <option value="abc-123">abc-123 (3)</option>
            <option value="xyz-456">xyz-456 (1)</option>
          </select>
          <button className="rounded-full bg-[#f4f4ef] px-2 py-1.5 text-[#101820] hover:opacity-90">
            Kick
          </button>
        </div>
      )}
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
