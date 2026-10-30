import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getMe } from "@/lib/auth";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "KonkanHR - Konkan Coastal Foods",
  description: "Employee Master, Attendance and Leave for Konkan Coastal Foods",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const me = await getMe();
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-900">
        {me && <Nav me={me} />}
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
