# Phase 4 Research: User Profiles, Persistent Watched Sync & Personal Watched Graph

## 1. Objective & User Intent
The user wants:
1. **User-Level Watched & Personalization Storage**:
   - Store user information (`UserProfile`) when a user wants the application personalized to them.
   - Save `watchedIds` (and any custom live-imported `MediaItem` records the user marked as watched) at the **user level** rather than a single anonymous browser list, with seamless local persistence (`localStorage`) AND automatic Cloud Firestore cloud sync (`sixdegrees_users/{userId}`) when Firestore is configured.
2. **Personal Watched Graph ("My Watched Graph")**:
   - Allow users to generate and explore **their own 3D/2D spatial graph** built specifically from the Movies and TV Shows they have watched (`GraphScopeMode = 'WATCHED_ONLY'` or `'WATCHED_PLUS_SUGGESTIONS'`), revealing the hidden directors, actors, composers, and narrative themes connecting their personal viewing history.

## 2. Existing Codebase Analysis
- **Current Watched Persistence (`src/lib/api.ts` & `src/components/SixDegreesApp.tsx`)**:
  - Currently `getInitialWatchedIds()` and `saveWatchedIdsToStorage()` read/write a flat `string[]` under `sixdegrees_watched_ids_v1`.
  - There is no concept of a user identity (`UserProfile`), user switching, guest vs. personalized mode, or cloud-synced user profiles.
- **Cloud Firestore Infrastructure (`src/lib/firestore-cache.ts`)**:
  - Already implements zero-dependency Firestore v1 REST API helpers (`getFirestoreConfig`, Service Account JWT bearer token generation, and API key support) targeting `sixdegrees_catalog`.
  - Can be cleanly extended (or paired with a dedicated helper in `src/lib/firestore-cache.ts` and `/api/user-profile/route.ts`) to read/write user profile documents in `sixdegrees_users/{userId}` using 1 read on login/hydration and 1 write on profile/watched update.
- **Spatial Graph Engine (`src/lib/similarity.ts` — `buildSpatialGraph`)**:
  - Currently accepts `{ items, focalId, preset, mediaFilter, forceSettings, visibility }`.
  - In global constellation mode (`!focalItem`), it filters `items` only by `mediaFilter` and `visibility`, then computes pairwise connections with `effectiveThreshold = Math.max(15, forceSettings.matchThreshold)`.
  - If a user switches to **"My Watched Graph"** (`graphScope: 'WATCHED_ONLY'`) and has e.g. 5–25 watched titles:
    - We should filter the active items to the user's `watchedIds`.
    - Moreover, within a personal watched graph, users want to see **every** watched title in their constellation along with all shared Collaborator (Director, Writer, Cast, Composer) and Narrative Theme bridge nodes connecting any 2+ of their watched titles—even if a pair's total score is below a high slider threshold, or when two watched titles share a genre/collaborator link.
    - Adding a `'WATCHED_PLUS_SUGGESTIONS'` scope option also lets users view their watched nodes alongside the top 8–10 highest-match unwatched recommendations bridged directly to their watched titles.

## 3. Architecture & Design Decisions
1. **User Profile Model (`src/lib/types.ts` & `src/lib/user-profile.ts`)**:
   - `GraphScopeMode`: `'FULL_ARCHIVE' | 'WATCHED_ONLY' | 'WATCHED_PLUS_SUGGESTIONS'`
   - `UserProfile`:
     - `id: string` (normalized slug/UUID, e.g., `user:ankith`)
     - `handle: string` (unique handle/username for cloud lookup & sync, e.g., `ankith`)
     - `displayName: string`
     - `email?: string`
     - `avatarColor: string` (Archival palette accent: Crimson `#B8292F`, Ultramarine `#234B6E`, Verdigris `#2A6B53`, Ochre `#B86B14`, Plum `#6B3A6E`)
     - `bio?: string`
     - `watchedIds: string[]`
     - `watchedCustomItems: MediaItem[]` (snapshots of any non-seed live-searched movies/series the user watched, ensuring their personal graph always has full metadata even on a new device)
     - `preferredRegion: RegionCode`
     - `defaultPreset: GravityPreset`
     - `defaultGraphScope: GraphScopeMode`
     - `createdAt: string`
     - `updatedAt: string`
   - Support **Guest Mode** (`activeUser: null`, or unpersonalized archive browsing) alongside **Personalized User Profiles** (create profile, sign in / load by handle from Cloud Firestore or local registry, switch between saved profiles, export/import JSON, or sign out).
