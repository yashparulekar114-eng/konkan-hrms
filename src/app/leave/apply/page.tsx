import { requireUser } from "@/lib/auth";
import { todayIST } from "@/lib/ist";
import { getBalances } from "@/modules/leave/balance";
import { ApplyLeaveForm } from "@/components/ApplyLeaveForm";
import { Card, PageTitle } from "@/components/ui";

export default async function ApplyLeave() {
  const me = await requireUser();
  const balances = await getBalances(me.id);
  const types = balances.map((b) => ({ id: b.type.id, code: b.type.code, name: b.type.name, half_day_allowed: b.type.half_day_allowed, canApply: b.canApply }));
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle sub={`Only working days count. ${me.location_name}: weekly off ${me.weekly_off_days.length === 2 ? "Saturday and Sunday" : "Sunday"}.`}>Apply for leave</PageTitle>
      <Card>
        <ApplyLeaveForm types={types} today={todayIST()} />
      </Card>
    </div>
  );
}
