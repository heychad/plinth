# Client Portal

## Overview
The client-facing UI in Next.js where end clients (spa owners, course creators, consultants) view their deployed agents, trigger runs, see run history, connect integrations, and receive coaching reports. Rendered under `/(client)/app/` routes with the consultant's white-label theme. Access requires role "client" enforced in middleware.

## Requirements

### Must Have
- Agent status cards: view all deployed agents with status badges (building, testing, deployed, paused)
- Run trigger: clients can manually run a deployed agent by submitting the input form
- Real-time run progress: live updates as pipeline steps complete (useQuery subscription)
- Run history: list of past runs with status, duration, cost, and output link
- Integration connections: OAuth connect/disconnect for each required integration slot
- Coaching reports view: coaches see only reports the admin has released to them (read-only)
- White-label rendering: all UI uses consultant's theme CSS variables, platformName, and logo

### Should Have
- Agent config self-service: clients can update customizableFields on their agent configs (within consultant-defined bounds)
- Integration connection status: clear indication of which integrations are connected and which are pending
- Notification for new coaching report: in-app notification badge when a new report is released to a coach

### Nice to Have
- Run output preview: display key output data inline (doc URL, summary stats) without leaving the portal
- Run re-trigger: client can re-run an agent with the same inputs from run history
- Empty state guidance: onboarding prompts when no agents are deployed yet

## Pages and Routes

All routes are under `/(client)/app/` and rendered with the consultant's white-label theme.

### `/app` — Client Home
**Purpose:** Landing page after login. Agent overview and quick actions.

**Header:** Branded header with consultant's logo and platformName.

**Agent status grid:**
- Card per deployed agentConfig
- Each card: display name, status badge, last run date, "Run Now" button (only for deployed status)
- Status badges: "Active" (green, deployed), "Setting Up" (yellow, building/testing), "Paused" (gray)
- Clicking a card → `/app/agents/{agentConfigId}`

**Quick stats bar:**
- Total runs this month (across all agents)
- Last run: agent name + time ago

### `/app/agents` — Agents List
**Purpose:** Full list of all deployed agent configs for the tenant.

Same data as home page but in table format with more detail:
- Columns: Name | Status | Template | Last Run | Runs This Month | Actions
- "Run Now" opens the input form inline or in a modal

### `/app/agents/{agentConfigId}` — Agent Detail
**Purpose:** Single agent view with run history, config preview, and run trigger.

**Agent info section:**
- Display name, template name, status badge
- Description of what this agent does (from template)
- Integration slots and their connection status

**Config section (if agent has customizableFields):**
- Show only the customizableFields (not locked ones)
- Inline edit: click a field to edit, save button per field
- Calls updateAgentConfig mutation with only the changed field
- Shows "This field is managed by [ConsultantName]" for locked fields (if shown at all — consider hiding locked fields from client view entirely)

**Run trigger section:**
- Input form dynamically generated from template.inputSchema
- Required fields marked with asterisk
- "Run Agent" submit button → calls triggerAgentRun mutation → redirects to `/app/agents/{agentConfigId}/runs/{runId}`

**Run history table:**
- Last 10 runs: Status | Trigger | Started | Duration | Output
- "View" link per run → `/app/agents/{agentConfigId}/runs/{runId}`
- "View All" link → `/app/runs?agentConfigId={id}`

### `/app/agents/{agentConfigId}/runs/{runId}` — Run Detail
**Purpose:** Real-time run status and step progress.

**Run header:**
- Agent name, run status badge, trigger type
- Start time, duration (live-updating if still running), cost (shown after completion)

**Step timeline:**
- List of agentRunSteps in order
- Each step: step name, status badge, duration
- Pending steps: grayed out
- Running step: animated spinner + elapsed time
- Completed steps: green checkmark + duration
- Failed step: red X + error message

**Output section (shown when status = "completed"):**
- Key outputs from run.output: e.g., Google Doc URL as a clickable link
- "View Full Output" expandable (shows run.output JSON for debugging — optional in Phase 1)

**Real-time behavior:** The page uses useQuery(api.agentRuns.getAgentRun, { runId }) and useQuery(api.agentRuns.listAgentRunSteps, { runId }). Convex automatically pushes updates when status changes — no polling needed.

### `/app/runs` — Run History
**Purpose:** Full run history across all agents.

**Filters:** Agent (dropdown), Status (All / Completed / Failed / Running), Date range.

**Table columns:** Agent | Status | Trigger | Started | Duration | Cost | Actions

- Pagination: load more button (50 per page)
- "View" → run detail page

### `/app/integrations` — Integration Connections
**Purpose:** Connect and manage OAuth integrations for all agent slots.

**Integration cards:**
Per required integration slot across all deployed agents for this tenant:

- Slot name: "Google Docs", "Google Sheets", "Slack", etc.
- Provider badge: Google / Slack / etc.
- Status: "Connected" (green checkmark + connected date) or "Not Connected" (orange warning)
- "Connect" button → calls initiateComposioOAuth → opens Composio OAuth in new tab → on callback, updates to Connected
- "Disconnect" button (connected state) → calls disconnectCredential mutation → resets to Not Connected
- Agents that need this integration: list of agent names using this slot

**Grouped by provider** (all Google slots together, all Slack slots together).

**Empty state:** If no agents are deployed yet, show "No integrations required yet. Your consultant will deploy agents to your account."

### `/app/reports` — Coaching Reports (Coach View)
**Purpose:** Coaches see only reports released to them. This page is only visible for users who have a coachId associated with them in the tenant's coaching program.

