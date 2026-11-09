---
target: the graph
total_score: 31
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/ankithravindran/Development/Antigravity/sixdegrees/src/components/SpatialViewport.tsx"
target_fingerprint: "sha256:27952288bceaad02768c83b5da36c9e943e2d4b062cfe824902f70e4e68fdfdd"
target_path: /Users/ankithravindran/Development/Antigravity/sixdegrees/src/components/SpatialViewport.tsx
timestamp: 2026-11-09T20-23-11Z
slug: src-components-spatialviewport-tsx
---
Method: dual-agent (A: 5d237261-3cb3-47ec-a1eb-e70c13e198dc · B: 74d1d831-477d-4fb0-832d-41516e4d76b7)

## Design Health Score

| # | Heuristic | Score | Key Issue / Evidence |
|---|---|---|---|
| 1 | Visibility of System Status | 4 / 4 | Clear scope pill (`L3129–3159`), active hover/isolation pill (`L3457–3504`), and Linked Constellation Panel (`L3234–3310`) report active scope, isolated subgraph count, and match percentages. |
| 2 | Match Between System and the Real World | 3 / 4 | Tactile archival shapes (`Film Reel`, `TV Set`, `Clapperboard` at `L3666–3697`) and human labels (`Director / Writer`, `Score & Camera` at `L87–102`); minor internal physics prop remnants in component state (`L2161–2222`). |
| 3 | User Control and Freedom | 3 / 4 | Strong exit paths (`Esc`, `Reset Everything`, close `X`), but **four competing reset/close triggers** appear simultaneously when a node is selected (`L3205`, `L3279`, `L3437`, `L3486`). |
| 4 | Consistency and Standards | 3 / 4 | Cohesive daylight vellum palette (`#FBF8F2`), Criterion crimson (`#B8292F`), and Prussian blue (`#234B6E`) across 2D Canvas and DOM; however, `L3316` and `L3393` use `text-[10px] font-bold uppercase tracking-wider` section headers that violate `DESIGN.md`'s Heading-First / no-uppercase-kicker rule. |
| 5 | Error Prevention | 3 / 4 | SVG data-URI fallback (`getPosterFallbackDataUri` at `L3529–3536`) prevents broken posters, but clicking any node immediately hides all unconnected nodes (`grp.visible = isInIsolatedSubgraph` at `L2329`), collapsing the constellation when a user may only want to inspect a title. |
| 6 | Recognition Rather Than Recall | 3 / 4 | Stamped 2D medallions with vellum caption plates (`L3018–3080`) keep titles and category glyphs legible over links, but the bottom-left `Node Key` (`L3662`) is `hidden xl:flex`, leaving `<1280px` viewports without a symbol legend. |
| 7 | Flexibility and Efficiency of Use | 3 / 4 | Supports click-to-isolate, double-click to center (`L3228`), hover subgraph preview (`L2279–2298`), and cross-highlighted pivoting inside the Linked Constellation Panel (`L3323–3379`), but lacks keyboard node traversal on the canvas. |
| 8 | Aesthetic and Minimalist Design | 3 / 4 | Distinctive warm archival aesthetic on the canvas, but selecting a node stacks four simultaneous HUD banners/panels across the top-left and top-center (`L3127–3504`), occluding ~35% of the stage. |
| 9 | Help Users Recognize, Diagnose, and Recover from Errors | 4 / 4 | Graceful empty state for unlinked nodes (`"No directly linked titles above the current threshold."` at `L3384–3386`) and automatic SVG poster fallback. |
| 10 | Help and Documentation | 2 / 4 | The instructional banner (`L3222–3230`) packs three interaction hints into a single dense `11px` line, while the `Node Key` legend (`L3662`) disappears below `1280px` (`xl`). |
| **Total** | | **31 / 40** | **Good — solid foundation with targeted areas to address** |

### Design Specificity Verdict
- **LLM assessment**: **Genuinely designed system with residual AI over-scaffolding in the HUD layer.** The 2D/3D canvas rendering—uncoated vellum paper (`#FBF8F2`), Criterion crimson (`#B8292F`), Prussian film blue (`#234B6E`), `Spectral` literary serif captions, and multi-ring stamped 2D medallions with cardinal ticks (`L2966–3080`)—feels purposefully crafted for a repertory cinema archive. However, the DOM overlay chrome (`L3126–3504`) exhibits classic LLM "belt-and-suspenders" duplication: clicking a node triggers three separate banners/panels announcing `"Isolated Subgraph"` and four separate buttons offering `"Reset Everything"` / `"Reset View"`.
- **Deterministic scan**: `0` occurrences across `0` anti-pattern types (`impeccable detect --json src/components/SpatialViewport.tsx` returned `[]`).
- **Visual overlays**: Fallback signal — live browser overlay injection was skipped because no browser automation tool is exposed in this session's toolset; layout and spatial overlap analysis were verified directly against the container/DOM coordinate math in `src/components/SpatialViewport.tsx`.

