import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface StoredSession {
  sessionId: string;
  slug: string;
  controlPlaneUrl: string;
  publicUrl: string;
  ownerUrl: string;
  ownerToken: string;
  expiresAt: string;
  startedAt: string;
  pid: number;
  status: "connected" | "paused" | "closed" | "expired";
  localPort: number;
}

export interface RequestLogEntry {
  requestId: string;
  sessionId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  requestBytes: number;
  responseBytes: number;
  timestamp: string;
  requestHeaders: Record<string, string>;
  requestBodyBase64?: string;
}

function stateDirectory(): string {
  return process.env.XDG_STATE_HOME
    ? path.join(process.env.XDG_STATE_HOME, "wormkey")
    : path.join(os.homedir(), ".wormkey");
}

function ensureStateDirectory(): string {
  const directory = stateDirectory();
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  return directory;
}

function sessionsPath(): string {
  return path.join(stateDirectory(), "sessions.json");
}

function logsPath(): string {
  return path.join(stateDirectory(), "requests.jsonl");
}

export function readSessions(): StoredSession[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(sessionsPath(), "utf8")) as StoredSession[] | unknown;
    return Array.isArray(parsed) ? parsed as StoredSession[] : [];
  } catch {
    return [];
  }
}

export function writeSessions(sessions: StoredSession[]): void {
  const filePath = path.join(ensureStateDirectory(), "sessions.json");
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(sessions, null, 2), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporaryPath, filePath);
}

export function saveSession(session: StoredSession): void {
  const sessions = readSessions().filter((existing) => existing.sessionId !== session.sessionId);
  sessions.push(session);
  writeSessions(sessions);
}

export function updateSession(sessionId: string, patch: Partial<StoredSession>): void {
  writeSessions(readSessions().map((session) => session.sessionId === sessionId ? { ...session, ...patch } : session));
}

export function findSession(identifier?: string): StoredSession | undefined {
  const active = readSessions().filter((session) => session.status !== "closed" && session.status !== "expired");
  if (!identifier) return active.at(-1);
  return active.find((session) => session.sessionId === identifier || session.slug === identifier);
}

export function appendRequestLog(entry: RequestLogEntry): void {
  fs.appendFileSync(path.join(ensureStateDirectory(), "requests.jsonl"), `${JSON.stringify(entry)}\n`, { encoding: "utf8", mode: 0o600 });
}

export function readRequestLogs(sessionId?: string): RequestLogEntry[] {
  try {
    return fs.readFileSync(logsPath(), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as RequestLogEntry)
      .filter((entry) => !sessionId || entry.sessionId === sessionId);
  } catch {
    return [];
  }
}

export function findRequest(requestId: string): RequestLogEntry | undefined {
  return readRequestLogs().find((entry) => entry.requestId === requestId);
}
