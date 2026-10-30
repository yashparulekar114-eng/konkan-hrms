"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { queryOne } from "./db";
import { loadEmployeeSession, SESSION_COOKIE } from "./auth";

/** Localhost sign-in: find the employee by email. A deactivated employee is sent to access-denied. */
export async function loginAs(form: FormData): Promise<{ error?: string }> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const emp = await queryOne<{ id: number }>("select id from employees where lower(email) = $1", [email]);
  if (!emp) return { error: "No employee with that email." };
  const session = await loadEmployeeSession(emp.id);
  if (!session?.can_login) redirect("/access-denied");
  (await cookies()).set(SESSION_COOKIE, String(emp.id), { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/");
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
