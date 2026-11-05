import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import worker from "../worker";
import type { Env } from "../worker/env";
import {
  contentSchema,
  moveSlot,
  overlaps,
  slotSchema,
  slotIconDefinition,
  type CalendarContent,
  type EditorCalendar,
  type Slot,
} from "../shared/calendar";
import { hashToken } from "../worker/auth";

const slot = (title: string, startTime = "15:00", endTime = "17:00"): Slot => ({
  id: crypto.randomUUID(),
  title,
  startTime,
  endTime,
  description: "Every lovely detail",
  location: "Our meeting place",
  url: "https://example.com/plan",
  color: "sage",
  icon: "coffee",
});
const req = (
  path: string,
  method = "GET",
  body?: unknown,
  bindings: Env = env,
  origin = "http://localhost:8787",
  headers?: HeadersInit,
) =>
  worker.fetch(
    new Request(`${origin}${path}`, {
      method,
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
    bindings,
  );
const create = async () =>
  (
    await req("/api/calendars", "POST", { title: "A lovely weekend" })
  ).json() as Promise<{ editToken: string; calendar: EditorCalendar }>;
const production: Env = {
  ...env,
  ENVIRONMENT: "production",
  EDITOR_ORIGIN: "https://app.example.com",
  PUBLIC_SHARE_ORIGIN: "https://share.example.com",
  ACCESS_TEAM_DOMAIN: "https://test-team.cloudflareaccess.com",
  ACCESS_AUD: "calendar-audience",
};

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM calendars").run();
});

describe("calendar lifecycle and durable ordering", () => {
  it("creates, saves details, moves, detects conflicts, deletes, and revokes a share link", async () => {
    const { editToken, calendar } = await create();
    expect(editToken).toMatch(/^[\w-]{43}$/);
    const stored = await env.DB.prepare(
      "SELECT edit_token_hash FROM calendars WHERE id = ?",
    )
      .bind(calendar.id)
      .first<{ edit_token_hash: string }>();
    expect(stored?.edit_token_hash).toBe(await hashToken(editToken));
    expect(stored?.edit_token_hash).not.toBe(editToken);
    const a = slot("Coffee");
    const b = slot("Explore", "09:00", "10:00");
    const c = slot("Dinner", "18:00", "19:00");
    const content: CalendarContent = {
      title: "A lovely weekend",
      description: "Made for friends",
      bannerId: null,
      days: [
        {
          id: crypto.randomUUID(),
          date: "2026-11-07",
          manualOrder: false,
          slots: [b, a],
        },
        {
          id: crypto.randomUUID(),
          date: "2026-11-08",
          manualOrder: false,
          slots: [c],
        },
      ],
    };
    const path = `/api/edit/${editToken}`;
    const saved = await req(path, "PUT", { content, revision: 1 });
    expect(saved.status).toBe(200);
    const reopened = (await (await req(path)).json()) as {
      calendar: EditorCalendar;
    };
    expect(reopened.calendar.days[0].slots[1]).toEqual(a);
    const moved = moveSlot(content, a.id, content.days[1].id, 0);
    expect(
      (await req(path, "PUT", { content: moved, revision: 2 })).status,
    ).toBe(200);
    // A stale save must change neither the metadata nor any of the child rows.
    expect(
      (
        await req(path, "PUT", {
          content: { ...content, title: "Stale" },
          revision: 2,
        })
      ).status,
    ).toBe(409);
    const current = (await (await req(path)).json()) as {
      calendar: EditorCalendar;
    };
    expect(current.calendar.title).toBe(content.title);
    expect(current.calendar.days[1].slots.map((item) => item.id)).toEqual([
      a.id,
      c.id,
    ]);
    expect(current.calendar.days[1].slots[0].startTime).toBe("15:00");
    const publicResponse = await req(
      `/api/share/${calendar.shareToken}`,
      "GET",
      undefined,
      production,
      "https://share.example.com",
    );
    expect(publicResponse.status).toBe(200);
    const publicText = await publicResponse.text();
    expect(publicText).toContain('"icon":"coffee"');
    expect(publicText).not.toContain(editToken);
    expect(publicText).not.toContain("shareToken");
    expect(publicText).not.toContain("edit_token_hash");
    expect(publicResponse.headers.get("Cache-Control")).toBe("no-store");
    expect(publicResponse.headers.get("X-Robots-Tag")).toContain("noindex");
    const rotated = (await (
      await req(`${path}/share`, "POST", { revision: 3 })
    ).json()) as { shareToken: string; revision: number };
    expect(rotated.revision).toBe(4);
    expect((await req(`/api/share/${calendar.shareToken}`)).status).toBe(404);
    expect((await req(`/api/share/${rotated.shareToken}`)).status).toBe(200);
    const deleted = {
      ...moved,
      days: [
        {
          ...moved.days[1],
          slots: [
            { ...a, title: "Updated coffee", description: "A new detail" },
          ],
        },
      ],
    };
    expect(
      (await req(path, "PUT", { content: deleted, revision: 4 })).status,
    ).toBe(200);
    const final = (await (await req(path)).json()) as {
      calendar: EditorCalendar;
    };
    expect(final.calendar.days).toHaveLength(1);
    expect(final.calendar.days[0].slots[0].description).toBe("A new detail");
    expect(
      (
        await env.DB.prepare("SELECT COUNT(*) AS count FROM time_slots").first<{
          count: number;
        }>()
      )?.count,
    ).toBe(1);
  });
  it("preserves manual ordering within a day and across dates without changing times", () => {
    const a = slot("One"),
      b = slot("Two");
    const content = {
      title: "Plan",
      description: "",
      bannerId: null,
      days: [
        {
          id: crypto.randomUUID(),
          date: "2026-11-07",
          manualOrder: false,
          slots: [a, b],
        },
        {
          id: crypto.randomUUID(),
          date: "2026-11-08",
          manualOrder: false,
          slots: [],
        },
      ],
    };
    const reordered = moveSlot(content, b.id, content.days[0].id, 0);
    expect(reordered.days[0].slots).toEqual([b, a]);
    expect(reordered.days[0].manualOrder).toBe(true);
    const moved = moveSlot(reordered, b.id, content.days[1].id, 0);
    expect(moved.days[0].slots).toEqual([a]);
    expect(moved.days[1].slots).toEqual([b]);
    expect(overlaps(a, [a, b])).toBe(true);
  });
});

