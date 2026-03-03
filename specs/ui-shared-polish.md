# UI Shared Polish

## Overview
Cross-cutting UI concerns that apply to every page: error handling, loading states, 404/error pages, accessibility requirements, toast notifications, breadcrumb navigation, and responsive design rules.

## Requirements

### Must Have
- `src/app/not-found.tsx` — custom 404 page
- `src/app/error.tsx` — app-level error boundary
- `src/app/loading.tsx` — global loading spinner (optional, see note)
- shadcn Sonner toast installed and configured for success/error feedback
- `<Toaster />` mounted in root `layout.tsx`
- `src/app/(consultant)/loading.tsx` and `src/app/(client)/app/loading.tsx` — route-group loading fallbacks
- Skeleton loading states on every page (see spec per page in `ui-consultant-redesign.md` and `ui-client-chat-interface.md`)
- Skip-to-content link at the top of every layout (accessible keyboard navigation)
- WCAG AA minimum contrast on all text/background combinations
- All touch targets minimum 44x44px

### Should Have
- Breadcrumb navigation on all detail pages (client detail, report detail, run detail, document detail)
- `src/app/(consultant)/error.tsx` and `src/app/(client)/app/error.tsx` — route-group error boundaries
- Proper `aria-live` regions for toast notifications and dynamic content updates
- `prefers-reduced-motion` respected — all transitions disabled when the user prefers reduced motion
- Heading hierarchy enforced: one `<h1>` per page, `<h2>` for sections, never skip levels

### Nice to Have
- Animated page transitions (fade in, 150ms) when navigating between routes
- Focus trapping in modals (handled by shadcn `Dialog` automatically)
- Print stylesheet for report pages

## File Locations

```
src/
  app/
    not-found.tsx                   # Custom 404 page
    error.tsx                       # Root error boundary
    loading.tsx                     # Root loading (avoid — prefer route-group loading)
    (consultant)/
      error.tsx                     # Consultant error boundary
      loading.tsx                   # Consultant loading fallback
    (client)/
      app/
        error.tsx                   # Client error boundary
        loading.tsx                 # Client loading fallback
  components/
    SkipToContent.tsx               # Accessibility skip link
    PageBreadcrumb.tsx              # Reusable breadcrumb component
    LoadingPage.tsx                 # Full-page skeleton fallback
```

## Custom 404 Page

**File:** `src/app/not-found.tsx`

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center px-4">
      <p className="text-6xl font-bold text-primary mb-4">404</p>
      <h1 className="text-2xl font-semibold text-foreground mb-2">Page not found</h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        The page you are looking for does not exist or has been moved.
      </p>
      <Button asChild>
        <Link href="/">Go home</Link>
      </Button>
    </div>
  );
}
```

## Error Boundary

**File:** `src/app/error.tsx` (and route-group copies)

```tsx
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center px-4">
      <h1 className="text-2xl font-semibold text-foreground mb-2">Something went wrong</h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        An unexpected error occurred. Please try again.
      </p>
      <div className="flex gap-4">
        <Button variant="outline" onClick={() => window.location.href = "/"}>
          Go home
        </Button>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
```

**Note:** The `error.tsx` component must be a client component (`"use client"`) — Next.js requirement.

## Toast Notifications (Sonner)

### Installation
`shadcn add sonner` (installs the `sonner` package + adds `src/components/ui/sonner.tsx`)

### Root Layout Integration
```tsx
import { Toaster } from "@/components/ui/sonner";

// In RootLayout return:
<body>
  <ConvexClientProvider>
    <ThemeProvider>{children}</ThemeProvider>
  </ConvexClientProvider>
  <Toaster position="bottom-right" richColors />
