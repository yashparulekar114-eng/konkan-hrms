import type { PGlite } from "@electric-sql/pglite";
import { addDays, dayOfWeek, todayIST } from "../../src/lib/ist";

// Seed: 2 locations, 4 departments, 20 employees (1 HR Admin, 3 managers), this year's holidays,
// leave types, opening balances, plus two months of sample attendance and a few leave requests.
// Runs automatically the first time the app starts with an empty database.

const PANAJI = 1;
const VERNA = 2;
const WEEKLY_OFFS: Record<number, number[]> = { [PANAJI]: [0, 6], [VERNA]: [0] };

// [month-day, name, type, locations]
const HOLIDAYS: [string, string, string, number[]][] = [
  ["01-26", "Republic Day", "National", [PANAJI, VERNA]],
  ["03-04", "Holi", "Optional", [PANAJI, VERNA]],
  ["03-20", "Shigmo (plant)", "State", [VERNA]],
  ["04-03", "Good Friday", "State", [PANAJI, VERNA]],
  ["05-30", "Goa Statehood Day", "State", [PANAJI]],
  ["08-15", "Independence Day", "National", [PANAJI, VERNA]],
  ["09-14", "Ganesh Chaturthi", "State", [PANAJI, VERNA]],
  ["10-02", "Gandhi Jayanti", "National", [PANAJI, VERNA]],
  ["11-09", "Diwali (Narak Chaturdashi)", "State", [PANAJI, VERNA]],
  ["12-03", "Feast of St. Francis Xavier", "State", [PANAJI]],
  ["12-19", "Goa Liberation Day", "State", [PANAJI, VERNA]],
  ["12-25", "Christmas", "National", [PANAJI, VERNA]],
];

type SeedEmp = [string, string, number, number, string, number | null, string, string];
// [name, gender, department, location, designation, manager (row number), dob, date of joining ('Y' = this year)]
const EMPLOYEES: SeedEmp[] = [
  ["Anjali Naik", "Female", 1, PANAJI, "HR Manager", 2, "1985-04-12", "2015-06-01"],
  ["Rohan Kamat", "Male", 2, PANAJI, "Sales & Admin Manager", null, "1983-09-20", "2014-03-10"],
  ["Suresh Gaonkar", "Male", 3, VERNA, "Plant Manager", null, "1980-01-15", "2012-08-01"],
  ["Priya Dessai", "Female", 4, VERNA, "Quality Manager", null, "1987-11-05", "2016-02-15"],
  ["Neha Fernandes", "Female", 1, PANAJI, "HR Executive", 2, "1995-02-28", "2021-01-04"],
  ["Ravi Shetye", "Male", 2, PANAJI, "Sales Executive", 2, "1993-07-19", "2019-05-13"],
  ["Kavya Sawant", "Female", 2, PANAJI, "Accounts Assistant", 2, "2001-03-08", "Y-07-01"],
  ["Amit Prabhu", "Male", 2, PANAJI, "Purchase Officer", 2, "1990-12-01", "2018-09-03"],
  ["Sneha Kerkar", "Female", 2, PANAJI, "Marketing Executive", 2, "1997-06-22", "2022-04-18"],
  ["Mahesh Parab", "Male", 2, PANAJI, "Office Assistant", 2, "1989-10-10", "2017-01-09"],
  ["Ganesh Naik", "Male", 3, VERNA, "Production Supervisor", 3, "1986-05-05", "2013-11-11"],
  ["Sanjay Gawas", "Male", 3, VERNA, "Machine Operator", 3, "1992-08-14", "2018-02-01"],
  ["Deepak Velip", "Male", 3, VERNA, "Machine Operator", 3, "1996-01-30", "2020-10-05"],
  ["Rekha Gaude", "Female", 3, VERNA, "Packing Staff", 3, "1998-09-09", "2021-07-12"],
  ["Vinod Harmalkar", "Male", 3, VERNA, "Store Keeper", 3, "1984-03-03", "2015-12-01"],
  ["Pooja Naik", "Female", 3, VERNA, "Packing Staff", 3, "2000-11-11", "2023-03-20"],
  ["Shweta Borkar", "Female", 4, VERNA, "QA Executive", 4, "1994-04-04", "2019-08-19"],
  ["Nikhil Salgaonkar", "Male", 4, VERNA, "Lab Technician", 4, "1995-12-12", "2020-01-06"],
  ["Fatima Shaikh", "Female", 4, VERNA, "QC Inspector", 4, "1993-02-14", "2018-06-25"],
  ["Joel D'Souza", "Male", 4, VERNA, "Hygiene Officer", 4, "1991-07-07", "2017-10-16"],
];

