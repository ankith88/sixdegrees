import {
  BecauseYouWatchedEntry,
  CuratedCategoryId,
  MediaItem,
  RegionCode,
  SuggestionFilterState,
  SuggestionReason,
  WatchSuggestion,
} from './types';
import {
  calculateSimilarity,
  ENTITY_COLORS,
  isSpecificNarrativeTrope,
  isValidPersonName,
  toEntityNodeId,
} from './similarity';

export interface CuratedCategoryDefinition {
  id: CuratedCategoryId;
  title: string;
  subtitle: string;
  badge: string;
  accentColor: string;
}

export const CURATED_CATEGORIES: CuratedCategoryDefinition[] = [
  {
    id: 'ALL',
    title: 'All Categories',
    subtitle: 'Full multi-criteria suggestions across every genre & theme',
    badge: 'All',
    accentColor: '#171412',
  },
  {
    id: 'MIND_BENDING',
    title: 'Mind-Bending Sci-Fi',
    subtitle: 'Simulated realities, non-linear puzzles & speculative worlds',
    badge: 'Sci-Fi Puzzle',
    accentColor: '#234B6E',
  },
  {
    id: 'CRITICS_DARLINGS',
    title: "Critics' Darlings",
    subtitle: 'Universal critical acclaim (88%+ Rotten Tomatoes or 80+ Metascore)',
    badge: 'RT 88%+',
    accentColor: '#B8292F',
  },
  {
    id: 'HIGH_AUDIENCE',
    title: 'Audience Favorites',
    subtitle: 'Highest-rated crowd-pleasers & beloved modern classics (IMDb 8.3+)',
    badge: 'IMDb 8.3+',
    accentColor: '#B86B14',
  },
  {
    id: 'SLOW_BURN_SERIES',
    title: 'Prestige Mystery Series',
    subtitle: 'Addictive multi-season & limited television mysteries',
    badge: 'TV Series',
    accentColor: '#6B3A6E',
  },
  {
    id: 'FAST_PACED_THRILLERS',
    title: 'High-Tension Thrillers',
    subtitle: 'Heists, neo-noir investigations & psychological labyrinths',
    badge: 'Thriller',
    accentColor: '#8C1D22',
  },
  {
    id: 'AUTEUR_MASTERWORKS',
    title: 'Auteur Masterworks',
    subtitle: 'Signature director-driven cinema with iconic visual & sonic craft',
    badge: 'Auteur',
    accentColor: '#A63A2B',
  },
  {
    id: 'CYBERPUNK_AI',
    title: 'AI, Tech & Dystopia',
    subtitle: 'Synthetic consciousness, surveillance states & cyber-thrillers',
    badge: 'Cyber / AI',
    accentColor: '#2A6B53',
  },
  {
    id: 'TIME_AND_MEMORY',
    title: 'Time & Memory Puzzles',
    subtitle: 'Time loops, temporal paradoxes, amnesia & fractured minds',
    badge: 'Temporal',
    accentColor: '#234B6E',
  },
];

export const DEFAULT_SUGGESTION_FILTERS: SuggestionFilterState = {
  seedMediaIds: [],
  selectedGenres: [],
  selectedTropes: [],
  selectedCollaborator: null,
  curatedCategory: 'ALL',
  mediaFilter: 'ALL',
  decadeFilter: 'ALL',
  minImdbRating: 0,
  streamingOnlyInRegion: false,
  selectedProvider: null,
  hideWatched: true,
  preset: 'VIBE_TROPES',
};

/**
 * Standard canonical genre names so "Science Fiction" and "Sci-Fi" unify cleanly
 */
export function normalizeGenreName(raw: string): string {
  const clean = raw.trim();
  const lower = clean.toLowerCase();
  if (
    lower === 'science fiction' ||
    lower === 'sci-fi' ||
    lower === 'sci-fi & fantasy'
  ) {
    return 'Sci-Fi';
  }
  if (lower === 'action & adventure') {
    return 'Action';
  }
  if (lower === 'mystery & thriller') {
    return 'Mystery';
  }
  return clean;
}

export function getMediaGenres(item: MediaItem): string[] {
  const set = new Set<string>();
  if (item.primaryGenre) {
    set.add(normalizeGenreName(item.primaryGenre));
  }
  for (const g of item.genres) {
    if (g && g.trim()) {
      set.add(normalizeGenreName(g));
    }
  }
  return Array.from(set);
}

/**
 * Evaluates whether a MediaItem belongs to a CuratedCategoryId and returns a descriptive label if matched
 */
