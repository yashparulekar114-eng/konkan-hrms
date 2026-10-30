import "server-only";
import { query } from "@/lib/db";
import { dayOfWeek, eachDay, monthRange, todayIST } from "@/lib/ist";
import { computeDay, type DayInfo, type DayLeave } from "./rules";

type EmpRow = { id: number; date_of_joining: string; last_working_day: string | null; location_id: number; weekly_off_days: number[] };

/**
 * Builds the day-by-day status for employees across a date range.
 * Every screen (calendar, team view, report, CSV, agent) reads status from here.
 */
export async function getDays(employeeIds: number[], from: string, to: string): Promise<Map<number, DayInfo[]>> {
  const result = new Map<number, DayInfo[]>();
  if (employeeIds.length === 0) return result;
  const today = todayIST();

  const [emps, holidays, attendance, leaves] = await Promise.all([
    query<EmpRow>(
      `select e.id, e.date_of_joining, e.last_working_day, e.location_id, l.weekly_off_days
         from employees e join locations l on l.id = e.location_id where e.id = any($1)`,
      [employeeIds],
    ),
    query<{ location_id: number; date: string; name: string; type: string }>("select location_id, date, name, type from holidays"),
    query<{ employee_id: number; date: string; check_in: Date | null; check_out: Date | null; is_wfh: boolean; is_late: boolean }>(
      "select employee_id, date, check_in, check_out, is_wfh, is_late from attendance where employee_id = any($1) and date between $2 and $3",
      [employeeIds, from, to],
    ),
    query<{ employee_id: number; code: string; from_date: string; to_date: string; is_half_day: boolean; days: number; lop_days: number }>(
      `select r.employee_id, t.code, r.from_date, r.to_date, r.is_half_day, r.days, r.lop_days
         from leave_requests r join leave_types t on t.id = r.leave_type_id
        where r.status = 'approved' and r.employee_id = any($1) and r.to_date >= $2 and r.from_date <= $3`,
      [employeeIds, from, to],
    ),
  ]);

  const holidayMap = new Map(holidays.map((h) => [`${h.location_id}:${h.date}`, h]));
  const attMap = new Map(attendance.map((a) => [`${a.employee_id}:${a.date}`, a]));

  for (const e of emps) {
    const isOff = (d: string) => {
      const h = holidayMap.get(`${e.location_id}:${d}`);
      return e.weekly_off_days.includes(dayOfWeek(d)) || (!!h && h.type !== "Optional");
    };
    // Spread each approved leave over its working days: the first (days - lop_days) are the leave type, the rest LOP.
    const leaveMap = new Map<string, DayLeave>();
    for (const r of leaves.filter((l) => l.employee_id === e.id)) {
      let typed = r.days - r.lop_days;
      for (const d of eachDay(r.from_date, r.to_date).filter((x) => !isOff(x))) {
        const dayTotal = r.is_half_day ? 0.5 : 1;
        const amount = Math.max(0, Math.min(dayTotal, typed));
        typed -= amount;
        leaveMap.set(d, { code: r.code, amount, lopAmount: dayTotal - amount, halfDay: r.is_half_day });
      }
    }
    result.set(
      e.id,
      eachDay(from, to).map((date) =>
        computeDay({
          date,
          today,
          dateOfJoining: e.date_of_joining,
          lastWorkingDay: e.last_working_day,
          isWeeklyOff: e.weekly_off_days.includes(dayOfWeek(date)),
          holiday: holidayMap.get(`${e.location_id}:${date}`) ?? null,
          leave: leaveMap.get(date) ?? null,
          attendance: attMap.get(`${e.id}:${date}`) ?? null,
        }),
      ),
    );
  }
  return result;
}

export async function getMonthDays(employeeIds: number[], month: string) {
  const { first, last } = monthRange(month);
  return getDays(employeeIds, first, last);
}

export async function getToday(employeeIds: number[]): Promise<Map<number, DayInfo>> {
  const today = todayIST();
  const days = await getDays(employeeIds, today, today);
  return new Map([...days].map(([id, list]) => [id, list[0]]));
}
