# SixDegrees — Spatial Knowledge & Recommendation Engine

## Vision
SixDegrees is an interactive 3D/2D Spatial Knowledge Graph and Recommendation Engine for Movies and TV Shows styled as an Archival Film Folio (`#F6F1E7` warm cotton rag, `#EFE8DA` card surface, `#B8292F` crimson accents, Spectral serif headings, and Source Sans 3 tabular telemetry).

## Core Capabilities
1. **Phase 1: Spatial 3D/2D Constellation & Weighted Craft Similarity Engine (Completed)**
   - Interactive Three.js 3D force-directed constellation, 2D Canvas map, and Critical Lineage Ledger (`SimilarityMatrixView`).
   - 100-point craft similarity rubric across Themes/Motifs, Directors/Writers, Genres, Cast, Score/Cinematography, and Co-Watch signals.
   - Live TMDB + OMDb + Wikidata/IMDb enrichment, quota-safe background auto-expansion, and Cloud Firestore caching.

2. **Phase 2: Smart Watch Suggestions & Multi-Criteria Discovery ("What to Watch Next") (Current Phase)**
   - Personalized **"Because You Watched"** suggestion engine driven by user-marked Watched titles (persisted in `localStorage`) and/or active seed titles.
   - Multi-category discovery across **Genres**, **Narrative Themes / Tropes**, **Curated Mood Categories** (e.g., *Mind-Bending Sci-Fi*, *Slow-Burn Mystery Series*, *Critics' Darlings*, *Auteur Masterworks*), **Collaborators** (Directors, Actors, Composers), **Release Eras**, **Media Format** (Movies vs. TV Series), and **Regional Streaming Availability** (`AU`, `US`, `UK`).
   - Live catalog suggestion expansion endpoint (`/api/live-media?action=suggest`) to pull fresh TMDB/live matches by genre or seed title directly into the suggestion studio and 3D graph.
