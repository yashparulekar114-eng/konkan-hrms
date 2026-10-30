import { requireUser } from "@/lib/auth";
import { AskHRChat } from "@/components/AskHRChat";
import { Card, PageTitle } from "@/components/ui";

export default async function AskHR() {
  await requireUser();
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle sub="Ask in English or Hinglish. Numbers always come from the app's own tools; leave requests are drafts until you click Confirm.">Ask HR</PageTitle>
      <Card>
        <AskHRChat hasKey={!!process.env.GOOGLE_GENERATIVE_AI_API_KEY} />
      </Card>
    </div>
  );
}