export function matchesCuratedCategory(
  item: MediaItem,
  category: CuratedCategoryId
): { matches: boolean; reasonLabel?: string } {
  if (category === 'ALL') {
    return { matches: true };
  }

  const genresLower = getMediaGenres(item).map((g) => g.toLowerCase());
  const tropesLower = item.tropes.map((t) => t.toLowerCase());
  const allText = [...genresLower, ...tropesLower, item.synopsis.toLowerCase()].join(' ');

  switch (category) {
    case 'MIND_BENDING': {
      const hasMindTrope = tropesLower.some(
        (t) =>
          t.includes('dream') ||
          t.includes('time') ||
          t.includes('reality') ||
          t.includes('multiverse') ||
          t.includes('memory') ||
          t.includes('labyrinth') ||
          t.includes('quantum') ||
          t.includes('paradox')
      );
      const isSciFiMystery =
        genresLower.includes('sci-fi') &&
        (genresLower.includes('thriller') ||
          genresLower.includes('mystery') ||
          hasMindTrope);
      return {
        matches: hasMindTrope || isSciFiMystery,
        reasonLabel: 'Mind-Bending Sci-Fi',
      };
    }

    case 'CRITICS_DARLINGS': {
      const matches = item.rottenTomatoes >= 88 || item.metascore >= 80;
      return {
        matches,
        reasonLabel: `Critics' Darling (${item.rottenTomatoes}% RT · ${item.metascore} MC)`,
      };
    }

    case 'HIGH_AUDIENCE': {
      const matches = item.imdbRating >= 8.3;
      return {
        matches,
        reasonLabel: `Audience Favorite (★ ${item.imdbRating.toFixed(1)} IMDb)`,
      };
    }

    case 'SLOW_BURN_SERIES': {
      const matches =
        item.mediaType === 'TV' &&
        (genresLower.includes('mystery') ||
          genresLower.includes('drama') ||
          genresLower.includes('thriller') ||
          genresLower.includes('sci-fi') ||
          genresLower.includes('crime'));
      return {
        matches,
        reasonLabel: 'Prestige Television Series',
      };
    }

    case 'FAST_PACED_THRILLERS': {
      const matches =
        genresLower.includes('thriller') ||
        genresLower.includes('crime') ||
        genresLower.includes('action') ||
        tropesLower.some(
          (t) =>
            t.includes('heist') ||
            t.includes('infiltration') ||
            t.includes('labyrinth') ||
            t.includes('detective')
        );
      return {
        matches,
        reasonLabel: 'High-Tension Thriller & Crime',
      };
    }

    case 'AUTEUR_MASTERWORKS': {
      const notableAuteurs = new Set([
        'christopher nolan',
        'denis villeneuve',
        'alex garland',
        'satoshi kon',
        'david fincher',
        'park chan-wook',
        'bong joon-ho',
        'charlie kaufman',
        'michel gondry',
        'ridley scott',
        'steven spielberg',
        'martin scorsese',
        'stanley kubrick',
        'alfred hitchcock',
        'quentin tarantino',
        'paul thomas anderson',
        'wes anderson',
        'yorgos lanthimos',
        'sam esmail',
        'baran bo odar',
        'vince gilligan',
        'cary joji fukunaga',
      ]);
      const hasAuteur = item.directors.some((d) =>
        notableAuteurs.has(d.toLowerCase())
      );
      const highCraft =
        item.imdbRating >= 8.0 &&
        (item.rottenTomatoes >= 85 || item.metascore >= 75);
      return {
        matches: hasAuteur || highCraft,
        reasonLabel: item.directors[0]
          ? `Auteur Vision: ${item.directors[0]}`
          : 'Acclaimed Auteur Craft',
      };
    }

    case 'CYBERPUNK_AI': {
      const matches =
        allText.includes('ai ') ||
        allText.includes('artificial intelligence') ||
        allText.includes('cyber') ||
        allText.includes('simulated') ||
        allText.includes('android') ||
        allText.includes('robot') ||
        allText.includes('surveillance') ||
        allText.includes('hacker') ||
        allText.includes('dystopia') ||
        allText.includes('severed');
      return {
        matches,
        reasonLabel: 'AI, Tech & Dystopian Speculation',
      };
    }

    case 'TIME_AND_MEMORY': {
      const matches =
        allText.includes('time') ||
        allText.includes('memory') ||
        allText.includes('dream') ||
        allText.includes('loop') ||
        allText.includes('amnesia') ||
        allText.includes('non-linear') ||
        allText.includes('temporal') ||
        allText.includes('future') ||
        allText.includes('past');
      return {
        matches,
        reasonLabel: 'Time & Memory Puzzle',
      };
    }
  }
}

