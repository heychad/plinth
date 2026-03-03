# UI Client Onboarding

## Overview
Guides first-time client users through a brief welcome wizard before they reach the chat interface. Provisions a default starter agent so clients have something to interact with immediately. Renames the "Integrations" page to "Connections" with friendlier copy.

## Requirements

### Must Have
- First-login detection via Clerk `publicMetadata.onboardingComplete` flag
- Middleware redirects to `/app/onboarding` when `onboardingComplete` is absent or `false`
- Onboarding wizard with exactly 3 steps: (1) Welcome, (2) What you can do, (3) Ready to chat
- After completing step 3: set `onboardingComplete: true` on Clerk user metadata + redirect to `/app`
- "Skip" button visible on steps 1 and 2; step 3 has only "Start chatting" CTA
- "Back" button on steps 2 and 3
- Progress indicator showing current step (e.g., 1 / 3)

### Should Have
- Default starter agent auto-provisioned on first login: a general-purpose "assistant" agent config created in Convex for this tenant
- The starter agent is based on a template with `slug: "general-assistant"` (must exist in `agentTemplates`)
- Welcome message on step 1 uses the consultant's `platformName` from the tenant theme

### Nice to Have
- Animated transitions between steps (fade + slide, 200ms ease-out)
- Confetti animation on step 3 before redirect

## Data Flow

### First-Login Detection

Middleware checks `publicMetadata.onboardingComplete` from the Clerk JWT session claims:

```ts
// In clerkMiddleware
const { sessionClaims } = await auth();
const onboardingComplete = sessionClaims?.metadata?.onboardingComplete;
const isClientRoute = req.nextUrl.pathname.startsWith("/app");
const isOnboardingRoute = req.nextUrl.pathname.startsWith("/app/onboarding");

if (isClientRoute && !isOnboardingRoute && !onboardingComplete) {
  return NextResponse.redirect(new URL("/app/onboarding", req.url));
}
```

### Completing Onboarding

After the user clicks "Start chatting" on step 3:

1. Call Convex mutation `provisionStarterAgent` (creates default agentConfig)
2. Call Clerk's server-side `users.updateUser(userId, { publicMetadata: { onboardingComplete: true } })`
3. Call `router.refresh()` to trigger a new server render that picks up the updated JWT claims
4. Redirect to `/app`

**Clerk metadata update must happen server-side** via a Next.js server action (not client-side SDK).

```ts
// src/app/(client)/app/onboarding/_actions.ts (server action)
"use server";
import { auth, clerkClient } from "@clerk/nextjs/server";

export async function completeOnboarding() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");

  await clerkClient().users.updateUser(userId, {
    publicMetadata: { onboardingComplete: true },
  });
}
```

## Convex API Contracts

### Mutation: `provisionStarterAgent`
- **File:** `convex/agentConfigs.ts`
- **Signature:** `mutation(ctx) => Id<"agentConfigs"> | null`
- **Auth:** Client role only
- **Behavior:**
  1. Checks if a config with `templateId` matching `slug: "general-assistant"` already exists for this tenant
  2. If exists: returns existing ID (idempotent)
  3. If not exists: creates a new `agentConfig` with default settings from the template
  4. Returns the `agentConfigId`
- **Error:** If `general-assistant` template does not exist in `agentTemplates`, returns `null` (non-fatal)

## File Locations

| File | Purpose |
|---|---|
| `src/app/(client)/app/onboarding/page.tsx` | Wizard container (client component) |
| `src/app/(client)/app/onboarding/_actions.ts` | Server action for completing onboarding |
| `src/components/onboarding/OnboardingWizard.tsx` | Multi-step wizard component |
| `src/components/onboarding/StepWelcome.tsx` | Step 1 content |
| `src/components/onboarding/StepWhatYouCanDo.tsx` | Step 2 content |
| `src/components/onboarding/StepReady.tsx` | Step 3 content |

## Wizard Step Content

### Step 1: Welcome
- Heading: "Welcome to {platformName}" (or "Welcome to Plinth" if no theme)
- Body: "Your AI-powered toolkit is ready. Let's take 30 seconds to get you set up."
- CTA: "Let's go →" (advances to step 2)
- Secondary: "Skip setup" (goes directly to `/app` with `onboardingComplete: true`)

### Step 2: What You Can Do
- Heading: "Here's what your AI assistant can do"
- Content: 3 bullet points derived from deployed agent configs (or generic if none deployed):
  - "Have a conversation and get instant answers"
  - "Run specialized tasks on your behalf"
  - "Generate documents and reports automatically"
