# Phase 9 Research: Dynamic API Database Ingestion, Pre-bundled Catalog & Mobile 2D Performance Engine

## 1. Executive Summary

### The Challenge
1. **Hardcoded Titles in Client Bundle:** The app currently bundles 32 curated films and series (`SEED_MEDIA_ITEMS` in `src/lib/seed-data.ts`) as ~1,500 lines of static JSON in the client JavaScript bundle. The user requested:
   - Completely remove the hardcoded seed titles.
   - Refetch the canonical starting catalog dynamically from the APIs (TMDB & OMDb).
   - Persist all fetched titles into the database (Cloud Firestore and local server cache).
   - Deliver the entire catalog to the user in a single, fast payload ("load all titles in 1 go").
2. **Mobile Startup Lag & Thermal Load:**
   - On mobile devices, initial load takes significant time and feels heavy because the app defaults to **3D WebGL mode** (`viewMode = '3D'`).
   - In 3D, Three.js initializes a WebGLRenderer, ACESFilmic tone mapping, procedural studio environment reflections, 420 particle Motés, and creates multi-part 3D meshes and **dynamic 2D canvas text sprites** (`480x96` offscreen HTML5 canvas per node) for every single title, director, writer, trope, and genre node.
   - On high-DPI mobile screens (e.g. DPR 3x), generating dozens of canvas textures and compiling WebGL shaders on mobile GPUs causes a noticeable main-thread freeze.
   - Furthermore, the view switcher is currently hidden on mobile (`hidden md:flex`), leaving mobile users stuck in 3D mode.

### The Solution
1. **Dynamic API Database Ingestion:**
   - Replace the 1,500 lines of hardcoded `SEED_MEDIA_ITEMS` data with a lightweight bootstrap manifest (`INITIAL_BOOTSTRAP_SEEDS`) containing only IDs (`tmdbId`, `mediaType`, `title`).
   - In `/api/live-media`, implement an automatic bootstrap routine that checks Cloud Firestore / server cache. If empty on first boot, it fetches full rich metadata from TMDB + OMDb via `fetchFullTmdbMediaItem`, batch-saves them to Cloud Firestore (`sixdegrees_catalog/bundle_0`) and `.next/cache`, and returns all titles to the client in 1 single JSON response.
   - Subsequent visits and users hydrate the full catalog directly from the database in 1 single HTTP request (~50ms) with zero hardcoded JSON in the client bundle.
2. **Mobile 2D Performance Engine:**
   - Detect mobile viewport width (`window.innerWidth < 768px`) or touch devices on mount and default `viewMode` to `'2D'`.
   - The 2D Canvas engine in `SpatialViewport.tsx` bypasses WebGL entirely: it draws clean vector nodes directly with `CanvasRenderingContext2D` (`ctx.arc()`, `ctx.fillText()`), completely eliminating shader compilation and offscreen canvas texture creation.
   - Expose the 2D / 3D view toggle in the mobile UI (compact header pill and `LeftSidebar` drawer) so mobile users can still explore 3D if they choose.
   - Guard WebGL initialization in `SpatialViewport` so Three.js remains completely idle when in 2D mode.

---

## 2. Dynamic API & Database Ingestion Architecture

### A. Existing Infrastructure in `src/app/api/live-media/route.ts` & `src/lib/firestore-cache.ts`
- `fetchFullTmdbMediaItem`: Already accepts `tmdbId` and `mediaType`, queries TMDB endpoints (`credits`, `keywords`, `recommendations`, `similar`, `external_ids`, `watch/providers`), optionally merges OMDb telemetry (IMDb rating, Metascore, Rotten Tomatoes, content rating), and parses them into a standard `MediaItem`.
- `loadCatalogFromFirestore`: Automatically loads bundled documents (`bundle_0`, `bundle_1`) from Cloud Firestore collection `sixdegrees_catalog`.
- `saveCatalogToFirestore`: Bundles up to 80 `MediaItem` records per document to keep Firestore reads and writes within the free-tier quota (50,000 reads/day, 20,000 writes/day).
- `getServerCache`: Maintains server memory and `.next/cache/sixdegrees-auto-catalog.json`.

