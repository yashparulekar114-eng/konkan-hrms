import Link from "next/link";
import { requireHR } from "@/lib/auth";
import { formatDate } from "@/lib/ist";
import { getLookups, listEmployees } from "@/modules/employees/queries";
import { Card, Empty, PageTitle, Table, Td, btn, btnSecondary, input, link } from "@/components/ui";

export default async function Directory({ searchParams }: PageProps<"/employees">) {
  await requireHR();
  const sp = await searchParams;
  const filters = {
    search: String(sp.search ?? ""),
    department: String(sp.department ?? ""),
    location: String(sp.location ?? ""),
    status: String(sp.status ?? "active"),
  };
  const [employees, lookups] = await Promise.all([listEmployees(filters), getLookups()]);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PageTitle>Employee directory</PageTitle>
        <Link href="/employees/new" className={btn}>Add employee</Link>
      </div>
      <Card>
        <form className="grid gap-2 sm:grid-cols-5">
          <input name="search" defaultValue={filters.search} placeholder="Search name or code" className={`${input} sm:col-span-2`} />
          <select name="department" defaultValue={filters.department} className={input}>
            <option value="">All departments</option>
            {lookups.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select name="location" defaultValue={filters.location} className={input}>
            <option value="">All locations</option>
            {lookups.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select name="status" defaultValue={filters.status} className={input}>
            <option value="active">Active</option>
            <option value="inactive">Inactive (exited)</option>
            <option value="">All</option>
          </select>
          <button className={`${btnSecondary} sm:col-span-5 sm:w-32`}>Filter</button>
        </form>
      </Card>
      <Card>
        {employees.length === 0 ? (
          <Empty>No employees match these filters.</Empty>
        ) : (
          <Table head={["Code", "Name", "Designation", "Department", "Location", "Manager", "Joined", "Status"]}>
            {employees.map((e) => (
              <tr key={e.id}>
                <Td>{e.employee_code}</Td>
                <Td><Link href={`/employees/${e.id}`} className={link}>{e.full_name}</Link></Td>
                <Td>{e.designation}</Td>
                <Td>{e.department_name}</Td>
                <Td>{e.location_name}</Td>
                <Td>{e.manager_name ?? "-"}</Td>
                <Td>{formatDate(e.date_of_joining)}</Td>
                <Td>{e.is_active ? "Active" : `Exited ${formatDate(e.last_working_day)}`}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
