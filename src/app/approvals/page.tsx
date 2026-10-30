import { requireManagerOrHR } from "@/lib/auth";
import { formatDate, istTime } from "@/lib/ist";
import { decideRegularisation } from "@/modules/attendance/actions";
import { decideLeave } from "@/modules/leave/actions";
import { getPendingLeave, getPendingRegularisations } from "@/modules/leave/approvals";
import { ActionForm } from "@/components/ActionForm";
import { Card, Empty, PageTitle, btn, btnDanger, input, link } from "@/components/ui";

function DecisionButtons({ id, action }: { id: number; action: (f: FormData) => Promise<{ ok?: boolean; error?: string; message?: string } | void> }) {
  return (
    <ActionForm action={action} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input name="comment" placeholder="Comment (optional)" className={`${input} max-w-xs`} />
      <button name="decision" value="approved" className={btn}>Approve</button>
      <button name="decision" value="rejected" className={btnDanger}>Reject</button>
    </ActionForm>
  );
}

export default async function Approvals() {
  const me = await requireManagerOrHR();
  const [leaves, regs] = await Promise.all([getPendingLeave(me), getPendingRegularisations(me)]);
  return (
    <div className="space-y-4">
      <PageTitle sub="You never see your own requests here: nobody can approve their own leave.">Approvals inbox</PageTitle>
      <Card title={`Leave requests (${leaves.length})`}>
        {leaves.length === 0 ? (
          <Empty>Nothing waiting. All caught up.</Empty>
        ) : (
          <ul className="space-y-4">
            {leaves.map((r) => (
              <li key={r.id} className="rounded-md border border-slate-200 p-3 text-sm">
                <p>
                  <b>{r.full_name}</b> <span className="text-slate-400">{r.employee_code}</span> · {r.code} · {formatDate(r.from_date)}
                  {r.to_date !== r.from_date && <> to {formatDate(r.to_date)}</>} · <b>{r.days}</b> day(s){r.is_half_day && " (half day)"}
                  {r.lop_days > 0 && <span className="text-red-700"> ({r.lop_days} as LOP)</span>}
                </p>
                <p className="text-slate-600">Reason: {r.reason}</p>
                <p className="text-slate-600">
                  {r.code} available now: <b>{r.available ?? "no limit"}</b>
                  {r.attachment_url && <> · <a href={`/api/certificate/${r.id}`} className={link} target="_blank">View certificate</a></>}
                </p>
                {r.clashes.length > 0 && <p className="text-amber-700">Clash: also off on these dates: {r.clashes.join(", ")}</p>}
                <DecisionButtons id={r.id} action={decideLeave} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={`Attendance corrections (${regs.length})`}>
        {regs.length === 0 ? (
          <Empty>No correction requests.</Empty>
        ) : (
          <ul className="space-y-4">
            {regs.map((r) => (
              <li key={r.id} className="rounded-md border border-slate-200 p-3 text-sm">
                <p><b>{r.full_name}</b> · {formatDate(r.date)} · asks for {istTime(r.requested_in)} to {istTime(r.requested_out)}</p>
                <p className="text-slate-600">Reason: {r.reason}</p>
                <DecisionButtons id={r.id} action={decideRegularisation} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
