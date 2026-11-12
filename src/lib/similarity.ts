import {
  AppTheme,
  EntityNodeType,
  EntityVisibility,
  ForceSettings,
  GraphFilterState,
  GraphLayoutMode,
  GraphLink,
  GraphNode,
  GraphScopeMode,
  GravityPreset,
  MediaItem,
  NodeColorMode,
  NodeSizeMode,
  PrecomputedUmapPoint,
  SemanticCluster,
  SharedConnection,
  SimilarityBreakdown,
} from './types';

export const ENTITY_COLORS: Record<
  EntityNodeType,
  { primary: string; glow: string; badgeBg: string; label: string }
> = {
  MOVIE: {
    primary: '#234B6E',
    glow: '#356894',
    badgeBg: 'rgba(35, 75, 110, 0.10)',
    label: 'Feature Film',
  },
  TV: {
    primary: '#6B3A6E',
    glow: '#8A4F8E',
    badgeBg: 'rgba(107, 58, 110, 0.10)',
    label: 'Television Series',
  },
  DIRECTOR: {
    primary: '#B8292F',
    glow: '#D43D43',
    badgeBg: 'rgba(184, 41, 47, 0.10)',
    label: 'Director & Writer',
  },
  ACTOR: {
    primary: '#B86B14',
    glow: '#D48324',
    badgeBg: 'rgba(184, 107, 20, 0.10)',
    label: 'Principal Cast',
  },
  TROPE: {
    primary: '#2A6B53',
    glow: '#3B8A6D',
    badgeBg: 'rgba(42, 107, 83, 0.10)',
    label: 'Theme & Motif',
  },
  COMPOSER: {
    primary: '#A63A2B',
    glow: '#C44D3D',
    badgeBg: 'rgba(166, 58, 43, 0.10)',
    label: 'Composer & Cinematography',
  },
};

export const MOVIE_MAP_DARK_ENTITY_COLORS: Record<
  EntityNodeType,
  { primary: string; glow: string; badgeBg: string; label: string }
> = {
  MOVIE: {
    primary: '#00D2FF', // Electric Cyan
    glow: '#38E1FF',
    badgeBg: 'rgba(0, 210, 255, 0.14)',
    label: 'Feature Film',
  },
  TV: {
    primary: '#D946EF', // Radiant Fuchsia
    glow: '#F0ABFC',
    badgeBg: 'rgba(217, 70, 239, 0.14)',
    label: 'Television Series',
  },
  DIRECTOR: {
    primary: '#FF3366', // Neon Crimson Rose
    glow: '#FF668B',
    badgeBg: 'rgba(255, 51, 102, 0.14)',
    label: 'Director & Writer',
  },
  ACTOR: {
    primary: '#FFAA00', // Luminous Amber Gold
    glow: '#FFC44D',
    badgeBg: 'rgba(255, 170, 0, 0.14)',
    label: 'Principal Cast',
  },
  TROPE: {
    primary: '#00F5D4', // Emerald Mint
    glow: '#57FCE3',
    badgeBg: 'rgba(0, 245, 212, 0.14)',
    label: 'Theme & Motif',
  },
  COMPOSER: {
    primary: '#FF5400', // Solar Flame
    glow: '#FF7A33',
    badgeBg: 'rgba(255, 84, 0, 0.14)',
    label: 'Composer & Cinematography',
  },
};

export const MOVIE_MAP_DARK_CLUSTER_COLORS: Record<
  string,
  { color: string; glowColor: string }
> = {
  'satirical-wry-humanity': { color: '#00F5A0', glowColor: '#57FCE3' }, // Comedy (mint emerald)
  'romcom-and-romance': { color: '#FF6584', glowColor: '#FFA3B5' }, // Romance & Romcom (coral rose)
  'visceral-noir-thrillers': { color: '#FFB800', glowColor: '#FFD066' }, // Crime & Noir (amber gold)
  'auteur-prestige-drama': { color: '#FF7A59', glowColor: '#FFA07A' }, // Drama (sunset peach)
  'documentary-and-truth': { color: '#00A6FF', glowColor: '#38BDF8' }, // Documentary (azure blue)
  'atmospheric-supernatural': { color: '#FF2E93', glowColor: '#FF6EB4' }, // Horror (magenta violet)
  'mind-bending-scifi': { color: '#00D2FF', glowColor: '#38E1FF' }, // Sci-Fi (electric cyan)
  'kinetic-action-spectacle': { color: '#FF3366', glowColor: '#FF668B' }, // Action (scarlet red)
  'epic-worldbuilding-fantasy': { color: '#10B981', glowColor: '#34D399' }, // Fantasy (emerald green)
  'philosophical-slow-burn': { color: '#A78BFA', glowColor: '#C4B5FD' }, // Contemplative (lavender)
};

