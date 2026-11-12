# Phase 8 Research: Logged-in Full Archive Constellation, Watched/Interested Node Styling & Curation Filters

## 1. Executive Summary & Root Cause Analysis

### A. The Root Cause of Empty / Missing Titles on Login
When investigating why the main graph displays no movies or TV shows when a user is logged in:
1. In `src/lib/user-profile.ts`, `createUserProfile` and `createOrUpdateUserProfile` assigned:
   ```ts
   defaultGraphScope: input.defaultGraphScope || existing?.defaultGraphScope || 'WATCHED_ONLY'
   ```
2. In `src/components/SixDegreesApp.tsx`:
   - `handleSwitchUser` ran: `setGraphScope(profile.defaultGraphScope || 'WATCHED_ONLY')`
   - `handleSignInCredentials` ran: `setGraphScope(loaded.defaultGraphScope || 'WATCHED_ONLY')`
   - `handleDeleteProfile` ran: `setGraphScope(nextUser.defaultGraphScope || 'WATCHED_ONLY')`
3. In `src/lib/similarity.ts` (`buildSpatialGraph`):
   - When `graphScope === 'WATCHED_ONLY'`, `scopedItems` filters all catalogue items to strictly `watchedSet.has(item.id)`.
   - If a newly logged-in user has 0 watched movies (or even just a few), `scopedItems` contains 0 items, producing a completely empty graph with no nodes and no links!
4. **Resolution**:
   - The default `graphScope` for all users (both guests and authenticated users) must be `'FULL_ARCHIVE'`.
   - A logged-in user must immediately see the full cosmic archive of all movies and TV shows, with their personal watched and interested items seamlessly highlighted and integrated directly into the constellation.

---

## 2. Visual Differentiation & Design System Guidance (/ui-styling & /ui-ux-pro-max)

### A. Color & Design Tokens
From the `ui-ux-pro-max` search for dark mode OLED / sci-fi HUD visualization and compact filter chips:
* **Canvas Void**: `#0A0E17` (Movie Map Dark) / `#F6F1E7` (Archival Folio).
* **Watched Status Tokens**:
  - Dark Theme Primary: Emerald Green `#10B981` (emissive / glow `#34D399`)
  - Dark Theme Halo/Ring: `rgba(16, 185, 129, 0.45)` with soft radial gradient
  - Light Theme Primary: Heritage Forest `#2A6B53` (emissive `#3D9970`)
  - Semantic Glyph: `✓ Watched`
* **Interested / Want to Watch Status Tokens**:
  - Dark Theme Primary: Electric Amber Gold `#F59E0B` / Cyan `#00D2FF` (emissive / glow `#FBBF24`)
  - Dark Theme Halo/Ring: `rgba(245, 158, 11, 0.45)` with subtle dashed / dual halo
  - Light Theme Primary: Archival Amber `#B45309` / Deep Cobalt `#234B6E`
  - Semantic Glyph: `★ Want to Watch`
* **Unmarked / Archive Base Tokens**:
  - When in `'WATCH_STATUS'` color mode: muted celestial slate `#475569` (dark) / `#8C827A` (light) so personal nodes shine brilliantly like focal beacons.

### B. Graph Visual Representation in 2D & 3D
1. **Concentric Status Rings**:
   - Rather than merely tinting the node dot, render an outer luminous status ring around personal titles:
     - 2D Canvas: concentric ring at `radius * 1.55`, lineWidth `1.8px`, emerald stroke for Watched, amber stroke for Interested.
     - 3D WebGL (Three.js): dedicated camera-facing ring mesh (`THREE.RingGeometry`) that smoothly pulses or glows when `node.isWatched` or `node.isInterested`.
2. **Node Tooltips & Sublabels**:
   - Include clear visual status tags: `${item.year} · IMDb ${item.imdbRating.toFixed(1)} · ${item.primaryGenre} · ✓ Watched`.
   - On node selection or hover, display compact status chips matching our design system tokens.
3. **New Color Mode: `WATCH_STATUS`**:
   - Add `'WATCH_STATUS'` to `NodeColorMode` (`'CATEGORY' | 'CLUSTER' | 'GENRE' | 'DECADE' | 'WATCH_STATUS'`).
   - Selecting this mode colors every title by its curation state: Watched (Emerald), Want to Watch (Amber), and Unmarked (Muted Slate).

---

## 3. Curation Filtering & HUD Navigation

### A. Floating Curation Filter HUD
* Add a floating glassmorphic filter pill bar on the main graph canvas (and in TopNavBar/LeftSidebar):
  - `All Titles` (`matchingCount`)
  - `Watched` (`watchedCount`, emerald dot)
  - `Want to Watch` (`interestedCount`, amber dot)
  - `Unwatched` (`unwatchedCount`)
* When clicked, this immediately sets `graphFilters.watchedFilter`.
* Respect `filterBehavior`:
  - `DIM` (default): non-matching nodes dim to subtle celestial stardust (`opacity: 0.08` or muted tone), preserving full cluster topology.
  - `HIDE`: isolates strictly the filtered subset.
* Ensure TopNavBar's watched and interested counter buttons seamlessly trigger the filter or open the curation view without ever wiping out the main graph.

---

## 4. Verification Plan
1. **TypeScript & Production Build**: Run `npm run build` and verify clean compile with zero errors.
2. **Login State Verification**:
   - Create or switch to a user with 0 watched items $\rightarrow$ verify full archive displays all movies and TV shows.
   - Mark a movie as Watched $\rightarrow$ verify emerald halo / ring appears on the graph node.
   - Mark a movie as Want to Watch $\rightarrow$ verify amber halo / ring appears on the graph node.
   - Switch Color Mode to `WATCH_STATUS` $\rightarrow$ verify watched items glow emerald, interested glow amber, rest are muted slate.
   - Click floating Curation Filter chips (`Watched`, `Want to Watch`, `Unwatched`) $\rightarrow$ verify graph highlights or isolates matching items properly.

