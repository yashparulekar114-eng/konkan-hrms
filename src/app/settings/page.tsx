import { requireHR } from "@/lib/auth";
import { query } from "@/lib/db";
import { DAY_NAMES, formatDate, todayIST } from "@/lib/ist";
import { addHoliday, deleteHoliday, updateLocation } from "@/modules/attendance/actions";
import { addDepartment } from "@/modules/employees/actions";
import { updateLeaveType } from "@/modules/leave/actions";
import { getLeaveTypes } from "@/modules/leave/balance";
import { ActionForm } from "@/components/ActionForm";
import { Card, Field, PageTitle, Table, Td, btn, btnSecondary, input } from "@/components/ui";

export default async function Settings() {
  await requireHR();
  const year = todayIST().slice(0, 4);
  const [locations, departments, holidays, types] = await Promise.all([
    query<{ id: number; name: string; weekly_off_days: number[] }>("select id, name, weekly_off_days from locations order by id"),
    query<{ id: number; name: string }>("select id, name from departments order by name"),
    query<{ id: number; date: string; name: string; type: string; location: string }>(
      `select h.id, h.date, h.name, h.type, l.name as location from holidays h join locations l on l.id = h.location_id
        where extract(year from h.date) = $1 order by h.date, l.name`,
      [Number(year)],
    ),
    getLeaveTypes(),
  ]);
  return (
    <div className="space-y-4">
      <PageTitle>Settings</PageTitle>

      <Card title={`Holidays ${year}`}>
        <ActionForm action={addHoliday} resetOnSuccess className="mb-4 grid gap-2 sm:grid-cols-5">
          <Field label="Date"><input type="date" name="date" required className={input} /></Field>
          <Field label="Name"><input name="name" required className={input} /></Field>
          <Field label="Type">
            <select name="type" className={input}><option>National</option><option>State</option><option>Optional</option></select>
          </Field>
          <fieldset className="text-sm">
            <legend className="mb-1 font-medium text-slate-700">Locations</legend>
            {locations.map((l) => <label key={l.id} className="mr-3"><input type="checkbox" name="location_id" value={l.id} /> {l.name}</label>)}
          </fieldset>
          <div className="flex items-end"><button className={btn}>Add holiday</button></div>
        </ActionForm>
        <Table head={["Date", "Holiday", "Type", "Location", ""]}>
          {holidays.map((h) => (
            <tr key={h.id}>
              <Td>{formatDate(h.date)}</Td><Td>{h.name}</Td><Td>{h.type}</Td><Td>{h.location}</Td>
              <Td>
                <ActionForm action={deleteHoliday} className="" confirmText="Remove this holiday?">
                  <input type="hidden" name="id" value={h.id} />
                  <button className="text-xs text-red-600 hover:underline">Remove</button>
                </ActionForm>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Leave types">
        <div className="space-y-3">
          {types.map((t) => (
            <ActionForm key={t.id} action={updateLeaveType} className="grid items-end gap-2 rounded-md border border-slate-200 p-2 sm:grid-cols-7">
              <input type="hidden" name="id" value={t.id} />
              <Field label={`${t.code} name`}><input name="name" defaultValue={t.name} className={input} /></Field>
              <Field label="Annual quota" hint="blank = no limit"><input name="annual_quota" defaultValue={t.annual_quota ?? ""} className={input} /></Field>
              <Field label="Accrual">
                <select name="accrual_method" defaultValue={t.accrual_method} className={input}>
                  <option value="yearly_prorated">1 Jan, pro-rated</option>
                  <option value="monthly">Monthly</option>
                  <option value="on_request">On request</option>
                  <option value="none">None (unlimited)</option>
                </select>
              </Field>
              <Field label="Per month"><input name="monthly_rate" defaultValue={t.monthly_rate} className={input} /></Field>
              <Field label="Carry fwd max"><input name="carry_forward_max" defaultValue={t.carry_forward_max} className={input} /></Field>
              <label className="pb-2 text-sm"><input type="checkbox" name="half_day_allowed" defaultChecked={t.half_day_allowed} /> Half day</label>
              <button className={btnSecondary}>Save</button>
            </ActionForm>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Locations and weekly offs">
          {locations.map((l) => (
            <ActionForm key={l.id} action={updateLocation} className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <input type="hidden" name="id" value={l.id} />
              <b className="w-16">{l.name}</b>
              {DAY_NAMES.map((d, i) => <label key={d}><input type="checkbox" name="weekly_off_days" value={i} defaultChecked={l.weekly_off_days.includes(i)} /> {d}</label>)}
              <button className={btnSecondary}>Save</button>
            </ActionForm>
          ))}
        </Card>
        <Card title="Departments">
          <ul className="mb-3 list-inside list-disc text-sm">{departments.map((d) => <li key={d.id}>{d.name}</li>)}</ul>
          <ActionForm action={addDepartment} resetOnSuccess className="flex gap-2">
            <input name="name" placeholder="New department" className={input} />
            <button className={btnSecondary}>Add</button>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
