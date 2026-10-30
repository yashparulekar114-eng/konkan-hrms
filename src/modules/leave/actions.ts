"use server";

import { revalidatePath } from "next/cache";
import { canManageEmployee, requireHR, requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { formatDate, todayIST } from "@/lib/ist";
import { num, str, type ActionResult } from "@/lib/action";
import { previewLeave, submitLeave, type LeaveInput, type LeavePreview, type SubmitResult } from "./apply";
import { getBalances } from "./balance";

function readInput(form: FormData): LeaveInput {
  return {
    leave_type_id: num(form, "leave_type_id"),
    from_date: str(form, "from_date"),
    to_date: str(form, "to_date") || str(form, "from_date"),
    is_half_day: form.get("is_half_day") === "on",
    reason: str(form, "reason"),
    convert_to_lop: form.get("convert_to_lop") === "on",
  };
}

/** Live preview for the Apply form: working days and remaining balance before submitting. */
export async function previewLeaveAction(form: FormData): Promise<LeavePreview> {
  const me = await requireUser();
  return previewLeave(me, readInput(form));
}

export async function applyLeaveAction(form: FormData): Promise<SubmitResult> {
  const me = await requireUser();
  const input = readInput(form);
  const file = form.get("certificate");
  if (file instanceof File && file.size > 0) {
    if (file.size > 4 * 1024 * 1024) return { error: "The certificate file must be under 4 MB." };
    if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type)) return { error: "The certificate must be a PDF, PNG or JPG." };
    input.certificate = { name: file.name, type: file.type, data: Buffer.from(await file.arrayBuffer()) };
  }
  const result = await submitLeave(me, input);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function decideLeave(form: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const id = num(form, "id");
  const decision = str(form, "decision") === "approved" ? "approved" : "rejected";
  const comment = str(form, "comment");
  const req = await queryOne<{ employee_id: number; leave_type_id: number; from_date: string; to_date: string; days: number; lop_days: number; status: string }>(
    "select employee_id, leave_type_id, from_date, to_date, days, lop_days, status from leave_requests where id = $1",
    [id],
  );
  if (!req) return { error: "Request not found." };
  if (req.employee_id === me.id) return { error: "You cannot approve or reject your own leave." };
  if (!(await canManageEmployee(me, req.employee_id))) return { error: "You can only decide leave for your direct reports." };
  if (req.status !== "pending") return { error: "This request is already decided." };
  if (decision === "approved") {
    const bal = (await getBalances(req.employee_id, Number(req.from_date.slice(0, 4)))).find((b) => b.type.id === req.leave_type_id);
    if (bal && bal.available !== null && req.days - req.lop_days > bal.available) {
      return { error: `Not enough balance: only ${bal.available} day(s) available. Reject it, or ask the employee to re-apply with LOP.` };
    }
  }
  await query("update leave_requests set status = $1, approver_id = $2, approver_comment = $3 where id = $4", [decision, me.id, comment, id]);

  const emp = await queryOne<{ email: string; full_name: string }>("select email, full_name from employees where id = $1", [req.employee_id]);
  if (emp) {
    await sendEmail(
      emp.email,
      `Your leave from ${formatDate(req.from_date)} was ${decision}`,
      `Hi ${emp.full_name},\n\nYour leave request from ${formatDate(req.from_date)} to ${formatDate(req.to_date)} (${req.days} day(s)) was ${decision} by ${me.full_name}.` +
        `${comment ? `\nComment: ${comment}` : ""}\n\nKonkanHR`,
    );
  }
  revalidatePath("/", "layout");
  return { ok: true, message: `Leave ${decision}. The employee has been emailed.` };
}

/** Pending leave, or approved leave that has not started yet, can be cancelled. The balance is restored automatically. */
export async function cancelLeave(form: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const id = num(form, "id");
  const req = await queryOne<{ employee_id: number; from_date: string; status: string }>(
    "select employee_id, from_date, status from leave_requests where id = $1",
    [id],
  );
  if (!req || req.employee_id !== me.id) return { error: "You can only cancel your own leave." };
  const canCancel = req.status === "pending" || (req.status === "approved" && req.from_date > todayIST());
  if (!canCancel) return { error: "Only pending leave, or approved leave that has not started, can be cancelled." };
  await query("update leave_requests set status = 'cancelled' where id = $1", [id]);
  revalidatePath("/", "layout");
  return { ok: true, message: "Leave cancelled and balance restored." };
}

export async function updateLeaveType(form: FormData): Promise<ActionResult> {
  await requireHR();
  const id = num(form, "id");
  const quota = str(form, "annual_quota");
  const method = str(form, "accrual_method");
  if (!["yearly_prorated", "monthly", "on_request", "none"].includes(method)) return { error: "Pick an accrual method." };
  await query(
    `update leave_types set name = $1, annual_quota = $2, accrual_method = $3, monthly_rate = $4, carry_forward_max = $5, half_day_allowed = $6 where id = $7`,
    [str(form, "name"), quota === "" ? null : Number(quota), method, Number(str(form, "monthly_rate") || 0), Number(str(form, "carry_forward_max") || 0), form.get("half_day_allowed") === "on", id],
  );
  revalidatePath("/", "layout");
  return { ok: true, message: "Leave type saved." };
}
