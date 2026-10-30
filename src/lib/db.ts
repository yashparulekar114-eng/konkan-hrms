import "server-only";
import fs from "node:fs";
import path from "node:path";
import { PGlite, types, type Transaction } from "@electric-sql/pglite";
import { seedDatabase } from "../../supabase/seed/seed";

// Local Postgres (PGlite) stored in the .data folder, so the app runs on localhost with no accounts.
// The same SQL works on Supabase later.

type Db = PGlite | Transaction;

const globalForDb = globalThis as unknown as { hrmsDb?: Promise<PGlite> };

async function open(): Promise<PGlite> {
  const dataDir = process.env.HRMS_DATA_DIR || path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new PGlite(dataDir, {
    parsers: {
      [types.DATE]: (v: string) => v, // keep dates as 'YYYY-MM-DD' text, no time-zone shifting
      [types.NUMERIC]: (v: string) => Number(v),
      [types.INT8]: (v: string) => Number(v),
    },
  });
  await db.waitReady;
  // Every date/time the database works out (current_date, now()) is in IST.
  await db.exec("set time zone 'Asia/Kolkata'");

  const exists = await db.query<{ t: string | null }>("select to_regclass('public.employees')::text as t");
  if (!exists.rows[0].t) {
    const sql = fs.readFileSync(path.join(process.cwd(), "supabase", "migrations", "001_init.sql"), "utf8");
    await db.exec(sql);
    await seedDatabase(db);
  }
  return db;
}

export function getDb(): Promise<PGlite> {
  if (!globalForDb.hrmsDb) globalForDb.hrmsDb = open();
  return globalForDb.hrmsDb;
}

export async function query<T>(sql: string, params: unknown[] = [], db?: Db): Promise<T[]> {
  const conn = db ?? (await getDb());
  const res = await conn.query<T>(sql, params);
  return res.rows;
}

export async function queryOne<T>(sql: string, params: unknown[] = [], db?: Db): Promise<T | null> {
  const rows = await query<T>(sql, params, db);
  return rows[0] ?? null;
}

export async function transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction(fn);
}
