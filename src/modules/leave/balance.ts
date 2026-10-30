import "server-only";
import { query, queryOne } from "@/lib/db";
import { todayIST } from "@/lib/ist";
import { accruedFor, type LeaveType } from "./accrual";

export type Balance = {
  type: LeaveType;
  opening: number;
  accrued: number | null; // null = unlimited
  used: number;
  pending: number;
  available: number | null; // opening + accrued - used (pending is not taken off, so it only changes on approval)
  canApply: number | null; // available - pending: what a new request may use
};

export async function getLeaveTypes(): Promise<LeaveType[]> {
  return query<LeaveType>("select * from leave_types order by id");
}

/** Leave types this employee can use (maternity for women, paternity for men). */
export async function getLeaveTypesFor(employeeId: number): Promise<LeaveType[]> {
  const emp = await queryOne<{ gender: string }>("select gender from employees where id = $1", [employeeId]);
  return (await getLeaveTypes()).filter((t) => !t.gender || t.gender === emp?.gender);
}

/** Balances are always calculated from requests, never stored, so they cannot drift out of date. */
export async function getBalances(employeeId: number, year = Number(todayIST().slice(0, 4))): Promise<Balance[]> {
  const today = todayIST();
  const emp = await queryOne<{ date_of_joining: string }>("select date_of_joining from employees where id = $1", [employeeId]);
  if (!emp) return [];
  const [types, openings, sums] = await Promise.all([
    getLeaveTypesFor(employeeId),
    query<{ leave_type_id: number; opening: number }>("select leave_type_id, opening from leave_balances where employee_id = $1 and year = $2", [employeeId, year]),
    query<{ leave_type_id: number; status: string; typed: number; lop: number }>(
      `select leave_type_id, status, sum(days - lop_days) as typed, sum(lop_days) as lop
         from leave_requests
        where employee_id = $1 and extract(year from from_date) = $2 and status in ('approved', 'pending')
        group by leave_type_id, status`,
      [employeeId, year],
    ),
  ]);
  const lopTypeId = types.find((t) => t.code === "LOP")?.id;
  return types.map((type) => {
    let used = 0;
    let pending = 0;
    for (const s of sums) {
      // LOP used = LOP requests + the parts of other requests converted to LOP.
      const amount = type.id === lopTypeId ? (s.leave_type_id === type.id ? s.typed + s.lop : s.lop) : s.leave_type_id === type.id ? s.typed : 0;
      if (s.status === "approved") used += amount;
      else pending += amount;
    }
    const opening = openings.find((o) => o.leave_type_id === type.id)?.opening ?? 0;
    const accrued = accruedFor(type, emp.date_of_joining, year, today);
    const available = accrued === null ? null : opening + accrued - used;
    return { type, opening, accrued, used, pending, available, canApply: available === null ? null : available - pending };
  });
}
