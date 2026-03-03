# UI Document Store

## Overview
Adds a document management section to the client portal where users can view, create, and edit documents. Agent outputs are automatically saved as documents. BlockNote provides a Notion-style editor. Existing Composio integration enables Google Docs import/export.

## Requirements

### Must Have
- New route `/app/documents` with a list of documents (title, date, source)
- Document detail page `/app/documents/[documentId]` with BlockNote editor (view + edit)
- Create new blank document from the documents list page
- Agent-generated outputs automatically saved as documents linked to their `agentRunId`
- "Documents" nav item added to the client sidebar
- All documents scoped to `tenantId` — no cross-tenant access

### Should Have
- Google Docs export: convert document content to markdown and call existing `createGoogleDoc` Composio action
- Google Docs import: upload a `.docx` file → convert via `mammoth.js` → save as document
- Document list supports sorting by: date created (default), date modified, alphabetical
- Inline document rename (click title to edit)

### Nice to Have
- Document search by title or content
- Document templates: blank, meeting notes, action plan
- Agent artifact panel in chat links directly to the document store entry

## Data Models

### `documents` Table (new — add to `convex/schema.ts`)

| Field | Type | Required | Description |
|---|---|---|---|
| `tenantId` | `Id<"tenants">` | yes | Tenant scoping |
| `userId` | `Id<"users">` | yes | Document author/owner |
| `title` | `string` | yes | Document title, editable |
| `content` | `string \| null` | no | Inline content for small docs (< 100KB) |
| `storageId` | `string \| null` | no | Convex file storage ID for large docs |
| `mimeType` | `string` | yes | `"text/markdown"` (default), `"text/plain"` |
| `source` | `"user" \| "agent"` | yes | Origin of the document |
| `agentRunId` | `Id<"agentRuns"> \| null` | no | Populated when source is `"agent"` |
| `agentConfigId` | `Id<"agentConfigs"> \| null` | no | Which agent produced this |
| `googleDocUrl` | `string \| null` | no | Populated after export to Google Docs |
| `wordCount` | `number \| null` | no | Denormalized for display |
| `createdAt` | `number` | yes | Unix timestamp |
| `updatedAt` | `number` | yes | Unix timestamp |

**Storage rule:** If `content` size exceeds 80KB (Convex document limit is 1MB but keep well under), store in Convex file storage and set `storageId`. Set `content` to null.

**Indexes:**
```ts
.index("by_tenantId_createdAt", ["tenantId", "createdAt"])
.index("by_tenantId_userId", ["tenantId", "userId"])
.index("by_agentRunId", ["agentRunId"])
```

## API Contracts

### Query: `listDocuments`
- **File:** `convex/documents.ts` (new)
- **Signature:** `query(ctx, { sortBy?: "createdAt" | "updatedAt" | "title" }) => Document[]`
- **Auth:** Client role — resolves `tenantId` from JWT
- **Returns:** Documents ordered by `sortBy` DESC (or ASC for title), limit 50

### Query: `getDocument`
- **File:** `convex/documents.ts`
- **Signature:** `query(ctx, { documentId: Id<"documents"> }) => Document | null`
- **Auth:** Validates `tenantId` from JWT matches document's `tenantId`
- **Returns:** Full document. If `storageId` is set, returns a signed download URL for the content.

### Mutation: `createDocument`
- **File:** `convex/documents.ts`
- **Signature:** `mutation(ctx, { title: string, content?: string, source?: "user" | "agent", agentRunId?: Id<"agentRuns"> }) => Id<"documents">`
- **Auth:** Client role

### Mutation: `updateDocument`
- **File:** `convex/documents.ts`
- **Signature:** `mutation(ctx, { documentId: Id<"documents">, title?: string, content?: string }) => void`
- **Auth:** Validates caller's `tenantId` matches document's `tenantId`
- **Behavior:** Updates `updatedAt` on every call