2. **Cloud + Local Persistence (`/api/user-profile/route.ts` & `src/lib/firestore-cache.ts`)**:
   - Add `loadUserProfileFromFirestore(handleOrId)` and `saveUserProfileToFirestore(profile)` in `src/lib/firestore-cache.ts` (and a server fallback file cache `.next/cache/sixdegrees-users.json` when Firestore env vars are not set, so server-side persistence works out of the box in all environments!).
   - Create `/api/user-profile` (`GET` to fetch a profile or list profiles, `POST` to upsert profile + watched history, `DELETE` to remove).
3. **Personal Watched Graph Engine (`src/lib/similarity.ts`)**:
   - Extend `BuildGraphOptions` with `graphScope?: GraphScopeMode`, `watchedIds?: string[]`, and `suggestedMediaIds?: string[]`.
   - When `graphScope === 'WATCHED_ONLY'`:
     - Restrict media nodes to the user's watched titles (`watchedSet.has(item.id)`).
     - Lower the effective pairwise link threshold for personal graphs and allow genre kinship as a secondary tie-breaker when needed so watched titles form a cohesive personal web, while still prioritizing concrete shared Directors, Writers, Actors, Themes, and Composers as 3D/2D entity bridge nodes.
   - When `graphScope === 'WATCHED_PLUS_SUGGESTIONS'`:
     - Include all watched titles plus the top N recommended titles (`suggestedMediaIds`), marking watched nodes vs. suggested discovery nodes clearly in `subLabel` and node metadata.
4. **UI Integration (Archival Film Folio Aesthetic)**:
   - **TopNavBar (`src/components/TopNavBar.tsx`)**:
     - Add a **Graph Scope Switcher** pill (`Full Archive` vs. `My Watched Graph (N)`) right in the header so users can toggle their personal graph in 1 click from 3D, 2D, or Matrix views.
     - Add a **User Profile Chip / Button** on the right side of `TopNavBar` showing the active user's avatar monogram, name, and watched count (or `"Personalize / Sign In"` when in Guest mode).
   - **UserProfileModal (`src/components/UserProfileModal.tsx`)**:
     - Archival Folio modal/drawer to create a new personalized profile, switch between existing profiles, sync/load a profile by handle from the server/Firestore, manage watched titles (including live search to add watched movies/shows directly to the profile), and one-click **"Build My Watched Graph"**.
   - **LeftSidebar & WatchSuggestionsView (`src/components/LeftSidebar.tsx`, `src/components/WatchSuggestionsView.tsx`, `src/components/SpatialViewport.tsx`)**:
     - Add a prominent **"My Personal Graph"** toggle card in `LeftSidebar` and a **"Visualize My Watched Graph in 3D"** action in `WatchSuggestionsView` and `SpatialViewport` HUD.
     - Render watched badge rings/indicators on nodes in 3D/2D when viewing `WATCHED_PLUS_SUGGESTIONS` so users can immediately distinguish their watched anchors from recommended discoveries.

## 4. Verification Strategy
- `npx tsc --noEmit` and `npm run build` must succeed with zero errors.
- Verify user profile creation, profile switching, user-scoped `watchedIds` persistence across reloads, and instant 3D/2D rendering of the user's personal watched graph.
