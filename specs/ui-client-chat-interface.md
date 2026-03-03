# UI Client Chat Interface

## Overview
Replaces the current `/app` home page with a full-screen, chat-first interface. Clients interact with an orchestrator agent that routes their intent to specialized sub-agents. This is the primary client experience — the most important UX in the product.

## Requirements

### Must Have
- `/app` is a full-screen chat interface (not the current agent grid)
- Orchestrator agent routes user messages to the correct sub-agent based on intent
- Messages stream in real-time using `@convex-dev/persistent-text-streaming`
- Chat UI includes: message bubbles (user/agent), typing indicator, text input with send button
- Sidebar shows: available agents (click to start focused chat) and conversation history
- All messages are persisted in Convex `conversations` and `messages` tables
- Messages scoped by `tenantId` and `userId` — no cross-tenant data leakage
- Agent responses render markdown (bold, italic, lists, code blocks)
- Empty state: welcome message with suggested prompts when no conversation is active

### Should Have
- Artifact panel: agent outputs (documents, reports) rendered in a right-side panel without leaving chat
- Code block syntax highlighting in agent responses
- Message timestamps on hover
- Conversation history paginated (most recent 20 conversations in sidebar)
- "New conversation" button to start a fresh context

### Nice to Have
- Agent typing indicator (animated dots) while response is streaming
- Copy button on agent messages
- Suggested follow-up prompts after agent response
- Keyboard shortcut: `Cmd+Enter` or `Enter` to send, `Shift+Enter` for new line

## Data Models

### `conversations` Table (new — add to `convex/schema.ts`)

| Field | Type | Required | Description |
|---|---|---|---|
| `tenantId` | `Id<"tenants">` | yes | Tenant scoping |
| `userId` | `Id<"users">` | yes | User who owns this conversation |
| `agentConfigId` | `Id<"agentConfigs"> \| null` | no | If null: orchestrator. If set: focused chat with specific agent |
| `title` | `string` | yes | Auto-generated from first user message (truncated to 60 chars) |
| `lastMessageAt` | `number` | yes | Unix timestamp for sidebar ordering |
| `messageCount` | `number` | yes | Denormalized count |
| `platform` | `string` | yes | `"web"` — for multi-surface readiness |
| `status` | `"active" \| "archived"` | yes | `"active"` default |
| `createdAt` | `number` | yes | Unix timestamp |

**Indexes:**
```ts
.index("by_userId_lastMessageAt", ["userId", "lastMessageAt"])
.index("by_tenantId_userId", ["tenantId", "userId"])
```

### `messages` Table (new — add to `convex/schema.ts`)

| Field | Type | Required | Description |
|---|---|---|---|
| `conversationId` | `Id<"conversations">` | yes | Parent conversation |
| `tenantId` | `Id<"tenants">` | yes | Tenant scoping |
| `role` | `"user" \| "assistant" \| "system"` | yes | Message role |
| `content` | `string` | yes | Raw text content |
| `streamingToken` | `string \| null` | no | Token for `persistent-text-streaming` while streaming |
| `isStreaming` | `boolean` | yes | True while response is being written |
| `agentConfigId` | `Id<"agentConfigs"> \| null` | no | Which agent produced this response |
| `agentRunId` | `Id<"agentRuns"> \| null` | no | Associated run if triggered |
| `metadata` | `object` | no | Platform-specific metadata: `{ platform: "web", clientVersion: string }` |
| `createdAt` | `number` | yes | Unix timestamp |

**Indexes:**
```ts
.index("by_conversationId", ["conversationId"])
.index("by_conversationId_createdAt", ["conversationId", "createdAt"])
```

## API Contracts

### Query: `listConversations`
- **File:** `convex/conversations.ts`
- **Signature:** `query(ctx) => Conversation[]`
- **Auth:** Client role only — resolves `userId` from JWT
- **Returns:** Conversations ordered by `lastMessageAt` DESC, limit 20
- **Pagination:** Cursor-based

### Query: `getConversation`
- **File:** `convex/conversations.ts`
- **Signature:** `query(ctx, { conversationId: Id<"conversations"> }) => Conversation | null`
- **Auth:** Validates `userId` matches conversation owner

