# Project State

## Current Position
- **Current Phase:** `07-movie-map-ui-ux-and-palette` (Mikey Guinness Movie Map UI, UX & Luminous Dark Palette Transformation)
- **Status:** Phase 7 Completed & Verified (`07-01-PLAN.md` [x], `07-02-PLAN.md` [x])
- **Last Action:** Successfully implemented the complete Mikey Guinness Movie Map UI, UX, and luminous dark color palette transformation across the entire application: obsidian void canvas (`#0A0E17`), luminous cluster glowing nodes, floating glassmorphic nav bar with theme toggle (`Movie Map Dark` vs `Archival Folio`), dark glass filter drawer with territory controls, and sleek movie inspector panel with similar films cards. Production build passed cleanly with zero errors.

## Key Decisions
- **User-Level Profile, Dual Auth & Watched/Interested Persistence (`src/lib/user-profile.ts`, `src/app/api/user-profile/route.ts`, `src/lib/firestore-cache.ts`)**:
  1. Each `UserProfile` stores `id`, `handle`, `displayName`, optional `email` and `bio`, `avatarColor`, `authMode` (`'HANDLE_ONLY' | 'PIN_PROTECTED' | 'FIREBASE_EMAIL' | 'FIREBASE_GOOGLE'`), `hasPinOrPassword`, `watchedIds`, `watchedCustomItems`, `interestedIds`, `interestedCustomItems`, `preferredRegion`, `defaultPreset`, and `defaultGraphScope`.
  2. Supports both **lightweight `@handle` + optional PIN/password** (salted `crypto.scryptSync` server verification) and **real Email & Password / Google OAuth authentication** (Firebase Identity Toolkit REST API + salted server verification).
  3. Profiles persist locally in `localStorage`, on the server in `.next/cache/sixdegrees-users.json`, and in Cloud Firestore (`sixdegrees_catalog/user_<handle>`).
- **Personal Watched & Interested Graph Engine (`src/lib/similarity.ts`)**:
  - `buildSpatialGraph` supports `graphScope: 'FULL_ARCHIVE' | 'WATCHED_ONLY' | 'INTERESTED_ONLY' | 'WATCHED_AND_INTERESTED' | 'WATCHED_PLUS_SUGGESTIONS'`.
  - Users can explore a full 3D/2D constellation of only their **Watched** titles, only their **Interested / Want to Watch** titles, or both combined (`WATCHED_AND_INTERESTED`) with shared Director, Writer, Cast, Composer, and Theme bridges.
- **Strict Subgraph Isolation & Global Reset (`src/components/SpatialViewport.tsx`, `src/components/SixDegreesApp.tsx`)**:
  - Selecting any node isolates its connected neighborhood in 3D/2D; `handleResetEverything` restores the full archive view.
