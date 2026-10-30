// Indian field rules from requirements.pdf. Each check returns an error message, or null when the value is fine.

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const AADHAAR_RE = /^[0-9]{12}$/;
export const UAN_RE = /^[0-9]{12}$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const MOBILE_RE = /^[6-9][0-9]{9}$/;
export const PIN_RE = /^[0-9]{6}$/;
export const ACCOUNT_RE = /^[0-9]{9,18}$/;

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi",
  "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

export function checkPan(v: string) {
  return PAN_RE.test(v) ? null : "PAN must be 10 characters: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).";
}
export function checkAadhaar(v: string) {
  return AADHAAR_RE.test(v) ? null : "Aadhaar must be exactly 12 digits.";
}
export function checkUan(v: string) {
  return v === "" || UAN_RE.test(v) ? null : "UAN must be exactly 12 digits (or leave it blank for a new joiner).";
}
export function checkIfsc(v: string) {
  return IFSC_RE.test(v) ? null : "IFSC must be 11 characters: 4 letters, then 0, then 6 letters or digits (e.g. SBIN0001234).";
}
export function checkMobile(v: string, label = "Mobile") {
  return MOBILE_RE.test(v) ? null : `${label} must be 10 digits starting with 6, 7, 8 or 9.`;
}
export function checkPin(v: string) {
  return PIN_RE.test(v) ? null : "PIN code must be 6 digits.";
}
export function checkAccount(v: string) {
  return ACCOUNT_RE.test(v) ? null : "Bank account number must be 9 to 18 digits.";
}
export function checkState(v: string) {
  return INDIAN_STATES.includes(v) ? null : "Pick a state or UT from the list.";
}

/** The employee must be at least 18 years old on the date of joining. */
export function checkAge(dob: string, doj: string) {
  if (!dob || !doj) return "Date of birth and date of joining are required.";
  const [y, m, d] = dob.split("-").map(Number);
  const eighteenth = `${y + 18}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return eighteenth <= doj ? null : "Employee must be at least 18 years old on the date of joining.";
}

/** Returns the first error message from a list of checks. */
export function firstError(...results: (string | null)[]): string | null {
  return results.find((r) => r) ?? null;
}
