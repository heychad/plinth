# White-Label Theming

## Overview
Per-consultant branding configuration (logo, colors, platform name) stored in Convex and loaded at request time in Next.js middleware. Clients see their consultant's brand, never "Plinth." Theme is injected as CSS custom properties for SSR consistency.

## Requirements

### Must Have
- One theme document per consultant stored in Convex
- Theme fields: platformName, logoUrl, faviconUrl, primaryColor, secondaryColor, accentColor, backgroundColor, textColor, fontFamily
- Theme loaded server-side in Next.js middleware and injected as CSS variables into the response
- Client-facing pages use CSS variables — no hardcoded colors
- Consultant can update their theme from the Settings > Theme page
- Logo stored in Convex file storage, not external URLs

### Should Have
- Default fallback theme (Plinth defaults) when no theme is configured for a consultant
- Theme preview in consultant settings before saving
- Color validation: hex values only (regex `^#[0-9A-Fa-f]{6}$`)
- Support for Google Fonts by fontFamily name (Inter, Poppins, Lato, Montserrat, Open Sans)

### Nice to Have
- Custom domain per consultant (Phase 2 only — field exists in schema but not enforced in Phase 1)
- Favicon upload separate from logo
- Support email displayed in client-facing footer

## Data Models

### Convex Document: themes
| Field | Type | Required | Description |
|---|---|---|---|
| _id | Id<"themes"> | yes | Convex auto-generated |
| consultantId | Id<"consultants"> | yes | Foreign key — one theme per consultant (enforce in mutation) |
| platformName | string | yes | Branded platform name, e.g., "Smart Scale" |
| logoUrl | string | no | Convex file storage URL for logo image |
| faviconUrl | string | no | Convex file storage URL for favicon |
| primaryColor | string | yes | Hex color, default "#6366f1" |
| secondaryColor | string | yes | Hex color, default "#4f46e5" |
| accentColor | string | yes | Hex color, default "#10b981" |
| backgroundColor | string | yes | Hex color, default "#ffffff" |
| textColor | string | yes | Hex color, default "#111827" |
| fontFamily | string | yes | Font name, default "Inter" |
| customDomain | string | no | Phase 2 only — custom domain for white-label deployment |
| supportEmail | string | no | Shown in client-facing footer |
| createdAt | number | yes | Unix timestamp |
| updatedAt | number | yes | Unix timestamp |

**Index:** `by_consultantId` on consultantId field for fast theme lookup during middleware execution.

## API Contracts

### Query: getThemeByConsultantId
- **Signature:** `query(ctx, { consultantId }) => Theme | null`
- **Auth:** Caller must be the consultant themselves, any of their tenants (for client portal rendering), or platform_admin
- **Returns:** Full theme document or null if none configured
- **Caching:** Result cached in Next.js middleware via edge cache with 60-second TTL

### Query: getThemeForCurrentUser
- **Signature:** `query(ctx) => Theme | null`
- **Auth:** Any authenticated user
- **Behavior:** Resolves theme by looking up caller's consultantId (directly if consultant; via tenant.consultantId if client)
- **Returns:** Theme document or null

### Mutation: upsertTheme
- **Signature:** `mutation(ctx, { platformName, primaryColor, secondaryColor, accentColor, backgroundColor, textColor, fontFamily, supportEmail? }) => Id<"themes">`
- **Auth:** Caller must be consultant role; updates their own theme only
- **Behavior:** Creates if no theme exists for this consultant; updates if one exists
- **Validation:** All color fields must match `^#[0-9A-Fa-f]{6}$` — throws ValidationError if not
- **Errors:** Throws if called by non-consultant role

### Action: uploadThemeLogo
- **Signature:** `action(ctx, { file: Blob, type: "logo" | "favicon" }) => { storageId: string, url: string }`
- **Auth:** Caller must be consultant role
- **Behavior:** Stores file in Convex file storage; returns storage ID and public URL; updates theme document logoUrl or faviconUrl
- **Validation:** Max file size 2 MB; accepted types: image/png, image/jpeg, image/svg+xml, image/x-icon (favicon only)
- **Errors:** Throws FileTooLargeError if > 2 MB; throws UnsupportedFileTypeError for invalid types

## Behavioral Constraints
- Only one theme per consultant — upsertTheme replaces existing rather than creating a duplicate
- Theme is read by both consultant and all their tenant users — the query must allow both roles
- CSS variable names are fixed: `--color-primary`, `--color-secondary`, `--color-accent`, `--color-background`, `--color-foreground`, `--font-family` — these map directly to Tailwind CSS variable config
- A theme change takes effect on the next page load (no real-time push required)
- fontFamily must be from the supported list: Inter, Poppins, Lato, Montserrat, Open Sans — any other value is rejected with a ValidationError

## CSS Variable Mapping
The ThemeProvider component injects these exact CSS property names:

```
platformName    → document title suffix + header display name
logoUrl         → <img src> in header/nav
primaryColor    → --color-primary
secondaryColor  → --color-secondary
accentColor     → --color-accent
backgroundColor → --color-background
textColor       → --color-foreground
fontFamily      → --font-family (also loads Google Font link if not Inter)
```

## Edge Cases
- **No theme configured:** Middleware falls back to Plinth default theme. Client portal renders normally with Plinth branding until consultant saves their theme.
- **Invalid logo URL:** If logoUrl in DB points to a deleted storage file, the img tag renders a broken image. Mitigation: always use Convex storage IDs, never external URLs. Storage IDs remain valid for the lifetime of the document.
- **Color contrast:** No automatic contrast checking. Consultant is responsible for choosing accessible color combinations. A preview in the settings page shows text on their chosen background so they can verify readability.
- **Custom domain (Phase 2):** The customDomain field exists but is not used in Phase 1. Middleware resolves consultant by cookie/subdomain, not custom domain, in Phase 1.
- **Concurrent theme updates:** Two browser tabs saving theme simultaneously — last write wins. Acceptable for this use case.

## Dependencies
- `platform-foundation.md` — consultants and tenants documents
- Convex file storage for logo/favicon uploads
- Next.js middleware for theme injection into SSR responses
