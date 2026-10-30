import { requireManagerOrHR } from "@/lib/auth";
import { currentMonth, istTime, todayIST } from "@/lib/ist";
import { hrCorrectAttendance } from "@/modules/attendance/actions";
import { getMonthDays, getToday } from "@/modules/attendance/month";
import { summariseMonth } from "@/modules/attendance/rules";
import { getTeamMembers } from "@/modules/attendance/team";
import { ActionForm } from "@/components/ActionForm";
import { Legend, MonthNav } from "@/components/MonthCalendar";
import { Card, Empty, Field, PageTitle, STATUS_COLORS, StatusBadge, Table, Td, btn, input } from "@/components/ui";

const SHORT: Record<string, string> = { Present: "P", "Half Day": "H", Absent: "A", "On Leave": "L", Holiday: "Ho", "Weekly Off": "W", "Checked In": "In" };

export default async function TeamAttendance({ searchParams }: PageProps<"/team">) {
  const me = await requireManagerOrHR();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(String(sp.month)) ? String(sp.month) : currentMonth();
  const team = await getTeamMembers(me);
  const ids = team.map((t) => t.id);
  const [today, monthDays] = await Promise.all([getToday(ids), getMonthDays(ids, month)]);
  const count = (s: string) => [...today.values()].filter((d) => d.status === s).length;

  return (
    <div className="space-y-4">
      <PageTitle sub={me.is_hr_admin ? "All active employees." : "Your direct reports only."}>Team attendance</PageTitle>
      {team.length === 0 ? (
        <Empty>No team members.</Empty>
      ) : (
        <>
          <Card title={`Today (${todayIST()})`}>
            <p className="mb-3 text-sm text-slate-700">
              Present {count("Present") + count("Checked In")} · On leave {count("On Leave")} · Absent {count("Absent")} · Not marked yet{" "}
              {[...today.values()].filter((d) => d.status === null).length}
            </p>
            <Table head={["Employee", "Location", "Status", "In", "Out"]}>
              {team.map((t) => {
                const d = today.get(t.id);
                return (
                  <tr key={t.id}>
                    <Td>{t.full_name} <span className="text-xs text-slate-400">{t.employee_code}</span></Td>
                    <Td>{t.location_name}</Td>
                    <Td><StatusBadge status={d?.status ?? "Not marked yet"} /> {d?.isLate && <StatusBadge status="Late" />} {d?.isWfh && <span className="text-xs">WFH</span>}</Td>
                    <Td>{istTime(d?.checkIn)}</Td>
                    <Td>{istTime(d?.checkOut)}</Td>
                  </tr>
                );
              })}
            </Table>
          </Card>

          <Card title="Month grid" action={<MonthNav month={month} basePath="/team" />}>
            <div className="mb-2"><Legend /></div>
            <div className="overflow-x-auto">
              <table className="text-[11px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-white px-1 text-left">Employee</th>
                    {(monthDays.get(ids[0]) ?? []).map((d) => <th key={d.date} className="w-6 text-center font-normal text-slate-500">{Number(d.date.slice(8))}</th>)}
                    <th className="px-1">LOP</th>
                  </tr>
                </thead>
                <tbody>
                  {team.map((t) => {
                    const days = monthDays.get(t.id) ?? [];
                    return (
                      <tr key={t.id}>
                        <td className="sticky left-0 whitespace-nowrap bg-white px-1">{t.full_name}</td>
                        {days.map((d) => (
                          <td key={d.date} title={`${d.date}: ${d.status ?? "-"}${d.isLate ? " (Late)" : ""}`} className={`h-6 w-6 border text-center ${d.status ? STATUS_COLORS[d.status] : "border-slate-100"} ${d.isLate ? "ring-2 ring-orange-400 ring-inset" : ""}`}>
                            {d.status ? SHORT[d.status] : ""}
                          </td>
                        ))}
                        <td className="px-1 text-center">{summariseMonth(days).lop}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-500">P Present, H Half Day, A Absent, L On Leave, Ho Holiday, W Weekly Off. Orange ring = Late.</p>
          </Card>

          {me.is_hr_admin && (
            <Card title="HR: correct an attendance record">
              <ActionForm action={hrCorrectAttendance} resetOnSuccess className="grid gap-3 sm:grid-cols-6">
                <Field label="Employee">
                  <select name="employee_id" required className={input}>
                    {team.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                  </select>
                </Field>
                <Field label="Date"><input type="date" name="date" required max={todayIST()} className={input} /></Field>
                <Field label="In"><input type="time" name="check_in" required className={input} /></Field>
                <Field label="Out"><input type="time" name="check_out" required className={input} /></Field>
                <Field label="Reason (logged)"><input name="reason" required className={input} /></Field>
                <div className="flex items-end"><button className={btn}>Correct</button></div>
              </ActionForm>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
