# Client Chat Page Overrides

> **PROJECT:** Plinth
> **Updated:** 2026-03-03
> **Page Type:** Chat Interface

> **IMPORTANT:** Rules in this file **override** the Master file (`design-system/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page-Specific Rules

### Layout Overrides

- **Max Width:** None — chat fills available viewport
- **Layout:** Three-panel: conversation sidebar (260px) | message area (flex) | artifact panel (optional, 380px)
- **Height:** Full viewport (`h-screen`) — no vertical scrolling on the page itself; messages scroll within the message area
- **Sections:** 1. ConversationSidebar (left), 2. MessageList + MessageInput (center), 3. ArtifactPanel (right, conditional)

### Spacing Overrides

- **Message gap:** 16px between message bubbles
- **Input area:** Fixed to bottom with 16px padding
- **Sidebar items:** 8px vertical gap between conversation items

### Typography Overrides

- **Message text:** `text-sm` (14px) for chat messages — denser than page body text
- **Timestamps:** `text-xs text-muted-foreground`
- **Agent names:** `text-xs font-medium text-primary`

### Color Overrides

- **User message bubble:** `bg-primary text-primary-foreground` (indigo)
- **Assistant message bubble:** `bg-card text-card-foreground` (white card)
- **Message area background:** `bg-muted/30` (subtle lavender tint, lighter than sidebar)
- **Sidebar background:** `bg-card` (white)
- **Active conversation:** `bg-muted` highlight

### Component Overrides

- **No page header** — chat interface is immersive, no h1 visible (title in sidebar/tab)
- **No breadcrumbs** — chat is the root client experience
- **Input area:** Uses textarea with auto-grow, not standard Input component
- **Streaming indicator:** Animated dots (`motion-safe:animate-pulse`), respects `prefers-reduced-motion`

---

## Page-Specific Components

- **MessageBubble:** Rounded card with role-based styling (user: indigo, assistant: white)
- **TypingIndicator:** Three animated dots in an assistant-style bubble
- **ConversationSidebar:** Scrollable list of past conversations with timestamps
- **MessageInput:** Auto-growing textarea with send button (min 44x44px touch target)
- **ArtifactPanel:** Right-side panel for agent-generated documents/outputs

---

## Recommendations

- Effects: Smooth scroll to latest message, fade-in for new messages (150ms), typing indicator pulse
- Mobile: Sidebar becomes Sheet drawer; artifact panel becomes bottom sheet
- Accessibility: `aria-live="polite"` on message list for screen reader announcements of new messages
