import { z } from "zod";

export const colors = [
  "sage",
  "lavender",
  "peach",
  "sky",
  "rose",
  "sand",
] as const;
export type SlotColor = (typeof colors)[number];
export const colorLabels: Record<SlotColor, string> = {
  sage: "Sage",
  lavender: "Lavender",
  peach: "Peach",
  sky: "Sky",
  rose: "Rose",
  sand: "Sand",
};
// Stable identifiers keep the same artwork on every device and in exports.
export const slotIcons = [
  { value: "", label: "No icon" },
  { value: "coffee", label: "Coffee" },
  { value: "meal", label: "Meal" },
  { value: "meeting", label: "Meeting" },
  { value: "work", label: "Work" },
  { value: "call", label: "Call" },
  { value: "study", label: "Study" },
  { value: "exercise", label: "Exercise" },
  { value: "walk", label: "Walk" },
  { value: "travel", label: "Travel" },
  { value: "home", label: "Home" },
  { value: "birthday", label: "Birthday" },
  { value: "shopping", label: "Shopping" },
  { value: "health", label: "Health" },
  { value: "creative", label: "Creative" },
  { value: "rest", label: "Rest" },
  { value: "reminder", label: "Reminder" },
] as const;
export type SlotIconName = (typeof slotIcons)[number]["value"];
// Earlier saved emoji choices remain valid and use the closest themed artwork.
const legacySlotIcons: Record<string, SlotIconName> = {
  "☕": "coffee",
  "🍽️": "meal",
  "🍰": "meal",
  "🥂": "meal",
  "🎉": "birthday",
  "🎂": "birthday",
  "❤️": "health",
  "👋": "meeting",
  "💼": "work",
  "💻": "work",
  "📞": "call",
  "📚": "study",
  "✏️": "study",
  "🎨": "creative",
  "🎵": "creative",
  "🎬": "creative",
  "🎮": "rest",
  "🛍️": "shopping",
  "📸": "creative",
  "🚶": "walk",
  "🏃": "exercise",
  "🚲": "exercise",
  "🏋️": "exercise",
  "🧘": "rest",
  "🌳": "walk",
  "🏖️": "rest",
  "✨": "reminder",
  "✈️": "travel",
  "🚆": "travel",
  "🚗": "travel",
  "🏠": "home",
};
export function slotIconDefinition(value: string) {
  const name = legacySlotIcons[value] ?? value;
  return slotIcons.find((icon) => icon.value === name) ?? slotIcons[0];
}
export const slotIconLabel = (value: string) => slotIconDefinition(value).label;
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T12:00:00Z`);
    return (
      !Number.isNaN(parsed.valueOf()) &&
      parsed.toISOString().slice(0, 10) === value &&
      value >= "1900-01-01" &&
      value <= "2200-12-31"
    );
  }, "Choose a valid date between 1900 and 2200.");
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a valid time.");
export const slotSchema = z
  .object({
    id: z.string().uuid(),
    startTime: time,
    endTime: time,
    title: z.string().trim().min(1, "Give this slot a title.").max(120),
    description: z.string().trim().max(2000),
    location: z.string().trim().max(200),
    url: z
      .string()
      .trim()
      .max(2000)
      .refine((value) => {
        if (!value) return true;
        try {
          const url = new URL(value);
          return (
            ["https:", "http:"].includes(url.protocol) &&
            !url.username &&
            !url.password
          );
        } catch {
          return false;
        }
      }, "Use a complete http:// or https:// link without credentials."),
    color: z.enum(colors),
    icon: z
      .enum([
        ...slotIcons.map((icon) => icon.value),
        ...Object.keys(legacySlotIcons),
      ])
      .default(""),
  })
  .strict()
  .refine((slot) => slot.endTime > slot.startTime, {
    message: "End time must be after start time (on the same day).",
    path: ["endTime"],
  });
export const daySchema = z
  .object({
    id: z.string().uuid(),
    date,
    manualOrder: z.boolean(),
    slots: z.array(slotSchema).max(100),
  })
  .strict();
export const contentSchema = z
  .object({
    title: z.string().trim().min(1, "Give your calendar a title.").max(120),
    description: z.string().trim().max(1000),
    days: z.array(daySchema).max(60),
  })
  .strict()
  .superRefine((value, ctx) => {
    const ids = value.days.flatMap((day) => [
      day.id,
      ...day.slots.map((slot) => slot.id),
    ]);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        message: "Day and slot identifiers must be unique.",
      });
    if (new Set(value.days.map((day) => day.date)).size !== value.days.length)
      ctx.addIssue({
        code: "custom",
        message: "Each date can only be added once.",
      });
    if (value.days.reduce((sum, day) => sum + day.slots.length, 0) > 500)
      ctx.addIssue({
        code: "custom",
        message: "A calendar can have at most 500 slots.",
      });
  });
export const updateSchema = z
  .object({ content: contentSchema, revision: z.number().int().positive() })
  .strict();
export const createSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000).default(""),
  })
  .strict();
export type Slot = z.infer<typeof slotSchema>;
export type Day = z.infer<typeof daySchema>;
export type CalendarContent = z.infer<typeof contentSchema>;
export type Calendar = CalendarContent & {
  id: string;
  revision: number;
  updatedAt: string;
};
export type EditorCalendar = Calendar & {
  shareToken: string;
  shareOrigin: string;
};
export const contentOf = ({
  title,
  description,
  days,
}: CalendarContent): CalendarContent => ({ title, description, days });
export const byTime = (a: Slot, b: Slot) =>
  a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime);
export function moveSlot(
  content: CalendarContent,
  slotId: string,
  targetDayId: string,
  targetIndex: number,
): CalendarContent {
  const source = content.days.find((day) =>
    day.slots.some((slot) => slot.id === slotId),
  );
  const target = content.days.find((day) => day.id === targetDayId);
  const slot = source?.slots.find((slot) => slot.id === slotId);
  if (!source || !target || !slot) return content;
  return {
    ...content,
    days: content.days.map((day) => {
      if (day.id !== source.id && day.id !== targetDayId) return day;
      const slots = day.slots.filter((item) => item.id !== slotId);
      if (day.id === targetDayId)
        slots.splice(Math.max(0, Math.min(targetIndex, slots.length)), 0, slot);
      return { ...day, manualOrder: true, slots };
    }),
  };
}
export const overlaps = (slot: Slot, slots: Slot[]) =>
  slots.some(
    (other) =>
      other.id !== slot.id &&
      slot.startTime < other.endTime &&
      slot.endTime > other.startTime,
  );
export function formatTime(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}
export const timeRange = (slot: Slot) =>
  `${formatTime(slot.startTime)} – ${formatTime(slot.endTime)}`;
export const dateObject = (value: string) => new Date(`${value}T12:00:00`);
export const formatDate = (
  value: string,
  options?: Intl.DateTimeFormatOptions,
) =>
  dateObject(value).toLocaleDateString(
    "en-US",
    options ?? {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  );
export const localDate = (value = new Date()) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
