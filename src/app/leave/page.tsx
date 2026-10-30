import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { formatDate, todayIST } from "@/lib/ist";
import { cancelLeave } from "@/modules/leave/actions";
import { getBalances } from "@/modules/leave/balance";
import { ActionForm } from "@/components/ActionForm";
import { BalanceCards } from "@/components/BalanceCards";
import { Card, Empty, PageTitle, StatusBadge, Table, Td, btn, btnSecondary } from "@/components/ui";

export default async function MyLeave() {
  const me = await requireUser();
  const today = todayIST();
  const [balances, requests] = await Promise.all([
    getBalances(me.id),
    query<{ id: number; name: string; from_date: string; to_date: string; is_half_day: boolean; days: number; lop_days: number; reason: string; status: string; approver_comment: string | null; approver: string | null }>(
      `select r.id, t.name, r.from_date, r.to_date, r.is_half_day, r.days, r.lop_days, r.reason, r.status, r.approver_comment, a.full_name as approver
         from leave_requests r join leave_types t on t.id = r.leave_type_id left join employees a on a.id = r.approver_id
        where r.employee_id = $1 order by r.from_date desc`,
      [me.id],
    ),
  ]);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PageTitle sub="Available = opening + accrued - used. Pending requests are not taken off until approved.">My leave</PageTitle>
        <Link href="/leave/apply" className={btn}>Apply leave</Link>
      </div>
      <Card title={`Balance ${today.slice(0, 4)}`}>
        <BalanceCards balances={balances} detailed />
      </Card>
      <Card title="My requests">
        {requests.length === 0 ? (
          <Empty>No leave requests yet.</Empty>
        ) : (
          <Table head={["Type", "Dates", "Days", "Reason", "Status", ""]}>
            {requests.map((r) => {
              const canCancel = r.status === "pending" || (r.status === "approved" && r.from_date > today);
              return (
                <tr key={r.id}>
                  <Td>{r.name}</Td>
                  <Td>{formatDate(r.from_date)}{r.to_date !== r.from_date && <> to {formatDate(r.to_date)}</>}</Td>
                  <Td>{r.days}{r.is_half_day && " (half)"}{r.lop_days > 0 && <span className="block text-xs text-red-700">{r.lop_days} as LOP</span>}</Td>
                  <Td>{r.reason}{r.approver_comment && <span className="block text-xs text-slate-500">{r.approver}: {r.approver_comment}</span>}</Td>
                  <Td><StatusBadge status={r.status} /></Td>
                  <Td>
                    {canCancel && (
                      <ActionForm action={cancelLeave} className="" confirmText="Cancel this leave?">
                        <input type="hidden" name="id" value={r.id} />
                        <button className={btnSecondary}>Cancel</button>
                      </ActionForm>
                    )}
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
}
