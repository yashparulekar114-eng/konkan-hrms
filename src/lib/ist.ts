// IST (Asia/Kolkata) date helpers. Dates are plain 'YYYY-MM-DD' strings so the server's own time zone never matters.

export const IST = "Asia/Kolkata";

const ymdFormat = new Intl.DateTimeFormat("en-CA", { timeZone: IST, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFormat = new Intl.DateTimeFormat("en-GB", { timeZone: IST, hour: "2-digit", minute: "2-digit", hour12: false });

/** Today's date in IST, e.g. '2026-10-30'. */
export function todayIST(): string {
  return ymdFormat.format(new Date());
}

/** The IST calendar date of a moment in time. */
export function istDateOf(moment: Date): string {
  return ymdFormat.format(moment);
}

/** 'HH:MM' in IST. */
export function istTime(moment: Date | null | undefined): string {
  return moment ? timeFormat.format(moment) : "-";
}

/** Minutes after midnight, IST. */
export function istMinutes(moment: Date): number {
  const [h, m] = istTime(moment).split(":").map(Number);
  return h * 60 + m;
}

/** A moment in time from an IST date and 'HH:MM'. */
export function istMoment(ymd: string, hhmm: string): Date {
  return new Date(`${ymd}T${hhmm}:00+05:30`);
}

function toUtc(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`);
}

export function addDays(ymd: string, n: number): string {
  const d = toUtc(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday. */
export function dayOfWeek(ymd: string): number {
  return toUtc(ymd).getUTCDay();
}

export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

/** Month as 'YYYY-MM'. */
export function monthRange(month: string): { first: string; last: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { first: `${month}-01`, last };
}

export function currentMonth(): string {
  return todayIST().slice(0, 7);
}

export function formatDate(ymd: string | null | undefined): string {
  if (!ymd) return "-";
  return toUtc(ymd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatMonth(month: string): string {
  return toUtc(`${month}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function formatDateTime(moment: Date | null | undefined): string {
  if (!moment) return "-";
  return moment.toLocaleString("en-IN", { timeZone: IST, dateStyle: "medium", timeStyle: "short" });
}

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
