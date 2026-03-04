import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === "true";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/(.*)",
  "/oauth/(.*)",
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

function testModeMiddleware(_req: NextRequest) {
  return NextResponse.next();
}

export default isTestMode
  ? testModeMiddleware
  : clerkMiddleware(async (auth, req) => {
      if (isPublicRoute(req)) {
        return NextResponse.next();
      }

      // Protect all non-public routes — redirects unauthenticated users to /sign-in
      await auth.protect();

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

      // Onboarding redirect logic for client users
      const pathname = req.nextUrl.pathname;
      const isClientRoute = pathname.startsWith("/app");
      const isOnboardingRoute = pathname.startsWith("/app/onboarding");

      if (role !== "consultant" && role !== "platform_admin" && isClientRoute) {
        const onboardingComplete =
          (sessionClaims?.metadata as { onboardingComplete?: boolean } | undefined)
            ?.onboardingComplete ??
          (sessionClaims?.publicMetadata as { onboardingComplete?: boolean } | undefined)
            ?.onboardingComplete;

        if (!isOnboardingRoute && !onboardingComplete) {
          return NextResponse.redirect(new URL("/app/onboarding", req.url));
        }

        if (isOnboardingRoute && onboardingComplete) {
          return NextResponse.redirect(new URL("/app", req.url));
        }
      }

      return NextResponse.next();
    });

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