</body>
```

### Usage Patterns

**Success toast:**
```ts
import { toast } from "sonner";
toast.success("Invitation sent to jane@example.com");
```

**Error toast:**
```ts
toast.error("Failed to save. Please try again.");
```

**Loading toast (for async operations):**
```ts
const id = toast.loading("Exporting to Google Docs...");
// on success:
toast.success("Exported successfully!", { id });
// on error:
toast.error("Export failed.", { id });
```

### When to Use Toasts

| Event | Toast Type | Message Pattern |
|---|---|---|
| Save successful | success | "{Entity} saved" |
| Delete successful | success | "{Entity} deleted" |
| Invitation sent | success | "Invitation sent to {email}" |
| Export complete | success | "Exported to Google Docs" |
| Form validation error | error | Inline error, NOT toast |
| Network/API error | error | "Something went wrong. Please try again." |
| Agent run triggered | success | "Agent started — tracking progress" |
| Report released | success | "Report released to coach" |

**Do NOT use toasts for:**
- Form field validation errors (use inline error messages)
- Destructive confirmations (use `Dialog`)
- Multi-step flows (use inline status)

## Skip-to-Content Link

Every layout must include a skip-to-content link as the first element in `<body>`:

```tsx
// src/components/SkipToContent.tsx
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium"
    >
      Skip to content
    </a>
  );
}
```

The main content area must have `id="main-content"` in all layouts:
```tsx
<main id="main-content" tabIndex={-1}>
  {children}
</main>
```

## Breadcrumb Navigation

Use the shadcn `Breadcrumb` component on all detail pages.

**Component:** `src/components/PageBreadcrumb.tsx`

```tsx
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type BreadcrumbItem = { label: string; href?: string };

