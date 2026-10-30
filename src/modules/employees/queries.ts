import "server-only";
import { ACTIVE_SQL } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

export type Employee = {
  id: number;
  employee_code: string;
  full_name: string;
  email: string;
  mobile: string;
  dob: string;
  gender: string;
  address: string;
  city: string;
  state: string;
  pin_code: string;
  emergency_name: string;
  emergency_phone: string;
  emergency_relation: string;
  date_of_joining: string;
  last_working_day: string | null;
  designation: string;
  salary_grade: string;
  department_id: number;
  department_name: string;
  location_id: number;
  location_name: string;
  reporting_manager_id: number | null;
  manager_name: string | null;
  is_hr_admin: boolean;
  is_active: boolean;
};

const SELECT = `
  select e.*, d.name as department_name, l.name as location_name, m.full_name as manager_name, ${ACTIVE_SQL} as is_active
    from employees e
    join departments d on d.id = e.department_id
    join locations l on l.id = e.location_id
    left join employees m on m.id = e.reporting_manager_id`;

export async function listEmployees(filters: { search?: string; department?: string; location?: string; status?: string }) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.search) {
    params.push(`%${filters.search}%`);
    where.push(`(e.full_name ilike $${params.length} or e.employee_code ilike $${params.length})`);
  }
  if (filters.department) {
    params.push(Number(filters.department));
    where.push(`e.department_id = $${params.length}`);
  }
  if (filters.location) {
    params.push(Number(filters.location));
    where.push(`e.location_id = $${params.length}`);
  }
  if (filters.status === "active") where.push(ACTIVE_SQL);
  if (filters.status === "inactive") where.push(`not ${ACTIVE_SQL}`);
  return query<Employee>(`${SELECT} ${where.length ? `where ${where.join(" and ")}` : ""} order by e.employee_code`, params);
}

export async function getEmployee(id: number) {
  return queryOne<Employee>(`${SELECT} where e.id = $1`, [id]);
}

/** Raw statutory and bank values. Only for masking on the server, or for HR's logged Reveal. Never sent to the AI model. */
export async function getSensitive(id: number) {
  const [statutory, bank] = await Promise.all([
    queryOne<{ pan: string; aadhaar: string; uan: string | null }>("select pan, aadhaar, uan from employee_statutory where employee_id = $1", [id]),
    queryOne<{ account_number: string; ifsc: string; bank_name: string }>("select account_number, ifsc, bank_name from employee_bank where employee_id = $1", [id]),
  ]);
  return { statutory, bank };
}

export async function getLookups() {
  const [departments, locations, managers] = await Promise.all([
    query<{ id: number; name: string }>("select id, name from departments order by name"),
    query<{ id: number; name: string; weekly_off_days: number[] }>("select id, name, weekly_off_days from locations order by id"),
    query<{ id: number; full_name: string; employee_code: string }>(`select id, full_name, employee_code from employees e where ${ACTIVE_SQL} order by full_name`),
  ]);
  return { departments, locations, managers };
}

export async function getAuditLog(employeeId: number) {
  return query<{ id: number; table_name: string; field: string; old_value: string | null; new_value: string | null; changed_by_name: string | null; changed_at: Date }>(
    `select a.id, a.table_name, a.field, a.old_value, a.new_value, c.full_name as changed_by_name, a.changed_at
       from audit_log a left join employees c on c.id = a.changed_by
      where a.table_name in ('employees', 'employee_statutory', 'employee_bank') and a.record_id = $1
      order by a.changed_at desc, a.id desc`,
    [employeeId],
  );
}
