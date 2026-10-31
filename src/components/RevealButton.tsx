"use client";

import { useState, useTransition } from "react";
import { revealSensitive } from "@/modules/employees/actions";

/** HR only: shows the full value after a click. The server checks the role and logs every reveal. */
export function RevealButton({ employeeId, field, masked }: { employeeId: number; field: "pan" | "aadhaar" | "account_number"; masked: string }) {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono">{value ?? masked}</span>
      {value ? (
        <button type="button" className="text-xs text-blue-700 underline" onClick={() => setValue(null)}>Hide</button>
      ) : (
        <button
          type="button"
          disabled={pending}
          className="text-xs text-blue-700 underline"
          onClick={() =>
            start(async () => {
              const r = await revealSensitive(employeeId, field);
              if (r.value) setValue(r.value);
              else setError(r.error ?? "Not allowed");
            })
          }
        >
          Reveal (logged)
        </button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
