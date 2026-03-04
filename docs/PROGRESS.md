# Progress

Sprint log -- append only, never overwrite.

---

## 2026-03-03 — Cycle: Item 9 (Auth Layout)

- **Item 9** (foundation): Created `src/app/(auth)/layout.tsx` — centered full-screen container with `min-h-screen items-center justify-center bg-background`. Backpressure green.

---

## 2026-03-02 — Sprint Review + PRD Fix Cycle

**Sprint planner applied reviewer findings to PRD.json. 33 items → 39 items after fixes.**

### Blockers Fixed (B-series)

- **B-1** Reordered coachingCallReports schema (originally Item 19) to come before platform tools (originally Item 11). New IDs: schema = Item 12, platform tools = Item 13. Dependency resolved: query_reports tool now has its table defined first.
- **B-2** Added `docUrl` field explicitly to Item 12 (coachingCallReports schema) step definition. Previously omitted even though Format step writes it and UI reads it.
- **B-3** Fixed Item 22 (Analyze step) to specify `coachTalkPercent` as `z.number().min(0).max(100).nullable()` in AnalysisResultSchema. Spec permits null when coach speaker cannot be identified.
- **B-4** Removed GHL contact lookup from Item 21 (Intake step). No GHL spec, credentials, or integration defined. callNumber now comes from agentRun.input.callNumber or is null.
- **B-5** Updated Item 1 notes to clarify credentials table schema is fully owned by Item 14 (output-integrations.md), not Item 1.

### Omissions Added (O-series)

- **O-1** Added Item 26: `/clients` full-page route. Defined in specs/consultant-dashboard.md as a distinct page with additional sort/filter options beyond the /dashboard roster.
- **O-2** Added `toolDefinitions` array field to agentTemplates schema in Item 5. Per specs/agent-execution-engine.md, templates can define custom tools.
- **O-3** Added email trigger to `sendReportToCoach` in Item 12. Mutation now triggers `report_sent_to_coach` email notification to coach.
- **O-4** Added Item 7: `getAgentConfigForClient` query that returns AgentConfigClientView (strips locked field values). Multi-tenancy critical — locked values must not reach client browsers.
- **O-5** Added `runCount` and `lastRunAt` verification steps to Item 32 (/app home page). getClientHome already returns these; now explicitly verified in steps.

### Splits (S-series)

- **S-1** Item 24 (client detail page) split into Item 27 (Part A: header + Agents tab + deploy modal) and Item 28 (Part B: Integrations + Recent Runs + Reports tabs).
- **S-2** Item 20 (Intake + Analyze) split into Item 21 (Intake only) and Item 22 (Analyze only).
- **S-3** Item 28 (client portal pages) split into Item 32 (/app home), Item 33 (agent detail + config self-service + run trigger), and Item 34 (real-time run detail).

### Warnings Addressed (W-series)

- **W-1** Clarified in Item 21 (Intake) that webhook path reads `agentRun.input.transcriptStorageId` — does NOT re-download VTT. Item 18 already stored it.
- **W-3** Added `updateStepStatus` internal mutation to Item 9 (Workflows setup). executeAgent (Item 10) calls it to log tool calls and step transitions in real time.
- **W-4** Item 19 (coach analyzer template) now specifies seed script creation. GitHub sync (Item 20) updates the template later but does not create it.
- **W-6** Added `by_tenantId_loggedDate` index on usageLogs to Item 1 for monthly cost aggregation.
- **W-7** Added `scheduleTimezone` default "UTC" to Item 6's `deployAgentConfig` steps.
- **W-9** Item 39 (E2E scenario) marked as QA verification scenario only — not a build item. Notes updated with explicit warning.

### Final Item Count

39 items total (was 33). New IDs assigned sequentially. All cross-references in notes updated.

| Category | Count |
|---|---|
| foundation | 8 (Items 1–8) |
| core-system | 8 (Items 9–16) |
| first-agent | 7 (Items 17–23) |
| ui | 14 (Items 24–37) |
| integration | 2 (Items 38–39) |

---

## 2026-03-02 — Second Reviewer Pass: PRD Fix Cycle

**Sprint planner applied second-pass reviewer findings. 39 items — item count unchanged, in-place corrections only.**

### Blockers Fixed (NB-series)

- **NB-1** Item 7 (`getAgentConfigForClient`) return shape was incorrectly including "integrationSlots with credential status". Credentials table is not defined until Item 14, creating a forward dependency. Removed credential status from Item 7's return shape. Item 7 now returns agent config data only (displayName, status, template info, customizable config fields). Credential status enrichment moved to Item 35 (integrations page) via `listIntegrationsForTenant`. Item 33 (agent detail page) updated in notes to clarify integration slot status loads from `listIntegrationsForTenant`, not `getAgentConfigForClient`.

### Omissions Added (NO-series)

- **NO-1** `getTranscriptUrl` query was missing as a build item. Item 30 (report detail page) consumed it in the transcript viewer step but nothing built it. Added `getTranscriptUrl` as the final step in Item 12 (coachingCallReports schema and CRUD). The query calls `ctx.storage.getUrl(report.transcriptStorageId)` to generate a short-lived Convex storage URL; admin-only access; returns null if no transcriptStorageId set. Item 30 step updated to reference Item 12 as the source.

### Warnings Addressed (NW-series)

