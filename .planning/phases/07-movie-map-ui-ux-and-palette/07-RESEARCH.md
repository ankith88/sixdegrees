# Phase 7 Research: Mikey Guinness Movie Map UI, UX & Luminous Dark Palette Transformation

## 1. Executive Summary & Objective
Based on our reverse engineering analysis of Mikey Guinness's Movie Map (`https://mikeyguinness.com/movies/`), the user requested to bring the **exact same UI, UX, and color palette** into SixDegrees across the entire application.

This phase transforms SixDegrees from its warm archival cotton rag aesthetic into the authentic, cinematic **Movie Map Dark Void** experience while retaining 100% of SixDegrees' multi-criteria recommendation engine, user profiles, Watched/Interested tracking, and 3D/2D views.

## 2. Reverse Engineering Breakdown of Mikey Guinness's Movie Map

### A. Color Palette & Lighting
* **Canvas Void**: Deep space obsidian `#0A0E17` (with ambient slate tint `#0F1523`), eliminating all harsh white/beige backgrounds so data points pop like stars in a night sky.
* **Surface Materials**: Dark frosted glass (`rgba(16, 22, 36, 0.85)` to `rgba(10, 14, 23, 0.92)`) with hairline borders (`rgba(255, 255, 255, 0.08)`) and high backdrop blur (`backdrop-blur-md` / `16px`).
* **Luminous Cluster Palette**:
  Each semantic cluster is assigned an electric, luminous tone that radiates against the dark canvas:
  1. *Mind-Bending Sci-Fi*: Electric Cyan (`#00D2FF` / glow `#38E1FF`)
  2. *Auteur Prestige Drama*: Radiant Ruby Rose (`#FF3366` / glow `#FF668B`)
  3. *Visceral Noir & Neo-Crime*: Neon Amber Gold (`#FFAA00` / glow `#FFC44D`)
  4. *Atmospheric Horror & Macabre*: Eerie Ultraviolet (`#9D4EDD` / glow `#C77DFF`)
  5. *Epic Worldbuilding & Fantasy*: Emerald Mint (`#00F5D4` / glow `#57FCE3`)
  6. *Contemplative & Philosophical*: Luminous Periwinkle (`#7B8CDE` / glow `#A3B0F5`)
  7. *Kinetic Action Spectacle*: Blazing Solar Flame (`#FF5400` / glow `#FF7A33`)
  8. *Wry Satire & Comedy*: Warm Sunlight Yellow (`#FFD166` / glow `#FFE299`)
* **Color Blending Across Borders**:
  The linear RGB blending function `blendHexColors` interpolates between luminous cluster colors, creating glowing gradients along transition frontiers.

### B. UI/UX Interaction Design
* **Full-Bleed Canvas with Floating Glass Controls**:
  Instead of rigid bordered desktop application frames, the canvas occupies 100% of the screen.
  - Navigation bar, filter rail, and inspector cards float as elegant, rounded glassmorphic islands over the stars.
* **Filter Rail & Match Logic**:
  - `Any (OR)` vs `All (AND)` matching chips with glowing active states.
  - Interactive decade/year range slider with dual handles and glowing track.
  - Rating threshold slider with live numeric readout.
  - Non-matching nodes dim to subtle celestial ghost dust (`opacity: 0.08`), preserving cluster geography.
* **Movie Inspector Panel with Precomputed Nearest Neighbors**:
  - Frosted glass drawer with blurred backdrop poster art.
  - Top 20 Similar Films displayed with affinity badges; clicking any neighbor smoothly animates the camera to that node on the map.
* **HUD Hotkeys & Navigation**:
  - `L` key label toggle (Auto LOD $\rightarrow$ All $\rightarrow$ Off).
  - Quick cluster jump chips.
  - Projection switcher (Physics Orbit vs Semantic Galaxy).
  - Quick theme toggle in the header allowing users to toggle between **Movie Map Dark** (default) and **Archival Folio**.

## 3. Architecture & Implementation Plan

### A. Theme Architecture (`src/lib/types.ts` & `src/app/globals.css`)
* Add `AppTheme = 'MOVIE_MAP_DARK' | 'ARCHIVAL_FOLIO'` to `types.ts`.
* Define CSS variable sets in `globals.css` under `:root` and `[data-theme="movie-map-dark"]`:
  - `--bg-canvas`: `#0A0E17`
  - `--surface-card`: `rgba(18, 24, 38, 0.88)`
  - `--surface-card-hover`: `rgba(28, 38, 58, 0.92)`
  - `--surface-pill`: `rgba(255, 255, 255, 0.06)`
  - `--ink-primary`: `#F0F4FC`
  - `--ink-secondary`: `#9DAEC7`
  - `--ink-muted`: `#637594`
  - `--border-subtle`: `rgba(255, 255, 255, 0.08)`
  - `--border-highlight`: `rgba(255, 255, 255, 0.16)`

### B. Viewport & Canvas Overhaul (`src/components/SpatialViewport.tsx`)
* **3D Three.js Scene**:
  - Set `scene.background = new THREE.Color(isDark ? 0x0a0e17 : 0xf6f1e7)`.
  - Update node materials: Emissive intensity `0.35 - 0.65` for dark mode so nodes radiate ambient light.
  - Update link lines: Glowing translucent lines (`rgba(0, 210, 255, 0.3)` and `rgba(255, 51, 102, 0.3)`).
* **2D HTML5 Canvas**:
  - Clear color `#0A0E17` in dark mode.
  - Add radial glowing bloom halos to hovered and selected nodes.
  - Render territory underlays with luminous watercolor screen blending (`globalCompositeOperation = 'screen'` or softly tinted radial washes).

### C. Interface Components Overhaul
* `TopNavBar.tsx`: Floating glassmorphic header with dark glass backdrop blur and a theme toggle button (`Sun` / `Moon` or `Folio` / `Movie Map`).
* `LeftSidebar.tsx`: Translucent dark glass filter rail, glowing pills, active indicator dots, and smooth accordions.
* `RightInspectorCard.tsx`: Dark glass drawer, high-res poster with gradient fade, cluster tags with glowing neon borders, and similar films list.

## 4. Verification Strategy
1. Build check: `npm run build` and `npx tsc --noEmit` must pass with zero errors.
2. Visual check: Both `MOVIE_MAP_DARK` and `ARCHIVAL_FOLIO` themes render flawlessly with crisp contrast, legible typography, and 60 FPS canvas performance.

