# Phase 2 Research: Smart Watch Suggestions & Multi-Criteria Discovery

## 1. Existing Codebase Analysis
- **Similarity Engine (`src/lib/similarity.ts`)**:
  - `calculateSimilarity(focal, candidate, preset)` enforces `hasConcreteSharedConnection(similarity)` (requiring shared Director/Writer, Cast, Composer/DP, or specific Narrative Trope) and sets `genrePts = 0` and `coWatchPts = 0` for graph edge construction so the 3D constellation doesn't get cluttered by generic genre links.
  - **Gap for Watch Suggestions**: When a user wants watch suggestions *based on genre* (e.g., `Thriller`, `Sci-Fi`, `Crime`, `Mystery`), *category/mood* (e.g., *Critics' Darlings*, *Fast-Paced Heist*, *90%+ Rotten Tomatoes*), or *multi-title watched history*, we need a dedicated recommendation engine (`src/lib/recommendations.ts`) that:
    1. Computes multi-anchor affinity across all titles in the user's `watchedIds` list (or explicitly picked seed titles),
    2. Scores both **Concrete Craft/Trope Connections** AND **Genre / Category / Co-Watch / Critical Acclaim** signals so genre-based and category-based queries return rich, accurately ranked suggestions with transparent "Why Watch This" explanations.
- **View Modes & Navigation (`src/lib/types.ts`, `src/components/TopNavBar.tsx`, `src/components/SixDegreesApp.tsx`)**:
  - `ViewMode` is currently `'2D' | '3D' | 'MATRIX'`.
  - Extending `ViewMode` to `'2D' | '3D' | 'MATRIX' | 'SUGGEST'` adds a first-class **"Watch Next" (`SUGGEST`)** studio in the top navigation bar while also offering quick entry from `LeftSidebar` and `RightInspectorCard`.
- **Watched State Persistence**:
  - Users need a frictionless way to mark titles they have already watched (`watchedIds: string[]`, persisted in `localStorage` under `sixdegrees_watched_ids_v1`) from anywhere in the app:
    - Search bar results (`TopNavBar.tsx`)
    - Right Monograph Inspector & Graph Index (`RightInspectorCard.tsx`)
    - Critical Ledger (`SimilarityMatrixView.tsx`)
    - Inside the Watch Next Suggestion Studio (`WatchSuggestionsView.tsx`)
- **Live Catalog Discovery (`/api/live-media/route.ts`)**:
  - Currently supports `action=status`, `action=cached-catalog`, `action=auto-expand`, `action=search`, `action=item`, and `action=cluster`.
  - Adding `action=suggest` (which accepts optional `seedTmdbId`, `mediaType`, `genre`, or `keyword` query parameters and uses TMDB `/discover/{movie|tv}` or `/recommendations` with a zero-key fallback) allows users to pull fresh live suggestions on demand when browsing a genre or seed title.

## 2. Verification Strategy
- `npm run build` and TypeScript (`npx tsc --noEmit`) must pass with zero errors.
- Unit/integration verification of `getWatchSuggestions` across:
  - Single & multiple watched seed titles (verifying watched titles are excluded when `hideWatched: true` and "Because you watched X" reasons are populated).
  - Genre filtering (`Sci-Fi`, `Thriller`, `Mystery`, `Drama`, `Crime`, etc.) and curated category presets (`MIND_BENDING`, `CRITICS_DARLINGS`, `SLOW_BURN_TV`, `AUTEUR_MASTERWORKS`, `HIDDEN_GEMS`, `STREAMING_NOW`).
  - Region-aware streaming filter (`AU`, `US`, `UK`).
