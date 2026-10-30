import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { query, queryOne } from "./db";

// Localhost login: the user picks a seeded employee by email (no password), stored in a cookie.
// The role always comes from our database: only the HR Admin flag is stored, Manager is derived.

export const SESSION_COOKIE = "hrms_employee_id";

export type Me = {
  id: number;
  employee_code: string;
  full_name: string;
  email: string;
  gender: string;
  date_of_joining: string;
  last_working_day: string | null;
  location_id: number;
  location_name: string;
  weekly_off_days: number[];
  is_hr_admin: boolean;
  is_manager: boolean;
  reporting_manager_id: number | null;
};

/** The active-employee rule used everywhere: no last working day, or it has not passed yet (IST). */
export const ACTIVE_SQL = "(e.last_working_day is null or e.last_working_day >= current_date)";

export async function loadEmployeeSession(employeeId: number): Promise<(Me & { can_login: boolean }) | null> {
  return queryOne<Me & { can_login: boolean }>(
    `select e.id, e.employee_code, e.full_name, e.email, e.gender, e.date_of_joining, e.last_working_day,
            e.location_id, l.name as location_name, l.weekly_off_days, e.is_hr_admin, e.reporting_manager_id,
            ${ACTIVE_SQL} as can_login,
            exists (select 1 from employees r where r.reporting_manager_id = e.id
                    and (r.last_working_day is null or r.last_working_day >= current_date)) as is_manager
       from employees e join locations l on l.id = e.location_id
      where e.id = $1`,
    [employeeId],
  );
}

/** Clerk is used when its keys are set (Vercel). Without them, localhost uses the pick-an-employee demo login. */
export const clerkEnabled = !!process.env.CLERK_SECRET_KEY && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

/**
 * Which employee row the visitor is. 'none' = not signed in; 'unknown' = signed in to Clerk with an email
 * that is not an employee.
 */
async function sessionEmployeeId(): Promise<number | "none" | "unknown"> {
  if (!clerkEnabled) {
    const raw = (await cookies()).get(SESSION_COOKIE)?.value;
    return raw && Number.isInteger(Number(raw)) ? Number(raw) : "none";
  }
  const { auth, currentUser } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) return "none";
  const linked = await queryOne<{ id: number }>("select id from employees where clerk_user_id = $1", [userId]);
  if (linked) return linked.id;
  // First sign-in: match a verified Clerk email to the employee's work email, then remember the link.
  // "name+clerk_test@..." is Clerk's test-email format (code 424242 in a development instance) and maps to "name@...".
  const user = await currentUser();
  const emails = (user?.emailAddresses ?? [])
    .filter((e) => e.verification?.status === "verified")
    .map((e) => e.emailAddress.toLowerCase().replace("+clerk_test@", "@"));
  const emp = await queryOne<{ id: number }>("select id from employees where lower(email) = any($1) and clerk_user_id is null", [emails]);
  if (!emp) return "unknown";
  await query("update employees set clerk_user_id = $1 where id = $2", [userId, emp.id]);
  return emp.id;
}

/** The signed-in employee, or null. Does not redirect. */
export async function getMe(): Promise<Me | null> {
  const id = await sessionEmployeeId();
  if (typeof id !== "number") return null;
  const me = await loadEmployeeSession(id);
  if (!me || !me.can_login) return null;
  return me;
}

/** Use on every page and action: sends the visitor to login, or to access-denied after their last working day. */
export async function requireUser(): Promise<Me> {
  const id = await sessionEmployeeId();
  if (id === "none") redirect("/login");
  if (id === "unknown") redirect("/access-denied");
  const me = await loadEmployeeSession(id);
  if (!me) redirect("/login");
  if (!me.can_login) redirect("/access-denied");
  return me;
}

export async function requireHR(): Promise<Me> {
  const me = await requireUser();
  if (!me.is_hr_admin) redirect("/access-denied");
  return me;
}

export async function requireManagerOrHR(): Promise<Me> {
  const me = await requireUser();
  if (!me.is_hr_admin && !me.is_manager) redirect("/access-denied");
  return me;
}

/** HR can act on anyone; a manager only on their direct reports. Nobody acts on themselves here. */
export async function canManageEmployee(me: Me, employeeId: number): Promise<boolean> {
  if (employeeId === me.id) return false;
  if (me.is_hr_admin) return true;
  const row = await queryOne<{ id: number }>("select id from employees where id = $1 and reporting_manager_id = $2", [
    employeeId,
    me.id,
  ]);
  return !!row;
}
