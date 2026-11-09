# Project State

## Current Position
- **Current Phase:** `02-watch-suggestions` (Smart Watch Suggestions & Multi-Criteria Discovery)
- **Status:** Completed (`02-01-PLAN.md` and `02-02-PLAN.md` executed)
- **Last Action:** Executed Phase 2 and verified Next.js build

## Key Decisions
- **Dual-Mode Suggestion Engine (`src/lib/recommendations.ts`)**:
  1. **Watched-Seed Mode ("Because You Watched")**: Aggregates craft, narrative theme, and genre similarity across one or more user-watched titles (excluding already-watched titles by default so suggestions are genuinely un-watched discoveries) and surfaces per-item attribution (*"Because you watched Inception & Dark"*).
  2. **Genre & Category Mode ("Browse by Genre, Theme & Mood")**: Allows filtering and scoring across broad genres (`Sci-Fi`, `Thriller`, `Mystery`, `Drama`, `Crime`, `Action`, `Fantasy`, `Animation`, etc.), specific narrative tropes, curated editorial categories (*Mind-Bending Sci-Fi*, *Slow-Burn Mystery*, *Critics' Darlings RT ≥ 88%*, *Audience Favorites IMDb ≥ 8.3*, *Auteur Cinema*, *AI/Tech/Dystopia*, *Time & Memory Puzzles*), release eras, and regional streaming providers (`AU`, `US`, `UK`).
- **Design System Consistency**: Uses the established Warm Archival Folio palette (`#F6F1E7`, `#EFE8DA`, `#FBF8F2`, `#171412`, `#B8292F`, `#234B6E`, `#6B3A6E`, `#2A6B53`) and `Spectral` + `Source Sans 3` typography.
