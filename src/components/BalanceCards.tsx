import type { Balance } from "@/modules/leave/balance";

export function BalanceCards({ balances, detailed = false }: { balances: Balance[]; detailed?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {balances.map((b) => (
        <div key={b.type.id} className="rounded-md border border-slate-200 p-3">
          <p className="text-xs font-medium text-slate-500">{b.type.name}</p>
          <p className="text-2xl font-bold text-teal-800">{b.available === null ? "No limit" : b.available}</p>
          <p className="text-xs text-slate-500">available</p>
          {detailed && (
            <dl className="mt-2 grid grid-cols-2 gap-x-2 text-xs text-slate-600">
              <dt>Opening</dt><dd className="text-right">{b.opening}</dd>
              <dt>Accrued</dt><dd className="text-right">{b.accrued ?? "-"}</dd>
              <dt>Used</dt><dd className="text-right">{b.used}</dd>
              <dt>Pending</dt><dd className="text-right">{b.pending}</dd>
            </dl>
          )}
          {!detailed && b.pending > 0 && <p className="text-xs text-amber-700">{b.pending} pending</p>}
        </div>
      ))}
    </div>
  );
}