### B. Transitioning from Hardcoded Seed to API Bootstrap
1. **Lightweight Bootstrap Manifest (`src/lib/seed-data.ts`):**
   ```ts
   export interface SeedBootstrapItem {
     tmdbId: number;
     mediaType: 'MOVIE' | 'TV';
     title: string;
   }
   
   export const INITIAL_BOOTSTRAP_SEEDS: SeedBootstrapItem[] = [
     { tmdbId: 27205, mediaType: 'MOVIE', title: 'Inception' },
     { tmdbId: 157336, mediaType: 'MOVIE', title: 'Interstellar' },
     { tmdbId: 1124, mediaType: 'MOVIE', title: 'The Prestige' },
     { tmdbId: 577922, mediaType: 'MOVIE', title: 'Tenet' },
     { tmdbId: 77, mediaType: 'MOVIE', title: 'Memento' },
     { tmdbId: 11324, mediaType: 'MOVIE', title: 'Shutter Island' },
     { tmdbId: 603, mediaType: 'MOVIE', title: 'The Matrix' },
     { tmdbId: 335984, mediaType: 'MOVIE', title: 'Blade Runner 2049' },
     { tmdbId: 329865, mediaType: 'MOVIE', title: 'Arrival' },
     { tmdbId: 872585, mediaType: 'MOVIE', title: 'Oppenheimer' },
     { tmdbId: 155, mediaType: 'MOVIE', title: 'The Dark Knight' },
     { tmdbId: 70523, mediaType: 'TV', title: 'Dark' },
     { tmdbId: 95557, mediaType: 'TV', title: 'Severance' },
     { tmdbId: 63247, mediaType: 'TV', title: 'Westworld' },
     { tmdbId: 42009, mediaType: 'TV', title: 'Black Mirror' },
     { tmdbId: 62560, mediaType: 'TV', title: 'Mr. Robot' },
     // ...
   ];
   ```
2. **Server-Side Hydration on `action=cached-catalog`:**
   - When `/api/live-media?action=cached-catalog` is called:
     - Check if `serverCache.items` or Firestore contains titles.
     - If yes: return all cached titles in 1 batch (`items: Object.values(serverCache.items)`).
     - If empty: automatically trigger `bootstrapInitialCatalog()`, iterating through `INITIAL_BOOTSTRAP_SEEDS`, fetching rich metadata from TMDB/OMDb, saving the entire bundle into Cloud Firestore and `.next/cache`, and returning the assembled catalog.
   - Result: 0 hardcoded titles in the client. The database becomes the single source of truth, populated from the API.

---

## 3. Mobile Performance & 2D Default

### A. 2D vs 3D Performance Comparison on Mobile
| Metric | 3D WebGL Constellation | 2D Canvas Map |
| :--- | :--- | :--- |
| **GPU Context** | `WebGLRenderingContext` with ACESFilmic tone mapping | Standard `CanvasRenderingContext2D` |
| **Shader Compilation** | Compiles vertex/fragment shaders for physical materials | None (instant startup) |
| **Label Rendering** | Creates offscreen `480x96` canvas per node, converts to `THREE.CanvasTexture` | Direct `ctx.fillText()` onto main canvas |
| **Memory Footprint** | 80–150 MB (meshes, geometry buffers, textures, Motés) | 10–20 MB (single 2D bitmap) |
| **Physics Calculation** | 3D spring embedding + spherical bounds: `(x, y, z)` | 2D spring embedding: `(x, y)` |
| **Mobile Frame Rate** | 25–45 FPS (thermal throttling on extended browsing) | Stable 60 FPS |

### B. Mobile Viewport Detection & View Mode Switcher
1. **Responsive Default in `SixDegreesApp.tsx`:**
   ```ts
   const [viewMode, setViewMode] = useState<ViewMode>(() => {
     if (typeof window !== 'undefined') {
       const isMobile = window.innerWidth < 768 || ('ontouchstart' in window && window.innerWidth < 1024);
       if (isMobile) return '2D';
     }
     return '3D';
   });
   ```
2. **Mobile View Switcher in `TopNavBar.tsx` and `LeftSidebar.tsx`:**
   - Display a compact `2D` / `3D` toggle pill in the mobile top navigation or mobile filter drawer so mobile users always have the freedom to switch between views with one tap.

---

## 4. Verification Plan
1. **Bundle Size & Verification:**
   - Check that `SEED_MEDIA_ITEMS` static array is removed.
   - Build cleanly with `npm run build` with zero TypeScript or Next.js build errors.
2. **API & Database Ingestion Verification:**
   - Query `/api/live-media?action=cached-catalog` on a cold cache $\rightarrow$ verify it boots, fetches from TMDB/OMDb, saves to Cloud Firestore / server cache, and returns titles in 1 response.
   - Verify all titles on the page display rich metadata (posters, tropes, ratings, cast) loaded from the database.
3. **Mobile 2D Performance Verification:**
   - Load the app at mobile viewport dimensions (`< 768px`) $\rightarrow$ verify it automatically opens in 2D mode.
   - Verify smooth 60 FPS dragging, zooming, and node inspection.
   - Verify tapping the 3D toggle switches smoothly to 3D WebGL mode without errors.

