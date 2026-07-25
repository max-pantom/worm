#!/usr/bin/env node
import "dotenv/config";
import { createRequire } from "node:module";
import * as fs from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { program } from "commander";
import qrcode from "qrcode-terminal";
import { closeSession, createScopedToken, createSession, getOwnerSession } from "./api.js";
import { TunnelClient } from "./tunnel.js";
import {
  appendRequestLog,
  findRequest,
  findSession,
  readRequestLogs,
  readSessions,
  saveSession,
  updateSession,
  type StoredSession,
} from "./state.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

const ExitCode = {
  Success: 0,
  InvalidArguments: 10,
  LocalUnavailable: 11,
  ControlPlaneUnavailable: 12,
  GatewayAuthenticationFailed: 13,
  TunnelExpired: 14,
  PolicyRejected: 15,
  RateLimited: 16,
} as const;

function durationMs(value: string): number {
  const match = /^(\d+)(ms|s|m|h)?$/.exec(value);
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const amount = Number.parseInt(match[1], 10);
  const unit = match[2] ?? "s";
  return amount * ({ ms: 1, s: 1_000, m: 60_000, h: 3_600_000 }[unit] ?? 1_000);
}

async function waitUntilReady(port: number, path: string, timeout: string): Promise<void> {
  const deadline = Date.now() + durationMs(timeout);
  const url = `http://127.0.0.1:${port}${path.startsWith("/") ? path : `/${path}`}`;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw Object.assign(new Error(`Local service did not become ready at ${url}`), { exitCode: ExitCode.LocalUnavailable });
}

function resolveEndpoints(options: { local?: boolean; controlPlane?: string; edge?: string }) {
  const local = process.env.WORMKEY_ENV === "local" || options.local === true;
  return {
    controlPlane: process.env.WORMKEY_CONTROL_PLANE_URL ?? options.controlPlane ?? (local ? "http://localhost:3001" : "https://wormkey-control-plane.onrender.com"),
    edge: process.env.WORMKEY_EDGE_URL ?? options.edge ?? (local ? "ws://localhost:3002/tunnel" : "wss://t.wormkey.run/tunnel"),
  };
}

