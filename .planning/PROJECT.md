# SixDegrees — Spatial Knowledge & Recommendation Engine

## Vision
SixDegrees is an interactive 3D/2D Spatial Knowledge Graph and Recommendation Engine for Movies and TV Shows styled as an Archival Film Folio (`#F6F1E7` warm cotton rag, `#EFE8DA` card surface, `#B8292F` crimson accents, Spectral serif headings, and Source Sans 3 tabular telemetry).

## Core Capabilities
1. **Phase 1: Spatial 3D/2D Constellation & Weighted Craft Similarity Engine (Completed)**
   - Interactive Three.js 3D force-directed constellation, 2D Canvas map, and Critical Lineage Ledger (`SimilarityMatrixView`).
   - 100-point craft similarity rubric across Themes/Motifs, Directors/Writers, Genres, Cast, Score/Cinematography, and Co-Watch signals.
   - Live TMDB + OMDb + Wikidata/IMDb enrichment, quota-safe background auto-expansion, and Cloud Firestore caching.

2. **Phase 2: Smart Watch Suggestions & Multi-Criteria Discovery ("What to Watch Next") (Completed)**
   - Personalized **"Because You Watched"** suggestion engine driven by user-marked Watched titles and/or active seed titles.
   - Multi-category discovery across **Genres**, **Narrative Themes / Tropes**, **Curated Mood Categories**, **Collaborators**, **Release Eras**, **Media Format**, and **Regional Streaming Availability** (`AU`, `US`, `UK`).
   - Live catalog suggestion expansion endpoint (`/api/live-media?action=suggest`).

3. **Phase 3: Isolated Connected Subgraph View & Full Graph Reset (Completed)**
   - Clicking any node isolates the 3D/2D view to only the selected node and its interconnected nodes in a clean radial arrangement, with one-click and `Esc` controls to reset everything back to the full archive.

4. **Phase 4: User Profiles, Persistent Watched Sync & Personal Watched Graph (Completed)**
   - User-level profiles (`UserProfile`) storing display name, `@handle`, email, bio, avatar color, regional/curatorial preferences, `watchedIds`, and custom imported media snapshots—persisted in `localStorage`, server cache, and Cloud Firestore (`/api/user-profile`).
   - Personal Watched Graph mode (`WATCHED_ONLY` and `WATCHED_PLUS_SUGGESTIONS`) allowing users to generate and explore their own 3D/2D knowledge graph built from the movies and TV shows they have watched.
