"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";

export function ArticleCodeBlock({
  code,
  language = "bash",
}: {
  code: string;
  language?: string;
}) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--code-bg)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted-fg)]">
          {language}
        </span>
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--muted-fg)] opacity-35" />
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--muted-fg)] opacity-35" />
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--muted-fg)] opacity-35" />
        </span>
      </div>
      <SyntaxHighlighter
        language={language}
        style={mounted && resolvedTheme === "light" ? oneLight : oneDark}
        customStyle={{
          margin: 0,
          padding: "1rem",
          background: "transparent",
          fontSize: "13px",
          lineHeight: 1.65,
          fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
        }}
        codeTagProps={{
          style: {
            fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
          },
        }}
        showLineNumbers={false}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
