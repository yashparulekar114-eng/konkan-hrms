import { requireHR } from "@/lib/auth";
import { createEmployee } from "@/modules/employees/actions";
import { getLookups } from "@/modules/employees/queries";
import { EmployeeForm } from "@/components/EmployeeForm";
import { PageTitle } from "@/components/ui";

export default async function NewEmployee() {
  await requireHR();
  const lookups = await getLookups();
  return (
    <div>
      <PageTitle sub="The employee code (KCF....) is generated automatically and never changes.">Add employee</PageTitle>
      <EmployeeForm action={createEmployee} lookups={lookups} />
    </div>
  );
}
