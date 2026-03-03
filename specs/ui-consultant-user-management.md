# UI Consultant User Management

## Overview
Enables consultants to invite client users (coaches, business owners) onto the platform via Clerk organization invitations. Provides a UI for managing pending invitations and linking newly-signed-in users to Convex tenants.

## Requirements

### Must Have
- "Invite User" form accessible from the client detail page (tab or modal)
- Form collects: email address, display name (optional), role (pre-set to "client", not configurable in v1)
- Submitting the form calls Clerk `organization.inviteMember()` via a server action
- Pending invitations list on the client detail page showing email, status, sent date
- "Resend invitation" action on pending invitations
- "Revoke invitation" action on pending invitations
- Convex `users` record created (or linked) when an invited user signs in for the first time
- Clerk user's `publicMetadata.role = "client"` and `publicMetadata.tenantId = {tenantId}` set on first sign-in

### Should Have
- Toast confirmation: "Invitation sent to {email}"
- Invitation badge count on the client detail page tab: "Users (3)"
- Bulk invite: paste multiple emails (one per line)

### Nice to Have
- Invitation expiry display: "Expires in 7 days"
- Email preview: show what the invitation email will look like

## Clerk Organization Model

Each consultant account corresponds to a Clerk **organization**. Client users are **members** of the consultant's organization with the role `"org:client"`.

### Organization Setup
- A Clerk organization is created for each consultant at consultant account creation time
- Organization ID is stored on the `consultants` record: `clerkOrgId: string`
- This requires adding `clerkOrgId` to the `consultants` schema (new field)

**Schema addition to `convex/schema.ts` (`consultants` table):**
```ts
clerkOrgId: v.optional(v.string()), // Added in this sprint
```

### Clerk Roles
| Clerk Role | Plinth Role |
|---|---|
| `org:admin` | `consultant` |
| `org:client` | `client` |

## Data Models

### `invitations` Table (new — add to `convex/schema.ts`)

| Field | Type | Required | Description |
|---|---|---|---|
| `tenantId` | `Id<"tenants">` | yes | Which tenant the invite is for |
| `consultantId` | `Id<"consultants">` | yes | Issuing consultant |
| `email` | `string` | yes | Invitee email |
| `displayName` | `string \| null` | no | Optional display name pre-set |
| `clerkInvitationId` | `string` | yes | Clerk's invitation ID for resend/revoke |
| `status` | `"pending" \| "accepted" \| "revoked" \| "expired"` | yes | Invitation state |
| `sentAt` | `number` | yes | Unix timestamp |
| `acceptedAt` | `number \| null` | no | When user accepted |
| `createdAt` | `number` | yes | Unix timestamp |

**Indexes:**
```ts
.index("by_tenantId_status", ["tenantId", "status"])
.index("by_clerkInvitationId", ["clerkInvitationId"])
```

## API Contracts

### Server Action: `inviteUser`
- **File:** `src/app/(consultant)/clients/[tenantId]/_actions.ts`
- **Signature:** `async (formData: { email: string, displayName?: string, tenantId: string }) => { success: boolean, error?: string }`
- **Auth:** Clerk session required (consultant role)
- **Behavior:**
  1. Validates email format
  2. Retrieves consultant's `clerkOrgId` from Convex
  3. Calls `clerkClient().organizations.createOrganizationInvitation({ organizationId: clerkOrgId, emailAddress: email, role: "org:client", redirectUrl: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL })`
  4. Saves invitation record to Convex via `createInvitation` mutation
  5. Returns `{ success: true }` or `{ success: false, error: message }`

### Server Action: `resendInvitation`
- **File:** `src/app/(consultant)/clients/[tenantId]/_actions.ts`
- **Signature:** `async ({ clerkInvitationId }: { clerkInvitationId: string }) => void`
- **Behavior:** Calls Clerk API to resend the invitation email. Clerk does not expose a direct "resend" API — revoke and re-invite with same params.

### Server Action: `revokeInvitation`
- **File:** `src/app/(consultant)/clients/[tenantId]/_actions.ts`
- **Signature:** `async ({ invitationId }: { invitationId: string }) => void`
- **Behavior:** Calls `clerkClient().organizations.revokeOrganizationInvitation({ organizationId, invitationId: clerkInvitationId })`. Updates Convex invitation status to `"revoked"`.

### Mutation: `createInvitation`
- **File:** `convex/invitations.ts` (new)
- **Signature:** `internalMutation(ctx, { tenantId, consultantId, email, displayName?, clerkInvitationId }) => Id<"invitations">`
- **Auth:** Called only from server actions (internal)

### Mutation: `updateInvitationStatus`
- **File:** `convex/invitations.ts`
- **Signature:** `internalMutation(ctx, { clerkInvitationId, status, acceptedAt? }) => void`

### Query: `listInvitations`
- **File:** `convex/invitations.ts`
- **Signature:** `query(ctx, { tenantId: Id<"tenants"> }) => Invitation[]`
- **Auth:** Consultant role; validates `consultantId` matches tenant's `consultantId`
- **Returns:** All invitations for the tenant, ordered by `sentAt` DESC

### Webhook: Clerk `organizationMembership.created`
- **File:** `convex/webhooks/clerk.ts` (new) — HTTP endpoint `POST /webhooks/clerk`
- **Trigger:** Fires when an invited user accepts and signs up
- **Behavior:**
  1. Verifies Clerk webhook signature (`svix-id`, `svix-timestamp`, `svix-signature` headers)
  2. Extracts `clerkUserId`, `organizationId`, `role`
  3. Resolves `consultantId` from `clerkOrgId`
  4. Resolves `tenantId` from invitation record (match by email)
  5. Creates Convex `users` record: `{ clerkUserId, tenantId, consultantId, role: "client", displayName, email, createdAt }`
  6. Sets Clerk user's `publicMetadata`: `{ role: "client", tenantId: tenantId.toString() }`
  7. Updates invitation status to `"accepted"`

