"use server";

import { revalidatePath } from "next/cache";
import { generateText, isStepCount } from "ai";
import { google } from "@ai-sdk/google";
import { requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { submitLeave, type SubmitResult } from "@/modules/leave/apply";
import { MAX_TOOL_CALLS, buildTools, systemPrompt, type ToolCallRecord } from "./tools";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type AgentReply = {
  text: string;
  calls: ToolCallRecord[];
  leaveDrafts: { id: number; type: string; from: string; to: string; days: number; halfDay: boolean; excess: number }[];
  emailDrafts: { id: number; to: string; subject: string }[];
};

export async function askHR(history: ChatMessage[]): Promise<AgentReply> {
  const me = await requireUser();
  const empty = { calls: [], leaveDrafts: [], emailDrafts: [] };
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return { ...empty, text: "Ask HR needs a free Google Gemini API key. Add GOOGLE_GENERATIVE_AI_API_KEY=your-key to .env.local and restart `npm run dev`." };
  }
  const calls: ToolCallRecord[] = [];
  try {
    const result = await generateText({
      model: google(process.env.GEMINI_MODEL || "gemini-2.5-flash"),
      system: systemPrompt(me),
      messages: history.slice(-10),
      tools: buildTools(me, calls),
      stopWhen: isStepCount(MAX_TOOL_CALLS + 1),
    });
    const leaveDrafts = calls
      .filter((c) => c.tool === "draft_leave_request" && (c.output as { draft_id?: number })?.draft_id)
      .map((c) => {
        const o = c.output as { draft_id: number; leave_type: string; days: number; days_over_balance_would_be_LOP: number };
        const i = c.input as { from_date: string; to_date: string; half_day: boolean };
        return { id: o.draft_id, type: o.leave_type, from: i.from_date, to: i.to_date, days: o.days, halfDay: i.half_day, excess: o.days_over_balance_would_be_LOP ?? 0 };
      });
    const emailDrafts = calls
      .filter((c) => c.tool === "month_end_check")
      .flatMap((c) => ((c.output as { flagged?: { employee: string; email_draft_id: number }[] })?.flagged ?? []).map((f) => ({ id: f.email_draft_id, to: f.employee, subject: "Attendance reminder" })));
    return { text: result.text || "(No answer. Try asking in a different way.)", calls, leaveDrafts, emailDrafts };
  } catch (err) {
    console.error("Ask HR failed", err);
    return { ...empty, calls, text: `Sorry, the AI service failed: ${err instanceof Error ? err.message : "unknown error"}` };
  }
}

/** The human step: a leave draft becomes a real (pending) request only when the user clicks Confirm. */
export async function confirmLeaveDraft(id: number, convertToLop: boolean): Promise<SubmitResult> {
  const me = await requireUser();
  const d = await queryOne<{ employee_id: number; leave_type_id: number; from_date: string; to_date: string; is_half_day: boolean; reason: string; status: string }>(
    "select * from leave_drafts where id = $1",
    [id],
  );
  if (!d || d.employee_id !== me.id) return { error: "Draft not found." };
  if (d.status !== "draft") return { error: "This draft was already used." };
  const r = await submitLeave(me, { leave_type_id: d.leave_type_id, from_date: d.from_date, to_date: d.to_date, is_half_day: d.is_half_day, reason: d.reason, convert_to_lop: convertToLop });
  if (r.ok) {
    await query("update leave_drafts set status = 'confirmed' where id = $1", [id]);
    revalidatePath("/", "layout");
  }
  return r;
}

export async function discardLeaveDraft(id: number): Promise<void> {
  const me = await requireUser();
  await query("update leave_drafts set status = 'discarded' where id = $1 and employee_id = $2 and status = 'draft'", [id, me.id]);
}

/** HR (or the manager who ran the check) clicks Send on a drafted reminder email. */
export async function sendEmailDraft(id: number): Promise<{ ok?: boolean; error?: string }> {
  const me = await requireUser();
  const d = await queryOne<{ created_by: number; to_email: string; subject: string; body: string; status: string }>("select * from email_drafts where id = $1", [id]);
  if (!d || d.created_by !== me.id) return { error: "Draft not found." };
  if (d.status !== "draft") return { error: "Already sent." };
  await sendEmail(d.to_email, d.subject, d.body);
  await query("update email_drafts set status = 'sent' where id = $1", [id]);
  return { ok: true };
}
