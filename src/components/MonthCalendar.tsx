import Link from "next/link";
import { DAY_NAMES, dayOfWeek, formatMonth, istTime } from "@/lib/ist";
import type { DayInfo, MonthSummary } from "@/modules/attendance/rules";
import { STATUS_COLORS, StatusBadge, link } from "./ui";

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

export function MonthNav({ month, basePath }: { month: string; basePath: string }) {
  const join = basePath.includes("?") ? "&" : "?";
  return (
    <div className="flex items-center gap-3 text-sm">
      <Link href={`${basePath}${join}month=${shiftMonth(month, -1)}`} className={link}>&larr; Prev</Link>
      <b>{formatMonth(month)}</b>
      <Link href={`${basePath}${join}month=${shiftMonth(month, 1)}`} className={link}>Next &rarr;</Link>
    </div>
  );
}

export function Legend() {
  return (
    <div className="flex flex-wrap gap-1">
      {["Present", "Half Day", "Absent", "On Leave", "Holiday", "Weekly Off", "Late"].map((s) => <StatusBadge key={s} status={s} />)}
    </div>
  );
}

/** One month, each day colour-coded by status. */
export function MonthCalendar({ days }: { days: DayInfo[] }) {
  const blanks = days.length ? dayOfWeek(days[0].date) : 0;
  return (
    <div className="grid grid-cols-7 gap-1 text-xs">
      {DAY_NAMES.map((d) => <div key={d} className="py-1 text-center font-medium text-slate-500">{d}</div>)}
      {Array.from({ length: blanks }).map((_, i) => <div key={`b${i}`} />)}
      {days.map((d) => (
        <div key={d.date} className={`min-h-16 rounded border p-1 ${d.status ? STATUS_COLORS[d.status] : "border-slate-200 bg-white text-slate-400"}`}>
          <div className="flex justify-between">
            <b>{Number(d.date.slice(8))}</b>
            {d.isLate && <span className="rounded bg-orange-200 px-1 text-[10px] text-orange-900">Late</span>}
          </div>
          <div className="leading-tight">
            {d.status === "On Leave" && d.leave ? `${d.leave.code}${d.leave.halfDay ? " ½" : ""}${d.leave.lopAmount ? " +LOP" : ""}` : d.status}
            {d.isWfh && " (WFH)"}
          </div>
          {d.holidayName && <div className="truncate text-[10px]" title={d.holidayName}>{d.holidayName}</div>}
          {d.checkIn && <div className="text-[10px]">{istTime(d.checkIn)}-{istTime(d.checkOut)}</div>}
        </div>
      ))}
    </div>
  );
}

export function SummaryLine({ s }: { s: MonthSummary }) {
  const leaves = Object.entries(s.leave).map(([k, v]) => `${k} ${v}`).join(", ");
  return (
    <p className="text-sm text-slate-700">
      Present <b>{s.present}</b> (WFH {s.wfh}) · Half days {s.halfDays} · Absent {s.absent} · Leave {leaves || "0"} · Late marks {s.late}
      {s.lateLop > 0 && <> (= {s.lateLop} LOP)</>} · <b>LOP {s.lop}</b> · Holidays {s.holidays} · Weekly offs {s.weeklyOffs}
    </p>
  );
}
