# Agent Config System

## Overview
Template-to-instance model for agent configurations. Chad maintains master agent templates in the platform; consultants deploy instances of those templates to their clients. Each instance can be customized within bounds the consultant controls. Config is data — behavior lives in the database, not in code.

## Requirements

### Must Have
- agentTemplates documents: Chad's master library with system prompt, integration slots, input schema, default locked/customizable fields, pipeline step definitions
- agentConfigs documents: per-tenant instances of templates, with tenant-specific config overrides and consultant-controlled locked/customizable field lists
- agentConfigHistory documents: immutable audit log of every config change with previous/new values
- Locked fields enforced at API layer: any mutation attempting to write a locked field throws a validation error
- Template propagation: when a template is updated (new version), consultants can choose to sync linked instances
- Config merge at runtime: template default_config merged with tenant config; tenant values win on collision

### Should Have
- One agentConfig per template per tenant (UNIQUE constraint enforced in mutation)
- Config change attribution: who changed it (user ID), from what role (admin, client, template_sync)
- Input schema defines the form fields shown to users when triggering a run
- status field on agentConfigs: building → testing → deployed → paused → archived
- Model override per config (defaults to platform default claude-sonnet-4-6)

### Nice to Have
- Schedule cron for configs that run on a timer (null = manual only)
- Config diff display in UI (show what changed vs. template defaults)
- Rollback: revert a config to any prior version from agentConfigHistory

## Data Models

### Convex Document: agentTemplates
| Field | Type | Required | Description |
|---|---|---|---|
| _id | Id<"agentTemplates"> | yes | Convex auto-generated |
| slug | string | yes | Unique identifier, e.g., "content-repurposing-machine" |
| displayName | string | yes | Human-readable name |
| description | string | yes | What this agent does (1-2 sentences) |
| category | "marketing" \| "sales" \| "operations" \| "coaching" | yes | For filtering/browsing |
| version | number | yes | Integer, incremented on breaking changes |
| isActive | boolean | yes | False = hidden from consultant assignment UI |
| isPipeline | boolean | yes | True = multi-step async execution |
| estimatedDurationSeconds | number | no | For UI progress indication |
| systemPrompt | string | yes | Template prompt using {{variable}} substitution syntax |
| integrationSlots | string[] | yes | Named slot references, e.g., ["google_drive", "slack"] |
| inputSchema | object | yes | JSON schema of user-provided run inputs (see InputField type) |
| defaultLockedFields | string[] | yes | Field names locked by default when deploying to a client |
| defaultCustomizableFields | string[] | yes | Field names clients may edit by default |
| defaultConfig | object | yes | Default config values for new deployments |
| pipelineSteps | PipelineStep[] | no | Step definitions for multi-step agents (null if isPipeline=false) |
| createdBy | Id<"users"> | yes | platform_admin who created the template |
| createdAt | number | yes | Unix timestamp |
| updatedAt | number | yes | Unix timestamp |

**Index:** `by_slug` on slug (unique lookup); `by_category_isActive` on (category, isActive) for filtered browsing.

### InputField type (embedded in inputSchema)
```
{
  type: "text" | "textarea" | "select" | "url" | "file",
  label: string,
  description?: string,
  required: boolean,
  options?: string[],    // for "select" type only
  placeholder?: string
}
```

### PipelineStep type (embedded in pipelineSteps array)
```
{
  slug: string,          // "intake" | "analyze" | "format" | "notify"
  displayName: string,   // "Intake" | "Analysis" | "Format Report" | "Send Notification"
  promptTemplate: string, // step-specific prompt using {{variable}} syntax
  order: number,         // execution order, 0-indexed
  model?: string         // optional per-step model override
}
```

### Convex Document: agentConfigs
| Field | Type | Required | Description |
|---|---|---|---|
| _id | Id<"agentConfigs"> | yes | Convex auto-generated |
| tenantId | Id<"tenants"> | yes | Foreign key — owning tenant |
| templateId | Id<"agentTemplates"> | yes | Foreign key — source template |
| displayName | string | yes | Can override template name per client |
| status | "building" \| "testing" \| "deployed" \| "paused" \| "archived" | yes | Default: "building" |
| config | object | yes | Tenant-specific config values, merged with template defaults at runtime |
| lockedFields | string[] | yes | Fields the client cannot change; set by consultant at deploy time |
| customizableFields | string[] | yes | Fields the client may change; set by consultant at deploy time |
| modelOverride | string | no | e.g., "claude-opus-4-6"; null = use platform default |
| scheduleCron | string | no | Cron expression for scheduled runs; null = manual only |
| scheduleTimezone | string | yes | Default: "UTC" |
| deployedAt | number | no | Timestamp when status set to "deployed" |
| deployedBy | Id<"users"> | no | User who set status to "deployed" |
| version | number | yes | Incremented on each config save |
| updatedByType | "admin" \| "client" \| "template_sync" | yes | Who/what made the last change |
| createdAt | number | yes | Unix timestamp |
| updatedAt | number | yes | Unix timestamp |

