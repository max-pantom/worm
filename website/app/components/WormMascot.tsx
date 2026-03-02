"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

type State = "idle" | "searching" | "hover";

export type WormVariant = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const MASCOT_VARIANT_SWATCHES: Record<WormVariant, string> = {
  1: "#D9D9D9",
  2: "#FFEA2A",
  3: "#2067FF",
  4: "#6BFF20",
  5: "#FF2A2D",
  6: "#A855F7",
  7: "#000000",
};

const COLOR_VARIANTS: Record<
  WormVariant,
  { body: string; eyes: string; pupil: string; teeth: string; antenna: string }
> = {
  1: { body: "#D9D9D9", eyes: "#ffffff", pupil: "#161616", teeth: "#A3A3A3", antenna: "#D9D9D9" },
  2: { body: "#FFEA2A", eyes: "#000000", pupil: "#ffffff", teeth: "#FF0000", antenna: "#FFE62A" },
  3: { body: "#2067FF", eyes: "#000000", pupil: "#ffffff", teeth: "#FF67FF", antenna: "#248BF3" },
  4: { body: "#6BFF20", eyes: "#ffffff", pupil: "#000000", teeth: "#FFFF3C", antenna: "#9CF324" },
  5: { body: "#FF2A2D", eyes: "#000000", pupil: "#FFEA2A", teeth: "#ffffff", antenna: "#D90407" },
  7: { body: "#000000", eyes: "#9B9B9B", pupil: "#FFFFFF", teeth: "#D9D9D9", antenna: "#010101" },
  6: {
    body: "#A855F7",
    eyes: "#E9D5FF",
    pupil: "#581C87",
    teeth: "#F0ABFC",
    antenna: "#C084FC",
  },
};

const EYE_CX = 20.2002;
const EYE_CY = 23.8;
const PUPIL_MAX_OFFSET = 2.2;

const STATE_VALUES = {
  idle: {
    rectX: 12.7998,
    rectY: 18.3633,
    rectRotate: -10.9044,
    antennae: "idle" as const,
    teethY: 0,
  },
  searching: {
    rectX: 12.7998,
    rectY: 13.2441,
    rectRotate: -2.03585,
    antennae: "tilted" as const,
    teethY: 1.6,
  },
  hover: {
    rectX: 14.4814,
    rectY: 15.6895,
    rectRotate: 12.9642,
    antennae: "tilted" as const,
    teethY: 0.8,
  },
};

const TRANSITION = "transform 280ms cubic-bezier(0.4, 0, 0.2, 1)";

