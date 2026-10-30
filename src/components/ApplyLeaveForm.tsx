"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { applyLeaveAction, previewLeaveAction } from "@/modules/leave/actions";
import type { LeavePreview, SubmitResult } from "@/modules/leave/apply";
import { Field, Notice, btn, input } from "./ui";

type TypeOption = { id: number; code: string; name: string; half_day_allowed: boolean; canApply: number | null };

export function ApplyLeaveForm({ types, today }: { types: TypeOption[]; today: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [typeId, setTypeId] = useState(types[0]?.id);
  const [preview, setPreview] = useState<LeavePreview | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [pending, start] = useTransition();
  const type = types.find((t) => t.id === Number(typeId));

  // Show working days and remaining balance before the user submits.
  function refreshPreview() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    if (!data.get("from_date")) return setPreview(null);
    previewLeaveAction(data).then(setPreview);
  }
  useEffect(refreshPreview, [typeId]);

  return (
    <form
      ref={formRef}
      className="space-y-3"
      onChange={() => { setResult(null); refreshPreview(); }}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        start(async () => {
          const r = await applyLeaveAction(data);
          setResult(r);
          if (r.ok) { formRef.current?.reset(); setPreview(null); }
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Leave type">
          <select name="leave_type_id" className={input} value={typeId} onChange={(e) => setTypeId(Number(e.target.value))}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.canApply === null ? "no limit" : `${t.canApply} left`})</option>
            ))}
          </select>
        </Field>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" name="is_half_day" disabled={!type?.half_day_allowed} />
          Half day {!type?.half_day_allowed && <span className="text-xs text-slate-500">(not allowed for this type)</span>}
        </label>
        <Field label="From"><input type="date" name="from_date" required className={input} defaultValue={today} /></Field>
        <Field label="To"><input type="date" name="to_date" required className={input} defaultValue={today} /></Field>
      </div>
      <Field label="Reason"><textarea name="reason" required rows={2} className={input} /></Field>

      {preview?.error && <Notice kind="error">{preview.error}</Notice>}
      {preview && !preview.error && (
        <Notice>
          <b>{preview.days}</b> working day(s) of {preview.typeName} (weekly offs and holidays not counted).
          {preview.canApply !== null && <> Balance you can use: <b>{preview.canApply}</b>; after this request: <b>{Math.max(0, (preview.canApply ?? 0) - (preview.days ?? 0))}</b>.</>}
          {preview.excess ? <> <b className="text-red-700">{preview.excess} day(s) more than your balance.</b></> : null}
        </Notice>
      )}
      {(preview?.needsCertificate || (preview?.typeCode === "SL" && (preview.days ?? 0) > 2)) && (
        <Field label="Medical certificate (required for Sick Leave over 2 days)">
          <input type="file" name="certificate" accept=".pdf,.jpg,.jpeg,.png" className={input} />
        </Field>
      )}
      {(preview?.excess || result?.needsLop) ? (
        <label className="flex items-center gap-2 rounded-md bg-amber-50 p-2 text-sm text-amber-900">
          <input type="checkbox" name="convert_to_lop" /> Convert the extra {preview?.excess ?? result?.preview?.excess} day(s) to Loss of Pay (LOP)
        </label>
      ) : null}

      <button className={`${btn} w-full sm:w-auto`} disabled={pending}>{pending ? "Sending..." : "Apply"}</button>
      {result?.error && <Notice kind="error">{result.error}</Notice>}
      {result?.ok && <Notice kind="success">{result.message}</Notice>}
    </form>
  );
}
