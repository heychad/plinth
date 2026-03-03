import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

const isClientOnlyRoute = createRouteMatcher([
  "/app(.*)",
]);

const isConsultantOnlyRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/clients(.*)",
  "/agents(.*)",
  "/reports(.*)",
  "/settings(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  const { sessionClaims } = await auth();
  const role =
    (sessionClaims?.metadata as { role?: string } | undefined)?.role ??
    (sessionClaims?.publicMetadata as { role?: string } | undefined)?.role;

  // Consultant trying to access client routes → redirect to /dashboard
  if (role === "consultant" && isClientOnlyRoute(req)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Client trying to access consultant routes → redirect to /app
  if (role === "client" && isConsultantOnlyRoute(req)) {
    return NextResponse.redirect(new URL("/app", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