function emitJson(value: unknown, output?: string): void {
  const serialized = `${JSON.stringify(value)}\n`;
  if (output) {
    const temporary = `${output}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, serialized, { encoding: "utf8", mode: 0o600 });
    fs.renameSync(temporary, output);
  }
  process.stdout.write(serialized);
}

function sessionOutput(session: StoredSession) {
  return {
    session_id: session.sessionId,
    url: session.publicUrl,
    owner_url: session.ownerUrl,
    expires_at: session.expiresAt,
    pid: session.pid,
    status: session.status,
  };
}

async function startTunnel(port: number, options: {
  auth?: boolean;
  expires: string;
  controlPlane?: string;
  edge?: string;
  local?: boolean;
  json?: boolean;
  interactive?: boolean;
  waitFor?: string;
  timeout: string;
  inspect?: boolean;
  output?: string;
}): Promise<{ tunnel: TunnelClient; session: StoredSession }> {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw Object.assign(new Error("Invalid port. Use 1-65535."), { exitCode: ExitCode.InvalidArguments });
  }
  if (options.waitFor) await waitUntilReady(port, options.waitFor, options.timeout);
  const endpoints = resolveEndpoints(options);
  const created = await createSession(endpoints.controlPlane, { port, auth: options.auth, expires: options.expires });
  const session: StoredSession = {
    sessionId: created.sessionId,
    slug: created.slug,
    controlPlaneUrl: endpoints.controlPlane,
    publicUrl: created.publicUrl,
    ownerUrl: created.ownerUrl,
    ownerToken: created.ownerToken,
    expiresAt: created.expiresAt,
    startedAt: new Date().toISOString(),
    pid: process.pid,
    status: "connected",
    localPort: port,
  };
  const tunnel = new TunnelClient({
    localPort: port,
    edgeUrl: created.edgeUrl || endpoints.edge,
    sessionToken: created.sessionToken,
    ownerToken: created.ownerToken,
    publicUrl: created.publicUrl,
    sessionId: created.sessionId,
    onStatus: (message) => console.error(message),
    onRequest: options.inspect ? appendRequestLog : undefined,
  });
  await tunnel.connect();
  saveSession(session);
  if (options.json) {
    emitJson(sessionOutput(session), options.output);
  } else {
    console.log("\nTunnel ready.\n");
    console.log(`Share:\n${created.publicUrl}\n`);
    if (options.interactive !== false) {
      console.log("Scan to open");
      qrcode.generate(created.publicUrl, { small: true });
      console.log(`\nOwner claim URL:\n${created.ownerUrl}\n`);
    }
  }
  return { tunnel, session };
}

function installLifecycle(tunnel: TunnelClient, session: StoredSession, child?: ChildProcess): void {
  const cleanup = async (exitCode: number = ExitCode.Success) => {
    tunnel.close();
    updateSession(session.sessionId, { status: "closed" });
    if (child && !child.killed) child.kill("SIGTERM");
    process.exit(exitCode);
  };
  process.on("SIGINT", () => void cleanup());
  process.on("SIGTERM", () => void cleanup());
  const expiresIn = Date.parse(session.expiresAt) - Date.now();
  if (expiresIn > 0) setTimeout(() => void cleanup(ExitCode.TunnelExpired), expiresIn);
}

program.name("wormkey").description("Open a wormhole to your localhost").version(pkg.version);

program
  .command("http <port>")
  .description("Expose a local HTTP port")
  .option("--auth", "Enable generated basic auth")
  .option("--expires <duration>", "Session expiry", "24h")
  .option("--control-plane <url>", "Control plane URL")
  .option("--edge <url>", "Edge tunnel URL")
  .option("--local", "Use local services")
  .option("--json", "Write one JSON object to stdout")
  .option("--no-interactive", "Disable QR codes and controls")
  .option("--wait-for <path>", "Wait for a local readiness path")
  .option("--timeout <duration>", "Readiness timeout", "60s")
  .option("--inspect", "Capture request metadata for logs and replay")
  .option("--output <path>", "Atomically write session JSON")
  .action(async (portValue: string, options) => {
    try {
      const { tunnel, session } = await startTunnel(Number.parseInt(portValue, 10), options);
      installLifecycle(tunnel, session);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exit((error as { exitCode?: number }).exitCode ?? ExitCode.ControlPlaneUnavailable);
    }
  });

program
  .command("run")
  .description("Start a process and expose it through Wormkey")
  .requiredOption("--port <port>", "Local application port")
  .option("--wait-for <path>", "Readiness path", "/")
  .option("--timeout <duration>", "Readiness timeout", "60s")
  .option("--expires <duration>", "Session expiry", "24h")
  .option("--json", "Write one JSON object to stdout")
  .option("--no-interactive", "Disable interactive output")
  .option("--inspect", "Capture request metadata")
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action(async (options, command) => {
    const args = command.args;
    if (args[0] === "--") args.shift();
    if (args.length === 0) {
      console.error("A command is required after --");
      process.exit(ExitCode.InvalidArguments);
    }
    const child = spawn(args[0], args.slice(1), { stdio: "inherit", env: { ...process.env, PORT: options.port } });
    try {
      const { tunnel, session } = await startTunnel(Number.parseInt(options.port, 10), options);
      installLifecycle(tunnel, session, child);
      child.on("exit", (code) => {
        tunnel.close();
        updateSession(session.sessionId, { status: "closed" });
        process.exit(code ?? 0);
      });
    } catch (error) {
      child.kill("SIGTERM");
      console.error(error instanceof Error ? error.message : error);
      process.exit((error as { exitCode?: number }).exitCode ?? ExitCode.ControlPlaneUnavailable);
    }
  });

program.command("list").description("List saved tunnels").option("--json", "Output JSON").action((options) => {
  const sessions = readSessions();
  if (options.json) return emitJson(sessions.map(sessionOutput));
  if (sessions.length === 0) return console.log("No saved tunnels.");
  for (const session of sessions) console.log(`${session.status.padEnd(10)} ${session.slug.padEnd(24)} ${session.publicUrl}`);
});

program.command("close [session]").description("Close a tunnel remotely").option("--json", "Output JSON").action(async (identifier, options) => {
  const session = findSession(identifier);
  if (!session) {
    process.exitCode = ExitCode.InvalidArguments;
    return;
  }
  try {
    await closeSession(session.controlPlaneUrl, session.slug, session.ownerToken);
    updateSession(session.sessionId, { status: "closed" });
    if (options.json) emitJson({ session_id: session.sessionId, status: "closed" });
    else console.log(`Closed ${session.publicUrl}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = ExitCode.ControlPlaneUnavailable;
  }
});

