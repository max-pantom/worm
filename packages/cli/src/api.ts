/**
 * Control Plane API client
 */

export interface CreateSessionResponse {
  sessionId: string;
  slug: string;
  publicUrl: string;
  ownerUrl: string;
  ownerToken: string;
  overlayScriptUrl: string;
  edgeUrl: string;
  sessionToken: string;
  expiresAt: string;
  username?: string;
  password?: string;
}

export async function createSession(
  controlPlaneUrl: string,
  options: { port: number; auth?: boolean; expires?: string }
): Promise<CreateSessionResponse> {
  const res = await fetch(`${controlPlaneUrl}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      port: options.port,
      authMode: options.auth ? "basic" : "none",
      expiresIn: options.expires ?? "24h",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Session creation failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<CreateSessionResponse>;
}

export async function getOwnerSession(controlPlaneUrl: string, slug: string, ownerToken: string) {
  const response = await fetch(`${controlPlaneUrl.replace(/\/$/, "")}/owner/sessions/by-slug/${slug}`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  if (!response.ok) throw new Error(`Session lookup failed: ${response.status} ${await response.text()}`);
  return response.json() as Promise<Record<string, unknown>>;
}

export async function closeSession(controlPlaneUrl: string, slug: string, ownerToken: string): Promise<void> {
  const response = await fetch(`${controlPlaneUrl.replace(/\/$/, "")}/owner/sessions/by-slug/${slug}/close`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  if (!response.ok) throw new Error(`Session close failed: ${response.status} ${await response.text()}`);
}

export async function updateSessionPolicy(
  controlPlaneUrl: string,
  slug: string,
  ownerToken: string,
  policy: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(`${controlPlaneUrl.replace(/\/$/, "")}/owner/sessions/by-slug/${slug}/policy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(policy),
  });
  if (!response.ok) throw new Error(`Policy update failed: ${response.status} ${await response.text()}`);
}

export async function createScopedToken(
  controlPlaneUrl: string,
  sessionId: string,
  ownerToken: string,
  options: { name: string; scopes: string[]; maxTtl: string },
) {
  const response = await fetch(`${controlPlaneUrl.replace(/\/$/, "")}/owner/sessions/${sessionId}/tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });
  if (!response.ok) throw new Error(`Token creation failed: ${response.status} ${await response.text()}`);
  return response.json() as Promise<{ token: string; name: string; scopes: string[]; expiresAt: string }>;
}