export interface CatalogFacetOption {
  value: string;
  count: number;
  subLabel?: string;
}

export interface ExtractedCatalogFacets {
  genres: CatalogFacetOption[];
  tropes: CatalogFacetOption[];
  collaborators: CatalogFacetOption[];
  providers: CatalogFacetOption[];
}

/**
 * Extracts available Genres, Narrative Themes/Tropes, Collaborators, and Regional Streaming Providers
 * with live counts across the current media library.
 */
export function extractCatalogFacets(
  items: MediaItem[],
  region: RegionCode
): ExtractedCatalogFacets {
  const genreCounts = new Map<string, number>();
  const tropeCounts = new Map<string, number>();
  const collabCounts = new Map<string, { count: number; role: string }>();
  const providerCounts = new Map<string, number>();

  // Ensure standard genres are always discoverable even if user wants to fetch live suggestions for them
  const standardGenres = [
    'Sci-Fi',
    'Thriller',
    'Mystery',
    'Drama',
    'Crime',
    'Action',
    'Adventure',
    'Fantasy',
    'Animation',
    'Comedy',
    'Horror',
    'History',
  ];
  for (const std of standardGenres) {
    genreCounts.set(std, 0);
  }

  for (const item of items) {
    for (const g of getMediaGenres(item)) {
      genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
    }

    for (const t of item.tropes) {
      if (!isSpecificNarrativeTrope(t)) continue;
      tropeCounts.set(t, (tropeCounts.get(t) || 0) + 1);
    }

    for (const d of item.directors) {
      if (!isValidPersonName(d)) continue;
      const prev = collabCounts.get(d);
      collabCounts.set(d, {
        count: (prev?.count || 0) + 1,
        role: prev?.role || 'Director / Creator',
      });
    }

    for (const c of item.cast.slice(0, 3)) {
      if (!isValidPersonName(c.name)) continue;
      const prev = collabCounts.get(c.name);
      collabCounts.set(c.name, {
        count: (prev?.count || 0) + 1,
        role: prev?.role || 'Actor',
      });
    }

    for (const comp of item.composers) {
      if (!isValidPersonName(comp)) continue;
      const prev = collabCounts.get(comp);
      collabCounts.set(comp, {
        count: (prev?.count || 0) + 1,
        role: prev?.role || 'Composer',
      });
    }

    const regionalStream = (item.streamingByRegion[region] || []).filter(
      (o) => o.type === 'STREAM'
    );
    const seenProvidersForItem = new Set<string>();
    for (const offer of regionalStream) {
      if (!seenProvidersForItem.has(offer.provider)) {
        seenProvidersForItem.add(offer.provider);
        providerCounts.set(
          offer.provider,
          (providerCounts.get(offer.provider) || 0) + 1
        );
      }
    }
  }

  const genres: CatalogFacetOption[] = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, count }));

  const tropes: CatalogFacetOption[] = Array.from(tropeCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, count }));

  const collaborators: CatalogFacetOption[] = Array.from(
    collabCounts.entries()
  )
    .filter(([, meta]) => meta.count >= 1)
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, 40)
    .map(([value, meta]) => ({
      value,
      count: meta.count,
      subLabel: meta.role,
    }));

  const providers: CatalogFacetOption[] = Array.from(providerCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, count }));

  return {
    genres,
    tropes,
    collaborators,
    providers,
  };
}

/**
 * Computes ranked, explainable Movie & TV Show watch suggestions based on:
 * 1. Titles the user has already watched (`watchedIds`) and/or explicitly focused seed titles (`filters.seedMediaIds`),
 * 2. Broad Genres (`filters.selectedGenres`),
 * 3. Specific Narrative Themes/Tropes (`filters.selectedTropes`),
 * 4. Curated Category / Mood (`filters.curatedCategory`),
 * 5. Collaborator, Format, Release Era, Minimum IMDb Rating, and Regional Streaming Availability.
 */
