import { requireManagerOrHR } from "@/lib/auth";
import { query } from "@/lib/db";
import { DAY_NAMES, currentMonth, dayOfWeek, eachDay, monthRange } from "@/lib/ist";
import { getTeamMembers } from "@/modules/attendance/team";
import { MonthNav } from "@/components/MonthCalendar";
import { Card, Empty, PageTitle } from "@/components/ui";

export default async function LeaveCalendar({ searchParams }: PageProps<"/leave/calendar">) {
  const me = await requireManagerOrHR();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(String(sp.month)) ? String(sp.month) : currentMonth();
  const { first, last } = monthRange(month);
  const team = await getTeamMembers(me);
  const leaves = team.length
    ? await query<{ full_name: string; code: string; from_date: string; to_date: string; status: string }>(
        `select e.full_name, t.code, r.from_date, r.to_date, r.status from leave_requests r
           join employees e on e.id = r.employee_id join leave_types t on t.id = r.leave_type_id
          where r.employee_id = any($1) and r.status in ('approved', 'pending') and r.to_date >= $2 and r.from_date <= $3`,
        [team.map((t) => t.id), first, last],
      )
    : [];
  const days = eachDay(first, last);
  return (
    <div className="space-y-4">
      <PageTitle sub="Approved leave in blue, pending in amber. Two or more people on one day is marked as a clash.">Team leave calendar</PageTitle>
      <Card action={<MonthNav month={month} basePath="/leave/calendar" />}>
        {team.length === 0 ? <Empty>No team members.</Empty> : (
          <div className="grid grid-cols-7 gap-1 text-xs">
            {DAY_NAMES.map((d) => <div key={d} className="py-1 text-center font-medium text-slate-500">{d}</div>)}
            {Array.from({ length: dayOfWeek(first) }).map((_, i) => <div key={i} />)}
            {days.map((d) => {
              const off = leaves.filter((l) => l.from_date <= d && l.to_date >= d);
              return (
                <div key={d} className={`min-h-20 rounded border p-1 ${off.length > 1 ? "border-red-400 bg-red-50" : "border-slate-200 bg-white"}`}>
                  <b>{Number(d.slice(8))}</b> {off.length > 1 && <span className="text-[10px] font-semibold text-red-700">clash</span>}
                  {off.map((l, i) => (
                    <div key={i} className={`mt-0.5 truncate rounded px-1 ${l.status === "approved" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}>
                      {l.full_name.split(" ")[0]} {l.code}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
