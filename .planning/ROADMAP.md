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

- [x] **Phase 3: Isolated Connected Subgraph View & Full Graph Reset** — Completed
  - **Goal:** When selecting any node on the graph, isolate the view so only the selected node and its interconnected nodes (and their connecting links) are shown, arranged cleanly for inspection, with prominent one-click and keyboard (`Esc`) controls to reset everything back to the full archive graph.
  - **Plans:**
    - [x] `03-01-PLAN.md` — Strict 3D/2D Connected Subgraph Isolation, Radial Subgraph Layout & Global "Reset Everything" Controls (`src/components/SpatialViewport.tsx`, `src/components/SixDegreesApp.tsx`, `src/components/TopNavBar.tsx`, `src/components/RightInspectorCard.tsx`)

- [x] **Phase 4: User Profiles, Persistent Watched Sync & Personal Watched Graph** — Completed
  - **Goal:** Store user profile information and save watched Movies and TV Shows at the user level (with local persistence and server/Cloud Firestore sync), and allow users to generate and explore their own 3D/2D spatial knowledge graph built from the movies and TV shows they have watched.
  - **Plans:**
    - [x] `04-01-PLAN.md` — User Profile Data Model, Local + Cloud Firestore User Store (`/api/user-profile` & `src/lib/user-profile.ts`), and Personal Watched Graph Engine (`GraphScopeMode` in `src/lib/similarity.ts`)
    - [x] `04-02-PLAN.md` — User Profile & Personalization Studio Modal (`src/components/UserProfileModal.tsx`), Cross-App "My Watched Graph" Scope Toggle (`TopNavBar`, `LeftSidebar`, `WatchSuggestionsView`, `SpatialViewport`), and User-Scoped State Orchestration (`src/components/SixDegreesApp.tsx`)

- [x] **Phase 5: Movie Map Semantic Clusters, Color Blending & Multi-Faceted Filtering** — Completed
  - **Goal:** Reverse engineer and integrate the graph UI/UX, semantic clusters, smooth boundary color blending, precomputed 20 nearest neighbors, and multi-faceted filtering (`Any [OR]` vs `All [AND]` genres/keywords, decade/rating ranges, context-preserving node dimming, and `L`-key label toggles) from Mikey Guinness's Movie Map (`https://mikeyguinness.com/movies/`) while preserving 100% of existing SixDegrees capabilities.
  - **Plans:**
    - [x] `05-01-PLAN.md` — HDBSCAN-inspired Semantic Galaxy clustering, color blending, nearest neighbor precomputation, and filter evaluation engine (`src/lib/types.ts` & `src/lib/similarity.ts`).
    - [x] `05-02-PLAN.md` — Interactive Movie Map filter controls, HUD projection switcher, context-preserving node dimming in 3D/2D, territory legends, and 20 Nearest Neighbors inspector tab (`src/components/LeftSidebar.tsx`, `src/components/SpatialViewport.tsx`, `src/components/RightInspectorCard.tsx`, `src/components/TopNavBar.tsx`, `src/components/SixDegreesApp.tsx`).

