# UI Consultant Redesign

## Overview
Rebuilds all consultant-facing pages using shadcn/ui components. Replaces the current top navigation bar with a collapsible sidebar. Introduces TanStack Table for data-heavy views, shadcn Tabs for tabbed content, and loading Skeletons throughout.

## Requirements

### Must Have
- Replace top nav with shadcn `Sidebar` component (collapsible, desktop persistent, mobile Sheet drawer)
- Dashboard: stat cards using shadcn `Card` + recent clients table
- Clients list: TanStack Table with sort, filter, shadcn `Select` for status filter
- Client detail: shadcn `Tabs` for Agent Configs / Run History / Reports / Settings sub-sections
- Agent templates library: `Card` grid with category badges
- Reports list: TanStack Table with 8 columns + status/score badges
- Report detail: two-panel layout (report info left, narrative right) with responsive stacking
- Settings page: shadcn `Tabs` (Profile / Theme / Billing) with `Form` + Zod validation
- Run detail: timeline view with shadcn `Card` per step
- All pages: Skeleton loading states, proper empty states

### Should Have
- Sidebar: icon-only collapsed state on desktop (hover to expand)
- Dashboard: "Welcome back, {name}" personalized header
- Clients list: search input that filters table client-side
- Reports list: score range filter (e.g., show only < 70)
- Settings theme tab: live preview of color changes before saving

### Nice to Have
- Dashboard: sparkline charts for run counts over last 30 days
- Clients list: bulk action (pause/activate multiple tenants)
- Report detail: PDF export button

## File Locations

```
src/
  app/(consultant)/
    layout.tsx                      # Sidebar layout (replaces top nav)
    dashboard/
      page.tsx                      # Dashboard home
      _components/
        StatCards.tsx               # KPI stat cards
        RecentClientsTable.tsx      # Quick client roster
    clients/
      page.tsx                      # Clients list
      _components/
        ClientsTable.tsx            # TanStack Table
        ClientFilters.tsx           # Status filter + search
      [tenantId]/
        page.tsx                    # Client detail
        _components/
          ClientDetailTabs.tsx      # Tab container
          AgentConfigsTab.tsx       # Agent configs sub-tab
          RunHistoryTab.tsx         # Run history sub-tab
          ReportsTab.tsx            # Reports sub-tab
    agents/
      page.tsx                      # Agent template library
      _components/
        TemplateCard.tsx            # Single template card
        TemplateGrid.tsx            # Grid of cards
    reports/
      page.tsx                      # Reports list
      _components/
        ReportsTable.tsx            # TanStack Table
      [reportId]/
        page.tsx                    # Report detail
        _components/
          ReportSummaryPanel.tsx    # Left panel: scores, metadata
          ReportNarrativePanel.tsx  # Right panel: narrative + actions
    settings/
      page.tsx                      # Settings (tabbed)
      _components/
        ProfileTab.tsx
        ThemeTab.tsx
        BillingTab.tsx
    clients/[tenantId]/runs/[runId]/
      page.tsx                      # Run detail (existing, restyled)
      _components/
        StepTimeline.tsx
  components/consultant/
    ConsultantSidebar.tsx           # Shared sidebar component
```

## Sidebar Layout

### `src/app/(consultant)/layout.tsx`

Replace the current horizontal nav with shadcn `Sidebar`:

```tsx
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { ConsultantSidebar } from "@/components/consultant/ConsultantSidebar";

export default function ConsultantLayout({ children }) {
  return (
    <SidebarProvider>
      <ConsultantSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
```

### `ConsultantSidebar` Contents

**Header:** Platform logo or "Plinth" wordmark + `<UserButton />` in footer

**Nav items (with Lucide icons):**
| Label | Icon | Route |
|---|---|---|
| Dashboard | `LayoutDashboard` | `/dashboard` |
| Clients | `Users` | `/clients` |
| Agents | `Bot` | `/agents` |
| Reports | `FileText` | `/reports` |
| Settings | `Settings` | `/settings` |

**Footer:** `<UserButton afterSignOutUrl="/sign-in" />` + consultant display name

**Behavior:**
- Desktop: `defaultOpen={true}`, collapsible via `<SidebarTrigger />` button
- Collapsed desktop: icon-only mode (16px width, no labels)
- Mobile (< 768px): hidden by default, shown as `Sheet` drawer on hamburger click
- Active state: current route highlighted with `bg-sidebar-accent`

## Dashboard Page

**Page heading:** "Good morning, {firstName}" (time-aware greeting)

**Stat cards row (4 cards):**

| Stat | Source | Icon |
|---|---|---|
| Total clients | `COUNT(tenants by consultantId)` | `Users` |
| Active agents | `COUNT(agentConfigs status=deployed)` | `Bot` |
| Runs this month | `SUM(usageLogs runCount this month)` | `Activity` |
| Cost this month | `SUM(usageLogs costUsd this month)` | `DollarSign` |

Each card: shadcn `Card` with label + large number + trend indicator (optional).