- **NW-1** Item 31 (/settings page): First step now explicitly states "all tabs are rendered within the single /settings route — Notifications is NOT a separate /settings/notifications route." Notes field updated with builder warning.
- **NW-2** Item 8 (`triggerAgentRun`): Added explicit step — "triggerAgentRun reads agentTemplate.executionMode and schedules the selected workflow via ctx.scheduler.runAfter(0, ...) and stores the returned workflowId on the agentRun document." Item 9 notes updated to clarify workflow shells are defined there but dispatch lives in Item 8. No conflicting reference found in Item 10.
- **NW-3** Item 5 (agentConfigHistory schema): `createdAt` (number, Unix timestamp — required) explicitly enumerated in the agentConfigHistory fields list. Notes updated.
- **NW-4** HTTP route registration steps added to all items that define HTTP endpoints:
  - Item 14 (Composio callback): "Route registered in convex/http.ts via http.route({ path: '/oauth/composio/callback', method: 'GET' })"
  - Item 17 (Zoom webhook): "Route registered in convex/http.ts via http.route({ path: '/webhooks/zoom', method: 'POST' })"
  - Item 20 (GitHub template sync): "Route registered in convex/http.ts via http.route({ path: '/webhooks/github-template-sync', method: 'POST' })"
  - Note: Reviewer listed "Item 15 (Zoom webhook)" using pre-renumber IDs. In the current PRD, Zoom webhook is Item 17 and Item 15 is Google Docs (no HTTP endpoint — not modified). Item 18 (processZoomTranscript) is an internal action, not an HTTP endpoint — not modified.
