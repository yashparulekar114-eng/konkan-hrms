import Link from "next/link";
import { Card, link } from "@/components/ui";

export default function AccessDenied() {
  return (
    <div className="mx-auto max-w-md">
      <Card title="Access denied">
        <p className="text-sm text-slate-700">
          You do not have access to this page. If your last working day has passed, you can no longer sign in to KonkanHR.
        </p>
        <p className="mt-3 text-sm">
          <Link href="/" className={link}>Go to home</Link> or <Link href="/login" className={link}>sign in as someone else</Link>.
        </p>
      </Card>
    </div>
  );
}
