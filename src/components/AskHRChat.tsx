"use client";

import { useState, useTransition } from "react";
import { askHR, confirmLeaveDraft, discardLeaveDraft, sendEmailDraft, type AgentReply, type ChatMessage } from "@/modules/agent/actions";
import { Notice, btn, btnSecondary, input } from "./ui";

type Turn = { role: "user" | "assistant"; content: string; reply?: AgentReply };

const EXAMPLES = ["How many CL do I have?", "kal ki chutti chahiye, kitni CL bachi hai?", "How many days if I take Friday to Monday?", "Who in my team is absent today?"];

export function AskHRChat({ hasKey }: { hasKey: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  function send(message: string) {
    if (!message.trim()) return;
    const next: Turn[] = [...turns, { role: "user", content: message }];
    setTurns(next);
    setText("");
    start(async () => {
      const history: ChatMessage[] = next.map((t) => ({ role: t.role, content: t.content }));
      const reply = await askHR(history);
      setTurns([...next, { role: "assistant", content: reply.text, reply }]);
    });
  }

  return (
    <div className="space-y-3">
      {!hasKey && <Notice kind="error">No Gemini API key yet. Add GOOGLE_GENERATIVE_AI_API_KEY to .env.local (free at aistudio.google.com) and restart the dev server.</Notice>}
      <div className="space-y-3">
        {turns.map((t, i) => (
          <div key={i} className={t.role === "user" ? "ml-auto max-w-[85%] rounded-lg bg-blue-700 p-3 text-sm text-white" : "max-w-[95%] rounded-lg border border-slate-200 bg-white p-3 text-sm"}>
            <p className="whitespace-pre-wrap">{t.content}</p>
            {t.reply && <ReplyExtras reply={t.reply} />}
          </div>
        ))}
        {pending && <p className="text-sm text-slate-500">Thinking...</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((e) => <button key={e} type="button" onClick={() => send(e)} className="rounded-full border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100">{e}</button>)}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about leave, holidays, attendance..." className={input} />
        <button className={btn} disabled={pending}>Send</button>
      </form>
    </div>
  );
}

function ReplyExtras({ reply }: { reply: AgentReply }) {
  return (
    <div className="mt-2 space-y-2">
      {reply.leaveDrafts.map((d) => <LeaveDraftCard key={d.id} draft={d} />)}
      {reply.emailDrafts.map((d) => <EmailDraftCard key={d.id} draft={d} />)}
      {reply.calls.length > 0 && (
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer">Tools used: {reply.calls.map((c) => c.tool).join(", ")}</summary>
          <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2">{JSON.stringify(reply.calls, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}

function LeaveDraftCard({ draft }: { draft: AgentReply["leaveDrafts"][number] }) {
  const [state, setState] = useState<{ ok?: boolean; error?: string; message?: string; needsLop?: boolean; discarded?: boolean }>({});
  const [lop, setLop] = useState(draft.excess > 0);
  const [pending, start] = useTransition();
  if (state.ok) return <Notice kind="success">{state.message}</Notice>;
  if (state.discarded) return <Notice>Draft discarded.</Notice>;
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-slate-800">
      <p className="font-medium">Draft leave request (not submitted yet)</p>
      <p>{draft.type}: {draft.from}{draft.to !== draft.from && ` to ${draft.to}`} · {draft.days} working day(s){draft.halfDay && " (half day)"}</p>
      {(draft.excess > 0 || state.needsLop) && (
        <label className="mt-1 flex items-center gap-2"><input type="checkbox" checked={lop} onChange={(e) => setLop(e.target.checked)} /> Convert the days over my balance to LOP</label>
      )}
      <div className="mt-2 flex gap-2">
        <button className={btn} disabled={pending} onClick={() => start(async () => setState(await confirmLeaveDraft(draft.id, lop)))}>Confirm and submit</button>
        <button className={btnSecondary} disabled={pending} onClick={() => start(async () => { await discardLeaveDraft(draft.id); setState({ discarded: true }); })}>Discard</button>
      </div>
      {state.error && <p className="mt-1 text-red-700">{state.error}</p>}
    </div>
  );
}

function EmailDraftCard({ draft }: { draft: AgentReply["emailDrafts"][number] }) {
  const [state, setState] = useState<{ ok?: boolean; error?: string }>({});
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 p-2">
      <span>Reminder email to <b>{draft.to}</b> (draft)</span>
      {state.ok ? <span className="text-green-700">Sent (see Email outbox)</span> : (
        <button className={btnSecondary} disabled={pending} onClick={() => start(async () => setState(await sendEmailDraft(draft.id)))}>Send</button>
      )}
      {state.error && <span className="text-red-700">{state.error}</span>}
    </div>
  );
}
