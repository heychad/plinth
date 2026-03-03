# UI Design System Foundation

## Overview
Establishes the global design infrastructure for the Plinth frontend redesign: shadcn/ui component library, Tailwind v4, Plus Jakarta Sans typography, and the warm professional CSS variable palette. This spec must be completed before all other UI specs.

## Requirements

### Must Have
- shadcn/ui installed and initialized with `components.json` configured for Tailwind v4 and Next.js App Router
- Tailwind v4 setup with CSS-first configuration (no `tailwind.config.js` — uses `@import "tailwindcss"` in CSS)
- Plus Jakarta Sans loaded via `next/font/google` and applied as the default font family in `layout.tsx`
- Global CSS file (`src/app/globals.css`) with `:root` CSS variables mapping the Plinth color palette to shadcn convention
- All initial shadcn components installed (see Component List below)
- `layout.tsx` updated to inject font variable and import `globals.css`
- Lucide React installed for all icons — no emojis used as UI icons anywhere in the codebase

### Should Have
- Dark mode variables defined in `[data-theme="dark"]` (stubbed out even if not used in v1)
- CSS custom properties for spacing tokens (`--space-xs` through `--space-3xl`) matching design system values

### Nice to Have
- Storybook or component playground for design system reference

## CSS Variable Map

The `:root` block in `globals.css` must define these variables. shadcn uses OKLCH internally for Tailwind v4; map Plinth hex values to their OKLCH equivalents:

| shadcn Variable | Plinth Hex | Role |
|---|---|---|
| `--primary` | `#6366F1` (indigo) | Primary actions, active states |
| `--primary-foreground` | `#FFFFFF` | Text on primary backgrounds |
| `--secondary` | `#818CF8` (indigo-400) | Secondary elements |
| `--secondary-foreground` | `#1E1B4B` | Text on secondary backgrounds |
| `--accent` | `#10B981` (emerald) | CTAs, success states |
| `--accent-foreground` | `#FFFFFF` | Text on accent backgrounds |
| `--background` | `#F5F3FF` (warm lavender) | Page background |
| `--foreground` | `#1E1B4B` (deep indigo-900) | Primary text |
| `--muted` | `#EDE9FE` (indigo-100) | Muted backgrounds |
| `--muted-foreground` | `#6B7280` | Secondary text |
| `--card` | `#FFFFFF` | Card backgrounds |
| `--card-foreground` | `#1E1B4B` | Card text |
| `--border` | `#E2E8F0` | Borders and dividers |
| `--input` | `#E2E8F0` | Input borders |
| `--ring` | `#6366F1` | Focus ring color |
| `--radius` | `0.5rem` (8px) | Default border radius |
| `--destructive` | `#EF4444` | Error states |
| `--destructive-foreground` | `#FFFFFF` | Text on destructive backgrounds |

Additional Plinth-specific variables (not shadcn convention):
```css
--color-primary: #6366F1;
--color-secondary: #818CF8;
--color-cta: #10B981;
--color-background: #F5F3FF;
--color-text: #1E1B4B;
--space-xs: 0.25rem;
--space-sm: 0.5rem;
--space-md: 1rem;
--space-lg: 1.5rem;
--space-xl: 2rem;
--space-2xl: 3rem;
--space-3xl: 4rem;
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow-md: 0 4px 6px rgba(0,0,0,0.1);
--shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
--shadow-xl: 0 20px 25px rgba(0,0,0,0.15);
```

## File Locations

| File | Purpose |
|---|---|
| `src/app/globals.css` | Global styles, CSS variables, font import |
| `src/app/layout.tsx` | Root layout — font injection, globals import |
| `src/components/ui/` | shadcn generated components (auto-populated by CLI) |
| `components.json` | shadcn configuration (project root) |

## shadcn `components.json` Config

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

## Component List (Initial Install)

Run `npx shadcn@latest add` for each of these:

```
button card input select badge dialog sheet tabs avatar
dropdown-menu skeleton sidebar breadcrumb form table textarea
checkbox separator tooltip sonner
```

These cover all UI needs across the sprint. Do not install unlisted components without updating this spec.

## `layout.tsx` Updates

```tsx
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plus-jakarta-sans",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plusJakartaSans.variable}>
      <body className="font-sans antialiased bg-background text-foreground">
        <ConvexClientProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
```

The `globals.css` must set `font-family: var(--font-plus-jakarta-sans), sans-serif` on `:root` or `body`.

## Behavioral Constraints
- The `--font-plus-jakarta-sans` CSS variable is set by next/font — it MUST be referenced via the className on `<html>`, not imported directly in CSS
- All shadcn components use `cn()` utility from `@/lib/utils` — this file is auto-generated by shadcn init and must not be deleted
- White-label theming (consultant brand colors) overlays these defaults via `ThemeProvider` injecting inline CSS variables on a wrapper element — this spec's variables are the Plinth defaults, not the final rendered values
- Tailwind v4 does not use `tailwind.config.js` — configuration lives in `globals.css` with `@theme` directive
- `cursor-pointer` must be present on all interactive elements — enforce via Tailwind utility class, not CSS override
- All transitions must be 150–300ms ease (use Tailwind `transition-all duration-200` as the default)

## Edge Cases
- If `npm install` fails due to peer dependency conflicts, use `--legacy-peer-deps` (documented in MEMORY.md)
- If shadcn CLI cannot detect Tailwind v4, ensure `globals.css` has `@import "tailwindcss"` before calling init
- Font variable may not apply if `<html>` className is missing — verify by inspecting computed styles in dev

## Dependencies
- None — this is the foundation spec. All other UI specs depend on this one.
