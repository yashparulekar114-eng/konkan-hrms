import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getEmployee } from "@/modules/employees/queries";
import { ProfileView } from "@/components/ProfileView";
import { Notice } from "@/components/ui";

export default async function EmployeeProfile({ params, searchParams }: PageProps<"/employees/[id]">) {
  const me = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const empId = Number(id);
  // Server-side check: only HR, or the employee themselves, may open a profile. Changing the URL does not help.
  if (empId !== me.id && !me.is_hr_admin) redirect("/access-denied");
  const emp = await getEmployee(empId);
  if (!emp) notFound();
  return (
    <div className="space-y-3">
      {sp.created && <Notice kind="success">Employee created with code {emp.employee_code}.</Notice>}
      {sp.saved && <Notice kind="success">Changes saved. Job and statutory changes are in the change history.</Notice>}
      <ProfileView me={me} emp={emp} tab={String(sp.tab ?? "personal")} basePath={`/employees/${emp.id}`} />
    </div>
  );
}
