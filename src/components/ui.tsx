import type { ReactNode } from "react";

// Shared look: one place for buttons, cards, form fields and status colours.

export const btn = "inline-flex items-center justify-center rounded-md bg-pink-700 px-4 py-2 text-sm font-medium text-white hover:bg-pink-800 disabled:opacity-50";
export const btnSecondary = "inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
export const btnDanger = "inline-flex items-center justify-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50";
export const input = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none";
export const link = "text-blue-700 underline-offset-2 hover:underline";

export function Card({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold text-slate-800">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-bold text-slate-900">{children}</h1>
      {sub && <p className="mt-1 text-sm text-slate-600">{sub}</p>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-md bg-slate-50 p-4 text-center text-sm text-slate-500">{children}</p>;
}

export function Notice({ kind = "info", children }: { kind?: "info" | "error" | "success"; children: ReactNode }) {
  const styles = { info: "bg-sky-50 text-sky-800 border-sky-200", error: "bg-red-50 text-red-800 border-red-200", success: "bg-green-50 text-green-800 border-green-200" };
  return <p className={`rounded-md border px-3 py-2 text-sm ${styles[kind]}`}>{children}</p>;
}

// The same colour for each status on every screen.
export const STATUS_COLORS: Record<string, string> = {
  Present: "bg-green-100 text-green-800 border-green-300",
  "Half Day": "bg-amber-100 text-amber-800 border-amber-300",
  Absent: "bg-red-100 text-red-800 border-red-300",
  "On Leave": "bg-blue-100 text-blue-800 border-blue-300",
  Holiday: "bg-purple-100 text-purple-800 border-purple-300",
  "Weekly Off": "bg-slate-200 text-slate-700 border-slate-300",
  Late: "bg-orange-100 text-orange-800 border-orange-300",
  "Checked In": "bg-blue-100 text-blue-800 border-blue-300",
  pending: "bg-amber-100 text-amber-800 border-amber-300",
  approved: "bg-green-100 text-green-800 border-green-300",
  rejected: "bg-red-100 text-red-800 border-red-300",
  cancelled: "bg-slate-200 text-slate-700 border-slate-300",
};

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-slate-400">-</span>;
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? "bg-slate-100 text-slate-700"}`}>{status}</span>;
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
            {head.map((h) => (
              <th key={h} className="px-2 py-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-2 py-2 align-top ${className}`}>{children}</td>;
}
