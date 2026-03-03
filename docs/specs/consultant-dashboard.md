# Consultant Dashboard

## Overview
The consultant-facing UI in Next.js where Maeve manages her client roster, assigns agent templates to clients, reviews reports and usage statistics, and configures her white-label branding. All pages are under the `/(consultant)/` route group; access requires role "consultant" enforced in middleware.

## Requirements

### Must Have
- Client roster view: list of all tenants with status, agent count, and last active date
- Individual client detail: view a client's deployed agents, integration connection status, and recent runs
- Agent template assignment: deploy an agent template to a client from the template library
- Reports overview: list all coachingCallReports across all tenants with filter by status (flagged, sent, no_action) and coach
- Usage statistics: per-tenant token consumption and cost for the current billing period
- White-label settings: update theme (platformName, colors, logo) for their brand
- Role-enforced routing: consultants trying to access `/app` routes are redirected to `/dashboard`

### Should Have
- Consultant can switch between their consultant view and their own client view (for consultants who are also their own first client)
- Pagination on all list views (cursor-based)
- Client status management: set tenant status to paused or churned from the roster
- Agent config editor: consultant can update any field of a client's agentConfig (not restricted to customizableFields — consultant has full access)

### Nice to Have
- Usage chart: cost trend over 30 days per tenant
- Agent run log: per-client view of all agent runs with inputs and outputs
- Bulk template deployment: assign an agent template to multiple clients at once

## Pages and Routes

### `/dashboard` — Consultant Home
**Purpose:** Landing page after login. Overview stats + client roster.

**Stats bar (4 cards):**
- Total active clients (tenants with status "active")
- Agents deployed across all clients (sum of deployed agentConfigs)
- Flagged reports pending review (coachingCallReports where flagged=true, status="draft")
- Total API cost this month (sum of usageLogs for current month)

**Client roster table:**
Columns: Business Name | Owner | Status | Agents | Last Run | Monthly Cost | Actions

- Business Name: tenant.businessName
- Owner: tenant.ownerName
- Status: badge — "Active" (green), "Paused" (yellow), "Churned" (gray)
- Agents: count of deployed agentConfigs for this tenant
- Last Run: timestamp of most recent agentRun for any of their configs
- Monthly Cost: sum of usageLogs.costUsd for this tenant in current month
- Actions: "View" button → `/clients/{tenantId}`; "Pause" / "Reactivate" toggle

**Filters:** Search by business name or owner name; filter by status.

### `/clients` — All Clients List
Same as the roster table in `/dashboard`, but full-page with additional filter and sort options.

### `/clients/{tenantId}` — Client Detail
**Purpose:** Full view of one client: their agents, integrations, recent runs, and agent reports.

**Header:** Business name, owner name, vertical badge, status badge, edit pencil to update notes.

**Agents tab:**
- List of agentConfigs for this tenant
- Each card: display name, status badge, template name, last run date, run count this month
- "Deploy New Agent" button: opens template picker modal → consultant selects template → deployAgentConfig mutation → new config appears with status "building"
- Clicking an agent card: opens agent detail drawer with config editor (all fields, not restricted to customizableFields)

**Integrations tab:**
- List of required integration slots across all deployed agent templates for this tenant
- Each slot: slot name, provider, connection status, connected-at date
- "Connect" button for disconnected slots → initiates Composio OAuth flow in new tab
- Composio OAuth callback returns to this page with connection confirmation

**Recent Runs tab:**
- List of last 20 agentRuns for this tenant across all agents
- Columns: Agent | Status | Trigger | Duration | Cost | Started At
- Clicking a run → `/clients/{tenantId}/runs/{runId}`

**Reports tab (coaching clients only):**
- If tenant has any coachingCallReports: list them with same columns as `/reports`
- Quick "Review" and "Send to Coach" actions inline

### `/clients/{tenantId}/runs/{runId}` — Run Detail
**Purpose:** Full run detail view for debugging.

- Run header: agent name, status, trigger type, duration, cost
- Step timeline: list of agentRunSteps with status, duration, token count per step
- Expanding a step: shows step output and raw model response
- Error detail if status is "failed": display errorMessage and errorDetail

### `/agents` — Agent Template Library
**Purpose:** Browse available agent templates to assign to clients.

- Grid of agentTemplates (isActive = true)
- Each card: display name, category badge, description, integration slots needed, "Deploy to Client" button
- "Deploy to Client" opens a client picker modal → select tenant → calls deployAgentConfig

### `/reports` — Reports Overview (Coaching)
**Purpose:** Review all coaching call reports across all tenants.

**Filters:** Status (All / Flagged / Sent / Clear / No Action), Coach, Call Number, Date range.

**Table columns:** Date | Client | Coach | Student | Call # | Score | Status | Actions

- Score: colored badge (green ≥ 80, yellow 70–79, red < 70)
- Status: Flagged (red) / Sent (blue) / Clear (gray) / Reviewed (yellow) / No Action (gray)
- Actions: "Review" → `/reports/{reportId}`, or "View" if already sent

**Default sort:** Flagged+draft first, then by createdAt descending.

### `/reports/{reportId}` — Report Detail
**Purpose:** Review a coaching call report, edit the narrative, send to coach.

