#!/usr/bin/env node
/**
 * Wormkey CLI
 * Open a wormhole to your localhost.
 */

import { program } from "commander";
import { TunnelClient } from "./tunnel.js";
import { createSession } from "./api.js";

const DEFAULT_CONTROL_PLANE = process.env.WORMKEY_CONTROL_PLANE ?? "http://localhost:3001";
const DEFAULT_EDGE = process.env.WORMKEY_EDGE ?? "http://localhost:3002";

program
  .name("wormkey")
  .description("Open a wormhole to your localhost")
  .version("0.1.0");

program
  .command("http <port>")
  .description("Expose local port via wormhole")
  .option("--auth", "Enable basic auth (prints username/password)")
  .option("--expires <duration>", "Session expiry (e.g. 30m, 1h, 24h)", "24h")
  .option("--control-plane <url>", "Control plane URL", DEFAULT_CONTROL_PLANE)
  .option("--edge <url>", "Edge gateway URL (for local dev)", DEFAULT_EDGE)
  .action(async (port: string, opts) => {
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      console.error("Invalid port. Use 1-65535.");
      process.exit(1);
    }

    try {
      const session = await createSession(opts.controlPlane, {
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

      const edgeUrl = opts.edge !== DEFAULT_EDGE ? opts.edge : session.edgeUrl;
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
