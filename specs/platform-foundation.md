# Platform Foundation

## Overview
Convex schema, Clerk auth integration, and multi-tenancy model for the three-tier hierarchy: platform admin (Chad) → consultant (Maeve) → tenant (end client). Every authenticated request resolves to a role and an owner ID; every data-access function enforces isolation using those claims.

## Requirements

### Must Have
- Convex schema defining all core documents: consultants, tenants, users, agent templates, agent configs, credentials, agent runs, agent run steps, usage logs
- Clerk integration with tenant metadata stored in JWT custom claims (consultant_id, tenant_id, user_role)
- Auth helper functions that extract and validate identity from every query/mutation context
- Role-based access: `platform_admin` sees everything, `consultant` sees their tenants, `client` sees only their own tenant
- Multi-tenancy enforced in every Convex query/mutation via explicit tenant_id checks — no DB-level RLS
- Convex indexes on all foreign key fields to support efficient queries without full table scans

### Should Have
- Pagination support on all list queries (Convex 32K doc scan limit)
- Consultant record is created by platform admin; clients are created by consultants
- A user belongs to either a tenant or a consultant, never both (except the Maeve edge case where she is both consultant and her own first client)
- `platform_admin` role reserved for Chad; no self-serve signup for consultants in Phase 1

### Nice to Have
- Soft delete pattern for tenants (status: "churned" rather than hard delete)
- Audit timestamps (createdAt, updatedAt) on all documents

## Data Models

### Convex Document: consultants
| Field | Type | Required | Description |
|---|---|---|---|
| _id | Id<"consultants"> | yes | Convex auto-generated |
| clerkUserId | string | yes | Clerk user ID of the consultant's login |
| displayName | string | yes | Full name, e.g., "Maeve Ferguson" |
| businessName | string | yes | Brand name, e.g., "Maeve Ferguson Consulting" |
| email | string | yes | Unique contact email |
| plan | "starter" \| "growth" \| "scale" | yes | Billing plan tier |
| planExpiresAt | number | no | Unix timestamp; null = never expires |
| createdAt | number | yes | Unix timestamp |
| updatedAt | number | yes | Unix timestamp |

### Convex Document: tenants
| Field | Type | Required | Description |
|---|---|---|---|
| _id | Id<"tenants"> | yes | Convex auto-generated |
| consultantId | Id<"consultants"> | yes | Foreign key — owning consultant |
| businessName | string | yes | e.g., "Bloom Day Spa" |
| ownerName | string | yes | e.g., "Sarah Chen" |
| ownerEmail | string | yes | Contact email for the tenant owner |
| logoUrl | string | no | Convex file storage URL |
| websiteUrl | string | no | Optional |
| vertical | "spa" \| "course" \| "speaker" \| "consultant" \| "other" | no | Business category |
| status | "active" \| "paused" \| "churned" | yes | Default: "active" |
| notes | string | no | Internal consultant-only notes |
| createdAt | number | yes | Unix timestamp |
| updatedAt | number | yes | Unix timestamp |

### Convex Document: users
| Field | Type | Required | Description |
|---|---|---|---|
| _id | Id<"users"> | yes | Convex auto-generated |
| clerkUserId | string | yes | Clerk user ID — unique |
| tenantId | Id<"tenants"> | no | Set if role is "client" |
| consultantId | Id<"consultants"> | no | Set if role is "consultant" |
| role | "client" \| "consultant" \| "platform_admin" | yes | Controls access scope |
| displayName | string | yes | Display name |
| email | string | yes | Unique |
| avatarUrl | string | no | Profile image |
| lastSignInAt | number | no | Unix timestamp |
| createdAt | number | yes | Unix timestamp |

**Constraint:** A user with role "client" must have tenantId set and consultantId null. A user with role "consultant" must have consultantId set and tenantId null. Enforced in the createUser mutation.

### Convex Document: usageLogs
| Field | Type | Required | Description |
|---|---|---|---|
| _id | Id<"usageLogs"> | yes | Convex auto-generated |
| tenantId | Id<"tenants"> | yes | Which tenant incurred the usage |
| consultantId | Id<"consultants"> | yes | Which consultant owns the tenant |
| agentConfigId | Id<"agentConfigs"> | no | Which agent config (null for platform-level logs) |
| agentRunId | Id<"agentRuns"> | no | Which run generated the usage |
| loggedDate | string | yes | ISO date string "YYYY-MM-DD" |
| tokensIn | number | yes | Input tokens consumed |
| tokensOut | number | yes | Output tokens produced |
| costUsd | number | yes | Computed cost in USD |
| runCount | number | yes | Number of runs contributing to this log entry |
| createdAt | number | yes | Unix timestamp |