### Query: `listMessages`
- **File:** `convex/messages.ts`
- **Signature:** `query(ctx, { conversationId: Id<"conversations"> }) => Message[]`
- **Auth:** Validates caller owns the conversation
- **Returns:** Messages ordered by `createdAt` ASC

### Mutation: `createConversation`
- **File:** `convex/conversations.ts`
- **Signature:** `mutation(ctx, { agentConfigId?: Id<"agentConfigs"> }) => Id<"conversations">`
- **Auth:** Client role — sets `userId` and `tenantId` from JWT

### Mutation: `createUserMessage`
- **File:** `convex/messages.ts`
- **Signature:** `mutation(ctx, { conversationId: Id<"conversations">, content: string }) => Id<"messages">`
- **Auth:** Validates caller owns the conversation

### HTTP Action: `POST /api/chat/stream`
- **File:** `convex/http.ts` (route) + `convex/execution/chatStream.ts` (handler)
- **Auth:** Clerk JWT in `Authorization: Bearer <token>` header
- **Request:**
  ```json
  {
    "conversationId": "string (Convex ID)",
    "userMessageId": "string (Convex ID)",
    "content": "string"
  }
  ```
- **Response:** Server-Sent Events (SSE) stream with `text/event-stream` content type
- **Behavior:**
  1. Validates JWT, resolves tenant/user
  2. Creates assistant message with `isStreaming: true` and a streaming token
  3. Calls `@convex-dev/persistent-text-streaming` to write chunks to DB
  4. Routes to orchestrator or specific agent based on `agentConfigId`
  5. On completion: sets `isStreaming: false`, clears `streamingToken`

### Action: `orchestratorRoute` (internal)
- **File:** `convex/execution/orchestrator.ts`
- **Signature:** `internalAction(ctx, { conversationId, userMessage, tenantId, userId })`
- **Behavior:**
  - Sends conversation history + user message to Claude (claude-sonnet-4-6)
  - System prompt describes available sub-agents as tools
  - Routes to the appropriate agent or responds directly
  - Sub-agents are invoked as tool calls in the Agent SDK

## Streaming Implementation

Use `@convex-dev/persistent-text-streaming`:

```ts
// In the HTTP action handler:
import { createTextStreamer } from "@convex-dev/persistent-text-streaming";

const streamer = createTextStreamer(ctx, {
  messageId: assistantMessageId,
  field: "content",
  table: "messages",
  isStreamingField: "isStreaming",
});

for await (const chunk of agentResponseStream) {
  await streamer.write(chunk);
  // Sends SSE chunk to client AND batches DB write
}

await streamer.done();
```

Frontend subscribes via `useStreamingText` hook from the library, or via `useQuery` on the message document (Convex auto-pushes updates).

## Frontend Components

### File Structure
```
src/
  app/(client)/app/
    page.tsx                    # Chat home — renders ChatInterface
    [conversationId]/
      page.tsx                  # Specific conversation
  components/chat/
    ChatInterface.tsx           # Root chat layout (sidebar + main)
    ConversationSidebar.tsx     # Left sidebar: agent list + history
    MessageList.tsx             # Scrollable message feed
    MessageBubble.tsx           # Individual message (user or agent)
    MessageInput.tsx            # Text input + send button
    TypingIndicator.tsx         # Animated dots during streaming
    AgentAvatar.tsx             # Agent icon in message bubble
    ArtifactPanel.tsx           # Right panel for docs/reports
    EmptyState.tsx              # Welcome screen with prompts
```

### `ChatInterface` Layout

```
┌────────────────────────────────────────────────────┐
│  Sidebar (260px)        │  Chat Main (flex-1)       │
│  ─────────────────────  │  ─────────────────────    │
│  [+ New Chat]           │  MessageList              │
│                         │    UserBubble             │
│  AGENTS                 │    AgentBubble (streams)  │
│  • All Agents (chat)    │    TypingIndicator        │
│  • Agent A              │                           │
│  • Agent B              │  MessageInput             │
│                         │    [textarea] [Send]      │
│  RECENT                 │                           │
│  • Conv title 1         │  [ArtifactPanel?]         │
│  • Conv title 2         │                           │
└────────────────────────────────────────────────────┘
```

