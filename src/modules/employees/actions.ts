"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHR, requireUser } from "@/lib/auth";
import { query, queryOne, transaction } from "@/lib/db";
import { todayIST } from "@/lib/ist";
import { maskAadhaar, maskAccount, maskPan } from "@/lib/mask";
import { num, str, type ActionResult } from "@/lib/action";
import {
  checkAadhaar, checkAccount, checkAge, checkIfsc, checkMobile, checkPan, checkPin, checkState, checkUan, firstError,
} from "@/lib/validation";

const PERSONAL = ["full_name", "email", "mobile", "dob", "gender", "address", "city", "state", "pin_code", "emergency_name", "emergency_phone", "emergency_relation"] as const;
const JOB = ["designation", "salary_grade", "department_id", "location_id", "reporting_manager_id", "date_of_joining"] as const;

function readEmployeeForm(form: FormData) {
  const v = {
    full_name: str(form, "full_name"),
    email: str(form, "email").toLowerCase(),
    mobile: str(form, "mobile"),
    dob: str(form, "dob"),
    gender: str(form, "gender"),
    address: str(form, "address"),
    city: str(form, "city"),
    state: str(form, "state"),
    pin_code: str(form, "pin_code"),
    emergency_name: str(form, "emergency_name"),
    emergency_phone: str(form, "emergency_phone"),
    emergency_relation: str(form, "emergency_relation"),
    designation: str(form, "designation"),
    salary_grade: str(form, "salary_grade"),
    department_id: num(form, "department_id"),
    location_id: num(form, "location_id"),
    reporting_manager_id: str(form, "reporting_manager_id") ? num(form, "reporting_manager_id") : null,
    date_of_joining: str(form, "date_of_joining"),
    is_hr_admin: form.get("is_hr_admin") === "on",
    pan: str(form, "pan").toUpperCase(),
    aadhaar: str(form, "aadhaar").replace(/\s/g, ""),
    uan: str(form, "uan"),
    account_number: str(form, "account_number"),
    ifsc: str(form, "ifsc").toUpperCase(),
    bank_name: str(form, "bank_name"),
  };
  const error = firstError(
    v.full_name ? null : "Full name is required.",
    /^\S+@\S+\.\S+$/.test(v.email) ? null : "Enter a valid email.",
    checkMobile(v.mobile),
    ["Male", "Female", "Other"].includes(v.gender) ? null : "Pick a gender.",
    checkAge(v.dob, v.date_of_joining),
    v.state ? checkState(v.state) : "Pick a state.",
    checkPin(v.pin_code),
    v.emergency_phone ? checkMobile(v.emergency_phone, "Emergency contact phone") : null,
    v.designation ? null : "Designation is required.",
    v.department_id ? null : "Pick a department.",
    v.location_id ? null : "Pick a location.",
    checkPan(v.pan),
    checkAadhaar(v.aadhaar),
    checkUan(v.uan),
    checkAccount(v.account_number),
    checkIfsc(v.ifsc),
    v.bank_name ? null : "Bank name is required.",
  );
  return { v, error };
}

/** True if making `managerId` the manager of `employeeId` would create a loop (A reports to B, B reports to A). */
async function wouldCreateCycle(employeeId: number, managerId: number): Promise<boolean> {
  let current: number | null = managerId;
  for (let i = 0; i < 100 && current; i++) {
    if (current === employeeId) return true;
    const row: { reporting_manager_id: number | null } | null = await queryOne("select reporting_manager_id from employees where id = $1", [current]);
    current = row?.reporting_manager_id ?? null;
  }
  return false;
}