export function toEntityNodeId(type: EntityNodeType, name: string): string {
  return `${type.toLowerCase()}:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

const BROAD_GENRE_OR_GENERIC_TERMS = new Set([
  'drama',
  'thriller',
  'action',
  'sci-fi',
  'science fiction',
  'sci-fi & fantasy',
  'action & adventure',
  'comedy',
  'crime',
  'fantasy',
  'mystery',
  'romance',
  'adventure',
  'horror',
  'animation',
  'documentary',
  'family',
  'history',
  'war',
  'western',
  'biography',
  'musical',
  'sport',
  'television series',
  'tv series',
  'miniseries',
  'television mini-series',
  'film',
  'feature film',
  'movie',
  'series',
  'psychological labyrinth',
  'based on novel or book',
  'based on novel',
  'based on true story',
  'based on comic',
  'based on play or musical',
  'aftercreditsstinger',
  'duringcreditsstinger',
  'woman director',
  'sequel',
  'remake',
  'spin off',
  'reboot',
  'anime',
  'anthology',
  'murder',
  'death',
  'revenge',
  'violence',
  'love',
  'friendship',
  'dark comedy',
  'black comedy',
  'suspense',
]);

const PLACEHOLDER_CREDIT_NAMES = new Set([
  'visionary auteur',
  'featured auteur',
  'featured director',
  'acclaimed filmmaker',
  'unknown',
  'n/a',
]);

export function isSpecificNarrativeTrope(term: string): boolean {
  const clean = term.trim().toLowerCase();
  if (!clean || clean.length < 3) return false;
  return !BROAD_GENRE_OR_GENERIC_TERMS.has(clean);
}

export function isValidPersonName(name: string): boolean {
  const clean = name.trim().toLowerCase();
  if (!clean || clean.length < 2) return false;
  return !PLACEHOLDER_CREDIT_NAMES.has(clean);
}

// ==================== MOVIE MAP REA: SEMANTIC CLUSTERS, COLOR BLENDING & FILTERING ====================

export const DEFAULT_GRAPH_FILTERS: GraphFilterState = {
  selectedGenres: [],
  selectedTropes: [],
  matchMode: 'OR',
  filterBehavior: 'DIM',
  yearRange: [1970, 2030],
  minImdbRating: 0,
  watchedFilter: 'ALL',
  activeClusterId: null,
  searchHighlightQuery: '',
  showTerritories: true,
};

export function hasActiveGraphFilters(filters: GraphFilterState): boolean {
  return (
    filters.selectedGenres.length > 0 ||
    filters.selectedTropes.length > 0 ||
    filters.yearRange[0] > 1970 ||
    filters.yearRange[1] < 2030 ||
    filters.minImdbRating > 0 ||
    filters.watchedFilter !== 'ALL' ||
    Boolean(filters.activeClusterId) ||
    Boolean(filters.searchHighlightQuery.trim())
  );
}

/**
 * 10 Primary Semantic Galaxy clusters inspired by Mikey Guinness's Movie Map HDBSCAN clusters.
 * Each cluster anchors an expansive spatial sector in the galaxy projection with generous inter-genre spacing.
 */
export const SEMANTIC_CLUSTER_DEFINITIONS: Array<{
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  glowColor: string;
  centroid: { x: number; y: number; z: number };
  keywords: string[];
  genres: string[];
}> = [
  {
    id: 'satirical-wry-humanity',
    label: 'Comedy & Wry Satire',
    shortLabel: 'Comedy',
    description: 'Dark comedy, sharp societal critiques, absurdism, and witty human humor.',
    color: '#1B6A47',
    glowColor: '#2A9A67',
    centroid: { x: 20, y: 520, z: 20 },
    keywords: [
      'comedy', 'satire', 'dark humor', 'spoof', 'slapstick', 'workplace absurdity',
      'eccentric characters', 'cynicism', 'witty dialogue', 'absurdism', 'parody',
    ],
    genres: ['Comedy'],
  },
  {
    id: 'romcom-and-romance',
    label: 'Romance & Romantic Comedy',
    shortLabel: 'Romance',
    description: 'Love, bittersweet relationships, romantic comedy, and passionate human bonds.',
    color: '#A63F52',
    glowColor: '#D1586F',
    centroid: { x: 440, y: 220, z: -15 },
    keywords: [
      'romance', 'love', 'romantic comedy', 'romcom', 'erotic', 'relationships',
      'dating', 'heartbreak', 'passion', 'soulmates', 'bittersweet romance',
    ],
    genres: ['Romance'],
  },
  {
    id: 'visceral-noir-thrillers',
    label: 'Visceral Noir & Neo-Crime Sagas',
    shortLabel: 'Crime & Noir',
    description: 'Corrupt syndicates, high-stakes heists, hard-boiled detectives, and gripping cat-and-mouse games.',
    color: '#B86B14',
    glowColor: '#E28E2B',
    centroid: { x: 320, y: -20, z: -35 },
    keywords: [
      'heist', 'organized crime', 'conspiracy', 'cat-and-mouse',
      'revenge', 'detective noir', 'corruption', 'assassin',
      'underworld', 'betrayal', 'fbi investigation', 'neo-noir',
    ],
    genres: ['Crime', 'Thriller', 'Mystery'],
  },
  {
    id: 'auteur-prestige-drama',
    label: 'Auteur Prestige & Modern Drama',
    shortLabel: 'Drama',
    description: 'Character-driven psychological labyrinths, moral ambiguity, family sagas, and cinematic auteur craft.',
    color: '#B8292F',
    glowColor: '#E04A50',
    centroid: { x: 280, y: -480, z: -45 },
    keywords: [
      'psychological unraveling', 'moral ambiguity', 'character study',
      'existential crisis', 'family trauma', 'paranoia', 'obsession',
      'unreliable narrator', 'social alienation', 'modern drama', 'grief',
    ],
    genres: ['Drama'],
  },
  {
    id: 'documentary-and-truth',
    label: 'Documentary & Real Life',
    shortLabel: 'Documentary',
    description: 'Factual exposés, musical legends, true crime, historical revolutions, and nature.',
    color: '#286B7B',
    glowColor: '#3D9BB2',
    centroid: { x: -480, y: -420, z: 35 },
    keywords: [
      'documentary', 'music documentary', 'biography', 'investigation',
      'historical truth', 'real life', 'true crime', 'nature', 'interviews',
    ],
    genres: ['Documentary', 'History', 'Music'],
  },
  {
    id: 'atmospheric-supernatural',
    label: 'Atmospheric Horror & Macabre Mystery',
    shortLabel: 'Horror',
    description: 'Gothic dread, psychological tension, supernatural anomalies, and slow-burn cosmic terror.',
    color: '#6B3A6E',
    glowColor: '#9C58A0',
    centroid: { x: -380, y: -70, z: 45 },
    keywords: [
      'isolation', 'folklore', 'cosmic horror', 'haunted past',
      'psychological terror', 'supernatural', 'monsters', 'occult',
      'claustrophobia', 'body horror', 'creepy atmosphere', 'slasher',
    ],
    genres: ['Horror', 'Mystery', 'Thriller'],
  },
  {
    id: 'mind-bending-scifi',
    label: 'Mind-Bending & Speculative Sci-Fi',
    shortLabel: 'Science Fiction',
    description: 'Quantum realities, time loops, artificial intelligence, and existential cosmos.',
    color: '#234B6E',
    glowColor: '#3D78A8',
    centroid: { x: -140, y: -30, z: 20 },
    keywords: [
      'time travel', 'time loop', 'non-linear time', 'artificial intelligence', 'existential dread', 'dystopia',
      'cyborg', 'space exploration', 'virtual reality', 'parallel dimensions',
      'cyberpunk', 'simulation hypothesis', 'mind games', 'quantum mechanics', 'quantum multiverse',
      'alien contact', 'dream manipulation', 'multiverse', 'subconscious labyrinth', 'simulation'
    ],
    genres: ['Science Fiction', 'Sci-Fi'],
  },
  {
    id: 'kinetic-action-spectacle',
    label: 'Kinetic Spectacle & Tactical Escapism',
    shortLabel: 'Action',
    description: 'Precision stuntwork, explosive set-pieces, adrenaline-fueled pacing, and survival combat.',
    color: '#A63A2B',
    glowColor: '#CF5745',
    centroid: { x: 50, y: 180, z: 50 },
    keywords: [
      'martial arts', 'car chases', 'survival battle', 'explosive stunts',
      'tactical combat', 'superheroes', 'adrenaline rush', 'high octane',
      'military ops', 'blockbuster spectacle', 'action comedy',
    ],
    genres: ['Action', 'Adventure'],
  },
  {
    id: 'epic-worldbuilding-fantasy',
    label: 'Epic Worldbuilding & Mythic Adventure',
    shortLabel: 'Fantasy & Epic',
    description: 'Sweeping mythologies, grand quests, legendary realms, and heroic odysseys.',
    color: '#2A6B53',
    glowColor: '#429E7C',
    centroid: { x: -280, y: 320, z: -30 },
    keywords: [
      'heroic journey', 'ancient prophecy', 'mythic world', 'grand crusade',
      'sword & sorcery', 'empire politics', 'monumental scale', 'rebellion',
      'chosen one', 'fellowship', 'animation', 'animated',
    ],
    genres: ['Fantasy', 'Adventure', 'Animation'],
  },
  {
    id: 'philosophical-slow-burn',
    label: 'Contemplative & Historical Cinema',
    shortLabel: 'Contemplative',
    description: 'Lyrical pacing, metaphysical questions, memory, grief, and visual poetry.',
    color: '#5C5446',
    glowColor: '#8C8270',
    centroid: { x: -50, y: -280, z: -35 },
    keywords: [
      'memory and loss', 'meditative', 'melancholy', 'philosophical inquiry',
      'visual poetry', 'human condition', 'solitude', 'grief and healing',
      'slow burn', 'art-house aesthetic', 'historical drama', 'war',
    ],
    genres: ['Drama', 'War', 'Music'],
  },
];

/**
 * Linearly blends two hex colors with a ratio t in [0, 1] (0 = c1, 1 = c2).
 * Mimics Movie Map's boundary color blending between adjacent semantic clusters.
 */
export function blendHexColors(c1: string, c2: string, t: number): string {
  const clean1 = c1.replace('#', '');
  const clean2 = c2.replace('#', '');
  const r1 = parseInt(clean1.slice(0, 2), 16) || 0;
  const g1 = parseInt(clean1.slice(2, 4), 16) || 0;
  const b1 = parseInt(clean1.slice(4, 6), 16) || 0;
  const r2 = parseInt(clean2.slice(0, 2), 16) || 0;
  const g2 = parseInt(clean2.slice(2, 4), 16) || 0;
  const b2 = parseInt(clean2.slice(4, 6), 16) || 0;

  const r = Math.round(r1 + (r2 - r1) * Math.max(0, Math.min(1, t)));
  const g = Math.round(g1 + (g2 - g1) * Math.max(0, Math.min(1, t)));
  const b = Math.round(b1 + (b2 - b1) * Math.max(0, Math.min(1, t)));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export const GENRE_COLOR_PALETTE: Record<string, string> = {
  'Science Fiction': '#234B6E',
  'Sci-Fi': '#234B6E',
  Drama: '#B8292F',
  Thriller: '#B86B14',
  Crime: '#7A4B1A',
  Horror: '#6B3A6E',
  Mystery: '#4F3B68',
  Action: '#A63A2B',
  Adventure: '#2A6B53',
  Fantasy: '#1D6B4F',
  Comedy: '#9C6824',
  Animation: '#286B7B',
  Romance: '#A63F52',
  War: '#6E5C3B',
  Western: '#8C5624',
  Documentary: '#505E6B',
};

export function getGenreColor(genreName: string): string {
  return GENRE_COLOR_PALETTE[genreName] || '#52483E';
}

export function getDecadeColor(year: number): string {
  if (year >= 2020) return '#234B6E'; // 2020s: Contemporary Prussian Blue
  if (year >= 2010) return '#2A6B53'; // 2010s: Verdigris Green
  if (year >= 2000) return '#B86B14'; // 2000s: Ochre Amber
  if (year >= 1990) return '#6B3A6E'; // 1990s: Imperial Plum
  if (year >= 1980) return '#A63A2B'; // 1980s: Terracotta Red
  if (year >= 1970) return '#B8292F'; // 1970s: Archival Crimson
  return '#7A6B58'; // Classic Eras
}

/**
 * Standard canonical genre names so "Science Fiction" and "Sci-Fi" unify cleanly.
 */
export function normalizeGenreName(raw: string): string {
  const clean = (raw || '').trim();
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

/**
 * Assigns a MediaItem to its primary and secondary semantic clusters based on
 * thematic keywords, tropes, and broad genres.
 */
export function assignItemSemanticCluster(
  item: MediaItem,
  theme: AppTheme = 'MOVIE_MAP_DARK'
): {
  primary: typeof SEMANTIC_CLUSTER_DEFINITIONS[0];
  secondary: typeof SEMANTIC_CLUSTER_DEFINITIONS[0];
  blendRatio: number; // 0.0 (pure primary) to 0.5 (equal split)
} {
  const normPrimary = normalizeGenreName(item.primaryGenre || '').toLowerCase();
  const normItemGenres = (item.genres || []).map((g) => normalizeGenreName(g).toLowerCase());

  const itemKeywords = [
    ...item.tropes.map((t) => t.toLowerCase()),
    ...normItemGenres,
    normPrimary,
  ];

  const scores = SEMANTIC_CLUSTER_DEFINITIONS.map((cluster) => {
    let score = 0;
    // Tropes/keywords match
    for (const kw of cluster.keywords) {
      const lowerKw = kw.toLowerCase();
      if (itemKeywords.some((ik) => ik.includes(lowerKw) || lowerKw.includes(ik))) {
        score += 8;
      }
    }
    // Broad genre match with normalization
    for (const g of cluster.genres) {
      const normG = normalizeGenreName(g).toLowerCase();
      if (normItemGenres.includes(normG)) {
        score += 4;
      }
      if (normPrimary === normG) {
        score += 8;
      }
    }
    return { cluster, score };
  });

  scores.sort((a, b) => b.score - a.score);
  let primaryCluster =
    scores[0]?.score > 0 ? scores[0].cluster : SEMANTIC_CLUSTER_DEFINITIONS[0];
  let secondaryCluster =
    scores[1]?.score > 0 ? scores[1].cluster : scores[0].cluster;

  if (theme === 'MOVIE_MAP_DARK') {
    const dark1 = MOVIE_MAP_DARK_CLUSTER_COLORS[primaryCluster.id];
    if (dark1) {
      primaryCluster = {
        ...primaryCluster,
        color: dark1.color,
        glowColor: dark1.glowColor,
      };
    }
    const dark2 = MOVIE_MAP_DARK_CLUSTER_COLORS[secondaryCluster.id];
    if (dark2) {
      secondaryCluster = {
        ...secondaryCluster,
        color: dark2.color,
        glowColor: dark2.glowColor,
      };
    }
  }

  const primary = primaryCluster;
  const secondary = secondaryCluster;

  const total = (scores[0]?.score || 1) + (scores[1]?.score || 0);
  const blendRatio = scores[1]?.score > 0
    ? Math.min(0.45, Math.max(0.1, (scores[1].score / total) * 0.7))
    : 0.0;

  return { primary, secondary, blendRatio };
}

/**
 * Evaluates whether a MediaItem matches the active multi-faceted Movie Map filters.
 * Supports Any (OR) vs. All (AND) across multi-selected genres and keywords.
 */
export function evaluateMediaItemFilterMatch(
  item: MediaItem,
  filters: GraphFilterState,
  isWatched: boolean,
  isInterested: boolean
): boolean {
  // 1. Watched / Want to Watch status filter
  if (filters.watchedFilter === 'WATCHED' && !isWatched) return false;
  if (filters.watchedFilter === 'UNWATCHED' && isWatched) return false;
  if (filters.watchedFilter === 'INTERESTED' && !isInterested) return false;

  // 2. Release Year Range
  if (item.year < filters.yearRange[0] || item.year > filters.yearRange[1]) {
    return false;
  }

  // 3. Minimum IMDb Rating
  if (filters.minImdbRating > 0 && item.imdbRating < filters.minImdbRating) {
    return false;
  }

  // 4. Specific Semantic Cluster filter
  if (filters.activeClusterId) {
    const { primary } = assignItemSemanticCluster(item);
    if (primary.id !== filters.activeClusterId) {
      return false;
    }
  }

  // 5. Freeform Search Highlight Query
  if (filters.searchHighlightQuery.trim()) {
    const q = filters.searchHighlightQuery.trim().toLowerCase();
    const match =
      item.title.toLowerCase().includes(q) ||
      item.directors.some((d) => d.toLowerCase().includes(q)) ||
      item.cast.some((c) => c.name.toLowerCase().includes(q)) ||
      item.tropes.some((t) => t.toLowerCase().includes(q)) ||
      item.genres.some((g) => g.toLowerCase().includes(q));
    if (!match) return false;
  }

  // 6. Genres & Tropes (Keywords) with OR vs. AND logic
  const hasGenreFilter = filters.selectedGenres.length > 0;
  const hasTropeFilter = filters.selectedTropes.length > 0;

  if (!hasGenreFilter && !hasTropeFilter) {
    return true;
  }

  const normSelectedGenres = filters.selectedGenres.map((g) => normalizeGenreName(g).toLowerCase());
  const normItemGenres = item.genres.map((g) => normalizeGenreName(g).toLowerCase());
  if (item.primaryGenre) {
    normItemGenres.push(normalizeGenreName(item.primaryGenre).toLowerCase());
  }
  const itemTropesLower = item.tropes.map((t) => t.toLowerCase());

  if (filters.matchMode === 'AND') {
    // Every selected genre must be present
    for (const g of normSelectedGenres) {
      if (!normItemGenres.includes(g)) return false;
    }
    // Every selected trope must be present
    for (const t of filters.selectedTropes) {
      if (!itemTropesLower.some((it) => it.includes(t.toLowerCase()))) return false;
    }
    return true;
  } else {
    // Match ANY (OR) of the selected genres or tropes
    const matchedGenre = normSelectedGenres.some((g) =>
      normItemGenres.includes(g)
    );
    const matchedTrope = filters.selectedTropes.some((t) =>
      itemTropesLower.some((it) => it.includes(t.toLowerCase()))
    );
    return matchedGenre || matchedTrope;
  }
}

/**
 * Precomputes the top 20 nearest neighbors for each media item in the active library
 * (mirroring Mikey Guinness's 20 nearest neighbors surfaced in the "Similar films" inspector tab).
 */
export function computeNearestNeighbors(
  items: MediaItem[],
  preset: GravityPreset = 'VIBE_TROPES'
): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const item of items) {
    const scored = items
      .filter((other) => other.id !== item.id)
      .map((other) => ({
        id: other.id,
        sim: calculateSimilarity(item, other, preset),
      }))
      .filter((entry) => entry.sim.totalScore > 0)
      .sort((a, b) => b.sim.totalScore - a.sim.totalScore)
      .slice(0, 20)
      .map((entry) => entry.id);

    map.set(item.id, scored);
  }

  return map;
}


/**
 * Returns true ONLY when two titles share at least one concrete craft or narrative connection
 * (shared Director/Writer/Creator, Cast member, Composer/Cinematographer, or specific Narrative Theme).
 * Sharing only a broad genre (e.g. "Drama") or generic viewer overlap is never enough to link two titles.
 */
export function hasConcreteSharedConnection(
  similarity: SimilarityBreakdown
): boolean {
  return (
    similarity.rawPoints.auteur > 0 ||
    similarity.rawPoints.cast > 0 ||
    similarity.rawPoints.sonicVisual > 0 ||
    similarity.rawPoints.tropes > 0
  );
}

/**
 * Computes the 100-point weighted craft similarity score between a focal title
 * and a candidate title, adjusted by the active Curatorial Lens preset.
 *
 * Base Rubric (100 Points Total):
 * 1. Themes & Motifs (Max 35 pts): +12 pts per shared specific narrative trope/theme
 * 2. Director & Screenwriter (Max 25 pts): +25 pts shared Director/Showrunner; +15 pts shared Writer/Creator
 * 3. Genre Kinship (Max 15 pts): +5 pts per shared genre; +5 pt bonus if primary genre matches (only counted when a concrete connection exists)
 * 4. Shared Cast (Max 10 pts): +6 pts shared #1/#2 lead actor; +4 pts shared top-5 supporting actor
 * 5. Score & Cinematography (Max 10 pts): +6 pts shared Composer; +4 pts shared Cinematographer
 * 6. Viewer Overlap (Max 5 pts): +5 pts when frequently paired by audiences (only counted when a concrete connection exists)
 */
const similarityCache = new Map<string, SimilarityBreakdown>();

export function calculateSimilarity(
  focal: MediaItem,
  candidate: MediaItem,
  preset: GravityPreset = 'VIBE_TROPES'
): SimilarityBreakdown {
  if (focal.id === candidate.id) {
    return {
      totalScore: 100,
      rawPoints: {
        tropes: 35,
        auteur: 25,
        genres: 15,
        cast: 10,
        sonicVisual: 10,
        coWatch: 5,
      },
      sharedConnections: [],
      linkDistance: 60,
    };
  }

  const cacheKey = `${focal.id}::${candidate.id}::${preset}`;
  const cached = similarityCache.get(cacheKey);
  if (cached) return cached;

  const sharedConnections: SharedConnection[] = [];

  // 1. Themes & Motifs (+12 pts each, Max 35 pts) — only specific narrative tropes, never generic genres
  let tropePts = 0;
  const focalTropesLower = new Set(
    focal.tropes.filter(isSpecificNarrativeTrope).map((t) => t.toLowerCase())
  );
  for (const trope of candidate.tropes) {
    if (
      isSpecificNarrativeTrope(trope) &&
      focalTropesLower.has(trope.toLowerCase())
    ) {
      const added = Math.min(12, Math.max(0, 35 - tropePts));
      tropePts = Math.min(35, tropePts + 12);
      sharedConnections.push({
        id: `trope-${trope.toLowerCase()}`,
        label: `Theme: ${trope}`,
        prefix: 'Theme',
        value: trope,
        category: 'TROPE',
        entityType: 'TROPE',
        points: added || 12,
        color: ENTITY_COLORS.TROPE.primary,
      });
    }
  }

  // 2. Director & Screenwriter (+25 pts Director/Showrunner, +15 pts Writer/Creator, Max 25 pts)
  let auteurPts = 0;
  for (const dir of candidate.directors) {
    if (!isValidPersonName(dir)) continue;
    if (focal.directors.includes(dir)) {
      auteurPts = Math.min(25, auteurPts + 25);
      sharedConnections.push({
        id: `dir-${dir}`,
        label: `Director: ${dir}`,
        prefix: 'Director',
        value: dir,
        category: 'AUTEUR',
        entityType: 'DIRECTOR',
        entityNodeId: toEntityNodeId('DIRECTOR', dir),
        points: 25,
        color: ENTITY_COLORS.DIRECTOR.primary,
      });
    } else if (focal.writers.includes(dir)) {
      auteurPts = Math.min(25, auteurPts + 15);
      sharedConnections.push({
        id: `creator-${dir}`,
        label: `Creator: ${dir}`,
        prefix: 'Creator',
        value: dir,
        category: 'AUTEUR',
        entityType: 'DIRECTOR',
        entityNodeId: toEntityNodeId('DIRECTOR', dir),
        points: 15,
        color: ENTITY_COLORS.DIRECTOR.primary,
      });
    }
  }

  for (const writer of candidate.writers) {
    if (!isValidPersonName(writer)) continue;
    const alreadyCounted = sharedConnections.some(
      (c) => c.category === 'AUTEUR' && c.value === writer
    );
    if (
      !alreadyCounted &&
      (focal.writers.includes(writer) || focal.directors.includes(writer))
    ) {
      auteurPts = Math.min(25, auteurPts + 15);
      sharedConnections.push({
        id: `writer-${writer}`,
        label: `Writer: ${writer}`,
        prefix: 'Writer',
        value: writer,
        category: 'AUTEUR',
        entityType: 'DIRECTOR',
        entityNodeId: toEntityNodeId('DIRECTOR', writer),
        points: 15,
        color: ENTITY_COLORS.DIRECTOR.primary,
      });
    }
  }

  // 4. Shared Cast (+16 pts for #1/#2 billed LEAD, +6 pts for supporting cast, Max 24 pts)
  let castPts = 0;
  for (const member of candidate.cast) {
    if (!isValidPersonName(member.name)) continue;
    const focalMatch = focal.cast.find((f) => f.name === member.name);
    if (focalMatch) {
      const isLead =
        focalMatch.billing === 'LEAD' || member.billing === 'LEAD';
      const pts = isLead ? 16 : 6;
      castPts = Math.min(24, castPts + pts);
      sharedConnections.push({
        id: `cast-${member.name}`,
        label: `${isLead ? 'Starring' : 'Cast'}: ${member.name}`,
        prefix: isLead ? 'Starring' : 'Cast',
        value: member.name,
        category: 'CAST',
        entityType: 'ACTOR',
        entityNodeId: toEntityNodeId('ACTOR', member.name),
        points: pts,
        color: ENTITY_COLORS.ACTOR.primary,
      });
    }
  }

  // 5. Score & Cinematography (+6 pts shared Composer, +4 pts shared Cinematographer, Max 10 pts)
  let sonicVisualPts = 0;
  for (const comp of candidate.composers) {
    if (!isValidPersonName(comp)) continue;
    if (focal.composers.includes(comp)) {
      sonicVisualPts = Math.min(10, sonicVisualPts + 6);
      sharedConnections.push({
        id: `comp-${comp}`,
        label: `Composer: ${comp}`,
        prefix: 'Score',
        value: comp,
        category: 'SONIC_VISUAL',
        entityType: 'COMPOSER',
        points: 6,
        color: ENTITY_COLORS.COMPOSER.primary,
      });
    }
  }

  for (const dp of candidate.cinematographers) {
    if (!isValidPersonName(dp)) continue;
    if (focal.cinematographers.includes(dp)) {
      sonicVisualPts = Math.min(10, sonicVisualPts + 4);
      sharedConnections.push({
        id: `dp-${dp}`,
        label: `Cinematography: ${dp}`,
        prefix: 'Camera',
        value: dp,
        category: 'SONIC_VISUAL',
        entityType: 'COMPOSER',
        points: 4,
        color: ENTITY_COLORS.COMPOSER.primary,
      });
    }
  }

  // Require at least one concrete craft or narrative connection.
  // Broad genres and audience co-watch overlap never inflate scores or create links.
  const hasConcrete =
    tropePts > 0 || auteurPts > 0 || castPts > 0 || sonicVisualPts > 0;

  if (!hasConcrete) {
    const zeroResult: SimilarityBreakdown = {
      totalScore: 0,
      rawPoints: {
        tropes: 0,
        auteur: 0,
        genres: 0,
        cast: 0,
        sonicVisual: 0,
        coWatch: 0,
      },
      sharedConnections: [],
      linkDistance: 240,
    };
    similarityCache.set(cacheKey, zeroResult);
    return zeroResult;
  }

  const genrePts = 0;
  const coWatchPts = 0;

  // Apply Curatorial Lens Presets strictly to concrete shared connections
  let weightedTotal =
    tropePts + auteurPts + castPts + sonicVisualPts;

  if (preset === 'VIBE_TROPES') {
    weightedTotal =
      tropePts * 1.15 +
      auteurPts * 1.0 +
      castPts * 1.0 +
      sonicVisualPts * 1.0;
  } else if (preset === 'AUTEUR_ORBIT') {
    weightedTotal =
      tropePts * 0.75 +
      auteurPts * 2.0 +
      sonicVisualPts * 2.0 +
      castPts * 0.9;
  } else if (preset === 'STAR_CONSTELLATION') {
    weightedTotal =
      castPts * 3.0 +
      tropePts * 0.8 +
      auteurPts * 0.95 +
      sonicVisualPts * 0.95;
  }

  const totalScore = Math.max(1, Math.min(99, Math.round(weightedTotal)));

  sharedConnections.sort((a, b) => b.points - a.points);

  const linkDistance = Math.max(48, Math.round(180 - totalScore * 1.2));

  const result: SimilarityBreakdown = {
    totalScore,
    rawPoints: {
      tropes: tropePts,
      auteur: auteurPts,
      genres: genrePts,
      cast: castPts,
      sonicVisual: sonicVisualPts,
      coWatch: coWatchPts,
    },
    sharedConnections,
    linkDistance,
  };
  similarityCache.set(cacheKey, result);
  return result;
}

/**
 * Deterministic 3D spherical Fibonacci distribution for initial spatial coordinates
 */
function seededSphericalPosition(
  index: number,
  total: number,
  radius: number
): { x: number; y: number; z: number } {
  const phi = Math.acos(1 - (2 * (index + 0.5)) / Math.max(total, 1));
  const theta = Math.PI * (1 + Math.sqrt(5)) * (index + 0.5);
  return {
    x: radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.sin(phi) * Math.sin(theta) * 0.78,
    z: radius * Math.cos(phi),
  };
}

export interface BuildGraphOptions {
  items: MediaItem[];
  focalId: string | null;
  preset: GravityPreset;
  mediaFilter: 'ALL' | 'MOVIE' | 'TV';
  forceSettings: ForceSettings;
  visibility: EntityVisibility;
  searchQuery?: string;
  graphScope?: GraphScopeMode;
  watchedIds?: string[];
  interestedIds?: string[];
  suggestedMediaIds?: string[];
  graphFilters?: GraphFilterState;
  layoutMode?: GraphLayoutMode;
  colorMode?: NodeColorMode;
  sizeMode?: NodeSizeMode;
  precomputedUmapPoints?: Record<string, PrecomputedUmapPoint>;
  theme?: AppTheme;
}

/**
 * Enhances pairwise similarity for a user's personal Watched Graph when two watched titles
 * share a primary/secondary genre or co-watch kinship, so smaller personal watched collections
 * still form a rich, navigable constellation alongside concrete shared craft bridges.
 */
function calculatePersonalGraphSimilarity(
  itemA: MediaItem,
  itemB: MediaItem,
  preset: GravityPreset
): SimilarityBreakdown {
  const base = calculateSimilarity(itemA, itemB, preset);
  if (hasConcreteSharedConnection(base) && base.totalScore > 0) {
    return base;
  }

  const sharedGenres = itemA.genres.filter((g) =>
    itemB.genres.some((bg) => bg.toLowerCase() === g.toLowerCase())
  );
  const primaryMatches =
    itemA.primaryGenre.toLowerCase() === itemB.primaryGenre.toLowerCase();

  if (sharedGenres.length === 0 && !primaryMatches) {
    return base;
  }

  const genrePts = Math.min(
    18,
    sharedGenres.length * 6 + (primaryMatches ? 6 : 0)
  );
  const topGenre = primaryMatches
    ? itemA.primaryGenre
    : sharedGenres[0] || itemA.primaryGenre;

  const conn: SharedConnection = {
    id: `genre-${topGenre.toLowerCase()}`,
    label: `Genre: ${topGenre}`,
    prefix: 'Genre',
    value: topGenre,
    category: 'GENRE',
    entityType: 'TROPE',
    points: genrePts,
    color: ENTITY_COLORS.TROPE.primary,
  };

  const totalScore = Math.max(14, Math.min(48, genrePts + 8));
  return {
    totalScore,
    rawPoints: {
      tropes: 0,
      auteur: 0,
      genres: genrePts,
      cast: 0,
      sonicVisual: 0,
      coWatch: 0,
    },
    sharedConnections: [conn],
    linkDistance: Math.max(85, Math.round(180 - totalScore * 1.1)),
  };
}

export function buildSpatialGraph({
  items,
  focalId,
  preset,
  mediaFilter,
  forceSettings,
  visibility,
  graphScope = 'FULL_ARCHIVE',
  watchedIds = [],
  interestedIds = [],
  suggestedMediaIds = [],
  graphFilters = DEFAULT_GRAPH_FILTERS,
  layoutMode = 'SEMANTIC_GALAXY',
  colorMode = 'CATEGORY',
  sizeMode = 'RATING',
  precomputedUmapPoints,
  theme = 'MOVIE_MAP_DARK',
}: BuildGraphOptions): {
  nodes: GraphNode[];
  links: GraphLink[];
  focalItem: MediaItem | null;
  rankedMatches: Array<{ item: MediaItem; similarity: SimilarityBreakdown }>;
  clusters: SemanticCluster[];
  matchingMediaCount: number;
} {
  const activeEntityColors =
    theme === 'MOVIE_MAP_DARK' ? MOVIE_MAP_DARK_ENTITY_COLORS : ENTITY_COLORS;
  const watchedSet = new Set(watchedIds);
  const interestedSet = new Set(interestedIds);
  const suggestedSet = new Set(suggestedMediaIds);
  const isPersonalGraph =
    graphScope === 'WATCHED_ONLY' ||
    graphScope === 'INTERESTED_ONLY' ||
    graphScope === 'WATCHED_AND_INTERESTED' ||
    graphScope === 'WATCHED_PLUS_SUGGESTIONS';

  const nearestNeighborsMap = computeNearestNeighbors(items, preset);

  // Precompute semantic cluster membership map for all items
  const itemClusterMap = new Map<
    string,
    {
      primary: typeof SEMANTIC_CLUSTER_DEFINITIONS[0];
      secondary: typeof SEMANTIC_CLUSTER_DEFINITIONS[0];
      blendRatio: number;
    }
  >();
  for (const item of items) {
    itemClusterMap.set(item.id, assignItemSemanticCluster(item, theme));
  }

  // Precompute filter match map for all items
  const filterMatchMap = new Map<string, boolean>();
  for (const item of items) {
    const isW = watchedSet.has(item.id);
    const isI = interestedSet.has(item.id);
    filterMatchMap.set(
      item.id,
      evaluateMediaItemFilterMatch(item, graphFilters, isW, isI)
    );
  }

  const scopedItems = items.filter((item) => {
    if (focalId && item.id === focalId) return true;
    if (graphScope === 'WATCHED_ONLY') {
      return watchedSet.has(item.id);
    }
    if (graphScope === 'INTERESTED_ONLY') {
      return interestedSet.has(item.id);
    }
    if (graphScope === 'WATCHED_AND_INTERESTED') {
      return watchedSet.has(item.id) || interestedSet.has(item.id);
    }
    if (graphScope === 'WATCHED_PLUS_SUGGESTIONS') {
      return watchedSet.has(item.id) || suggestedSet.has(item.id);
    }
    return true;
  });

  const matchingMediaCount = scopedItems.filter(
    (item) => filterMatchMap.get(item.id) ?? true
  ).length;

  const focalItem = focalId
    ? scopedItems.find((m) => m.id === focalId) ||
      items.find((m) => m.id === focalId) ||
      null
    : null;

  const nodesMap = new Map<string, GraphNode>();
  const links: GraphLink[] = [];

  // Helper to resolve node visual color according to NodeColorMode
  const resolveNodeColor = (
    item: MediaItem,
    isFilterMatch: boolean
  ): { color: string; glowColor: string } => {
    const clusterInfo = itemClusterMap.get(item.id);
    const blended = clusterInfo
      ? blendHexColors(
          clusterInfo.primary.color,
          clusterInfo.secondary.color,
          clusterInfo.blendRatio
        )
      : activeEntityColors[item.mediaType].primary;

    let baseColor = activeEntityColors[item.mediaType].primary;
    let baseGlow = activeEntityColors[item.mediaType].glow;

    if (colorMode === 'CLUSTER') {
      baseColor = blended;
      baseGlow = clusterInfo ? clusterInfo.primary.glowColor : blended;
    } else if (colorMode === 'GENRE') {
      baseColor = getGenreColor(item.primaryGenre);
      baseGlow = baseColor;
    } else if (colorMode === 'DECADE') {
      baseColor = getDecadeColor(item.year);
      baseGlow = baseColor;
    } else if (colorMode === 'WATCH_STATUS') {
      const isWatched = watchedSet.has(item.id);
      const isInterested = interestedSet.has(item.id);
      const isDarkTheme = theme === 'MOVIE_MAP_DARK';
      if (isWatched) {
        baseColor = isDarkTheme ? '#10B981' : '#2A6B53'; // Emerald Green
        baseGlow = isDarkTheme ? '#34D399' : '#3D9970';
      } else if (isInterested) {
        baseColor = isDarkTheme ? '#F59E0B' : '#B45309'; // Electric Amber Gold
        baseGlow = isDarkTheme ? '#FBBF24' : '#D97706';
      } else {
        baseColor = isDarkTheme ? '#475569' : '#8C827A'; // Muted Celestial Slate / Archival Taupe
        baseGlow = isDarkTheme ? '#1E293B' : '#C8BEAA';
      }
    }

    if (!isFilterMatch && graphFilters.filterBehavior === 'DIM') {
      // In DIM mode, preserve the node's visual color identity but softly mute it
      // so it remains clearly visible and grounded against the background
      const isDarkTheme = theme === 'MOVIE_MAP_DARK';
      return {
        color: isDarkTheme
          ? blendHexColors(baseColor, '#131A26', 0.55)
          : blendHexColors(baseColor, '#B5A892', 0.42),
        glowColor: isDarkTheme ? '#1A2436' : '#D5CCB9',
      };
    }

    return { color: baseColor, glowColor: baseGlow };
  };

  // Helper to resolve node radius according to NodeSizeMode (refined Obsidian graph scale)
  const resolveNodeRadius = (
    item: MediaItem,
    connectionCount: number
  ): number => {
    if (sizeMode === 'UNIFORM') return 3.6;
    if (sizeMode === 'CONNECTIONS') {
      return Math.min(5.8, Math.max(2.6, 2.6 + Math.sqrt(connectionCount) * 0.6));
    }
    // Default RATING: sleek Obsidian scale (3.0px - 5.2px)
    return 3.0 + Math.max(0, (item.imdbRating - 7.0) * 0.9);
  };

  // ==================== MODE A: GLOBAL OR PERSONAL ARCHIVE CONSTELLATION (NO SINGLE FOCAL ITEM) ====================
  if (!focalItem) {
    const filteredMedia = scopedItems.filter((item) => {
      // If graphFilters.filterBehavior is 'HIDE', completely exclude items that do not match filters
      if (
        graphFilters.filterBehavior === 'HIDE' &&
        filterMatchMap.get(item.id) === false
      ) {
        return false;
      }
      if (mediaFilter === 'MOVIE' && item.mediaType !== 'MOVIE') return false;
      if (mediaFilter === 'TV' && item.mediaType !== 'TV') return false;
      if (!visibility.MOVIE && item.mediaType === 'MOVIE') return false;
      if (!visibility.TV && item.mediaType === 'TV') return false;
      return true;
    });

    const effectiveThreshold = isPersonalGraph
      ? Math.min(12, forceSettings.matchThreshold)
      : Math.max(15, forceSettings.matchThreshold);

    // Compute pairwise similarities across all active media items
    const pairwiseMap = new Map<
      string,
      Array<{ target: MediaItem; similarity: SimilarityBreakdown }>
    >();

    for (const itemA of filteredMedia) {
      const peers: Array<{
        target: MediaItem;
        similarity: SimilarityBreakdown;
      }> = [];
      for (const itemB of filteredMedia) {
        if (itemA.id === itemB.id) continue;
        // In WATCHED_PLUS_SUGGESTIONS mode, suggested unwatched items should primarily link to watched items
        if (
          graphScope === 'WATCHED_PLUS_SUGGESTIONS' &&
          !watchedSet.has(itemA.id) &&
          !watchedSet.has(itemB.id)
        ) {
          continue;
        }
        const sim = isPersonalGraph
          ? calculatePersonalGraphSimilarity(itemA, itemB, preset)
          : calculateSimilarity(itemA, itemB, preset);
        const qualifies = isPersonalGraph
          ? (hasConcreteSharedConnection(sim) || sim.rawPoints.genres > 0) &&
            sim.totalScore >= effectiveThreshold
          : hasConcreteSharedConnection(sim) &&
            sim.totalScore >= effectiveThreshold;
        if (qualifies) {
          peers.push({ target: itemB, similarity: sim });
        }
      }
      peers.sort((a, b) => b.similarity.totalScore - a.similarity.totalScore);
      pairwiseMap.set(itemA.id, peers);
    }

    // Build synthesized global connectivity breakdown for each media item
    const rankedMatches: Array<{
      item: MediaItem;
      similarity: SimilarityBreakdown;
    }> = filteredMedia.map((item) => {
      const peers = pairwiseMap.get(item.id) || [];
      const topPeers = peers.slice(0, 3);
      const avgTopScore =
        topPeers.length > 0
          ? Math.round(
              topPeers.reduce((acc, p) => acc + p.similarity.totalScore, 0) /
                topPeers.length
            )
          : 0;

      // Aggregate unique highest-value shared connections across top connected peers
      const connMap = new Map<string, SharedConnection>();
      for (const p of peers.slice(0, 5)) {
        for (const conn of p.similarity.sharedConnections) {
          if (!connMap.has(conn.id)) {
            connMap.set(conn.id, conn);
          }
        }
      }
      const aggregatedConnections = Array.from(connMap.values()).sort(
        (a, b) => b.points - a.points
      );

      const rawAvg = {
        tropes:
          topPeers.length > 0
            ? Math.round(
                topPeers.reduce(
                  (s, p) => s + p.similarity.rawPoints.tropes,
                  0
                ) / topPeers.length
              )
            : 0,
        auteur:
          topPeers.length > 0
            ? Math.round(
                topPeers.reduce(
                  (s, p) => s + p.similarity.rawPoints.auteur,
                  0
                ) / topPeers.length
              )
            : 0,
        genres:
          topPeers.length > 0
            ? Math.round(
                topPeers.reduce(
                  (s, p) => s + p.similarity.rawPoints.genres,
                  0
                ) / topPeers.length
              )
            : 0,
        cast:
          topPeers.length > 0
            ? Math.round(
                topPeers.reduce((s, p) => s + p.similarity.rawPoints.cast, 0) /
                  topPeers.length
              )
            : 0,
        sonicVisual:
          topPeers.length > 0
            ? Math.round(
                topPeers.reduce(
                  (s, p) => s + p.similarity.rawPoints.sonicVisual,
                  0
                ) / topPeers.length
              )
            : 0,
        coWatch:
          topPeers.length > 0
            ? Math.round(
                topPeers.reduce(
                  (s, p) => s + p.similarity.rawPoints.coWatch,
                  0
                ) / topPeers.length
              )
            : 0,
      };

      const linkDistance =
        topPeers.length > 0
          ? Math.max(68, Math.round(185 - avgTopScore * 1.1))
          : 245;

      return {
        item,
        similarity: {
          totalScore: avgTopScore,
          rawPoints: rawAvg,
          sharedConnections: aggregatedConnections,
          linkDistance,
        },
      };
    });

    rankedMatches.sort(
      (a, b) =>
        b.similarity.totalScore - a.similarity.totalScore ||
        b.item.imdbRating - a.item.imdbRating
    );

    const addedPairLinks = new Set<string>();
    const connectedMediaByNode = new Map<string, Set<string>>();
    for (const item of filteredMedia) {
      connectedMediaByNode.set(item.id, new Set([item.id]));
    }

    for (const item of filteredMedia) {
      const peers = pairwiseMap.get(item.id) || [];
      let countForNode = 0;
      for (const peer of peers) {
        if (countForNode >= (isPersonalGraph ? 6 : 5)) break;
        const qualifies = isPersonalGraph
          ? (hasConcreteSharedConnection(peer.similarity) ||
              peer.similarity.rawPoints.genres > 0) &&
            peer.similarity.totalScore >= effectiveThreshold
          : hasConcreteSharedConnection(peer.similarity) &&
            peer.similarity.totalScore >= effectiveThreshold;
        if (!qualifies) {
          continue;
        }

        const pairKey =
          item.id < peer.target.id
            ? `${item.id}<->${peer.target.id}`
            : `${peer.target.id}<->${item.id}`;

        connectedMediaByNode.get(item.id)?.add(peer.target.id);
        connectedMediaByNode.get(peer.target.id)?.add(item.id);
        countForNode++;

        if (!addedPairLinks.has(pairKey)) {
          addedPairLinks.add(pairKey);
          const effectiveDistance =
            peer.similarity.linkDistance * forceSettings.linkDistanceMultiplier;
          links.push({
            id: `sim:${pairKey}`,
            source: item.id,
            target: peer.target.id,
            kind: 'SIMILARITY_DIRECT',
            entityType: item.mediaType,
            label: `${peer.similarity.totalScore}% Affinity`,
            weight: peer.similarity.totalScore / 100,
            distance: effectiveDistance,
            color:
              peer.similarity.totalScore >= 75
                ? '#B8292F'
                : peer.similarity.totalScore >= 50
                  ? '#234B6E'
                  : '#8C8070',
            mediaIds: [item.id, peer.target.id],
          });
        }
      }
    }

    rankedMatches.forEach(({ item, similarity }, idx) => {
      const isWatched = watchedSet.has(item.id);
      const isInterested = interestedSet.has(item.id);
      const isSuggested =
        !isWatched &&
        !isInterested &&
        graphScope === 'WATCHED_PLUS_SUGGESTIONS' &&
        suggestedSet.has(item.id);
      const isFilterMatch = filterMatchMap.get(item.id) ?? true;
      const clusterInfo = itemClusterMap.get(item.id);
      const precomputed = precomputedUmapPoints?.[item.id];
      const nearestNeighbors =
        precomputed?.nearestNeighborIds && precomputed.nearestNeighborIds.length > 0
          ? precomputed.nearestNeighborIds
          : nearestNeighborsMap.get(item.id) || [];
      const connectionsCount = connectedMediaByNode.get(item.id)?.size || 1;

      const isUnlinked =
        !isPersonalGraph &&
        connectionsCount <= 1;
      const shellOffset = (idx % 3) * 24;
      const baseRadius = isUnlinked
        ? 245 * forceSettings.linkDistanceMultiplier
        : isPersonalGraph
          ? (68 +
              (idx / Math.max(1, rankedMatches.length - 1)) * 68 +
              (isSuggested ? 34 : (idx % 2) * 14)) *
            forceSettings.linkDistanceMultiplier
          : (82 +
              (idx / Math.max(1, rankedMatches.length - 1)) * 78 +
              shellOffset) *
            forceSettings.linkDistanceMultiplier;

      let posX = 0;
      let posY = 0;
      let posZ = 0;

      if (layoutMode === 'SEMANTIC_GALAXY') {
        if (precomputed) {
          posX = precomputed.x * forceSettings.linkDistanceMultiplier;
          posY = precomputed.y * forceSettings.linkDistanceMultiplier;
          posZ = precomputed.z * forceSettings.zRepulsion;
        } else if (clusterInfo) {
          // Position relative to its HDBSCAN semantic cluster centroid
          // with boundary pull toward its secondary cluster
          const c1 = clusterInfo.primary.centroid;
          const c2 = clusterInfo.secondary.centroid;
          const pull = clusterInfo.blendRatio; // 0 to 0.45
          const baseX = c1.x * (1 - pull) + c2.x * pull;
          const baseY = c1.y * (1 - pull) + c2.y * pull;
          const baseZ = c1.z * (1 - pull) + c2.z * pull;

          // Local cluster dispersion via seeded golden spiral
          const localSpread = 44 * forceSettings.linkDistanceMultiplier;
          const theta = idx * 2.399963; // Golden angle
          const r = Math.sqrt((idx % 19) + 1) * (localSpread / 4.0);
          posX = baseX + r * Math.cos(theta);
          posY = baseY + r * Math.sin(theta);
          posZ = baseZ + ((idx % 7) - 3) * 8 * forceSettings.zRepulsion;
        }
      } else {
        // Constellation layout: anchor each title at its genre centroid with relational network spacing
        const c = clusterInfo?.primary.centroid || { x: 0, y: 0, z: 0 };
        const golden = idx * 2.399963;
        const localSpread = 54 * forceSettings.linkDistanceMultiplier;
        const r = Math.sqrt((idx % 19) + 1) * (localSpread / 3.8);
        posX = c.x + r * Math.cos(golden);
        posY = c.y + r * Math.sin(golden);
        posZ = c.z + ((idx % 7) - 3) * 14 * forceSettings.zRepulsion;
      }

      const { color: nodeColor, glowColor: nodeGlow } = resolveNodeColor(
        item,
        isFilterMatch
      );
      const nodeRadius = resolveNodeRadius(item, connectionsCount);

      const statusSuffix = isSuggested
        ? ' · Suggested Match'
        : isWatched
          ? ' · ✓ Watched'
          : isInterested
            ? ' · ★ Want to Watch'
            : '';

      const blendedColor = clusterInfo
        ? blendHexColors(
            clusterInfo.primary.color,
            clusterInfo.secondary.color,
            clusterInfo.blendRatio
          )
        : nodeColor;

      nodesMap.set(item.id, {
        id: item.id,
        label: item.title,
        subLabel: `${item.year} · IMDb ${item.imdbRating.toFixed(1)} · ${item.primaryGenre}${statusSuffix}`,
        type: item.mediaType,
        isFocal: false,
        isWatched,
        isInterested,
        isSuggested,
        isFilterMatch,
        clusterId: clusterInfo?.primary.id,
        clusterLabel: clusterInfo?.primary.label,
        clusterColor: clusterInfo?.primary.color,
        secondaryClusterColor: clusterInfo?.secondary.color,
        blendedClusterColor: blendedColor,
        connectionCount: connectionsCount,
        nearestNeighborIds: nearestNeighbors,
        matchScore: undefined,
        similarity,
        mediaItem: item,
        color: nodeColor,
        glowColor: nodeGlow,
        radius: nodeRadius,
        x: posX,
        y: posY,
        z: posZ,
        vx: 0,
        vy: 0,
        vz: 0,
        connectedMediaIds: Array.from(
          connectedMediaByNode.get(item.id) || [item.id]
        ),
      });
    });

    interface EntityAccumulator {
      id: string;
      label: string;
      subLabel: string;
      type: EntityNodeType;
      mediaIds: Set<string>;
    }

    const entityAcc = new Map<string, EntityAccumulator>();

    const registerEntity = (
      type: EntityNodeType,
      name: string,
      subLabel: string,
      mediaId: string
    ) => {
      if (!visibility[type]) return;
      if (type === 'TROPE' || type === 'COMPOSER') return;
      if (!isValidPersonName(name)) return;
      const id = toEntityNodeId(type, name);
      const existing = entityAcc.get(id);
      if (existing) {
        existing.mediaIds.add(mediaId);
      } else {
        entityAcc.set(id, {
          id,
          label: name,
          subLabel,
          type,
          mediaIds: new Set([mediaId]),
        });
      }
    };

    for (const media of filteredMedia) {
      // In full archive mode, do not register entity bridge links for unlinked standalone titles;
      // in Personal Graph mode, always inspect all watched/suggested titles so shared collaborators & themes bridge them.
      if (
        !isPersonalGraph &&
        (connectedMediaByNode.get(media.id)?.size || 1) <= 1
      ) {
        continue;
      }
      for (const dir of media.directors) {
        registerEntity('DIRECTOR', dir, 'Director / Showrunner', media.id);
      }
      for (const writer of media.writers) {
        if (!media.directors.includes(writer)) {
          registerEntity('DIRECTOR', writer, 'Screenwriter / Creator', media.id);
        }
      }
      for (const actor of media.cast.slice(0, isPersonalGraph ? 5 : 3)) {
        registerEntity(
          'ACTOR',
          actor.name,
          actor.billing === 'LEAD' ? 'Lead Role' : 'Supporting Role',
          media.id
        );
      }
    }

    const validEntities = Array.from(entityAcc.values())
      .map((ent) => {
        if (isPersonalGraph) {
          return ent;
        }
        // Keep only mediaIds that share a threshold-verified similarity link with another member of this entity
        const allIds = Array.from(ent.mediaIds);
        const linkedSubset = allIds.filter((idA) =>
          allIds.some(
            (idB) =>
              idA !== idB &&
              (pairwiseMap
                .get(idA)
                ?.some(
                  (p) =>
                    p.target.id === idB &&
                    p.similarity.totalScore >= effectiveThreshold
                ) ??
                false)
          )
        );
        return {
          ...ent,
          mediaIds: new Set(linkedSubset),
        };
      })
      .filter((ent) => ent.mediaIds.size >= 2);

    validEntities.forEach((ent, idx) => {
      const connectedIds = Array.from(ent.mediaIds);
      let avgX = 0;
      let avgY = 0;
      let avgZ = 0;
      let count = 0;
      for (const mId of connectedIds) {
        const mNode = nodesMap.get(mId);
        if (mNode) {
          avgX += mNode.x;
          avgY += mNode.y;
          avgZ += mNode.z;
          count++;
        }
      }
      if (count > 0) {
        avgX /= count;
        avgY /= count;
        avgZ /= count;
      }
      const jitter = seededSphericalPosition(idx, validEntities.length, 28);

      nodesMap.set(ent.id, {
        id: ent.id,
        label: ent.label,
        subLabel: `${ent.subLabel} · ${connectedIds.length} Titles`,
        type: ent.type,
        isFocal: false,
        color: activeEntityColors[ent.type].primary,
        glowColor: activeEntityColors[ent.type].glow,
        radius:
          ent.type === 'DIRECTOR'
            ? 2.8
            : ent.type === 'TROPE'
              ? 2.4
              : ent.type === 'COMPOSER'
                ? 2.3
                : 2.2,
        x: avgX * 0.88 + jitter.x,
        y: avgY * 0.88 + jitter.y,
        z: (avgZ * 0.88 + jitter.z) * forceSettings.zRepulsion,
        vx: 0,
        vy: 0,
        vz: 0,
        connectedMediaIds: connectedIds,
      });

      for (const mId of connectedIds) {
        const mNode = nodesMap.get(mId);
        if (mNode) {
          const merged = new Set([...mNode.connectedMediaIds, ...connectedIds]);
          mNode.connectedMediaIds = Array.from(merged);
        }
        links.push({
          id: `bridge:${ent.id}<->${mId}`,
          source: ent.id,
          target: mId,
          kind: 'ENTITY_BRIDGE',
          entityType: ent.type,
          label: `${ent.subLabel}: ${ent.label}`,
          weight: 0.65,
          distance: 58 * forceSettings.linkDistanceMultiplier,
          color: ENTITY_COLORS[ent.type].primary,
          mediaIds: connectedIds,
        });
      }
    });

    // Build active semantic clusters list with associated mediaIds for canvas territory banners
    const activeClusters: SemanticCluster[] = SEMANTIC_CLUSTER_DEFINITIONS.map(
      (def) => {
        const clusterMediaIds = filteredMedia
          .filter((m) => itemClusterMap.get(m.id)?.primary.id === def.id)
          .map((m) => m.id);

        let centroid = def.centroid;
        if (clusterMediaIds.length > 0) {
          let sumX = 0;
          let sumY = 0;
          let sumZ = 0;
          let count = 0;
          for (const mId of clusterMediaIds) {
            const n = nodesMap.get(mId);
            if (n) {
              sumX += n.x;
              sumY += n.y;
              sumZ += n.z;
              count++;
            }
          }
          if (count > 0) {
            centroid = {
              x: Math.round(sumX / count),
              y: Math.round(sumY / count),
              z: Math.round(sumZ / count),
            };
          }
        }

        const darkPalette = MOVIE_MAP_DARK_CLUSTER_COLORS[def.id];
        const color =
          theme === 'MOVIE_MAP_DARK' && darkPalette ? darkPalette.color : def.color;
        const glowColor =
          theme === 'MOVIE_MAP_DARK' && darkPalette
            ? darkPalette.glowColor
            : def.glowColor;

        return {
          id: def.id,
          label: def.label,
          shortLabel: def.shortLabel,
          description: def.description,
          color,
          glowColor,
          centroid,
          keywords: def.keywords,
          genres: def.genres,
          mediaIds: clusterMediaIds,
        };
      }
    );

    return {
      nodes: Array.from(nodesMap.values()),
      links,
      focalItem: null,
      rankedMatches,
      clusters: activeClusters,
      matchingMediaCount,
    };
  }

  // ==================== MODE B: SINGLE FOCAL TITLE MODE ====================
  const allScored = scopedItems
    .filter((item) => {
      if (item.id === focalItem.id) return true;
      if (mediaFilter === 'MOVIE' && item.mediaType !== 'MOVIE') return false;
      if (mediaFilter === 'TV' && item.mediaType !== 'TV') return false;
      if (!visibility.MOVIE && item.mediaType === 'MOVIE') return false;
      if (!visibility.TV && item.mediaType === 'TV') return false;
      return true;
    })
    .map((item) => ({
      item,
      similarity: isPersonalGraph
        ? calculatePersonalGraphSimilarity(focalItem, item, preset)
        : calculateSimilarity(focalItem, item, preset),
    }))
    .filter(
      (entry) =>
        entry.item.id === focalItem.id ||
        ((hasConcreteSharedConnection(entry.similarity) ||
          (isPersonalGraph && entry.similarity.rawPoints.genres > 0)) &&
          entry.similarity.totalScore >=
            (isPersonalGraph
              ? Math.min(12, forceSettings.matchThreshold)
              : forceSettings.matchThreshold))
    );

  const rankedMatches = allScored
    .filter((e) => e.item.id !== focalItem.id)
    .sort((a, b) => b.similarity.totalScore - a.similarity.totalScore);

  // 1. Add Focal Centerpiece Node at origin (0, 0, 0)
  const focalClusterInfo = itemClusterMap.get(focalItem.id);
  const focalNearestNeighbors = nearestNeighborsMap.get(focalItem.id) || [];
  const focalBlended = focalClusterInfo
    ? blendHexColors(
        focalClusterInfo.primary.color,
        focalClusterInfo.secondary.color,
        focalClusterInfo.blendRatio
      )
    : '#B8292F';

  nodesMap.set(focalItem.id, {
    id: focalItem.id,
    label: focalItem.title,
    subLabel: `${focalItem.year} · Selected Title`,
    type: focalItem.mediaType,
    isFocal: true,
    isWatched: watchedSet.has(focalItem.id),
    isInterested: interestedSet.has(focalItem.id),
    isSuggested:
      !watchedSet.has(focalItem.id) &&
      graphScope === 'WATCHED_PLUS_SUGGESTIONS' &&
      suggestedSet.has(focalItem.id),
    isFilterMatch: filterMatchMap.get(focalItem.id) ?? true,
    clusterId: focalClusterInfo?.primary.id,
    clusterLabel: focalClusterInfo?.primary.label,
    clusterColor: focalClusterInfo?.primary.color,
    secondaryClusterColor: focalClusterInfo?.secondary.color,
    blendedClusterColor: focalBlended,
    connectionCount: rankedMatches.length,
    nearestNeighborIds: focalNearestNeighbors,
    matchScore: 100,
    similarity: calculateSimilarity(focalItem, focalItem, preset),
    mediaItem: focalItem,
    color: '#B8292F',
    glowColor: '#D43D43',
    radius: 6.8,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    fx: 0,
    fy: 0,
    fz: 0,
    connectedMediaIds: [focalItem.id],
  });

  // 2. Add Recommended Film / Series Nodes
  rankedMatches.forEach(({ item, similarity }, idx) => {
    const isWatched = watchedSet.has(item.id);
    const isInterested = interestedSet.has(item.id);
    const isSuggested =
      !isWatched &&
      graphScope === 'WATCHED_PLUS_SUGGESTIONS' &&
      suggestedSet.has(item.id);
    const isFilterMatch = filterMatchMap.get(item.id) ?? true;
    const clusterInfo = itemClusterMap.get(item.id);
    const nearestNeighbors = nearestNeighborsMap.get(item.id) || [];

    const effectiveDistance =
      similarity.linkDistance * forceSettings.linkDistanceMultiplier;
    const pos = seededSphericalPosition(
      idx,
      rankedMatches.length,
      effectiveDistance
    );
    const zScaled = pos.z * forceSettings.zRepulsion;

    const { color: nodeColor, glowColor: nodeGlow } = resolveNodeColor(
      item,
      isFilterMatch
    );
    const nodeRadius =
      sizeMode === 'UNIFORM'
        ? 8.0
        : 6.5 + (similarity.totalScore / 100) * 4.5;

    const blendedColor = clusterInfo
      ? blendHexColors(
          clusterInfo.primary.color,
          clusterInfo.secondary.color,
          clusterInfo.blendRatio
        )
      : nodeColor;

    nodesMap.set(item.id, {
      id: item.id,
      label: item.title,
      subLabel: `${item.year} · ${similarity.totalScore}% Match${isWatched ? ' · ✓ Watched' : isInterested ? ' · ★ Want to Watch' : ''}`,
      type: item.mediaType,
      isFocal: false,
      isWatched,
      isInterested,
      isSuggested,
      isFilterMatch,
      clusterId: clusterInfo?.primary.id,
      clusterLabel: clusterInfo?.primary.label,
      clusterColor: clusterInfo?.primary.color,
      secondaryClusterColor: clusterInfo?.secondary.color,
      blendedClusterColor: blendedColor,
      connectionCount: 1,
      nearestNeighborIds: nearestNeighbors,
      matchScore: similarity.totalScore,
      similarity,
      mediaItem: item,
      color: nodeColor,
      glowColor: nodeGlow,
      radius: nodeRadius,
      x: pos.x,
      y: pos.y,
      z: zScaled,
      vx: 0,
      vy: 0,
      vz: 0,
      connectedMediaIds: [item.id, focalItem.id],
    });

    links.push({
      id: `sim:${focalItem.id}->${item.id}`,
      source: focalItem.id,
      target: item.id,
      kind: 'SIMILARITY_DIRECT',
      entityType: item.mediaType,
      label: `${similarity.totalScore}% Match`,
      weight: similarity.totalScore / 100,
      distance: effectiveDistance,
      color:
        similarity.totalScore >= 75
          ? '#B8292F'
          : similarity.totalScore >= 50
            ? '#234B6E'
            : '#8C8070',
      mediaIds: [focalItem.id, item.id],
    });
  });

  // 3. Collect Shared Collaborator & Theme Nodes
  interface EntityAccumulator {
    id: string;
    label: string;
    subLabel: string;
    type: EntityNodeType;
    mediaIds: Set<string>;
  }

  const entityAcc = new Map<string, EntityAccumulator>();

  const registerEntity = (
    type: EntityNodeType,
    name: string,
    subLabel: string,
    mediaId: string
  ) => {
    if (!visibility[type]) return;
    if (type === 'TROPE' || type === 'COMPOSER') return;
    if (!isValidPersonName(name)) return;
    const id = toEntityNodeId(type, name);
    const existing = entityAcc.get(id);
    if (existing) {
      existing.mediaIds.add(mediaId);
    } else {
      entityAcc.set(id, {
        id,
        label: name,
        subLabel,
        type,
        mediaIds: new Set([mediaId]),
      });
    }
  };

  const activeMediaItems = [
    focalItem,
    ...rankedMatches.map((r) => r.item),
  ];

  for (const media of activeMediaItems) {
    for (const dir of media.directors) {
      registerEntity('DIRECTOR', dir, 'Director / Showrunner', media.id);
    }
    for (const writer of media.writers) {
      if (!media.directors.includes(writer)) {
        registerEntity('DIRECTOR', writer, 'Screenwriter / Creator', media.id);
      }
    }
    for (const actor of media.cast.slice(0, 3)) {
      registerEntity(
        'ACTOR',
        actor.name,
        actor.billing === 'LEAD' ? 'Lead Role' : 'Supporting Role',
        media.id
      );
    }
  }

  const validEntities = Array.from(entityAcc.values()).filter(
    (ent) => ent.mediaIds.size >= 2
  );

  validEntities.forEach((ent, idx) => {
    const connectedIds = Array.from(ent.mediaIds);
    let avgX = 0;
    let avgY = 0;
    let avgZ = 0;
    let count = 0;
    for (const mId of connectedIds) {
      const mNode = nodesMap.get(mId);
      if (mNode) {
        avgX += mNode.x;
        avgY += mNode.y;
        avgZ += mNode.z;
        count++;
      }
    }
    if (count > 0) {
      avgX /= count;
      avgY /= count;
      avgZ /= count;
    }
    const jitter = seededSphericalPosition(idx, validEntities.length, 32);

    nodesMap.set(ent.id, {
      id: ent.id,
      label: ent.label,
      subLabel: `${ent.subLabel} · ${connectedIds.length} Titles`,
      type: ent.type,
      isFocal: false,
      color: ENTITY_COLORS[ent.type].primary,
      glowColor: ENTITY_COLORS[ent.type].glow,
      radius:
        ent.type === 'DIRECTOR'
          ? 2.8
          : ent.type === 'TROPE'
            ? 2.4
            : ent.type === 'COMPOSER'
              ? 2.3
              : 2.2,
      x: avgX * 0.85 + jitter.x,
      y: avgY * 0.85 + jitter.y,
      z: (avgZ * 0.85 + jitter.z) * forceSettings.zRepulsion,
      vx: 0,
      vy: 0,
      vz: 0,
      connectedMediaIds: connectedIds,
    });

    for (const mId of connectedIds) {
      const mNode = nodesMap.get(mId);
      if (mNode) {
        const merged = new Set([...mNode.connectedMediaIds, ...connectedIds]);
        mNode.connectedMediaIds = Array.from(merged);
      }
      links.push({
        id: `bridge:${ent.id}<->${mId}`,
        source: ent.id,
        target: mId,
        kind: 'ENTITY_BRIDGE',
        entityType: ent.type,
        label: `${ent.subLabel}: ${ent.label}`,
        weight: 0.65,
        distance: 58 * forceSettings.linkDistanceMultiplier,
        color: ENTITY_COLORS[ent.type].primary,
        mediaIds: connectedIds,
      });
    }
  });

  // Active semantic clusters for focal mode
  const activeClusters: SemanticCluster[] = SEMANTIC_CLUSTER_DEFINITIONS.map(
    (def) => {
      const clusterMediaIds = [focalItem, ...rankedMatches.map((r) => r.item)]
        .filter((m) => itemClusterMap.get(m.id)?.primary.id === def.id)
        .map((m) => m.id);

      let centroid = def.centroid;
      if (clusterMediaIds.length > 0) {
        let sumX = 0;
        let sumY = 0;
        let sumZ = 0;
        let count = 0;
        for (const mId of clusterMediaIds) {
          const n = nodesMap.get(mId);
          if (n) {
            sumX += n.x;
            sumY += n.y;
            sumZ += n.z;
            count++;
          }
        }
        if (count > 0) {
          centroid = {
            x: Math.round(sumX / count),
            y: Math.round(sumY / count),
            z: Math.round(sumZ / count),
          };
        }
      }

      const darkPalette = MOVIE_MAP_DARK_CLUSTER_COLORS[def.id];
      const color =
        theme === 'MOVIE_MAP_DARK' && darkPalette ? darkPalette.color : def.color;
      const glowColor =
        theme === 'MOVIE_MAP_DARK' && darkPalette
          ? darkPalette.glowColor
          : def.glowColor;

      return {
        id: def.id,
        label: def.label,
        shortLabel: def.shortLabel,
        description: def.description,
        color,
        glowColor,
        centroid,
        keywords: def.keywords,
        genres: def.genres,
        mediaIds: clusterMediaIds,
      };
    }
  );

  return {
    nodes: Array.from(nodesMap.values()),
    links,
    focalItem,
    rankedMatches,
    clusters: activeClusters,
    matchingMediaCount,
  };
}
