"use client";

import { useState } from "react";

export default function Home() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="wrap">
      <h1>Wormkey</h1>
      <p className="tagline">
        Open a wormhole to your localhost. Share your dev server instantly.
      </p>

      <div className="install">
        <code>npm install wormkey</code>
        <button
          className={`copy-btn ${copied === "install" ? "copied" : ""}`}
          onClick={() => copy("npm install wormkey", "install")}
          aria-label="Copy install command"
        >
          {copied === "install" ? "Copied" : "Copy"}
        </button>
      </div>

      <h2>Quick start</h2>
      <div className="steps">
        <div className="step">
          <span className="step-num">1</span>
          <p>
            Start your app (e.g. <code>npm run dev</code> on port 3000)
          </p>
        </div>
        <div className="step">
          <span className="step-num">2</span>
          <p>
            Run <code>wormkey http 3000</code>
          </p>
        </div>
        <div className="step">
          <span className="step-num">3</span>
          <p>Share the URL — anyone can view your localhost</p>
        </div>
      </div>

      <h2>React / Next.js</h2>
      <div className="install">
        <code>import {"{ WormkeyOverlay }"} from &quot;wormkey&quot;</code>
        <button
          className={`copy-btn ${copied === "import" ? "copied" : ""}`}
          onClick={() =>
            copy('import { WormkeyOverlay } from "wormkey"', "import")
          }
          aria-label="Copy import"
        >
          {copied === "import" ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="hint">
        Add to your layout for owner controls when viewing through the wormhole.
      </p>

      <footer>
        <a
          href="https://www.npmjs.com/package/wormkey"
          target="_blank"
          rel="noopener noreferrer"
        >
          npm
        </a>
      </footer>
    </div>
  );
}
