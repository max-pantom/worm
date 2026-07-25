import assert from "node:assert/strict";
import { after, before, test } from "node:test";

process.env.NODE_ENV = "test";
process.env.WORMKEY_INTERNAL_API_KEY = "test-internal-key";

const { buildApp } = await import("../src/index.js");
const app = buildApp();
let session: {
  sessionId: string;
  slug: string;
  ownerToken: string;
  sessionToken: string;
};

before(async () => {
  await app.ready();
  const response = await app.inject({
    method: "POST",
    url: "/sessions",
    payload: { expiresIn: "1h" },
  });
  assert.equal(response.statusCode, 201);
  session = response.json();
});

after(async () => {
  await app.close();
});

test("public session status excludes credentials and viewer details", async () => {
  const response = await app.inject({
    method: "GET",
    url: `/sessions/by-slug/${session.slug}`,
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.slug, session.slug);
  assert.equal("ownerToken" in body, false);
  assert.equal("sessionToken" in body, false);
  assert.equal("ownerUrl" in body, false);
  assert.equal("activeViewers" in body, false);
  assert.equal("policy" in body, false);
});

test("owner session routes require the owner bearer token", async () => {
  const unauthorized = await app.inject({
    method: "GET",
    url: `/sessions/${session.sessionId}`,
  });
  assert.equal(unauthorized.statusCode, 401);

  const authorized = await app.inject({
    method: "GET",
    url: `/sessions/${session.sessionId}`,
    headers: { authorization: `Bearer ${session.ownerToken}` },
  });
  assert.equal(authorized.statusCode, 200);
  assert.equal(authorized.json().slug, session.slug);
});

test("owner mutations reject missing credentials", async () => {
  const response = await app.inject({
    method: "POST",
    url: `/owner/sessions/by-slug/${session.slug}/close`,
  });
  assert.equal(response.statusCode, 401);
});

test("internal routes require the shared service key", async () => {
  const unauthorized = await app.inject({
    method: "POST",
    url: "/internal/sessions/validate",
    payload: { sessionToken: session.sessionToken },
  });
  assert.equal(unauthorized.statusCode, 401);

  const authorized = await app.inject({
    method: "POST",
    url: "/internal/sessions/validate",
    headers: { authorization: "Bearer test-internal-key" },
    payload: { sessionToken: session.sessionToken },
  });
  assert.equal(authorized.statusCode, 200);
  assert.equal(authorized.json().slug, session.slug);
});

test("invalid tunnel credentials are rejected", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/internal/sessions/validate",
    headers: { authorization: "Bearer test-internal-key" },
    payload: { sessionToken: `${session.slug}.invalid` },
  });
  assert.equal(response.statusCode, 401);
});

test("owner can create a scoped tunnel token", async () => {
  const created = await app.inject({
    method: "POST",
    url: `/owner/sessions/${session.sessionId}/tokens`,
    headers: { authorization: `Bearer ${session.ownerToken}` },
    payload: { name: "codex-preview", scopes: ["tunnel:connect", "tunnel:read"], maxTtl: "2h" },
  });
  assert.equal(created.statusCode, 201);
  const token = created.json().token as string;

  const validated = await app.inject({
    method: "POST",
    url: "/internal/sessions/validate",
    headers: { authorization: "Bearer test-internal-key" },
    payload: { sessionToken: token },
  });
  assert.equal(validated.statusCode, 200);
});
