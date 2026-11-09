# SixDegrees — Brand & Logo Usage Guidelines

## 1. The Mark ("The Criterion 6°")
- **Concept**: An eccentric-crescent numeral **6** whose lower bowl cradles a **6-sided hexagonal camera aperture** and focal nucleus, paired with an orbital degree ring (**`°`**) in the upper-right bay.
- **Master Versions (`public/brand/`)**:
  - **Primary Symbol**: `sixdegrees-symbol.svg` (`256×256` two-tone Monograph Ink + Archival Crimson)
  - **Small-Size Symbol (`16–24 px`)**: `sixdegrees-symbol-small.svg` (enlarged hexagonal counter, solid degree orb)
  - **Reversed Symbol (Dark/Crimson surfaces)**: `sixdegrees-symbol-reversed.svg` (optically thinned in Warm Vellum `#FBF8F2`)
  - **Horizontal Lockup**: `sixdegrees-horizontal.svg` (`980×256`, symbol + custom geometric outlined wordmark `SIXDEGREES°`)
  - **Horizontal Lockup (Dark)**: `sixdegrees-horizontal-dark.svg` (`980×256`, Warm Vellum + Archival Crimson)
  - **Stacked Lockup**: `sixdegrees-stacked.svg` (`760×400`)
  - **Wordmark-Only**: `sixdegrees-wordmark.svg` (`726×140`)
  - **One-Colour Variants**: `*-black.svg`, `*-white.svg`, `*-mono-b8292f.svg`, `*-mono-171412.svg`
  - **Presentation Board**: `presentation-board.html` (5 slides with 6 interactive mockups)

## 2. Clear Space
Maintain a minimum clear zone of **1 × `D`** on all sides of the mark, where **`D`** is the outer diameter of the orbital degree ring (`40 units` on the `256×256` symbol canvas, or `50%` of the wordmark cap height in lockups). Never place typography, borders, or UI controls inside this zone.

## 3. Minimum Size
| Version | Screen Minimum | Print Minimum | Notes |
|---|---|---|---|
| **Horizontal Lockup** | `110 px` wide | `28 mm` wide | Below `110 px`, switch to the standalone Symbol |
| **Stacked Lockup** | `88 px` wide | `22 mm` wide | Ideal for square cards, monograph covers, and badges |
| **Standard Symbol** | `28 px` | `7 mm` | Includes inner focal core and hollow degree ring |
| **Small-Size Cut (`-small` / `-favicon`)** | `16 px` | `4 mm` | Use for browser favicons (`16–24 px`) and compact badges |

## 4. Brand Colour Palette
| Role | Name | HEX | RGB | CMYK | Pantone | Contrast vs. Vellum |
|---|---|---|---|---|---|---|
| **Primary Accent** | **Archival Crimson** | `#B8292F` | `184, 41, 47` | `15, 92, 82, 6` | `1805 C` | `6.1 : 1` (AA) |
| **Spine Border / Hover** | **Deep Crimson** | `#8C1D22` | `140, 29, 34` | `24, 95, 86, 20` | `1815 C` | `8.7 : 1` (AAA) |
| **Primary Ink** | **Monograph Ink** | `#171412` | `23, 20, 18` | `68, 67, 68, 82` | `Black 7 C` | `17.2 : 1` (AAA) |
| **Primary Surface** | **Warm Vellum** | `#FBF8F2` | `251, 248, 242` | `0, 1, 4, 0` | `Warm Gray 1 C` | — |
| **Canvas Surface** | **Archival Parchment** | `#F6F1E7` | `246, 241, 231` | `2, 4, 8, 0` | `7527 C` | — |

### Approved Surface Pairings
- **Light Editorial Surfaces (`#FBF8F2`, `#F6F1E7`, `#EFE8DA`)**: Two-tone full-colour master (`#171412` + `#B8292F`), or monochrome `#171412` / `#B8292F`.
- **Archival Crimson Spine Stamp (`#B8292F`)**: Reversed Warm Vellum (`#FBF8F2`) using `sixdegrees-symbol-reversed.svg`.
- **Dark / Cinema Mode (`#171412`)**: `sixdegrees-horizontal-dark.svg` (Warm Vellum `#FBF8F2` letterforms + Archival Crimson `#B8292F` focal core & degree rings).

## 5. Typography
- **Wordmark**: Custom geometric vector construction (`SIXDEGREES°`) built on an `80-unit` cap-height grid with `15–16 unit` stems and exact `60°` diagonals (`X`, `R`). Always use the outlined SVG master—never re-type the wordmark in a system font.
- **Editorial Headings**: `Spectral` (500 Medium, 600 SemiBold, 700 Bold; `-0.015em` tracking).
- **UI & Tabular Data**: `Source Sans 3` (`font-variant-numeric: tabular-nums`).

## 6. Misuse (Don'ts)
- Do not stretch, skew, or alter the `60°` / eccentric-circle proportions.
- Do not use the full-detail symbol below `24 px` without switching to `sixdegrees-symbol-small.svg` (or `favicon.svg`).
- Do not add drop shadows, neon glows, or raster gradients to the mark.
- Do not invert the two-tone hierarchy (the `6` body is always Ink/Vellum; the focal core and degree ring carry the Crimson accent).
