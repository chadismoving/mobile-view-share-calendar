import type { CalendarContent, SlotColor } from "./calendar";
export type CalendarPlace = {
  key: string;
  address: string;
  number: number;
  color: SlotColor;
  stops: { slotId: string; title: string; date: string }[];
};
export function calendarPlaces(content: CalendarContent): CalendarPlace[] {
  const result = new Map<string, CalendarPlace>();
  for (const day of content.days)
    for (const slot of day.slots) {
      const address = slot.location.trim().replace(/\s+/g, " ");
      if (!address) continue;
      const key = address.toLocaleLowerCase("en-US");
      const existing = result.get(key);
      const stop = { slotId: slot.id, title: slot.title, date: day.date };
      if (existing) existing.stops.push(stop);
      else
        result.set(key, {
          key,
          address,
          number: result.size + 1,
          color: slot.color,
          stops: [stop],
        });
    }
  return [...result.values()];
}
export const googleMapsLink = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