export function WormMascot({
  className,
  variant = 1,
  shakeTrigger = 0,
}: {
  className?: string;
  variant?: WormVariant;
  shakeTrigger?: number;
}) {
  const colors = COLOR_VARIANTS[variant];
  const [state, setState] = useState<State>("idle");
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const v = STATE_VALUES[state];

  const onMouseEnter = useCallback(() => setState("hover"), []);
  const onMouseLeave = useCallback(() => setState("idle"), []);

  // Eyes follow cursor
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const svgW = 40;
      const svgH = 47;
      const x = ((e.clientX - rect.left) / rect.width) * svgW;
      const y = ((e.clientY - rect.top) / rect.height) * svgH;
      const dx = x - EYE_CX;
      const dy = y - EYE_CY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const scale = Math.min(1, PUPIL_MAX_OFFSET / dist);
      setPupilOffset({ x: dx * scale, y: dy * scale });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Cycle to searching periodically when idle
  useEffect(() => {
    if (state !== "idle") return;
    const t = setTimeout(() => setState("searching"), 3000);
    return () => clearTimeout(t);
  }, [state]);

  useEffect(() => {
    if (state !== "searching") return;
    const t = setTimeout(() => setState("idle"), 1500);
    return () => clearTimeout(t);
  }, [state]);

  const [isShaking, setIsShaking] = useState(false);
  useEffect(() => {
    if (shakeTrigger <= 0) return;
    setIsShaking(true);
    const t = setTimeout(() => setIsShaking(false), 400);
    return () => clearTimeout(t);
  }, [shakeTrigger]);

  return (
    <div
      ref={containerRef}
      data-worm-mascot
      className={`${className ?? ""} ${isShaking ? "worm-shake" : ""}`}
      role="img"
      aria-label="Wormkey mascot"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <svg
        width="40"
        height="47"
        viewBox="0 0 40 47"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="block"
      >
        {/* Body blob */}
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M16.1768 6.76665C16.8585 4.19156 19.0178 2.48157 21.1738 2.89262C22.9259 3.22675 24.1639 4.86419 24.3984 6.88579C33.3281 8.88981 40 16.8659 40 26.4004C39.9999 37.446 31.0456 46.4004 20 46.4004C8.95439 46.4004 0.000145094 37.446 0 26.4004C0 16.6623 6.96001 8.55093 16.1768 6.76665ZM23.583 0.708052C23.6706 0.249175 24.0554 -0.0629496 24.4434 0.0107863C24.8312 0.0849563 25.0756 0.516803 24.9883 0.97563C24.9008 1.43456 24.5149 1.74655 24.127 1.6729C24.101 1.66795 24.0776 1.69696 24.0889 1.72075C24.1909 1.92993 24.2289 2.18652 24.1787 2.45024C24.0693 3.02399 23.5876 3.41453 23.1025 3.32231C22.6174 3.22982 22.3125 2.68917 22.4219 2.11528C22.5315 1.54166 23.014 1.15172 23.499 1.24418C23.555 1.25457 23.6135 1.19268 23.5986 1.13774C23.5621 1.00535 23.5544 0.858321 23.583 0.708052Z"
          fill={colors.body}
        />

        {/* Eye white */}
        <ellipse
          cx="20.2002"
          cy="23.8"
          rx="5"
          ry="6.19048"
          fill={colors.eyes}
        />

        {/* Pupil - follows cursor */}
        <g
          className="worm-transition"
          style={{
            transform: `translate(${EYE_CX + pupilOffset.x}px, ${EYE_CY + pupilOffset.y}px)`,
            transition: TRANSITION,
          }}
        >
          <ellipse
            cx="0"
            cy="0"
            rx="2.14286"
            ry="3.09524"
            fill={colors.pupil}
          />
        </g>

        {/* Antenna rect */}
        <g
          className="worm-transition"
          style={{
            transform: `translate(${v.rectX}px, ${v.rectY}px) rotate(${v.rectRotate}deg)`,
            transformOrigin: "0 0",
            transition: TRANSITION,
          }}
        >
          <rect
            x="0"
            y="0"
            width="12.4835"
            height="5.6"
            fill={colors.antenna}
          />
        </g>

        {/* Legs */}
        <g>
          <path
            d="M15.7119 36.9668H18.1119L17.7119 42.9668H16.1119L15.7119 36.9668Z"
            fill={colors.teeth}
          />
          <path
            d="M22.7998 36.8008H25.1998L24.7998 42.8008H23.1998L22.7998 36.8008Z"
            fill={colors.teeth}
          />
        </g>
        {/* Teeth - smooth translateY animation between states */}
        <g
          className="worm-transition"
          style={{
            transform: `translateY(${v.teethY}px)`,
            transition: TRANSITION,
          }}
        >
          <path
            d="M19.3115 36.166H21.7115L21.3115 42.166H19.7115L19.3115 36.166Z"
            fill={colors.teeth}
          />
        </g>

        {/* Antennae - idle (straight X) */}
        <g
          className={`worm-transition ${state === "hover" ? "worm-antenna-hover" : ""}`}
          style={{
            opacity: v.antennae === "idle" ? 1 : 0,
            transition: "opacity 250ms cubic-bezier(0.4, 0, 0.2, 1)",
            pointerEvents: "none",
          }}
        >
          <path
            d="M5.1061 13.9095L6.52031 15.3237M5.10613 15.321L6.52035 13.9068"
            stroke={colors.antenna}
            style={{ mixBlendMode: "plus-darker" }}
            strokeWidth="0.6"
            strokeLinecap="round"
          />
          <path
            d="M33.1061 13.9095L34.5203 15.3237M33.1061 15.321L34.5203 13.9068"
            stroke={colors.antenna}
            style={{ mixBlendMode: "plus-darker" }}
            strokeWidth="0.6"
            strokeLinecap="round"
          />
        </g>

        {/* Antennae - tilted (searching/hover) */}
        <g
          className={`worm-transition ${state === "hover" ? "worm-antenna-hover" : ""}`}
          style={{
            opacity: v.antennae === "tilted" ? 1 : 0,
            transition: "opacity 250ms cubic-bezier(0.4, 0, 0.2, 1)",
            pointerEvents: "none",
          }}
        >
          <path
            d="M6.18707 13.6903L5.43785 15.5446M4.88784 14.2418L6.7422 14.991"
            stroke={colors.antenna}
            style={{ mixBlendMode: "plus-darker" }}
            strokeWidth="0.6"
            strokeLinecap="round"
          />
          <path
            d="M34.1871 13.6903L33.4379 15.5446M32.8878 14.2418L34.7422 14.991"
            stroke={colors.antenna}
            style={{ mixBlendMode: "plus-darker" }}
            strokeWidth="0.6"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
}
