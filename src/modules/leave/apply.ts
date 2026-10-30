import "server-only";
import type { Me } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { addDays, formatDate, todayIST } from "@/lib/ist";
import { workingDays } from "@/modules/attendance/holidays";
import { getBalances } from "./balance";

export type LeaveInput = {
  leave_type_id: number;
  from_date: string;
  to_date: string;
  is_half_day: boolean;
  reason: string;
  convert_to_lop?: boolean;
  attachment_url?: string | null;
};

export type LeavePreview = {
  error?: string;
  typeCode?: string;
  typeName?: string;
  days?: number;
  workingDayList?: string[];
  canApply?: number | null; // null = unlimited
  excess?: number; // days beyond the balance (would become LOP)
  needsCertificate?: boolean;
};

/** Checks a leave request and counts its working days. Used by the Apply form, the submit step and the agent. */
export async function previewLeave(me: Me, input: LeaveInput): Promise<LeavePreview> {
  const { from_date: from, to_date: to } = input;
  const today = todayIST();
  if (!from || !to) return { error: "Pick the from and to dates." };
  if (to < from) return { error: "The 'to' date must be on or after the 'from' date." };
  if (from < addDays(today, -30)) return { error: "Leave cannot be applied more than 30 days in the past." };
  if (Number(to.slice(0, 4)) !== Number(from.slice(0, 4))) return { error: "A request cannot cross into the next leave year. Split it into two." };

  const balances = await getBalances(me.id, Number(from.slice(0, 4)));
  const bal = balances.find((b) => b.type.id === input.leave_type_id);
  if (!bal) return { error: "That leave type is not available to you." };
  const type = bal.type;

  if (input.is_half_day) {
    if (!type.half_day_allowed) return { error: `${type.name} cannot be taken as a half day.` };
    if (from !== to) return { error: "A half day must be a single date." };
  }
  const list = await workingDays(me.location_id, from, to);
  if (list.length === 0) return { error: "Those dates are all weekly offs or holidays for your location, so no leave is needed." };
  const days = input.is_half_day ? 0.5 : list.length;

  const overlap = await queryOne(
    `select id from leave_requests where employee_id = $1 and status in ('pending', 'approved') and from_date <= $3 and to_date >= $2`,
    [me.id, from, to],
  );
  if (overlap) return { error: "You already have a pending or approved leave on some of these dates." };

  const canApply = bal.canApply === null ? null : Math.max(0, bal.canApply);
  const excess = canApply === null ? 0 : Math.max(0, days - canApply);
  return {
    typeCode: type.code,
    typeName: type.name,
    days,
    workingDayList: list,
    canApply,
    excess,
    needsCertificate: type.code === "SL" && days > 2,
  };
}

export type SubmitResult = { ok?: boolean; error?: string; message?: string; needsLop?: boolean; preview?: LeavePreview };

/** Creates a pending leave request. The balance does not change until a manager approves it. */
export async function submitLeave(me: Me, input: LeaveInput): Promise<SubmitResult> {
  if (!input.reason) return { error: "Please give a reason." };
  const p = await previewLeave(me, input);
  if (p.error) return { error: p.error };
  if (p.needsCertificate && !input.attachment_url) return { error: "Sick Leave of more than 2 consecutive days needs a medical certificate upload.", preview: p };
  if (p.excess! > 0 && !input.convert_to_lop) {
    return {
      needsLop: true,
      preview: p,
      error: `You have only ${p.canApply} day(s) of ${p.typeName} left but asked for ${p.days}. Tick "convert the extra ${p.excess} day(s) to Loss of Pay" to continue.`,
    };
  }
  const row = await queryOne<{ id: number }>(
    `insert into leave_requests (employee_id, leave_type_id, from_date, to_date, is_half_day, days, lop_days, reason, attachment_url)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
    [me.id, input.leave_type_id, input.from_date, input.to_date, input.is_half_day, p.days, p.excess ?? 0, input.reason, input.attachment_url ?? null],
  );

  // Email the reporting manager (or HR if the employee has no manager).
  const approvers = me.reporting_manager_id
    ? await query<{ email: string; full_name: string }>("select email, full_name from employees where id = $1", [me.reporting_manager_id])
    : await query<{ email: string; full_name: string }>("select email, full_name from employees where is_hr_admin and id <> $1", [me.id]);
  for (const a of approvers) {
    await sendEmail(
      a.email,
      `Leave request from ${me.full_name}: ${p.typeName}, ${p.days} day(s)`,
      `Hi ${a.full_name},\n\n${me.full_name} (${me.employee_code}) has applied for ${p.typeName} from ${formatDate(input.from_date)} to ${formatDate(input.to_date)} ` +
        `(${p.days} working day(s)${p.excess ? `, of which ${p.excess} as Loss of Pay` : ""}).\nReason: ${input.reason}\n\nPlease approve or reject it in KonkanHR > Approvals (request #${row!.id}).`,
    );
  }
  return { ok: true, message: `Leave request sent: ${p.days} working day(s) of ${p.typeName}${p.excess ? ` (${p.excess} as LOP)` : ""}. Your balance changes only when it is approved.` };
}