### Mutation: `saveAgentDocument`
- **File:** `convex/documents.ts` — called internally by agent execution
- **Signature:** `internalMutation(ctx, { tenantId, agentRunId, agentConfigId, title, content }) => Id<"documents">`
- **Note:** This is an `internalMutation` — not exposed to clients. Called from `agentWorkflow.ts` when an agent produces document output.

### Action: `exportToGoogleDocs`
- **File:** `convex/documents.ts`
- **Signature:** `action(ctx, { documentId: Id<"documents"> }) => { googleDocUrl: string }`
- **Auth:** Client role
- **Behavior:**
  1. Fetches document content
  2. Calls existing `createGoogleDoc` Composio action with content as markdown
  3. Updates document's `googleDocUrl` field
  4. Returns the URL

### Action: `importFromDocx`
- **File:** `convex/documents.ts`
- **Signature:** `action(ctx, { storageId: string, fileName: string }) => Id<"documents">`
- **Auth:** Client role
- **Behavior:**
  1. Downloads the `.docx` from Convex file storage (uploaded via `generateUploadUrl`)
  2. Converts to HTML via `mammoth.js`, then to markdown via `turndown`
  3. Creates a new document with the converted content
  4. Returns the new `documentId`

## File Locations

```
src/
  app/(client)/app/
    documents/
      page.tsx                      # Document list
      [documentId]/
        page.tsx                    # Document detail + BlockNote editor
  components/documents/
    DocumentList.tsx                # Table/card grid of documents
    DocumentEditor.tsx              # BlockNote wrapper
    DocumentToolbar.tsx             # Export, rename, delete actions
    EmptyDocuments.tsx              # Empty state
```

## Frontend Components

### `/app/documents` — Document List Page

**Layout:**
- Page heading: "Documents" with "New document" button (top right, `bg-accent`)
- Sort controls: "Sort by" shadcn `Select` (Date created / Date modified / Name)
- Document list: shadcn `Table` with columns:
  - Title (link to detail page)
  - Source: "You" or agent name (shadcn `Badge`)
  - Date: relative time ("2 days ago")
  - Actions: "Open" button, kebab menu (Rename, Export to Google Docs, Delete)
- Empty state: "No documents yet. Documents created by you or your agents will appear here." with a "Create document" button

**Creating a new document:**
1. Click "New document"
2. Calls `createDocument({ title: "Untitled document", source: "user" })`
3. Redirects to `/app/documents/{documentId}`

### `/app/documents/[documentId]` — Document Editor

**Layout:**
- Full-screen editor layout (no extra padding)
- Breadcrumb: "Documents / {title}" (shadcn `Breadcrumb`)
- Toolbar (top bar):
  - Editable title (click to edit, blur to save)
  - "Export to Google Docs" button (Lucide `FileUp` icon)
  - "Import .docx" button (Lucide `Upload` icon) — triggers file picker
  - Last saved indicator: "Saved 2 minutes ago" or "Saving..."
- BlockNote editor fills remaining height

**BlockNote configuration:**
```tsx
import { BlockNoteEditor } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";

const editor = useCreateBlockNote({
  initialContent: markdownToBlocks(document.content),
  uploadFile: async (file) => {
    // Upload to Convex file storage, return URL
    const uploadUrl = await generateUploadUrl();
    // ... upload logic
    return fileUrl;
  },
});
```

**Auto-save behavior:**
- Debounce content changes: 1000ms after last keystroke
- Call `updateDocument({ documentId, content: await editor.blocksToMarkdown() })`
- Show "Saving..." during debounce, "Saved" after mutation resolves

**Google Docs export flow:**
1. User clicks "Export to Google Docs"
2. Show loading state on button
3. Call `exportToGoogleDocs({ documentId })`
4. On success: show toast "Exported! Opening Google Doc..." + open URL in new tab
5. On error: show toast "Export failed. Make sure Google is connected in your Connections page."

