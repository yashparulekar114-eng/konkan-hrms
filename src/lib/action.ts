// What every server action returns to the form that called it.
export type ActionResult = { ok?: boolean; error?: string; message?: string; data?: unknown } | void;

export function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

export function num(form: FormData, key: string): number {
  return Number(form.get(key));
}