**Recent clients table:**
- Columns: Client name, Status badge, Agents count, Last run date
- Max 5 rows; "View all clients →" link to `/clients`

**Recent reports needing action:**
- List of reports in `draft` status, max 3
- Each: client name, score, "Review" button → report detail

## Clients List Page

**Filters row:**
- `Input` for search (client-side filter on table data, placeholder: "Search clients...")
- `Select` for status: "All", "Active", "Paused", "Churned"

**TanStack Table columns:**

| Column | Type | Sortable | Filterable |
|---|---|---|---|
| Business name | text link | yes | yes (search) |
| Owner | text | yes | no |
| Status | badge | no | yes (select) |
| Agents | count badge | yes | no |
| Last run | relative date | yes | no |
| Actions | button row | no | no |

Actions per row: "View" button (→ client detail), kebab menu: Pause, Edit, Archive.

**Pagination:** 25 rows per page, shadcn pagination controls.

**Empty state:** "No clients yet. Add your first client to get started." with "Add client" button (opens `Dialog` form).

## Client Detail Page

**Page heading:** `{businessName}` with status badge + breadcrumb "Clients / {businessName}"

**Tabs (shadcn `Tabs`):**

### Tab 1: Agent Configs
- Table: Name | Status | Template | Deployed | Version | Actions
- Actions: "Configure" (modal or `/clients/{id}/agents/{configId}`), "Pause", "Deploy"
- "Add agent config" button: select from template library, configure, save

### Tab 2: Run History
- Table: Agent | Status | Triggered | Duration | Cost | Actions
- "View" → run detail page
- Filter by agent (dropdown)

### Tab 3: Reports
- Table: Date | Coach | Score | Status | Actions
- Same as reports list but scoped to this client
- "Review" → report detail

### Tab 4: Client Settings
- Form fields: Business name, Owner name, Owner email, Website, Vertical (select), Notes
- Save button calls `updateTenant` mutation with Zod validation
- Read-only fields: Consultant ID, Tenant ID, Created date

## Agent Templates Page

**Page heading:** "Agent Library"

**Filter bar:** Category tabs (All / Marketing / Sales / Operations / Coaching)

**Card grid:** 3-column (desktop), 2-column (tablet), 1-column (mobile)

Each `TemplateCard`:
- Template name (`text-lg font-semibold`)
- Description (2 lines, truncated)
- Category badge (colored by category)
- "Active" badge if `isActive`
- Pipeline badge if `isPipeline`
- Actions: "Deploy to client" button (opens select-client dialog)

**"Deploy to client" flow:**
1. Click "Deploy to client" on a template card
2. `Dialog` opens with: client select (`Select`), agent display name input
3. Confirm → calls `createAgentConfig` mutation
4. Toast: "Agent deployed to {clientName}"

## Reports List Page

**Page heading:** "Reports" with count badge

**Filters:**
- Status `Select`: All / Draft / Reviewed / Sent / No Action
- Score range `Select`: All / High (≥ 80) / Medium (70–79) / Low (< 70)
- Flagged toggle: `Checkbox` "Show flagged only"

**TanStack Table columns:**

| Column | Type | Sortable |
|---|---|---|
| Date | date | yes |
| Client | text | yes |
| Coach | text | yes |
| Student | text | no |
| Call # | text | no |
| Score | score badge | yes |
| Status | status badge | yes |
| Actions | button row | no |

Score badges: `>= 80` → emerald, `70-79` → amber, `< 70` → red.
Status badges: `draft` → muted, `reviewed` → blue, `sent` → green, `no_action` → gray.

## Report Detail Page

**Breadcrumb:** "Reports / {coachName} — Call {callNumber}"

**Two-panel layout:**

```
┌─────────────────────┬──────────────────────────────┐
│  Left Panel (1/3)   │  Right Panel (2/3)           │
│  ─────────────────  │  ─────────────────────────   │
│  Overall Score      │  Narrative                   │
│  (large, colored)   │  [editable textarea]         │
│                     │                              │
│  Dimension Scores   │  Highlights                  │
│  [scorecards]       │  [bullet list]               │
│                     │                              │
│  Call metadata      │  Concerns                    │
│  Coach, Student     │  [bullet list]               │
│  Duration, Date     │                              │
│                     │  Actions: [Mark Reviewed]    │
│  Flagged badge      │  [Release to Coach] [Send]   │
└─────────────────────┴──────────────────────────────┘
```

**Mobile:** Panels stack vertically (left on top, right below).

**Actions:**
- "Mark Reviewed" → `updateReportStatus({ status: "reviewed" })`
- "Release to Coach" → `releaseReportToCoach({ reportId })` (sets `releasedToCoach: true`)
- "Mark No Action" → `updateReportStatus({ status: "no_action" })`

**Narrative editing:**
- Shadcn `Textarea` (pre-filled with `narrative` or `editedNarrative`)
- "Save edits" button → `updateReportNarrative({ reportId, editedNarrative: text })`
- Shows "(edited)" badge if `editedNarrative` is set

## Settings Page

