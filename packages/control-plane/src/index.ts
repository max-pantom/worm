/**
 * Wormkey Control Plane
 * Session creation, slug allocation, lifecycle
 */

import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import Fastify, { type FastifyRequest } from "fastify";
import cors from "@fastify/cors";

const ADJECTIVES = [
  "quiet", "bold", "swift", "calm", "bright", "soft", "warm", "cool",
  "deep", "flat", "wild", "mild", "dark", "pale", "pure", "rare", "max",
];
const NOUNS = [
  "lime", "mint", "sage", "rose", "sky", "sea", "sand", "snow",
  "mist", "dawn", "dusk", "flame", "storm", "wave", "wind", "frost", "tooth",
];

function randomSlug(): string {
  const adjective = ADJECTIVES[randomInt(ADJECTIVES.length)];
  const noun = NOUNS[randomInt(NOUNS.length)];
  const suffix = randomBytes(3).toString("base64url").toLowerCase();
  return `${adjective}-${noun}-${suffix}`;
}

function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function bearerToken(request: FastifyRequest): string | null {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice(7).trim() || null;
}

const PUBLIC_BASE_URL = process.env.WORMKEY_PUBLIC_BASE_URL ?? "http://localhost:3002";
const EDGE_BASE_URL = process.env.WORMKEY_EDGE_BASE_URL ?? "ws://localhost:3002";
const INTERNAL_API_KEY = process.env.WORMKEY_INTERNAL_API_KEY ?? "";

interface Viewer {
  id: string;
  lastSeenAt: string;
  requests: number;
  ip?: string;
}

interface Session {
  sessionId: string;
  slug: string;
  sessionTokenHash: string;
  ownerTokenHash: string;
  ownerUrl: string;
  overlayScriptUrl: string;
  publicUrl: string;
  edgeUrl: string;
  expiresAt: string;
  createdAt: string;
  authMode: string;
  policy: {
    public: boolean;
    maxConcurrentViewers: number;
    blockPaths: string[];
    password: string;
  };
  activeViewers: Viewer[];
  kickedViewerIds: string[];
  closed: boolean;
  username?: string;
  password?: string;
  agentTokens: Array<{
    name: string;
    tokenHash: string;
    scopes: string[];
    expiresAt: string;
  }>;
}

function publicSession(session: Session) {
  return {
    sessionId: session.sessionId,
    slug: session.slug,
    publicUrl: session.publicUrl,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
    authMode: session.authMode,
    closed: session.closed,
    available: !session.closed && Date.parse(session.expiresAt) > Date.now(),
  };
}

function ownerSession(session: Session) {
  return {
    ...publicSession(session),
    ownerUrl: session.ownerUrl,
    overlayScriptUrl: session.overlayScriptUrl,
    edgeUrl: session.edgeUrl,
    policy: session.policy,
    activeViewers: session.activeViewers,
    kickedViewerIds: session.kickedViewerIds,
    username: session.username,
    password: session.password,
  };
}

