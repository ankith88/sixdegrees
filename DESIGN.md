---
name: SixDegrees
description: Interactive film and television lineage archive and spatial repertory catalogue.
colors:
  criterion-crimson: "#B8292F"
  crimson-deep: "#8C1D22"
  crimson-tint: "#F5E4E4"
  prussian-blue: "#234B6E"
  plum-archive: "#6B3A6E"
  nitrate-ochre: "#B86B14"
  verdigris-teal: "#2A6B53"
  verdigris-tint: "#E3EFEA"
  terracotta-rust: "#A63A2B"
  archival-paper: "#F6F1E7"
  archival-card: "#EFE8DA"
  archival-vellum: "#FBF8F2"
  archival-well: "#E5DEC9"
  carbon-ink: "#171412"
  warm-umber: "#52483E"
  stone-muted: "#6B5E50"
  rule-hairline: "#D5CCB9"
  rule-strong: "#B5A892"
typography:
  display:
    fontFamily: "Spectral, Georgia, Cambria, Times New Roman, serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Spectral, Georgia, Cambria, Times New Roman, serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Spectral, Georgia, Cambria, Times New Roman, serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Source Sans 3, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
  subhead:
    fontFamily: "Source Sans 3, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontFamily: "Source Sans 3, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.35
  caption:
    fontFamily: "Source Sans 3, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.35
  micro:
    fontFamily: "Source Sans 3, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  sm: "2px"
  md: "4px"
  lg: "8px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.criterion-crimson}"
    textColor: "{colors.archival-vellum}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  button-primary-hover:
    backgroundColor: "{colors.crimson-deep}"
    textColor: "{colors.archival-vellum}"
  button-secondary:
    backgroundColor: "{colors.archival-card}"
    textColor: "{colors.carbon-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  button-secondary-hover:
    backgroundColor: "{colors.archival-well}"
    textColor: "{colors.carbon-ink}"
  card-monograph:
    backgroundColor: "{colors.archival-vellum}"
    textColor: "{colors.carbon-ink}"
    rounded: "{rounded.lg}"
    padding: "16px 20px"
  input-search:
    backgroundColor: "{colors.archival-vellum}"
    textColor: "{colors.carbon-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  hud-pill:
    backgroundColor: "{colors.archival-vellum}"
    textColor: "{colors.carbon-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "6px 10px"
---

# Design System: SixDegrees

## Overview

**Creative North Star: "The Repertory Film Monograph & Archival Folio"**

SixDegrees treats cinema and television discovery as a tactile, sunlit archival experience rather than a sci-fi telemetry console. Inspired by Criterion Collection booklet essays, BFI Sight & Sound indices, and Cinematheque festival programmes, the interface pairs an interactive 3D/2D constellation with editorial programme notes on warm, uncoated cotton paper stock.

Every surface favors human curatorial language ("Centered on", "Shared Credits & Themes", "Director & Craft", "Where to Watch") over synthetic algorithmic jargon. Posters, collaborator credits, and proportional 6-part craft bars sit inside crisp 1px engraved stone hairlines, allowing film artwork and literary typography to carry the visual weight.

**Key Characteristics:**
- Daylight-first Warm Archival Celluloid & Paper palette grounded in uncoated ivory stock, card stock, and museum vellum.
- Literary serif display typography (`Spectral`) paired with humanist sans-serif body and tabular numerals (`Source Sans 3`).
- Semantic archival pigment coding across all 6 graph entity types (Prussian blue, archive plum, Criterion crimson, nitrate ochre, verdigris teal, and terracotta rust).
- Zero nested cards, zero kickers/eyebrows above headings, zero neon glow halos, and zero monospace costume typography.

## Colors

The palette draws from archival paper stocks, carbon-sepia letterpress ink, and natural mineral pigments used across both the DOM chrome and the 3D WebGL / 2D Canvas constellation.

