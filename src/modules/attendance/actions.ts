"use server";

import { revalidatePath } from "next/cache";
import { canManageEmployee, requireHR, requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { addDays, istMinutes, istMoment, istTime, todayIST } from "@/lib/ist";
import { str, num, type ActionResult } from "@/lib/action";
import { LATE_AFTER_MINUTES } from "./rules";

export async function checkIn(): Promise<ActionResult> {
  const me = await requireUser();
  const today = todayIST();
  const now = new Date();
  const existing = await queryOne<{ check_in: Date | null }>("select check_in from attendance where employee_id = $1 and date = $2", [me.id, today]);
  if (existing?.check_in) return { error: `You already checked in today at ${istTime(existing.check_in)}.` };
  // One row per employee per day: the unique (employee_id, date) key makes a second insert update the same row.
  await query(
    `insert into attendance (employee_id, date, check_in, is_late) values ($1, $2, $3, $4)
     on conflict (employee_id, date) do update set check_in = excluded.check_in, is_late = excluded.is_late`,
    [me.id, today, now, istMinutes(now) > LATE_AFTER_MINUTES],
  );
  revalidatePath("/", "layout");
  return { ok: true, message: `Checked in at ${istTime(now)} IST.` };
}

export async function checkOut(): Promise<ActionResult> {
  const me = await requireUser();
  const today = todayIST();
  const row = await queryOne<{ check_in: Date | null; check_out: Date | null }>(
    "select check_in, check_out from attendance where employee_id = $1 and date = $2",
    [me.id, today],
  );
  if (!row?.check_in) return { error: "Check in first." };
  if (row.check_out) return { error: `You already checked out at ${istTime(row.check_out)}.` };
  const now = new Date();
  await query("update attendance set check_out = $1 where employee_id = $2 and date = $3", [now, me.id, today]);
  revalidatePath("/", "layout");
  return { ok: true, message: `Checked out at ${istTime(now)} IST.` };
}

export async function markWfh(form: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const date = str(form, "date") || todayIST();
  const today = todayIST();
  if (date < today || date > addDays(today, 30)) return { error: "Pick today or a date in the next 30 days." };
  await query(
    `insert into attendance (employee_id, date, is_wfh) values ($1, $2, true)
     on conflict (employee_id, date) do update set is_wfh = true`,
    [me.id, date],
  );
  revalidatePath("/", "layout");
  return { ok: true, message: `${date} marked as Work From Home (counts as Present).` };
}

export async function requestRegularisation(form: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const date = str(form, "date");
  const inTime = str(form, "check_in");
  const outTime = str(form, "check_out");
  const reason = str(form, "reason");
  const today = todayIST();
  if (!date || date > today) return { error: "Pick a past date (or today)." };
  if (date < addDays(today, -30)) return { error: "Corrections can only be requested for the last 30 days." };
  if (!inTime || !outTime || outTime <= inTime) return { error: "Enter a check-in time and a later check-out time." };
  if (!reason) return { error: "Please give a reason." };
  const pending = await queryOne("select id from regularisation_requests where employee_id = $1 and date = $2 and status = 'pending'", [me.id, date]);
  if (pending) return { error: "You already have a pending correction for that date." };
  await query(
    "insert into regularisation_requests (employee_id, date, requested_in, requested_out, reason) values ($1, $2, $3, $4, $5)",
    [me.id, date, istMoment(date, inTime), istMoment(date, outTime), reason],
  );
  revalidatePath("/", "layout");
  return { ok: true, message: "Correction sent to your manager. Attendance changes only after approval." };
}

export async function decideRegularisation(form: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const id = num(form, "id");
  const decision = str(form, "decision");
  const comment = str(form, "comment");
  const req = await queryOne<{ employee_id: number; date: string; requested_in: Date; requested_out: Date; status: string }>(
    "select employee_id, date, requested_in, requested_out, status from regularisation_requests where id = $1",
    [id],
  );
  if (!req) return { error: "Request not found." };
  if (!(await canManageEmployee(me, req.employee_id))) return { error: "You can only decide requests from your direct reports." };
  if (req.status !== "pending") return { error: "This request is already decided." };
  if (decision === "approved") {
    await query(
      `insert into attendance (employee_id, date, check_in, check_out, is_late) values ($1, $2, $3, $4, $5)
       on conflict (employee_id, date) do update set check_in = excluded.check_in, check_out = excluded.check_out, is_late = excluded.is_late`,
      [req.employee_id, req.date, req.requested_in, req.requested_out, istMinutes(req.requested_in) > LATE_AFTER_MINUTES],
    );
  }
  await query("update regularisation_requests set status = $1, approver_id = $2, approver_comment = $3 where id = $4", [
    decision === "approved" ? "approved" : "rejected",
    me.id,
    comment,
    id,
  ]);
  revalidatePath("/", "layout");
  return { ok: true, message: `Correction ${decision === "approved" ? "approved" : "rejected"}.` };
}

/** HR can correct any attendance record directly, with a reason that goes into the audit log. */
export async function hrCorrectAttendance(form: FormData): Promise<ActionResult> {
  const me = await requireHR();
  const employeeId = num(form, "employee_id");
  const date = str(form, "date");
  const inTime = str(form, "check_in");
  const outTime = str(form, "check_out");
  const reason = str(form, "reason");
  if (!employeeId || !date || date > todayIST()) return { error: "Pick an employee and a past date." };
  if (!inTime || !outTime || outTime <= inTime) return { error: "Enter a check-in time and a later check-out time." };
  if (!reason) return { error: "A reason is required for HR corrections." };
  const old = await queryOne<{ id: number; check_in: Date | null; check_out: Date | null }>(
    "select id, check_in, check_out from attendance where employee_id = $1 and date = $2",
    [employeeId, date],
  );
  const inAt = istMoment(date, inTime);
  const row = await queryOne<{ id: number }>(
    `insert into attendance (employee_id, date, check_in, check_out, is_late) values ($1, $2, $3, $4, $5)
     on conflict (employee_id, date) do update set check_in = excluded.check_in, check_out = excluded.check_out, is_late = excluded.is_late
     returning id`,
    [employeeId, date, inAt, istMoment(date, outTime), istMinutes(inAt) > LATE_AFTER_MINUTES],
  );
  await query(
    "insert into audit_log (table_name, record_id, field, old_value, new_value, changed_by) values ('attendance', $1, $2, $3, $4, $5)",
    [row!.id, `check_in/check_out on ${date} (reason: ${reason})`, old ? `${istTime(old.check_in)}-${istTime(old.check_out)}` : "none", `${inTime}-${outTime}`, me.id],
  );
  revalidatePath("/", "layout");
  return { ok: true, message: "Attendance corrected and logged." };
}

export async function addHoliday(form: FormData): Promise<ActionResult> {
  await requireHR();
  const date = str(form, "date");
  const name = str(form, "name");
  const type = str(form, "type");
  const locationIds = form.getAll("location_id").map(Number).filter(Boolean);
  if (!date || !name) return { error: "Enter a date and a name." };
  if (!["National", "State", "Optional"].includes(type)) return { error: "Pick National, State or Optional." };
  if (locationIds.length === 0) return { error: "Pick at least one location." };
  for (const loc of locationIds) {
    const clash = await queryOne("select id from holidays where location_id = $1 and date = $2", [loc, date]);
    if (clash) return { error: "That location already has a holiday on that date." };
  }
  for (const loc of locationIds) {
    await query("insert into holidays (location_id, date, name, type) values ($1, $2, $3, $4)", [loc, date, name, type]);
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Holiday added." };
}

export async function deleteHoliday(form: FormData): Promise<ActionResult> {
  await requireHR();
  await query("delete from holidays where id = $1", [num(form, "id")]);
  revalidatePath("/", "layout");
  return { ok: true, message: "Holiday removed." };
}

export async function updateLocation(form: FormData): Promise<ActionResult> {
  await requireHR();
  const offs = form.getAll("weekly_off_days").map(Number);
  if (offs.length === 0) return { error: "Pick at least one weekly off day." };
  await query("update locations set weekly_off_days = $1 where id = $2", [offs, num(form, "id")]);
  revalidatePath("/", "layout");
  return { ok: true, message: "Weekly offs saved." };
}
