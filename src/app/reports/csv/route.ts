import { getMe } from "@/lib/auth";
import { currentMonth } from "@/lib/ist";
import { getMonthReport, toCsv } from "@/modules/reports/summary";

export async function GET(req: Request) {
  const me = await getMe();
  if (!me) return new Response("Sign in first", { status: 401 });
  if (!me.is_hr_admin && !me.is_manager) return new Response("Only managers and HR can download the summary", { status: 403 });
  const param = new URL(req.url).searchParams.get("month") ?? "";
  const month = /^\d{4}-\d{2}$/.test(param) ? param : currentMonth();
  const csv = toCsv(await getMonthReport(me, month));
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="attendance-summary-${month}.csv"` },
  });
}
