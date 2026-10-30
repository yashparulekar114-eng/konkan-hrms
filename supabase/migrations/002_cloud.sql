-- Changes needed to run on Supabase + Clerk + Vercel.

-- Every date/time the database works out (current_date, now()) is in IST.
do $$ begin
  execute format('alter database %I set timezone to %L', current_database(), 'Asia/Kolkata');
end $$;

-- Links a Clerk sign-in to the employee row (matched by email on first sign-in).
alter table employees add column clerk_user_id text unique;

-- Medical certificates are stored in the database, because Vercel has no permanent disk.
create table leave_certificates (
  leave_request_id int primary key references leave_requests(id),
  file_name text not null,
  content_type text not null,
  data bytea not null
);

-- Row-level security on every table. There are no policies, so Supabase's public API (anon key) can read nothing.
-- The app connects on the server as the database owner and does its own role checks.
alter table locations enable row level security;
alter table departments enable row level security;
alter table employees enable row level security;
alter table holidays enable row level security;
alter table attendance enable row level security;
alter table regularisation_requests enable row level security;
alter table leave_types enable row level security;
alter table leave_balances enable row level security;
alter table leave_requests enable row level security;
alter table audit_log enable row level security;
alter table email_log enable row level security;
alter table policy_text enable row level security;
alter table agent_log enable row level security;
alter table leave_drafts enable row level security;
alter table email_drafts enable row level security;
alter table leave_certificates enable row level security;