Mobile (< 768px): Sidebar becomes a bottom sheet or is hidden behind a hamburger toggle.

### `MessageBubble` Variants

**User message:**
- Right-aligned
- `bg-primary text-primary-foreground` (indigo)
- Rounded: `rounded-2xl rounded-br-sm`
- Max width: 75% of container

**Agent message:**
- Left-aligned
- `bg-card border` (white card with border)
- Agent avatar (16x16px) to the left
- Markdown rendered via `react-markdown` with `remark-gfm`
- Code blocks: `bg-muted` with monospace font
- Max width: 85% of container

### `MessageInput` Behavior
- `<textarea>` (not `<input>`) for multi-line support
- Auto-grows with content up to 120px, then scrolls
- `Enter` submits (no Shift modifier), `Shift+Enter` adds newline
- Disabled while agent is streaming (`isStreaming: true`)
- Send button: primary color, Lucide `SendHorizonal` icon
- Min touch target: 44x44px

### `ConversationSidebar` Behavior
- "New Chat" button at top → calls `createConversation(null)` → navigates to `/app/{conversationId}`
- Agent list: each item navigates to `createConversation(agentConfigId)` → `/app/{conversationId}`
- Recent conversations: list of conversation titles, click to navigate to `/app/{conversationId}`
- Active conversation highlighted with `bg-muted`
- Sidebar collapsible on desktop (icon-only mode)
- On mobile: full-width drawer (shadcn `Sheet` component)

## Orchestrator Agent System Prompt

The orchestrator is a Claude agent that sees all deployed agents for this tenant as tool definitions. Intent routing logic:
- User mentions an agent by name → route to that agent
- User asks a general question → respond directly (no routing)
- User's intent is ambiguous → ask a clarifying question before routing
- Each sub-agent response is returned as a tool result and forwarded to the user

The orchestrator system prompt is NOT hardcoded — it is generated dynamically from the tenant's deployed `agentConfigs` at runtime.

## Behavioral Constraints
- A conversation's `tenantId` is set at creation and NEVER changes — no cross-tenant message reads
- `isStreaming: true` messages must display a typing indicator — do not show incomplete text as final
- If streaming fails (connection drop), set `isStreaming: false` and show an error message in place of the partial response
- The `MessageInput` must be disabled while any message in the conversation has `isStreaming: true`
- Conversation titles are auto-generated from the first user message, truncated to 60 chars — do not prompt the user to name conversations
- The orchestrator must not hallucinate agent capabilities — it must only describe agents from the actual `agentConfigs` for this tenant
- Messages are append-only — no editing or deleting messages

## Edge Cases
- **Empty conversation history:** Show `EmptyState` with 3–4 suggested prompts tailored to deployed agents
- **Agent streaming fails mid-response:** Replace partial message with `"I encountered an error. Please try again."` — do not show half-written content
- **No agents deployed yet:** Orchestrator says "Your consultant hasn't set up any agents yet. Check back soon." — no empty tool list passed to Claude
- **User sends empty message:** Send button disabled when textarea is empty (trimmed). No API call made.
- **Conversation not found (bad URL):** Redirect to `/app` with a toast "Conversation not found"
- **Rapid message sending:** Queue messages if agent is still responding. Do not allow concurrent submissions.

## User Stories
- As a client, when I navigate to `/app`, I see a chat interface with a welcome message and suggested prompts.
- As a client, when I type a message and press Enter, my message appears in the bubble and the agent begins responding with an animated typing indicator.
- As a client, while the agent is typing, I see the response stream in word-by-word.
- As a client, when I click an agent in the sidebar, a new conversation starts focused on that agent.
- As a client, I can see my past conversations in the sidebar and click to resume any of them.
- As a client, when the agent response includes markdown formatting, I see it rendered (bold, lists, code blocks) — not as raw markdown syntax.

## Dependencies
- Depends on: `ui-design-system-foundation.md`
- Depends on: `ui-auth-and-routing.md` — for client route protection
- Backend: `convex/conversations.ts`, `convex/messages.ts`, `convex/execution/chatStream.ts` (new files)
- Backend: `@convex-dev/persistent-text-streaming` package must be installed
- Backend: Existing `agentConfigs` and `agentTemplates` tables for orchestrator routing
