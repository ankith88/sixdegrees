# Project State

## Current Position
- **Current Phase:** `08-logged-in-graph-and-curation-styling` (Logged-in Full Archive Constellation, Watched/Interested Node Styling & Curation Filters)
- **Status:** Phase 8 Completed & Verified (`08-01-PLAN.md` [x], `08-02-PLAN.md` [x])
- **Last Action:** Successfully fixed the empty graph issue on login by defaulting user profiles and auth flows to `FULL_ARCHIVE` instead of `WATCHED_ONLY`, added the `WATCH_STATUS` color mode with emerald green (`#10B981`) and amber gold (`#F59E0B`) tokens, implemented concentric status rings and ambient auras in 2D HTML5 canvas and 3D WebGL Three.js, built a floating Glassmorphic Curation Filter HUD bar (`All`, `Watched`, `Want to Watch`, `Unwatched` with DIM/HIDE toggle), and added curation controls to `LeftSidebar` and `TopNavBar`. Production build passed cleanly with zero errors.

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
