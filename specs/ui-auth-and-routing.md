# UI Auth and Routing

## Overview
Adds Clerk authentication UI pages (sign-in, sign-up) and updates middleware for route protection and role-based redirects. Adds `<UserButton />` to both consultant and client layouts for account management and sign-out.

## Requirements

### Must Have
- `/sign-in/[[...sign-in]]/page.tsx` renders Clerk `<SignIn />` component (catch-all route)
- `/sign-up/[[...sign-up]]/page.tsx` renders Clerk `<SignUp />` component (catch-all route)
- Middleware updated to protect all non-public routes with `auth.protect()`
- Root `/` page redirects authenticated users based on role: consultant → `/dashboard`, client → `/app`
- Root `/` page redirects unauthenticated users to `/sign-in`
- `<UserButton />` rendered in the consultant layout header/sidebar
- `<UserButton />` rendered in the client app layout

### Should Have
- Sign-in and sign-up pages styled with the Plinth design system (centered card, brand colors, Plus Jakarta Sans)
- After sign-in, Clerk `afterSignInUrl` redirects to `/` (which then performs the role-based redirect)
- Sign-in page shows the consultant's `platformName` and logo when accessed from a white-labeled domain

### Nice to Have
- Custom Clerk appearance object (`appearance` prop) to match Plinth brand colors on the Clerk components

## File Locations

| File | Purpose |
|---|---|
| `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx` | Clerk SignIn catch-all |
| `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx` | Clerk SignUp catch-all |
| `src/app/(auth)/layout.tsx` | Auth layout (centered, branded) |
| `src/app/page.tsx` | Root redirect logic |
| `src/middleware.ts` | Clerk middleware config |

## Route Configuration

### Public Routes (no auth required)
```
/
/sign-in
/sign-in/.*
/sign-up
/sign-up/.*
/api/webhooks/.*
/oauth/.*
```

### Protected Routes (redirect to /sign-in if not authenticated)
```
/dashboard
/dashboard/.*
/clients
/clients/.*
/agents
/agents/.*
/reports
/reports/.*
/settings
/settings/.*
/app
/app/.*
```

## Middleware Implementation

`src/middleware.ts` must use Clerk's `clerkMiddleware` with `createRouteMatcher`:

```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/(.*)",
  "/oauth/(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
  // Role-based redirects handled in root page.tsx, not middleware
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

**TEST_MODE bypass:** If `process.env.TEST_MODE === "true"`, skip auth checks entirely. This preserves existing behavior.

## Root Page Redirect Logic

`src/app/page.tsx` must redirect based on Clerk session:

```tsx
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await currentUser();
  const role = user?.publicMetadata?.role as string | undefined;

  if (role === "consultant" || role === "platform_admin") {
    redirect("/dashboard");
  }

  redirect("/app");
}
```

## Sign-In Page Implementation

`src/app/(auth)/sign-in/[[...sign-in]]/page.tsx`:

```tsx
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignIn
        appearance={{
          variables: {
            colorPrimary: "#6366F1",
            fontFamily: "var(--font-plus-jakarta-sans)",
          },
        }}
        afterSignInUrl="/"
      />
    </div>
  );
}
```

## Sign-Up Page Implementation

`src/app/(auth)/sign-up/[[...sign-up]]/page.tsx`:

```tsx
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignUp
        appearance={{
          variables: {
            colorPrimary: "#6366F1",
            fontFamily: "var(--font-plus-jakarta-sans)",
          },
        }}
        afterSignUpUrl="/"
      />
    </div>
  );
}
```

## UserButton Placement

### Consultant Layout
`<UserButton />` placed in the sidebar footer or top-right of the header. Prop configuration:
```tsx
<UserButton afterSignOutUrl="/sign-in" />
```

### Client Layout
`<UserButton />` placed in the sidebar footer. Same `afterSignOutUrl="/sign-in"`.

## Behavioral Constraints
- Middleware MUST protect all routes under `/(consultant)/` and `/(client)/app/` — unauthenticated access returns redirect to `/sign-in`
- Role-based routing uses `publicMetadata.role` from Clerk JWT — this field is set at user creation time in the Convex `users` table sync
- If `publicMetadata.role` is absent (new user not yet synced), redirect to `/app` as a safe default
- The `TEST_MODE` environment variable bypass must remain functional — it is used by automated tests
- The Clerk `<SignIn />` component handles all sign-in variants (email/password, magic link, OAuth) — do not build a custom form

## Edge Cases
- **User has no role in metadata:** Redirect to `/app` (client default). A background process should sync their Convex user record.
- **User tries to access `/dashboard` as a client:** Middleware's `auth.protect()` allows access (they are authenticated), but the consultant layout should verify role and redirect. Add a role check in the consultant layout server component.
- **User signs out from `/app/agents`:** `afterSignOutUrl="/sign-in"` — lands on sign-in page.
- **Multiple Clerk domains:** If consultant uses a custom domain, the Clerk publishable key must be configured per-domain in Vercel environment variables.

## User Stories
- As an unauthenticated visitor, when I navigate to `/`, I am redirected to `/sign-in` and see the Clerk sign-in form.
- As a consultant, after signing in I am redirected to `/dashboard` and see my client list.
- As a client, after signing in I am redirected to `/app` and see the chat interface.
- As any user, when I click the `<UserButton />` avatar, I see a dropdown with profile settings and a "Sign out" option.
- As a client, if I try to access `/dashboard` directly, I see an "Unauthorized" page or am redirected to `/app`.

## Dependencies
- Depends on: `ui-design-system-foundation.md` — for styling the auth pages
