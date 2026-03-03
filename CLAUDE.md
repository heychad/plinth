# Plinth

White-label AI agent platform. Consultants license it, brand it, resell to clients.

## Stack

- **Backend + DB:** Convex (real-time subscriptions, native vector search, Agent/RAG components)
- **Auth:** Clerk (JWT custom claims: consultant_id, tenant_id, user_role)
- **Frontend:** Next.js 15 App Router
- **Hosting:** Vercel (frontend) + Convex Cloud (backend)
- **AI (primary):** Anthropic Agent SDK (`claude_agent_sdk`) -- all agents use Agent SDK; Client SDK is fallback only
- **AI (embeddings):** OpenAI `text-embedding-3-small` (1536 dims) via `@convex-dev/rag` and `@convex-dev/agent`
- **Integrations:** Composio (OAuth proxy for Google, Slack, etc.)
- **Email:** Resend (transactional notifications)
- **Domain:** onplinth.ai

## Project Structure

```
plinth/
  convex/
    schema.ts              # All Convex document definitions
    auth.ts                # requireAuth, requireRole helpers
    consultants.ts         # Consultant CRUD
    tenants.ts             # Tenant CRUD
    users.ts               # User CRUD
    themes.ts              # White-label theming queries/mutations
    agentTemplates.ts      # Template library queries
    agentConfigs.ts        # Config CRUD with locked field enforcement
    agentConfigHistory.ts  # Config audit trail
    agentRuns.ts           # Run tracking queries/mutations
    agentRunSteps.ts       # Step tracking
    usageLogs.ts           # Usage/cost tracking
    coachingCallReports.ts # Report CRUD and workflow
    credentials.ts         # Composio credential management
    zoomCredentials.ts     # Zoom OAuth credentials
    zoomWebhookEvents.ts   # Zoom event log
    memory.ts              # RAG component setup
    agentSetup.ts          # Agent component setup
    execution/
      agentWorkflow.ts     # Primary Agent SDK workflow
      simpleWorkflow.ts    # Client SDK fallback workflow
      executeAgent.ts      # Agent SDK execution action
      executeSimple.ts     # Simple call execution action
      platformTools.ts     # Platform tool definitions
    integrations/
      googleDocs.ts        # createGoogleDoc via Composio
      resend.ts            # sendNotificationEmail via Resend API
      composio.ts          # OAuth flow management
    webhooks/
      zoom.ts              # POST /webhooks/zoom HTTP endpoint
      github.ts            # POST /webhooks/github-template-sync
      composioCallback.ts  # GET /oauth/composio/callback
    http.ts                # HTTP route definitions
    convex.config.ts       # Component imports (rag, agent, workflows)
  src/
    app/
      layout.tsx           # Root layout with Clerk + Convex providers
      middleware.ts        # Role-based routing + theme injection
      (consultant)/
        dashboard/         # Consultant home
        clients/           # Client roster + detail
        agents/            # Template library
        reports/           # Cross-client report review
        settings/          # Profile + theme editor
      (client)/
        app/               # Client home
          agents/          # Agent detail + run trigger
          runs/            # Run history
          integrations/    # OAuth connection management
          reports/         # Coach report view (read-only)
    components/
      ThemeProvider.tsx     # CSS variable injection from Convex theme
      ...
  specs/                   # Feature specifications (read-only)
  scripts/ralph/
    backpressure.sh        # Verification gate script
```

## Key Commands

```bash
# Install dependencies
npm install

# Run Convex dev server (backend)
npx convex dev

# Run Next.js dev server (frontend)
npm run dev

# Type check
npx tsc --noEmit

# Lint
npx eslint . --max-warnings 0

# Run tests
npm test

# Build for production
npm run build

# Deploy Convex
npx convex deploy
```

## Multi-Tenancy Rules (CRITICAL)

Every Convex query and mutation that touches tenant-scoped data MUST:

1. Call `requireAuth()` before any `db.query()` or `db.insert()`
2. Scope data by the caller's identity:
   - `platform_admin` -- no scope restrictions, sees everything
   - `consultant` -- sees only tenants where `tenants.consultantId === caller.consultantId`
   - `client` -- sees only data where `tenantId === caller.tenantId`
3. Never trust client-provided tenantId alone -- always cross-reference with JWT claims
4. Convex has NO database-level RLS -- isolation is 100% application-layer

## Agent SDK Usage

- Agent SDK (`claude_agent_sdk`) is the PRIMARY execution mode for all agents
- Client SDK (`@anthropic-ai/sdk`) is fallback only for simple, single-call operations
- `executionMode` field on agentTemplates: `"autonomous"` (Agent SDK) or `"simple"` (Client SDK)
- Default model: `claude-sonnet-4-6` for Agent SDK; `claude-haiku-4-5` for simple mode
- Max turns default: 25 (configurable per agent config)
- Extended thinking enabled by default for Agent SDK agents

## Convex Conventions