## API Contracts

### Query: getCurrentUser
- **Signature:** `query(ctx) => User | null`
- **Auth:** Must be authenticated via Clerk; resolves clerkUserId from ctx.auth.getUserIdentity()
- **Returns:** Full user document including role, tenantId or consultantId
- **Errors:** Returns null if no user record found for authenticated Clerk user

### Query: getConsultant
- **Signature:** `query(ctx, { consultantId }) => Consultant | null`
- **Auth:** Caller must be the consultant themselves or platform_admin
- **Errors:** Returns null if not found; throws AuthorizationError if caller lacks permission

### Query: listTenants
- **Signature:** `query(ctx, { consultantId, cursor?, limit? }) => { tenants: Tenant[], nextCursor: string | null }`
- **Auth:** Caller must be the consultant who owns these tenants, or platform_admin
- **Pagination:** Default limit 50; uses Convex cursor-based pagination
- **Errors:** Throws AuthorizationError if consultant_id in token does not match request

### Mutation: createTenant
- **Signature:** `mutation(ctx, { businessName, ownerName, ownerEmail, vertical?, notes? }) => Id<"tenants">`
- **Auth:** Caller must be a consultant (role === "consultant")
- **Behavior:** Creates tenant scoped to calling consultant's consultantId from JWT claims
- **Errors:** Throws if caller is not a consultant; throws if ownerEmail already exists for this consultant

### Mutation: createUser
- **Signature:** `mutation(ctx, { clerkUserId, email, displayName, role, tenantId?, consultantId? }) => Id<"users">`
- **Auth:** Platform_admin only
- **Behavior:** Creates user and validates the role/owner constraint (client must have tenantId, consultant must have consultantId)
- **Errors:** Throws if constraint violated; throws if clerkUserId already exists

### Internal Helper: requireAuth
- **Signature:** `internalQuery(ctx) => { clerkUserId, role, tenantId?, consultantId? }`
- **Behavior:** Reads JWT claims from ctx.auth.getUserIdentity(); throws AuthenticationError if not authenticated; throws AuthorizationError if no user record found
- **Usage:** Called at the top of every query/mutation before data access

### Internal Helper: requireRole
- **Signature:** `internalQuery(ctx, { requiredRole }) => void`
- **Behavior:** Throws AuthorizationError if caller's role does not match requiredRole
- **Errors:** `{ code: "UNAUTHORIZED", message: "Requires role: {requiredRole}" }`

## Behavioral Constraints
- Every query/mutation touching tenant-scoped data must call requireAuth() before any db.query()
- A consultant may only read/write tenants where tenants.consultantId === caller's consultantId from JWT
- A client may only read their own tenant's data (tenantId from JWT)
- platform_admin may read/write everything — no scope restrictions
- usageLogs are written by internal server functions only; no client mutation for usage
- Convex documents have a 1 MiB size limit — agent configs storing large prompts must stay under this limit; pipeline step definitions are stored as arrays of objects, not raw text blocks

## Edge Cases
- **Maeve edge case:** Maeve has both a consultant record and a tenant record (she is her own first client). Her user record has role "consultant" and consultantId set. Her tenant is a normal tenant with consultantId pointing to her own consultant record. A separate user record with role "client" and her tenantId gives her access to her own client portal.
- **JWT claims latency:** Clerk JWT claims may lag behind DB state for up to 60 seconds after a user record update. Functions must not rely solely on stale JWT claims for sensitive permission checks — cross-reference with live DB lookup for role-sensitive mutations.
- **Deleted consultant:** When a consultant is deleted, all their tenants, agent configs, runs, and usage logs must be cascade-deleted. Convex does not have cascade deletes — the deleteConsultant mutation must delete in dependency order.
- **Concurrent tenant creation:** Two simultaneous createTenant calls from the same consultant with the same ownerEmail — handled by querying for existing email before insert; race window is acceptable at this scale.

## Dependencies
- Clerk for authentication (JWT issuance, user management)
- See `white-label-theming.md` for the themes document schema
- See `agent-config-system.md` for agentTemplates and agentConfigs document schemas
