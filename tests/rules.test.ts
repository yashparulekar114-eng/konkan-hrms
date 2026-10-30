import { describe, expect, it } from "vitest";
import { computeDay, statusFromHours, summariseMonth, type DayInfo } from "../src/modules/attendance/rules";
import { accruedFor, completedMonths, type LeaveType } from "../src/modules/leave/accrual";
import { checkAge, checkIfsc, checkMobile, checkPan } from "../src/lib/validation";
import { maskAadhaar, maskAccount, maskPan } from "../src/lib/mask";

const t = (ymd: string, hhmm: string) => new Date(`${ymd}T${hhmm}:00+05:30`);
const base = { today: "2026-10-30", dateOfJoining: "2020-01-01", lastWorkingDay: null, isWeeklyOff: false, holiday: null, leave: null };

describe("employee validation", () => {
  it("rejects bad PAN, IFSC and a 9-digit mobile", () => {
    expect(checkPan("ABC123")).not.toBeNull();
    expect(checkPan("ABCDE1234F")).toBeNull();
    expect(checkIfsc("SBIN1234567")).not.toBeNull();
    expect(checkIfsc("SBIN0001234")).toBeNull();
    expect(checkMobile("987654321")).not.toBeNull();
    expect(checkMobile("5876543210")).not.toBeNull();
    expect(checkMobile("9876543210")).toBeNull();
  });
  it("rejects an employee aged 17 on the joining date", () => {
    expect(checkAge("2009-06-01", "2026-05-31")).not.toBeNull();
    expect(checkAge("2008-05-31", "2026-05-31")).toBeNull();
  });
  it("masks sensitive numbers", () => {
    expect(maskPan("ABCDE1234F")).toBe("ABCDE****F");
    expect(maskAadhaar("123456781234")).toBe("XXXX XXXX 1234");
    expect(maskAccount("501000123456")).toBe("XXXXXX3456");
  });
});

describe("day status", () => {
  it("8 hours = Present, 5 hours = Half Day, 3 hours = Absent", () => {
    expect(statusFromHours(8)).toBe("Present");
    expect(statusFromHours(5)).toBe("Half Day");
    expect(statusFromHours(3)).toBe("Absent");
    expect(statusFromHours(null)).toBe("Absent");
  });
  it("approved leave wins over punches", () => {
    const d = computeDay({ ...base, date: "2026-10-20", leave: { code: "CL", amount: 1, lopAmount: 0, halfDay: false }, attendance: { check_in: t("2026-10-20", "09:00"), check_out: t("2026-10-20", "18:00"), is_wfh: false, is_late: false } });
    expect(d.status).toBe("On Leave");
  });
  it("weekly off and holiday", () => {
    expect(computeDay({ ...base, date: "2026-10-24", isWeeklyOff: true, attendance: null }).status).toBe("Weekly Off");
    expect(computeDay({ ...base, date: "2026-10-02", holiday: { name: "Gandhi Jayanti", type: "National" }, attendance: null }).status).toBe("Holiday");
    // Optional holidays are working days
    expect(computeDay({ ...base, date: "2026-03-04", holiday: { name: "Holi", type: "Optional" }, attendance: null }).status).toBe("Absent");
  });
  it("WFH counts as Present", () => {
    expect(computeDay({ ...base, date: "2026-10-21", attendance: { check_in: null, check_out: null, is_wfh: true, is_late: false } }).status).toBe("Present");
  });
  it("three Late marks make half a day of LOP", () => {
    const late = (date: string): DayInfo => computeDay({ ...base, date, attendance: { check_in: t(date, "10:20"), check_out: t(date, "19:00"), is_wfh: false, is_late: true } });
    expect(summariseMonth([late("2026-10-05"), late("2026-10-06")]).lateLop).toBe(0);
    const s = summariseMonth([late("2026-10-05"), late("2026-10-06"), late("2026-10-07")]);
    expect(s.late).toBe(3);
    expect(s.lop).toBe(0.5);
    expect(s.present).toBe(3);
  });
});

describe("leave accrual", () => {
  const CL: LeaveType = { id: 1, code: "CL", name: "Casual Leave", annual_quota: 8, accrual_method: "yearly_prorated", monthly_rate: 0, carry_forward_max: 0, half_day_allowed: true, gender: null };
  const SL: LeaveType = { ...CL, id: 2, code: "SL", annual_quota: 7 };
  const EL: LeaveType = { ...CL, id: 3, code: "EL", annual_quota: 15, accrual_method: "monthly", monthly_rate: 1.25 };
  it("a 1 July joiner gets pro-rated CL and SL", () => {
    expect(accruedFor(CL, "2026-07-01", 2026, "2026-10-30")).toBe(4);
    expect(accruedFor(SL, "2026-07-01", 2026, "2026-10-30")).toBe(3.5);
    expect(accruedFor(CL, "2020-01-01", 2026, "2026-10-30")).toBe(8);
  });
  it("EL is 1.25 per completed month", () => {
    expect(completedMonths("2026-01-01", "2026-10-30")).toBe(9);
    expect(accruedFor(EL, "2020-01-01", 2026, "2026-10-30")).toBe(11.25);
    expect(accruedFor(EL, "2026-07-01", 2026, "2026-10-30")).toBe(3.75);
  });
});
