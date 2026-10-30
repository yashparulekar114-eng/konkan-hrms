import fs from "node:fs";
import path from "node:path";
import { canManageEmployee, getMe } from "@/lib/auth";
import { queryOne } from "@/lib/db";

// Medical certificates: only the employee, their manager or HR may open them.
export async function GET(_req: Request, ctx: RouteContext<"/api/certificate/[id]">) {
  const me = await getMe();
  if (!me) return new Response("Sign in first", { status: 401 });
  const { id } = await ctx.params;
  const r = await queryOne<{ employee_id: number; attachment_url: string | null }>("select employee_id, attachment_url from leave_requests where id = $1", [Number(id)]);
  if (!r?.attachment_url) return new Response("Not found", { status: 404 });
  if (r.employee_id !== me.id && !(await canManageEmployee(me, r.employee_id))) return new Response("Forbidden", { status: 403 });
  const file = path.join(process.cwd(), ".data", "uploads", path.basename(r.attachment_url));
  if (!fs.existsSync(file)) return new Response("Not found", { status: 404 });
  const ext = path.extname(file).toLowerCase();
  const type = ext === ".pdf" ? "application/pdf" : ext === ".png" ? "image/png" : "image/jpeg";
  return new Response(fs.readFileSync(file), { headers: { "content-type": type } });
}
