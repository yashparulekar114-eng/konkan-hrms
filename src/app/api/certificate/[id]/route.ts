import { canManageEmployee, getMe } from "@/lib/auth";
import { queryOne } from "@/lib/db";

// Medical certificates: only the employee, their manager or HR may open them.
export async function GET(_req: Request, ctx: RouteContext<"/api/certificate/[id]">) {
  const me = await getMe();
  if (!me) return new Response("Sign in first", { status: 401 });
  const { id } = await ctx.params;
  const r = await queryOne<{ employee_id: number; content_type: string; data: Uint8Array }>(
    "select r.employee_id, c.content_type, c.data from leave_certificates c join leave_requests r on r.id = c.leave_request_id where r.id = $1",
    [Number(id)],
  );
  if (!r) return new Response("Not found", { status: 404 });
  if (r.employee_id !== me.id && !(await canManageEmployee(me, r.employee_id))) return new Response("Forbidden", { status: 403 });
  return new Response(Buffer.from(r.data), { headers: { "content-type": r.content_type } });
}
