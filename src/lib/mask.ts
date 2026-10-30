// Masking for sensitive numbers. Used on every screen and in every CSV.

export function maskPan(pan: string | null | undefined): string {
  if (!pan) return "-";
  return `${pan.slice(0, 5)}****${pan.slice(9)}`;
}

export function maskAadhaar(aadhaar: string | null | undefined): string {
  if (!aadhaar) return "-";
  return `XXXX XXXX ${aadhaar.slice(-4)}`;
}

export function maskAccount(account: string | null | undefined): string {
  if (!account) return "-";
  return `XXXXXX${account.slice(-4)}`;
}
