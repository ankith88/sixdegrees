# SixDegrees — Phase 1 Architecture & Implementation Plan (PLAN.md)

## Objective
Build **SixDegrees (`v2.4 Spatial 3D Engine`)** — an interactive, full-stack Next.js application functioning as an Obsidian-style 3D/2D Spatial Knowledge & Similarity Recommendation Engine for Movies and TV Shows.

## Aesthetic & Design System (Cosmic Obsidian HUD)
- **Visual Style**: Deep space cyber-telemetry HUD inspired by Obsidian and high-tech spatial telemetry interfaces.
- **Background**: `#0a0e14` (`obsidian-3d-matrix`) with a 48px CSS grid overlay and radial cyan/purple atmospheric glow (`rgba(56, 189, 248, 0.06)`).
- **Color Tokens**:
  - Glassmorphic Dark Slate Panels: `#10141a` / `#181c22` with `backdrop-blur-xl` and `border-white/10`
  - Primary Accent (Movies / Focal): `#38bdf8` / `#8ed5ff` (Cyan)
  - Secondary Accent (Directors / Creators / TV Shows): `#c084fc` / `#ddb7ff` (Neon Purple)
  - Tertiary Accent (Actors / IMDb Gold): `#f59e0b` / `#ffc174` (Amber)
  - Tropes / Genres / Match Score: `#34d399` (Emerald)
  - Composers / Studios: `#f43f5e` (Rose)
- **Typography**:
  - Headings & Titles: `'Space Grotesk'`
  - Telemetry, Coordinates, Badges & Controls: `'JetBrains Mono'`
  - Body & Synopses: `'Inter'`

## Core Mechanics & Features

### Task 1: Multi-API Data Service & Rich Seed Dataset (`src/lib/api.ts` & `src/lib/seed-data.ts`)
- Pre-loaded interactive seed graph centered on **Inception (2010)** connected to 30+ iconic Movies and TV Shows (*Interstellar*, *The Prestige*, *Memento*, *Tenet*, *Shutter Island*, *Paprika*, *The Matrix*, *Blade Runner 2049*, *Arrival*, *Eternal Sunshine of the Spotless Mind*, *Source Code*, *Minority Report*, *Looper*, *Ex Machina*, *Coherence*, *Predestination*, *Edge of Tomorrow*, *Everything Everywhere All at Once*, *Oppenheimer*, *Dune: Part Two*, *The Dark Knight*, *Prisoners*, *Annihilation*, *12 Monkeys*, *Dark [TV]*, *Severance [TV]*, *Westworld [TV]*, *Black Mirror [TV]*, *Mr. Robot [TV]*, *Devs [TV]*, *3 Body Problem [TV]*, *Legion [TV]*, *True Detective [TV]*, *Stranger Things [TV]*).
- Connected via shared Entity Nodes:
  - **Directors & Creators** (e.g., Christopher Nolan, Denis Villeneuve, Alex Garland, Baran bo Odar, Sam Esmail, Satoshi Kon, Charlie Brooker, Dan Erickson, Jonathan Nolan)
  - **Primary Cast / Actors** (e.g., Leonardo DiCaprio, Cillian Murphy, Tom Hardy, Christian Bale, Hugh Jackman, Matthew McConaughey, Amy Adams, Ryan Gosling, Jake Gyllenhaal, Rami Malek, Adam Scott, Keanu Reeves)
  - **Composers** (e.g., Hans Zimmer, Ludwig Göransson, Jóhann Jóhannsson, Clint Mansell, Ben Salisbury, Ramin Djawadi, Mac Quayle, Susumu Hirasawa)
  - **Micro-Tropes & Genres** (e.g., Dream Manipulation, Time Loop / Non-Linear Time, Heist / Infiltration, Simulated Reality, Memory Erasure / Unreliable Mind, Cyberpunk / AI Consciousness, Quantum Multiverse, Psychological Labyrinth, Sci-Fi, Thriller)
- Live API fallback & integration:
  - `NEXT_PUBLIC_TMDB_API_KEY`: Queries `/movie/{id}` and `/tv/{id}` with `append_to_response=credits,keywords,recommendations,external_ids,watch/providers` plus `/search/multi` for live Omni-Search.
  - `NEXT_PUBLIC_OMDB_API_KEY`: Queries `https://www.omdbapi.com/?i={imdb_id}` for verified IMDb, Rotten Tomatoes, and Metascore ratings.
  - Region-aware streaming providers (`AU`, `US`, `UK`) categorized by `Stream`, `Rent`, and `Buy` with direct links.

### Task 2: Weighted 100-Point Similarity Engine (`src/lib/similarity.ts`)
- Computes dynamic 0–100% similarity score between the active Focal Media Node and every other Movie/TV Show in the dataset:
  - **Micro-Tropes & Keywords (Max 35 pts)**: +12 pts per shared keyword/trope.
  - **Creative Auteur / Visionary (Max 25 pts)**: +25 pts for matching Director/Showrunner; +15 pts for shared screenwriter/creator.
  - **Broad Genres (Max 15 pts)**: +5 pts per shared genre; +5 pt bonus if primary genre matches.
  - **Primary Cast (Max 10 pts)**: +6 pts for sharing #1/#2 billed lead actor; +4 pts for top-5 supporting star.
  - **Sonic & Visual Team (Max 10 pts)**: +6 pts for shared Composer; +4 pts for shared Cinematographer.
  - **Audience Co-Watch Sign (Max 5 pts)**: +5 pts if in native TMDB `/recommendations` list.