**Reports table:**
- Columns: Date | Student | Call # | Score | Status
- Only shows reports where releasedToCoach = true and coachId matches this user's coachId
- Score badge: green ≥ 80, yellow 70–79, red < 70
- Status: "Reviewed" (viewed at least once), "New" (not yet opened)
- Clicking a row → `/app/reports/{reportId}`

**Empty state:** "No feedback reports yet. Reports will appear here when your program admin shares feedback."

### `/app/reports/{reportId}` — Coach Report Detail
**Purpose:** Coach reads their feedback report (read-only).

**Report view:**
- Coach name + student name, call number + title, date + duration
- Overall score (large, colored)
- Dimension scorecard: shows scores and notes per dimension
- Highlights section (green)
- Concerns section (orange)
- Narrative: shows editedNarrative if set, otherwise narrative (whichever admin chose to send)
- **No transcript access** — coaches never see the raw transcript

**What coaches cannot see:**
- rawAnalysisJson
- Whether narrative was edited by admin
- Other coaches' reports
- Reports where releasedToCoach = false

## API Contracts

### Query: getClientHome
- **Signature:** `query(ctx) => { agentConfigs: AgentConfigSummary[], runCount: number, lastRunAt?: number }`
- **Auth:** Client role only
- **Returns:** AgentConfigSummary includes: configId, displayName, status, templateDisplayName, lastRunAt, monthlyRunCount

### Query: getAgentConfigForClient
- **Signature:** `query(ctx, { agentConfigId }) => AgentConfigClientView`
- **Auth:** Caller must be a client user in the tenant that owns this agentConfigId
- **Returns:** AgentConfigClientView includes: displayName, status, template.displayName, template.description, template.inputSchema, config (only customizableFields values), customizableFields, integrationSlots with their credential status; does NOT include locked field values or lockedFields array

### Query: listIntegrationsForTenant
- **Signature:** `query(ctx) => IntegrationSlotStatus[]`
- **Auth:** Client role — resolves tenantId from JWT
- **Returns:** IntegrationSlotStatus: `{ slotName, provider, connected, connectedAt?, agentNames: string[] }` — aggregated across all deployed agentConfigs for the tenant

### Mutation: disconnectCredential
- **Signature:** `mutation(ctx, { slotName }) => void`
- **Auth:** Tenant user or consultant
- **Behavior:** Sets credential status to "revoked"; calls Composio API to revoke the connection for the entity ID

### Query: getCoachReports
- **Signature:** `query(ctx) => CoachingCallReport[]`
- **Auth:** Client user only; resolves coachId from the user's profile or from agentConfig coach mapping
- **Behavior:** Returns only reports where releasedToCoach = true and coachId matches
- **Returns:** Filtered fields (no rawAnalysisJson, no transcriptStorageId, no editedNarrative meta)

### Query: getCoachReport
- **Signature:** `query(ctx, { reportId }) => CoachReportView | null`
- **Auth:** Client user; validates reportId belongs to their coachId and releasedToCoach = true
- **Returns:** CoachReportView: { overallScore, dimensionScores, highlights, concerns, narrative (editedNarrative if set else narrative), callNumber, callTitle, coachName, studentName, recordedAt }

## Behavioral Constraints
- All client-facing pages must render with the consultant's theme CSS variables — never with Plinth defaults unless the consultant has no theme configured
- Client users cannot access `/(consultant)/dashboard/` routes — middleware redirects to `/app`
- Clients can only update customizableFields — the updateAgentConfig mutation validates caller role and rejects writes to lockedFields
- The run input form is generated from template.inputSchema — adding a new input field to a template automatically adds it to all clients' run forms without code changes
- Run results (output) are read-only for clients — they cannot be edited
- Coaching reports visible to coaches must have releasedToCoach = true — this is enforced in getCoachReport query, not just in the UI
- A client user cannot see other tenants' data even if they know the IDs — every query checks tenantId from JWT against the queried document's tenantId

## Edge Cases
- **Agent in "building" or "testing" status:** Card shows the status badge but no "Run Now" button — agents must be in "deployed" status for client-triggered runs. If client navigates directly to the agent URL, show a "Not yet available" message.
- **Run fails immediately (invalid integration):** The run detail page shows "Failed" status with errorMessage "Integration not connected: google_docs. Connect Google Docs in the Integrations page." with a link to `/app/integrations`.
- **Real-time update lag:** Convex subscriptions deliver updates within 100ms in normal conditions. If the connection drops, useQuery displays a loading state. No manual refresh needed.
- **Client has no customizableFields:** The config section on the agent detail page is hidden entirely — do not show an empty form.
- **Coach has no reports yet:** `/app/reports` shows empty state. The reports nav link is hidden for users who have no coachId association.
- **Client portal for consultant (Maeve's edge case):** When Maeve logs into her own client portal (using her client-role user account), she sees her own agents and can run them like any client. Her consultant dashboard is accessible via a separate login or a role-switch mechanism (link in nav: "Switch to Admin View").
- **Integration connection in progress:** If a client has started the Composio OAuth flow but not completed it, the integration card shows "Connecting..." state. Refreshing the integrations page will show the updated status after the callback fires.

## Dependencies
- `platform-foundation.md` — users, tenants for access control
- `white-label-theming.md` — theme loaded in layout for CSS variable injection
- `agent-config-system.md` — getAgentConfigForClient, updateAgentConfig
- `agent-execution-engine.md` — triggerAgentRun, getAgentRun, listAgentRunSteps, listAgentRunsForTenant
- `output-integrations.md` — listIntegrationsForTenant, initiateComposioOAuth, disconnectCredential
- `coaching-call-analyzer.md` — getCoachReports, getCoachReport
