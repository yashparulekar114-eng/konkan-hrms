"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Notice } from "./ui";

type Result = { ok?: boolean; error?: string; message?: string } | void;

/**
 * A form that calls a server action and shows its error or success message.
 * Unlike a plain <form action>, it keeps what you typed when the server rejects the input.
 */
export function ActionForm({
  action,
  children,
  className = "space-y-3",
  resetOnSuccess = false,
  confirmText,
}: {
  action: (form: FormData) => Promise<Result>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirmText?: string;
}) {
  const [result, setResult] = useState<Result>(undefined);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirmText && !window.confirm(confirmText)) return;
        const form = e.currentTarget;
        const data = new FormData(form);
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.name) data.set(submitter.name, submitter.value);
        startTransition(async () => {
          const r = await action(data);
          setResult(r);
          if (r?.ok && resetOnSuccess) form.reset();
        });
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {pending && <p className="text-xs text-slate-500">Working...</p>}
      {result?.error && <Notice kind="error">{result.error}</Notice>}
      {result?.ok && result.message && <Notice kind="success">{result.message}</Notice>}
    </form>
  );
}