**Index:** `by_tenantId` on tenantId; `by_templateId` on templateId; `by_tenantId_templateId` (composite, unique — one config per template per tenant).

### Convex Document: agentConfigHistory
| Field | Type | Required | Description |
|---|---|---|---|
| _id | Id<"agentConfigHistory"> | yes | Convex auto-generated |
| agentConfigId | Id<"agentConfigs"> | yes | Which config was changed |
| tenantId | Id<"tenants"> | yes | Denormalized for efficient queries |
| changedByUserId | Id<"users"> | no | null for system/template_sync changes |
| changedByType | "admin" \| "client" \| "template_sync" | yes | Source of the change |
| previousConfig | object | yes | Full config object before change |
| newConfig | object | yes | Full config object after change |
| changeSummary | string | no | Human-readable diff summary |
| createdAt | number | yes | Unix timestamp |

**Index:** `by_agentConfigId` on agentConfigId for history lookups; ordered by createdAt descending.

## API Contracts

### Query: listAgentTemplates
- **Signature:** `query(ctx, { category?: string, cursor?, limit? }) => { templates: AgentTemplate[], nextCursor: string | null }`
- **Auth:** Any authenticated user (consultant or client can browse templates)
- **Behavior:** Returns only isActive === true templates; optional category filter

### Query: getAgentConfig
- **Signature:** `query(ctx, { agentConfigId }) => AgentConfig | null`
- **Auth:** Caller must be the tenant who owns this config, or the consultant who owns the tenant, or platform_admin
- **Returns:** Full config document

### Query: listAgentConfigsForTenant
- **Signature:** `query(ctx, { tenantId, status?, cursor?, limit? }) => { configs: AgentConfig[], nextCursor: string | null }`
- **Auth:** Tenant users see their own tenantId only; consultants see any of their tenants' configs
- **Behavior:** Optional status filter

### Mutation: deployAgentConfig
- **Signature:** `mutation(ctx, { tenantId, templateId, displayName?, lockedFields?, customizableFields?, initialConfig? }) => Id<"agentConfigs">`
- **Auth:** Caller must be a consultant who owns the tenant
- **Behavior:** Creates a new agentConfig with status "building"; initializes with template default_config merged with initialConfig; copies template's default locked/customizable fields unless overridden; enforces one-per-template-per-tenant constraint
- **Errors:** Throws if config already exists for this tenantId + templateId; throws if templateId is not active

### Mutation: updateAgentConfig
- **Signature:** `mutation(ctx, { agentConfigId, config?, displayName?, status?, lockedFields?, customizableFields?, modelOverride?, scheduleCron? }) => void`
- **Auth:** Consultant can update any field; client can only update fields in customizableFields; no caller may update locked fields
- **Validation:** For client callers: compute intersection of changed fields with lockedFields; throw LockedFieldError if any overlap
- **Behavior:** Writes a history record before updating; increments version; sets updatedByType based on caller role
- **Errors:** `{ code: "LOCKED_FIELD", fields: ["tone"], message: "Cannot update locked fields: tone" }`

### Query: getAgentConfigHistory
- **Signature:** `query(ctx, { agentConfigId, cursor?, limit? }) => { history: ConfigHistory[], nextCursor: string | null }`
- **Auth:** Consultant who owns the tenant, or platform_admin
- **Returns:** History records newest-first

## Behavioral Constraints
- The merged config at runtime is: `{ ...template.defaultConfig, ...agentConfig.config }` — tenant values override template defaults
- {{variable}} substitution in prompts reads from the merged config — if a variable is referenced in the prompt but not in merged config, the {{variable}} token remains as-is (not replaced with empty string)
- lockedFields and customizableFields are mutually exclusive sets — the union should equal the set of all configurable fields on that template
- Changing a template's version does NOT automatically update linked agentConfigs — consultant must explicitly sync
- agentConfigHistory entries are never deleted — they are the permanent audit trail
- status transitions are restricted: archived configs cannot be re-deployed without consultant intervention (must set back to "building" first)