export function buildApp() {
  const fastify = Fastify({ logger: true, bodyLimit: 10 * 1024 * 1024 });
  const sessions = new Map<string, Session>();
  const sessionIdsBySlug = new Map<string, string>();

  const findBySlug = (slug: string) => {
    const sessionId = sessionIdsBySlug.get(slug);
    return sessionId ? sessions.get(sessionId) : undefined;
  };

  const requireOwner = (request: FastifyRequest, session: Session) => {
    const token = bearerToken(request);
    return token !== null && safeEqual(hashToken(token), session.ownerTokenHash);
  };

  const requireInternal = (request: FastifyRequest) => {
    const token = bearerToken(request);
    return INTERNAL_API_KEY !== "" && token !== null && safeEqual(token, INTERNAL_API_KEY);
  };

  fastify.register(cors, { origin: true });

  fastify.get("/", async () => ({ status: "control plane alive" }));
  fastify.get("/health", async (_request, reply) => reply.send("ok"));

  fastify.post<{ Body: { port?: number; authMode?: string; expiresIn?: string } }>(
    "/sessions",
    async (request, reply) => {
      const { authMode = "none", expiresIn = "24h" } = request.body ?? {};
      const slug = randomSlug();
      const ownerToken = randomToken();
      const tunnelToken = randomToken();
      const sessionToken = `${slug}.${tunnelToken}`;
      const sessionId = `sess_${randomUUID()}`;
      const publicBase = PUBLIC_BASE_URL.replace(/\/$/, "");
      const edgeBase = EDGE_BASE_URL.replace(/\/$/, "");
      const publicUrl = `${publicBase}/s/${slug}`;
      const edgeUrl = `${edgeBase}/tunnel`;
      const ownerUrl = `${publicBase}/.wormkey/owner?slug=${slug}&token=${ownerToken}`;
      const overlayScriptUrl = `${publicBase}/.wormkey/overlay.js?slug=${slug}`;
      const parsedExpiry = Number.parseInt(expiresIn, 10);
      const expiresMs = Number.isFinite(parsedExpiry)
        ? expiresIn.endsWith("m")
          ? parsedExpiry * 60_000
          : expiresIn.endsWith("h")
            ? parsedExpiry * 3_600_000
            : 24 * 3_600_000
        : 24 * 3_600_000;
      const session: Session = {
        sessionId,
        slug,
        sessionTokenHash: hashToken(sessionToken),
        ownerTokenHash: hashToken(ownerToken),
        ownerUrl,
        overlayScriptUrl,
        publicUrl,
        edgeUrl,
        expiresAt: new Date(Date.now() + expiresMs).toISOString(),
        createdAt: new Date().toISOString(),
        authMode,
        policy: { public: true, maxConcurrentViewers: 20, blockPaths: [], password: "" },
        activeViewers: [],
        kickedViewerIds: [],
        closed: false,
        agentTokens: [],
      };
      if (authMode === "basic") {
        session.username = "worm";
        session.password = randomBytes(12).toString("base64url");
      }
      sessions.set(sessionId, session);
      sessionIdsBySlug.set(slug, sessionId);
      return reply.status(201).send({
        sessionId,
        slug,
        publicUrl,
        ownerUrl,
        ownerToken,
        overlayScriptUrl,
        edgeUrl,
        sessionToken,
        expiresAt: session.expiresAt,
        ...(session.username && { username: session.username }),
        ...(session.password && { password: session.password }),
      });
    },
  );

  fastify.get("/sessions/:id", async (request, reply) => {
    const session = sessions.get((request.params as { id: string }).id);
    if (!session) return reply.status(404).send({ error: "Session not found" });
    if (!requireOwner(request, session)) return reply.status(401).send({ error: "Unauthorized" });
    return ownerSession(session);
  });

  fastify.delete("/sessions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = sessions.get(id);
    if (!session) return reply.status(404).send({ error: "Session not found" });
    if (!requireOwner(request, session)) return reply.status(401).send({ error: "Unauthorized" });
    sessions.delete(id);
    sessionIdsBySlug.delete(session.slug);
    return reply.send({ ok: true });
  });

  fastify.get("/sessions/by-slug/:slug", async (request, reply) => {
    const session = findBySlug((request.params as { slug: string }).slug);
    if (!session) return reply.status(404).send({ error: "Session not found" });
    return publicSession(session);
  });

  fastify.get("/owner/sessions/by-slug/:slug", async (request, reply) => {
    const session = findBySlug((request.params as { slug: string }).slug);
    if (!session) return reply.status(404).send({ error: "Session not found" });
    if (!requireOwner(request, session)) return reply.status(401).send({ error: "Unauthorized" });
    return ownerSession(session);
  });

  fastify.post<{ Params: { slug: string }; Body: Partial<Session["policy"]> }>(
    "/owner/sessions/by-slug/:slug/policy",
    async (request, reply) => {
      const session = findBySlug(request.params.slug);
      if (!session) return reply.status(404).send({ error: "Session not found" });
      if (!requireOwner(request, session)) return reply.status(401).send({ error: "Unauthorized" });
      if (typeof request.body.public === "boolean") session.policy.public = request.body.public;
      if (typeof request.body.maxConcurrentViewers === "number") session.policy.maxConcurrentViewers = request.body.maxConcurrentViewers;
      if (Array.isArray(request.body.blockPaths)) session.policy.blockPaths = request.body.blockPaths;
      if (typeof request.body.password === "string") session.policy.password = request.body.password;
      return reply.send({ ok: true, policy: session.policy });
    },
  );

  fastify.post<{ Params: { slug: string }; Body: { viewerId: string } }>(
    "/owner/sessions/by-slug/:slug/kick",
    async (request, reply) => {
      const session = findBySlug(request.params.slug);
      if (!session) return reply.status(404).send({ error: "Session not found" });
      if (!requireOwner(request, session)) return reply.status(401).send({ error: "Unauthorized" });
      if (request.body.viewerId && !session.kickedViewerIds.includes(request.body.viewerId)) session.kickedViewerIds.push(request.body.viewerId);
      session.activeViewers = session.activeViewers.filter((viewer) => viewer.id !== request.body.viewerId);
      return reply.send({ ok: true, kickedViewerIds: session.kickedViewerIds });
    },
  );

  fastify.post<{ Params: { slug: string } }>("/owner/sessions/by-slug/:slug/close", async (request, reply) => {
    const session = findBySlug(request.params.slug);
    if (!session) return reply.status(404).send({ error: "Session not found" });
    if (!requireOwner(request, session)) return reply.status(401).send({ error: "Unauthorized" });
    session.closed = true;
    return reply.send({ ok: true });
  });

  fastify.post<{ Body: { sessionToken?: string } }>("/internal/sessions/validate", async (request, reply) => {
    if (!requireInternal(request)) return reply.status(401).send({ error: "Unauthorized" });
    const sessionToken = request.body?.sessionToken;
    if (!sessionToken) return reply.status(400).send({ error: "sessionToken is required" });
    const slug = sessionToken.split(".", 1)[0];
    const session = findBySlug(slug);
    const tokenHash = hashToken(sessionToken);
    const validAgentToken = session?.agentTokens.some((token) =>
      Date.parse(token.expiresAt) > Date.now()
      && token.scopes.includes("tunnel:connect")
      && safeEqual(tokenHash, token.tokenHash)
    );
    if (!session || (!safeEqual(tokenHash, session.sessionTokenHash) && !validAgentToken)) return reply.status(401).send({ error: "Invalid session token" });
    return reply.send({ ok: true, slug, closed: session.closed, expiresAt: session.expiresAt });
  });

  fastify.post<{
    Params: { id: string };
    Body: { name?: string; scopes?: string[]; maxTtl?: string };
  }>("/owner/sessions/:id/tokens", async (request, reply) => {
    const session = sessions.get(request.params.id);
    if (!session) return reply.status(404).send({ error: "Session not found" });
    if (!requireOwner(request, session)) return reply.status(401).send({ error: "Unauthorized" });
    const scopes = request.body.scopes?.filter((scope) => ["tunnel:connect", "tunnel:read", "tunnel:close"].includes(scope)) ?? ["tunnel:read"];
    const ttl = request.body.maxTtl ?? "2h";
    const amount = Number.parseInt(ttl, 10);
    if (!Number.isFinite(amount) || amount <= 0 || (!ttl.endsWith("m") && !ttl.endsWith("h"))) {
      return reply.status(400).send({ error: "maxTtl must use minutes or hours" });
    }
    const ttlMs = ttl.endsWith("m") ? amount * 60_000 : amount * 3_600_000;
    const rawToken = `${session.slug}.${randomToken()}`;
    const agentToken = {
      name: request.body.name ?? "agent",
      tokenHash: hashToken(rawToken),
      scopes,
      expiresAt: new Date(Date.now() + Math.min(ttlMs, 24 * 3_600_000)).toISOString(),
    };
    session.agentTokens.push(agentToken);
    return reply.status(201).send({ token: rawToken, name: agentToken.name, scopes, expiresAt: agentToken.expiresAt });
  });

  fastify.get("/internal/sessions/by-slug/:slug", async (request, reply) => {
    if (!requireInternal(request)) return reply.status(401).send({ error: "Unauthorized" });
    const session = findBySlug((request.params as { slug: string }).slug);
    if (!session) return reply.status(404).send({ error: "Session not found" });
    return ownerSession(session);
  });

  fastify.post<{ Params: { slug: string }; Body: Partial<Session["policy"]> }>("/internal/sessions/by-slug/:slug/policy", async (request, reply) => {
    if (!requireInternal(request)) return reply.status(401).send({ error: "Unauthorized" });
    const session = findBySlug(request.params.slug);
    if (!session) return reply.status(404).send({ error: "Session not found" });
    if (typeof request.body.public === "boolean") session.policy.public = request.body.public;
    if (typeof request.body.maxConcurrentViewers === "number") session.policy.maxConcurrentViewers = request.body.maxConcurrentViewers;
    if (Array.isArray(request.body.blockPaths)) session.policy.blockPaths = request.body.blockPaths;
    if (typeof request.body.password === "string") session.policy.password = request.body.password;
    return reply.send({ ok: true, policy: session.policy });
  });

  fastify.post<{ Params: { slug: string }; Body: { viewers?: Viewer[] } }>("/internal/sessions/by-slug/:slug/viewers", async (request, reply) => {
    if (!requireInternal(request)) return reply.status(401).send({ error: "Unauthorized" });
    const session = findBySlug(request.params.slug);
    if (!session) return reply.status(404).send({ error: "Session not found" });
    session.activeViewers = request.body.viewers ?? [];
    return reply.send({ ok: true });
  });

  fastify.post<{ Params: { slug: string }; Body: { viewerId: string } }>("/internal/sessions/by-slug/:slug/kick", async (request, reply) => {
    if (!requireInternal(request)) return reply.status(401).send({ error: "Unauthorized" });
    const session = findBySlug(request.params.slug);
    if (!session) return reply.status(404).send({ error: "Session not found" });
    if (request.body.viewerId && !session.kickedViewerIds.includes(request.body.viewerId)) session.kickedViewerIds.push(request.body.viewerId);
    session.activeViewers = session.activeViewers.filter((viewer) => viewer.id !== request.body.viewerId);
    return reply.send({ ok: true, kickedViewerIds: session.kickedViewerIds });
  });

  fastify.post<{ Params: { slug: string } }>("/internal/sessions/by-slug/:slug/close", async (request, reply) => {
    if (!requireInternal(request)) return reply.status(401).send({ error: "Unauthorized" });
    const session = findBySlug(request.params.slug);
    if (!session) return reply.status(404).send({ error: "Session not found" });
    session.closed = true;
    return reply.send({ ok: true });
  });

  return fastify;
}

async function main() {
  const fastify = buildApp();
  fastify.log.info({ PUBLIC_BASE_URL, EDGE_BASE_URL }, "Resolved Wormkey base URLs");
  if (!INTERNAL_API_KEY) fastify.log.warn("WORMKEY_INTERNAL_API_KEY is unset; internal edge API is disabled");
  const port = Number.parseInt(process.env.PORT ?? "3001", 10);
  await fastify.listen({ port, host: "0.0.0.0" });
}

if (process.env.NODE_ENV !== "test") {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
