# SixDegrees (`v2.4 Spatial 3D Engine`)

An interactive, full-stack **Obsidian-style 3D/2D Spatial Knowledge & Similarity Recommendation Engine** for Movies and TV Shows.

---

## 1. Aesthetic, Theme & Typography (Cosmic Obsidian HUD)
- **Visual Style**: Deep space cyber-telemetry HUD inspired by Obsidian and high-tech spatial telemetry interfaces.
- **Background**: `#0a0e14` (`obsidian-3d-matrix`) with a subtle `48px` CSS grid overlay and radial cyan/purple atmospheric glow (`rgba(56, 189, 248, 0.06)`).
- **Color Palette**:
  - **Surface / Panels**: Glassmorphic dark slate (`#10141a` / `#181c22` with `backdrop-blur-xl` and `border-white/10`)
  - **Primary Accent (Movies / Focal)**: Cyan (`#38bdf8` / `#8ed5ff`)
  - **Secondary Accent (Directors / Creators / TV Shows)**: Neon Purple (`#c084fc` / `#ddb7ff`)
  - **Tertiary Accent (Actors / IMDb Gold)**: Amber (`#f59e0b` / `#ffc174`)
  - **Tropes / Genres / Match Score**: Emerald (`#34d399`)
  - **Composers / Studios**: Rose (`#f43f5e`)
- **Typography**:
  - Headings & Titles: `'Space Grotesk'`
  - Telemetry, Coordinates, Badges & Controls: `'JetBrains Mono'`
  - Body & Synopses: `'Inter'`

---

## 2. Weighted 100-Point Similarity Match % Engine (`src/lib/similarity.ts`)

Every Movie and TV Show is scored relative to the active **3D Focal Centroid** (defaulting to *Inception (2010)*) using a strict 100-point weighted algorithm:

1. **Micro-Tropes & Keywords (Max 35 pts)**: `+12 pts` per shared thematic keyword/trope (e.g., *Dream Manipulation*, *Heist*, *Non-Linear Time*, *Time Loop*, *Subconscious Labyrinth*).
2. **Creative Auteur / Visionary (Max 25 pts)**: `+25 pts` for matching the Director/Showrunner; `+15 pts` for a shared Screenwriter/Creator.
3. **Broad Genres (Max 15 pts)**: `+5 pts` per shared genre; `+5 pt` bonus if primary genre matches (e.g., *Sci-Fi*).
4. **Primary Cast (Max 10 pts)**: `+6 pts` for sharing a `#1/#2` billed lead actor; `+4 pts` for sharing a top-5 supporting star.
5. **Sonic & Visual Team (Max 10 pts)**: `+6 pts` for sharing a Composer (e.g., *Hans Zimmer*); `+4 pts` for a shared Cinematographer (e.g., *Wally Pfister*, *Hoyte van Hoytema*).
6. **Audience Co-Watch Sign (Max 5 pts)**: `+5 pts` if the title appears in the source's native TMDB `/recommendations` list.

### 3D Spring Physics Formula
```
3D link distance = 180 - (matchScore * 1.2)
```
High-matching titles pull tightly into the inner gravity shell around the focal centroid, while lower-matching items orbit further out in the nebula while bridging through shared Directors, Actors, Tropes, and Composers.

---

## 3. Running Locally

```bash
npm install
npm run dev
```

Optional live API enrichment can be enabled by copying `.env.example` to `.env.local` and supplying server-only `TMDB_API_KEY`, `TMDB_READ_ACCESS_TOKEN`, and `OMDB_API_KEY`.

