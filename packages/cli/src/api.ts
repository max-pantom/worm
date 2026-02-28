/**
 * Control Plane API client
 */

export interface CreateSessionResponse {
  sessionId: string;
  slug: string;
  publicUrl: string;
  ownerUrl: string;
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
