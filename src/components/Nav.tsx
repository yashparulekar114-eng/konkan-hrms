import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import type { Me } from "@/lib/auth";
import { logout } from "@/lib/session-actions";

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r="15" fill="#db2777" />
        <path d="M6 20c3-3 6-3 10 0s7 3 10 0" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M11 7v10M11 12l6-5M11 12l6 5" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </svg>
      <span className="text-lg font-bold text-white">KonkanHR</span>
    </span>
  );
}

export function Nav({ me, clerk }: { me: Me; clerk: boolean }) {
  const links: [string, string, boolean][] = [
    ["/", "Home", true],
    ["/profile", "My profile", true],
    ["/attendance", "My attendance", true],
    ["/leave", "My leave", true],
    ["/leave/apply", "Apply leave", true],
    ["/ask-hr", "Ask HR", true],
    ["/team", "Team attendance", me.is_manager || me.is_hr_admin],
    ["/approvals", "Approvals", me.is_manager || me.is_hr_admin],
    ["/leave/calendar", "Leave calendar", me.is_manager || me.is_hr_admin],
    ["/reports", "Reports", me.is_manager || me.is_hr_admin],
    ["/employees", "Employees", me.is_hr_admin],
    ["/settings", "Settings", me.is_hr_admin],
    ["/outbox", "Email outbox", true],
  ];
  const role = me.is_hr_admin ? "HR Admin" : me.is_manager ? "Manager" : "Employee";
  return (
    <header className="border-b border-pink-600 bg-black">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2">
        <Link href="/"><Logo /></Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-200">
            {me.full_name} <span className="text-slate-400">({me.employee_code}, {role}, {me.location_name})</span>
          </span>
          {clerk ? (
            <SignOutButton redirectUrl="/login">
              <button className="text-sky-300 hover:underline">Log out</button>
            </SignOutButton>
          ) : (
            <form action={logout}>
              <button className="text-sky-300 hover:underline">Log out</button>
            </form>
          )}
        </div>
      </div>
      <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2 text-sm">
        {links
          .filter(([, , show]) => show)
          .map(([href, label]) => (
            <Link key={href} href={href} className="whitespace-nowrap rounded-md px-2.5 py-1 text-slate-200 hover:bg-pink-700 hover:text-white">
              {label}
            </Link>
          ))}
      </nav>
    </header>
  );
}