program.command("status [session]").description("Show tunnel status").option("--json", "Output JSON").action(async (identifier, options) => {
  const session = findSession(identifier);
  if (!session) return console.log("No active tunnel.");
  try {
    const remote = await getOwnerSession(session.controlPlaneUrl, session.slug, session.ownerToken);
    if (options.json) emitJson({ ...sessionOutput(session), remote });
    else console.log(`${session.status}: ${session.publicUrl}`);
  } catch {
    console.log("Tunnel may have expired.");
  }
});

program.command("logs [session]").description("Show captured request logs").option("--json", "Output JSON lines").action((identifier, options) => {
  const session = findSession(identifier);
  const logs = readRequestLogs(session?.sessionId);
  for (const entry of logs) {
    if (options.json) console.log(JSON.stringify(entry));
    else console.log(`${entry.requestId} ${entry.method} ${entry.path} ${entry.status} ${entry.durationMs}ms ${entry.requestBytes}B→${entry.responseBytes}B`);
  }
});

program.command("inspect [request]").description("Inspect captured requests").action((requestId) => {
  if (requestId) {
    const entry = findRequest(requestId);
    if (!entry) return console.log("Request not found.");
    return console.log(JSON.stringify(entry, null, 2));
  }
  for (const entry of readRequestLogs().slice(-20)) console.log(`${entry.requestId} ${entry.method} ${entry.path} ${entry.status}`);
});

program.command("replay <request>").description("Replay a captured request to localhost").action(async (requestId) => {
  const entry = findRequest(requestId);
  const session = entry ? readSessions().find((candidate) => candidate.sessionId === entry.sessionId) : undefined;
  if (!entry || !session) {
    process.exitCode = ExitCode.InvalidArguments;
    return;
  }
  const response = await fetch(`http://127.0.0.1:${session.localPort}${entry.path}`, {
    method: entry.method,
    headers: entry.requestHeaders,
    body: entry.requestBodyBase64 ? Buffer.from(entry.requestBodyBase64, "base64") : undefined,
  });
  console.log(JSON.stringify({ request_id: requestId, status: response.status, body: await response.text() }));
});

program.command("wait-until-ready <port>").description("Wait for a local service").option("--path <path>", "Readiness path", "/").option("--timeout <duration>", "Timeout", "60s").action(async (port, options) => {
  try {
    await waitUntilReady(Number.parseInt(port, 10), options.path, options.timeout);
    emitJson({ ready: true, port: Number.parseInt(port, 10), path: options.path });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = ExitCode.LocalUnavailable;
  }
});

const tokenCommand = program.command("token").description("Manage restricted session tokens");

tokenCommand.command("create [session]")
  .description("Create a restricted session token")
  .requiredOption("--name <name>", "Token name")
  .option("--scope <scopes>", "Comma-separated scopes", "tunnel:read")
  .option("--max-ttl <duration>", "Maximum token lifetime", "2h")
  .action(async (identifier, options) => {
    const session = findSession(identifier);
    if (!session) {
      process.exitCode = ExitCode.InvalidArguments;
      return;
    }
    try {
      const token = await createScopedToken(session.controlPlaneUrl, session.sessionId, session.ownerToken, {
        name: options.name,
        scopes: options.scope.split(",").map((scope: string) => scope.trim()).filter(Boolean),
        maxTtl: options.maxTtl,
      });
      emitJson(token);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = ExitCode.ControlPlaneUnavailable;
    }
  });

program.parseAsync().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(ExitCode.InvalidArguments);
});
