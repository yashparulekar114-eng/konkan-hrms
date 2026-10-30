import type { ActionResult } from "@/lib/action";
import { INDIAN_STATES } from "@/lib/validation";
import type { Employee } from "@/modules/employees/queries";
import { ActionForm } from "./ActionForm";
import { Card, Field, btn, input } from "./ui";

type Lookups = {
  departments: { id: number; name: string }[];
  locations: { id: number; name: string }[];
  managers: { id: number; full_name: string; employee_code: string }[];
};

/** Add / edit employee form (HR only). Every Indian field is checked again on the server. */
export function EmployeeForm({
  action,
  lookups,
  emp,
  masked,
}: {
  action: (f: FormData) => Promise<ActionResult>;
  lookups: Lookups;
  emp?: Employee;
  masked?: { pan: string; aadhaar: string; account: string; uan: string; ifsc: string; bank_name: string };
}) {
  const editing = !!emp;
  return (
    <ActionForm action={action} className="space-y-4">
      {emp && <input type="hidden" name="id" value={emp.id} />}
      <Card title="1. Personal">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name"><input name="full_name" required defaultValue={emp?.full_name} className={input} /></Field>
          <Field label="Work email"><input name="email" type="email" required defaultValue={emp?.email} className={input} /></Field>
          <Field label="Mobile" hint="10 digits starting with 6, 7, 8 or 9"><input name="mobile" required defaultValue={emp?.mobile} inputMode="numeric" className={input} /></Field>
          <Field label="Date of birth" hint="Must be 18+ on the joining date"><input name="dob" type="date" required defaultValue={emp?.dob} className={input} /></Field>
          <Field label="Gender">
            <select name="gender" defaultValue={emp?.gender ?? ""} className={input} required>
              <option value="">Pick...</option><option>Male</option><option>Female</option><option>Other</option>
            </select>
          </Field>
          <Field label="Address"><input name="address" defaultValue={emp?.address} className={input} /></Field>
          <Field label="City"><input name="city" defaultValue={emp?.city} className={input} /></Field>
          <Field label="State / UT">
            <select name="state" defaultValue={emp?.state ?? "Goa"} className={input}>
              {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="PIN code" hint="6 digits"><input name="pin_code" required defaultValue={emp?.pin_code} inputMode="numeric" className={input} /></Field>
        </div>
      </Card>
      <Card title="2. Job">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Designation"><input name="designation" required defaultValue={emp?.designation} className={input} /></Field>
          <Field label="Salary grade"><input name="salary_grade" defaultValue={emp?.salary_grade} className={input} /></Field>
          <Field label="Department">
            <select name="department_id" defaultValue={emp?.department_id ?? ""} className={input} required>
              <option value="">Pick...</option>
              {lookups.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Location">
            <select name="location_id" defaultValue={emp?.location_id ?? ""} className={input} required>
              <option value="">Pick...</option>
              {lookups.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
          <Field label="Reporting manager" hint="Cannot be themselves or someone who reports to them">
            <select name="reporting_manager_id" defaultValue={emp?.reporting_manager_id ?? ""} className={input}>
              <option value="">None</option>
              {lookups.managers.filter((m) => m.id !== emp?.id).map((m) => <option key={m.id} value={m.id}>{m.full_name} ({m.employee_code})</option>)}
            </select>
          </Field>
          <Field label="Date of joining"><input name="date_of_joining" type="date" required defaultValue={emp?.date_of_joining} className={input} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_hr_admin" defaultChecked={emp?.is_hr_admin} /> HR Admin</label>
        </div>
      </Card>
      <Card title="3. Statutory">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="PAN" hint={editing ? `Now ${masked?.pan}. Leave blank to keep.` : "e.g. ABCDE1234F"}><input name="pan" required={!editing} className={`${input} uppercase`} /></Field>
          <Field label="Aadhaar" hint={editing ? `Now ${masked?.aadhaar}. Leave blank to keep.` : "12 digits"}><input name="aadhaar" required={!editing} inputMode="numeric" autoComplete="off" className={input} /></Field>
          <Field label="UAN (optional)" hint="12 digits"><input name="uan" defaultValue={masked?.uan} inputMode="numeric" className={input} /></Field>
        </div>
      </Card>
      <Card title="4. Bank">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Account number" hint={editing ? `Now ${masked?.account}. Leave blank to keep.` : "9 to 18 digits"}><input name="account_number" required={!editing} inputMode="numeric" autoComplete="off" className={input} /></Field>
          <Field label="IFSC" hint="e.g. SBIN0001234"><input name="ifsc" required defaultValue={masked?.ifsc} className={`${input} uppercase`} /></Field>
          <Field label="Bank name"><input name="bank_name" required defaultValue={masked?.bank_name} className={input} /></Field>
        </div>
      </Card>
      <Card title="5. Emergency contact">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Name"><input name="emergency_name" defaultValue={emp?.emergency_name} className={input} /></Field>
          <Field label="Relation"><input name="emergency_relation" defaultValue={emp?.emergency_relation} className={input} /></Field>
          <Field label="Phone"><input name="emergency_phone" defaultValue={emp?.emergency_phone} inputMode="numeric" className={input} /></Field>
        </div>
      </Card>
      <button className={btn}>{editing ? "Save changes" : "Create employee"}</button>
    </ActionForm>
  );
}
