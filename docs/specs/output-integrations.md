# Output Integrations

## Overview
Integration adapters for agent pipeline outputs: Google Docs report creation, and email notification via Resend. Integrations are accessed through named slots resolved from agentConfig — credentials never appear in agent logic. Composio handles OAuth for Google; Resend uses a platform-level API key.

## Requirements

### Must Have
- Google Docs: create a new document and write formatted content via Composio with tenant's google_docs credential slot
- Resend email: send transactional notification emails using a platform-level Resend API key and per-tenant from-email address
- Integration slot resolution: at runtime, look up credential slot by name from tenant's credentials document → get Composio entity ID → execute tool via Composio SDK
- Credentials for each tenant isolated — one Composio entity per tenant per integration
- Report delivery confirms success before marking agentRun as complete

### Should Have
- Composio entity creation flow: consultant or client initiates OAuth from the client portal; Composio handles the OAuth handshake; entity ID is stored in tenant credentials
- Integration status queryable: tenant can see which slots are connected, when last used, and any error states
- Google Docs report uses structured formatting: heading, scorecard table, highlights/concerns bullets, narrative paragraphs
- Resend email templates per notification type (flagged call admin alert, coach report notification)

### Nice to Have
- Google Drive folder organization: reports created in a named subfolder per program within the client's Drive
- Email preview in admin UI before sending
- Resend webhook for delivery confirmation (bounce/delivered tracking)

## Data Models

The credentials document is defined in `platform-foundation.md`. Reproduced here for reference:

### Convex Document: credentials (relevant fields)
| Field | Type | Required | Description |
|---|---|---|---|
| _id | Id<"credentials"> | yes | Convex auto-generated |
| tenantId | Id<"tenants"> | yes | Owning tenant |
| slotName | string | yes | e.g., "google_docs", "google_sheets", "slack" |
| provider | string | yes | e.g., "google", "slack" |
| composioEntityId | string | no | Composio entity ID for OAuth-based integrations |
| status | "pending" \| "active" \| "expired" \| "revoked" \| "error" | yes | Connection health |
| connectedAt | number | no | Unix timestamp |
| lastUsedAt | number | no | Unix timestamp |
| errorMessage | string | no | Last error from Composio |

**Index:** `by_tenantId_slotName` (composite, unique) on (tenantId, slotName) — one credential per slot per tenant.

## Google Docs Integration

### Action: createGoogleDoc
- **Signature:** `internalAction(ctx, { tenantId, title, content, folderId? }) => { docId: string, docUrl: string }`
- **Auth:** Internal action — called from agent pipeline steps only
- **Behavior:**
  1. Resolve credentials for slotName "google_docs" for tenantId
  2. Validate credential status is "active"; throw IntegrationNotConnectedError if not
  3. Initialize Composio client with the tenant's composioEntityId
  4. Call Composio tool: `GOOGLEDOCS_CREATE_DOCUMENT` with title and body content
  5. If folderId provided: call Composio tool `GOOGLEDRIVE_MOVE_FILE` to place doc in folder
  6. Update credential.lastUsedAt
  7. Return docId and docUrl
- **Errors:** Throws IntegrationNotConnectedError if credential missing or not active; throws ComposioToolError on API failure with the Composio error detail

### Content Format for Coaching Call Reports

The Google Doc for a coaching call report is created with this structure:

```
[PROGRAM NAME] — COACHING CALL REPORT
[Platform Name] | Generated [date]

Coach: [name]    Client: [name]
Call #[X]: [Title]    Status: CLEAR / FLAGGED

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCORECARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Table: Dimension | Score | Max]
OVERALL SCORE: XX / 100

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HIGHLIGHTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• [highlight 1]
• [highlight 2]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONCERNS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• [concern 1]
• [concern 2]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FEEDBACK DRAFT
(Review and edit before sending to coach)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[narrative — 3 paragraphs]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIMENSION NOTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[one line per dimension]
Talk time: Coach ~X% / Client ~X%
```

The program name in the header comes from agentConfig.config.programName — not hardcoded.

## Resend Email Integration

### Action: sendNotificationEmail
- **Signature:** `internalAction(ctx, { templateName, to, subject, variables }) => { messageId: string }`
- **Auth:** Internal action only
- **Behavior:**
  1. Look up email template by templateName from NOTIFICATION_TEMPLATES constant
  2. Substitute variables into template subject and body
  3. Call Resend API: POST to `https://api.resend.com/emails` with platform API key
  4. Return Resend messageId on success
- **Variables:** Injected as `{{variable_name}}` in template body
- **Errors:** Throws ResendError with HTTP status and body on API failure

### Email Templates

**Template: flagged_call_admin**
- Subject: `{{programName}} — Flagged Call — {{coachName}} — Call #{{callNumber}} — {{score}}/100`
- To: agentConfig.config.adminEmail
- Body: 3-4 sentences. Score and flag status, 1-2 most important concerns in plain language, link to report in the platform dashboard.

```
{{adminName}},

{{coachName}}'s Call #{{callNumber}} ({{callTitle}}) scored {{score}}/100 and has been flagged for review.

Key concerns: {{concern1}}{{#concern2}}; {{concern2}}{{/concern2}}

Review the full report here: {{reportUrl}}
```

