"use client";

/**
 * Mascot showcase page.
 * - Top center: Worm | Custom fully rounded tabs
 * - Side: Part-by-part color pickers (Custom) or preset swatches (Worm)
 * - Download
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { HexColorPicker } from "react-colorful";
import {
  WormMascot,
  EYE_CX,
  EYE_CY,
  PUPIL_MAX_OFFSET,
  type WormVariant,
  type WormColors,
  MASCOT_VARIANT_SWATCHES,
} from "../components/WormMascot";

const MASKED_COLOR = "#787878";

const DEFAULT_CUSTOM: WormColors = {
  body: "#FFEA2A",
  eyes: "#000000",
  pupil: "#ffffff",
  teeth: "#FF0000",
  antenna: "#FFE62A",
};

const PARTS: { key: keyof WormColors }[] = [
  { key: "body" },
  { key: "eyes" },
  { key: "pupil" },
  { key: "teeth" },
  { key: "antenna" },
];

const PART_ICON_SIZE = 56;
const LOOK_DISK_SIZE = 80;

function LookControl({
  onLookChange,
  enabled,
  className,
  compact,
}: {
  onLookChange: (target: { x: number; y: number } | null) => void;
  enabled: boolean;
  className?: string;
  compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handlePointer = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      const el = ref.current;
      if (!el) return;
      if (e.type === "pointerdown") e.currentTarget.setPointerCapture?.(e.pointerId);
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const r = rect.width / 2;
      const dx = (e.clientX - cx) / r;
      const dy = (e.clientY - cy) / r;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const clamped = dist > 1 ? { x: dx / dist, y: dy / dist } : { x: dx, y: dy };
      const lookX = EYE_CX + clamped.x * PUPIL_MAX_OFFSET;
      const lookY = EYE_CY + clamped.y * PUPIL_MAX_OFFSET;
      onLookChange({ x: lookX, y: lookY });
    },
    [onLookChange, enabled]
  );

  return (
    <div
      ref={ref}
      role="slider"
      aria-label="Control where the worm looks"
      aria-disabled={!enabled}
      tabIndex={enabled ? 0 : -1}
      onPointerMove={handlePointer}
      onPointerDown={handlePointer}
      onPointerUp={(e) => e.currentTarget.releasePointerCapture?.(e.pointerId)}
      onPointerCancel={(e) => e.currentTarget.releasePointerCapture?.(e.pointerId)}
      className={`touch-none ${enabled ? "cursor-crosshair" : "cursor-default opacity-60"} ${className ?? ""}`}
      style={{ width: compact ? 56 : LOOK_DISK_SIZE, height: compact ? 56 : LOOK_DISK_SIZE }}
    />
  );
}

const PART_LABELS: Record<keyof WormColors, string> = {
  body: "Body",
  eyes: "Eyes",
  pupil: "Pupil",
  teeth: "Teeth",
  antenna: "Antenna",
};

function PartIcon({
  part,
  displayColor,
  onClick,
  onFocus,
  isActive,
  compact,
}: {
  part: keyof WormColors;
  displayColor: string;
  onClick: () => void;
  onFocus?: () => void;
  isActive?: boolean;
  compact?: boolean;
}) {
  const label = PART_LABELS[part];
  const size = compact ? 32 : PART_ICON_SIZE;
  return (
    <button
      type="button"
      onClick={onClick}
      onFocus={onFocus}
      title={label}
      className={`group relative flex shrink-0 cursor-pointer rounded-lg p-0.5 transition-opacity hover:opacity-90 ${isActive ? "ring-1 ring-white/40 ring-offset-1 ring-offset-transparent" : ""}`}
      aria-label={`${label} color`}
    >
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className="block">
        {/* All shapes scaled to fill ~same area in 40x40 */}
        {part === "body" && (
          <g transform="translate(20,20) scale(0.5) translate(-20,-23.5)">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M16.1768 6.76665C16.8585 4.19156 19.0178 2.48157 21.1738 2.89262C22.9259 3.22675 24.1639 4.86419 24.3984 6.88579C33.3281 8.88981 40 16.8659 40 26.4004C39.9999 37.446 31.0456 46.4004 20 46.4004C8.95439 46.4004 0.000145094 37.446 0 26.4004C0 16.6623 6.96001 8.55093 16.1768 6.76665ZM23.583 0.708052C23.6706 0.249175 24.0554 -0.0629496 24.4434 0.0107863C24.8312 0.0849563 25.0756 0.516803 24.9883 0.97563C24.9008 1.43456 24.5149 1.74655 24.127 1.6729C24.101 1.66795 24.0776 1.69696 24.0889 1.72075C24.1909 1.92993 24.2289 2.18652 24.1787 2.45024C24.0693 3.02399 23.5876 3.41453 23.1025 3.32231C22.6174 3.22982 22.3125 2.68917 22.4219 2.11528C22.5315 1.54166 23.014 1.15172 23.499 1.24418C23.555 1.25457 23.6135 1.19268 23.5986 1.13774C23.5621 1.00535 23.5544 0.858321 23.583 0.708052Z"
              fill={displayColor}
            />
          </g>
        )}
        {part === "eyes" && (
          <g transform="translate(20,20) scale(2) translate(-20,-24)">
            <ellipse cx="20.2002" cy="23.8" rx="5" ry="6.19048" fill={displayColor} />
          </g>
        )}
        {part === "pupil" && (
          <g transform="translate(20,20) scale(3) translate(-20,-24)">
            <ellipse cx="20" cy="24" rx="2.14286" ry="3.09524" fill={displayColor} />
          </g>
        )}
        {part === "teeth" && (
          <g transform="translate(20,20) scale(2.5) translate(-20,-39)">
            <path
              d="M19.3115 36.166H21.7115L21.3115 42.166H19.7115L19.3115 36.166Z"
              fill={displayColor}
            />
          </g>
        )}
        {part === "antenna" && (
          <g transform="translate(20,20) scale(2.2) translate(-19.04,-21.16)">
            <rect
              x="12.8"
              y="18.36"
              width="12.48"
              height="5.6"
              fill={displayColor}
              transform="rotate(-11 19.04 21.16)"
            />
          </g>
        )}
      </svg>
      <span className="pointer-events-none absolute right-full top-1/2 z-20 mr-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[rgba(109,109,109,0.9)] px-2.5 py-1 text-[11px] font-medium text-white/95 shadow-lg backdrop-blur-md opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        {label}
      </span>
    </button>
  );
}

