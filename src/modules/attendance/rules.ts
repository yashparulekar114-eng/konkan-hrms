// Pure attendance rules (no database), so they are easy to test.

export type Status = "Present" | "Half Day" | "Absent" | "On Leave" | "Holiday" | "Weekly Off" | "Checked In";

export const LATE_AFTER_MINUTES = 10 * 60 + 15; // check-in after 10:15 AM IST is Late

export type DayLeave = { code: string; amount: number; lopAmount: number; halfDay: boolean };

export type DayInfo = {
  date: string;
  status: Status | null; // null = not employed yet / already exited / future / not marked yet today
  isLate: boolean;
  isWfh: boolean;
  checkIn: Date | null;
  checkOut: Date | null;
  hours: number | null;
  holidayName: string | null;
  leave: DayLeave | null;
};

export function hoursWorked(checkIn: Date | null, checkOut: Date | null): number | null {
  if (!checkIn || !checkOut) return null;
  return Math.max(0, (checkOut.getTime() - checkIn.getTime()) / 3_600_000);
}

/** 8h or more = Present, 4h to under 8h = Half Day, under 4h or a missing punch = Absent. */
export function statusFromHours(hours: number | null): "Present" | "Half Day" | "Absent" {
  if (hours === null) return "Absent";
  if (hours >= 8) return "Present";
  if (hours >= 4) return "Half Day";
  return "Absent";
}

export function computeDay(input: {
  date: string;
  today: string;
  dateOfJoining: string;
  lastWorkingDay: string | null;
  isWeeklyOff: boolean;
  holiday: { name: string; type: string } | null;
  leave: DayLeave | null;
  attendance: { check_in: Date | null; check_out: Date | null; is_wfh: boolean; is_late: boolean } | null;
}): DayInfo {
  const { date, today, attendance: a } = input;
  const day: DayInfo = {
    date,
    status: null,
    isLate: !!a?.is_late,
    isWfh: !!a?.is_wfh,
    checkIn: a?.check_in ?? null,
    checkOut: a?.check_out ?? null,
    hours: hoursWorked(a?.check_in ?? null, a?.check_out ?? null),
    holidayName: input.holiday?.name ?? null,
    leave: null,
  };
  if (date < input.dateOfJoining || (input.lastWorkingDay && date > input.lastWorkingDay)) return day;
  const isOffHoliday = input.holiday && input.holiday.type !== "Optional";
  if (isOffHoliday) return { ...day, status: "Holiday", isLate: false };
  if (input.isWeeklyOff) return { ...day, status: "Weekly Off", isLate: false };
  if (input.leave) return { ...day, status: "On Leave", leave: input.leave, isLate: false }; // leave wins over punches
  if (date > today) return day;
  if (a?.is_wfh) return { ...day, status: "Present" };
  if (date === today && (!a || !a.check_out)) return { ...day, status: a?.check_in ? "Checked In" : null };
  return { ...day, status: statusFromHours(day.hours) };
}

export type MonthSummary = {
  present: number;
  wfh: number;
  halfDays: number;
  absent: number;
  late: number;
  lateLop: number;
  leave: Record<string, number>; // CL, SL, EL, ML, PL
  lop: number; // absent days + half-day halves + LOP leave + late-mark LOP
  holidays: number;
  weeklyOffs: number;
};

/** Adds up a month of days. The calendar and the CSV both use this, so their totals always match. */
export function summariseMonth(days: DayInfo[]): MonthSummary {
  const s: MonthSummary = { present: 0, wfh: 0, halfDays: 0, absent: 0, late: 0, lateLop: 0, leave: {}, lop: 0, holidays: 0, weeklyOffs: 0 };
  for (const d of days) {
    if (d.isLate && d.status !== null) s.late++;
    switch (d.status) {
      case "Holiday": s.holidays++; break;
      case "Weekly Off": s.weeklyOffs++; break;
      case "Present": s.present++; if (d.isWfh) s.wfh++; break;
      case "Half Day": s.present += 0.5; s.halfDays++; s.lop += 0.5; break;
      case "Absent": s.absent++; s.lop += 1; break;
      case "On Leave": {
        const l = d.leave!;
        if (l.code === "LOP") s.lop += l.amount + l.lopAmount;
        else {
          s.leave[l.code] = (s.leave[l.code] ?? 0) + l.amount;
          s.lop += l.lopAmount;
        }
        if (l.halfDay) {
          // The other half of a half-day leave: worked if they punched in or worked from home, else LOP.
          if (d.checkIn || d.isWfh) s.present += 0.5;
          else s.lop += 0.5;
        }
        break;
      }
    }
  }
  s.lateLop = Math.floor(s.late / 3) * 0.5; // every 3 Late marks = half a day of LOP
  s.lop += s.lateLop;
  return s;
}