**Template: report_sent_to_coach**
- Subject: `{{coachName}}, {{adminName}} has shared feedback from your {{callDate}} call`
- To: coach's email address
- Body: Brief, professional. Directs coach to their dashboard to view the report.

```
Hi {{coachName}},

{{adminName}} has shared feedback from your {{callDate}} coaching call (Call #{{callNumber}}: {{callTitle}}).

You can view the full report in your dashboard: {{coachPortalUrl}}
```

### Resend Configuration
- API key stored as Convex environment variable: `RESEND_API_KEY`
- From email: per-agentConfig, from `agentConfig.config.resendFromEmail` (e.g., "reports@smartscale.com")
- From domain must be verified in Resend before use
- Rate limit: Resend free tier allows 100 emails/day; Phase 1 expected volume is well below this

## Composio Integration Management

### Action: initiateComposioOAuth
- **Signature:** `action(ctx, { tenantId, slotName, provider, redirectUrl }) => { authUrl: string }`
- **Auth:** Tenant user (client initiating their own connection) or consultant
- **Behavior:**
  1. Get or create Composio entity for this tenantId (entity ID = `plinth_tenant_{tenantId}`)
  2. Call Composio API to initiate OAuth: `composio.connectedAccounts.initiate({ entityId, appName: provider, redirectUri: redirectUrl })`
  3. Return the Composio-generated auth URL for the client to visit
- **Errors:** Throws if Composio API call fails; throws if slotName is not in the template's integrationSlots

### HTTP Endpoint: GET /oauth/composio/callback
- **Handler:** Convex httpAction
- **Behavior:** Receives Composio OAuth callback; extracts entityId and connectionId from query params; updates credentials document: status = "active", composioEntityId = entityId, connectedAt = now(); redirects to client portal integrations page
- **Errors:** On callback error param: update credential status to "error", errorMessage = error description; redirect to integrations page with error state

### Query: getCredentialStatus
- **Signature:** `query(ctx, { tenantId, slotName }) => { connected: boolean, status: string, connectedAt?: number, lastUsedAt?: number } | null`
- **Auth:** Tenant user or consultant who owns the tenant

### Internal Action: resolveCredentials
- **Signature:** `internalAction(ctx, { tenantId, slotNames }) => Record<string, { composioEntityId: string, status: string }>`
- **Behavior:** Batch-resolves all credential slots needed for a pipeline; returns map of slotName → credential; throws IntegrationNotConnectedError for any required slot not in "active" status
- **Usage:** Called at pipeline start before first step executes; prevents partial pipeline runs where some steps succeed and others fail due to missing credentials

## Behavioral Constraints
- Credentials are resolved once at pipeline start (resolveCredentials) and passed to each step — steps do not look up credentials individually
- The Composio entity ID is the only identifier stored — raw OAuth tokens are never stored in Convex documents; Composio holds the tokens
- Email sends are fire-and-forget: the agentRun is marked complete regardless of email delivery status. A failed email is logged in the run's errorDetail but does not fail the run.
- Google Docs URL must be returned from createGoogleDoc and stored in coachingCallReports.docUrl before the pipeline marks itself complete — the URL is the primary output artifact
- Platform-level Resend API key is shared across all tenants; per-tenant from-email addresses must be verified in Resend for that domain; unverified from-email causes Resend to reject with 422
- All external API calls (Composio, Resend) have a 30-second timeout — if they exceed this, the action throws TimeoutError and the Workflow retry handles it

## Edge Cases
- **Integration not connected at run time:** A user runs an agent but the required google_docs slot is not connected. resolveCredentials throws IntegrationNotConnectedError. The run transitions to "failed" with errorMessage "Integration not connected: google_docs. Connect Google Docs in the Integrations page." The user is not charged tokens for this run.
- **Composio entity created but OAuth not completed:** Entity exists, but credential status is "pending" (user started but didn't finish OAuth). resolveCredentials treats this as not connected — same failure path.
- **Google Doc creation fails (quota exceeded or permission error):** The Composio tool call fails. The createGoogleDoc action throws ComposioToolError. The Workflow handles retry (up to 3 times). After 3 failures, the run fails. The transcript analysis output is still stored in agentRunSteps — it's not lost. The admin can view the analysis results in the platform without a Google Doc URL.
- **Report URL in email is stale:** The reportUrl in notification emails points to the platform dashboard (not the Google Doc). This URL is always valid as long as the run record exists.
- **Resend from-email domain not verified:** Resend returns 422. The notification action throws ResendError. Email failure is logged but run continues — admin can see the report in dashboard regardless.

## Dependencies
- `platform-foundation.md` — credentials document, tenants document
- `agent-config-system.md` — agentConfigs for slotName resolution
- `agent-execution-engine.md` — resolveCredentials called at pipeline start
- `coaching-call-analyzer.md` — primary consumer of createGoogleDoc and sendNotificationEmail
- Composio SDK for Google OAuth and Docs tool execution
- Resend API for transactional email