---

## Overall Impression

`SpatialViewport` delivers a tactile, daylight-first archival map where stamped 2D medallions, vellum caption plates, and 3D category models (`Film Reel`, `TV Set`, `Clapperboard`) strongly reinforce the Criterion/MUBI curatorial tone. However, the moment a user selects a node, the viewport suffers from **HUD overlay congestion and redundant reset chrome**—spawning a top-left status pill change, a top-left Reset button, an instructional sub-banner, a `320px` left floating drawer (with both a close `X` and a full-width footer Reset button), and a top-center floating pill (with yet another Reset button), all competing alongside the application's `LeftSidebar` and `RightInspectorCard`.

---

## What's Working

1. **Stamped Archival Medallions & Vellum Caption Plates in 2D (`L2966–3080`):** Rather than generic force-graph circles with overlapping text, each 2D node renders a directional warm paper shadow, outer semantic pigment bezel, `#FBF8F2` vellum core, cardinal ticks for primary media (`L2996–3015`), and a rounded vellum caption plate (`L3047–3079`) that prevents graph edges from slicing through `Spectral` typography.
2. **Two-Tier Subgraph Illumination (`computeLinkedSubgraph` at `L108–150` & `L2279–2298`):** Hovering or selecting a node cleanly distinguishes direct 1st-degree links from shared-entity bridge links and smoothly scales/pulses beacon rings (`L2356–2376`), making multi-hop craft connections (e.g., two films linked via a shared cinematographer or trope) immediately legible in space.
3. **Cross-Highlighted Pivot Drawer (`L3321–3432`):** Hovering items inside the `Linked Constellation Panel` cross-highlights the corresponding 3D/2D node on the canvas (`onMouseEnter` setting `hoveredIdRef.current` at `L3330–3337`), and clicking smoothly re-centers the camera (`frameNodeAndLinkedCluster` at `L3328`).

---

## Priority Issues

### 1. `[P1]` Severe HUD Overlay Duplication & Four Competing "Reset" Controls on Node Selection
- **What**: Selecting a node simultaneously triggers:
  1. Top-left context pill changing to `"Isolated Subgraph: [Title] (N nodes shown)"` (`L3140–3153`) + a crimson `"Reset Everything"` button beside it (`L3204–3220`).
  2. Top-left instructional banner repeating `"Showing only interconnected nodes..."` (`L3222–3230`).
  3. Left floating `w-80` panel (`L3234–3454`) with `"Isolated Subgraph"` badge, header close `X` (`L3279`), and a full-width crimson footer `"Reset Everything · Show Full Graph"` button (`L3437–3451`).
  4. Top-center floating pill (`L3457–3504`) repeating `"Isolated Connected View: [Title] Showing only N interconnected nodes"` + a third crimson `"Reset View (Esc)"` button (`L3486–3502`).
- **Why it matters**: Roughly 35% of the spatial canvas is occluded by overlapping vellum/crimson boxes repeating the same state, while also competing with the `RightInspectorCard` that opens on media selection.
- **Fix**: Consolidate isolated-view status and a single `Reset (Esc)` action into one canonical surface: reserve the top-center pill (`L3457–3504`) strictly for *hover* previews (`hoveredNode && !selectedNode`), remove the duplicate top-left Reset button and instruction strip when the `Linked Constellation Panel` is open, and keep a single clear exit control.
- **Suggested command**: `/impeccable simplify`

### 2. `[P1]` Canvas-Only Keyboard & Screen Reader Inaccessibility
- **What**: Both the 3D WebGL mount `div` (`L3110–3114`) and the 2D `<canvas>` (`L3119–3123`) lack `tabIndex`, `role`, `aria-label`, and keyboard focus/navigation handlers prior to a node already being selected.
- **Why it matters**: Keyboard-only and assistive-technology users cannot enter the graph, select an initial node, or traverse connections without a pointer device.
- **Fix**: Add accessible semantics (`role="region"`, `aria-label`) and keyboard navigation (e.g., Tab/Arrow cycling across primary media nodes or an accessible keyboard quick-jump / node list synchronized with `onSelectNode` and `frameNodeAndLinkedCluster`).
- **Suggested command**: `/impeccable harden`

### 3. `[P2]` 2D Mode Hover Tooltip Clamping Reads Unmounted 3D Container Ref
- **What**: In the floating hover tooltip (`L3511–3518`), horizontal and vertical clamping reads `containerRef.current?.clientWidth || 900` and `containerRef.current?.clientHeight || 700`. However, `containerRef` is attached to the 3D WebGL `div` (`L3111`), which is conditionally unmounted when `viewMode === '2D'` (`L3109`).
- **Why it matters**: In 2D Map mode on viewports wider than `900px` (or taller than `700px`), `containerRef.current` is `null`, causing the hover tooltip to clamp prematurely at `x = 564px` / `y = 440px` and jump away from the cursor on the right and bottom halves of the screen.
- **Fix**: Measure the outer parent wrapper `div` (or `canvas2DRef.current` when `viewMode === '2D'`) so tooltip boundary clamping uses the live viewport dimensions in both 3D and 2D modes.
- **Suggested command**: `/impeccable harden`

