import type {
  Calendar,
  CalendarContent,
  Day,
  EditorCalendar,
  Slot,
} from "../shared/calendar";
import type { Env } from "./env";
import { hashToken, newToken } from "./auth";

type CalendarRow = {
  id: string;
  title: string;
  description: string;
  revision: number;
  updated_at: string;
  share_token: string;
};
type DayRow = { id: string; date: string; manual_order: number };
type SlotRow = {
  id: string;
  day_id: string;
  start_time: string;
  end_time: string;
  title: string;
  description: string;
  location: string;
  url: string;
  color: Slot["color"];
  icon: Slot["icon"];
};

export async function getCalendar(
  db: D1Database,
  kind: "edit" | "share",
  token: string,
): Promise<EditorCalendar | null> {
  const column = kind === "edit" ? "edit_token_hash" : "share_token";
  const key = kind === "edit" ? await hashToken(token) : token;
  const match = `SELECT id FROM calendars WHERE ${column} = ?`;
  const result = await db.batch([
    db
      .prepare(
        `SELECT id, title, description, revision, updated_at, share_token FROM calendars WHERE ${column} = ?`,
      )
      .bind(key),
    db
      .prepare(
        `SELECT id, date, manual_order FROM calendar_days WHERE calendar_id = (${match}) ORDER BY sort_order, date`,
      )
      .bind(key),
    db
      .prepare(
        `SELECT s.* FROM time_slots s JOIN calendar_days d ON d.id = s.day_id WHERE d.calendar_id = (${match}) ORDER BY s.sort_order, s.start_time`,
      )
      .bind(key),
  ]);
  const row = result[0].results[0] as CalendarRow | undefined;
  if (!row) return null;
  const slots = result[2].results as SlotRow[];
  const days: Day[] = (result[1].results as DayRow[]).map((day) => ({
    id: day.id,
    date: day.date,
    manualOrder: Boolean(day.manual_order),
    slots: slots
      .filter((slot) => slot.day_id === day.id)
      .map((slot) => ({
        id: slot.id,
        startTime: slot.start_time,
        endTime: slot.end_time,
        title: slot.title,
        description: slot.description,
        location: slot.location,
        url: slot.url,
        color: slot.color,
        icon: slot.icon,
      })),
  }));
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    revision: row.revision,
    updatedAt: row.updated_at,
    days,
    shareToken: row.share_token,
    shareOrigin: "",
  };
}
export function publicCalendar(calendar: EditorCalendar): Calendar {
  const { id, title, description, revision, updatedAt, days } = calendar;
  return { id, title, description, revision, updatedAt, days };
}
export async function createCalendar(
  env: Env,
  title: string,
  description: string,
) {
  const editToken = newToken();
  const shareToken = newToken();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO calendars (id, title, description, edit_token_hash, share_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      id,
      title,
      description,
      await hashToken(editToken),
      shareToken,
      now,
      now,
    )
    .run();
  return {
    editToken,
    calendar: {
      id,
      title,
      description,
      days: [],
      revision: 1,
      updatedAt: now,
      shareToken,
      shareOrigin: "",
    } satisfies EditorCalendar,
  };
}
// D1 batches are transactional. Every child mutation is guarded by this request's
// nonce, so a stale revision changes neither metadata nor children.
export async function saveCalendar(
  db: D1Database,
  id: string,
  revision: number,
  content: CalendarContent,
) {
  const nonce = crypto.randomUUID();
  const now = new Date().toISOString();
  const days = JSON.stringify(content.days);
  const results = await db.batch([
    db
      .prepare(
        "UPDATE calendars SET title = ?, description = ?, revision = revision + 1, mutation_id = ?, updated_at = ? WHERE id = ? AND revision = ?",
      )
      .bind(content.title, content.description, nonce, now, id, revision),
    db
      .prepare(
        "DELETE FROM calendar_days WHERE calendar_id = ? AND EXISTS (SELECT 1 FROM calendars WHERE id = ? AND mutation_id = ?)",
      )
      .bind(id, id, nonce),
    db
      .prepare(
        `INSERT INTO calendar_days (id, calendar_id, date, sort_order, manual_order)
      SELECT json_extract(d.value, '$.id'), c.id, json_extract(d.value, '$.date'), CAST(d.key AS INTEGER), json_extract(d.value, '$.manualOrder')
      FROM json_each(?) d, calendars c WHERE c.id = ? AND c.mutation_id = ?`,
      )
      .bind(days, id, nonce),
    db
      .prepare(
        `INSERT INTO time_slots (id, day_id, start_time, end_time, title, description, location, url, color, icon, sort_order, created_at, updated_at)
      SELECT json_extract(s.value, '$.id'), json_extract(d.value, '$.id'), json_extract(s.value, '$.startTime'), json_extract(s.value, '$.endTime'),
      json_extract(s.value, '$.title'), json_extract(s.value, '$.description'), json_extract(s.value, '$.location'), json_extract(s.value, '$.url'),
      json_extract(s.value, '$.color'), COALESCE(json_extract(s.value, '$.icon'), ''), CAST(s.key AS INTEGER), ?, ?
      FROM json_each(?) d, json_each(d.value, '$.slots') s, calendars c WHERE c.id = ? AND c.mutation_id = ?`,
      )
      .bind(now, now, days, id, nonce),
  ]);
  return results[0].meta.changes === 1
    ? { revision: revision + 1, updatedAt: now }
    : null;
}
export async function rotateShare(
  db: D1Database,
  id: string,
  revision: number,
) {
  const shareToken = newToken();
  const updatedAt = new Date().toISOString();
  const result = await db
    .prepare(
      "UPDATE calendars SET share_token = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?",
    )
    .bind(shareToken, updatedAt, id, revision)
    .run();
  return result.meta.changes === 1
    ? { shareToken, revision: revision + 1, updatedAt }
    : null;
}