const RAVI = 6;
const MAHESH = 10; // exited employee

const POLICY: [string, string][] = [
  ["Leave year", "The leave year runs from 1 January to 31 December. Leave days are working days only: weekly offs and holidays inside a leave period are never counted as leave. Konkan Coastal Foods has no sandwich rule."],
  ["Casual Leave (CL)", "8 days a year, credited on 1 January. Employees who join during the year get a pro-rated share for the months left in the year (the joining month counts if they join on or before the 15th), rounded to the nearest half day. Half days are allowed. Unused CL lapses on 31 December."],
  ["Sick Leave (SL)", "7 days a year, credited on 1 January and pro-rated for joiners in the same way as CL. Half days are allowed. Unused SL lapses on 31 December. Sick Leave of more than 2 consecutive days needs a medical certificate upload."],
  ["Earned Leave (EL)", "15 days a year, earned at 1.25 days per completed month of service in the year. Half days are not allowed. Up to 30 days of unused EL carry forward to the next year."],
  ["Maternity Leave", "As per the Maternity Benefit Act, 1961 (amended 2017): up to 26 weeks for a woman employee, granted on request. Not carried forward. Half days are not allowed."],
  ["Paternity Leave", "5 days, company policy, granted on request to male employees. Not carried forward. Half days are not allowed."],
  ["Loss of Pay (LOP)", "Unpaid leave with no limit. Half days are allowed. If an employee applies for more leave than their balance, the extra days can be converted to LOP."],
  ["Applying for leave", "Leave cannot be applied more than 30 days in the past. An employee cannot apply for more than their available balance; the app offers to convert the excess to LOP. The balance changes only when the manager approves. Pending leave, or approved leave that has not started, can be cancelled and the balance is restored. A manager cannot approve their own leave."],
  ["Working days and weekly offs", "Head office (Panaji): Monday to Friday, weekly offs Saturday and Sunday. Plant (Verna): Monday to Saturday, weekly off Sunday. A Saturday is a working day at the plant but not at the head office."],
  ["Day status", "Worked 8 hours or more: Present. Worked 4 to under 8 hours: Half Day. Under 4 hours or no punch: Absent. A day with approved leave is On Leave, even if the employee also punched in. A work-from-home day counts as Present."],
  ["Late marks", "Check-in after 10:15 AM is marked Late. Three Late marks in a calendar month convert into one half day of Loss of Pay."],
  ["Missed punch (regularisation)", "If an employee forgets to check in or out, they can request a correction with a reason. The attendance changes only after the manager approves it."],
  ["Holidays", "Holidays are set per location (Panaji and Verna) and marked National, State or Optional. National and State holidays are days off for that location. Optional (restricted) holidays are shown on the calendar but are normal working days unless the employee takes leave."],
];