### 4. `[P2]` Uppercase Kicker Subheaders & Micro-Typography Below `DESIGN.md` Floor
- **What**: Inside the Linked Constellation Panel, section headers use `text-[10px] font-bold uppercase tracking-wider text-[#52483E]` (`L3316`, `L3393`), match/reason badges use `text-[10px]` (`L3357`, `L3367`, `L3373`, `L3425`), and 2D canvas relationship tags use `9.5px` (`L3071`).
- **Why it matters**: `DESIGN.md` explicitly mandates `Spectral` semantic headings (`Title: 14px–16px`), sets `Label: 11px–12px` as the minimum badge/pill floor, and forbids uppercase kickers (`The Heading-First Rule`).
- **Fix**: Replace the `10px` uppercase section headers at `L3316` and `L3393` with `Spectral` `h4` headings (`font-heading text-xs font-bold text-[#171412]`) and bump `10px` pills/tags to the `11px` (`text-[11px]`) floor.
- **Suggested command**: `/impeccable typeset`

### 5. `[P2]` `Node Key` Legend Hidden on All Sub-`xl` (`<1280px`) Viewports
- **What**: The bottom-left `Node Key` (`L3662`) uses `hidden xl:flex`, completely hiding the legend mapping 3D/2D shapes (`Film Reel`, `TV Set`, `Clapperboard`, `5-Point Star`) to entity categories on screens narrower than `1280px`.
- **Why it matters**: Users on 13" laptops or split-screen browser windows cannot decode the 6 node shapes and semantic pigments without guessing.
- **Fix**: Make the `Node Key` accessible on `md`/`lg` viewports via a compact collapsible `"Node Key"` pill in the bottom-left corner (or integrated into the bottom camera dock).
- **Suggested command**: `/impeccable clarify`

---

## Persona Red Flags

- **Alex (Impatient Power User)**: Clicking any movie node to inspect its monograph in the Right Inspector *also* opens a second `w-80` floating panel on the left (`L3235`) AND hides all unconnected nodes (`L2329`), requiring an extra `Reset` action just to scan the rest of the constellation. In 2D mode, hovering nodes on the right half of a wide monitor snaps the tooltip back to `564px` (`L3512`).
- **Jordan (Confused First-Timer)**: Clicking a single node spawns three crimson `"Reset"` buttons (`L3215`, `L3447`, `L3496`) and two side panels (`Linked Constellation Panel` on the left and `RightInspectorCard` on the right), making it unclear which panel is primary or which reset button to click.
- **Sam (Accessibility-Dependent User)**: Blocked from focusing or navigating the 3D/2D graph canvas via keyboard (`L3110–3124`), and strained by `10px` uppercase headers (`L3316`, `L3393`) and `9.5px` canvas tags (`L3071`).
- **Claire (Repertory Programmer / Cinephile Researcher — `PRODUCT.md` Persona)**: Appreciates the Criterion-inspired palette and transparent shared-credit breakdown chips (`Director:`, `Theme:`, `+points` at `L3649–3652`), but finds that hovering nodes on the left third of the viewport causes the `w-80` cursor tooltip (`L3509`) to visually collide with the `w-80` persistent `Linked Constellation Panel` (`L3237`).

---

## Minor Observations

- **Redundant ternary branch (`L3134–3136`)**: `graphScope !== 'FULL_ARCHIVE' ? 'bg-[#2A6B53]' : 'bg-[#2A6B53]'` returns the exact same hex value in both branches.
- **Non-standard Tailwind utility (`L3357`, `L3367`)**: `py-0.2` is not a valid Tailwind spacing utility (silently ignored; likely intended `py-0.5`).
- **Physics props coupled in component signature (`L38–40`, `L2161–2222`)**: `sphericalForce`, `linkDistanceMultiplier`, and `zRepulsion` remain wired through `SpatialViewportProps` even though `PRODUCT.md` specifies zero visible physics/graph-math controls.

---

## Questions to Consider

- When a user clicks a **Film/TV** node, `RightInspectorCard` already opens on the right with full monograph details and closest matches. Should the left-side `Linked Constellation Panel` (`L3234`) only auto-open when selecting a **Collaborator / Theme** bridge node (or be toggleable), so selecting a film doesn't sandwich the viewport between two `320px`+ panels?
- Should clicking a node *dim* unconnected nodes (similar to hover, preserving spatial context) with an explicit `"Isolate Subgraph"` toggle, or should hard-hiding unconnected nodes (`L2329`) remain the default click behavior?
