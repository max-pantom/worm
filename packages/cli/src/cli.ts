#!/usr/bin/env node
/**
 * Wormkey CLI
 * Open a wormhole to your localhost.
 */

import "dotenv/config";
import { createRequire } from "module";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawn } from "child_process";
import { program } from "commander";
import qrcode from "qrcode-terminal";
import { TunnelClient } from "./tunnel.js";
import { createSession } from "./api.js";
import type { CreateSessionResponse } from "./api.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

function getSessionStatePath(): string {
  const dir = process.env.XDG_STATE_HOME
    ? path.join(process.env.XDG_STATE_HOME, "wormkey")
    : path.join(os.homedir(), ".wormkey");
  return path.join(dir, "p.json");
}

function writeSessionState(
  controlPlaneUrl: string,
  session: CreateSessionResponse
): void {
  const filePath = getSessionStatePath();
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify({
      slug: session.slug,
      controlPlaneUrl,
      publicUrl: session.publicUrl,
      startedAt: new Date().toISOString(),
    }),
    "utf8"
  );
}

function deleteSessionState(): void {
  try {
    fs.unlinkSync(getSessionStatePath());
  } catch {
    // ignore
  }
}

function openUrl(url: string): void {
  const isWin = process.platform === "win32";
  const cmd = process.platform === "darwin" ? "open" : isWin ? "cmd" : "xdg-open";
  const args = isWin ? ["/c", "start", url] : [url];
  spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
}

function copyToClipboard(text: string): void {
  const cmd =
    process.platform === "darwin"
      ? "pbcopy"
      : process.platform === "win32"
        ? "clip"
        : "xclip";
  const args = process.platform === "linux" ? ["-selection", "clipboard"] : [];
  const proc = spawn(cmd, args, { stdio: ["pipe", "ignore", "ignore"] });
  proc.stdin?.write(text, () => {
    proc.stdin?.end();
  });
}

program
  .name("wormkey")
  .description("Open a wormhole to your localhost")
  .version(pkg.version);

