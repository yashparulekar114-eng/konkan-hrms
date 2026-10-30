import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { formatDate, istTime, todayIST } from "@/lib/ist";
import { checkIn, checkOut, markWfh } from "@/modules/attendance/actions";
import { getToday } from "@/modules/attendance/month";
import { getTeamMembers } from "@/modules/attendance/team";
import { getBalances } from "@/modules/leave/balance";
import { ActionForm } from "@/components/ActionForm";
import { BalanceCards } from "@/components/BalanceCards";
import { Card, Empty, StatusBadge, Table, Td, btn, btnSecondary, link } from "@/components/ui";

export default async function Home() {
  const me = await requireUser();
  const today = todayIST();
  const [todayMap, balances, myPending, team] = await Promise.all([
    getToday([me.id]),
    getBalances(me.id),
    query<{ id: number; code: string; from_date: string; to_date: string; days: number }>(
      `select r.id, t.code, r.from_date, r.to_date, r.days from leave_requests r join leave_types t on t.id = r.leave_type_id
        where r.employee_id = $1 and r.status = 'pending' order by r.from_date`,
      [me.id],
    ),
    getTeamMembers(me),
  ]);
  const day = todayMap.get(me.id)!;
  const teamToday = await getToday(team.map((t) => t.id));
  const approvalsCount = team.length
    ? (await query<{ n: number }>(
        `select (select count(*) from leave_requests where status = 'pending' and employee_id = any($1) and employee_id <> $2)
              + (select count(*) from regularisation_requests where status = 'pending' and employee_id = any($1) and employee_id <> $2) as n`,
        [team.map((t) => t.id), me.id],
      ))[0].n
    : 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Hello, {me.full_name.split(" ")[0]}</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title={`Today, ${formatDate(today)}`}>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge status={day.status ?? "Not marked yet"} />
            {day.isLate && <StatusBadge status="Late" />}
            {day.isWfh && <span className="text-xs text-slate-600">Work from home</span>}
            {day.holidayName && <span className="text-xs text-purple-700">{day.holidayName}</span>}
          </div>
          <p className="mb-3 text-sm text-slate-600">
            Check in: <b>{istTime(day.checkIn)}</b> &nbsp; Check out: <b>{istTime(day.checkOut)}</b>
            {day.hours !== null && <> &nbsp; Worked: <b>{day.hours.toFixed(1)} h</b></>}
          </p>
          <div className="flex flex-wrap gap-2">
            {!day.checkIn && (
              <ActionForm action={checkIn} className="">
                <button className={`${btn} px-8 py-3 text-base`}>Check in</button>
              </ActionForm>
            )}
            {day.checkIn && !day.checkOut && (
              <ActionForm action={checkOut} className="">
                <button className={`${btn} px-8 py-3 text-base`}>Check out</button>
              </ActionForm>
            )}
            {!day.isWfh && !day.checkIn && (
              <ActionForm action={markWfh} className="">
                <input type="hidden" name="date" value={today} />
                <button className={btnSecondary}>Work from home today</button>
              </ActionForm>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-500">All times are IST. Check-in after 10:15 AM is marked Late.</p>
        </Card>

        <Card title="My pending requests" action={<Link href="/leave/apply" className={link}>Apply leave</Link>}>
          {myPending.length === 0 ? (
            <Empty>No pending leave requests.</Empty>
          ) : (
            <ul className="space-y-1 text-sm">
              {myPending.map((r) => (
                <li key={r.id}>
                  <StatusBadge status="pending" /> {r.code}: {formatDate(r.from_date)} to {formatDate(r.to_date)} ({r.days} day(s))
                </li>
              ))}
            </ul>
          )}
          {team.length > 0 && (
            <p className="mt-3 text-sm">
              <Link href="/approvals" className={link}>{approvalsCount} request(s) waiting for your approval</Link>
            </p>
          )}
        </Card>
      </div>

      <Card title="My leave balance" action={<Link href="/leave" className={link}>Details</Link>}>
        <BalanceCards balances={balances} />
      </Card>

      {team.length > 0 && (
        <Card title={me.is_hr_admin ? "Everyone today" : "My team today"} action={<Link href="/team" className={link}>Team view</Link>}>
          <Table head={["Employee", "Status", "Check in", "Check out"]}>
            {team.map((t) => {
              const d = teamToday.get(t.id);
              return (
                <tr key={t.id}>
                  <Td>{t.full_name} <span className="text-xs text-slate-400">{t.employee_code}</span></Td>
                  <Td>
                    <StatusBadge status={d?.status ?? "Not marked yet"} /> {d?.isLate && <StatusBadge status="Late" />}
                  </Td>
                  <Td>{istTime(d?.checkIn)}</Td>
                  <Td>{istTime(d?.checkOut)}</Td>
                </tr>
              );
            })}
          </Table>
        </Card>
      )}
    </div>
  );
}
