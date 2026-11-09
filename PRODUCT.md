# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Cinephiles and everyday viewers deciding what to watch next. Rather than accepting opaque black-box streaming recommendations, they explore how films and television series connect through tangible shared craft—directors, screenwriters, lead and supporting cast, composers, cinematographers, and narrative tropes.

## Product Purpose

SixDegrees maps the creative lineage and thematic connections around a chosen focal film or series so viewers can discover what to watch next with transparent reasoning and immediate regional streaming availability.

## Positioning

Unlike black-box recommendation carousels, SixDegrees computes a transparent 100-point weighted similarity rubric across six explicit craft dimensions (Micro-Tropes, Creative Auteur, Broad Genres, Primary Cast, Sonic & Visual Team, and Co-Watch signals) and visualizes those relationships as an interactive 3D/2D constellation and a ranked similarity matrix.

## Operating Context

Used as an interactive discovery workspace where a viewer selects or searches for a focal film or TV show, switches between creative lens presets (Vibe & Tropes, Auteur Orbit, Star Constellation), inspects shared collaborators and tropes in a detail card, and checks where to stream, rent, or buy in their region (AU, US, UK).

## Capabilities and Constraints

- Interactive 3D and 2D spatial relationship graph alongside a structured Similarity Matrix view.
- Transparent 100-point similarity rubric with three lens presets: Vibe & Tropes, Auteur / Creator Orbit, and Star Constellation.
- Live global catalog discovery via IMDb/Wikidata graph and optional TMDB/OMDb API keys.
- Regional streaming, rental, and purchase availability for Australia (`AU`), United States (`US`), and United Kingdom (`UK`).
- Simplified workspace controls: exclude raw physics tuning sliders (Spherical Force, Link Distance, Z-Repulsion) to eliminate UI clutter and fake "cyber-telemetry" jargon.

## Brand Commitments

- **Warm Archival Celluloid & Paper palette:** Warm ivory/parchment ground, carbon ink typography, oxidised nitrate amber, and Criterion crimson accents—editorial, tactile, daylight-first.
- Anti-reference: No dark-mode AI slop (no `#0a0e14` obsidian backgrounds, neon cyan/purple glows, glassmorphic blur soup, `Sparkles` icons, or fake aerospace/telemetry jargon).

## Evidence on Hand

- Curated seed library of films and television series in `src/lib/seed-data.ts` with verified credits, ratings (IMDb, Rotten Tomatoes, Metascore), tropes, and regional streaming links.
- Live catalog query integration in `src/lib/api.ts` and `src/app/api/live-media/route.ts`.

## Product Principles

1. **Craft Over Algorithms:** Every recommendation must show the human collaborators and narrative threads that earned the match.
2. **Editorial Clarity Over Instrumentation Clutter:** Present film metadata like a curated film archive or festival catalogue, never a sci-fi telemetry console.
3. **Direct Manipulation:** Moving between a film, its shared director or composer, and the next focal title should feel effortless and immediate.