program
  .command("http <port>")
  .description("Expose local port via wormhole")
  .option("--auth", "Enable basic auth (prints username/password)")
  .option("--path", "Force path-based routing (/s/slug/)")
  .option("--expires <duration>", "Session expiry (e.g. 30m, 1h, 24h)", "24h")
  .option("--control-plane <url>", "Control plane URL")
  .option("--edge <url>", "Edge tunnel URL")
  .option("--local", "Use localhost control plane and edge")
  .action(async (port: string, opts) => {
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      console.error("Invalid port. Use 1-65535.");
      process.exit(1);
    }

    try {
      const isLocal =
        process.env.WORMKEY_ENV === "local" || opts.local === true;
      const defaultControlPlane = isLocal
        ? "http://localhost:3001"
        : "https://wormkey-control-plane.onrender.com";
      const defaultEdge = isLocal
        ? "ws://localhost:3002/tunnel"
        : "wss://t.wormkey.run/tunnel";

      const controlPlane =
        opts.controlPlane ??
        process.env.WORMKEY_CONTROL_PLANE_URL ??
        defaultControlPlane;
      console.error("Control plane:", controlPlane);

      const session = await createSession(controlPlane, {
        port: portNum,
        auth: opts.auth,
        expires: opts.expires,
        forcePath: opts.path,
      });

      if (opts.auth && session.username && session.password) {
        console.log("\nBasic auth enabled:");
        console.log(`  Username: ${session.username}`);
        console.log(`  Password: ${session.password}`);
        console.log();
      }

      const edgeUrl =
        opts.edge ??
        process.env.WORMKEY_EDGE_URL ??
        session.edgeUrl ??
        defaultEdge;
      console.error("Edge tunnel:", edgeUrl);
      const tunnel = new TunnelClient({
        localPort: portNum,
        edgeUrl,
        sessionToken: session.sessionToken,
        publicUrl: session.publicUrl,
        onStatus: (msg) => console.error(msg),
      });

      await tunnel.connect();

      writeSessionState(controlPlane, session);

      let expirationTimer: ReturnType<typeof setTimeout> | null = null;
      if (session.expiresAt) {
        const expiresMs = new Date(session.expiresAt).getTime() - Date.now();
        if (expiresMs > 0) {
          expirationTimer = setTimeout(() => {
            deleteSessionState();
            console.error("\nTunnel expired.");
            tunnel.close();
            process.exit(0);
          }, expiresMs);
        }
      }

      const cleanup = () => {
        if (expirationTimer) clearTimeout(expirationTimer);
        deleteSessionState();
        tunnel.close();
        process.exit(0);
      };

      const publicUrl = session.publicUrl;

      console.log("\nTunnel ready.\n");
      console.log("Share:");
      console.log(publicUrl);
      console.log();

      console.log("Scan to open");
      qrcode.generate(publicUrl, { small: true });
      console.log();

      if (opts.auth && session.username && session.password) {
        console.log("Basic auth:");
        console.log(`  Username: ${session.username}`);
        console.log(`  Password: ${session.password}`);
        console.log();
      }

      console.log("Owner claim URL (open once):");
      console.log(session.ownerUrl);
      console.log("\nPath B integration (add in app layout):");
      console.log(`<script defer src=\"${session.overlayScriptUrl}\"></script>`);
      console.log();

      const isTty = process.stdin.isTTY;
      if (isTty) {
        console.log("Press L to open in browser");
        console.log("Press C to copy URL");
        console.log("Press P to pause / R to resume");
        console.log("Press Q to close");
        console.log();

        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding("utf8");

        process.stdin.on("data", (key: string) => {
          const k = key.toLowerCase();
          if (k === "q" || k === "\u0003") {
            process.stdin.setRawMode?.(false);
            process.stdin.pause();
            cleanup();
          } else if (k === "l") {
            openUrl(publicUrl);
          } else if (k === "c") {
            copyToClipboard(publicUrl);
            console.error("URL copied to clipboard.");
          } else if (k === "p") {
            tunnel.pause();
            console.error("Tunnel paused.");
          } else if (k === "r") {
            tunnel.resume();
            console.error("Tunnel resumed.");
          }
        });
      } else {
        console.log("Press Ctrl+C to close.\n");
      }

      process.on("SIGINT", () => {
        process.stdin.setRawMode?.(false);
        process.stdin.pause?.();
        cleanup();
      });
    } catch (err) {
      console.error("Error:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command("login")
  .description("Authenticate with Wormkey (device flow)")
  .action(() => {
    console.log("Login not implemented in v0. Use local control plane.");
  });

program
  .command("status")
  .description("Show active tunnel status")
  .action(async () => {
    const filePath = getSessionStatePath();
    if (!fs.existsSync(filePath)) {
      console.log("No active tunnel.");
      return;
    }
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const state = JSON.parse(raw) as {
        slug: string;
        controlPlaneUrl: string;
        publicUrl: string;
        startedAt: string;
      };
      const res = await fetch(
        `${state.controlPlaneUrl.replace(/\/$/, "")}/sessions/by-slug/${state.slug}`
      );
      if (!res.ok) {
        console.log("Tunnel may have expired.");
        return;
      }
      const session = (await res.json()) as {
        activeViewers?: Array<{ id: string }>;
        createdAt?: string;
      };
      const viewers = session.activeViewers?.length ?? 0;
      const startedAt = new Date(state.startedAt).getTime();
      const uptimeMs = Date.now() - startedAt;
      const uptimeM = Math.floor(uptimeMs / 60000);
      const uptimeH = Math.floor(uptimeM / 60);
      const uptimeMRem = uptimeM % 60;
      const uptimeStr =
        uptimeH > 0 ? `${uptimeH}h ${uptimeMRem}m` : `${uptimeM}m`;

      console.log("Tunnel: running");
      console.log(`URL: ${state.publicUrl}`);
      console.log(`Viewers: ${viewers}`);
      console.log(`Uptime: ${uptimeStr}`);
    } catch {
      console.log("No active tunnel.");
    }
  });

program
  .command("close")
  .description("Close active tunnel")
  .action(() => {
    console.log("Close not implemented in v0. Use Ctrl+C on the tunnel process.");
  });

program.parse();