export async function seedDatabase(db: PGlite): Promise<void> {
  const today = todayIST();
  const year = Number(today.slice(0, 4));
  const q = (sql: string, params: unknown[] = []) => db.query(sql, params);

  await q(`insert into locations (name, city, state, weekly_off_days) values
    ('Panaji', 'Panaji', 'Goa', '{0,6}'), ('Verna', 'Verna', 'Goa', '{0}')`);
  await q(`insert into departments (name) values ('Human Resources'), ('Sales & Admin'), ('Production'), ('Quality')`);

  const holidaySet: Record<number, Set<string>> = { [PANAJI]: new Set(), [VERNA]: new Set() };
  for (const [md, name, type, locs] of HOLIDAYS) {
    for (const loc of locs) {
      const date = `${year}-${md}`;
      await q("insert into holidays (location_id, date, name, type) values ($1, $2, $3, $4)", [loc, date, name, type]);
      if (type !== "Optional") holidaySet[loc].add(date);
    }
  }
  const isWorkingDay = (loc: number, d: string) => !WEEKLY_OFFS[loc].includes(dayOfWeek(d)) && !holidaySet[loc].has(d);
  const workingDaysFrom = (loc: number, start: string, n: number) => {
    const out: string[] = [];
    for (let d = start; out.length < n; d = addDays(d, 1)) if (isWorkingDay(loc, d)) out.push(d);
    return out;
  };

  // Employees (managers are linked after everyone exists).
  for (let i = 0; i < EMPLOYEES.length; i++) {
    const [name, gender, dept, loc, designation, , dob, dojRaw] = EMPLOYEES[i];
    const n = i + 1;
    const doj = dojRaw.replace("Y", String(year));
    const first = name.split(" ")[0].toLowerCase();
    const lwd = n === MAHESH ? `${year}-09-30` : null;
    await q(
      `insert into employees (employee_code, full_name, email, mobile, dob, gender, address, city, state, pin_code,
         emergency_name, emergency_phone, emergency_relation, date_of_joining, last_working_day, designation,
         salary_grade, department_id, location_id, is_hr_admin, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'Goa',$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        `KCF${String(n).padStart(4, "0")}`, name, `${first}.${name.split(" ")[1].toLowerCase().replace(/[^a-z]/g, "")}@konkanfoods.in`,
        `98${String(22000000 + n * 137).padStart(8, "0")}`, dob, gender,
        `House ${n}, Ward ${(n % 7) + 1}`, loc === PANAJI ? "Panaji" : "Verna", loc === PANAJI ? "403001" : "403722",
        "Family contact", `97${String(33000000 + n * 211).padStart(8, "0")}`, "Spouse",
        doj, lwd, designation, n <= 4 ? "M2" : "E1", dept, loc, n === 1, lwd ? "inactive" : "active",
      ],
    );
    await q("insert into employee_statutory (employee_id, pan, aadhaar, uan) values ($1, $2, $3, $4)", [
      n,
      `ABC${"PQRSTUVWXYZ"[n % 11]}${name[0]}${String(1000 + n * 37).slice(-4)}${"ABCDEFGHJK"[n % 10]}`,
      String(234500000000 + n * 1013579),
      n === 7 ? null : String(100900000000 + n * 7919),
    ]);
    await q("insert into employee_bank (employee_id, account_number, ifsc, bank_name) values ($1, $2, $3, $4)", [
      n,
      String(501000000000 + n * 104729),
      n % 2 ? "SBIN0001234" : "HDFC0000456",
      n % 2 ? "State Bank of India" : "HDFC Bank",
    ]);
  }
  for (let i = 0; i < EMPLOYEES.length; i++) {
    const manager = EMPLOYEES[i][5];
    if (manager) await q("update employees set reporting_manager_id = $1 where id = $2", [manager, i + 1]);
  }

  await q(`insert into leave_types (code, name, annual_quota, accrual_method, monthly_rate, carry_forward_max, half_day_allowed, gender) values
    ('CL', 'Casual Leave', 8, 'yearly_prorated', 0, 0, true, null),
    ('SL', 'Sick Leave', 7, 'yearly_prorated', 0, 0, true, null),
    ('EL', 'Earned Leave', 15, 'monthly', 1.25, 30, false, null),
    ('ML', 'Maternity Leave', 182, 'on_request', 0, 0, false, 'Female'),
    ('PL', 'Paternity Leave', 5, 'on_request', 0, 0, false, 'Male'),
    ('LOP', 'Loss of Pay', null, 'none', 0, 0, true, null)`);

  // Opening balances: only EL carries forward (up to 30 days); CL and SL lapse, so they open at 0.
  for (let n = 1; n <= EMPLOYEES.length; n++) {
    const joinedThisYear = EMPLOYEES[n - 1][7].startsWith("Y");
    for (let t = 1; t <= 6; t++) {
      const opening = t === 3 && !joinedThisYear ? Math.min(30, ((n * 3) % 20) + 2) : 0;
      await q("insert into leave_balances (employee_id, leave_type_id, year, opening) values ($1, $2, $3, $4)", [n, t, year, opening]);
    }
  }

  for (const [topic, body] of POLICY) await q("insert into policy_text (topic, body) values ($1, $2)", [topic, body]);

  // Sample leave requests. [employee, type id, start date, working days, status, half day]
  const [ty, tm] = today.split("-").map(Number);
  const prevMonthStart = tm === 1 ? `${ty - 1}-12-01` : `${ty}-${String(tm - 1).padStart(2, "0")}-01`;
  const leaves: [number, number, string, number, string, boolean][] = [
    [RAVI, 1, addDays(prevMonthStart, 9), 2, "approved", false],
    [12, 2, addDays(prevMonthStart, 19), 1, "approved", false],
    [13, 1, addDays(`${today.slice(0, 7)}-01`, 4), 1, "approved", false],
    [5, 1, addDays(today, 7), 2, "pending", false],
    [11, 3, addDays(today, 10), 3, "approved", false],
    [19, 1, addDays(today, 3), 1, "pending", true],
  ];
  const leaveDays = new Set<string>();
  for (const [emp, type, start, n, status, half] of leaves) {
    const loc = EMPLOYEES[emp - 1][3];
    const days = workingDaysFrom(loc, start, n);
    const manager = EMPLOYEES[emp - 1][5];
    await q(
      `insert into leave_requests (employee_id, leave_type_id, from_date, to_date, is_half_day, days, reason, status, approver_id, approver_comment)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [emp, type, days[0], days[days.length - 1], half, half ? 0.5 : n, "Personal work", status,
        status === "approved" ? manager : null, status === "approved" ? "Approved" : null],
    );
    if (status === "approved") days.forEach((d) => leaveDays.add(`${emp}:${d}`));
  }

  let regularisationSeeded = false;
  // Sample attendance from the start of last month up to yesterday (today is left for you to check in).
  for (let n = 1; n <= EMPLOYEES.length; n++) {
    const loc = EMPLOYEES[n - 1][3];
    const doj = EMPLOYEES[n - 1][7].replace("Y", String(year));
    const lwd = n === MAHESH ? `${year}-09-30` : "9999-12-31";
    for (let d = prevMonthStart, k = 0; d < today; d = addDays(d, 1), k++) {
      if (d < doj || d > lwd || !isWorkingDay(loc, d) || leaveDays.has(`${n}:${d}`)) continue;
      const r = (n * 7 + k * 13) % 20;
      let inT = "09:15", outT: string | null = "18:00", wfh = false;
      if (r === 0) continue; // absent, no punch
      if (r === 1 || (n === RAVI && k % 6 === 0)) { inT = "10:20"; outT = "18:45"; } // late
      else if (r === 2) { inT = "09:30"; outT = "14:30"; } // 5 hours = half day
      else if (r === 3 && loc === PANAJI) { wfh = true; }
      else if (r === 4) { inT = "09:35"; outT = null; } // missed check-out
      await q(
        `insert into attendance (employee_id, date, check_in, check_out, is_wfh, is_late) values ($1, $2, $3, $4, $5, $6)`,
        [n, d, wfh ? null : `${d}T${inT}:00+05:30`, wfh || !outT ? null : `${d}T${outT}:00+05:30`, wfh, !wfh && inT > "10:15"],
      );
      if (n === 8 && !outT && !wfh && !regularisationSeeded) {
        regularisationSeeded = true;
        await q(
          `insert into regularisation_requests (employee_id, date, requested_in, requested_out, reason) values ($1, $2, $3, $4, $5)`,
          [n, d, `${d}T${inT}:00+05:30`, `${d}T18:05:00+05:30`, "Forgot to check out at the gate"],
        );
      }
    }
  }
}
