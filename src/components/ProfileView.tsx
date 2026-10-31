import Link from "next/link";
import type { Me } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/ist";
import { maskAadhaar, maskAccount, maskPan } from "@/lib/mask";
import { INDIAN_STATES } from "@/lib/validation";
import { deactivateEmployee, updateMyContact } from "@/modules/employees/actions";
import { getAuditLog, getSensitive, type Employee } from "@/modules/employees/queries";
import { ActionForm } from "./ActionForm";
import { RevealButton } from "./RevealButton";
import { Card, Field, Table, Td, btn, btnDanger, input, link } from "./ui";

const TABS = [
  ["personal", "Personal"],
  ["job", "Job"],
  ["statutory", "Statutory"],
  ["bank", "Bank"],
  ["emergency", "Emergency contact"],
  ["history", "Change history"],
] as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-slate-100 py-2 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="col-span-2">{children}</dd>
    </div>
  );
}

export async function ProfileView({ me, emp, tab, basePath }: { me: Me; emp: Employee; tab: string; basePath: string }) {
  const isSelf = me.id === emp.id;
  const isHR = me.is_hr_admin;
  const tabs = TABS.filter(([key]) => key !== "history" || isHR);
  const active = tabs.some(([k]) => k === tab) ? tab : "personal";
  // Raw values stay on the server; only masked values are sent to the page (HR can Reveal one at a time).
  const { statutory, bank } = await getSensitive(emp.id);
  const audit = active === "history" && isHR ? await getAuditLog(emp.id) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{emp.full_name}</h1>
          <p className="text-sm text-slate-600">
            {emp.employee_code} · {emp.designation} · {emp.department_name} · {emp.location_name}
            {!emp.is_active && <b className="ml-2 text-red-600">Exited</b>}
          </p>
        </div>
        {isHR && <Link href={`/employees/${emp.id}/edit`} className={btn}>Edit employee</Link>}
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 text-sm">
        {tabs.map(([key, label]) => (
          <Link key={key} href={`${basePath}?tab=${key}`} className={`whitespace-nowrap px-3 py-2 ${active === key ? "border-b-2 border-pink-700 font-semibold text-blue-800" : "text-slate-600"}`}>
            {label}
          </Link>
        ))}
      </nav>

      {active === "personal" && (
        <Card>
          <dl>
            <Row label="Full name">{emp.full_name}</Row>
            <Row label="Email">{emp.email}</Row>
            <Row label="Mobile">{emp.mobile}</Row>
            <Row label="Date of birth">{formatDate(emp.dob)}</Row>
            <Row label="Gender">{emp.gender}</Row>
            <Row label="Address">{emp.address}, {emp.city}, {emp.state} {emp.pin_code}</Row>
          </dl>
          {isSelf && <ContactForm emp={emp} />}
        </Card>
      )}

      {active === "job" && (
        <Card>
          <dl>
            <Row label="Employee code">{emp.employee_code}</Row>
            <Row label="Designation">{emp.designation}</Row>
            <Row label="Department">{emp.department_name}</Row>
            <Row label="Location">{emp.location_name}</Row>
            <Row label="Reporting manager">{emp.manager_name ?? "-"}</Row>
            <Row label="Salary grade">{emp.salary_grade || "-"}</Row>
            <Row label="Date of joining">{formatDate(emp.date_of_joining)}</Row>
            <Row label="Last working day">{formatDate(emp.last_working_day)}</Row>
          </dl>
          {!isHR && <p className="mt-2 text-xs text-slate-500">Job details are read-only. Ask HR to change them.</p>}
          {isHR && !isSelf && (
            <ActionForm action={deactivateEmployee} className="mt-4 flex flex-wrap items-end gap-2" confirmText="Set the last working day? The employee cannot log in after that date.">
              <input type="hidden" name="id" value={emp.id} />
              <Field label="Deactivate: last working day">
                <input type="date" name="last_working_day" required className={input} defaultValue={emp.last_working_day ?? ""} />
              </Field>
              <button className={btnDanger}>Set exit date</button>
            </ActionForm>
          )}
        </Card>
      )}

      {active === "statutory" && (
        <Card>
          <dl>
            <Row label="PAN">{isHR ? <RevealButton employeeId={emp.id} field="pan" masked={maskPan(statutory?.pan)} /> : <span className="font-mono">{maskPan(statutory?.pan)}</span>}</Row>
            <Row label="Aadhaar">{isHR ? <RevealButton employeeId={emp.id} field="aadhaar" masked={maskAadhaar(statutory?.aadhaar)} /> : <span className="font-mono">{maskAadhaar(statutory?.aadhaar)}</span>}</Row>
            <Row label="UAN (PF)">{statutory?.uan ?? "Not yet allotted"}</Row>
          </dl>
        </Card>
      )}

      {active === "bank" && (
        <Card>
          <dl>
            <Row label="Account number">{isHR ? <RevealButton employeeId={emp.id} field="account_number" masked={maskAccount(bank?.account_number)} /> : <span className="font-mono">{maskAccount(bank?.account_number)}</span>}</Row>
            <Row label="IFSC">{bank?.ifsc}</Row>
            <Row label="Bank">{bank?.bank_name}</Row>
          </dl>
        </Card>
      )}

      {active === "emergency" && (
        <Card>
          <dl>
            <Row label="Name">{emp.emergency_name || "-"}</Row>
            <Row label="Relation">{emp.emergency_relation || "-"}</Row>
            <Row label="Phone">{emp.emergency_phone || "-"}</Row>
          </dl>
          {isSelf && <ContactForm emp={emp} />}
        </Card>
      )}

      {active === "history" && isHR && (
        <Card title="Who changed what">
          <Table head={["When (IST)", "By", "Field", "Old value", "New value"]}>
            {audit.map((a) => (
              <tr key={a.id}>
                <Td>{formatDateTime(a.changed_at)}</Td>
                <Td>{a.changed_by_name ?? "-"}</Td>
                <Td>{a.field}</Td>
                <Td>{a.old_value ?? "-"}</Td>
                <Td>{a.new_value ?? "-"}</Td>
              </tr>
            ))}
          </Table>
          {audit.length === 0 && <p className="text-sm text-slate-500">No changes recorded yet.</p>}
        </Card>
      )}
      {isHR && <p className="text-sm"><Link href="/employees" className={link}>Back to directory</Link></p>}
    </div>
  );
}

function ContactForm({ emp }: { emp: Employee }) {
  return (
    <details className="mt-4 rounded-md border border-slate-200 p-3">
      <summary className="cursor-pointer text-sm font-medium text-blue-800">Edit my phone, address and emergency contact</summary>
      <ActionForm action={updateMyContact} className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Mobile"><input name="mobile" defaultValue={emp.mobile} className={input} required /></Field>
        <Field label="Address"><input name="address" defaultValue={emp.address} className={input} /></Field>
        <Field label="City"><input name="city" defaultValue={emp.city} className={input} /></Field>
        <Field label="State">
          <select name="state" defaultValue={emp.state} className={input}>
            {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="PIN code"><input name="pin_code" defaultValue={emp.pin_code} className={input} /></Field>
        <Field label="Emergency contact name"><input name="emergency_name" defaultValue={emp.emergency_name} className={input} /></Field>
        <Field label="Emergency contact relation"><input name="emergency_relation" defaultValue={emp.emergency_relation} className={input} /></Field>
        <Field label="Emergency contact phone"><input name="emergency_phone" defaultValue={emp.emergency_phone} className={input} /></Field>
        <div className="sm:col-span-2"><button className={btn}>Save</button></div>
      </ActionForm>
    </details>
  );
}
