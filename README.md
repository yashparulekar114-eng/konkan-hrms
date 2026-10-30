# KonkanHR

HRMS for Konkan Coastal Foods (Panaji head office + Verna plant): Employee Master, Attendance, Leave,
a month-end attendance report (CSV) and an "Ask HR" AI assistant. College project.

## Run it on your laptop (localhost)

You need Node.js 20 or newer.

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. The first start creates the database and fills it with demo data (takes a few seconds).

No accounts or keys are needed for the main app. Only **Ask HR** needs a free Google Gemini key:
get one at https://aistudio.google.com, put `GOOGLE_GENERATIVE_AI_API_KEY=your-key` in `.env.local`, and restart.

## Put it online (Supabase + Clerk + Vercel, all free)

The app switches automatically: with `DATABASE_URL` it uses Supabase, with Clerk keys it uses Clerk sign-in.
Without them it runs the local demo mode described above.

1. **Supabase** (database): create a project at https://supabase.com (region: Mumbai). Click **Connect**, copy the
   **Transaction pooler** connection string, put your database password into it, and save it in `.env.local` as
   `DATABASE_URL=...`.
2. **Clerk** (sign-in): create an application at https://clerk.com with **Email** sign-in. Copy the two keys into
   `.env.local` as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.
3. **Create the tables and demo data**: run `npm run dev` and open http://localhost:3000 once. The first request
   creates all tables in Supabase (`supabase/migrations`) and runs the seed.
4. **Vercel** (hosting): sign in at https://vercel.com with GitHub, **Add New > Project**, import `konkan-hrms`,
   add the same variables (`DATABASE_URL`, both Clerk keys, and optionally `GOOGLE_GENERATIVE_AI_API_KEY` and
   `RESEND_API_KEY`) under **Environment Variables**, then **Deploy**.

## Test logins

**On the live site (Clerk):** sign in with the employee's email plus `+clerk_test`, for example
`ravi.shetye+clerk_test@konkanfoods.in`, and enter the code **424242**. These are Clerk's test emails for
development instances, so no real inbox is needed. The app strips `+clerk_test` and links you to that employee.

**On localhost demo mode:** click a name on the login page, no password.

| Role | Name | Email |
|------|------|-------|
| HR Admin | Anjali Naik (Panaji) | anjali.naik@konkanfoods.in |
| Manager (head office) | Rohan Kamat | rohan.kamat@konkanfoods.in |
| Manager (plant) | Suresh Gaonkar | suresh.gaonkar@konkanfoods.in |
| Manager (quality, plant) | Priya Dessai | priya.dessai@konkanfoods.in |
| Employee (head office) | Ravi Shetye | ravi.shetye@konkanfoods.in |
| Employee, joined 1 July (pro-rated leave) | Kavya Sawant | kavya.sawant@konkanfoods.in |
| Employee (plant, Saturday is a working day) | Sanjay Gawas | sanjay.gawas@konkanfoods.in |
| Exited employee (cannot log in) | Mahesh Parab | mahesh.parab@konkanfoods.in |

## How it is built (localhost version)

| Part | Used here | Why |
|------|-----------|-----|
| App | Next.js (App Router, TypeScript) | Pages + server actions in one project |
| Database | Supabase Postgres when `DATABASE_URL` is set; otherwise PGlite (Postgres inside Node, saved in `~/.konkan-hrms`) | Same SQL for both (`supabase/migrations`). RLS is on for every table |
| Login | Clerk when its keys are set; otherwise pick-your-employee demo login | The role always comes from our database, never from Clerk |
| Email | Saved in `email_log` and shown on the **Email outbox** page; also really sent if `RESEND_API_KEY` is set | Notifications can be checked without a mail account |
| AI | Google Gemini via the Vercel AI SDK, tool calling | Free tier |

Code is organised by module in `src/modules/` (employees, attendance, leave, reports, agent). Pages in `src/app/` are thin.

## Where the important rules live

- **Day status** (Present / Half Day / Absent / On Leave / Holiday / Weekly Off, Late, 3 Lates = ½ day LOP): `src/modules/attendance/rules.ts`
- **Working-day count** (location weekly offs + National/State holidays, no sandwich rule): `src/modules/attendance/holidays.ts`
- **Leave accrual and pro-rating**: `src/modules/leave/accrual.ts`; **balances** (calculated, never stored): `src/modules/leave/balance.ts`
- **Apply / approve / cancel**: `src/modules/leave/apply.ts`, `src/modules/leave/actions.ts`
- **Role checks** (on every page and action): `src/lib/auth.ts`
- **Masking**: `src/lib/mask.ts`. Validation of Indian fields: `src/lib/validation.ts`
- **Ask HR tools and guardrails**: `src/modules/agent/tools.ts`

## Tests

```bash
npm test
```

Agent attack prompts to run by hand: `tests/agent-prompts.md`.

## Reset the demo data

Local demo mode: stop the dev server and delete the `.konkan-hrms` folder in your user folder. The next `npm run dev` creates fresh data.
(This deletes everything you added, so only do it on purpose.)

## Live URL

Not deployed yet (localhost only).