## Edge Cases
- **Template deleted while configs exist:** Templates should never be hard-deleted if active configs reference them. Mark isActive = false instead. If a template is referenced by configs, block deletion and return an error listing the config IDs.
- **Large system prompts:** Convex 1 MiB document limit. A system prompt + pipelineSteps array approaching this limit should emit a warning at save time. Practical limit for templates: keep systemPrompt under 50KB.
- **Client writes to customizable field that was later locked by consultant:** The client-held agentConfig already has the value; it is not erased when the field is added to lockedFields. But the client can no longer update it. The existing value persists until a consultant changes it.
- **Concurrent config updates:** Two admins saving simultaneously — last write wins at the Convex mutation level. Both writes are logged to history. No optimistic locking in Phase 1.
- **Empty initialConfig:** Deploying with no initialConfig is valid — the template defaultConfig is the starting point.

## Git-Backed Template Version Control

Agent templates are authored as JSON files in a GitHub repository and synced to Convex. This separates template authoring (git workflow) from tenant customization (DB/UI workflow).

### Repository Structure
```
plinth-templates/
├── templates/
│   ├── coaching-call-analyzer/
│   │   ├── template.json          # agentTemplate fields (slug, displayName, systemPrompt, etc.)
│   │   ├── pipeline-steps.json    # pipelineSteps array
│   │   └── default-config.json    # defaultConfig with seed data (e.g., Growth Factor curriculum)
│   ├── content-repurposing-machine/
│   │   ├── template.json
│   │   └── default-config.json
│   └── ...
└── README.md
```

### Sync Flow
1. Developer pushes template changes to a branch
2. PR review — template changes are reviewed before merging (consultant-facing impact)
3. Merge to `main` triggers a GitHub webhook
4. Convex HTTP endpoint receives the webhook, validates GitHub signature
5. `syncTemplateFromGit` action fetches the changed template files from GitHub API
6. Upserts agentTemplate document in Convex (matched by slug); increments version
7. Returns sync result (created/updated/no-change)

### API Contracts

#### HTTP Endpoint: /webhooks/github-template-sync
- **Trigger:** GitHub push webhook on `main` branch
- **Validation:** HMAC-SHA256 signature via `x-hub-signature-256` header
- **Behavior:** Parses changed files from push payload; filters to `templates/**/*.json`; schedules `syncTemplateFromGit` action for each changed template directory
- **Response:** 200 OK immediately; sync runs asynchronously

#### Internal Action: syncTemplateFromGit
- **Signature:** `internalAction(ctx, { templateSlug, commitSha }) => { status: "created" | "updated" | "unchanged" }`
- **Behavior:** Fetches template.json, pipeline-steps.json, default-config.json from GitHub API for the given slug and commit SHA; upserts the agentTemplate document; increments version; logs the sync event
- **Errors:** If GitHub fetch fails, logs error and skips — does not corrupt existing template

### Behavioral Constraints
- GitHub is the source of truth for template definitions; the Convex agentTemplates table is a runtime cache
- Manual template edits via Convex mutations are allowed (for emergency fixes) but will be overwritten on next git sync — the sync log notes when a manual edit was overwritten
- Template version increments on every sync, even if content is identical (simplifies "did it sync?" checks)
- agentConfigs (tenant instances) are NOT affected by template syncs — consultants must explicitly pull template updates into their tenant configs
- The git repo is separate from the Plinth application repo — templates are a content repository, not code

### Edge Cases
- **First sync (template doesn't exist in Convex):** Creates a new agentTemplate document with version 1
- **Template file deleted from git:** Does NOT delete from Convex — sets isActive = false and logs a warning. Hard deletion requires manual intervention.
- **Malformed JSON in git:** Sync action validates JSON schema before upsert. On validation failure, skips the template and logs the error with the commit SHA for debugging.
- **Concurrent syncs (rapid pushes):** Each sync reads the commit SHA it was triggered for — not HEAD. Multiple syncs for the same template process sequentially (Convex mutation serialization).

## Dependencies
- `platform-foundation.md` — tenants, users, consultants documents
- `agent-execution-engine.md` — reads agentConfigs and agentTemplates at runtime
- GitHub API for fetching template files (requires `GITHUB_TOKEN` environment variable in Convex)
- GitHub webhook secret for signature validation (`GITHUB_WEBHOOK_SECRET` environment variable)