function PartRow({
  part,
  color,
  displayColor,
  onColorChange,
  onReveal,
  isActive,
  onToggle,
  onClose,
  compact,
}: {
  part: keyof WormColors;
  color: string;
  displayColor: string;
  onColorChange: (value: string) => void;
  onReveal: () => void;
  isActive: boolean;
  onToggle: () => void;
  onClose: () => void;
  compact?: boolean;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);

  const handleOpen = () => {
    onReveal();
    onToggle();
  };

  const handleFocusOut = (e: React.FocusEvent) => {
    const next = e.relatedTarget as Node | null;
    if (next && popoverRef.current?.contains(next)) return;
    onClose();
  };

  useEffect(() => {
    if (!isActive) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isActive, onClose]);

  return (
    <div ref={popoverRef} className="relative flex items-center justify-center" onBlur={handleFocusOut}>
      <PartIcon
        part={part}
        displayColor={displayColor}
        onClick={handleOpen}
        onFocus={handleOpen}
        isActive={isActive}
        compact={compact}
      />
      {isActive && (
        <div
          className={`absolute z-30 ${
            compact
              ? "left-1/2 top-full mt-2 -translate-x-1/2"
              : "right-full top-1/2 mr-2 -translate-y-1/2"
          }`}
        >
          <div className="squircle overflow-hidden bg-[rgba(109,109,109,0.95)] p-2 shadow-xl backdrop-blur-xl">
            <HexColorPicker
              color={color}
              onChange={onColorChange}
              style={{ width: compact ? 200 : 180, height: compact ? 48 : 72 }}
              className={`color-picker-mascot color-picker-slider ${compact ? "color-picker-mobile-slider" : ""}`}
            />
            <div className="mt-1.5 text-center text-[10px] font-medium text-white/90">
              {color}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CAPTURE_SIZE = 600;
const MASCOT_SIZE = 200;

const MASKED_COLORS: WormColors = {
  body: MASKED_COLOR,
  eyes: MASKED_COLOR,
  pupil: MASKED_COLOR,
  teeth: MASKED_COLOR,
  antenna: MASKED_COLOR,
};

export default function MascotPage() {
  const [mode, setMode] = useState<"worm" | "custom">("worm");
  const [variant, setVariant] = useState<WormVariant>(2);
  const [customColors, setCustomColors] = useState<WormColors>(DEFAULT_CUSTOM);
  const [colorsRevealed, setColorsRevealed] = useState(false);
  const [activePart, setActivePart] = useState<keyof WormColors | null>(null);
  const [flash, setFlash] = useState(false);
  const [lookControlEnabled, setLookControlEnabled] = useState(true);
  const [lookTarget, setLookTarget] = useState<{ x: number; y: number } | null>(null);
  const [generatedCount, setGeneratedCount] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    fetch("/api/mascot-count")
      .then((r) => r.json())
      .then(({ count }) => setGeneratedCount(count))
      .catch(() => setGeneratedCount(0));
  }, []);

  const incrementGenerated = useCallback(async () => {
    try {
      const res = await fetch("/api/mascot-count", { method: "POST" });
      const { count } = await res.json();
      setGeneratedCount(count);
    } catch {
      setGeneratedCount((n) => (typeof n === "number" ? n + 1 : 1));
    }
  }, []);

  const colors = mode === "custom" ? customColors : undefined;
  const displayColors = mode === "custom" && !colorsRevealed ? MASKED_COLORS : customColors;
  const mascotColors = mode === "custom" ? (colorsRevealed ? customColors : MASKED_COLORS) : undefined;
  const activeVariant = mode === "worm" ? variant : undefined;

  useEffect(() => {
    if (mode === "custom") {
      setColorsRevealed(false);
      setActivePart(null);
      setLookTarget(null);
    }
  }, [mode]);

  const updateCustomColor = useCallback((key: keyof WormColors, value: string) => {
    setCustomColors((c) => ({ ...c, [key]: value }));
  }, []);

  const downloadPng = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;

    setFlash(true);
    setTimeout(() => setFlash(false), 150);

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", String(MASCOT_SIZE));
    clone.setAttribute("height", String((MASCOT_SIZE * 47) / 40));
    const svgString = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = CAPTURE_SIZE;
      canvas.height = CAPTURE_SIZE;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const bg = getComputedStyle(document.body).backgroundColor || "#fafafa";
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, CAPTURE_SIZE, CAPTURE_SIZE);
        const mascotH = (MASCOT_SIZE * 47) / 40;
        ctx.drawImage(
          img,
          (CAPTURE_SIZE - MASCOT_SIZE) / 2,
          (CAPTURE_SIZE - mascotH) / 2,
          MASCOT_SIZE,
          mascotH
        );
        canvas.toBlob((blob) => {
          if (blob) {
            const pngUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = pngUrl;
            a.download = "wormkey-mascot.png";
            a.click();
            URL.revokeObjectURL(pngUrl);
            incrementGenerated();
          }
        });
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [incrementGenerated]);

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--bg)] p-4 md:flex-row md:items-center md:justify-center md:p-6">
      {/* Flash overlay on PNG capture */}
      {flash && (
        <div
          className="pointer-events-none fixed inset-0 z-[9999] bg-white"
          style={{ animation: "flash 150ms ease-out forwards" }}
          aria-hidden
        />
      )}

      <Link
        href="/"
        className="absolute left-4 top-4 text-sm text-[var(--muted-fg)] hover:text-[var(--fg)] md:left-6 md:top-6"
      >
        ← Back
      </Link>

      {/* Top center: Worm | Custom tabs - same size as Back link */}
      <div className="fixed left-1/2 top-4 -translate-x-1/2 md:top-6">
        <div className="flex rounded-full bg-[rgba(109,109,109,0.6)] p-0.5 backdrop-blur-[20px]">
          <button
            onClick={() => setMode("worm")}
            className={`rounded-full px-2.5 py-1 text-sm font-medium transition-colors md:px-4 md:py-1.5 ${
              mode === "worm" ? "bg-white/25 text-white" : "text-white/70 hover:text-white"
            }`}
          >
            Worm
          </button>
          <button
            onClick={() => setMode("custom")}
            className={`rounded-full px-2.5 py-1 text-sm font-medium transition-colors md:px-4 md:py-1.5 ${
              mode === "custom" ? "bg-white/25 text-white" : "text-white/70 hover:text-white"
            }`}
          >
            Custom
          </button>
        </div>
      </div>

      {/* Main: mascot (mobile: extra bottom padding for fixed bar; desktop: center, sidebar fixed right) */}
      <div className="mt-14 flex flex-1 flex-col items-center justify-center gap-6 pb-24 md:mt-0 md:pb-0 md:gap-0">
        {/* Center: mascot */}
        <div className="scale-[3] shrink-0 md:scale-[5]">
          <WormMascot
            variant={activeVariant}
            customColors={mascotColors}
            svgRef={svgRef}
            lookAt={
              mode === "custom" && lookControlEnabled
                ? (lookTarget ?? { x: EYE_CX, y: EYE_CY })
                : undefined
            }
          />
        </div>

      </div>

      {/* Mobile: fixed bottom - worm variants straight line, customizer (no look control) */}
      <div className="fixed bottom-0 left-0 right-0 flex w-full flex-col items-center gap-2 px-4 pb-4 pt-2 md:hidden">
        {mode === "worm" ? (
          <div className="flex w-full max-w-full flex-row flex-wrap items-center justify-center gap-1.5">
            {([1, 2, 3, 4, 5, 6, 7, 8, 9] as WormVariant[]).map((v) => (
              <button
                key={v}
                onClick={() => setVariant(v)}
                className={`h-6 w-6 shrink-0 rounded-full transition-all hover:scale-105 sm:h-7 sm:w-7 ${
                  variant === v ? "ring-1 ring-white/80 ring-offset-1 ring-offset-transparent" : ""
                }`}
                style={{ backgroundColor: MASCOT_VARIANT_SWATCHES[v] }}
                aria-label={`Variant ${v}`}
                title={`Variant ${v}`}
              />
            ))}
          </div>
        ) : (
          <div className="flex w-full max-w-full min-w-0 flex-row items-center justify-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="squircle flex flex-row flex-nowrap items-center justify-center gap-1 bg-[rgba(109,109,109,0.6)] px-1.5 py-1.5 backdrop-blur-[20px]">
              <div className="flex flex-row items-center gap-0.5">
                {PARTS.map(({ key }) => (
                  <PartRow
                    key={key}
                    part={key}
                    color={customColors[key]}
                    displayColor={displayColors[key]}
                    onColorChange={(v) => {
                      setColorsRevealed(true);
                      updateCustomColor(key, v);
                    }}
                    onReveal={() => setColorsRevealed(true)}
                    isActive={activePart === key}
                    onToggle={() => setActivePart((p) => (p === key ? null : key))}
                    onClose={() => setActivePart(null)}
                    compact
                  />
                ))}
              </div>
              <button
                onClick={downloadPng}
                className="shrink-0 rounded-lg bg-white/15 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-white/25"
              >
                Generate
              </button>
            </div>
          </div>
        )}
        <div className="text-sm font-medium text-[var(--muted-fg)]">
          {generatedCount === null ? (
            <span className="animate-pulse">…</span>
          ) : (
            <span>{generatedCount.toLocaleString()} worms generated</span>
          )}
        </div>
      </div>

      {/* Desktop: count + sidebar fixed right */}
      <div className="fixed bottom-6 left-1/2 hidden -translate-x-1/2 text-sm font-medium text-[var(--muted-fg)] md:block">
        {generatedCount === null ? (
          <span className="animate-pulse">…</span>
        ) : (
          <span>{generatedCount.toLocaleString()} worms generated</span>
        )}
      </div>

      {/* Desktop: sidebar fixed right */}
      <div className="fixed right-0 top-1/2 hidden -translate-y-1/2 flex-col items-end gap-4 pr-4 md:flex">
        <div className="squircle flex flex-col gap-1 bg-[rgba(109,109,109,0.6)] px-1.5 py-1.5 backdrop-blur-[20px]">
          {mode === "worm" ? (
            <div className="grid grid-cols-3 gap-1">
              {([1, 2, 3, 4, 5, 6, 7, 8, 9] as WormVariant[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setVariant(v)}
                  className={`h-7 w-7 rounded-full transition-all hover:scale-105 ${
                    variant === v ? "ring-1 ring-white/80 ring-offset-1 ring-offset-transparent" : ""
                  }`}
                  style={{ backgroundColor: MASCOT_VARIANT_SWATCHES[v] }}
                  aria-label={`Variant ${v}`}
                  title={`Variant ${v}`}
                />
              ))}
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-1">
                {PARTS.map(({ key }) => (
                  <PartRow
                    key={key}
                    part={key}
                    color={customColors[key]}
                    displayColor={displayColors[key]}
                    onColorChange={(v) => {
                      setColorsRevealed(true);
                      updateCustomColor(key, v);
                    }}
                    onReveal={() => setColorsRevealed(true)}
                    isActive={activePart === key}
                    onToggle={() => setActivePart((p) => (p === key ? null : key))}
                    onClose={() => setActivePart(null)}
                  />
                ))}
              </div>
              <div className="flex flex-col gap-1 border-t border-white/10 pt-1.5">
                <button
                  onClick={downloadPng}
                  className="rounded-lg bg-white/15 px-1.5 py-1 text-[10px] font-medium text-white hover:bg-white/25"
                >
                  Generate
                </button>
              </div>
            </>
          )}
        </div>
        {mode === "custom" && (
          <div className="flex flex-col items-center gap-1">
            <LookControl
              onLookChange={setLookTarget}
              enabled={lookControlEnabled}
              className="rounded-full border-2 border-[rgba(109,109,109,0.6)] bg-[rgba(109,109,109,0.3)] backdrop-blur-[20px]"
            />
            <button
              type="button"
              onClick={() => setLookControlEnabled((on) => !on)}
              title={lookControlEnabled ? "Look control on" : "Look control off"}
              className={`rounded-lg px-2 py-1 text-[10px] font-medium transition-colors ${
                lookControlEnabled ? "bg-white/25 text-white" : "bg-white/10 text-white/60"
              }`}
            >
              {lookControlEnabled ? "Look on" : "Look off"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
