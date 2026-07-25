#!/usr/bin/env node
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const wormkeyBin = process.env.WORMKEY_BIN ?? "wormkey";
const tunnels = new Map<string, ChildProcess>();

const tools = [
  { name: "wormkey_start_tunnel", description: "Start a Wormkey HTTP tunnel", inputSchema: { type: "object", properties: { port: { type: "number" }, wait_for: { type: "string" }, timeout: { type: "string" }, inspect: { type: "boolean" } }, required: ["port"] } },
  { name: "wormkey_get_tunnel", description: "Get a tunnel status", inputSchema: { type: "object", properties: { session: { type: "string" } } } },
  { name: "wormkey_list_tunnels", description: "List Wormkey tunnels", inputSchema: { type: "object", properties: {} } },
  { name: "wormkey_close_tunnel", description: "Close a Wormkey tunnel", inputSchema: { type: "object", properties: { session: { type: "string" } } } },
  { name: "wormkey_get_requests", description: "Read captured request logs", inputSchema: { type: "object", properties: { session: { type: "string" } } } },
  { name: "wormkey_replay_request", description: "Replay a captured request", inputSchema: { type: "object", properties: { request_id: { type: "string" } }, required: ["request_id"] } },
  { name: "wormkey_wait_until_ready", description: "Wait for a local HTTP service", inputSchema: { type: "object", properties: { port: { type: "number" }, path: { type: "string" }, timeout: { type: "string" } }, required: ["port"] } },
];

async function runCommand(args: string[]): Promise<unknown> {
  const { stdout } = await execFileAsync(wormkeyBin, args, { maxBuffer: 10 * 1024 * 1024 });
  const lines = stdout.trim().split("\n").filter(Boolean);
  if (lines.length === 0) return { ok: true };
  return lines.map((line) => JSON.parse(line));
}

async function startTunnel(argumentsValue: Record<string, unknown>): Promise<unknown> {
  const args = ["http", String(argumentsValue.port), "--json", "--no-interactive"];
  if (argumentsValue.wait_for) args.push("--wait-for", String(argumentsValue.wait_for));
  if (argumentsValue.timeout) args.push("--timeout", String(argumentsValue.timeout));
  if (argumentsValue.inspect) args.push("--inspect");
  const child = spawn(wormkeyBin, args, { stdio: ["ignore", "pipe", "pipe"] });
  const output = createInterface({ input: child.stdout! });
  const firstLine = await new Promise<string>((resolve, reject) => {
    output.once("line", resolve);
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`wormkey exited before readiness with code ${code}`)));
  });
  output.close();
  const session = JSON.parse(firstLine) as { session_id: string };
  tunnels.set(session.session_id, child);
  child.once("exit", () => tunnels.delete(session.session_id));
  return session;
}

async function callTool(name: string, argumentsValue: Record<string, unknown>): Promise<unknown> {
  if (name === "wormkey_start_tunnel") return startTunnel(argumentsValue);
  if (name === "wormkey_get_tunnel") return runCommand(["status", ...argumentsValue.session ? [String(argumentsValue.session)] : [], "--json"]);
  if (name === "wormkey_list_tunnels") return runCommand(["list", "--json"]);
  if (name === "wormkey_close_tunnel") return runCommand(["close", ...argumentsValue.session ? [String(argumentsValue.session)] : [], "--json"]);
  if (name === "wormkey_get_requests") return runCommand(["logs", ...argumentsValue.session ? [String(argumentsValue.session)] : [], "--json"]);
  if (name === "wormkey_replay_request") return runCommand(["replay", String(argumentsValue.request_id)]);
  if (name === "wormkey_wait_until_ready") return runCommand(["wait-until-ready", String(argumentsValue.port), "--path", String(argumentsValue.path ?? "/"), "--timeout", String(argumentsValue.timeout ?? "60s")]);
  throw new Error(`Unknown tool: ${name}`);
}

function send(message: unknown): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

const input = createInterface({ input: process.stdin });
input.on("line", async (line) => {
  let request: { id?: string | number; method: string; params?: Record<string, any> } = { method: "" };
  try {
    request = JSON.parse(line);
    if (request.method === "initialize") {
      send({ jsonrpc: "2.0", id: request.id, result: { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "wormkey", version: "0.1.0" } } });
      return;
    }
    if (request.method === "notifications/initialized") return;
    if (request.method === "tools/list") {
      send({ jsonrpc: "2.0", id: request.id, result: { tools } });
      return;
    }
    if (request.method === "tools/call") {
      const result = await callTool(request.params?.name, request.params?.arguments ?? {});
      send({ jsonrpc: "2.0", id: request.id, result: { content: [{ type: "text", text: JSON.stringify(result) }] } });
      return;
    }
    send({ jsonrpc: "2.0", id: request.id, error: { code: -32601, message: "Method not found" } });
  } catch (error) {
    send({ jsonrpc: "2.0", id: request?.id, error: { code: -32000, message: error instanceof Error ? error.message : String(error) } });
  }
});

function shutdown(): void {
  for (const child of tunnels.values()) child.kill("SIGTERM");
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