- **Similarity Gravity Presets**:
  - `Vibe & Tropes Match`: Default weights emphasizing Micro-Tropes & Genres.
  - `Auteur / Creator Orbit`: Doubles Director/Creator & Composer weights (normalized to 100).
  - `Star Constellation`: Triples Lead & Supporting Cast weights (normalized to 100).
- **3D Spring Distance Formula**:
  - `linkDistance = 180 - (matchScore * 1.2)` scaled by user slider multiplier.

### Task 3: 4-Part Spatial HUD & Interactive 3D/2D WebGL Viewport
1. **Top Navigation Bar (`h-14`, fixed)**:
   - Custom SixDegrees interconnected numeric "6" cyber-graph SVG brand logo + `v2.4 Spatial 3D Engine` badge.
   - `Cmd+K` Omni-Search bar + modal/dropdown for instant filtering across Movies, TV Shows, Actors, Directors, Composers, and Tropes.
   - View Mode Switcher (`2D Graph`, `3D Graph` with `Z-AXIS ACTIVE` badge, `Similarity Matrix` ranked view).
   - Telemetry readout (`Nodes · Links · FOV: 55°`), Region Selector (`AU`, `US`, `UK`), and `Reset 3D Pitch` button.
2. **Left Docked Sidebar (`w-72`)**:
   - Media Type Filter (`All Media`, `Movies Only`, `TV Shows Only`).
   - Similarity Gravity Presets (`Vibe & Tropes Match`, `Auteur / Creator Orbit`, `Star Constellation`).
   - 3D Force Dynamics Sliders (`3D Spherical Force`, `Link Distance`, `Z-Repulsion Dispersion`, `Similarity Match Threshold`).
   - Entity Dimension Toggles (`Movies`, `TV Series`, `Directors & Creators`, `Actors`, `Micro-Tropes & Genres`, `Composers`).
3. **Central 3D/2D Spatial Viewport (`src/components/SpatialViewport.tsx`)**:
   - Interactive Three.js / WebGL 3D force-directed graph with `THREE.FogExp2`, ambient star-dust particles, custom 3D geometries (Spheres with pulsing wireframe & orbital ring for Focal node, Cubes/Octahedrons with rings for TV Series, Centroid Polyhedrons for Directors, Satellites for Actors, Clusters for Tropes, Audio Nodes for Composers).
   - Interactive 2D Canvas force graph mode and full-featured `Similarity Matrix` analytical grid view.
   - Hover state that illuminates exact 3D/2D links connecting the hovered node back to the central focal node through shared attributes while dimming unrelated links, paired with a glassmorphic cursor tooltip.
   - Bottom-center floating Camera Dock (`Orbit`, `Free Look`, `Fly-through`, Zoom `+`/`-`, `Reset Pitch`, `Auto-Rotate`).
4. **Right Floating Inspector Card (`w-[420px]`, collapsible)**:
   - Deep telemetry for selected/focal Movie or TV Show, 2:3 Poster artwork, 2x2 Ratings Grid (`IMDb ★`, `Rotten Tomatoes 🍅`, `Metascore`, `Runtime/Seasons & Rating`), Region-aware `Where to Watch` (`Stream`, `Rent`, `Buy`), interactive `Shared Connections / Why Watch Next` pills, and `Make Focal Centroid` + `Orbit Node (3D)` actions.

---

## Phase 2: Smart Watch Suggestions & Multi-Criteria Discovery (`02-watch-suggestions`)

### Objective
Enable users to discover tailored Movies and TV Shows to watch next based on:
1. **What they have already watched** (one or multiple watched/loved titles, persisted in `localStorage` and extendable via live search), and/or
2. **Genre, Narrative Theme, Mood Category, Collaborator, Era, or Streaming Service** (e.g., *Sci-Fi*, *Thriller*, *Mystery*, *Drama*, *Mind-Bending Sci-Fi*, *Critics' Darlings*, *Slow-Burn Series*, *Auteur Masterworks*, *Time & Memory Puzzles*).

### Phase 2 Plans
- **Plan `02-01` (Wave 1): Multi-Criteria Recommendation Engine, Watched History Persistence & Live Category Suggestion API**
  - `src/lib/types.ts`: Extend `ViewMode` with `'SUGGEST'` and add `WatchSuggestion`, `SuggestionFilterState`, `CuratedCategoryId`, and `SuggestionReason` types.
  - `src/lib/recommendations.ts`: Implement `CURATED_CATEGORIES`, `extractCatalogFacets`, and `computeWatchSuggestions` combining multi-seed watched history scoring with genre kinship, narrative tropes, curated category presets, collaborator filters, release era, minimum rating, and regional streaming filters.
  - `src/lib/api.ts` & `src/app/api/live-media/route.ts`: Add `localStorage` watched-title persistence (`getInitialWatchedIds`, `saveWatchedIdsToStorage`) and `/api/live-media?action=suggest` for live TMDB/catalog discovery by seed title or genre.
- **Plan `02-02` (Wave 2): Interactive "Watch Next" Suggestion Studio UI & Cross-App Integration**
  - `src/components/WatchSuggestionsView.tsx`: Full-featured Archival Folio suggestion studio with a **"Based on What You've Watched"** interactive shelf (including live catalog search to add any watched title), **"Browse by Genre, Theme & Category"** filter deck, and ranked suggestion cards with Match %, *"Because you watched..."* attribution, craft/genre reason pills, regional streaming links, and 3D map jump actions.
  - `src/components/TopNavBar.tsx`, `src/components/LeftSidebar.tsx`, `src/components/RightInspectorCard.tsx`, `src/components/SimilarityMatrixView.tsx`, `src/components/SixDegreesApp.tsx`: Integrate the `Watch Next` view mode switcher, watched-status toggles across all views, and one-click `"Suggest Similar"` triggers.


