import "server-only";
import { ACTIVE_SQL, type Me } from "@/lib/auth";
import { query } from "@/lib/db";

export type TeamMember = { id: number; employee_code: string; full_name: string; designation: string; location_name: string; email: string };

/** HR sees every active employee; a manager sees only their active direct reports; others see nobody. */
export async function getTeamMembers(me: Me): Promise<TeamMember[]> {
  if (!me.is_hr_admin && !me.is_manager) return [];
  return query<TeamMember>(
    `select e.id, e.employee_code, e.full_name, e.designation, l.name as location_name, e.email
       from employees e join locations l on l.id = e.location_id
      where ${ACTIVE_SQL} and ($1 or e.reporting_manager_id = $2)
      order by e.employee_code`,
    [me.is_hr_admin, me.id],
  );
}
