import "server-only";
import type { Me } from "@/lib/auth";
import { query } from "@/lib/db";
import { getTeamMembers } from "@/modules/attendance/team";
import { getBalances } from "./balance";

export type PendingLeave = {
  id: number;
  employee_id: number;
  full_name: string;
  employee_code: string;
  leave_type_id: number;
  code: string;
  from_date: string;
  to_date: string;
  is_half_day: boolean;
  days: number;
  lop_days: number;
  reason: string;
  attachment_url: string | null;
  available: number | null;
  clashes: string[];
};

/** Pending leave from my team (never my own), with the employee's balance and teammates already off on those dates. */
export async function getPendingLeave(me: Me): Promise<PendingLeave[]> {
  const team = (await getTeamMembers(me)).filter((t) => t.id !== me.id);
  if (team.length === 0) return [];
  const ids = team.map((t) => t.id);
  const rows = await query<Omit<PendingLeave, "available" | "clashes">>(
    `select r.id, r.employee_id, e.full_name, e.employee_code, r.leave_type_id, t.code, r.from_date, r.to_date, r.is_half_day, r.days, r.lop_days, r.reason, r.attachment_url
       from leave_requests r join employees e on e.id = r.employee_id join leave_types t on t.id = r.leave_type_id
      where r.status = 'pending' and r.employee_id = any($1) order by r.from_date`,
    [ids],
  );
  const result: PendingLeave[] = [];
  for (const r of rows) {
    const bal = (await getBalances(r.employee_id, Number(r.from_date.slice(0, 4)))).find((b) => b.type.id === r.leave_type_id);
    const clashes = await query<{ full_name: string; status: string }>(
      `select e.full_name, l.status from leave_requests l join employees e on e.id = l.employee_id
        where l.employee_id = any($1) and l.employee_id <> $2 and l.status in ('approved', 'pending') and l.from_date <= $4 and l.to_date >= $3`,
      [ids, r.employee_id, r.from_date, r.to_date],
    );
    result.push({ ...r, available: bal?.available ?? null, clashes: clashes.map((c) => `${c.full_name} (${c.status})`) });
  }
  return result;
}

export async function getPendingRegularisations(me: Me) {
  const team = (await getTeamMembers(me)).filter((t) => t.id !== me.id);
  if (team.length === 0) return [];
  return query<{ id: number; full_name: string; date: string; requested_in: Date; requested_out: Date; reason: string }>(
    `select r.id, e.full_name, r.date, r.requested_in, r.requested_out, r.reason
       from regularisation_requests r join employees e on e.id = r.employee_id
      where r.status = 'pending' and r.employee_id = any($1) order by r.date`,
    [team.map((t) => t.id)],
  );
}
