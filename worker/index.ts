import { z } from "zod";
import { bannerBelongsTo, bannerResponse, readBanner } from "./banners";
import { createSchema, updateSchema } from "../shared/calendar";
import type { Env } from "./env";
import {
  HttpError,
  isLocal,
  origins,
  requireAccess,
  requireSameOrigin,
  validToken,
} from "./auth";
import {
  createCalendar,
  getCalendar,
  publicCalendar,
  rotateShare,
  saveCalendar,
} from "./store";

const json = (value: unknown, status = 200) => Response.json(value, { status });
const MAX_BODY = 1_048_576;
async function readJson(request: Request) {
  if (Number(request.headers.get("Content-Length")) > MAX_BODY)
    throw new HttpError(
      413,
      "This calendar is too large. Shorten some details.",
    );
  if (!request.body) throw new HttpError(400, "A JSON body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY) {
      await reader.cancel();
      throw new HttpError(
        413,
        "This calendar is too large. Shorten some details.",
      );
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
}
async function limited(request: Request, limiter: Env["READ_LIMITER"]) {
  if (!limiter) return;
  const { success } = await limiter.limit({
    key: request.headers.get("CF-Connecting-IP") ?? "unknown",
  });
  if (!success)
    throw new HttpError(
      429,
      "A few too many requests. Please try again in a minute.",
    );
}
function secure(response: Response, mapsEnabled = false) {
  const result = new Response(response.body, response);
  result.headers.set("Cache-Control", "no-store");
  result.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  // Google key restrictions need the origin; private edit paths are never sent.
  result.headers.set("Referrer-Policy", "strict-origin");
  result.headers.set("X-Content-Type-Options", "nosniff");
  result.headers.set("X-Frame-Options", "DENY");
  result.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  result.headers.set(
    "Content-Security-Policy",
    mapsEnabled
      ? "default-src 'self'; script-src 'self' https://maps.googleapis.com https://maps.gstatic.com 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com; frame-src https://*.google.com; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  );
  if (result.status === 429) result.headers.set("Retry-After", "60");
  return result;
}
async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const { editor, share } = origins(request, env);
  const local = isLocal(request, env);
  if (!local && url.origin !== editor && url.origin !== share)
    throw new HttpError(404, "Not found.");
  const publicMatch =
    /^\/api\/share\/([A-Za-z0-9_-]+)(?:\/banner\/([0-9a-f-]{36}))?$/.exec(
      url.pathname,
    );
  const isPublicApi = Boolean(publicMatch);
  const isConfig = url.pathname === "/api/config";
  const isPublicPage = /^\/s\/[A-Za-z0-9_-]+\/?$/.test(url.pathname);
  const isAsset =
    url.pathname.startsWith("/assets/") || url.pathname === "/favicon.svg";
  if (
    !local &&
    url.origin === share &&
    !isPublicApi &&
    !isConfig &&
    !isPublicPage &&
    !isAsset &&
    url.pathname !== "/robots.txt"
  )
    throw new HttpError(404, "This hostname only serves shared calendars.");
  if (url.pathname === "/robots.txt")
    return new Response("User-agent: *\nDisallow: /\n", {
      headers: { "Content-Type": "text/plain" },
    });
  if (isConfig) {
    if (request.method !== "GET")
      throw new HttpError(405, "Method not allowed.");
    return json({
      googleMapsKey: env.GOOGLE_MAPS_BROWSER_KEY || null,
      googleMapsMapId: env.GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
    });
  }
  if (isPublicApi) {
    if (request.method !== "GET")
      throw new HttpError(405, "Shared calendars are read-only.");
    if (!local && url.origin !== share)
      throw new HttpError(404, "Use the public share hostname.");
    await limited(request, env.READ_LIMITER);
    const token = publicMatch![1];
    if (!validToken(token))
      throw new HttpError(404, "This share link is unavailable.");
    const calendar = await getCalendar(env.DB, "share", token);
    if (!calendar)
      throw new HttpError(
        404,
        "This share link is unavailable. It may have been replaced.",
      );
    if (publicMatch![2]) {
      if (calendar.bannerId !== publicMatch![2])
        throw new HttpError(404, "Banner not found.");
      return bannerResponse(env.DB, calendar.id, publicMatch![2]);
    }
    return json({ calendar: publicCalendar(calendar) });
  }
  if (isPublicPage && !local && url.origin !== share)
    throw new HttpError(404, "Use the public share hostname.");
  if (!isPublicPage && !isAsset) await requireAccess(request, env);
  if (url.pathname.startsWith("/api/")) {
    if (request.method !== "GET")
      requireSameOrigin(
        request,
        request.method === "POST" && url.pathname.endsWith("/banner")
          ? "image/jpeg"
          : "application/json",
      );
    if (url.pathname === "/api/calendars" && request.method === "POST") {
      await limited(request, env.CREATE_LIMITER);
      const input = createSchema.parse(await readJson(request));
      const result = await createCalendar(env, input.title, input.description);
      result.calendar.shareOrigin = share;
      return json(result, 201);
    }
    const match =
      /^\/api\/edit\/([A-Za-z0-9_-]+)(\/share|\/banner(?:\/[0-9a-f-]{36})?)?$/.exec(
        url.pathname,
      );
    if (!match || !validToken(match[1]))
      throw new HttpError(404, "Calendar not found.");
    const calendar = await getCalendar(env.DB, "edit", match[1]);
    if (!calendar)
      throw new HttpError(404, "This private calendar link is unavailable.");
    calendar.shareOrigin = share;
    if (match[2] === "/banner" && request.method === "POST") {
      await limited(request, env.CREATE_LIMITER);
      const image = await readBanner(request);
      const bannerId = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO calendar_banners (id, calendar_id, image, created_at) VALUES (?, ?, ?, ?)",
      )
        .bind(bannerId, calendar.id, image, new Date().toISOString())
        .run();
      return json({ bannerId }, 201);
    }
    if (match[2]?.startsWith("/banner/") && request.method === "GET")
      return bannerResponse(
        env.DB,
        calendar.id,
        match[2].slice("/banner/".length),
      );
    if (!match[2] && request.method === "GET") return json({ calendar });
    if (!match[2] && request.method === "PUT") {
      const input = updateSchema.parse(await readJson(request));
      if (
        input.content.bannerId &&
        !(await bannerBelongsTo(env.DB, calendar.id, input.content.bannerId))
      )
        throw new HttpError(400, "Choose a banner uploaded to this calendar.");
      const result = await saveCalendar(
        env.DB,
        calendar.id,
        input.revision,
        input.content,
      );
      if (!result)
        return json(
          {
            error:
              "This calendar changed in another tab. Your draft is still here.",
            calendar: {
              ...(await getCalendar(env.DB, "edit", match[1])),
              shareOrigin: share,
            },
          },
          409,
        );
      return json(result);
    }
    if (match[2] && request.method === "POST") {
      const input = z
        .object({ revision: z.number().int().positive() })
        .strict()
        .parse(await readJson(request));
      const result = await rotateShare(env.DB, calendar.id, input.revision);
      if (!result)
        return json(
          {
            error:
              "This calendar changed in another tab. Reload before replacing the link.",
          },
          409,
        );
      return json(result);
    }
    throw new HttpError(405, "Method not allowed.");
  }
  if (!["GET", "HEAD"].includes(request.method))
    throw new HttpError(405, "Method not allowed.");
  if (
    !isAsset &&
    !isPublicPage &&
    url.pathname !== "/" &&
    !/^\/edit\/[A-Za-z0-9_-]{43}\/?$/.test(url.pathname)
  )
    throw new HttpError(404, "Page not found.");
  return env.ASSETS.fetch(request);
}
export default {
  async fetch(request: Request, env: Env) {
    const respond = (response: Response) =>
      secure(response, Boolean(env.GOOGLE_MAPS_BROWSER_KEY));
    try {
      return respond(await route(request, env));
    } catch (error) {
      if (error instanceof z.ZodError)
        return respond(
          json(
            {
              error: error.issues[0]?.message ?? "Check your calendar details.",
            },
            400,
          ),
        );
      if (error instanceof HttpError)
        return respond(json({ error: error.message }, error.status));
      // Deliberately omit request URLs and error messages: tokens belong in neither logs nor public responses.
      console.error("Calendar request failed.");
      return respond(
        json(
          { error: "We could not complete that request. Please try again." },
          500,
        ),
      );
    }
  },
} satisfies ExportedHandler<Env>;
