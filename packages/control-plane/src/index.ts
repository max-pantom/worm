/**
 * Wormkey Control Plane
 * Session creation, slug allocation, lifecycle
 */

import Fastify from "fastify";
import cors from "@fastify/cors";

const ADJECTIVES = [
  "quiet", "bold", "swift", "calm", "bright", "soft", "warm", "cool",
  "deep", "flat", "wild", "mild", "dark", "pale", "pure", "rare", "max" ,
];
const NOUNS = [
  "lime", "mint", "sage", "rose", "sky", "sea", "sand", "snow",
  "mist", "dawn", "dusk", "flame", "storm", "wave", "wind", "frost", "tooth"
];

function randomSlug(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 99) + 1;
  return `${adj}-${noun}-${num}`;
}

function randomToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 32; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

const PUBLIC_BASE_URL =
  process.env.WORMKEY_PUBLIC_BASE_URL ?? "http://localhost:3002";
const EDGE_BASE_URL =
  process.env.WORMKEY_EDGE_BASE_URL ?? "ws://localhost:3002";

async function main() {
  const fastify = Fastify({ logger: true });

  fastify.log.info({ PUBLIC_BASE_URL, EDGE_BASE_URL }, "Resolved Wormkey base URLs");

  await fastify.register(cors, { origin: true });

  fastify.get("/", async (_req, reply) => {
    return reply.send({ status: "control plane alive" });
  });

  fastify.get("/health", async (_req, reply) => {
    return reply.send("ok");
  });

  // In-memory session store (v0)
  const sessions = new Map<string, Session>();

  interface Session {
    sessionId: string;
    slug: string;
    sessionToken: string;
    ownerToken: string;
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
    activeViewers: Array<{ id: string; lastSeenAt: string; requests: number; ip?: string }>;
    kickedViewerIds: string[];
    closed: boolean;
    username?: string;
    password?: string;
  }

  fastify.post<{
    Body: { port?: number; authMode?: string; expiresIn?: string };
  }>("/sessions", async (req, reply) => {
    const { port = 3000, authMode = "none", expiresIn = "24h" } = req.body ?? {};

    const slug = randomSlug();
    const ownerToken = randomToken();
    const sessionToken = `${slug}.${ownerToken}`;
    const sessionId = `sess_${randomToken()}`;

    // All URLs derived from env (canonical origin). Never use request host.
    const publicBase = PUBLIC_BASE_URL.replace(/\/$/, "");
    const edgeBase = EDGE_BASE_URL.replace(/\/$/, "");
    const publicUrl = `${publicBase}/s/${slug}`;
    const edgeUrl = `${edgeBase}/tunnel`;
    const ownerUrl = `${publicBase}/.wormkey/owner?slug=${slug}&token=${ownerToken}`;
    const overlayScriptUrl = `${publicBase}/.wormkey/overlay.js?slug=${slug}`;

    const expiresMs =
      expiresIn.endsWith("m")
        ? parseInt(expiresIn, 10) * 60 * 1000
        : expiresIn.endsWith("h")
          ? parseInt(expiresIn, 10) * 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + expiresMs).toISOString();

    const session: Session = {
      sessionId,
      slug,
      sessionToken,
      ownerToken,
      ownerUrl,
      overlayScriptUrl,
      publicUrl,
      edgeUrl,
      expiresAt,
      createdAt: new Date().toISOString(),
      authMode,
      policy: {
        public: true,
        maxConcurrentViewers: 20,
        blockPaths: [],
        password: "",
      },
      activeViewers: [],
      kickedViewerIds: [],
      closed: false,
    };

    if (authMode === "basic") {
      session.username = "worm";
      session.password = randomToken().slice(0, 8);
    }

    sessions.set(sessionId, session);

    return reply.send({
      sessionId: session.sessionId,
      slug: session.slug,
      publicUrl: session.publicUrl,
      ownerUrl: session.ownerUrl,
      overlayScriptUrl: session.overlayScriptUrl,
      edgeUrl: session.edgeUrl,
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
      ...(session.username && { username: session.username }),
      ...(session.password && { password: session.password }),
    });
  });

  fastify.get("/sessions/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = sessions.get(id);
    if (!session) return reply.status(404).send({ error: "Session not found" });
    return session;
  });

  fastify.delete("/sessions/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    sessions.delete(id);
    return reply.send({ ok: true });
  });

  fastify.get("/sessions/by-slug/:slug", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    let found: Session | undefined;
    for (const session of sessions.values()) {
      if (session.slug === slug) {
        found = session;
        break;
      }
    }
    if (!found) return reply.status(404).send({ error: "Session not found" });
    return found;
  });

  fastify.post<{
    Params: { slug: string };
    Body: { public?: boolean; maxConcurrentViewers?: number; blockPaths?: string[]; password?: string };
  }>("/sessions/by-slug/:slug/policy", async (req, reply) => {
    const { slug } = req.params;
    let found: Session | undefined;
    for (const session of sessions.values()) {
      if (session.slug === slug) {
        found = session;
        break;
      }
    }
    if (!found) return reply.status(404).send({ error: "Session not found" });

    if (typeof req.body.public === "boolean") found.policy.public = req.body.public;
    if (typeof req.body.maxConcurrentViewers === "number") {
      found.policy.maxConcurrentViewers = req.body.maxConcurrentViewers;
    }
    if (Array.isArray(req.body.blockPaths)) found.policy.blockPaths = req.body.blockPaths;
    if (typeof req.body.password === "string") found.policy.password = req.body.password;
    return reply.send({ ok: true, policy: found.policy });
  });

  fastify.post<{
    Params: { slug: string };
    Body: { viewers: Array<{ id: string; lastSeenAt: string; requests: number; ip?: string }> };
  }>("/sessions/by-slug/:slug/viewers", async (req, reply) => {
    const { slug } = req.params;
    let found: Session | undefined;
    for (const session of sessions.values()) {
      if (session.slug === slug) {
        found = session;
        break;
      }
    }
    if (!found) return reply.status(404).send({ error: "Session not found" });
    found.activeViewers = req.body.viewers ?? [];
    return reply.send({ ok: true });
  });

  fastify.post<{
    Params: { slug: string };
    Body: { viewerId: string };
  }>("/sessions/by-slug/:slug/kick", async (req, reply) => {
    const { slug } = req.params;
    let found: Session | undefined;
    for (const session of sessions.values()) {
      if (session.slug === slug) {
        found = session;
        break;
      }
    }
    if (!found) return reply.status(404).send({ error: "Session not found" });
    if (req.body.viewerId && !found.kickedViewerIds.includes(req.body.viewerId)) {
      found.kickedViewerIds.push(req.body.viewerId);
    }
    found.activeViewers = found.activeViewers.filter((v) => v.id !== req.body.viewerId);
    return reply.send({ ok: true, kickedViewerIds: found.kickedViewerIds });
  });

  fastify.post<{ Params: { slug: string } }>("/sessions/by-slug/:slug/close", async (req, reply) => {
    const { slug } = req.params;
    let found: Session | undefined;
    for (const session of sessions.values()) {
      if (session.slug === slug) {
        found = session;
        break;
      }
    }
    if (!found) return reply.status(404).send({ error: "Session not found" });
    found.closed = true;
    return reply.send({ ok: true });
  });

  const port = parseInt(process.env.PORT ?? "3001", 10);
  await fastify.listen({ port, host: "0.0.0.0" });
  console.log(`Control plane listening on :${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
