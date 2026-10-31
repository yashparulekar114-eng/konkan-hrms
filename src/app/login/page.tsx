import { SignIn } from "@clerk/nextjs";
import { clerkEnabled } from "@/lib/auth";
import { query } from "@/lib/db";
import { loginAs } from "@/lib/session-actions";
import { ActionForm } from "@/components/ActionForm";
import { Logo } from "@/components/Nav";
import { Card, btn, input } from "@/components/ui";

export default async function LoginPage() {
  const people = await query<{ email: string; full_name: string; employee_code: string; designation: string; location: string; is_hr_admin: boolean; is_manager: boolean; exited: boolean }>(
    `select e.email, e.full_name, e.employee_code, e.designation, l.name as location, e.is_hr_admin,
            exists (select 1 from employees r where r.reporting_manager_id = e.id) as is_manager,
            (e.last_working_day is not null and e.last_working_day < current_date) as exited
       from employees e join locations l on l.id = e.location_id order by e.employee_code`,
  );
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-col items-center gap-1 py-4">
        <Logo />
        <p className="text-sm text-slate-600">Konkan Coastal Foods HR system</p>
      </div>
      {clerkEnabled ? (
        <div className="flex justify-center">
          <SignIn routing="hash" forceRedirectUrl="/" />
        </div>
      ) : (
      <Card title="Sign in with your work email">
        <ActionForm action={loginAs} className="flex gap-2">
          <input name="email" type="email" required placeholder="name@konkanfoods.in" className={input} />
          <button className={btn}>Sign in</button>
        </ActionForm>
        <p className="mt-2 text-xs text-slate-500">Localhost demo mode: no password. Your role comes from the database, not from this screen.</p>
      </Card>
      )}
      <Card title={clerkEnabled ? "Test logins: sign in with name+clerk_test@konkanfoods.in, code 424242" : "Demo users (click to sign in)"}>
        <div className="grid gap-2 sm:grid-cols-2">
          {people.map((p) => (
            clerkEnabled ? (
              <p key={p.email} className="rounded-md border border-slate-200 p-2 text-sm">
                <span className="font-medium">{p.full_name}</span>
                {p.is_hr_admin && <b className="ml-1 text-purple-700">HR Admin</b>}
                {p.is_manager && <b className="ml-1 text-pink-700">Manager</b>}
                {p.exited && <b className="ml-1 text-red-600">Exited</b>}
                <span className="block font-mono text-xs text-slate-500">{p.email.replace("@", "+clerk_test@")}</span>
              </p>
            ) : (
            <ActionForm key={p.email} action={loginAs} className="">
              <input type="hidden" name="email" value={p.email} />
              <button className="w-full rounded-md border border-slate-200 p-2 text-left text-sm hover:border-pink-500 hover:bg-pink-50">
                <span className="font-medium">{p.full_name}</span> <span className="text-slate-400">{p.employee_code}</span>
                <span className="block text-xs text-slate-500">
                  {p.designation}, {p.location}
                  {p.is_hr_admin && <b className="ml-1 text-purple-700">HR Admin</b>}
                  {p.is_manager && <b className="ml-1 text-pink-700">Manager</b>}
                  {p.exited && <b className="ml-1 text-red-600">Exited</b>}
                </span>
              </button>
            </ActionForm>
            )
          ))}
        </div>
      </Card>
    </div>
  );
}
