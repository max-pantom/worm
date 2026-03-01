#!/usr/bin/env node
/**
 * Wormkey CLI
 * Open a wormhole to your localhost.
 */

import "dotenv/config";
import { createRequire } from "module";
import { program } from "commander";
import { TunnelClient } from "./tunnel.js";
import { createSession } from "./api.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

program
  .name("wormkey")
  .description("Open a wormhole to your localhost")
  .version(pkg.version);

program
  .command("http <port>")
  .description("Expose local port via wormhole")
  .option("--auth", "Enable basic auth (prints username/password)")
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
        process.env.WORMKEY_CONTROL_PLANE_URL ??
        opts.controlPlane ??
        defaultControlPlane;
      console.error("Control plane:", controlPlane);

      const session = await createSession(controlPlane, {
        port: portNum,
        auth: opts.auth,
        expires: opts.expires,
      });

      if (opts.auth && session.username && session.password) {
        console.log("\nBasic auth enabled:");
        console.log(`  Username: ${session.username}`);
        console.log(`  Password: ${session.password}`);
        console.log();
      }

      const edgeUrl =
        process.env.WORMKEY_EDGE_URL ??
        opts.edge ??
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

      console.log("\nWormhole open.");
      console.log(session.publicUrl);
      console.log("\nOwner claim URL (open once):");
      console.log(session.ownerUrl);
      console.log("\nPath B integration (add in app layout):");
      console.log(`<script defer src=\"${session.overlayScriptUrl}\"></script>`);
      console.log("\nPress Ctrl+C to close.\n");

      process.on("SIGINT", () => {
        tunnel.close();
        process.exit(0);
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
  .action(() => {
    console.log("Status not implemented in v0.");
  });

program
  .command("close")
  .description("Close active tunnel")
  .action(() => {
    console.log("Close not implemented in v0. Use Ctrl+C on the tunnel process.");
  });

program.parse();
