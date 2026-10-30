import { notFound } from "next/navigation";
import { requireHR } from "@/lib/auth";
import { maskAadhaar, maskAccount, maskPan } from "@/lib/mask";
import { updateEmployee } from "@/modules/employees/actions";
import { getEmployee, getLookups, getSensitive } from "@/modules/employees/queries";
import { EmployeeForm } from "@/components/EmployeeForm";
import { PageTitle } from "@/components/ui";

export default async function EditEmployee({ params }: PageProps<"/employees/[id]/edit">) {
  await requireHR();
  const { id } = await params;
  const emp = await getEmployee(Number(id));
  if (!emp) notFound();
  const [lookups, { statutory, bank }] = await Promise.all([getLookups(), getSensitive(emp.id)]);
  return (
    <div>
      <PageTitle sub={`${emp.employee_code} (code cannot change). Changes to job, statutory and bank fields go into the change history.`}>Edit {emp.full_name}</PageTitle>
      <EmployeeForm
        action={updateEmployee}
        lookups={lookups}
        emp={emp}
        masked={{
          pan: maskPan(statutory?.pan),
          aadhaar: maskAadhaar(statutory?.aadhaar),
          account: maskAccount(bank?.account_number),
          uan: statutory?.uan ?? "",
          ifsc: bank?.ifsc ?? "",
          bank_name: bank?.bank_name ?? "",
        }}
      />
    </div>
  );
}