- CTA: "Next →"
- Secondary: "Back", "Skip setup"

### Step 3: Ready to Chat
- Heading: "You're all set!"
- Body: "Your first AI assistant is ready and waiting. Start by saying hello."
- CTA: "Start chatting" (triggers `completeOnboarding()` + redirect)
- Secondary: "Back"
- No skip on this step

## UI Design

- Wizard is centered on screen, max-width 480px
- Card container: `bg-card rounded-2xl shadow-lg p-8`
- Progress indicator: 3 dots, filled dot = current step, color: `--color-primary`
- Step counter: "Step 1 of 3" in `text-muted-foreground text-sm` above heading
- Heading: `text-2xl font-semibold text-foreground`
- CTA button: full-width, `bg-accent text-accent-foreground` (emerald)
- Back + Skip: `text-muted-foreground text-sm underline cursor-pointer`
- Background behind card: `bg-background` with a subtle radial gradient from `--color-primary` at 5% opacity
- Per design system onboarding page: provide Skip and Back buttons on all steps except the final

## Connections Page (Renamed from Integrations)

The existing `/app/integrations` page is renamed to `/app/connections`.

### Route Change
- Old: `/app/integrations`
- New: `/app/connections`
- Old route `/app/integrations` must 301 redirect to `/app/connections`

### Copy Changes
| Before | After |
|---|---|
| "Integrations" (nav item) | "Connections" |
| "Connect integrations" (page title) | "Link your apps" |
| "Integration Connections" (section heading) | "Connected apps" |
| "Connect" (button) | "Link account" |
| "Disconnect" (button) | "Unlink" |
| "No integrations required yet." | "No apps needed yet. Your consultant will let you know when you need to link something." |

### UI Layout (same as existing, but restyled with shadcn)
- Page heading: "Link your apps" with subtitle: "Connect the tools your agents need to work their magic."
- Integration cards: shadcn `Card` component with provider logo, status badge, and action button
- Status badges: "Connected" → `Badge variant="default"` (emerald), "Not Connected" → `Badge variant="secondary"` (muted)

## Behavioral Constraints
- The onboarding wizard MUST NOT be reachable after `onboardingComplete: true` is set — middleware redirects away from `/app/onboarding`
- The "Skip" path MUST also set `onboardingComplete: true` so the user is not redirected back to onboarding on next visit
- `provisionStarterAgent` is idempotent — calling it multiple times (e.g., slow network retry) must not create duplicate agent configs
- The `platformName` in the welcome message is loaded from the Convex `themes` table for this tenant — if not found, use "Plinth" as fallback
- Clerk metadata update is server-side only — never update `publicMetadata` from client code

## Edge Cases
- **Consultant has not deployed any agents:** Step 2 shows generic capability bullets, `provisionStarterAgent` returns null, redirect to `/app` still works
- **`general-assistant` template does not exist:** `provisionStarterAgent` returns null silently. Onboarding completes normally. User lands in chat with no pre-built agent but orchestrator still works.
- **User navigates back to `/app/onboarding` after completing:** Middleware detects `onboardingComplete: true` and redirects to `/app`
- **Network error on Clerk metadata update:** Show a toast error "Something went wrong. Please try again." — do not redirect until the metadata update succeeds
- **User closes tab mid-onboarding:** On next login, they land back at step 1 (since `onboardingComplete` was never set)

## User Stories
- As a new client, the first time I sign in, I am redirected to the welcome wizard instead of the chat page.
- As a new client, on step 1 I see my platform name in the heading and can click "Let's go" to proceed.
- As a new client, on any step I can click "Skip setup" to go directly to the chat interface.
- As a new client, after completing step 3 and clicking "Start chatting", I land on the chat interface with a starter agent ready to go.
- As a returning client, when I sign in again, I go directly to `/app` — I never see the onboarding wizard again.
- As a client, when I navigate to the sidebar and click "Connections", I see the "Link your apps" page with friendly copy and integration cards.

## Dependencies
- Depends on: `ui-design-system-foundation.md`
- Depends on: `ui-auth-and-routing.md` — for middleware integration
- Depends on: `ui-client-chat-interface.md` — destination after onboarding
- Backend: `convex/agentConfigs.ts` — `provisionStarterAgent` mutation
- Backend: `agentTemplates` — `general-assistant` template must exist as seed data
