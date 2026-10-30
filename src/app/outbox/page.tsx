import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { formatDateTime } from "@/lib/ist";
import { Card, Empty, PageTitle } from "@/components/ui";

// Localhost helper: every email the app sends is listed here, so you can check notifications without a mail account.
export default async function Outbox() {
  const me = await requireUser();
  const emails = await query<{ id: number; to_email: string; subject: string; body: string; sent_via: string; created_at: Date }>(
    `select * from email_log where $1 or to_email = $2 order by created_at desc, id desc limit 100`,
    [me.is_hr_admin, me.email],
  );
  return (
    <div className="space-y-4">
      <PageTitle sub={me.is_hr_admin ? "All emails sent by KonkanHR." : "Emails sent to you."}>Email outbox</PageTitle>
      {emails.length === 0 ? (
        <Empty>No emails yet.</Empty>
      ) : (
        emails.map((e) => (
          <Card key={e.id}>
            <p className="text-xs text-slate-500">{formatDateTime(e.created_at)} · to {e.to_email} · {e.sent_via}</p>
            <p className="font-semibold">{e.subject}</p>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-slate-700">{e.body}</pre>
          </Card>
        ))
      )}
    </div>
  );
}
