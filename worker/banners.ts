import { HttpError } from "./auth";

export const MAX_BANNER_BYTES = 750_000;
export async function readBanner(request: Request): Promise<Uint8Array> {
  if (Number(request.headers.get("Content-Length")) > MAX_BANNER_BYTES)
    throw new HttpError(
      413,
      "The banner is too large. Choose a smaller image.",
    );
  if (!request.body) throw new HttpError(400, "Choose a banner image.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  const reader = request.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BANNER_BYTES) {
      await reader.cancel();
      throw new HttpError(
        413,
        "The banner is too large. Choose a smaller image.",
      );
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (!validBannerJpeg(bytes))
    throw new HttpError(
      400,
      "Use a valid JPEG banner no larger than 2000 × 1000 pixels.",
    );
  return bytes;
}
// Read JPEG frame dimensions rather than trusting a MIME header or extension.
export function validBannerJpeg(bytes: Uint8Array): boolean {
  if (
    bytes.length < 16 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes.at(-2) !== 0xff ||
    bytes.at(-1) !== 0xd9
  )
    return false;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset++] !== 0xff) return false;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) return false;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return false;
    const size = (bytes[offset] << 8) | bytes[offset + 1];
    if (size < 2 || offset + size > bytes.length) return false;
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (size < 8) return false;
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return width > 0 && width <= 2000 && height > 0 && height <= 1000;
    }
    offset += size;
  }
  return false;
}
export async function bannerBelongsTo(
  db: D1Database,
  calendarId: string,
  bannerId: string,
) {
  return Boolean(
    await db
      .prepare(
        "SELECT id FROM calendar_banners WHERE id = ? AND calendar_id = ?",
      )
      .bind(bannerId, calendarId)
      .first(),
  );
}
export async function bannerResponse(
  db: D1Database,
  calendarId: string,
  bannerId: string,
) {
  const row = await db
    .prepare(
      "SELECT image FROM calendar_banners WHERE calendar_id = ? AND id = ?",
    )
    .bind(calendarId, bannerId)
    .first<{ image: ArrayBuffer }>();
  if (!row) throw new HttpError(404, "Banner not found.");
  return new Response(new Uint8Array(row.image), {
    headers: { "Content-Type": "image/jpeg" },
  });
}
