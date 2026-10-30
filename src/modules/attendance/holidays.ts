import "server-only";
import { query } from "@/lib/db";
import { dayOfWeek, eachDay } from "@/lib/ist";

export type Holiday = { id: number; location_id: number; date: string; name: string; type: string };

export async function getHolidays(locationId: number, from: string, to: string): Promise<Holiday[]> {
  return query<Holiday>(
    "select id, location_id, date, name, type from holidays where location_id = $1 and date between $2 and $3 order by date",
    [locationId, from, to],
  );
}

export async function getWeeklyOffs(locationId: number): Promise<number[]> {
  const rows = await query<{ weekly_off_days: number[] }>("select weekly_off_days from locations where id = $1", [locationId]);
  return rows[0]?.weekly_off_days ?? [0];
}

/**
 * The working days between two dates for a location: weekly offs and National/State holidays are skipped.
 * (Optional holidays are normal working days.) Konkan has no sandwich rule, so offs inside a range never count.
 */
export async function workingDays(locationId: number, from: string, to: string): Promise<string[]> {
  if (to < from) return [];
  const [offs, holidays] = await Promise.all([getWeeklyOffs(locationId), getHolidays(locationId, from, to)]);
  const off = new Set(holidays.filter((h) => h.type !== "Optional").map((h) => h.date));
  return eachDay(from, to).filter((d) => !offs.includes(dayOfWeek(d)) && !off.has(d));
}
