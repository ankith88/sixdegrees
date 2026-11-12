# Phase 5 Research: Movie Map Semantic Clusters, Color Blending & Multi-Faceted Filtering

## 1. Executive Summary & Objective
Reverse engineer and adapt the core principles of Mikey Guinness's Movie Map (`https://mikeyguinness.com/movies/`):
1. **Semantic Galaxy Clusters**: Group titles by cinematic affinity into 8 signature archetypes using high-dimensional craft features rather than arbitrary 2D placement.
2. **Boundary Color Blending**: Soft linear RGB color interpolation across cluster frontiers for cross-genre titles (e.g. Sci-Fi + Noir).
3. **Precomputed 20 Nearest Neighbors**: Pre-calculating the top-20 nearest titles for instantaneous lookup in an inspector drawer.
4. **Multi-Faceted Map Filtering**:
   - `Any (OR)` vs `All (AND)` matching logic across multi-selected genres and narrative tropes.
   - Release year range sliders (1970–2030) and IMDb rating thresholds.
   - Context-preserving canvas dimming (`DIM` ghosting vs `HIDE` pruning).
   - Hotkey controls (`L` key to cycle label LOD).

## 2. Mathematical Modeling & Algorithms
- **Cluster Centroids**: Anchor 8 spatial sectors in 3D/2D space, applying a seeded golden spiral (`theta = idx * 2.399963`, `r = sqrt(idx % 19 + 1) * spread`) for local dispersion.
- **Color Blending**: `blendHexColors(c1, c2, t)` interpolates RGB channels linearly with ratio `t = min(0.45, max(0.1, (secondaryScore / total) * 0.7))`.
- **Filtering**: Multi-faceted filter state `GraphFilterState` supporting OR/AND boolean logic, year bounds, rating gates, and cluster filters.

## 3. UI/UX Folio Integration
- Seamlessly styled in the Archival Film Folio design language (`#F6F1E7` rag paper, `#EFE8DA` card background, `#B8292F` crimson accents).
- Integrated into `LeftSidebar.tsx`, `SpatialViewport.tsx`, `RightInspectorCard.tsx`, and `TopNavBar.tsx`.

