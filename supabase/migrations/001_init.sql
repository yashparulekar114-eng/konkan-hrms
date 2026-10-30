-- Konkan Coastal Foods HRMS: all tables.
-- Works on Supabase Postgres and on PGlite (the local Postgres used for localhost).

create table locations (
  id serial primary key,
  name text not null unique,              -- 'Panaji' (head office) or 'Verna' (plant)
  city text not null,
  state text not null,
  weekly_off_days int[] not null          -- 0 = Sunday ... 6 = Saturday
);

create table departments (
  id serial primary key,
  name text not null unique
);

create table employees (
  id serial primary key,
  employee_code text not null unique,     -- KCF0001, generated, never changes
  full_name text not null,
  email text not null unique,
  mobile text not null check (mobile ~ '^[6-9][0-9]{9}$'),
  dob date not null,
  gender text not null check (gender in ('Male', 'Female', 'Other')),
  address text not null default '',
  city text not null default '',
  state text not null default '',
  pin_code text not null default '' check (pin_code = '' or pin_code ~ '^[0-9]{6}$'),
  emergency_name text not null default '',
  emergency_phone text not null default '',
  emergency_relation text not null default '',
  date_of_joining date not null,
  last_working_day date,
  designation text not null,
  salary_grade text not null default '',
  department_id int not null references departments(id),
  location_id int not null references locations(id),
  reporting_manager_id int references employees(id),
  is_hr_admin boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive')),
  check (reporting_manager_id is null or reporting_manager_id <> id),
  check (dob <= date_of_joining - interval '18 years')
);

-- Statutory and bank details live in their own tables so row-level security can lock them down.
create table employee_statutory (
  employee_id int primary key references employees(id),
  pan text not null check (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  aadhaar text not null check (aadhaar ~ '^[0-9]{12}$'),
  uan text check (uan is null or uan ~ '^[0-9]{12}$')
);

create table employee_bank (
  employee_id int primary key references employees(id),
  account_number text not null check (account_number ~ '^[0-9]{9,18}$'),
  ifsc text not null check (ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  bank_name text not null
);

alter table employee_statutory enable row level security;
alter table employee_bank enable row level security;

create table holidays (
  id serial primary key,
  location_id int not null references locations(id),
  date date not null,
  name text not null,
  type text not null check (type in ('National', 'State', 'Optional')),
  unique (location_id, date)
);

create table attendance (
  id serial primary key,
  employee_id int not null references employees(id),
  date date not null,
  check_in timestamptz,
  check_out timestamptz,
  is_wfh boolean not null default false,
  is_late boolean not null default false,
  unique (employee_id, date)              -- one record per employee per day
);

create table regularisation_requests (
  id serial primary key,
  employee_id int not null references employees(id),
  date date not null,
  requested_in timestamptz not null,
  requested_out timestamptz not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approver_id int references employees(id),
  approver_comment text,
  created_at timestamptz not null default now()
);

create table leave_types (
  id serial primary key,
  code text not null unique,              -- CL, SL, EL, ML, PL, LOP
  name text not null,
  annual_quota numeric,                   -- null = unlimited (LOP)
  accrual_method text not null check (accrual_method in ('yearly_prorated', 'monthly', 'on_request', 'none')),
  monthly_rate numeric not null default 0,
  carry_forward_max numeric not null default 0,
  half_day_allowed boolean not null default false,
  gender text                             -- 'Female' for maternity, 'Male' for paternity, null = everyone
);

-- Only the opening balance (carried forward) is stored. Accrued, used, pending and available are calculated.
create table leave_balances (
  employee_id int not null references employees(id),
  leave_type_id int not null references leave_types(id),
  year int not null,
  opening numeric not null default 0,
  primary key (employee_id, leave_type_id, year)
);

create table leave_requests (
  id serial primary key,
  employee_id int not null references employees(id),
  leave_type_id int not null references leave_types(id),
  from_date date not null,
  to_date date not null,
  is_half_day boolean not null default false,
  days numeric not null check (days > 0),
  lop_days numeric not null default 0,    -- part of the request converted to Loss of Pay
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  approver_id int references employees(id),
  approver_comment text,
  attachment_url text,
  created_at timestamptz not null default now(),
  check (to_date >= from_date)
);

create table audit_log (
  id serial primary key,
  table_name text not null,
  record_id int not null,
  field text not null,
  old_value text,
  new_value text,
  changed_by int references employees(id),
  changed_at timestamptz not null default now()
);

-- Emails we send (also shown in the app's Outbox page so they can be checked on localhost).
create table email_log (
  id serial primary key,
  to_email text not null,
  subject text not null,
  body text not null,
  sent_via text not null,                 -- 'resend' or 'outbox only'
  created_at timestamptz not null default now()
);

create table policy_text (
  id serial primary key,
  topic text not null,
  body text not null
);

create table agent_log (
  id serial primary key,
  employee_id int not null references employees(id),
  tool text not null,
  inputs text not null,
  result text not null,
  created_at timestamptz not null default now()
);

-- Leave drafts prepared by the Ask HR agent. Nothing becomes a leave request until the user clicks Confirm.
create table leave_drafts (
  id serial primary key,
  employee_id int not null references employees(id),
  leave_type_id int not null references leave_types(id),
  from_date date not null,
  to_date date not null,
  is_half_day boolean not null default false,
  reason text not null,
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'discarded')),
  created_at timestamptz not null default now()
);

-- Reminder emails drafted by the Ask HR month-end check. HR must click Send.
create table email_drafts (
  id serial primary key,
  created_by int not null references employees(id),
  to_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'discarded')),
  created_at timestamptz not null default now()
);