- **NW-5** Item 37 (secondary nav pages): `spec` field retained as `specs/consultant-dashboard.md` (the item's primary spec) but each step now includes an inline `(spec: ...)` citation. /agents cites `specs/consultant-dashboard.md`; /app/runs and /app/agents cite `specs/client-portal.md`. Notes field updated.
- **NW-6** Item 26 (/clients page): Added step — "listClientsForConsultant accepts an optional sortBy parameter with values 'businessName' | 'lastRun' | 'monthlyCost' and an optional sortDir parameter 'asc' | 'desc'; default sort is businessName ascending; sort is applied server-side in the query." Notes updated.

### Item Count

39 items total — unchanged from previous cycle. All fixes were in-place edits to existing items.

| Category | Count |
|---|---|
| foundation | 8 (Items 1–8) |
| core-system | 8 (Items 9–16) |
| first-agent | 7 (Items 17–23) |
| ui | 14 (Items 24–37) |
| integration | 2 (Items 38–39) |

---

## 2026-03-02 — Third Reviewer Pass: Final Fixes Applied Directly

**5 remaining issues from Round 3 review applied directly. 39 → 40 items.**

### Fixes Applied

- **W-1** Added `tenantId (Id<'tenants'>)` to agentRunSteps schema in Item 8. Required field per spec, denormalized for access control.
- **W-2** Item 18 (getOrRefreshZoomToken) now specifies encrypting new accessToken before writing back to zoomCredentials. Security constraint from spec and CLAUDE.md.
- **W-3** Item 33 notes updated with dependency callout: integration slot status section depends on Item 35's `listIntegrationsForTenant` query. Stub-then-wire pattern for parallel builds.
- **W-4** Item 26 notes updated with explicit dependency on Item 25: `listClientsForConsultant` sortBy/sortDir parameters modify the query first built in Item 25.
- **O-1** Added Item 40: Template propagation (`syncAgentConfigWithTemplate` mutation). Must Have from specs/agent-config-system.md. Includes "Update Available" badge UI on agent config card. Depends on Items 5, 6, and 20.

### Final Item Count

40 items total (was 39).

| Category | Count |
|---|---|
| foundation | 8 (Items 1–8) |
| core-system | 8 (Items 9–16) |
| first-agent | 8 (Items 17–23, 40) |
| ui | 14 (Items 24–37) |
| integration | 2 (Items 38–39) |

---

## Cycle 1 Complete — 2026-03-02

**Items completed:** 1, 2, 3, 4, 5, 8 (Foundation Schema + Auth + Base CRUD)

**What was built:**
- **Item 1:** `convex/schema.ts` — All 10 tables (consultants, tenants, users, usageLogs, themes, agentTemplates, agentConfigs, agentConfigHistory, agentRuns, agentRunSteps) with all fields, validators, and indexes from specs
- **Item 2:** `convex/auth.ts` — requireAuth (reads ctx.auth.getUserIdentity, looks up user by clerkUserId), requireRole (throws on mismatch), getCurrentUser query
- **Item 3:** `convex/consultants.ts` (getConsultant), `convex/tenants.ts` (listTenants with pagination, createTenant with duplicate email check), `convex/users.ts` (createUser with role/owner constraint)
- **Item 4:** `convex/themes.ts` — getThemeByConsultantId, getThemeForCurrentUser, upsertTheme (hex color + font family validation), generateThemeUploadUrl, updateThemeLogo
- **Item 5:** Schema tables for agentTemplates (with executionMode, toolDefinitions), agentConfigs, agentConfigHistory — all in schema.ts
- **Item 8:** `convex/agentRuns.ts` (triggerAgentRun, getAgentRun, listAgentRunsForTenant, cancelAgentRun, updateRunStatus internalMutation), `convex/agentRunSteps.ts` (listAgentRunSteps)

**Project initialization:**
- package.json with convex, next@16, react@19, @clerk/nextjs
- tsconfig.json (excludes convex/ — Convex has its own tsconfig)
- convex/convex.config.ts, convex/tsconfig.json (auto-generated)
- next.config.ts, eslint.config.mjs, .gitignore
- Minimal src/app/layout.tsx and src/app/page.tsx

**What was learned:**
- Convex codegen requires a connected deployment — cannot generate _generated/ types without CONVEX_DEPLOYMENT
- Root tsconfig must exclude convex/ — Convex has its own TS build via convex/tsconfig.json
- ESLint flat config with Next.js compat layer is fragile — simpler configs with @eslint/js more reliable
- Builder agents sometimes go idle without creating files — re-engage via SendMessage
- Schema file is a natural serialization point — one builder for all schema, then CRUD builders in parallel

**Files changed:**
- convex/schema.ts, convex/convex.config.ts, convex/tsconfig.json, convex/README.md
- convex/auth.ts, convex/consultants.ts, convex/tenants.ts, convex/users.ts
- convex/themes.ts, convex/agentRuns.ts, convex/agentRunSteps.ts
- package.json, tsconfig.json, next.config.ts, eslint.config.mjs, .gitignore
- src/app/layout.tsx, src/app/page.tsx

**Verification:**
- `npx tsc --noEmit` — PASS
- `npx eslint . --max-warnings 0` — PASS
- `npx convex typecheck` — DEFERRED (requires Convex deployment)

**PRD status:** 6/40 items passing

**Next priority items:** Items 6, 7, 9, 10

**Active Signs:**
- SIGN-1: Convex codegen requires deployment — must connect before full backpressure runs
- SIGN-2: Sprint-builder agents may idle without completing — monitor and re-engage via SendMessage
- SIGN-3: triggerAgentRun has TODO for workflow scheduling (depends on Item 9)

**Decisions in effect:**
- Root tsconfig excludes convex/ — Convex type-checked separately via convex/tsconfig.json
- ESLint uses flat config with @eslint/js + @typescript-eslint/parser (not eslint-config-next compat)
- Multi-tenancy pattern: requireAuth → check role → scope by consultantId/tenantId
- All tables in one convex/schema.ts file; CRUD in separate files per domain area
- uploadThemeLogo uses Convex generateUploadUrl pattern (client uploads, then calls mutation with storageId)

---

## Cycle 2 Complete — 2026-03-02

**Items completed:** 6, 7, 9, 10, 11, 12, 13, 14, 15, 16 (Core-System Backend Layer)

**What was built:**
- **Item 6:** `convex/agentTemplates.ts` (listAgentTemplates), `convex/agentConfigs.ts` (deployAgentConfig, updateAgentConfig with locked-field enforcement, getAgentConfig, listAgentConfigsForTenant), `convex/agentConfigHistory.ts` (getAgentConfigHistory)
- **Item 7:** `convex/agentConfigs.ts` added getAgentConfigForClient (client-safe view, strips locked fields), getResolved internalQuery (merged config for execution engine)
- **Item 9:** `convex/execution/agentWorkflow.ts` + `convex/execution/simpleWorkflow.ts` using @convex-dev/workflow WorkflowManager. Wired triggerAgentRun to schedule workflows, cancelAgentRun to cancel. Added createStep + updateStepStatus to agentRunSteps.ts
- **Item 10:** `convex/execution/executeAgent.ts` (full agentic loop: Anthropic client, tool dispatch, step logging, maxTurns, extended thinking, 9-min checkpoint) + `convex/execution/executeSimple.ts` (single-call fallback)
- **Item 11:** `convex/memory.ts` (RAG with text-embedding-3-small, tenant namespaces, deduplication >0.97, captureMemory/retrieveMemory internalActions, deleteMemory/listMemoriesForTenant with auth, compactMemories) + `convex/agentSetup.ts` (Agent component with hybrid search)
- **Item 12:** `convex/coachingCallReports.ts` (408 lines, 9 functions: get, list, updateNarrative, sendToCoach, markNoAction, scoreTrend, transcriptUrl, createReport/updateReport internal)
- **Item 13:** `convex/execution/platformTools.ts` (6 platform tools in Anthropic schema format + executePlatformTool handler, all tenant-scoped)
- **Item 14:** `convex/credentials.ts` (CRUD + resolveCredentials batch resolver), `convex/integrations/composio.ts` (initiateComposioOAuth), `convex/webhooks/composioCallback.ts` (httpAction), `convex/http.ts` (/oauth/composio/callback route)
- **Item 15:** `convex/integrations/googleDocs.ts` (createGoogleDoc via Composio, formatCoachingReport helper)
- **Item 16:** `convex/integrations/resend.ts` (sendNotificationEmail, 2 templates, variable substitution with conditionals)

**What was learned:**
- Builders on shared main WITHOUT worktrees cross-commit each other's files — builder prompts MUST include "DO NOT run ANY git commands"
- Lead must handle ALL git operations — stage files explicitly by name, never git add .
- Scout's file ownership map is the contract — lead verifies against it before committing
- @convex-dev/agent requires convex-helpers as peer dependency — install upfront
- @typescript-eslint/eslint-plugin must be loaded for disable directives to work
- Console and Blob globals needed in ESLint config for Convex node actions
- npm install needs --legacy-peer-deps due to eslint version conflict
- (internal as any).module.fn pattern works for cross-module refs before codegen runs

**Files changed:**
- convex/schema.ts (added coachingCallReports + credentials tables)
- convex/convex.config.ts (added workflow, rag, agent components)
- convex/agentTemplates.ts, convex/agentConfigs.ts, convex/agentConfigHistory.ts
- convex/execution/agentWorkflow.ts, convex/execution/simpleWorkflow.ts
- convex/execution/executeAgent.ts, convex/execution/executeSimple.ts
- convex/execution/platformTools.ts
- convex/memory.ts, convex/agentSetup.ts
- convex/coachingCallReports.ts
- convex/credentials.ts, convex/integrations/composio.ts
- convex/webhooks/composioCallback.ts, convex/http.ts
- convex/integrations/googleDocs.ts, convex/integrations/resend.ts
- convex/agentRuns.ts (workflow scheduling wired), convex/agentRunSteps.ts (createStep, updateStepStatus added)
- eslint.config.mjs, package.json, package-lock.json

**Verification:**
- `npx tsc --noEmit` — PASS
- `npx eslint . --max-warnings 0` — PASS
- `npm run build` — PASS
- `npx convex typecheck` — DEFERRED (requires connected deployment)

**PRD status:** 16/40 items passing

**Next priority items:** Items 17-18 (Zoom integration — blocked pending Daniela's org info), Items 19-23 (coaching call analyzer pipeline), Items 24+ (UI)

**Active Signs:**
- SIGN-1: Convex codegen requires deployment — (internal as any) pattern used throughout
- SIGN-2: Sprint-builder agents idle mid-task — re-engage via SendMessage
- SIGN-4: Only composioEntityId stored in credentials — raw OAuth tokens held by Composio
- SIGN-5: Memory deduplication at vectorScoreThreshold > 0.97 — implemented in captureMemory
- SIGN-6: Extended thinking critical for coaching analyzer — enableThinking wired in executeAgent
- SIGN-7: Builders cross-commit on shared main — MUST enforce no-git-commands in builder prompts

**Decisions in effect:**
- All Cycle 1 decisions still in effect
- @convex-dev/workflow, @convex-dev/rag, @convex-dev/agent registered as components
- Agent SDK (Anthropic) is primary execution; Client SDK is fallback (executeSimple)
- Platform tools dispatched via executePlatformTool in same process (not ctx.runAction)
- Composio entity ID format: plinth_tenant_{tenantId}
- Email templates use {{variable}} substitution with {{#key}}conditional{{/key}} blocks
- Unused eslint-disable directives suppressed via reportUnusedDisableDirectives: "off"

---

## Cycle 3 Complete — 2026-03-02

**Items completed:** 17 (Zoom webhook endpoint), 18 (Zoom transcript processing), 38 (Zoom credentials management)
**What was built:**
- Item 17: POST /webhooks/zoom httpAction with Web Crypto HMAC-SHA256 signature validation, challenge-response handler, event routing, deferred processing via ctx.scheduler.runAfter
- Item 18: processZoomTranscript internalAction with VTT download (3x retry), parseVTT/computeCoachTalkPercent helpers, Convex file storage, createWebhookAgentRun for auth-free triggers, getOrRefreshZoomToken for Zoom S2S OAuth
- Item 38: saveZoomCredentials action (AES-256-CBC encryption), getZoomConnectionStatus query, internal helpers (getDecryptedCredByAccountId, getChallengeSecret, getCredentialsForTenant, updateAccessToken)
**What was learned:**
- httpAction is incompatible with Node crypto imports even in "use node" files — Convex bundles httpAction for V8 runtime. Use Web Crypto API (crypto.subtle) for HMAC in httpActions.
- Encryption format must be consistent across all modules — builder-18 and builder-38 used different formats (separator vs no separator, hex key vs UTF-8 key). Lead caught and fixed during verification.
- "use node" works with query/mutation/internalQuery/internalMutation (zoomCredentials.ts) but httpAction in same file causes bundler errors if Node built-ins are imported.
- Builder isolation (no-git rule) worked perfectly — zero cross-commits, zero orphaned files. All builders wrote files only, lead committed.
**Files changed:**
- Builder-17: convex/webhooks/zoom.ts (CREATE), convex/http.ts (MODIFY)
- Builder-18: convex/integrations/zoom.ts (CREATE)
- Builder-38: convex/zoomCredentials.ts (CREATE)
- Lead: convex/schema.ts (prep — zoom tables), eslint.config.mjs (globals), package.json (test script, deps)
**PRD status:** 19/40 items passing
**Next priority items:** Items 19-23 (coaching call analyzer pipeline — seed template, intake, analyze, format+deliver), then Item 20 (GitHub template sync)
**Active Signs:**
- SIGN-1: Convex codegen requires live deployment — 17 pre-existing typecheck errors across 8 files. Use (internal as any) pattern.
- SIGN-7: Builders must NOT run git commands — enforced in Cycle 3, worked perfectly.
- SIGN-8: Zoom event deduplication on zoomMeetingId is critical — check processed=true before processing.
- SIGN-9: HTTP response timing hard constraint — Zoom requires 200 within 3s. Defer all heavy work.
- SIGN-11: httpAction incompatible with Node crypto — use Web Crypto API for crypto ops in httpAction handlers.
- SIGN-12: Encryption format must be consistent — use zoomCredentials.ts format (no separator, UTF-8 key derivation) as the canonical pattern.
**Decisions in effect:**
- saveZoomCredentials is an action (not mutation) because encryption requires Node crypto + process.env
- coachTalkPercent always returns null until zoomUserId→coach mapping table is built
- Challenge-response uses first available credential record from DB (not env var)
- Convex typecheck failures (SIGN-1) are accepted until deployment — not blocking cycles

## Cycle 4 Complete — 2026-03-02

**Items completed:** 19, 21, 22, 24, 25, 26, 27, 28, 29, 37 (10 items)

**What was built:**
- **Item 24:** Next.js app setup — Clerk+Convex providers, ThemeProvider with CSS variable injection, middleware with role-based routing, (consultant) and (client) route groups
- **Item 19:** Coaching call analyzer seed template — full Growth Factor Implementation config with 4 rubric dimensions (100pts), 16 curriculum entries, 4 pipeline steps
- **Item 21:** Coaching pipeline Intake step — webhook path (reads pre-stored transcript) + manual path (VTT parsing, speaker label extraction, coachTalkPercent computation), <500 word short-circuit
- **Item 22:** Coaching pipeline Analyze step — Claude structured output via tool_use + Zod validation, score capping, overallScore computation, flagged threshold check
- **Item 25:** Consultant dashboard home — 4 stat cards + searchable/filterable client roster with pagination
- **Item 26:** Full-page /clients — reuses roster with server-side sort (businessName, lastRun, monthlyCost)
- **Items 27+28:** Client detail page — header + 4 tabs (Agents with deploy modal, Integrations, Recent Runs, Reports with inline Send to Coach)
- **Item 29:** Run detail page — real-time step timeline with expandable output, error display
- **Item 37:** Secondary pages — /agents template library, /app/runs client history, /app/agents client list with Run Now

**What was learned:**
- ESLint config needed browser globals for src/ files (document, setTimeout, URL, process) — only had Node globals for convex/
- ConvexClientProvider needs Clerk-optional fallback for builds without NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
- Convex ES target doesn't support Error cause option — use eslint-disable instead
- Anthropic SDK tool input_schema type needs `as any` cast (ToolUnion[] possibly undefined)
- `convex typecheck` runs separately from `tsc --noEmit` (different tsconfig)

**Files changed:**
- Builder A (Item 24): 8 files — layout.tsx, middleware.ts, ConvexClientProvider, ThemeProvider, route group layouts
- Builder B (Items 19,21,22): 3 files — coachingCallAnalyzerTemplate.ts, coachingPipeline.ts, coachingCallReports.ts
- Builder C (Items 25,26): 6 files — dashboard.ts, dashboard/page, clients/page, StatCard, ClientRosterTable, StatusBadge
- Builder E (Items 27,28): 8 files — clientDetail.ts, clients/[tenantId]/page, 5 tab components + DeployAgentModal
- Builder F (Item 29): 4 files — runDetail.ts, runs/[runId]/page, RunHeader, StepTimeline
- Builder H (Item 37): 5 files — agents/page, app/runs/page, app/agents/page, TemplateCard, ClientPickerModal
- QA fixes: 3 files — eslint.config.mjs, coachingPipeline.ts, ConvexClientProvider.tsx

**PRD status:** 29/40 items passing (was 19/40)

**Next priority items:** 20 (GitHub template sync), 23 (Format+Deliver pipeline steps), 30-31 (reports+settings), 32-36 (client portal), 39 (E2E integration), 40 (template propagation)

**Active Signs:**
- SIGN-1: Convex codegen — use (internal as any) pattern (still relevant)
- SIGN-7: Builders must not run git (still relevant)
- SIGN-13 (NEW): ESLint config — src/ files need browser globals, convex/ files need node globals
- SIGN-14 (NEW): Convex ES target doesn't support Error cause — eslint-disable preserve-caught-error
- SIGN-15 (NEW): ConvexClientProvider must handle missing Clerk publishable key for build to pass

**Decisions in effect:**
- 2-wave build structure for frontend: foundation first, then pages (dependency chain)
- Items with shared files combined into single builders (25+26, 27+28) to avoid serialization
- Playwright QA deferred until E2E infrastructure exists (Clerk config, seed data, auth bypass)
- Clerk-optional fallback allows build without env vars — runtime auth still requires Clerk setup

## Cycle 5 Complete — 2026-03-03

**Items completed:** 32, 33, 34, 35, 36

**What was built:**
- Item 32: Client home page (`/app`) — getClientHome query, shared client layout with sidebar nav, branded header with platformName/logo, agent status grid with Active/Setting Up/Paused badges, "Run Now" on deployed only, quick stats bar
- Item 33: Agent detail (`/app/agents/{id}`) — agent info section with integration slot status, config self-service (customizableFields only, hidden when empty), dynamic run trigger form from inputSchema (text/textarea/select/number/boolean), run history table with pagination
- Item 34: Run detail (`/app/agents/{id}/runs/{runId}`) — real-time via getRunDetail subscription, run header with start time + live duration + cost, step timeline via StepTimeline component, output section with URL extraction
- Item 35: Integrations (`/app/integrations`) — listIntegrationsForTenant query in credentials.ts, cards grouped by provider, Connect (initiateComposioOAuth) and Disconnect (disconnectCredential + confirm) flows, empty state
- Item 36: Reports (`/app/reports` + `/app/reports/{id}`) — reports table with score badges (green/yellow/red), New/Reviewed status, report detail with score circle, dimension scorecard, highlights, concerns, narrative, no transcript/rawAnalysisJson exposed

**What was learned:**
- HTMLTableRowElement and other DOM element types need to be in ESLint browser globals (added to eslint.config.mjs)
- Spec-required "start time" in run header was missed by builder — Playwright code review caught it
- All 5 client portal pages followed consistent patterns from consultant-side pages (inline styles, CSS variables, useQuery subscriptions)
- Zero file overlap between 5 parallel builders confirmed — sprint builder isolation pattern working well

**Files changed:**
- builder-32: convex/agentConfigs.ts, src/app/(client)/app/page.tsx, src/app/(client)/app/layout.tsx
- builder-33: src/app/(client)/app/agents/[agentConfigId]/page.tsx
- builder-34: src/app/(client)/app/agents/[agentConfigId]/runs/[runId]/page.tsx
- builder-35: convex/credentials.ts, src/app/(client)/app/integrations/page.tsx
- builder-36: src/app/(client)/app/reports/page.tsx, src/app/(client)/app/reports/[reportId]/page.tsx
- Lead fix: eslint.config.mjs (DOM type globals), run detail start time

**PRD status:** 34/40 items passing

**Next priority items:**
- Item 20 (GitHub template sync webhook) — specs/agent-config-system.md
- Item 23 (Format + Deliver pipeline steps) — specs/coaching-call-analyzer.md
- Items 30-31 (Consultant reports + settings pages) — specs/consultant-dashboard.md
- Item 40 (Template propagation) — specs/agent-config-system.md (depends on Item 20)
- Item 39 (E2E QA scenario) — specs/coaching-call-analyzer.md (QA-only, deferred)

**Active Signs:**
- SIGN-1: Convex codegen requires live deployment — use `(internal as any).module.fn`
- SIGN-7: Builders must NEVER run git commands — lead is sole operator (still in effect)
- SIGN-13: ESLint browser/node globals split — now includes DOM element types
- SIGN-14: Convex ES target rejects Error cause syntax
- SIGN-15: ConvexClientProvider Clerk fallback

**Decisions in effect:**
- 5 parallel builders on shared main with zero file overlap — proven pattern
- Scout maps file ownership, lead cross-references git status before commit
- Code review by Playwright QA sufficient when no Playwright config exists
- DOM type globals added proactively (HTMLElement, HTMLTableRowElement, HTMLInputElement, etc.)

## Cycle 6 Complete — 2026-03-03

**Items completed:** 20, 23, 30, 31

**What was built:**
- Item 20: GitHub template sync webhook — HTTP endpoint validates HMAC-SHA256 (Web Crypto), parses push payload, filters templates/**/*.json, schedules syncTemplateFromGit per slug. Action fetches 3 files from GitHub API, upserts agentTemplate by slug, increments version.
- Item 23: Pipeline Format + Deliver steps — Format reads analysis results, builds scorecard report, creates Google Doc via createGoogleDoc. Deliver updates coachingCallReport, sends flagged-call email via Resend (non-fatal on failure). Steps are standalone internalActions.
- Item 30: Consultant reports pages — listCoachingReportsForConsultant query with cross-tenant aggregation, all filters, flagged+draft-first sort. /reports list with 4 filters and 8-column table. /reports/{reportId} two-panel detail (60/40): scorecard with dimension progress bars, editable narrative (blur-save, 50-char min for Send), Send to Coach modal, transcript viewer. View-only mode for sent reports.
- Item 31: Consultant settings — 3-tab page (Profile/Theme/Notifications). Profile: displayName edit + updateConsultant mutation. Theme: 5 hex-validated color pickers, font dropdown, logo drag-drop upload (2MB max), live preview panel. Notifications: per-program threshold. Consultant nav bar added to layout.

**What was learned:**
- `atob` is browser-only — Convex actions must use `Buffer.from(str, 'base64').toString()` for base64 decode
- ESLint needs File/FileReader/FileList in browser globals for drag-drop upload code
- eslint-disable comments for unconfigured plugins (react-hooks, @next/next) cause "Definition for rule not found" errors — remove them if plugins aren't installed
- TypeScript strict mode requires explicit types on .map() callback params when query return type is opaque
- builder-31 needed updateConsultant mutation that didn't exist — lead added it to convex/consultants.ts

**Files changed:**
- builder-20: convex/webhooks/github.ts (new), convex/http.ts (route added)
- builder-23: convex/execution/formatStep.ts (new), convex/execution/deliverStep.ts (new)
- builder-30: convex/coachingCallReports.ts (query added), src/app/(consultant)/reports/page.tsx (new), src/app/(consultant)/reports/[reportId]/page.tsx (new)
- builder-31: src/app/(consultant)/settings/page.tsx (new), src/app/(consultant)/layout.tsx (nav bar)
- Lead fixes: convex/consultants.ts (updateConsultant mutation), eslint.config.mjs (File globals), QA error fixes

**PRD status:** 38/40 items passing

**Next priority items:**
- Item 40 (Template propagation: syncAgentConfigWithTemplate + "Update Available" UI) — specs/agent-config-system.md, depends on Item 20 (now done)
- Item 39 (E2E QA verification scenario) — specs/coaching-call-analyzer.md, QA-only item, depends on Items 23+30 (now done)

**Active Signs:**
- SIGN-1: Convex codegen — use `(internal as any).module.fn`
- SIGN-7: Builders NEVER run git — lead is sole operator
- SIGN-11: httpAction uses Web Crypto API only (atob also blocked — use Buffer.from)
- SIGN-13: ESLint browser/node globals split — now includes File/FileReader/FileList
- SIGN-14: Convex ES target rejects Error cause syntax
- SIGN-15: ConvexClientProvider Clerk fallback
- SIGN-16 (NEW): eslint-disable comments for unconfigured plugins cause errors — don't reference react-hooks or @next/next rules
- SIGN-17 (NEW): Convex action base64 decode must use Buffer.from, not atob

**Decisions in effect:**
- docUrl stored in rawAnalysisJson (no dedicated schema field) — acceptable for now
- Coach filter uses coachId string input, not name dropdown — matches spec
- updateConsultant mutation added by lead (not in original scope)
- Consultant nav bar added to layout by builder-31 (was in scout scope)

---

## Cycle 7 Complete — 2026-03-03

**Items completed:** Item 40 (Template Propagation)
**Items blocked:** Item 39 (E2E QA Verification — blocked by runtime auth + seed data + external services, not a code defect)

**What was built:**
- Item 40: `syncAgentConfigWithTemplate` mutation in convex/agentConfigs.ts — accepts agentConfigId, validates consultant ownership, compares versions (throws AlreadyCurrentError if current), merges locked fields from template + preserves customizable fields, writes agentConfigHistory audit trail with changeSummary
- Item 40 UI: "Update Available" badge + "Sync to Latest" button on agent config cards in AgentsTab.tsx, with loading/error states. templateVersion added to clientDetail.ts enriched response.
- Clerk auth configured: convex/auth.config.ts created, Clerk keys in .env.local, CLERK_JWT_ISSUER_DOMAIN set on Convex deployment (graceful-otter-634)

**What was learned:**
- Item 39 (E2E QA) requires runtime infrastructure that doesn't exist yet: Playwright test config, auth bypass for tests, seed data, live external services (Zoom, Anthropic, Google Docs, Resend)
- Clerk auth setup is straightforward: activate Convex integration in Clerk dashboard, add auth.config.ts, set env vars. No manual JWT template creation needed.
- New Convex deployment: graceful-otter-634 (replaced hallowed-snail-756)

**Files changed:**
- builder-40: convex/agentConfigs.ts (syncAgentConfigWithTemplate mutation), convex/clientDetail.ts (templateVersion), src/components/AgentsTab.tsx (badge + button)
- Lead: convex/auth.config.ts (new — Clerk auth config)

**PRD status:** 39/40 items passing
**Remaining:** Item 39 (E2E QA verification — blocked by test infrastructure, not code)

**Active Signs:** 1, 7, 11, 13, 14, 15, 16, 17

**Decisions in effect:**
- Convex deployment changed to graceful-otter-634
- Clerk auth configured with renewed-escargot-45.clerk.accounts.dev
- Item 39 deferred — requires Playwright test infra + seed data + runtime auth verification

---

## Cycle 8 Complete — 2026-03-03

**Items completed:** Item 39 (E2E QA Verification)

**What was built:**
- Playwright E2E test infrastructure: playwright.config.ts, global-setup.ts, helpers/auth.ts
- TEST_MODE auth bypass in convex/auth.ts (test user lookup) and src/middleware.ts (skip Clerk)
- Idempotent seed data in convex/seed.ts: consultant, tenant, agent template, 2 agent runs, 2 coaching reports (score 82 green + score 58 flagged red)
- 15 Playwright tests in tests/coaching-pipeline.spec.ts covering Reports List (8 tests) and Report Detail (7 tests)

**Convex refactoring (pre-existing "use node" constraint):**
- Queries/mutations cannot live in "use node" files — split 5 files into companion helpers:
  - convex/integrations/composioHelpers.ts (from composio.ts)
  - convex/integrations/googleDocsHelpers.ts (from googleDocs.ts)
  - convex/integrations/zoomHelpers.ts (from zoom.ts)
  - convex/webhooks/composioCallbackHelpers.ts (from composioCallback.ts)
  - convex/zoomCredentialsDb.ts (from zoomCredentials.ts)

**What was learned:**
- Convex "use node" files can ONLY export action/internalAction — queries, mutations, httpActions all fail. Must split into companion files.
- Seed-first E2E strategy avoids external API dependencies (Anthropic, Composio, Resend, Zoom) entirely
- Cold Convex subscriptions can take 30s+ on first load — use waitForFunction with generous timeouts + direct URL navigation instead of click-based
- eslint-disable block comments needed for browser globals (document) inside waitForFunction callbacks

**Files created:**
- playwright.config.ts, tests/global-setup.ts, tests/helpers/auth.ts, tests/coaching-pipeline.spec.ts
- convex/seed.ts
- convex/integrations/composioHelpers.ts, convex/integrations/googleDocsHelpers.ts, convex/integrations/zoomHelpers.ts
- convex/webhooks/composioCallbackHelpers.ts, convex/zoomCredentialsDb.ts

**Files modified:**
- convex/auth.ts, src/middleware.ts, package.json, package-lock.json
- convex/integrations/composio.ts, convex/integrations/googleDocs.ts, convex/integrations/zoom.ts
- convex/webhooks/composioCallback.ts, convex/webhooks/zoom.ts, convex/zoomCredentials.ts

**Verification:**
- `npx tsc --noEmit` — PASS
- `npx eslint . --max-warnings 0` — PASS
- `npx convex typecheck` — PASS
- `npm run build` — PASS
- `npx playwright test` — 15/15 PASS

**PRD status:** 40/40 items passing — SPRINT COMPLETE

**Active Signs:** All resolved. No remaining blockers.

**Decisions in effect:**
- TEST_MODE env var on Convex deployment (graceful-otter-634) — must be unset before production
- Playwright tests run with `NEXT_PUBLIC_TEST_MODE=true` via webServer env in playwright.config.ts
- test_consultant_001 is the well-known test user ID shared between seed.ts and auth.ts

---

## UI Sprint -- Planned

- Date: 2026-03-03
- Items: 65 (foundation: 9, functional: 12, ui: 27, integration: 2, test-backend: 5, test-e2e: 10)
- Specs: 8 files in specs/ (ui-design-system-foundation, ui-auth-and-routing, ui-client-chat-interface, ui-client-onboarding, ui-document-store, ui-consultant-redesign, ui-consultant-user-management, ui-shared-polish)
- Status: Ready for building
- Replaces previous backend sprint PRD.json entirely (IDs restart at 1)
- Reviewer fixes applied: 2 blockers fixed, 3 omissions added, 3 items split, 1 warning addressed (65 items, was 61)

---

## UI Sprint Cycle 1 — 2026-03-03

**Items completed:** 1 (shadcn/ui + Tailwind v4 foundation)

**What was built:**
- **Item 1:** shadcn/ui initialized with Tailwind v4 CSS-first config
  - `components.json` at project root with style=default, rsc=true, tsx=true, iconLibrary=lucide
  - `src/lib/utils.ts` with `cn()` utility (clsx + tailwind-merge)
  - `src/app/globals.css` with `@import "tailwindcss"`, @theme directive, 18 shadcn OKLCH variables, Plinth-specific tokens (colors, spacing, shadows), dark theme stub
  - `postcss.config.mjs` with @tailwindcss/postcss plugin
  - `src/app/layout.tsx` updated with Plus Jakarta Sans font variable, globals.css import, font-sans + antialiased + bg-background + text-foreground body classes
  - No tailwind.config.js/ts — pure CSS-first Tailwind v4

**Packages installed:**
- tailwindcss, @tailwindcss/postcss, postcss (Tailwind v4 core)
- class-variance-authority, clsx, tailwind-merge (shadcn utilities)
- lucide-react (icon library)

**Files created:**
- components.json, postcss.config.mjs, src/app/globals.css, src/lib/utils.ts

**Files modified:**
- src/app/layout.tsx, package.json, package-lock.json

**Verification:**
- `npx tsc --noEmit` — PASS
- `npm run build` — PASS
- `bash scripts/kessel-run/backpressure.sh` — ALL GREEN

**PRD status:** 1/65 items passing

**Next priority items:** Item 2 (CSS variable palette — already partially done in globals.css), Item 3 (font + shadcn components install), Items 4-7 (schema + packages)

---

## UI Sprint Cycle 2 — 2026-03-03

**Items completed:** 2 (CSS variable palette)

**What was built:**
- **Item 2:** Added `--radius: 0.5rem` to `:root` block in globals.css. All 18 shadcn variables, 5 Plinth-specific tokens, 7 spacing tokens, 4 shadow tokens, and dark theme stub were already in place from Cycle 1 — only --radius was missing from :root (was only in @theme).

**Files modified:**
- src/app/globals.css (added --radius to :root)

**Verification:**
- `npx tsc --noEmit` — PASS
- `npm run build` — PASS

**PRD status:** 2/65 items passing

**Next priority items:** Items 4-6 (schema tables), Item 7 (package installs), Items 8-9 (middleware + auth layout)

---

## UI Sprint Cycle 3 — 2026-03-03

**Items completed:** 3 (Font + 20 shadcn/ui components)

**What was built:**
- **Item 3:** Installed all 20 shadcn/ui components (button, card, input, select, badge, dialog, sheet, tabs, avatar, dropdown-menu, skeleton, sidebar, breadcrumb, form, table, textarea, checkbox, separator, tooltip, sonner) plus auto-dependencies (label, use-mobile hook)
  - Plus Jakarta Sans font already configured from prior cycles (next/font/google, CSS variable, display swap)
  - Added explicit `font-family: var(--font-plus-jakarta-sans), sans-serif` to body in @layer base
  - shadcn CLI added sidebar CSS variables (light + dark) and @theme inline block to globals.css
  - Created `.npmrc` with `legacy-peer-deps=true` to resolve @convex-dev/agent peer dependency conflict
  - Added missing DOM type globals to eslint.config.mjs (HTMLOListElement, HTMLUListElement, HTMLLIElement, HTMLSpanElement, HTMLParagraphElement, HTMLTableElement, HTMLTableSectionElement, HTMLTableCellElement, HTMLTableCaptionElement, KeyboardEvent)

**Files created:**
- .npmrc
- src/components/ui/ (21 files: button, card, input, select, badge, dialog, sheet, tabs, avatar, dropdown-menu, skeleton, sidebar, breadcrumb, form, table, textarea, checkbox, separator, tooltip, sonner, label)
- src/hooks/use-mobile.tsx

**Files modified:**
- src/app/globals.css (font-family on body, sidebar CSS variables, @custom-variant dark, @theme inline)
- eslint.config.mjs (DOM type globals)
- package.json, package-lock.json (shadcn dependencies)

**Verification:**
- `bash scripts/kessel-run/backpressure.sh` — ALL GREEN

**PRD status:** 3/65 items passing

**Next priority items:** Items 5-6 (schema tables), Item 7 (package installs), Items 8-9 (middleware + auth layout)

---

## UI Sprint Cycle 4 — 2026-03-03

**Items completed:** 4 (conversations + messages schema tables)

**What was built:**
- **Item 4:** Added `conversations` and `messages` tables to `convex/schema.ts`
  - conversations: tenantId, userId, agentConfigId (nullable), title, lastMessageAt, messageCount, platform, status (active/archived), createdAt
  - conversations indexes: by_userId_lastMessageAt, by_tenantId_userId
  - messages: conversationId, tenantId, role (user/assistant/system), content, streamingToken (nullable), isStreaming, agentConfigId (nullable), agentRunId (nullable), metadata (optional), createdAt
  - messages indexes: by_conversationId, by_conversationId_createdAt

**Files modified:**
- convex/schema.ts

**Verification:**
- `npx tsc --noEmit` — PASS
- `bash scripts/kessel-run/backpressure.sh` — ALL GREEN

**PRD status:** 4/65 items passing

**Next priority items:** Items 5-6 (documents + invitations schema), Item 7 (package installs), Items 8-9 (middleware + auth layout)

---

## UI Sprint Cycle 5 — 2026-03-03

**Items completed:** 5 (documents table schema)

**What was built:**
- **Item 5:** Added `documents` table to `convex/schema.ts` with all required fields: tenantId, userId, title, content (nullable), storageId (nullable), mimeType, source (user|agent), agentRunId (nullable), agentConfigId (nullable), googleDocUrl (nullable), wordCount (nullable), createdAt, updatedAt. Three indexes: by_tenantId_createdAt, by_tenantId_userId, by_agentRunId.

**Files modified:**
- convex/schema.ts

**Verification:**
- `bash scripts/kessel-run/backpressure.sh` — ALL GREEN

**PRD status:** 5/65 items passing

**Next priority items:** Item 7 (package installs), Items 8-9 (middleware + auth layout)

---

## UI Sprint Cycle 6 — 2026-03-03

**Items completed:** 6 (invitations table + clerkOrgId)

**What was built:**
- **Item 6:** Added `clerkOrgId: v.optional(v.string())` field to consultants table. Added `invitations` table with fields: tenantId, consultantId, email, displayName (v.union(v.string(), v.null())), clerkInvitationId, status (pending|accepted|revoked|expired), sentAt, acceptedAt (v.union(v.number(), v.null())), createdAt. Indexes: by_tenantId_status, by_clerkInvitationId.

**Files modified:**
- convex/schema.ts

**Verification:**
- `npx tsc --noEmit` — PASS
- `bash scripts/kessel-run/backpressure.sh` — ALL GREEN

**PRD status:** 6/65 items passing

---

## UI Sprint Cycle 7 — 2026-03-03

**Items completed:** 7 (Package installs + streaming component)

**What was built:**
- **Item 7:** Installed all required packages for chat interface, document store, and user management
  - Runtime: @convex-dev/persistent-text-streaming, @blocknote/core, @blocknote/mantine, @mantine/core, @mantine/hooks, mammoth, turndown, svix, @tanstack/react-table, react-markdown, remark-gfm
  - Dev: @types/turndown, vitest, convex-test (@types/mammoth doesn't exist — mammoth ships own types)
  - Already installed (no-op): react-hook-form, @hookform/resolvers, zod
  - Wired persistent-text-streaming component into convex/convex.config.ts
  - Updated package.json test script from "echo No tests configured" to "vitest run"

**Files modified:**
- package.json (test script + new dependencies)
- package-lock.json
- convex/convex.config.ts (persistent-text-streaming component added)

**Verification:**
- `npx tsc --noEmit` — PASS
- `bash scripts/kessel-run/backpressure.sh` — ALL GREEN

**PRD status:** 7/65 items passing

---

## UI Sprint Cycle 8 — 2026-03-03

**Items completed:** 8 (Clerk middleware with auth.protect + onboarding redirects)

**What was built:**
- **Item 8:** Updated `src/middleware.ts` with full Clerk middleware implementation
  - Added `/api/webhooks/(.*)` and `/oauth/(.*)` to public routes
  - Added `auth.protect()` call for all non-public routes — unauthenticated users redirected to /sign-in
  - Added onboarding redirect logic: client users without `onboardingComplete` on /app routes redirected to /app/onboarding; users with onboardingComplete on /app/onboarding redirected to /app
  - Consultant and platform_admin users exempt from onboarding logic
  - TEST_MODE bypass preserved via `NEXT_PUBLIC_TEST_MODE` env var

**Files modified:**
- src/middleware.ts

**Verification:**
- `npx tsc --noEmit` — PASS
- `npm run build` — PASS
- `bash scripts/kessel-run/backpressure.sh` — ALL GREEN

**PRD status:** 8/65 items passing