export async function createEmployee(form: FormData): Promise<ActionResult> {
  const me = await requireHR();
  const { v, error } = readEmployeeForm(form);
  if (error) return { error };
  if (await queryOne("select id from employees where email = $1", [v.email])) return { error: "Another employee already has this email." };

  const id = await transaction(async (tx) => {
    // Employee code: KCF + next number, e.g. KCF0021. It never changes after this.
    const next = await query<{ n: number }>("select coalesce(max(substring(employee_code from 4)::int), 0) + 1 as n from employees", [], tx);
    const code = `KCF${String(next[0].n).padStart(4, "0")}`;
    const row = await query<{ id: number }>(
      `insert into employees (employee_code, full_name, email, mobile, dob, gender, address, city, state, pin_code, emergency_name,
         emergency_phone, emergency_relation, designation, salary_grade, department_id, location_id, reporting_manager_id, date_of_joining, is_hr_admin)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) returning id`,
      [code, v.full_name, v.email, v.mobile, v.dob, v.gender, v.address, v.city, v.state, v.pin_code, v.emergency_name, v.emergency_phone,
        v.emergency_relation, v.designation, v.salary_grade, v.department_id, v.location_id, v.reporting_manager_id, v.date_of_joining, v.is_hr_admin],
      tx,
    );
    const newId = row[0].id;
    await query("insert into employee_statutory (employee_id, pan, aadhaar, uan) values ($1, $2, $3, $4)", [newId, v.pan, v.aadhaar, v.uan || null], tx);
    await query("insert into employee_bank (employee_id, account_number, ifsc, bank_name) values ($1, $2, $3, $4)", [newId, v.account_number, v.ifsc, v.bank_name], tx);
    await query(
      "insert into leave_balances (employee_id, leave_type_id, year, opening) select $1, id, $2, 0 from leave_types",
      [newId, Number(todayIST().slice(0, 4))],
      tx,
    );
    await query(
      "insert into audit_log (table_name, record_id, field, old_value, new_value, changed_by) values ('employees', $1, 'created', null, $2, $3)",
      [newId, code, me.id],
      tx,
    );
    return newId;
  });
  revalidatePath("/", "layout");
  redirect(`/employees/${id}?created=1`);
}

export async function updateEmployee(form: FormData): Promise<ActionResult> {
  const me = await requireHR();
  const id = num(form, "id");
  const old = await queryOne<Record<string, unknown>>("select * from employees where id = $1", [id]);
  const sens = await queryOne<Record<string, unknown>>(
    "select s.pan, s.aadhaar, s.uan, b.account_number, b.ifsc, b.bank_name from employee_statutory s join employee_bank b using (employee_id) where employee_id = $1",
    [id],
  );
  if (!old || !sens) return { error: "Employee not found." };
  // The edit form never shows full PAN / Aadhaar / account numbers. Blank means "keep the current value".
  for (const f of ["pan", "aadhaar", "account_number"]) {
    if (!str(form, f)) form.set(f, String(sens[f]));
  }

  const { v, error } = readEmployeeForm(form);
  if (error) return { error };
  if (v.reporting_manager_id && (await wouldCreateCycle(id, v.reporting_manager_id))) {
    return { error: "An employee cannot report to themselves or to someone who reports to them." };
  }
  if (await queryOne("select id from employees where email = $1 and id <> $2", [v.email, id])) return { error: "Another employee already has this email." };

  // Record who changed what, old value, new value and when. Sensitive values are logged masked.
  const masked: Record<string, (x: string) => string> = { pan: maskPan, aadhaar: maskAadhaar, account_number: maskAccount };
  const changes: [string, string, unknown, unknown][] = [];
  for (const f of [...PERSONAL, ...JOB, "is_hr_admin"] as const) {
    if (String(old[f] ?? "") !== String(v[f] ?? "")) changes.push(["employees", f, old[f], v[f]]);
  }
  for (const f of ["pan", "aadhaar", "uan"] as const) {
    if (String(sens[f] ?? "") !== String(v[f] ?? "")) changes.push(["employee_statutory", f, sens[f], v[f]]);
  }
  for (const f of ["account_number", "ifsc", "bank_name"] as const) {
    if (String(sens[f] ?? "") !== String(v[f] ?? "")) changes.push(["employee_bank", f, sens[f], v[f]]);
  }

  await transaction(async (tx) => {
    await query(
      `update employees set full_name=$1, email=$2, mobile=$3, dob=$4, gender=$5, address=$6, city=$7, state=$8, pin_code=$9, emergency_name=$10,
         emergency_phone=$11, emergency_relation=$12, designation=$13, salary_grade=$14, department_id=$15, location_id=$16,
         reporting_manager_id=$17, date_of_joining=$18, is_hr_admin=$19 where id=$20`,
      [v.full_name, v.email, v.mobile, v.dob, v.gender, v.address, v.city, v.state, v.pin_code, v.emergency_name, v.emergency_phone,
        v.emergency_relation, v.designation, v.salary_grade, v.department_id, v.location_id, v.reporting_manager_id, v.date_of_joining, v.is_hr_admin, id],
      tx,
    );
    await query("update employee_statutory set pan=$1, aadhaar=$2, uan=$3 where employee_id=$4", [v.pan, v.aadhaar, v.uan || null, id], tx);
    await query("update employee_bank set account_number=$1, ifsc=$2, bank_name=$3 where employee_id=$4", [v.account_number, v.ifsc, v.bank_name, id], tx);
    for (const [table, field, oldVal, newVal] of changes) {
      const m = masked[field];
      await query(
        "insert into audit_log (table_name, record_id, field, old_value, new_value, changed_by) values ($1, $2, $3, $4, $5, $6)",
        [table, id, field, m ? m(String(oldVal ?? "")) : String(oldVal ?? ""), m ? m(String(newVal ?? "")) : String(newVal ?? ""), me.id],
        tx,
      );
    }
  });
  revalidatePath("/", "layout");
  redirect(`/employees/${id}?saved=1`);
}

