import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { addDays, currentMonth, formatDate, istTime, todayIST } from "@/lib/ist";
import { markWfh, requestRegularisation } from "@/modules/attendance/actions";
import { getHolidays } from "@/modules/attendance/holidays";
import { getMonthDays } from "@/modules/attendance/month";
import { summariseMonth } from "@/modules/attendance/rules";
import { ActionForm } from "@/components/ActionForm";
import { Legend, MonthCalendar, MonthNav, SummaryLine } from "@/components/MonthCalendar";
import { Card, Empty, Field, PageTitle, StatusBadge, Table, Td, btn, btnSecondary, input } from "@/components/ui";

export default async function MyAttendance({ searchParams }: PageProps<"/attendance">) {
  const me = await requireUser();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(String(sp.month)) ? String(sp.month) : currentMonth();
  const today = todayIST();
  const year = today.slice(0, 4);
  const [days, holidays, requests] = await Promise.all([
    getMonthDays([me.id], month),
    getHolidays(me.location_id, `${year}-01-01`, `${year}-12-31`),
    query<{ id: number; date: string; requested_in: Date; requested_out: Date; reason: string; status: string; approver_comment: string | null }>(
      "select id, date, requested_in, requested_out, reason, status, approver_comment from regularisation_requests where employee_id = $1 order by date desc limit 10",
      [me.id],
    ),
  ]);
  const myDays = days.get(me.id) ?? [];

  return (
    <div className="space-y-4">
      <PageTitle sub={`${me.location_name}: weekly off ${me.weekly_off_days.length === 2 ? "Saturday and Sunday" : "Sunday"}. All times IST.`}>My attendance</PageTitle>
      <Card title="Month view" action={<MonthNav month={month} basePath="/attendance" />}>
        <div className="mb-3"><Legend /></div>
        <MonthCalendar days={myDays} />
        <div className="mt-3"><SummaryLine s={summariseMonth(myDays)} /></div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Missed a punch? Request a correction">
          <ActionForm action={requestRegularisation} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
            <Field label="Date"><input type="date" name="date" required max={today} min={addDays(today, -30)} defaultValue={today} className={input} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="In"><input type="time" name="check_in" required defaultValue="09:30" className={input} /></Field>
              <Field label="Out"><input type="time" name="check_out" required defaultValue="18:00" className={input} /></Field>
            </div>
            <div className="sm:col-span-2"><Field label="Reason"><input name="reason" required className={input} placeholder="e.g. Forgot to check out" /></Field></div>
            <div><button className={btn}>Send to manager</button></div>
          </ActionForm>
          <div className="mt-4">
            {requests.length === 0 ? (
              <Empty>No correction requests yet.</Empty>
            ) : (
              <Table head={["Date", "Times", "Reason", "Status"]}>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <Td>{formatDate(r.date)}</Td>
                    <Td>{istTime(r.requested_in)}-{istTime(r.requested_out)}</Td>
                    <Td>{r.reason}{r.approver_comment && <span className="block text-xs text-slate-500">Manager: {r.approver_comment}</span>}</Td>
                    <Td><StatusBadge status={r.status} /></Td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Plan a work-from-home day">
            <ActionForm action={markWfh} className="flex flex-wrap items-end gap-2">
              <Field label="Date"><input type="date" name="date" min={today} max={addDays(today, 30)} defaultValue={today} className={input} /></Field>
              <button className={btnSecondary}>Mark WFH</button>
            </ActionForm>
            <p className="mt-2 text-xs text-slate-500">A WFH day counts as Present.</p>
          </Card>
          <Card title={`Holidays ${year}, ${me.location_name}`}>
            <Table head={["Date", "Holiday", "Type"]}>
              {holidays.map((h) => (
                <tr key={h.id}>
                  <Td>{formatDate(h.date)}</Td>
                  <Td>{h.name}</Td>
                  <Td>{h.type}{h.type === "Optional" && <span className="block text-xs text-slate-500">working day unless you take leave</span>}</Td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      </div>
    </div>
  );
}