**Import .docx flow:**
1. User clicks "Import .docx"
2. File picker opens (accept: `.docx`)
3. Upload file to Convex via `generateUploadUrl` pattern
4. Call `importFromDocx({ storageId, fileName })`
5. Redirect to new document detail page

## Agent Document Auto-Save

When an agent completes a run and produces a document-type output:
1. `agentWorkflow.ts` checks if `output` contains a field tagged `type: "document"`
2. Calls `internalMutation("documents:saveAgentDocument", { tenantId, agentRunId, content, title })`
3. The saved document appears in the client's document list with `source: "agent"`

The agent output schema extension (in `agentTemplates.inputSchema`) must include:
```json
{
  "outputType": "document",
  "documentTitle": "{{ generated_title }}"
}
```

## Sidebar Navigation Update

Add "Documents" nav item to the client sidebar in `src/app/(client)/app/layout.tsx`:
```ts
const NAV_ITEMS = [
  { href: "/app", label: "Home", icon: "MessageSquare", exact: true },
  { href: "/app/agents", label: "Agents", icon: "Bot" },
  { href: "/app/documents", label: "Documents", icon: "FileText" },  // NEW
  { href: "/app/connections", label: "Connections", icon: "Link" },
  { href: "/app/reports", label: "Reports", icon: "BarChart" },
];
```

## Behavioral Constraints
- Document content stored as markdown — BlockNote converts to/from its block format at edit time
- Documents with `storageId` set: content is fetched from Convex storage on load, not stored in the document record
- Google Docs export requires `google_docs` credential to be active for this tenant — check before calling; redirect to Connections page if not connected
- BlockNote editor is client-only (`"use client"`) — the page component can be server-side but the editor wrapper must be a client component
- `importFromDocx` only accepts `.docx` files — reject `.doc`, `.pdf`, `.txt` with a user-facing error
- Document title is required and cannot be empty — default to "Untitled document" if user clears the field and blurs
- `saveAgentDocument` is idempotent per `agentRunId` — if called twice for the same run, update rather than create

## Edge Cases
- **Large document (> 80KB):** Store in Convex file storage. On load, fetch signed URL and stream content into BlockNote.
- **Google Docs credential expired:** `exportToGoogleDocs` returns an error with code `CREDENTIAL_EXPIRED`. Show toast: "Google connection expired. Re-link in Connections." with a link.
- **BlockNote fails to parse stored markdown:** Fall back to showing raw markdown in a `<pre>` block with an error message above.
- **User navigates away with unsaved changes:** Block navigation and show a shadcn `Dialog` confirmation: "You have unsaved changes. Leave anyway?"
- **Agent document with very long content:** If content exceeds 80KB, the auto-save path uses `generateUploadUrl` to store in file storage before calling `saveAgentDocument`.
- **Concurrent edits (two tabs open):** Last write wins. Convex optimistic updates will reconcile. No real-time co-editing in v1.

## User Stories
- As a client, when I navigate to "Documents" in the sidebar, I see a list of all my documents sorted by date created.
- As a client, when I click "New document", a blank document opens in the editor.
- As a client, when I type in the BlockNote editor, my changes are auto-saved after 1 second with a "Saving..." indicator.
- As a client, when an agent completes a run that produces a document, that document appears in my Documents list with the source labeled as the agent name.
- As a client, when I click "Export to Google Docs" on a document, it is exported and opens in a new tab.
- As a client, when I click "Import .docx" and select a Word file, it is converted and opens as a new document.

## Dependencies
- Depends on: `ui-design-system-foundation.md`
- Depends on: `ui-auth-and-routing.md`
- Depends on: `ui-client-chat-interface.md` — artifact panel links to documents
- Backend: `convex/documents.ts` (new file)
- Backend: Existing `convex/integrations/googleDocs.ts` — `createGoogleDoc` action
- External packages: `@blocknote/core`, `@blocknote/mantine`, `mammoth` (docx conversion), `turndown` (HTML to markdown)
