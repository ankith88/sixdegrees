# Phase 6 Research: Movie Map High-Performance Engine: Static UMAP Catalog, 2D Spatial Quadtree & Archival Territory Heatmaps

## 1. Objective & User Intent
Scale the Movie Map architecture to high-density exploration:
1. **Static Catalog Snapshot (`public/data/catalog_umap.json`)**:
   - Precompute high-dimensional feature vectors and continuous 2D/3D manifold coordinates for the catalog offline/at build time.
   - Serve a lightweight static JSON payload so the client loads pre-computed galaxy coordinates in <50ms without client-side CPU bottlenecks.
2. **2D Spatial Quadtree Indexing (`src/lib/spatial-index.ts`)**:
   - Replace linear $O(N)$ hit-testing loops in `SpatialViewport.tsx` with a lightweight, zero-dependency 2D Spatial Quadtree.
   - Guarantee sub-millisecond mousemove hover and click hit-testing even with 10,000+ points on screen at 60 FPS.
3. **Archival Territory Heatmap Underlays**:
   - Render soft Gaussian density halos and territory contour underlays beneath clusters in the 2D Galaxy canvas mode.
   - Rendered as subtle watercolor washes on `#F6F1E7` parchment paper, allowing users to intuitively perceive the boundaries and density centers of each cinematic genre/thematic universe.

## 2. Technical Investigation & Tradeoffs

### A. Static UMAP Coordinates Pipeline
- **Generator**: A Node.js ESM script (`scripts/generate-umap-catalog.mjs`) reads the current seed data (`src/lib/seed-data.ts`) and any Firestore cached titles (`src/lib/firestore-cache.ts`).
- **Feature Vector**:
  - Encodes genres (16 dimensions), top 200 tropes/keywords, directors/writers, and normalized rating/decade continuous features.
  - Applies high-dimensional cluster attraction and multi-dimensional scaling / force relaxation to generate continuous Cartesian coordinates `[x, y, z]` and normalized `[umapX, umapY]`.
- **Output**: `public/data/catalog_umap.json` mapping `id -> { x, y, z, clusterId, blendedColor, neighbors }`.
- **Client Fallback**: If the static file is unavailable or newly created user custom items are present, fallback dynamically to the existing `SEMANTIC_CLUSTER_DEFINITIONS` spiral algorithm.

### B. Lightweight Zero-Dependency Spatial Quadtree
- Rather than adding external npm packages like `rbush`, build a focused TypeScript class `SpatialQuadtree<T>` in `src/lib/spatial-index.ts`.
- Supports bounding-box queries `findNearby(x, y, radius)` and nearest-neighbor hit testing in $O(\log N)$ time.
- Integrated into `SpatialViewport.tsx` for instantaneous cursor collision detection on the 2D HTML5 canvas.

### C. Canvas Territory Heatmap Underlays
- **Technique**: Offscreen canvas or direct 2D canvas background layer rendered before drawing nodes and links.
- Uses radial gradient blurs (`createRadialGradient`) centered at cluster centroids and weighted by node density.
- Blends cluster colors using `globalAlpha = 0.08 - 0.15` and `globalCompositeOperation = 'multiply'` or `'source-over'` on top of the `#F6F1E7` cotton rag background.
- Gives the impression of vintage cartographic territory shading (like historical atlases or Middle-earth maps).

## 3. Verification Strategy
1. Run `node scripts/generate-umap-catalog.mjs` and verify `public/data/catalog_umap.json` generates cleanly.
2. Verify `npx tsc --noEmit` and `npm run build` pass without warnings.
3. Verify 60 FPS performance during rapid pan/zoom with hover hit-testing on the 2D Galaxy view.