- All documents have `createdAt` (number, Unix timestamp) and `updatedAt` where applicable
- Foreign keys use `Id<"tableName">` type validators
- Indexes on all foreign key fields -- Convex requires indexes for efficient queries
- 1 MiB document size limit -- large content (transcripts, reports) goes in Convex file storage
- Convex actions (not queries/mutations) for external API calls (Anthropic, Composio, Resend, Zoom)
- 10-minute action timeout -- use checkpoint-and-continue pattern for long-running agents
- Use `internal` prefix for functions not exposed to clients
- Pagination uses Convex cursor-based pagination; default limit 50; hard limit 32K doc scan

## Sprint Constraints

- No code exists yet -- this is a greenfield build
- Specs in `specs/` are read-only -- do not modify them
- Every PRD item must reference its source spec file
- PRD.json is the source of truth for what to build
- Multi-tenancy enforcement in every query/mutation is non-negotiable
- Agent SDK is primary -- do not default to Client SDK
- All color values must be validated as hex (#XXXXXX format)
- Email templates use {{variable}} substitution, not hardcoded values
- Credentials (OAuth tokens, API keys) are NEVER stored unencrypted in documents
- Composio holds OAuth tokens -- only entity IDs are stored in Convex
- The coaching call analyzer is a TEMPLATE -- rubric, curriculum, scoring are all configurable data, not hardcoded

## Environment Variables (Convex)

```
CLERK_ISSUER_URL        # Clerk JWT issuer
ANTHROPIC_API_KEY       # For Agent SDK and Client SDK
OPENAI_API_KEY          # For text-embedding-3-small (RAG + Agent components)
COMPOSIO_API_KEY        # For OAuth proxy
RESEND_API_KEY          # For transactional email
GITHUB_TOKEN            # For template sync from git
GITHUB_WEBHOOK_SECRET   # For webhook signature validation
ENCRYPTION_KEY          # For encrypting Zoom credentials and other secrets
```

## Environment Variables (Next.js / Vercel)

```
NEXT_PUBLIC_CONVEX_URL           # Convex deployment URL
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
```

## UI Sprint

### New Packages
- **UI framework:** shadcn/ui (Tailwind v4 CSS-first config, no tailwind.config.js)
- **Table:** @tanstack/react-table (client-side sorting, filtering, pagination)
- **Rich text editor:** @blocknote/core, @blocknote/mantine (document editor with markdown)
- **Document conversion:** mammoth (docx to HTML), turndown (HTML to markdown)
- **Chat streaming:** @convex-dev/persistent-text-streaming (SSE streaming to Convex)
- **Markdown rendering:** react-markdown, remark-gfm (agent message rendering)
- **Forms:** react-hook-form, zod (form validation)
- **Toasts:** sonner (via shadcn add sonner)
- **Icons:** lucide-react (sole icon library — no emojis as UI icons)
- **Webhooks:** svix (Clerk webhook signature verification)

### New Convex Tables
- `conversations` — chat conversations per tenant/user (indexes: by_userId_lastMessageAt, by_tenantId_userId)
- `messages` — chat messages with streaming support (indexes: by_conversationId, by_conversationId_createdAt)
- `documents` — user and agent-generated documents (indexes: by_tenantId_createdAt, by_tenantId_userId, by_agentRunId)
- `invitations` — Clerk org invitations tracked in Convex (indexes: by_tenantId_status, by_clerkInvitationId)

### Design System
- **Primary:** Indigo #6366F1 (as OKLCH for Tailwind v4)
- **Accent:** Emerald #10B981
- **Background:** Warm lavender #F5F3FF
- **Font:** Plus Jakarta Sans (via next/font/google, variable --font-plus-jakarta-sans)
- **18 shadcn CSS variables** defined in globals.css :root block
- **Dark theme stub** via [data-theme="dark"] block

### Key Patterns
- **Chat-first client experience:** /app is a full-screen chat interface with sidebar
- **Orchestrator agent:** Routes user messages to deployed sub-agents dynamically
- **Sidebar navigation:** shadcn SidebarProvider + collapsible sidebar on desktop, Sheet drawer on mobile
- **Onboarding wizard:** 3-step card flow for new clients, provisions starter agent
- **Document store:** BlockNote editor with auto-save, .docx import, Google Docs export
- **White-label theming:** CSS variables injected from Convex themes table via ThemeProvider

### UI Sprint Constraints
- **Specs override design system page overrides** — when `specs/*.md` conflicts with `design-system/plinth/pages/*.md`, the spec is authoritative
- **Existing files from prior sprint may need replacing, not appending** — always read existing files before modifying (e.g., consultant layout already has an inline nav bar)
- `CLERK_SECRET_KEY` must be set in Convex environment variables for the Clerk webhook handler (Item 50) to call Clerk Admin API
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` must be set for invitation redirect URLs
- All shadcn components installed via `npx shadcn@latest add` — do not manually create component files
- Tailwind v4 uses CSS-first config — @import "tailwindcss" in globals.css, NO tailwind.config.js
- shadcn variables use OKLCH color space internally — convert hex to OKLCH when defining
- Every interactive element must have minimum 44x44px touch target
- prefers-reduced-motion: reduce must disable all animations
- All tables must have <caption>, <th scope="col">, and aria-sort on sortable columns
- Skip-to-content link must be first focusable element in all layouts
- <Toaster /> mounted exactly once in root layout — never duplicate in route-group layouts
