import { requireManagerOrHR } from "@/lib/auth";
import { currentMonth, todayIST } from "@/lib/ist";
import { LEAVE_COLUMNS, getMonthReport } from "@/modules/reports/summary";
import { MonthNav } from "@/components/MonthCalendar";
import { Card, Empty, PageTitle, Table, Td, btn } from "@/components/ui";

export default async function Reports({ searchParams }: PageProps<"/reports">) {
  const me = await requireManagerOrHR();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(String(sp.month)) ? String(sp.month) : currentMonth();
  const rows = await getMonthReport(me, month);
  return (
    <div className="space-y-4">
      <PageTitle sub={`${me.is_hr_admin ? "All employees" : "Your direct reports"}. LOP = absent days + half-day halves + LOP leave + half a day for every 3 Late marks.${month === todayIST().slice(0, 7) ? " This month is counted up to today." : ""}`}>
        Month-end attendance summary
      </PageTitle>
      <Card action={<a href={`/reports/csv?month=${month}`} className={btn}>Download CSV</a>}>
        <div className="mb-3"><MonthNav month={month} basePath="/reports" /></div>
        {rows.length === 0 ? (
          <Empty>No employees for this month.</Empty>
        ) : (
          <Table head={["Code", "Name", "Location", "PAN", "Present", "WFH", ...LEAVE_COLUMNS, "Late", "LOP", "Holidays", "Weekly offs"]}>
            {rows.map((r) => (
              <tr key={r.employee_code}>
                <Td>{r.employee_code}</Td>
                <Td>{r.full_name}</Td>
                <Td>{r.location}</Td>
                <Td className="font-mono">{r.pan_masked}</Td>
                <Td>{r.present}</Td>
                <Td>{r.wfh}</Td>
                {LEAVE_COLUMNS.map((c) => <Td key={c}>{r.leave[c] ?? 0}</Td>)}
                <Td>{r.late}</Td>
                <Td className="font-semibold">{r.lop}</Td>
                <Td>{r.holidays}</Td>
                <Td>{r.weeklyOffs}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
