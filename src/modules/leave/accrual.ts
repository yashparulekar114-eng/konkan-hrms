// Pure leave accrual rules (no database), so they are easy to test.

export type LeaveType = {
  id: number;
  code: string;
  name: string;
  annual_quota: number | null;
  accrual_method: "yearly_prorated" | "monthly" | "on_request" | "none";
  monthly_rate: number;
  carry_forward_max: number;
  half_day_allowed: boolean;
  gender: string | null;
};

export function roundHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

/** Whole months from one date to another (1 Jan -> 30 Oct = 9). */
export function completedMonths(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.max(0, (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0));
}

/**
 * How many days of a leave type the employee has been credited in a year. null = unlimited (LOP).
 * - yearly_prorated (CL, SL): full quota on 1 Jan; a joiner gets quota x months left / 12, counting the joining
 *   month if they join on or before the 15th, rounded to the nearest half day. Joined 1 July -> 6 months.
 * - monthly (EL): monthly_rate per completed month of service in the year, never more than the annual quota.
 * - on_request (maternity, paternity): the full entitlement is available when requested.
 */
export function accruedFor(type: LeaveType, dateOfJoining: string, year: number, today: string): number | null {
  const quota = type.annual_quota ?? 0;
  const yearStart = `${year}-01-01`;
  if (type.accrual_method === "none") return null;
  if (dateOfJoining > `${year}-12-31`) return 0;
  if (type.accrual_method === "on_request") return quota;
  if (type.accrual_method === "yearly_prorated") {
    if (dateOfJoining <= yearStart) return quota;
    const [, m, d] = dateOfJoining.split("-").map(Number);
    const months = 12 - (m - 1) - (d > 15 ? 1 : 0);
    return roundHalf((quota * months) / 12);
  }
  // monthly
  const start = dateOfJoining > yearStart ? dateOfJoining : yearStart;
  const end = Number(today.slice(0, 4)) > year ? `${year + 1}-01-01` : today;
  return Math.min(quota, completedMonths(start, end) * type.monthly_rate);
}
