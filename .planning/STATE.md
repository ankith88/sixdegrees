# Project State

## Current Position
- **Current Phase:** `10-ui-motion-and-interaction-polish` (Restrained UI Motion & Interaction Polish)
- **Status:** Phase 10 Completed & Built (`10-01-PLAN.md` [x], `10-02-PLAN.md` [x])
- **Last Action:** Implemented shared motion tokens (`--ease-out`, `--ease-in-out`, `--ease-drawer`) and `prefers-reduced-motion` fallbacks in `src/app/globals.css`, `@starting-style` entrances for the status toast (`SixDegreesApp.tsx`), modals (`UserProfileModal.tsx`, `PwaInstallButton.tsx`), and mobile drawer (`LeftSidebar.tsx`), a 2000ms hold-to-confirm `HoldToDeleteButton` in `UserProfileModal.tsx`, `grid-template-rows` accordion reveal for "Refine Catalog" in `LeftSidebar.tsx`, and `.btn-press` `:active` feedback across primary buttons; verified with `npm run build`.

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