/** Self-service: an employee edits only their own phone, address and emergency contact. */
export async function updateMyContact(form: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const v = {
    mobile: str(form, "mobile"),
    address: str(form, "address"),
    city: str(form, "city"),
    state: str(form, "state"),
    pin_code: str(form, "pin_code"),
    emergency_name: str(form, "emergency_name"),
    emergency_phone: str(form, "emergency_phone"),
    emergency_relation: str(form, "emergency_relation"),
  };
  const error = firstError(checkMobile(v.mobile), checkState(v.state), checkPin(v.pin_code), v.emergency_phone ? checkMobile(v.emergency_phone, "Emergency contact phone") : null);
  if (error) return { error };
  await query(
    `update employees set mobile=$1, address=$2, city=$3, state=$4, pin_code=$5, emergency_name=$6, emergency_phone=$7, emergency_relation=$8 where id=$9`,
    [v.mobile, v.address, v.city, v.state, v.pin_code, v.emergency_name, v.emergency_phone, v.emergency_relation, me.id],
  );
  revalidatePath("/", "layout");
  return { ok: true, message: "Your contact details are saved." };
}

/** Exit: HR sets the last working day. The record is never deleted; login stops after that date. */
export async function deactivateEmployee(form: FormData): Promise<ActionResult> {
  const me = await requireHR();
  const id = num(form, "id");
  const lwd = str(form, "last_working_day");
  if (!lwd) return { error: "Pick the last working day." };
  if (id === me.id) return { error: "You cannot deactivate yourself." };
  const old = await queryOne<{ last_working_day: string | null }>("select last_working_day from employees where id = $1", [id]);
  await query("update employees set last_working_day = $1, status = 'inactive' where id = $2", [lwd, id]);
  await query(
    "insert into audit_log (table_name, record_id, field, old_value, new_value, changed_by) values ('employees', $1, 'last_working_day', $2, $3, $4)",
    [id, old?.last_working_day ?? "", lwd, me.id],
  );
  revalidatePath("/", "layout");
  return { ok: true, message: `Last working day set to ${lwd}. They cannot log in after that date.` };
}

/** HR only: shows one full sensitive value. Every reveal is written to the audit log. */
export async function revealSensitive(employeeId: number, field: "pan" | "aadhaar" | "account_number"): Promise<{ value?: string; error?: string }> {
  const me = await requireHR();
  const row =
    field === "account_number"
      ? await queryOne<{ value: string }>("select account_number as value from employee_bank where employee_id = $1", [employeeId])
      : await queryOne<{ value: string }>(`select ${field === "pan" ? "pan" : "aadhaar"} as value from employee_statutory where employee_id = $1`, [employeeId]);
  if (!row) return { error: "Not found." };
  await query(
    "insert into audit_log (table_name, record_id, field, old_value, new_value, changed_by) values ($1, $2, $3, null, 'REVEALED (viewed in full)', $4)",
    [field === "account_number" ? "employee_bank" : "employee_statutory", employeeId, field, me.id],
  );
  return { value: row.value };
}

export async function addDepartment(form: FormData): Promise<ActionResult> {
  await requireHR();
  const name = str(form, "name");
  if (!name) return { error: "Enter a department name." };
  if (await queryOne("select id from departments where lower(name) = lower($1)", [name])) return { error: "That department already exists." };
  await query("insert into departments (name) values ($1)", [name]);
  revalidatePath("/", "layout");
  return { ok: true, message: "Department added." };
}