**Left panel (60%):**
- Coach + student header, call number + title, date + duration + coach talk %
- Scorecard: overall score (large, colored) + dimension progress bars
- Highlights section (green background)
- Concerns section (red background)
- Narrative textarea: pre-filled with AI narrative; editable inline; saves on blur
- Buttons: "Send to Coach" (primary), "Save Draft" (secondary), "Mark No Action" (tertiary)

**Right panel (40%):**
- Full transcript viewer: scrollable, monospace font, speaker labels preserved
- Transcript is loaded from Convex file storage via a URL from getTranscriptUrl query

**"Send to Coach" flow:**
1. Consultant clicks "Send to Coach"
2. Confirmation modal: "Send feedback to [Coach Name]? They will receive an email notification."
3. On confirm: call sendReportToCoach mutation → report status → "sent", coach receives email, releasedToCoach = true

### `/settings` — Consultant Settings
**Purpose:** Manage account and white-label configuration.

**Profile tab:** Update displayName, email (view only).

**Theme tab:** Edit white-label theme.
- PlatformName input
- Logo upload (drag-and-drop, max 2 MB, PNG/JPEG/SVG)
- Color pickers for primary, secondary, accent, background, text colors
- Font family dropdown (Inter, Poppins, Lato, Montserrat, Open Sans)
- Live preview panel showing a mock client portal header with current settings
- "Save Theme" button → upsertTheme mutation

### `/settings/notifications` — Notification Thresholds
**Purpose:** Configure per-tenant notification settings.

- Score threshold slider/input per coaching program deployment
- "Notify me when a call scores below: [70]" default
- Save updates agentConfig.config.notificationThreshold

## API Contracts

### Query: getConsultantDashboard
- **Signature:** `query(ctx) => { activeClientCount: number, totalAgentsDeployed: number, flaggedReportCount: number, monthlyCostUsd: number }`
- **Auth:** Consultant role
- **Behavior:** Aggregates across all tenants owned by calling consultant

### Query: listClientsForConsultant
- **Signature:** `query(ctx, { search?, status?, cursor?, limit? }) => { tenants: TenantSummary[], nextCursor: string | null }`
- **Auth:** Consultant role
- **Returns:** TenantSummary includes: tenantId, businessName, ownerName, status, deployedAgentCount, lastRunAt, monthlyUsageCost

### Query: getClientDetail
- **Signature:** `query(ctx, { tenantId }) => { tenant: Tenant, agentConfigs: AgentConfig[], credentials: CredentialStatus[], recentRuns: AgentRun[] }`
- **Auth:** Consultant must own the tenantId
- **Returns:** Full client detail; credentials include connection status per slot but not raw credentials

### Query: listCoachingReportsForConsultant
- **Signature:** `query(ctx, { status?, coachId?, callNumber?, dateFrom?, dateTo?, cursor?, limit? }) => { reports: CoachingCallReport[], nextCursor: string | null }`
- **Auth:** Consultant — sees reports from all their tenants
- **Default sort:** flagged+draft first, then createdAt descending

### Query: getTranscriptUrl
- **Signature:** `query(ctx, { reportId }) => { url: string } | null`
- **Auth:** Consultant who owns the report's tenant; never accessible to coaches (they don't see transcripts)
- **Behavior:** Generates a short-lived Convex storage URL for the VTT file; URL expires in 1 hour

## Behavioral Constraints
- Middleware enforces that users with role "consultant" cannot access `/(client)/app/` routes — they are redirected to `/dashboard`
- Consultant can update any field of a client's agentConfig including locked fields — locked fields are only a restriction on client users
- The reports list (`/reports`) shows reports from ALL tenants, not one at a time — this is the consultant's cross-client view
- "Send to Coach" is irreversible — once sent (status = "sent"), the report cannot be unsent. The narrative the coach receives is final.
- Usage statistics are read from usageLogs (not computed live from runs) for performance — logs are written at run completion
- The theme preview in `/settings/theme` applies CSS variables in real-time as the consultant edits — it is a preview, not a save

## Edge Cases
- **Consultant with no clients yet:** `/dashboard` shows 0 for all stats and empty roster table with "Add your first client" CTA.
- **Client with no deployed agents:** Client detail shows empty agents tab with "Deploy an agent" prompt.
- **Run in "running" state:** The run list shows "Running" with a spinner for active runs; clicking shows the real-time step progress (useQuery auto-updates).
- **Report narrative is empty:** If the AI somehow returned an empty narrative, the textarea is blank. Consultant must write their own feedback before sending. "Send to Coach" button is disabled until narrative (editedNarrative or narrative) has at least 50 characters.
- **Consultant tries to delete a client:** Hard delete is not supported in Phase 1. Consultant can only set status to "churned." All data is retained.

## Dependencies
- `platform-foundation.md` — tenants, users, consultants queries
- `white-label-theming.md` — upsertTheme, getThemeForCurrentUser
- `agent-config-system.md` — listAgentTemplates, deployAgentConfig, updateAgentConfig
- `agent-execution-engine.md` — listAgentRunsForTenant, getAgentRun, listAgentRunSteps
- `coaching-call-analyzer.md` — listCoachingReports, updateReportNarrative, sendReportToCoach, markNoAction
- `output-integrations.md` — getCredentialStatus, initiateComposioOAuth