describe("server validation", () => {
  it("rejects invalid dates, times, URLs, duplicate identifiers, and invalid metadata", async () => {
    const { editToken } = await create();
    const a = slot("Plan");
    const content = {
      title: "Plan",
      description: "",
      bannerId: null,
      days: [
        {
          id: crypto.randomUUID(),
          date: "2026-11-07",
          manualOrder: false,
          slots: [a],
        },
      ],
    };
    expect(slotSchema.parse({ ...a, icon: undefined }).icon).toBe("");
    expect(slotSchema.parse({ ...a, icon: "☕" }).icon).toBe("☕");
    expect(slotIconDefinition("☕").value).toBe("coffee");
    expect(slotIconDefinition("coffee").value).toBe("coffee");
    expect(slotSchema.safeParse({ ...a, icon: "<script>" }).success).toBe(
      false,
    );
    const invalid: CalendarContent[] = [
      { ...content, title: " " },
      { ...content, days: [{ ...content.days[0], date: "2026-02-30" }] },
      {
        ...content,
        days: [{ ...content.days[0], slots: [{ ...a, endTime: a.startTime }] }],
      },
      {
        ...content,
        days: [
          { ...content.days[0], slots: [{ ...a, url: "javascript:alert(1)" }] },
        ],
      },
      { ...content, days: [{ ...content.days[0], slots: [a, a] }] },
      {
        ...content,
        days: [
          content.days[0],
          { ...content.days[0], id: crypto.randomUUID() },
        ],
      },
    ];
    for (const value of invalid)
      expect(
        (
          await req(`/api/edit/${editToken}`, "PUT", {
            content: value,
            revision: 1,
          })
        ).status,
      ).toBe(400);
    expect(contentSchema.safeParse(content).success).toBe(true);
    expect(
      (await req("/api/calendars", "POST", { title: "X".repeat(121) })).status,
    ).toBe(400);
  });
});