export function computeWatchSuggestions(
  items: MediaItem[],
  watchedIds: Set<string>,
  filters: SuggestionFilterState,
  region: RegionCode
): WatchSuggestion[] {
  // Determine active seed items (either explicitly chosen seedMediaIds or all watchedIds)
  const seedIdSet = new Set<string>(
    filters.seedMediaIds.length > 0
      ? filters.seedMediaIds
      : Array.from(watchedIds)
  );
  const seedItems = items.filter((m) => seedIdSet.has(m.id));

  const selectedGenresLower = new Set(
    filters.selectedGenres.map((g) => g.toLowerCase())
  );
  const selectedTropesLower = new Set(
    filters.selectedTropes.map((t) => t.toLowerCase())
  );
  const collabLower = filters.selectedCollaborator?.toLowerCase() || null;

  const suggestions: WatchSuggestion[] = [];

  for (const candidate of items) {
    // 1. Exclude explicit seed titles, and exclude already-watched titles when hideWatched is active
    if (filters.seedMediaIds.includes(candidate.id)) {
      continue;
    }
    if (filters.hideWatched && watchedIds.has(candidate.id)) {
      continue;
    }

    // 2. Media Format Filter
    if (filters.mediaFilter === 'MOVIE' && candidate.mediaType !== 'MOVIE') {
      continue;
    }
    if (filters.mediaFilter === 'TV' && candidate.mediaType !== 'TV') {
      continue;
    }

    // 3. Decade / Era Filter
    if (filters.decadeFilter !== 'ALL') {
      if (
        filters.decadeFilter === '2020s' &&
        (candidate.year < 2020 || candidate.year > 2029)
      ) {
        continue;
      }
      if (
        filters.decadeFilter === '2010s' &&
        (candidate.year < 2010 || candidate.year > 2019)
      ) {
        continue;
      }
      if (
        filters.decadeFilter === '2000s' &&
        (candidate.year < 2000 || candidate.year > 2009)
      ) {
        continue;
      }
      if (filters.decadeFilter === 'CLASSIC' && candidate.year >= 2000) {
        continue;
      }
    }

    // 4. Minimum IMDb Rating Filter
    if (
      filters.minImdbRating > 0 &&
      candidate.imdbRating < filters.minImdbRating
    ) {
      continue;
    }

    // 5. Regional Streaming Filter
    const regionalStreams = (candidate.streamingByRegion[region] || []).filter(
      (o) => o.type === 'STREAM'
    );
    if (filters.streamingOnlyInRegion && regionalStreams.length === 0) {
      continue;
    }
    if (
      filters.selectedProvider &&
      !regionalStreams.some(
        (o) =>
          o.provider.toLowerCase() === filters.selectedProvider!.toLowerCase()
      )
    ) {
      continue;
    }

    // 6. Collaborator Filter
    if (collabLower) {
      const hasCollab =
        candidate.directors.some((d) => d.toLowerCase() === collabLower) ||
        candidate.writers.some((w) => w.toLowerCase() === collabLower) ||
        candidate.cast.some((c) => c.name.toLowerCase() === collabLower) ||
        candidate.composers.some((c) => c.toLowerCase() === collabLower) ||
        candidate.cinematographers.some((dp) => dp.toLowerCase() === collabLower);
      if (!hasCollab) continue;
    }

    // 7. Curated Category Filter
    const categoryEval = matchesCuratedCategory(
      candidate,
      filters.curatedCategory
    );
    if (!categoryEval.matches) {
      continue;
    }

    // 8. Genre & Trope Matching
    const candidateGenres = getMediaGenres(candidate);
    const matchedGenres = candidateGenres.filter((g) =>
      selectedGenresLower.has(g.toLowerCase())
    );
    if (selectedGenresLower.size > 0 && matchedGenres.length === 0) {
      continue;
    }

    const matchedTropes = candidate.tropes.filter((t) =>
      selectedTropesLower.has(t.toLowerCase())
    );
    if (selectedTropesLower.size > 0 && matchedTropes.length === 0) {
      continue;
    }

    const reasonsMap = new Map<string, SuggestionReason>();
    const addReason = (reason: SuggestionReason) => {
      const existing = reasonsMap.get(reason.id);
      if (!existing || reason.points > existing.points) {
        reasonsMap.set(reason.id, reason);
      }
    };

    // ==================== SCORING PART A: "BECAUSE YOU WATCHED" MULTI-SEED AFFINITY ====================
    const becauseYouWatched: BecauseYouWatchedEntry[] = [];
    let seedAffinityScore = 0;

    if (seedItems.length > 0) {
      for (const seed of seedItems) {
        if (seed.id === candidate.id) continue;

        const craftSim = calculateSimilarity(seed, candidate, filters.preset);
        const seedGenres = getMediaGenres(seed);
        const sharedGenresWithSeed = candidateGenres.filter((cg) =>
          seedGenres.some((sg) => sg.toLowerCase() === cg.toLowerCase())
        );
        const primaryGenreMatches =
          normalizeGenreName(seed.primaryGenre).toLowerCase() ===
          normalizeGenreName(candidate.primaryGenre).toLowerCase();

        // Genre & Co-Watch points so even titles sharing genre/vibe with a watched title get scored
        let genreKinshipPts = sharedGenresWithSeed.length * 5;
        if (primaryGenreMatches) genreKinshipPts += 7;
        genreKinshipPts = Math.min(18, genreKinshipPts);

        const isCoWatched =
          seed.coWatchIds.includes(candidate.id) ||
          candidate.coWatchIds.includes(seed.id);
        const coWatchPts = isCoWatched ? 8 : 0;

        const pairScore = Math.min(
          99,
          craftSim.totalScore +
            (craftSim.totalScore > 0
              ? Math.round(genreKinshipPts * 0.65) + coWatchPts
              : genreKinshipPts + coWatchPts)
        );

        if (pairScore >= 12) {
          const topSharedLabels: string[] = [];

          for (const conn of craftSim.sharedConnections) {
            topSharedLabels.push(`${conn.prefix}: ${conn.value}`);
            addReason({
              id: conn.id,
              label: conn.label,
              prefix: conn.prefix,
              value: conn.value,
              type:
                conn.category === 'AUTEUR'
                  ? 'AUTEUR'
                  : conn.category === 'CAST'
                    ? 'CAST'
                    : conn.category === 'SONIC_VISUAL'
                      ? 'SCORE'
                      : 'TROPE',
              color: conn.color,
              points: conn.points,
              entityNodeId: conn.entityNodeId,
            });
          }

          for (const sg of sharedGenresWithSeed.slice(0, 2)) {
            if (topSharedLabels.length < 3) {
              topSharedLabels.push(`Genre: ${sg}`);
            }
            addReason({
              id: `shared-genre-${sg.toLowerCase()}`,
              label: `Genre: ${sg}`,
              prefix: 'Genre',
              value: sg,
              type: 'GENRE',
              color: ENTITY_COLORS.MOVIE.primary,
              points: primaryGenreMatches ? 10 : 6,
            });
          }

          becauseYouWatched.push({
            id: seed.id,
            title: seed.title,
            year: seed.year,
            mediaType: seed.mediaType,
            pairScore,
            topShared: topSharedLabels.slice(0, 3),
          });
        }
      }

      becauseYouWatched.sort((a, b) => b.pairScore - a.pairScore);

      if (becauseYouWatched.length > 0) {
        const bestPair = becauseYouWatched[0].pairScore;
        const multiSeedBonus = Math.min(
          18,
          becauseYouWatched
            .slice(1, 4)
            .reduce((acc, b) => acc + Math.round(b.pairScore * 0.22), 0)
        );
        seedAffinityScore = Math.min(98, bestPair + multiSeedBonus);
      }
    }

    // ==================== SCORING PART B: GENRE, THEME, CATEGORY & ACCLAIM FIT ====================
    let categoryFilterScore = 0;

    for (const mg of matchedGenres) {
      const isPrimary =
        normalizeGenreName(candidate.primaryGenre).toLowerCase() ===
        mg.toLowerCase();
      const pts = isPrimary ? 22 : 15;
      categoryFilterScore += pts;
      addReason({
        id: `filter-genre-${mg.toLowerCase()}`,
        label: `Genre: ${mg}`,
        prefix: 'Genre',
        value: mg,
        type: 'GENRE',
        color: '#234B6E',
        points: pts,
      });
    }

    for (const mt of matchedTropes) {
      categoryFilterScore += 24;
      addReason({
        id: `trope-${mt.toLowerCase()}`,
        label: `Theme: ${mt}`,
        prefix: 'Theme',
        value: mt,
        type: 'TROPE',
        color: ENTITY_COLORS.TROPE.primary,
        points: 24,
        entityNodeId: toEntityNodeId('TROPE', mt),
      });
    }

    if (filters.curatedCategory !== 'ALL' && categoryEval.reasonLabel) {
      categoryFilterScore += 22;
      const catDef = CURATED_CATEGORIES.find(
        (c) => c.id === filters.curatedCategory
      );
      addReason({
        id: `cat-${filters.curatedCategory}`,
        label: categoryEval.reasonLabel,
        prefix: 'Collection',
        value: catDef?.title || categoryEval.reasonLabel,
        type: 'CATEGORY',
        color: catDef?.accentColor || '#B8292F',
        points: 22,
      });
    }

    if (filters.selectedCollaborator) {
      categoryFilterScore += 25;
      addReason({
        id: `collab-${filters.selectedCollaborator.toLowerCase()}`,
        label: `Collaborator: ${filters.selectedCollaborator}`,
        prefix: 'Featured',
        value: filters.selectedCollaborator,
        type: 'AUTEUR',
        color: '#B8292F',
        points: 25,
      });
    }

    // Quality & Critical Acclaim baseline score (scaled 0–35 pts)
    const qualityScore = Math.round(
      Math.max(0, (candidate.imdbRating - 6.5) * 8) +
        Math.max(0, (candidate.rottenTomatoes - 65) * 0.35)
    );

    // Ensure every suggestion has rich explanatory pills even when browsing with no filters or seeds
    if (reasonsMap.size === 0) {
      for (const trope of candidate.tropes
        .filter(isSpecificNarrativeTrope)
        .slice(0, 2)) {
        addReason({
          id: `trope-${trope.toLowerCase()}`,
          label: `Theme: ${trope}`,
          prefix: 'Theme',
          value: trope,
          type: 'TROPE',
          color: ENTITY_COLORS.TROPE.primary,
          points: 12,
          entityNodeId: toEntityNodeId('TROPE', trope),
        });
      }
      if (candidate.directors[0]) {
        addReason({
          id: `dir-${candidate.directors[0]}`,
          label: `Director: ${candidate.directors[0]}`,
          prefix: candidate.mediaType === 'TV' ? 'Creator' : 'Director',
          value: candidate.directors[0],
          type: 'AUTEUR',
          color: ENTITY_COLORS.DIRECTOR.primary,
          points: 15,
          entityNodeId: toEntityNodeId('DIRECTOR', candidate.directors[0]),
        });
      }
      for (const g of candidateGenres.slice(0, 2)) {
        addReason({
          id: `genre-${g.toLowerCase()}`,
          label: `Genre: ${g}`,
          prefix: 'Genre',
          value: g,
          type: 'GENRE',
          color: '#234B6E',
          points: 8,
        });
      }
    }

    const hasActiveCategoryFilters =
      selectedGenresLower.size > 0 ||
      selectedTropesLower.size > 0 ||
      filters.curatedCategory !== 'ALL' ||
      Boolean(filters.selectedCollaborator);

    // If user has watched seeds AND no category filters are active, require at least some connection to watched seeds
    // unless none of the catalog matches (fallback handled below)
    let finalScore = 0;
    if (seedItems.length > 0 && hasActiveCategoryFilters) {
      finalScore = Math.min(
        99,
        Math.round(seedAffinityScore * 0.55 + categoryFilterScore + qualityScore * 0.7)
      );
    } else if (seedItems.length > 0) {
      finalScore =
        seedAffinityScore > 0
          ? Math.min(99, Math.round(seedAffinityScore + qualityScore * 0.35))
          : Math.min(68, 40 + qualityScore);
    } else if (hasActiveCategoryFilters) {
      finalScore = Math.min(
        99,
        Math.round(52 + Math.min(28, categoryFilterScore) + qualityScore * 0.65)
      );
    } else {
      finalScore = Math.min(98, Math.round(64 + qualityScore));
    }

    const sortedReasons = Array.from(reasonsMap.values()).sort(
      (a, b) => b.points - a.points
    );

    suggestions.push({
      item: candidate,
      matchScore: Math.max(15, finalScore),
      becauseYouWatched: becauseYouWatched.slice(0, 3),
      reasons: sortedReasons.slice(0, 6),
      matchedGenres,
      matchedTropes,
    });
  }

  suggestions.sort((a, b) => {
    // Prioritize items with concrete "Because you watched" matches when seed items are active
    const aHasWatchedLink = a.becauseYouWatched.length > 0 ? 1 : 0;
    const bHasWatchedLink = b.becauseYouWatched.length > 0 ? 1 : 0;
    if (seedItems.length > 0 && aHasWatchedLink !== bHasWatchedLink) {
      return bHasWatchedLink - aHasWatchedLink;
    }
    return (
      b.matchScore - a.matchScore ||
      b.item.imdbRating - a.item.imdbRating ||
      b.item.rottenTomatoes - a.item.rottenTomatoes
    );
  });

  return suggestions;
}

