import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Clerk needs to see each request so pages can ask who is signed in. Without Clerk keys (localhost demo) it does nothing.
// This is not the role check: every page and action still checks the role on the server.
const clerkOn = !!process.env.CLERK_SECRET_KEY && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default clerkOn ? clerkMiddleware() : () => NextResponse.next();

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|webmanifest)).*)", "/(api|trpc)(.*)"],
};