### Primary
- **Criterion Spine Crimson** (`#B8292F`): Focal title badges, primary action buttons, active curatorial lens indicators, and Director/Writer nodes.
- **Deep Oxblood Ink** (`#8C1D22`): Hover state for primary crimson buttons and high-contrast critical percentage readouts.
- **Crimson Stamp Wash** (`#F5E4E4`): Subtle background tint for selected view tabs, active focal badges, and selected collaborator pills.

### Secondary
- **Prussian Film Blue** (`#234B6E`): Feature film nodes in the 3D/2D constellation, film format badges, and genre kinship segments.
- **Archive Plum** (`#6B3A6E`): Television series nodes, series format badges, and audience pairing accents.

### Tertiary
- **Verdigris Match Teal** (`#2A6B53`): High-affinity match badges (`75%+`), active live connection indicators, and narrative theme/motif nodes.
- **Verdigris Wash** (`#E3EFEA`): Background fill for match percentage pills and active gentle-spin toggles.
- **Nitrate Ochre** (`#B86B14`): Principal and supporting cast nodes and shared actor credit segments.
- **Terracotta Rust** (`#A63A2B`): Original score composer and cinematographer nodes and craft segments.

### Neutral
- **Warm Ivory Paper** (`#F6F1E7`): Primary application background and 3D WebGL / 2D Canvas atmospheric ground.
- **Archival Card Stock** (`#EFE8DA`): Left curatorial filter rail, header bar, and secondary button fills.
- **Warm Museum Vellum** (`#FBF8F2`): Elevated monograph inspector sheet, floating hover tooltips, search popover, and camera dock.
- **Recessed Paper Well** (`#E5DEC9`): Segmented control tracks and subtle hover wells.
- **Carbon-Sepia Ink** (`#171412`): Primary heading and body copy.
- **Warm Umber** (`#52483E`): Secondary metadata, director/year subtitles, and synopsis prose.
- **Muted Stone** (`#6B5E50`): Tertiary captions, slider scale markers, and inactive states.
- **Engraved Hairline** (`#D5CCB9`): Standard 1px section dividers and table rules.
- **Pressed Card Border** (`#B5A892`): Outer borders on floating vellum sheets, tooltips, and dialogs.

### Named Rules
**The Sunlight Paper Rule.** Never introduce `#0a0e14` obsidian dark backgrounds, neon cyan (`#38bdf8`), or neon purple (`#c084fc`) anywhere in the DOM, SVG fallbacks, or WebGL canvas.
**The Semantic Pigment Rule.** Every graph entity color must map consistently across the 3D constellation, 2D map, sidebar legend, and 6-part Craft Lineage Bar.

## Typography

**Display Font:** `Spectral` (with `Georgia, Cambria, "Times New Roman", serif` fallback)
**Body Font:** `Source Sans 3` (with `-apple-system, BlinkMacSystemFont, sans-serif` fallback)
**Numeric Alignment:** `Source Sans 3` with `font-variant-numeric: tabular-nums` (`.font-tabular`)

**Character:** `Spectral` brings bookish authority and editorial warmth to film titles and section headings, while `Source Sans 3` keeps dense filmographic tables, ratings, and filter controls crisp and scannable at small sizes.

### Hierarchy
- **Display** (`700`, `1.875rem` / `30px`, `line-height: 1.15`): Main header in the Critical Lineage Ledger (`SimilarityMatrixView`).
- **Headline** (`700`, `1.25rem` / `20px`, `line-height: 1.2`): Inspected film or series title (`h1`) in the Right Monograph Inspector.
- **Title** (`700`, `0.875rem–1rem` / `14px–16px`, `line-height: 1.3`): Sidebar section headings (`Format`, `Curatorial Lens`, `Minimum Match`, `Visible Threads`), tooltip titles, and ledger row titles.
- **Body** (`400`, `0.875rem` / `14px`, `line-height: 1.55`): Film synopses (capped at `65ch`), curatorial descriptions, and search input text.
- **Label** (`600`, `0.6875rem–0.75rem` / `11px–12px`, `line-height: 1.35`): Tabular ratings, year/runtime metadata, streaming provider badges, and filter pills.

