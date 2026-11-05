import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Env } from "./env";

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function isLocal(request: Request, env: Env) {
  return (
    env.ENVIRONMENT === "development" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname)
  );
}
export function origins(request: Request, env: Env) {
  const origin = new URL(request.url).origin;
  if (isLocal(request, env)) return { editor: origin, share: origin };
  if (
    env.ENVIRONMENT !== "production" ||
    !env.EDITOR_ORIGIN ||
    !env.PUBLIC_SHARE_ORIGIN ||
    !env.ACCESS_TEAM_DOMAIN ||
    !env.ACCESS_AUD
  ) {
    throw new HttpError(
      503,
      "The editor is not configured. Complete the Cloudflare Access and hostname setup.",
    );
  }
  const editor = new URL(env.EDITOR_ORIGIN);
  const share = new URL(env.PUBLIC_SHARE_ORIGIN);
  const team = new URL(env.ACCESS_TEAM_DOMAIN);
  if (
    editor.protocol !== "https:" ||
    share.protocol !== "https:" ||
    editor.origin === share.origin ||
    !team.hostname.endsWith(".cloudflareaccess.com") ||
    team.protocol !== "https:" ||
    team.pathname !== "/" ||
    team.username ||
    team.password
  ) {
    throw new HttpError(503, "Invalid deployment configuration.");
  }
  return { editor: editor.origin, share: share.origin };
}
export async function requireAccess(request: Request, env: Env) {
  if (isLocal(request, env)) return;
  const { editor } = origins(request, env);
  if (new URL(request.url).origin !== editor)
    throw new HttpError(
      403,
      "Editing is only available on the private editor hostname.",
    );
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token)
    throw new HttpError(
      401,
      "Sign in through Cloudflare Access to open the editor.",
    );
  const issuer = new URL(env.ACCESS_TEAM_DOMAIN!).origin;
  let keys = keySets.get(issuer);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    keySets.set(issuer, keys);
  }
  try {
    await jwtVerify(token, keys, {
      issuer,
      audience: env.ACCESS_AUD,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "sub"],
    });
  } catch {
    throw new HttpError(
      401,
      "Your Access session could not be verified. Sign in again.",
    );
  }
}
export async function hashToken(token: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
export const validToken = (value: string) => /^[A-Za-z0-9_-]{43}$/.test(value);
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  if (
    !origin ||
    origin !== new URL(request.url).origin ||
    request.headers.get("Sec-Fetch-Site") === "cross-site"
  ) {
    throw new HttpError(403, "Use the calendar editor to make changes.");
  }
  if (
    request.method !== "DELETE" &&
    !request.headers
      .get("Content-Type")
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    throw new HttpError(415, "Send application/json.");
  }
}