**Tabs:** Profile / Theme / Billing

### Profile Tab
- Form: Display name, Business name, Email (read-only, from Clerk), Support email
- Zod schema: display name required, business name required, support email optional valid email
- "Save" → `updateConsultant` mutation

### Theme Tab
- Fields: Platform name, Primary color (hex input + color swatch preview), Secondary color, Accent color, Background color, Text color
- Logo upload: file input → Convex `generateUploadUrl` → upload → store URL
- Favicon upload: same pattern
- "Save theme" → `updateTheme` mutation
- Live preview panel: shows how the colors look on a mock sidebar + button
- All color fields validated as `#XXXXXX` hex format (CLAUDE.md constraint)

### Billing Tab
- Read-only: Current plan (starter / growth / scale), expiry date
- "Upgrade plan" link (external — no billing implementation in this sprint)

## Run Detail Page

**Breadcrumb:** "Clients / {clientName} / Runs / {runId short}"

**Run header card:**
- Agent name, status badge, trigger type badge
- Start time, duration, total cost

**Step timeline:**
- Vertical list of `Card` per step
- Pending: muted card with step name
- Running: card with animated `Loader2` spinner + elapsed time
- Completed: card with green `CheckCircle2` + duration
- Failed: card with red `XCircle` + error message

**Output section (status = "completed"):**
- Key-value display of `run.output` fields
- Google Doc URL rendered as clickable link with Lucide `ExternalLink` icon

## Responsive Behavior

| Page | Mobile (375px) | Tablet (768px) | Desktop (1024px+) |
|---|---|---|---|
| All pages | Sidebar hidden (hamburger) | Sidebar icon-only | Sidebar full |
| Clients list | Single column, cards | Table with scroll | Full table |
| Client detail | Tabs → vertical accordion | Tabs | Tabs |
| Reports list | Table → stacked cards | Scrollable table | Full table |
| Report detail | Single column stack | Two-panel | Two-panel |
| Dashboard | Card stack | 2-col grid | 4-col grid |

## Loading States (Skeletons)

Every page must show shadcn `Skeleton` components while data loads:

- Stat cards: 4 skeleton rectangles
- Tables: 5 skeleton rows with matching column widths
- Report detail: skeleton in both panels
- Client detail tabs: skeleton list items per tab

## Accessibility Requirements
- All tables must have `<caption>` and `<th scope="col/row">` elements
- Sort buttons: `aria-sort="ascending|descending|none"` attribute
- Status badges: `role="status"` + `aria-label` describing the status
- Sidebar nav: `role="navigation"` + `aria-label="Consultant navigation"`
- Active nav item: `aria-current="page"`
- Filter controls: proper `<label>` associations

## Behavioral Constraints
- The sidebar `<SidebarProvider>` must wrap the entire consultant layout — not just the sidebar component
- TanStack Table column definitions must include `accessorKey` or `accessorFn` — not custom render-only columns for sorting
- The Theme tab MUST validate hex colors as `#XXXXXX` before calling `updateTheme` — reject invalid formats with inline error
- Report narrative edits are tracked separately from the original narrative — never overwrite the original `narrative` field
- Consultant users can only see data for their own tenants — layout must call `requireAuth` via server components or Convex queries that enforce consultantId scoping

## Edge Cases
- **No clients yet:** Dashboard shows empty state card with "Add your first client" CTA
- **Client with no agents:** Client detail "Agent Configs" tab shows empty state with "Deploy your first agent" button
- **Report with no dimension scores:** Report detail shows "No dimension scores available" in place of scorecards
- **Sidebar collapsed on mobile:** The `SidebarTrigger` button must remain accessible (minimum 44x44px touch target) when sidebar is closed
- **Settings theme save with invalid hex:** Inline error appears under the field, "Save theme" button remains disabled until fixed
- **Long client business names:** Truncate with `text-ellipsis overflow-hidden` in table cells — show full name in tooltip on hover

## User Stories
- As a consultant, when I navigate to the dashboard, I see my 4 key stats and recent clients without horizontal scrolling on any screen size.
- As a consultant, when I click a column header in the Clients table, the table sorts by that column.
- As a consultant, when I type in the search field on the Clients page, the table filters in real-time without a page reload.
- As a consultant, when I open a client detail page, I see tabbed content and can switch between Agent Configs, Run History, Reports, and Settings.
- As a consultant, when I navigate to Settings > Theme and update my primary color, I see a live preview before saving.
- As a consultant, when I open a report detail, I can read the narrative, edit it, release it to the coach, and mark it as reviewed.
- As a consultant on mobile, I can open the navigation sidebar via a hamburger menu button.

## Dependencies
- Depends on: `ui-design-system-foundation.md`
- Depends on: `ui-auth-and-routing.md`
- External packages: `@tanstack/react-table`, `react-hook-form`, `zod`
- Backend: All existing Convex queries/mutations in `consultants.ts`, `tenants.ts`, `agentConfigs.ts`, `agentRuns.ts`, `coachingCallReports.ts`, `themes.ts`