### Named Rules
**The Heading-First Rule.** Never stack an uppercase kicker or eyebrow label above a heading (`h1`, `h2`, `h3`, `h4`). Headings lead their block; badges or format tags sit inline beside the heading or below it.
**The No-Monospace-Costume Rule.** Numeric ratings, years, and match percentages use `Source Sans 3` with `tabular-nums` (`.font-tabular`), never a monospace coding font.

## Layout

SixDegrees uses a fixed-viewport studio workbench layout (`100vw` by `100vh`, `overflow-hidden`) divided into four coordinated zones:
1. **Top Archival Header (`TopNavBar`, `56px` / `h-14`):** Houses the Criterion-style crimson spine mark, catalog search input (`max-w-xl`), view switcher (`3D Constellation`, `2D Map`, `Critical Ledger`), and regional catalog controls (`AU`, `US`, `UK`).
2. **Left Curatorial Rail (`LeftSidebar`, `268px` wide on `lg+`):** Organizes `Constellation Scope`, `Format`, `Curatorial Lens`, `Minimum Match`, and `Visible Threads` using `20px` (`py-5`) vertical rhythm and `1px solid #D5CCB9` hairline dividers.
3. **Central Spatial Stage (`SpatialViewport` / `SimilarityMatrixView`, `flex-1`):** Full-bleed interactive 3D WebGL constellation or 2D canvas map with floating vellum context pill (top-left) and camera dock (bottom-center), or the scrollable `max-w-6xl` Critical Lineage Ledger.
4. **Right Monograph Inspector (`RightInspectorCard`, `360px` on `md`, `396px` on `xl`):** Collapsible vellum folio sheet displaying either the full collection index or the selected title's monograph, ratings ledger, 6-part craft bar, streaming availability, and closest matches.

## Elevation & Depth

Depth is achieved through warm tonal paper layering (`#F6F1E7` ivory canvas → `#EFE8DA` card stock rail → `#FBF8F2` vellum sheet) paired with soft, directional ink-tinted offset shadows on floating overlays.

### Shadow Vocabulary
- **Archival Sheet Elevation** (`box-shadow: 0 12px 32px rgba(23, 20, 18, 0.12), 0 2px 6px rgba(23, 20, 18, 0.06)`): Used on floating vellum overlays (`RightInspectorCard`, search popover, hover tooltip, camera dock, and API keys modal).
- **Archival Pill Elevation** (`box-shadow: 0 2px 8px rgba(23, 20, 18, 0.07), 0 1px 2px rgba(23, 20, 18, 0.05)`): Used on active segmented tabs and the top-left context pill.

### Named Rules
**The Zero-Blur-Soup Rule.** Never use `backdrop-blur` glassmorphism or zero-offset neon `box-shadow` glows. Floating elements rely on opaque or `95%` warm vellum (`#FBF8F2`) with a crisp `1px solid #B5A892` border and directional shadow.

## Shapes

Corners are tailored to the physical metaphor of printed stock and archival stamps:
- **Poster Thumbnails & Spine Marks (`2px` / `rounded-sm`):** Crisp, near-square bookplate corners with a `1px solid #C8BEAA` frame.
- **Buttons, Inputs & Filter Pills (`4px` / `rounded`):** Subtle tactile rounding that feels like die-cut index tabs.
- **Floating Vellum Overlays & Modals (`8px` / `rounded-lg`):** Monograph cards, hover tooltips, and dialogs.
- **Camera Dock (`9999px` / `rounded-full`):** Compact pill housing at the bottom center of the spatial viewport.

## Components

### Buttons
- **Shape:** Subtle index-tab corners (`4px` radius).
- **Primary:** Criterion crimson background (`#B8292F`), warm vellum text (`#FBF8F2`), `8px 12px` padding, transitioning to deep oxblood (`#8C1D22`) on hover.
- **Secondary:** Archival card stock (`#EFE8DA`) with `1px solid #C8BEAA` border and carbon-sepia ink (`#171412`), shifting to recessed paper well (`#E5DEC9`) on hover.
- **Focus:** `2px solid #B8292F` outline with `2px` offset.

