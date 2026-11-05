import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import worker from "../worker";
import { contentOf, type EditorCalendar, type Slot } from "../shared/calendar";
import { calendarPlaces, googleMapsLink } from "../shared/locations";
import { validBannerJpeg } from "../worker/banners";
const origin = "http://localhost:8787";
const request = (path: string, method = "GET", value?: unknown) =>
  worker.fetch(
    new Request(origin + path, {
      method,
      headers: { Origin: origin, "Content-Type": "application/json" },
      ...(value !== undefined ? { body: JSON.stringify(value) } : {}),
    }),
    env,
  );
const create = async () =>
  (
    await request("/api/calendars", "POST", { title: "Banner and map" })
  ).json() as Promise<{ editToken: string; calendar: EditorCalendar }>;
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM calendars").run();
});
describe("calendar cover image", () => {
  it("validates uploads, authorizes images, saves the banner and revokes public images with their link", async () => {
    const owner = await create(),
      other = await create();
    const jpeg = Uint8Array.from(atob(env.TEST_BANNER), (char) =>
      char.charCodeAt(0),
    );
    expect(validBannerJpeg(jpeg)).toBe(true);
    expect(validBannerJpeg(new TextEncoder().encode("<svg/>"))).toBe(false);
    const uploadPath = `/api/edit/${owner.editToken}/banner`;
    const upload = (
      type: string,
      bytes: Uint8Array,
      extra: Record<string, string> = {},
    ) =>
      worker.fetch(
        new Request(origin + uploadPath, {
          method: "POST",
          headers: { Origin: origin, "Content-Type": type, ...extra },
          body: new Uint8Array(bytes).buffer,
        }),
        env,
      );
    expect(
      (await upload("image/svg+xml", new TextEncoder().encode("<svg/>")))
        .status,
    ).toBe(415);
    expect(
      (await upload("image/jpeg", new TextEncoder().encode("not a jpeg")))
        .status,
    ).toBe(400);
    expect(
      (await upload("image/jpeg", jpeg, { "Content-Length": "750001" })).status,
    ).toBe(413);
    expect(
      (await upload("image/jpeg", jpeg, { Origin: "https://evil.example.com" }))
        .status,
    ).toBe(403);
    const uploaded = await upload("image/jpeg", jpeg);
    expect(uploaded.status).toBe(201);
    const { bannerId } = (await uploaded.json()) as { bannerId: string };
    const privateImage = `${uploadPath}/${bannerId}`;
    expect((await request(privateImage)).headers.get("Content-Type")).toBe(
      "image/jpeg",
    );
    expect(
      (await request(`/api/edit/${other.editToken}/banner/${bannerId}`)).status,
    ).toBe(404);
    const publicImage = `/api/share/${owner.calendar.shareToken}/banner/${bannerId}`;
    expect((await request(publicImage)).status).toBe(404); // Uploads are private until autosaved.
    const content = { ...contentOf(owner.calendar), bannerId };
    expect(
      (
        await request(`/api/edit/${other.editToken}`, "PUT", {
          content,
          revision: 1,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(`/api/edit/${owner.editToken}`, "PUT", {
          content,
          revision: 1,
        })
      ).status,
    ).toBe(200);
    const publishedImage = await request(publicImage);
    expect(publishedImage.status).toBe(200);
    expect(new Uint8Array(await publishedImage.arrayBuffer())).toEqual(jpeg);
    expect(publishedImage.headers.get("Cache-Control")).toBe("no-store");
    const reopened = (await (
      await request(`/api/edit/${owner.editToken}`)
    ).json()) as { calendar: EditorCalendar };
    expect(reopened.calendar.bannerId).toBe(bannerId);
    expect(
      (
        await request(`/api/edit/${owner.editToken}`, "PUT", {
          content: { ...content, bannerId: null },
          revision: 1,
        })
      ).status,
    ).toBe(409);
    expect((await request(publicImage)).status).toBe(200);
    const rotated = (await (
      await request(`/api/edit/${owner.editToken}/share`, "POST", {
        revision: 2,
      })
    ).json()) as { shareToken: string };
    expect((await request(publicImage)).status).toBe(404);
    const rotatedImage = `/api/share/${rotated.shareToken}/banner/${bannerId}`;
    expect((await request(rotatedImage)).status).toBe(200);
    expect(
      (
        await request(`/api/edit/${owner.editToken}`, "PUT", {
          content: { ...content, bannerId: null },
          revision: 3,
        })
      ).status,
    ).toBe(200);
    expect((await request(rotatedImage)).status).toBe(404);
    const protectedEnv = {
      ...env,
      ENVIRONMENT: "production" as const,
      EDITOR_ORIGIN: "https://cl-edit.d.htd.ink",
      PUBLIC_SHARE_ORIGIN: "https://cl.d.htd.ink",
      ACCESS_TEAM_DOMAIN: "https://test.cloudflareaccess.com",
      ACCESS_AUD: "test",
    };
    const unauthenticated = await worker.fetch(
      new Request(`https://cl-edit.d.htd.ink${uploadPath}`, {
        method: "POST",
        headers: {
          Origin: "https://cl-edit.d.htd.ink",
          "Content-Type": "image/jpeg",
        },
        body: jpeg,
      }),
      protectedEnv,
    );
    expect(unauthenticated.status).toBe(401);
  });
});
describe("calendar locations and optional Google Maps setup", () => {
  it("groups every location once while preserving all stops and safely creates map links", async () => {
    const owner = await create();
    const slot = (title: string, location: string): Slot => ({
      id: crypto.randomUUID(),
      title,
      location,
      description: "",
      startTime: "15:00",
      endTime: "17:00",
      url: "",
      color: "sage",
      icon: "coffee",
    });
    const content = {
      ...contentOf(owner.calendar),
      days: [
        {
          id: crypto.randomUUID(),
          date: "2026-11-07",
          manualOrder: false,
          slots: [
            slot("First stop", "  Louvre Museum,   Paris "),
            slot("Return visit", "louvre museum, paris"),
            slot("Dinner", "Café de Flore, Paris"),
            slot("Free time", " "),
          ],
        },
      ],
    };
    const places = calendarPlaces(content);
    expect(places).toHaveLength(2);
    expect(places[0].stops.map((stop) => stop.title)).toEqual([
      "First stop",
      "Return visit",
    ]);
    expect(places.map((place) => place.number)).toEqual([1, 2]);
    expect(
      new URL(googleMapsLink("a & b # test")).searchParams.get("query"),
    ).toBe("a & b # test");
    const config = (await (
      await worker.fetch(new Request(origin + "/api/config"), {
        ...env,
        GOOGLE_MAPS_BROWSER_KEY: undefined,
      })
    ).json()) as {
      googleMapsKey: string | null;
    };
    expect(config.googleMapsKey).toBe(null);
    const publicConfig = await worker.fetch(
      new Request(origin + "/api/config"),
      {
        ...env,
        GOOGLE_MAPS_BROWSER_KEY: "restricted-browser-test-key",
        ACCESS_AUD: "private-access-audience",
      },
    );
    const text = await publicConfig.text();
    expect(text).toContain("restricted-browser-test-key");
    expect(text).not.toContain("private-access-audience");
    expect((await request("/api/config", "POST", {})).status).toBe(405);
  });
});
