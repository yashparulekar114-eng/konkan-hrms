import "server-only";
import type { Me } from "@/lib/auth";
import { query } from "@/lib/db";
import { monthRange } from "@/lib/ist";
import { maskPan } from "@/lib/mask";
import { getMonthDays } from "@/modules/attendance/month";
import { summariseMonth } from "@/modules/attendance/rules";

export const LEAVE_COLUMNS = ["CL", "SL", "EL", "ML", "PL"];

export type ReportRow = {
  employee_code: string;
  full_name: string;
  location: string;
  pan_masked: string;
  present: number;
  wfh: number;
  leave: Record<string, number>;
  late: number;
  lop: number;
  holidays: number;
  weeklyOffs: number;
};

/** Month-end summary for the payroll vendor. HR gets everyone, a manager only their direct reports. */
export async function getMonthReport(me: Me, month: string): Promise<ReportRow[]> {
  if (!me.is_hr_admin && !me.is_manager) return [];
  const { first, last } = monthRange(month);
  // Anyone employed at some point in the month (including people who exited during it).
  const emps = await query<{ id: number; employee_code: string; full_name: string; location: string; pan: string }>(
    `select e.id, e.employee_code, e.full_name, l.name as location, s.pan
       from employees e join locations l on l.id = e.location_id left join employee_statutory s on s.employee_id = e.id
      where e.date_of_joining <= $1 and (e.last_working_day is null or e.last_working_day >= $2)
        and ($3 or e.reporting_manager_id = $4)
      order by e.employee_code`,
    [last, first, me.is_hr_admin, me.id],
  );
  const days = await getMonthDays(emps.map((e) => e.id), month);
  return emps.map((e) => {
    const s = summariseMonth(days.get(e.id) ?? []);
    return {
      employee_code: e.employee_code,
      full_name: e.full_name,
      location: e.location,
      pan_masked: maskPan(e.pan), // masked in every screen and every CSV
      present: s.present,
      wfh: s.wfh,
      leave: s.leave,
      late: s.late,
      lop: s.lop,
      holidays: s.holidays,
      weeklyOffs: s.weeklyOffs,
    };
  });
}

export function toCsv(rows: ReportRow[]): string {
  const head = ["Employee code", "Name", "Location", "PAN (masked)", "Days present", "WFH days", ...LEAVE_COLUMNS.map((c) => `${c} days`), "Late marks", "LOP days", "Holidays", "Weekly offs"];
  const esc = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const lines = rows.map((r) =>
    [r.employee_code, r.full_name, r.location, r.pan_masked, r.present, r.wfh, ...LEAVE_COLUMNS.map((c) => r.leave[c] ?? 0), r.late, r.lop, r.holidays, r.weeklyOffs].map(esc).join(","),
  );
  return [head.join(","), ...lines].join("\n");
}