### Chips & Credit Tags
- **Style:** Archival card fill (`#EFE8DA`) or vellum fill (`#FBF8F2`) with `1px solid #C8BEAA` border, `11px` `Source Sans 3` label text, and semantic pigment prefix (`Theme:`, `Director:`, `Starring:`).
- **State:** Hovering shifts border to `#8F816B` and background to `#E5DEC9`; clicking a collaborator or theme chip highlights its connected titles in the graph.

### Monograph Inspector & Ledger Rows
- **Corner Style:** `8px` radius on floating sheets; flat `0px` hairline-divided rows inside panels.
- **Background:** Warm museum vellum (`#FBF8F2`) for the inspector sheet; `#FBF8F2` alternating with `#EFE8DA` hover states in ledger tables.
- **Border:** `1px solid #D5CCB9` between sections; `1px solid #B5A892` outer frame on floating overlays.
- **Internal Padding:** `16px` (`p-4`) to `20px` (`p-5`).

### Inputs / Search Field
- **Style:** Warm vellum background (`#FBF8F2`), `1px solid #C8BEAA` border, `4px` radius, `14px` `Source Sans 3` text with `#6B5E50` placeholder.
- **Focus:** Border shifts to `#B8292F` with `box-shadow: 0 0 0 2px rgba(184, 41, 47, 0.14)`.

### Navigation (`TopNavBar`)
- **Style:** Fixed `56px` bar in `#EFE8DA` with a `1px solid #D5CCB9` bottom rule. View mode tabs sit inside a recessed `#E5DEC9` well; the active tab lifts onto `#FBF8F2` with a `#B5A892` border and `.shadow-archival-sm`.

### Proportional 6-Part Craft Lineage Bar
- **Description:** A signature horizontal `8px`-tall segmented bar (`bg-[#E5DEC9]`, `border-[#C8BEAA]`) that breaks down any title's 100-point similarity score into six proportional pigment segments: Themes (`#2A6B53`), Director/Writer (`#B8292F`), Genre (`#234B6E`), Cast (`#B86B14`), Score/Camera (`#A63A2B`), and Paired Viewers (`#6B3A6E`), followed by an inline tabular legend.

### Viewport Projection & Color HUD Pill
- **Shape:** Pill silhouette (`9999px` / `rounded-full`).
- **Style:** Semi-translucent warm vellum (`#FBF8F2`/`95%`) with `1px solid #B5A892` border and directional ink shadow in light mode; obsidian glass (`#0E1524`/`90%`) with `1px solid white/10` in dark mode.
- **Organization:** Three distinct segmented zones separated by hairline dividers: Spatial Projection (`Constellation` / `Galaxy` + `Territories`), Node Color Scheme (`Cluster` / `Genre` / `Decade` / `Type`), and Label Density (`Labels: Auto / All / Off`).

## Do's and Don'ts

### Do:
- **Do** lead every card, drawer, tooltip, and ledger header directly with its semantic heading (`h1`–`h4`) in `Spectral` serif.
- **Do** use `1px solid #D5CCB9` hairline dividers (`divide-y`) and definition lists (`dl`) to organize metadata inside panels instead of nesting bordered cards inside cards.
- **Do** use warm human curatorial language ("Centered on", "Curatorial Lens", "Minimum Match", "Visible Threads", "Where to Watch").
- **Do** apply `.font-tabular` (`font-variant-numeric: tabular-nums`) to all ratings, years, point breakdowns, and match percentages.

### Don't:
- **Don't** place uppercase kickers or eyebrow labels above headings.
- **Don't** use dark-mode cyber-telemetry colors (`#0a0e14`, `#38bdf8`, `#c084fc`), neon glow shadows, or `Sparkles` icons.
- **Don't** expose raw physics engine sliders (`sphericalForce`, `linkDistanceMultiplier`, `zRepulsion`) or math formulas in the UI.
- **Don't** use emoji (`★`, `🍅`) as rating icons; use clean typographic labels (`IMDb`, `Critics`, `Metacritic`) with tabular numerals.
