# SixDegrees Roadmap

## Milestones & Phases

- [x] **Phase 1: Spatial 3D/2D Graph & Craft Similarity Engine** — Completed
  - Multi-API Data Service & Rich Seed Dataset (`src/lib/api.ts` & `src/lib/seed-data.ts`)
  - Weighted 100-Point Similarity Engine (`src/lib/similarity.ts`)
  - 4-Part Archival Spatial UI (`TopNavBar`, `LeftSidebar`, `SpatialViewport`, `RightInspectorCard`, `SimilarityMatrixView`)

- [x] **Phase 2: Smart Watch Suggestions & Multi-Criteria Discovery** — Completed
  - **Goal:** Enable users to get tailored Movie and TV Show watch suggestions based on titles they have already watched, or by browsing and combining genres, narrative themes, mood categories, collaborators, eras, and streaming services.
  - **Plans:**
    - [x] `02-01-PLAN.md` — Multi-Criteria Recommendation Engine, Watched History Store & Live Category Suggestion API (`src/lib/types.ts`, `src/lib/recommendations.ts`, `src/lib/api.ts`, `src/app/api/live-media/route.ts`)
    - [x] `02-02-PLAN.md` — Interactive "What to Watch" Suggestion Studio View & Cross-App Watched Controls (`src/components/WatchSuggestionsView.tsx`, `src/components/TopNavBar.tsx`, `src/components/RightInspectorCard.tsx`, `src/components/LeftSidebar.tsx`, `src/components/SixDegreesApp.tsx`)
