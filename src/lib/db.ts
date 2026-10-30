import "server-only";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PGlite, types } from "@electric-sql/pglite";
import { seedDatabase } from "../../supabase/seed/seed";

// Two ways to run:
// - DATABASE_URL set (Supabase): a normal Postgres connection pool. Used on Vercel.
// - No DATABASE_URL: PGlite, a local Postgres stored in the .data folder, so localhost needs no accounts.
// Both run the same SQL from supabase/migrations. Missing migrations and the seed are applied on first use.

/** The small part of a database connection the app uses. Both pg and PGlite fit it. */
export type Conn = { query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> };

type Db = Conn & { transaction<T>(fn: (tx: Conn) => Promise<T>): Promise<T> };

const globalForDb = globalThis as unknown as { hrmsDb?: Promise<Db> };

async function openPostgres(url: string): Promise<Db> {
  const pg = (await import("pg")).default;
  pg.types.setTypeParser(1082, (v: string) => v); // dates stay 'YYYY-MM-DD'
  pg.types.setTypeParser(1700, (v: string) => Number(v)); // numeric
  pg.types.setTypeParser(20, (v: string) => Number(v)); // bigint (count)
  const local = /localhost|127\.0\.0\.1/.test(url);
  const pool = new pg.Pool({ connectionString: url, max: 5, ssl: local ? undefined : { rejectUnauthorized: false } });
  const conn = (c: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }): Conn => ({
    query: async <T,>(sql: string, params: unknown[] = []) => {
      const res = await c.query(sql, params);
      return { rows: res.rows as T[] };
    },
  });
  return {
    ...conn(pool),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await fn(conn(client));
        await client.query("commit");
        return result;
      } catch (err) {
        await client.query("rollback");
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

async function openPglite(): Promise<Db> {
  // Kept in the user's home folder, not the project: synced folders like OneDrive block the database's lock file.
  const dataDir = process.env.HRMS_DATA_DIR || path.join(os.homedir(), ".konkan-hrms", "pglite");
  fs.mkdirSync(dataDir, { recursive: true });
  // Windows can mark folders read-only (OneDrive does this, and copies keep it). PGlite then cannot create its lock file.
  const makeWritable = (dir: string) => {
    fs.chmodSync(dir, 0o777);
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) if (e.isDirectory()) makeWritable(path.join(dir, e.name));
  };
  makeWritable(dataDir);
  // PGlite runs inside this one process, so a lock file found at startup was left by a server that was stopped.
  fs.rmSync(path.join(dataDir, "postmaster.pid"), { force: true });
  const db = new PGlite(dataDir, {
    onStderr: (text) => {
      if (/FATAL|PANIC/.test(text)) console.error("[local database]", text.trim());
      return true;
    },
    parsers: {
      [types.DATE]: (v: string) => v,
      [types.NUMERIC]: (v: string) => Number(v),
      [types.INT8]: (v: string) => Number(v),
    },
  });
  await db.waitReady;
  await db.exec("set time zone 'Asia/Kolkata'");
  return {
    query: <T,>(sql: string, params: unknown[] = []) => db.query<T>(sql, params),
    transaction: (fn) => db.transaction((tx) => fn({ query: <T,>(sql: string, params: unknown[] = []) => tx.query<T>(sql, params) })),
  };
}

/** Runs any migration files not applied yet, in order, then seeds an empty database. */
async function migrate(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.query("select pg_advisory_xact_lock(424242)"); // only one server instance migrates at a time
    await tx.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
    // A local database made before migrations were tracked already has 001.
    const old = await tx.query<{ t: string | null }>("select to_regclass('public.employees')::text as t");
    if (old.rows[0].t) await tx.query("insert into schema_migrations (name) values ('001_init.sql') on conflict do nothing");

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    const done = new Set((await tx.query<{ name: string }>("select name from schema_migrations")).rows.map((r) => r.name));
    for (const file of files.filter((f) => !done.has(f))) {
      for (const statement of splitSql(fs.readFileSync(path.join(dir, file), "utf8"))) await tx.query(statement);
      await tx.query("insert into schema_migrations (name) values ($1)", [file]);
    }
    const count = await tx.query<{ n: number }>("select count(*)::int as n from employees");
    if (count.rows[0].n === 0) await seedDatabase(tx);
  });
}

/** Splits a .sql file into statements (keeps $$ ... $$ blocks together). */
function splitSql(sql: string): string[] {
  const out: string[] = [];
  let current = "";
  let inDollar = false;
  for (const line of sql.split("\n")) {
    if (/^\s*--/.test(line) && !inDollar) continue;
    current += line + "\n";
    if ((line.match(/\$\$/g) ?? []).length % 2 === 1) inDollar = !inDollar;
    if (!inDollar && line.trim().endsWith(";")) {
      out.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

export function getDb(): Promise<Db> {
  if (!globalForDb.hrmsDb) {
    globalForDb.hrmsDb = (async () => {
      const db = process.env.DATABASE_URL ? await openPostgres(process.env.DATABASE_URL) : await openPglite();
      await migrate(db);
      return db;
    })();
    globalForDb.hrmsDb.catch(() => (globalForDb.hrmsDb = undefined)); // retry on the next request if it failed
  }
  return globalForDb.hrmsDb;
}

export async function query<T>(sql: string, params: unknown[] = [], db?: Conn): Promise<T[]> {
  const conn = db ?? (await getDb());
  return (await conn.query<T>(sql, params)).rows;
}

export async function queryOne<T>(sql: string, params: unknown[] = [], db?: Conn): Promise<T | null> {
  const rows = await query<T>(sql, params, db);
  return rows[0] ?? null;
}

export async function transaction<T>(fn: (tx: Conn) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction(fn);
}