export function PageBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => (
          <React.Fragment key={item.label}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {item.href ? (
                <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
```

**Breadcrumb usage per page:**

| Page | Breadcrumb |
|---|---|
| Client detail | Clients / {businessName} |
| Client agent config | Clients / {businessName} / {agentName} |
| Run detail (consultant) | Clients / {businessName} / Runs / Run {shortId} |
| Run detail (client) | Agents / {agentName} / Runs / Run {shortId} |
| Report detail | Reports / {coachName} — Call {#} |
| Document detail | Documents / {title} |

## Loading States

### Route Group Loading (`loading.tsx`)

Each route group has a `loading.tsx` that shows while the page's server component fetches data:

```tsx
// src/app/(consultant)/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function ConsultantLoading() {
  return (
    <div className="p-8 space-y-4">
      <Skeleton className="h-8 w-64" />  {/* Page title */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-lg" />  {/* Table */}
    </div>
  );
}
```

### Skeleton Patterns Per Page

| Page | Skeleton Structure |
|---|---|
| Dashboard | 4 stat card skeletons + 5-row table skeleton |
| Clients list | Filters skeleton + 8-row table skeleton |
| Client detail | Tab skeleton + content skeleton |
| Reports list | Filters skeleton + 8-row table skeleton |
| Report detail | Two-panel skeleton |
| Document list | 6-row table skeleton |
| Document editor | Heading skeleton + editor block skeleton |
| Chat interface | Message list skeleton (3 bubbles) + input skeleton |

## Responsive Design Requirements

All pages must work at these breakpoints: **375px** (mobile), **768px** (tablet), **1024px** (laptop), **1440px** (desktop).

### Breakpoint Behaviors

**Mobile (375px):**
- Sidebars: hidden, shown via hamburger menu (`Sheet` drawer)
- Tables: convert to stacked card layout or horizontal scroll with sticky first column
- Two-panel layouts: stack vertically
- Cards: single column
- Chat sidebar: bottom sheet or off-canvas drawer

**Tablet (768px):**
- Sidebars: icon-only collapsed state
- Tables: horizontal scroll with all columns
- Two-panel layouts: 1/3 + 2/3 split
- Cards: 2-column grid

**Desktop (1024px+):**
- Sidebars: full expanded state
- Tables: full columns
- Two-panel layouts: side by side
- Cards: 3–4 column grid

### Mobile No-Horizontal-Scroll Rule
No page must produce horizontal scroll on 375px viewport. Verify by:
1. Setting browser to 375px width
2. Checking for `overflow-x: auto` or `scrollWidth > clientWidth` on body

## Accessibility Requirements

### Color Contrast
- Normal text (< 18pt): minimum 4.5:1 contrast ratio
- Large text (≥ 18pt or 14pt bold): minimum 3:1 contrast ratio
- UI components (borders, focus rings): minimum 3:1
- Verify palette: `#1E1B4B` text on `#F5F3FF` background = ~8.5:1 (passes AAA)
- Verify: `#FFFFFF` on `#6366F1` = ~4.5:1 (passes AA)

### Keyboard Navigation
- All interactive elements reachable by Tab key in logical order
- No keyboard traps (modals use `Dialog` component which handles this)
- Visible focus indicator on all interactive elements (use `ring-2 ring-primary` focus classes)
- `Escape` closes all open dialogs, sheets, and dropdowns

### ARIA Attributes
- Navigation landmarks: `<nav aria-label="...">` for each navigation region
- Main content: `<main id="main-content">`
- Status updates (toast, streaming indicator): `role="status"` with `aria-live="polite"`
- Error messages: `role="alert"` with `aria-live="assertive"`
- Tables: `<caption>` describing table purpose, `scope` on `<th>` elements
- Buttons with only icons: `aria-label` describing the action
- Loading indicators: `aria-busy="true"` on the loading container

### Heading Hierarchy
- One `<h1>` per page (the page title)
- Section headings: `<h2>`
- Sub-sections within: `<h3>`
- Never skip levels (no `<h1>` → `<h3>` without `<h2>`)
- Sidebar nav items are NOT headings — use `<nav>` + `<ul>` + `<li>` + `<a>`

### `prefers-reduced-motion`
Add to `globals.css`:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Touch Target Sizes
- All buttons, links, and interactive elements: minimum 44x44px clickable area
- If visual size is smaller (e.g., an icon button), add padding to reach 44x44px
- Use `min-h-11 min-w-11` (44px = 2.75rem) Tailwind classes as the floor

## Behavioral Constraints
- The `<Toaster />` must be mounted exactly once in root `layout.tsx` — not in route-group layouts
- All `loading.tsx` files must use `export default` (not named export) — Next.js requirement
- Error boundaries (`error.tsx`) must be `"use client"` — Next.js requirement
- The skip-to-content link must be the first focusable element on every page
- Do not use `z-index` values above 50 without documenting the stacking context — shadcn components use defined z-index layers
- `aria-live` regions must be present in the DOM before they are populated — mount them empty, then update content
- Focus management after navigation: use `router.push()` and Next.js automatically focuses the new page's `<h1>` — do not override this behavior

## Edge Cases
- **JavaScript disabled:** The skip-to-content link must still work (it's a plain anchor)
- **Very long page titles in breadcrumbs:** Truncate to 40 chars with `...` — show full title in `title` attribute
- **Toast during form submission that fails immediately:** Show the error toast, not the success toast — handle promise rejection in the toast loading pattern
- **Multiple overlapping toasts:** Sonner stacks them automatically — no special handling needed
- **Keyboard user tabbing through a long table:** Provide a "Skip table" link before large tables (similar to skip-to-content)

## User Stories
- As a user who navigates to a non-existent URL, I see a friendly 404 page with a "Go home" button.
- As a user when an unexpected error occurs, I see an error page with a "Try again" button that retries the failed operation.
- As a keyboard user, pressing Tab from the address bar lands me on the "Skip to content" link, and pressing Enter takes me directly to the main content.
- As a user on mobile (375px), all pages are fully usable without horizontal scrolling.
- As a user with a screen reader, all buttons with only icon labels are announced with their action (e.g., "Delete document").
- As a user who prefers reduced motion, page transitions and animations are instant with no movement.
- As a user performing a save action, I see a brief success toast confirming the action completed.

## Dependencies
- Depends on: `ui-design-system-foundation.md` — for Sonner installation and global CSS
- Used by: all other UI specs — the patterns defined here apply everywhere