describe("independent Access, hostname, edit-token, and read-only permissions", () => {
  it("fails closed for unauthenticated editor routes, write APIs, wrong hostnames, and nonlocal development", async () => {
    const { editToken, calendar } = await create();
    for (const path of [
      "/",
      `/edit/${editToken}`,
      `/api/edit/${editToken}`,
      "/api/calendars",
    ]) {
      expect(
        (
          await req(
            path,
            path === "/api/calendars" ? "POST" : "GET",
            undefined,
            production,
            "https://app.example.com",
          )
        ).status,
      ).toBe(401);
    }
    expect(
      (
        await req(
          `/api/edit/${editToken}`,
          "PUT",
          {},
          production,
          "https://share.example.com",
        )
      ).status,
    ).toBe(404);
    expect(
      (await req(`/api/share/${calendar.shareToken}`, "POST")).status,
    ).toBe(405);
    expect(
      (
        await req(
          "/api/calendars",
          "POST",
          { title: "Plan" },
          env,
          "https://remote.example.com",
        )
      ).status,
    ).toBe(503);
    expect(
      (
        await req(
          "/api/calendars",
          "POST",
          { title: "Plan" },
          { ...env, ENVIRONMENT: "production" },
        )
      ).status,
    ).toBe(503);
    const noOrigin = new Request("http://localhost:8787/api/calendars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"title":"Plan"}',
    });
    expect((await worker.fetch(noOrigin, env)).status).toBe(403);
  });
  it("verifies signed JWT issuer/audience/expiry and independently checks the edit token", async () => {
    const { editToken, calendar } = await create();
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const jwk = {
      ...(await exportJWK(publicKey)),
      kid: "test-key",
      alg: "RS256",
      use: "sig",
    };
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ keys: [jwk] }));
    const jwt = (
      audience = production.ACCESS_AUD!,
      expiry = "1h",
      issuer = production.ACCESS_TEAM_DOMAIN!,
    ) =>
      new SignJWT({})
        .setProtectedHeader({ alg: "RS256", kid: "test-key" })
        .setIssuer(issuer)
        .setAudience(audience)
        .setSubject("test-user")
        .setIssuedAt()
        .setExpirationTime(expiry)
        .sign(privateKey);
    try {
      const valid = await jwt();
      const withJwt = async (token: string, edit = editToken) =>
        req(
          `/api/edit/${edit}`,
          "GET",
          undefined,
          production,
          "https://app.example.com",
          { "Cf-Access-Jwt-Assertion": token },
        );
      expect((await withJwt(valid)).status).toBe(200);
      expect((await withJwt(valid, calendar.shareToken)).status).toBe(404);
      expect((await withJwt(await jwt("another-audience"))).status).toBe(401);
      expect((await withJwt(await jwt(undefined, "-1s"))).status).toBe(401);
      expect(
        (
          await withJwt(
            await jwt(undefined, "1h", "https://other.cloudflareaccess.com"),
          )
        ).status,
      ).toBe(401);
      expect((await withJwt(`${valid.slice(0, -12)}tamperedxxxx`)).status).toBe(
        401,
      );
      expect(
        (
          await req(
            `/api/edit/${editToken}`,
            "PUT",
            {},
            production,
            "https://app.example.com",
            {
              "Cf-Access-Jwt-Assertion": valid,
              Origin: "https://evil.example.com",
            },
          )
        ).status,
      ).toBe(403);
    } finally {
      fetch.mockRestore();
    }
  });
  it("rate limits public reads and creation without revealing data", async () => {
    const limitedEnv: Env = {
      ...env,
      READ_LIMITER: { limit: async () => ({ success: false }) },
      CREATE_LIMITER: { limit: async () => ({ success: false }) },
    };
    const limited = await req(
      `/api/share/${"a".repeat(43)}`,
      "GET",
      undefined,
      limitedEnv,
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");
    expect(
      (await req("/api/calendars", "POST", { title: "Plan" }, limitedEnv))
        .status,
    ).toBe(429);
  });
});
