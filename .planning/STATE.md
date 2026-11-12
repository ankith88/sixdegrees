# Project State

## Current Position
- **Current Phase:** `09-dynamic-api-database-and-mobile-performance` (Dynamic API Database Ingestion, Pre-bundled Catalog & Mobile 2D Performance Engine)
- **Status:** Phase 9 Completed & Verified (`09-01-PLAN.md` [x], `09-02-PLAN.md` [x])
- **Last Action:** Successfully removed 1,500 lines of hardcoded static seed titles from `src/lib/seed-data.ts`, replaced with a lightweight `INITIAL_BOOTSTRAP_SEEDS` descriptor manifest, implemented automatic dynamic TMDB & OMDb API bootstrap into Cloud Firestore and server cache in `/api/live-media`, updated `getInitialMediaLibrary()` to hydrate the database catalog in 1 single request, set the 2D Canvas Map as the responsive default on mobile devices (`< 768px`) to eliminate startup lag and thermal throttling, added mobile touch gestures (single-finger pan, two-finger pinch-to-zoom) and capped retina DPR at 2 in `SpatialViewport.tsx`, exposed mobile 2D/3D toggle pills in `TopNavBar.tsx` and `LeftSidebar.tsx`, and verified clean compilation with `npm run build` and `npm run build:umap`.

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
