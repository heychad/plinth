# Progress

Sprint log -- append only, never overwrite.

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