**HTTP route registration in `convex/http.ts`:**
```ts
http.route({
  path: "/webhooks/clerk",
  method: "POST",
  handler: httpAction(async (ctx, req) => { ... }),
});
```

## File Locations

```
src/
  app/(consultant)/clients/[tenantId]/
    _actions.ts                     # Server actions: inviteUser, revokeInvitation, resendInvitation
    _components/
      UsersTab.tsx                  # "Users" tab on client detail page
      InviteUserForm.tsx            # Invite form (email + display name)
      InvitationsTable.tsx          # Pending invitations list
      ActiveUsersTable.tsx          # Accepted users list
convex/
  invitations.ts                   # Query/mutations for invitations table
  webhooks/
    clerk.ts                       # Clerk webhook handler (new)
```

## UI Components

### `UsersTab` (new tab on Client Detail Page)

Add "Users" as the 5th tab on the client detail page (after Agent Configs, Run History, Reports, Settings).

Tab content:

**Active Users section:**
- Table: Name | Email | Role | Joined | Actions
- Actions per row: "Remove user" (revoking access — not in v1, show disabled)

**Pending Invitations section:**
- Table: Email | Sent | Status | Actions
- Status: `Badge`: "Pending" (yellow), "Expired" (gray), "Revoked" (red)
- Actions: "Resend" button, "Revoke" button (with confirm dialog)

**"Invite user" button:**
- Opens shadcn `Dialog` containing `InviteUserForm`
- Positioned at top right of the tab

### `InviteUserForm`

```
┌────────────────────────────────────┐
│  Invite a user                     │
│                                    │
│  Email address *                   │
│  [____________________________]    │
│                                    │
│  Display name (optional)           │
│  [____________________________]    │
│                                    │
│  Role                              │
│  [Client ▾]  (disabled, v1 only)   │
│                                    │
│  [Cancel]  [Send invitation]       │
└────────────────────────────────────┘
```

- Email validated with Zod: `z.string().email()`
- Display name optional: `z.string().min(1).max(60).optional()`
- "Send invitation" button: submits `inviteUser` server action
- Loading state: button shows `Loader2` spinner while submitting
- On success: dialog closes + toast "Invitation sent to {email}"
- On error: inline error message below form (not toast)

### `InvitationsTable`

shadcn `Table` with:
- Email column: `text-sm`
- Sent column: relative date (`"3 days ago"`)
- Status column: `Badge` variant per status
- Actions column: `Button variant="ghost"` for Resend + Revoke

Revoke confirmation `Dialog`:
```
"Are you sure you want to revoke the invitation for {email}?
This cannot be undone."
[Cancel] [Revoke]
```

## Behavioral Constraints
- The invitation email address must match the email used during Clerk sign-up — Clerk enforces this
- `role` is always `"org:client"` in v1 — do not expose role selection to the consultant
- A Clerk organization must exist for the consultant before any invitations can be sent — `clerkOrgId` must be set on the `consultants` record
- The Clerk webhook must verify the `svix` signature before processing — unauthenticated webhook calls must return `400`
- Creating a Convex user record on first sign-in is idempotent — check for existing `clerkUserId` before inserting
- Consultant users cannot invite other consultants — the `org:admin` role is not assignable via this UI
- Convex `publicMetadata.tenantId` must be set as a string (Convex ID string), not as an `Id<"tenants">` object

## Edge Cases
- **Email already has an active invitation:** Clerk returns an error. Show: "An invitation has already been sent to this email."
- **Email already has a Convex user account:** Check before calling Clerk. Show: "This user already has an account."
- **Consultant has no `clerkOrgId`:** Show an error state in the Users tab: "Organization not configured. Contact support."
- **Webhook fires but invitation record not found (e.g., user signed up without being invited):** Create the Convex user record with `tenantId: null` — a consultant can manually assign them later
- **Invitation expires (Clerk default: 7 days):** Clerk fires `organizationInvitation.expired` webhook. Update Convex status to `"expired"`.
- **Resend invitation:** Revoke old Clerk invitation, create a new one, update `clerkInvitationId` in Convex record, reset `sentAt`

## User Stories
- As a consultant, when I open a client detail page and click the "Users" tab, I see a list of active users and pending invitations.
- As a consultant, when I click "Invite user", a dialog opens where I enter an email and optional display name.
- As a consultant, when I submit the invite form, I see a toast confirming the invitation was sent, and the email appears in the "Pending Invitations" table.
- As a consultant, when I click "Revoke" on a pending invitation and confirm, the invitation is removed from the list.
- As an invited client, when I follow the invitation link in my email, sign up, and log in, I am taken to the onboarding wizard and can immediately start using the platform.
- As an invited client, my user account is automatically linked to the correct tenant and I only see my data.

## Dependencies
- Depends on: `ui-design-system-foundation.md`
- Depends on: `ui-auth-and-routing.md` — Clerk organization setup
- Depends on: `ui-consultant-redesign.md` — Users tab is added to client detail tabs
- Depends on: `ui-client-onboarding.md` — invited users go through onboarding flow
- Backend: `convex/invitations.ts` (new), `convex/webhooks/clerk.ts` (new)
- External: Clerk Organizations API, `svix` package for webhook verification
