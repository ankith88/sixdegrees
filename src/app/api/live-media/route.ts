import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  CastMember,
  MediaItem,
  MediaType,
  RegionCode,
  StreamingOffer,
} from '@/lib/types';
import {
  calculateSimilarity,
  hasConcreteSharedConnection,
  isSpecificNarrativeTrope,
  isValidPersonName,
} from '@/lib/similarity';
import {
  getFirestoreConfig,
  getFirestoreTelemetry,
  loadCatalogFromFirestore,
  saveCatalogToFirestore,
} from '@/lib/firestore-cache';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const OMDB_BASE = 'https://www.omdbapi.com/';

// ==================== FREE-TIER QUOTA GUARD & PERSISTENT SERVER + FIRESTORE CACHE ====================
// OMDb Free Tier is 1,000 req/day. We enforce a strict safety ceiling of 750 req/day
// and reserve OMDb strictly for single-item inspection (0 OMDb calls during bulk/auto-expansion).
const OMDB_DAILY_SAFE_LIMIT = 750;
const TMDB_MIN_INTERVAL_MS = 140; // ~7 req/s max (well below TMDB's ~40 req/s free limit)

interface OmdbTelemetryData {
  imdbRating?: number;
  rottenTomatoes?: number;
  metascore?: number;
  contentRating?: string;
  runtime?: string;
  plot?: string;
  director?: string[];
  writer?: string[];
  actors?: string[];
  genres?: string[];
  poster?: string;
  fetchedAt: number;
}

interface PersistentCatalogCache {
  dayKey: string;
  omdbCallsToday: number;
  tmdbCallsToday: number;
  items: Record<string, MediaItem>;
  omdbByImdb: Record<string, OmdbTelemetryData>;
  crawledCollaborators: string[];
}

const CACHE_FILE_PATH = path.join(
  process.cwd(),
  '.next',
  'cache',
  'sixdegrees-auto-catalog.json'
);

let memoryCache: PersistentCatalogCache | null = null;
let lastTmdbCallTime = 0;
let lastFirestoreHydrationTime = 0;

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getServerCache(): PersistentCatalogCache {
  const today = getTodayKey();
  if (memoryCache) {
    if (memoryCache.dayKey !== today) {
      memoryCache.dayKey = today;
      memoryCache.omdbCallsToday = 0;
      memoryCache.tmdbCallsToday = 0;
    }
    return memoryCache;
  }

  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const raw = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as PersistentCatalogCache;
      memoryCache = {
        dayKey: parsed.dayKey === today ? today : today,
        omdbCallsToday: parsed.dayKey === today ? parsed.omdbCallsToday || 0 : 0,
        tmdbCallsToday: parsed.dayKey === today ? parsed.tmdbCallsToday || 0 : 0,
        items: parsed.items || {},
        omdbByImdb: parsed.omdbByImdb || {},
        crawledCollaborators: Array.isArray(parsed.crawledCollaborators)
          ? parsed.crawledCollaborators
          : [],
      };
      return memoryCache;
    }
  } catch {
    // Ignore read error and initialize fresh in-memory cache
  }

  memoryCache = {
    dayKey: today,
    omdbCallsToday: 0,
    tmdbCallsToday: 0,
    items: {},
    omdbByImdb: {},
    crawledCollaborators: [],
  };
  return memoryCache;
}

function saveServerCache(): void {
  if (!memoryCache) return;
  try {
    const dir = path.dirname(CACHE_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(memoryCache), 'utf-8');
  } catch {
    // Non-fatal in read-only serverless environments
  }
}

/**
 * Hydrates in-memory & disk cache from Cloud Firestore on cold start (or every 10 minutes).
 * Costs only 1-2 Firestore document reads total thanks to document bundling.
 */
async function ensureFirestoreHydrated(
  firebaseProjectId?: string,
  firebaseApiKey?: string
): Promise<void> {
  const cfg = getFirestoreConfig(firebaseProjectId, firebaseApiKey);
  if (!cfg.enabled) return;

  const TEN_MINUTES_MS = 10 * 60 * 1000;
  if (Date.now() - lastFirestoreHydrationTime < TEN_MINUTES_MS) {
    return;
  }
  lastFirestoreHydrationTime = Date.now();

  const cloudData = await loadCatalogFromFirestore(
    firebaseProjectId,
    firebaseApiKey
  );
  const cache = getServerCache();

  if (!cloudData) {
    // Firestore is empty on first connection — push existing local cache up to Firestore immediately
    if (Object.keys(cache.items).length > 0) {
      await saveCatalogToFirestore(cache, firebaseProjectId, firebaseApiKey);
    }
    return;
  }

  const localCountBefore = Object.keys(cache.items).length;
  const cloudCount = Object.keys(cloudData.items).length;

  // Merge cloud items into server cache
  for (const [id, item] of Object.entries(cloudData.items)) {
    if (!cache.items[id]) {
      cache.items[id] = item;
    }
  }
  // Merge cloud OMDb telemetry
  for (const [imdb, omdb] of Object.entries(cloudData.omdbByImdb)) {
    if (!cache.omdbByImdb[imdb]) {
      cache.omdbByImdb[imdb] = omdb;
    }
  }
  // Merge crawled collaborators
  const collabSet = new Set([
    ...cache.crawledCollaborators.map((c) => c.toLowerCase()),
    ...cloudData.crawledCollaborators.map((c) => c.toLowerCase()),
  ]);
  cache.crawledCollaborators = Array.from(collabSet);

  if (cloudData.dayKey === cache.dayKey) {
    cache.omdbCallsToday = Math.max(
      cache.omdbCallsToday,
      cloudData.omdbCallsToday
    );
    cache.tmdbCallsToday = Math.max(
      cache.tmdbCallsToday,
      cloudData.tmdbCallsToday
    );
  }

  saveServerCache();

  // If local cache had more items than Firestore, sync the merged superset back to Firestore
  if (Object.keys(cache.items).length > cloudCount || localCountBefore > cloudCount) {
    await saveCatalogToFirestore(cache, firebaseProjectId, firebaseApiKey);
  }
}

/**
 * Flushes the current server cache to Cloud Firestore in bundled documents.
 */
async function syncServerCacheToFirestore(
  firebaseProjectId?: string,
  firebaseApiKey?: string
): Promise<void> {
  const cfg = getFirestoreConfig(firebaseProjectId, firebaseApiKey);
  if (!cfg.enabled) return;
  const cache = getServerCache();
  await saveCatalogToFirestore(cache, firebaseProjectId, firebaseApiKey);
}

function cacheMediaItem(item: MediaItem): void {
  const cache = getServerCache();
  cache.items[item.id] = item;
  saveServerCache();
}

function findCachedMediaByTmdb(
  tmdbId: number,
  mediaType: MediaType
): MediaItem | null {
  const cache = getServerCache();
  for (const item of Object.values(cache.items)) {
    if (item.tmdbId === tmdbId && item.mediaType === mediaType) {
      return item;
    }
  }
  return null;
}

function findCachedMediaByImdb(imdbId: string): MediaItem | null {
  if (!imdbId) return null;
  const cache = getServerCache();
  for (const item of Object.values(cache.items)) {
    if (item.imdbId === imdbId) {
      return item;
    }
  }
  return null;
}

async function paceTmdbRequest(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastTmdbCallTime;
  if (elapsed < TMDB_MIN_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, TMDB_MIN_INTERVAL_MS - elapsed)
    );
  }
  lastTmdbCallTime = Date.now();
  const cache = getServerCache();
  cache.tmdbCallsToday += 1;
}

const PROVIDER_BRANDS: Record<string, { short: string; color: string }> = {
  Netflix: { short: 'N', color: '#B81D24' },
  'Apple TV': { short: 'ATV', color: '#1F242B' },
  'Apple TV Plus': { short: 'tv+', color: '#1F242B' },
  'Apple TV+': { short: 'tv+', color: '#1F242B' },
  'Amazon Prime Video': { short: 'PRIME', color: '#165B7D' },
  'Prime Video': { short: 'PRIME', color: '#165B7D' },
  Stan: { short: 'STAN', color: '#1B4F9C' },
  BINGE: { short: 'BINGE', color: '#B83B0A' },
  Binge: { short: 'BINGE', color: '#B83B0A' },
  Max: { short: 'MAX', color: '#322B80' },
  'Paramount Plus': { short: 'P+', color: '#14489E' },
  'Paramount+': { short: 'P+', color: '#14489E' },
  Hulu: { short: 'HULU', color: '#1B663E' },
  'Disney Plus': { short: 'D+', color: '#173B8A' },
  'Disney+': { short: 'D+', color: '#173B8A' },
  NOW: { short: 'NOW', color: '#195E47' },
};

function makeFallbackRegionalStreaming(
  title: string
): Record<RegionCode, StreamingOffer[]> {
  const q = encodeURIComponent(title);
  const offers: StreamingOffer[] = [
    {
      provider: 'Netflix',
      shortName: 'N',
      type: 'STREAM',
      quality: '4K',
      color: '#B81D24',
      url: `https://www.netflix.com/search?q=${q}`,
    },
    {
      provider: 'Prime Video',
      shortName: 'PRIME',
      type: 'STREAM',
      quality: '4K',
      color: '#165B7D',
      url: `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${q}`,
    },
    {
      provider: 'Apple TV',
      shortName: 'ATV',
      type: 'RENT',
      price: '$4.99',
      quality: '4K',
      color: '#E5DEC9',
      textColor: '#171412',
      url: `https://tv.apple.com/search?term=${q}`,
    },
    {
      provider: 'Apple TV Store',
      shortName: 'ATV',
      type: 'BUY',
      price: '$14.99',
      quality: '4K',
      color: '#D5CCB9',
      textColor: '#171412',
      url: `https://tv.apple.com/search?term=${q}`,
    },
  ];
  return { AU: offers, US: offers, UK: offers };
}

async function fetchOmdbTelemetry(
  imdbId: string,
  omdbKey?: string,
  skipQuotaCheck = false
): Promise<OmdbTelemetryData | null> {
  if (!imdbId || !omdbKey || !imdbId.startsWith('tt')) return null;

  const cache = getServerCache();
  const cached = cache.omdbByImdb[imdbId];
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  if (cached && Date.now() - cached.fetchedAt < SEVEN_DAYS_MS) {
    return cached;
  }

  // Enforce strict daily free-tier safety ceiling (750 / 1,000 max daily requests)
  if (!skipQuotaCheck && cache.omdbCallsToday >= OMDB_DAILY_SAFE_LIMIT) {
    return cached || null;
  }

  try {
    cache.omdbCallsToday += 1;
    const res = await fetch(
      `${OMDB_BASE}?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(omdbKey)}`,
      { next: { revalidate: 604800 } } // 7-day Next.js data cache
    );
    if (!res.ok) return cached || null;
    const data = await res.json();
    if (data.Response === 'False') return cached || null;

    let rt: number | undefined;
    if (Array.isArray(data.Ratings)) {
      const found = data.Ratings.find(
        (r: { Source: string; Value: string }) =>
          r.Source === 'Rotten Tomatoes'
      );
      if (found?.Value) {
        const parsed = parseInt(found.Value.replace('%', ''), 10);
        if (!Number.isNaN(parsed)) rt = parsed;
      }
    }

    const imdbRating = data.imdbRating ? parseFloat(data.imdbRating) : undefined;
    const metascore = data.Metascore ? parseInt(data.Metascore, 10) : undefined;

    const result: OmdbTelemetryData = {
      imdbRating: !Number.isNaN(imdbRating ?? NaN) ? imdbRating : undefined,
      rottenTomatoes: rt,
      metascore: !Number.isNaN(metascore ?? NaN) ? metascore : undefined,
      contentRating:
        data.Rated && data.Rated !== 'N/A' ? data.Rated : undefined,
      runtime:
        data.Runtime && data.Runtime !== 'N/A' ? data.Runtime : undefined,
      plot: data.Plot && data.Plot !== 'N/A' ? data.Plot : undefined,
      director:
        data.Director && data.Director !== 'N/A'
          ? data.Director.split(',').map((s: string) => s.trim())
          : undefined,
      writer:
        data.Writer && data.Writer !== 'N/A'
          ? data.Writer.split(',').map((s: string) =>
              s.replace(/\(.*?\)/g, '').trim()
            )
          : undefined,
      actors:
        data.Actors && data.Actors !== 'N/A'
          ? data.Actors.split(',').map((s: string) => s.trim())
          : undefined,
      genres:
        data.Genre && data.Genre !== 'N/A'
          ? data.Genre.split(',').map((s: string) =>
              s.trim() === 'Sci-Fi' ? 'Sci-Fi' : s.trim()
            )
          : undefined,
      poster:
        data.Poster && data.Poster !== 'N/A' ? data.Poster : undefined,
      fetchedAt: Date.now(),
    };

    cache.omdbByImdb[imdbId] = result;
    saveServerCache();
    return result;
  } catch {
    return cached || null;
  }
}

interface TmdbProviderEntry {
  provider_name: string;
}

interface TmdbRegionBlock {
  link?: string;
  flatrate?: TmdbProviderEntry[];
  rent?: TmdbProviderEntry[];
  buy?: TmdbProviderEntry[];
}

function parseWatchProviders(
  results: Record<string, TmdbRegionBlock> | undefined,
  title: string
): Record<RegionCode, StreamingOffer[]> {
  const fallback = makeFallbackRegionalStreaming(title);
  if (!results) return fallback;

  const regions: RegionCode[] = ['AU', 'US', 'UK'];
  const out: Record<RegionCode, StreamingOffer[]> = { AU: [], US: [], UK: [] };

  for (const reg of regions) {
    const block = results[reg];
    if (!block) {
      out[reg] = fallback[reg];
      continue;
    }
    const link =
      block.link ||
      `https://www.themoviedb.org/search?query=${encodeURIComponent(title)}`;

    const addList = (
      arr: TmdbProviderEntry[] | undefined,
      type: 'STREAM' | 'RENT' | 'BUY'
    ) => {
      if (!arr) return;
      for (const p of arr.slice(0, 4)) {
        const brand = PROVIDER_BRANDS[p.provider_name] || {
          short: p.provider_name.slice(0, 4).toUpperCase(),
          color: '#234B6E',
        };
        out[reg].push({
          provider: p.provider_name,
          shortName: brand.short,
          type,
          quality: '4K',
          color: brand.color,
          url: link,
        });
      }
    };

    addList(block.flatrate, 'STREAM');
    addList(block.rent, 'RENT');
    addList(block.buy, 'BUY');

    if (out[reg].length === 0) {
      out[reg] = fallback[reg];
    }
  }
  return out;
}

function titleCaseKeyword(str: string): string {
  return str
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Helper to fetch from TMDB using either Bearer Read Access Token (v4) or API Key (v3)
 * with automatic token-bucket pacing so we never cross TMDB's rate limits.
 */
async function fetchTmdb(
  path: string,
  params: Record<string, string>,
  tmdbKey: string,
  tmdbReadToken?: string,
  revalidate = 86400
) {
  await paceTmdbRequest();
  const search = new URLSearchParams(params);
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (tmdbReadToken) {
    headers.Authorization = `Bearer ${tmdbReadToken}`;
  } else if (tmdbKey) {
    search.set('api_key', tmdbKey);
  }

  const url = `${TMDB_BASE}${path}?${search.toString()}`;
  return fetch(url, {
    headers,
    next: { revalidate },
  });
}

/**
 * Fetches a full MediaItem from TMDB (+ optional OMDb when skipOmdb is false).
 * Uses persistent disk/memory cache so previously discovered titles cost 0 API calls.
 */
async function fetchFullTmdbMediaItem(
  tmdbId: number,
  mediaType: MediaType,
  tmdbKey: string,
  omdbKey?: string,
  tmdbReadToken?: string,
  skipOmdb = false
): Promise<{ item: MediaItem; rawRecs: Array<{ id: number; mediaType: MediaType }> } | null> {
  const cachedItem = findCachedMediaByTmdb(tmdbId, mediaType);
  if (cachedItem && skipOmdb) {
    return { item: cachedItem, rawRecs: [] };
  }

  const endpoint = mediaType === 'MOVIE' ? 'movie' : 'tv';

  try {
    const res = await fetchTmdb(
      `/${endpoint}/${tmdbId}`,
      {
        append_to_response:
          'credits,keywords,recommendations,similar,external_ids,watch/providers',
      },
      tmdbKey,
      tmdbReadToken,
      86400
    );
    if (!res.ok) return cachedItem ? { item: cachedItem, rawRecs: [] } : null;
    const data = await res.json();

    const imdbId = data.imdb_id || data.external_ids?.imdb_id || `tmdb-${tmdbId}`;
    const omdb =
      !skipOmdb && omdbKey && imdbId.startsWith('tt')
        ? await fetchOmdbTelemetry(imdbId, omdbKey)
        : imdbId.startsWith('tt')
          ? getServerCache().omdbByImdb[imdbId] || null
          : null;

    const title = data.title || data.name || 'Untitled';
    const dateStr = data.release_date || data.first_air_date || '';
    const year = dateStr ? parseInt(dateStr.slice(0, 4), 10) : 2024;
    const slugId = `${mediaType.toLowerCase()}-${tmdbId}-${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}`;

    // Directors / Showrunners: for TV series, strictly use series creators (created_by) — never freelance episode directors
    const directors: string[] = [];
    const crew = Array.isArray(data.credits?.crew) ? data.credits.crew : [];
    if (mediaType === 'TV') {
      if (Array.isArray(data.created_by)) {
        for (const c of data.created_by) {
          if (c?.name && isValidPersonName(c.name) && !directors.includes(c.name)) {
            directors.push(c.name);
          }
        }
      }
    } else {
      for (const member of crew) {
        if (
          member.job === 'Director' &&
          isValidPersonName(member.name) &&
          !directors.includes(member.name) &&
          directors.length < 2
        ) {
          directors.push(member.name);
        }
      }
      if (directors.length === 0 && omdb?.director) {
        directors.push(...omdb.director.filter(isValidPersonName).slice(0, 2));
      }
    }

    // Writers: for Movies only (TV creators are already captured in directors; avoid staff writer overlap)
    const writers: string[] = [];
    if (mediaType === 'MOVIE') {
      for (const member of crew) {
        if (
          (member.job === 'Screenplay' || member.job === 'Writer') &&
          isValidPersonName(member.name) &&
          !writers.includes(member.name) &&
          writers.length < 2
        ) {
          writers.push(member.name);
        }
      }
    }

    // Composers & Cinematographers
    const composers: string[] = [];
    const cinematographers: string[] = [];
    for (const member of crew) {
      if (
        member.job === 'Original Music Composer' &&
        isValidPersonName(member.name) &&
        !composers.includes(member.name) &&
        composers.length < 1
      ) {
        composers.push(member.name);
      }
      if (
        member.job === 'Director of Photography' &&
        isValidPersonName(member.name) &&
        !cinematographers.includes(member.name) &&
        cinematographers.length < 1
      ) {
        cinematographers.push(member.name);
      }
    }

    // Primary Cast (Top 4 billed leads only)
    const rawCast = Array.isArray(data.credits?.cast)
      ? data.credits.cast.slice(0, 4)
      : [];
    const cast: CastMember[] = rawCast
      .filter((c: { name?: string }) => Boolean(c.name && isValidPersonName(c.name)))
      .map(
        (c: { name: string; character?: string }, idx: number) => ({
          name: c.name,
          character: c.character,
          billing: idx < 2 ? 'LEAD' : 'SUPPORTING',
        })
      );

    // Genres
    const genres: string[] = Array.isArray(data.genres)
      ? data.genres.map((g: { name: string }) =>
          g.name === 'Science Fiction' || g.name === 'Sci-Fi & Fantasy'
            ? 'Sci-Fi'
            : g.name
        )
      : ['Drama'];

    // Do not assign noisy crowd-tagged TMDB keywords as narrative tropes on searched items
    const tropes: string[] = [];

    // Recommendations list
    const recList = [
      ...(data.recommendations?.results || []),
      ...(data.similar?.results || []),
    ];
    const seenRecIds = new Set<number>();
    const rawRecs: Array<{ id: number; mediaType: MediaType }> = [];
    for (const r of recList) {
      if (r?.id && !seenRecIds.has(r.id) && r.id !== tmdbId) {
        seenRecIds.add(r.id);
        const rType: MediaType =
          r.media_type === 'tv'
            ? 'TV'
            : r.media_type === 'movie'
              ? 'MOVIE'
              : mediaType;
        rawRecs.push({ id: r.id, mediaType: rType });
      }
    }

    const voteAvg = typeof data.vote_average === 'number' && data.vote_average > 0
      ? Number(data.vote_average.toFixed(1))
      : 7.8;

    const runtimeStr =
      mediaType === 'MOVIE' && data.runtime
        ? `${Math.floor(data.runtime / 60)}h ${data.runtime % 60}m`
        : mediaType === 'TV' && data.number_of_seasons
          ? `${data.number_of_seasons} Season${data.number_of_seasons > 1 ? 's' : ''}`
          : omdb?.runtime || (mediaType === 'TV' ? '1 Season' : '2h 05m');

    const item: MediaItem = {
      id: slugId,
      tmdbId,
      imdbId,
      title,
      year: !Number.isNaN(year) ? year : 2024,
      mediaType,
      tagline: data.tagline || `${year} · ${genres.slice(0, 2).join(' / ')}`,
      synopsis: data.overview || omdb?.plot || 'Live telemetry node loaded from external catalog.',
      posterUrl: data.poster_path
        ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
        : omdb?.poster || '',
      backdropColor: mediaType === 'MOVIE' ? '#234B6E' : '#6B2D46',
      imdbRating: omdb?.imdbRating || voteAvg,
      rottenTomatoes:
        omdb?.rottenTomatoes || Math.min(98, Math.max(55, Math.round(voteAvg * 10.4))),
      metascore:
        omdb?.metascore || Math.min(96, Math.max(52, Math.round(voteAvg * 9.6))),
      contentRating:
        omdb?.contentRating || (mediaType === 'TV' ? 'TV-MA' : 'PG-13'),
      runtimeOrSeasons: runtimeStr,
      directors,
      writers: writers.slice(0, 3),
      primaryGenre: genres[0] || 'Drama',
      genres,
      tropes,
      cast,
      composers: composers.slice(0, 2),
      cinematographers: cinematographers.slice(0, 2),
      coWatchIds: [],
      streamingByRegion: parseWatchProviders(
        data['watch/providers']?.results,
        title
      ),
      coordinates: {
        ra: `${(tmdbId % 24).toString().padStart(2, '0')}h ${(tmdbId % 60)
          .toString()
          .padStart(2, '0')}m`,
        dec: `+${(tmdbId % 85).toString().padStart(2, '0')}° 14′`,
        sector: `TMDB-${tmdbId.toString().slice(0, 4)}`,
      },
    };

    cacheMediaItem(item);
    return { item, rawRecs };
  } catch {
    return cachedItem ? { item: cachedItem, rawRecs: [] } : null;
  }
}

/**
 * Zero-Key Public Live Discovery Fallback using IMDb Suggestion API + Wikidata SPARQL
 * Works out-of-the-box even when the user hasn't set TMDB/OMDb API keys yet!
 */
async function searchImdbPublicSuggestions(query: string) {
  const clean = query.trim().toLowerCase().replace(/[^a-z0-9 ]+/g, '');
  if (!clean) return [];
  const firstChar = clean.charAt(0) || 'i';
  const url = `https://v3.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(
    clean.slice(0, 30)
  )}.json`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        Accept: 'application/json',
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data?.d) ? data.d : [];

    return list
      .filter(
        (entry: { id?: string; qid?: string }) =>
          entry.id?.startsWith('tt') &&
          (entry.qid === 'movie' ||
            entry.qid === 'tvSeries' ||
            entry.qid === 'tvMiniSeries' ||
            entry.qid === 'feature')
      )
      .slice(0, 10)
      .map(
        (entry: {
          id: string;
          l: string;
          y?: number;
          qid?: string;
          s?: string;
          i?: { imageUrl?: string };
        }) => {
          const mediaType: MediaType =
            entry.qid === 'tvSeries' || entry.qid === 'tvMiniSeries'
              ? 'TV'
              : 'MOVIE';
          return {
            id: `imdb-${entry.id}`,
            imdbId: entry.id,
            tmdbId: parseInt(entry.id.replace(/\D/g, ''), 10) || 99999,
            title: entry.l,
            year: entry.y || 2024,
            mediaType,
            stars: entry.s || '',
            posterUrl: entry.i?.imageUrl || '',
            source: 'PUBLIC_LIVE' as const,
          };
        }
      );
  } catch {
    return [];
  }
}

interface WikidataFilmRow {
  imdbId: string;
  title: string;
  year: number;
  mediaType: MediaType;
  directors: string[];
  writers: string[];
  cast: string[];
  composers: string[];
  cinematographers: string[];
  genres: string[];
  tropes: string[];
}

async function fetchWikidataClusterByImdbId(
  imdbId: string,
  fallbackTitle: string,
  fallbackYear: number,
  fallbackType: MediaType,
  fallbackPoster: string,
  omdbKey?: string,
  singleItemOnly = false
): Promise<{ focalItem: MediaItem; clusterItems: MediaItem[] }> {
  // Query 1: Get credits, genres, and subjects of the focal item (+ related works sharing director/creator, cast, composer, or main subject when building a cluster)
  const sparql = singleItemOnly
    ? `
  SELECT ?item ?itemLabel ?imdb ?pubYear ?isTv
         (GROUP_CONCAT(DISTINCT ?dirLabel; separator="|") AS ?dirs)
         (GROUP_CONCAT(DISTINCT ?castLabel; separator="|") AS ?actors)
         (GROUP_CONCAT(DISTINCT ?compLabel; separator="|") AS ?comps)
         (GROUP_CONCAT(DISTINCT ?genreLabel; separator="|") AS ?genres)
         (GROUP_CONCAT(DISTINCT ?subjectLabel; separator="|") AS ?subjects)
  WHERE {
    ?item wdt:P345 "${imdbId}" .
    BIND("${imdbId}" AS ?imdb)
    OPTIONAL { ?item wdt:P577 ?date . BIND(YEAR(?date) AS ?pubYear) }
    OPTIONAL {
      ?item wdt:P31 ?inst .
      FILTER(?inst IN (wd:Q5398426, wd:Q1259759))
      BIND(true AS ?isTv)
    }
    OPTIONAL {
      ?item wdt:P170 ?creator .
      ?creator rdfs:label ?dirLabel .
      FILTER(LANG(?dirLabel) = "en")
    }
    OPTIONAL {
      FILTER(!BOUND(?isTv))
      ?item wdt:P57 ?dir .
      ?dir rdfs:label ?dirLabel .
      FILTER(LANG(?dirLabel) = "en")
    }
    OPTIONAL { ?item wdt:P161 ?cast . ?cast rdfs:label ?castLabel . FILTER(LANG(?castLabel) = "en") }
    OPTIONAL { ?item wdt:P86 ?comp . ?comp rdfs:label ?compLabel . FILTER(LANG(?compLabel) = "en") }
    OPTIONAL { ?item wdt:P136 ?genre . ?genre rdfs:label ?genreLabel . FILTER(LANG(?genreLabel) = "en") }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }
  GROUP BY ?item ?itemLabel ?imdb ?pubYear ?isTv
  LIMIT 2
  `
    : `
  SELECT ?item ?itemLabel ?imdb ?pubYear ?isTv
         (GROUP_CONCAT(DISTINCT ?dirLabel; separator="|") AS ?dirs)
         (GROUP_CONCAT(DISTINCT ?castLabel; separator="|") AS ?actors)
         (GROUP_CONCAT(DISTINCT ?compLabel; separator="|") AS ?comps)
         (GROUP_CONCAT(DISTINCT ?genreLabel; separator="|") AS ?genres)
         (GROUP_CONCAT(DISTINCT ?subjectLabel; separator="|") AS ?subjects)
  WHERE {
    {
      SELECT DISTINCT ?item WHERE {
        ?focal wdt:P345 "${imdbId}" .
        {
          BIND(?focal AS ?item)
        } UNION {
          ?focal wdt:P170 ?sharedCreator .
          ?item wdt:P170 ?sharedCreator ; wdt:P345 ?anyImdb .
        }
      } LIMIT 12
    }
    ?item wdt:P345 ?imdb .
    OPTIONAL { ?item wdt:P577 ?date . BIND(YEAR(?date) AS ?pubYear) }
    OPTIONAL {
      ?item wdt:P31 ?inst .
      FILTER(?inst IN (wd:Q5398426, wd:Q1259759))
      BIND(true AS ?isTv)
    }
    OPTIONAL {
      ?item wdt:P170 ?creator .
      ?creator rdfs:label ?dirLabel .
      FILTER(LANG(?dirLabel) = "en")
    }
    OPTIONAL {
      FILTER(!BOUND(?isTv))
      ?item wdt:P57 ?dir .
      ?dir rdfs:label ?dirLabel .
      FILTER(LANG(?dirLabel) = "en")
    }
    OPTIONAL { ?item wdt:P161 ?cast . ?cast rdfs:label ?castLabel . FILTER(LANG(?castLabel) = "en") }
    OPTIONAL { ?item wdt:P86 ?comp . ?comp rdfs:label ?compLabel . FILTER(LANG(?compLabel) = "en") }
    OPTIONAL { ?item wdt:P136 ?genre . ?genre rdfs:label ?genreLabel . FILTER(LANG(?genreLabel) = "en") }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }
  GROUP BY ?item ?itemLabel ?imdb ?pubYear ?isTv
  LIMIT 12
  `;

  const rowsMap = new Map<string, WikidataFilmRow>();

  try {
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(
      sparql
    )}`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/sparql-results+json',
        'User-Agent': 'SixDegreesSpatialEngine/2.4',
      },
      next: { revalidate: 3600 },
    });

    if (res.ok) {
      const data = await res.json();
      const bindings = data?.results?.bindings || [];
      for (const b of bindings) {
        const rowImdb = b.imdb?.value;
        const rowTitle = b.itemLabel?.value;
        if (!rowImdb || !rowTitle || /^Q\d+$/.test(rowTitle)) continue;

        const splitClean = (val?: string, max = 5) =>
          val
            ? Array.from(
                new Set(
                  val
                    .split('|')
                    .map((s) => s.trim())
                    .filter(Boolean)
                )
              ).slice(0, max)
            : [];

        const cleanGenres = splitClean(b.genres?.value, 4).map((g) =>
          g.toLowerCase().includes('science fiction')
            ? 'Sci-Fi'
            : g
                .replace(/\s+film$/i, '')
                .replace(/\s+television series$/i, '')
                .replace(/^./, (c) => c.toUpperCase())
        );

        rowsMap.set(rowImdb, {
          imdbId: rowImdb,
          title: rowTitle,
          year: b.pubYear?.value ? parseInt(b.pubYear.value, 10) : fallbackYear,
          mediaType: b.isTv?.value === 'true' ? 'TV' : 'MOVIE',
          directors: splitClean(b.dirs?.value, 2).filter(isValidPersonName),
          writers: [],
          cast: splitClean(b.actors?.value, 4).filter(isValidPersonName),
          composers: splitClean(b.comps?.value, 1).filter(isValidPersonName),
          cinematographers: [],
          genres: cleanGenres.length > 0 ? cleanGenres : ['Drama'],
          tropes: [],
        });
      }
    }
  } catch {
    // Fallback if Wikidata times out
  }

  // Ensure the focal item is in rowsMap without fabricating placeholder credits or tropes
  if (!rowsMap.has(imdbId)) {
    rowsMap.set(imdbId, {
      imdbId,
      title: fallbackTitle,
      year: fallbackYear,
      mediaType: fallbackType,
      directors: [],
      writers: [],
      cast: [],
      composers: [],
      cinematographers: [],
      genres: ['Drama'],
      tropes: [],
    });
  }

  // Enrich posters & metadata via IMDb suggestion lookup (reserve OMDb strictly for single-item inspection)
  const allRows = Array.from(rowsMap.values()).slice(0, singleItemOnly ? 1 : 12);
  const mediaItems: MediaItem[] = await Promise.all(
    allRows.map(async (row, idx) => {
      const cached = findCachedMediaByImdb(row.imdbId);
      if (cached && (!singleItemOnly || !omdbKey)) {
        return cached;
      }

      const omdb =
        singleItemOnly && idx === 0 && omdbKey
          ? await fetchOmdbTelemetry(row.imdbId, omdbKey)
          : getServerCache().omdbByImdb[row.imdbId] || null;
      const sug = await searchImdbPublicSuggestions(row.title);
      const match =
        sug.find((s: { imdbId: string; posterUrl?: string; stars?: string }) => s.imdbId === row.imdbId) ||
        sug[0];

      const posterUrl =
        row.imdbId === imdbId && fallbackPoster
          ? fallbackPoster
          : omdb?.poster || match?.posterUrl || '';

      const imdbStars = match?.stars
        ? match.stars
            .split(',')
            .map((s: string) => s.trim())
            .filter(isValidPersonName)
        : [];

      const directors: string[] = (
        row.directors.length > 0 ? row.directors : omdb?.director || []
      ).filter(isValidPersonName);
      const actorsList: string[] = (
        omdb?.actors && omdb.actors.length > 0
          ? omdb.actors
          : imdbStars.length > 0
            ? imdbStars
            : row.cast
      ).filter(isValidPersonName);

      const cast: CastMember[] = actorsList
        .slice(0, 4)
        .map((name: string, i: number) => ({
          name,
          billing: i < 2 ? 'LEAD' : 'SUPPORTING',
        }));

      const tropes: string[] = [];

      const deterministicScore = 7.6 + ((idx * 3) % 14) * 0.1;

      const built: MediaItem = {
        id: `imdb-${row.imdbId}`,
        tmdbId: parseInt(row.imdbId.replace(/\D/g, ''), 10) || 10000 + idx,
        imdbId: row.imdbId,
        title: row.title,
        year: row.year || 2022,
        mediaType: row.mediaType,
        tagline: `${row.year} · ${row.genres.slice(0, 2).join(' / ')}`,
        synopsis:
          omdb?.plot ||
          `${row.title} (${row.year})${
            directors[0] ? ` directed by ${directors[0]}` : ''
          }${
            actorsList.length > 0
              ? `, featuring ${actorsList.slice(0, 3).join(', ')}`
              : ''
          }.`,
        posterUrl,
        backdropColor: row.mediaType === 'MOVIE' ? '#234B6E' : '#6B2D46',
        imdbRating: omdb?.imdbRating || Number(deterministicScore.toFixed(1)),
        rottenTomatoes:
          omdb?.rottenTomatoes || Math.min(97, Math.round(deterministicScore * 10.6)),
        metascore:
          omdb?.metascore || Math.min(94, Math.round(deterministicScore * 9.8)),
        contentRating:
          omdb?.contentRating || (row.mediaType === 'TV' ? 'TV-MA' : 'PG-13'),
        runtimeOrSeasons:
          omdb?.runtime || (row.mediaType === 'TV' ? '2 Seasons' : '2h 12m'),
        directors,
        writers: (omdb?.writer?.slice(0, 2) || []).filter(isValidPersonName),
        primaryGenre: row.genres[0] || 'Drama',
        genres: row.genres,
        tropes,
        cast,
        composers: row.composers,
        cinematographers: row.cinematographers,
        coWatchIds: [],
        streamingByRegion: makeFallbackRegionalStreaming(row.title),
        coordinates: {
          ra: `${((idx + 4) % 24).toString().padStart(2, '0')}h 42m`,
          dec: `+${((idx * 7 + 12) % 80).toString().padStart(2, '0')}° 18′`,
          sector: `LIVE-${row.imdbId.slice(2, 6)}`,
        },
      };

      cacheMediaItem(built);
      return built;
    })
  );

  const focalItem =
    mediaItems.find((m) => m.imdbId === imdbId) || mediaItems[0];
  const clusterItems = mediaItems
    .filter((m) => m.id !== focalItem.id)
    .filter((m) => hasConcreteSharedConnection(calculateSimilarity(focalItem, m)));
  focalItem.coWatchIds = clusterItems.slice(0, 8).map((c) => c.id);
  clusterItems.forEach((c) => {
    c.coWatchIds = [focalItem.id];
  });

  return { focalItem, clusterItems };
}

/**
 * Collaborator-Driven TMDB Auto-Discovery (0 OMDb calls, paced TMDB calls).
 * Queries /search/person -> /person/{id}/combined_credits to find top Movies & TV Shows
 * connected to an existing director, creator, actor, or composer in the graph.
 */
async function discoverByCollaboratorTmdb(
  collaboratorName: string,
  excludeKeys: Set<string>,
  batchSize: number,
  tmdbKey: string,
  tmdbReadToken?: string
): Promise<MediaItem[]> {
  try {
    const searchRes = await fetchTmdb(
      '/search/person',
      { query: collaboratorName, include_adult: 'false' },
      tmdbKey,
      tmdbReadToken,
      86400
    );
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const person = searchData.results?.[0];
    if (!person?.id) return [];

    const creditsRes = await fetchTmdb(
      `/person/${person.id}/combined_credits`,
      {},
      tmdbKey,
      tmdbReadToken,
      86400
    );
    if (!creditsRes.ok) return [];
    const creditsData = await creditsRes.json();

    interface CandidateCredit {
      id: number;
      mediaType: MediaType;
      title: string;
      voteCount: number;
      voteAverage: number;
      popularity: number;
    }

    const candidatesMap = new Map<string, CandidateCredit>();

    const addCandidate = (
      raw: {
        id?: number;
        media_type?: string;
        title?: string;
        name?: string;
        vote_count?: number;
        vote_average?: number;
        popularity?: number;
        genre_ids?: number[];
      },
      priorityBoost = 1
    ) => {
      if (!raw?.id || (raw.media_type !== 'movie' && raw.media_type !== 'tv')) {
        return;
      }
      // Exclude talk shows (10767), news (10763), reality (10764)
      if (
        Array.isArray(raw.genre_ids) &&
        raw.genre_ids.some((g) => g === 10767 || g === 10763 || g === 10764)
      ) {
        return;
      }
      const mediaType: MediaType = raw.media_type === 'tv' ? 'TV' : 'MOVIE';
      const title = (raw.title || raw.name || '').trim();
      if (!title) return;

      const tmdbKeyStr = `tmdb:${mediaType}:${raw.id}`;
      const titleKeyStr = `title:${title.toLowerCase()}`;
      if (excludeKeys.has(tmdbKeyStr) || excludeKeys.has(titleKeyStr)) {
        return;
      }

      const voteCount = raw.vote_count || 0;
      const voteAverage = raw.vote_average || 0;
      if (voteCount < 45 || voteAverage < 6.2) return;

      const existing = candidatesMap.get(tmdbKeyStr);
      const score = (voteCount * 0.4 + (raw.popularity || 10) * 15) * priorityBoost;
      if (!existing || score > existing.popularity) {
        candidatesMap.set(tmdbKeyStr, {
          id: raw.id,
          mediaType,
          title,
          voteCount,
          voteAverage,
          popularity: score,
        });
      }
    };

    const crewList = Array.isArray(creditsData.crew) ? creditsData.crew : [];
    for (const c of crewList) {
      if (
        c.job === 'Director' ||
        c.job === 'Creator' ||
        c.job === 'Executive Producer' ||
        c.job === 'Screenplay' ||
        c.job === 'Writer' ||
        c.job === 'Original Music Composer' ||
        c.job === 'Director of Photography'
      ) {
        addCandidate(c, c.job === 'Director' || c.job === 'Creator' ? 2.2 : 1.5);
      }
    }

    const castList = Array.isArray(creditsData.cast) ? creditsData.cast : [];
    for (const c of castList) {
      if (typeof c.order === 'number' && c.order > 4) continue;
      if (c.character && /himself|herself|self|guest|host/i.test(c.character)) {
        continue;
      }
      addCandidate(c, typeof c.order === 'number' && c.order < 2 ? 1.8 : 1.1);
    }

    const sorted = Array.from(candidatesMap.values()).sort(
      (a, b) => b.popularity - a.popularity
    );

    // Balance Movies and TV Shows when both exist for this collaborator
    const movies = sorted.filter((c) => c.mediaType === 'MOVIE');
    const tvShows = sorted.filter((c) => c.mediaType === 'TV');
    const picked: CandidateCredit[] = [];
    let mIdx = 0;
    let tIdx = 0;
    while (
      picked.length < batchSize &&
      (mIdx < movies.length || tIdx < tvShows.length)
    ) {
      if (mIdx < movies.length) picked.push(movies[mIdx++]);
      if (picked.length < batchSize && tIdx < tvShows.length) {
        picked.push(tvShows[tIdx++]);
      }
    }

    const items: MediaItem[] = [];
    for (const cand of picked) {
      // skipOmdb = true so automatic background expansion uses 0 OMDb calls
      const enriched = await fetchFullTmdbMediaItem(
        cand.id,
        cand.mediaType,
        tmdbKey,
        undefined,
        tmdbReadToken,
        true
      );
      if (enriched?.item) {
        items.push(enriched.item);
      }
    }

    return items;
  } catch {
    return [];
  }
}

/**
 * Zero-Key Public Collaborator Discovery via Wikidata SPARQL + IMDb Suggestions (0 API keys required)
 */
async function discoverByCollaboratorWikidata(
  collaboratorName: string,
  excludeKeys: Set<string>,
  batchSize: number
): Promise<MediaItem[]> {
  const safeName = collaboratorName.replace(/"/g, '');
  const sparql = `
  SELECT ?item ?itemLabel ?imdb ?pubYear ?isTv
         (GROUP_CONCAT(DISTINCT ?dirLabel; separator="|") AS ?dirs)
         (GROUP_CONCAT(DISTINCT ?castLabel; separator="|") AS ?actors)
         (GROUP_CONCAT(DISTINCT ?compLabel; separator="|") AS ?comps)
         (GROUP_CONCAT(DISTINCT ?genreLabel; separator="|") AS ?genres)
  WHERE {
    {
      SELECT DISTINCT ?item WHERE {
        ?person rdfs:label "${safeName}"@en .
        { ?item wdt:P57 ?person . }
        UNION { ?item wdt:P170 ?person . }
        UNION { ?item wdt:P161 ?person . }
        UNION { ?item wdt:P86 ?person . }
        ?item wdt:P345 ?anyImdb .
      } LIMIT 16
    }
    ?item wdt:P345 ?imdb .
    OPTIONAL { ?item wdt:P577 ?date . BIND(YEAR(?date) AS ?pubYear) }
    OPTIONAL {
      ?item wdt:P31 ?inst .
      FILTER(?inst IN (wd:Q5398426, wd:Q1259759))
      BIND(true AS ?isTv)
    }
    OPTIONAL {
      ?item wdt:P170 ?creator .
      ?creator rdfs:label ?dirLabel .
      FILTER(LANG(?dirLabel) = "en")
    }
    OPTIONAL {
      FILTER(!BOUND(?isTv))
      ?item wdt:P57 ?dir .
      ?dir rdfs:label ?dirLabel .
      FILTER(LANG(?dirLabel) = "en")
    }
    OPTIONAL { ?item wdt:P161 ?cast . ?cast rdfs:label ?castLabel . FILTER(LANG(?castLabel) = "en") }
    OPTIONAL { ?item wdt:P86 ?comp . ?comp rdfs:label ?compLabel . FILTER(LANG(?compLabel) = "en") }
    OPTIONAL { ?item wdt:P136 ?genre . ?genre rdfs:label ?genreLabel . FILTER(LANG(?genreLabel) = "en") }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }
  GROUP BY ?item ?itemLabel ?imdb ?pubYear ?isTv
  LIMIT 14
  `;

  try {
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(
      sparql
    )}`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/sparql-results+json',
        'User-Agent': 'SixDegreesSpatialEngine/2.4',
      },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const bindings = data?.results?.bindings || [];

    const candidateRows: WikidataFilmRow[] = [];
    for (const b of bindings) {
      const rowImdb = b.imdb?.value;
      const rowTitle = b.itemLabel?.value;
      if (!rowImdb || !rowTitle || /^Q\d+$/.test(rowTitle)) continue;
      if (
        excludeKeys.has(`imdb:${rowImdb}`) ||
        excludeKeys.has(`title:${rowTitle.toLowerCase()}`)
      ) {
        continue;
      }

      const splitClean = (val?: string, max = 5) =>
        val
          ? Array.from(
              new Set(
                val
                  .split('|')
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
            ).slice(0, max)
          : [];

      const cleanGenres = splitClean(b.genres?.value, 4).map((g) =>
        g.toLowerCase().includes('science fiction')
          ? 'Sci-Fi'
          : g
              .replace(/\s+film$/i, '')
              .replace(/\s+television series$/i, '')
              .replace(/^./, (c) => c.toUpperCase())
      );

      candidateRows.push({
        imdbId: rowImdb,
        title: rowTitle,
        year: b.pubYear?.value ? parseInt(b.pubYear.value, 10) : 2020,
        mediaType: b.isTv?.value === 'true' ? 'TV' : 'MOVIE',
        directors: splitClean(b.dirs?.value, 2).filter(isValidPersonName),
        writers: [],
        cast: splitClean(b.actors?.value, 4).filter(isValidPersonName),
        composers: splitClean(b.comps?.value, 1).filter(isValidPersonName),
        cinematographers: [],
        genres: cleanGenres.length > 0 ? cleanGenres : ['Drama'],
        tropes: [],
      });
      if (candidateRows.length >= batchSize) break;
    }

    const builtItems: MediaItem[] = [];
    for (let idx = 0; idx < candidateRows.length; idx++) {
      const row = candidateRows[idx];
      const cached = findCachedMediaByImdb(row.imdbId);
      if (cached) {
        builtItems.push(cached);
        continue;
      }

      const sug = await searchImdbPublicSuggestions(row.title);
      const match =
        sug.find((s: { imdbId: string }) => s.imdbId === row.imdbId) || sug[0];
      const imdbStars = match?.stars
        ? match.stars
            .split(',')
            .map((s: string) => s.trim())
            .filter(isValidPersonName)
        : [];
      const actorsList = Array.from(
        new Set([...row.cast, ...imdbStars])
      ).slice(0, 4);

      const deterministicScore = 7.7 + ((idx * 3) % 12) * 0.1;
      const item: MediaItem = {
        id: `imdb-${row.imdbId}`,
        tmdbId: parseInt(row.imdbId.replace(/\D/g, ''), 10) || 20000 + idx,
        imdbId: row.imdbId,
        title: row.title,
        year: row.year || 2021,
        mediaType: row.mediaType,
        tagline: `${row.year} · ${row.genres.slice(0, 2).join(' / ')}`,
        synopsis: `${row.title} (${row.year})${
          row.directors[0] ? ` directed by ${row.directors[0]}` : ''
        }${
          actorsList.length > 0
            ? `, starring ${actorsList.slice(0, 3).join(', ')}`
            : ''
        }.`,
        posterUrl: match?.posterUrl || '',
        backdropColor: row.mediaType === 'MOVIE' ? '#234B6E' : '#6B2D46',
        imdbRating: Number(deterministicScore.toFixed(1)),
        rottenTomatoes: Math.min(97, Math.round(deterministicScore * 10.6)),
        metascore: Math.min(94, Math.round(deterministicScore * 9.8)),
        contentRating: row.mediaType === 'TV' ? 'TV-MA' : 'PG-13',
        runtimeOrSeasons: row.mediaType === 'TV' ? '2 Seasons' : '2h 10m',
        directors: row.directors,
        writers: [],
        primaryGenre: row.genres[0] || 'Drama',
        genres: row.genres,
        tropes: [],
        cast: actorsList.map((name, i) => ({
          name,
          billing: i < 2 ? 'LEAD' : 'SUPPORTING',
        })),
        composers: row.composers,
        cinematographers: [],
        coWatchIds: [],
        streamingByRegion: makeFallbackRegionalStreaming(row.title),
        coordinates: {
          ra: `${((idx + 6) % 24).toString().padStart(2, '0')}h 24m`,
          dec: `+${((idx * 9 + 15) % 80).toString().padStart(2, '0')}° 12′`,
          sector: `AUTO-${row.imdbId.slice(2, 6)}`,
        },
      };

      cacheMediaItem(item);
      builtItems.push(item);
    }

    return builtItems;
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'search';
  const tmdbKey =
    searchParams.get('tmdbKey') || process.env.TMDB_API_KEY || '';
  const tmdbReadToken = process.env.TMDB_READ_ACCESS_TOKEN || '';
  const omdbKey =
    searchParams.get('omdbKey') || process.env.OMDB_API_KEY || '';
  const firebaseProjectId =
    searchParams.get('firebaseProjectId') ||
    process.env.FIREBASE_PROJECT_ID ||
    '';
  const firebaseApiKey =
    searchParams.get('firebaseApiKey') || process.env.FIREBASE_API_KEY || '';
  const hasTmdbAuth = Boolean(tmdbKey || tmdbReadToken);

  // Hydrate server cache from Cloud Firestore on cold start (or every 10m)
  await ensureFirestoreHydrated(firebaseProjectId, firebaseApiKey);
  const serverCache = getServerCache();
  const firestoreState = getFirestoreTelemetry(
    firebaseProjectId,
    firebaseApiKey
  );

  // ==================== ACTION 0: SERVER KEY STATUS & QUOTA + FIRESTORE TELEMETRY ====================
  if (action === 'status') {
    return NextResponse.json({
      tmdb: hasTmdbAuth,
      omdb: Boolean(omdbKey),
      firestore: firestoreState,
      quota: {
        omdbCallsToday: serverCache.omdbCallsToday,
        omdbDailySafeLimit: OMDB_DAILY_SAFE_LIMIT,
        tmdbCallsToday: serverCache.tmdbCallsToday,
        cachedTitlesCount: Object.keys(serverCache.items).length,
      },
    });
  }

  // ==================== ACTION 0A: HYDRATE PERSISTENT SERVER & FIRESTORE CACHE ====================
  if (action === 'cached-catalog') {
    return NextResponse.json({
      items: Object.values(serverCache.items),
      crawledCollaborators: serverCache.crawledCollaborators,
      firestore: firestoreState,
      quota: {
        omdbCallsToday: serverCache.omdbCallsToday,
        omdbDailySafeLimit: OMDB_DAILY_SAFE_LIMIT,
        tmdbCallsToday: serverCache.tmdbCallsToday,
        cachedTitlesCount: Object.keys(serverCache.items).length,
      },
    });
  }

  // ==================== ACTION 0C: AUTOMATIC QUOTA-SAFE CATALOG EXPANSION ====================
  if (action === 'auto-expand') {
    const collaborator =
      searchParams.get('collaborator')?.trim() || 'Christopher Nolan';
    const batchSize = Math.min(
      8,
      Math.max(1, parseInt(searchParams.get('batchSize') || '5', 10))
    );
    const excludeRaw = searchParams.get('exclude') || '';
    const excludeKeys = new Set(
      excludeRaw
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean)
    );

    let discovered: MediaItem[] = [];
    let source = 'PUBLIC_LIVE_GRAPH';

    if (hasTmdbAuth) {
      discovered = await discoverByCollaboratorTmdb(
        collaborator,
        excludeKeys,
        batchSize,
        tmdbKey,
        tmdbReadToken
      );
      source = 'TMDB_AUTO_EXPAND';
    }

    if (discovered.length === 0) {
      discovered = await discoverByCollaboratorWikidata(
        collaborator,
        excludeKeys,
        batchSize
      );
      source = 'WIKIDATA_AUTO_EXPAND';
    }

    const updatedCache = getServerCache();
    const collabLower = collaborator.toLowerCase();
    if (!updatedCache.crawledCollaborators.includes(collabLower)) {
      updatedCache.crawledCollaborators.push(collabLower);
      saveServerCache();
    }

    // Persist the newly discovered batch + collaborator state to Cloud Firestore (1-2 writes total)
    await syncServerCacheToFirestore(firebaseProjectId, firebaseApiKey);

    return NextResponse.json({
      collaborator,
      items: discovered,
      source,
      firestore: getFirestoreTelemetry(firebaseProjectId, firebaseApiKey),
      quota: {
        omdbCallsToday: updatedCache.omdbCallsToday,
        omdbDailySafeLimit: OMDB_DAILY_SAFE_LIMIT,
        tmdbCallsToday: updatedCache.tmdbCallsToday,
        cachedTitlesCount: Object.keys(updatedCache.items).length,
      },
    });
  }

  // ==================== ACTION 0B: SINGLE ITEM ENRICHMENT ====================
  if (action === 'item') {
    const tmdbId = parseInt(searchParams.get('tmdbId') || '', 10);
    const imdbId = searchParams.get('imdbId') || '';
    const mediaType =
      (searchParams.get('type') as MediaType) === 'TV' ? 'TV' : 'MOVIE';
    const title = searchParams.get('title') || 'Selected Title';
    const year = parseInt(searchParams.get('year') || '2024', 10);
    const posterUrl = searchParams.get('posterUrl') || '';

    if (hasTmdbAuth && !Number.isNaN(tmdbId) && tmdbId > 0 && !imdbId.startsWith('tt')) {
      const enriched = await fetchFullTmdbMediaItem(
        tmdbId,
        mediaType,
        tmdbKey,
        omdbKey,
        tmdbReadToken
      );
      if (enriched?.item) {
        await syncServerCacheToFirestore(firebaseProjectId, firebaseApiKey);
        return NextResponse.json({ item: enriched.item, source: 'TMDB_OMDB' });
      }
    }

    if (hasTmdbAuth && imdbId.startsWith('tt')) {
      try {
        const findRes = await fetchTmdb(
          `/find/${encodeURIComponent(imdbId)}`,
          { external_source: 'imdb_id' },
          tmdbKey,
          tmdbReadToken,
          3600
        );
        if (findRes.ok) {
          const findData = await findRes.json();
          const movieHit = findData.movie_results?.[0];
          const tvHit = findData.tv_results?.[0];
          const hit = movieHit || tvHit;
          const resolvedType: MediaType = tvHit ? 'TV' : 'MOVIE';
          if (hit?.id) {
            const enriched = await fetchFullTmdbMediaItem(
              hit.id,
              resolvedType,
              tmdbKey,
              omdbKey,
              tmdbReadToken
            );
            if (enriched?.item) {
              await syncServerCacheToFirestore(firebaseProjectId, firebaseApiKey);
              return NextResponse.json({ item: enriched.item, source: 'TMDB_OMDB' });
            }
          }
        }
      } catch {
        // Fall through to Wikidata single item lookup
      }
    }

    let resolvedImdbId = imdbId;
    if (!resolvedImdbId.startsWith('tt') && title) {
      const sug = await searchImdbPublicSuggestions(title);
      if (sug[0]?.imdbId) {
        resolvedImdbId = sug[0].imdbId;
      }
    }

    if (resolvedImdbId.startsWith('tt')) {
      const singleLookup = await fetchWikidataClusterByImdbId(
        resolvedImdbId,
        title,
        year,
        mediaType,
        posterUrl,
        omdbKey,
        true
      );
      await syncServerCacheToFirestore(firebaseProjectId, firebaseApiKey);
      return NextResponse.json({
        item: singleLookup.focalItem,
        source: 'PUBLIC_LIVE_GRAPH',
      });
    }

    return NextResponse.json({ item: null }, { status: 404 });
  }

  // ==================== ACTION 1: LIVE OMNI-SEARCH ====================
  if (action === 'search') {
    const q = searchParams.get('q')?.trim() || '';
    if (!q) {
      return NextResponse.json({ results: [], source: 'NONE' });
    }

    // 1A. If TMDB API Key / Read Token is available, query TMDB /search/multi
    if (hasTmdbAuth) {
      try {
        const res = await fetchTmdb(
          '/search/multi',
          {
            query: q,
            include_adult: 'false',
          },
          tmdbKey,
          tmdbReadToken,
          1800
        );
        if (res.ok) {
          const data = await res.json();
          const results = (data.results || [])
            .filter(
              (r: { media_type: string }) =>
                r.media_type === 'movie' || r.media_type === 'tv'
            )
            .slice(0, 10)
            .map(
              (r: {
                id: number;
                media_type: string;
                title?: string;
                name?: string;
                release_date?: string;
                first_air_date?: string;
                poster_path?: string;
                vote_average?: number;
                overview?: string;
              }) => {
                const mediaType: MediaType =
                  r.media_type === 'tv' ? 'TV' : 'MOVIE';
                const title = r.title || r.name || 'Untitled';
                const dateStr = r.release_date || r.first_air_date || '';
                const year = dateStr ? parseInt(dateStr.slice(0, 4), 10) : 2024;
                return {
                  id: `${mediaType.toLowerCase()}-${r.id}`,
                  tmdbId: r.id,
                  imdbId: '',
                  title,
                  year: !Number.isNaN(year) ? year : 2024,
                  mediaType,
                  posterUrl: r.poster_path
                    ? `https://image.tmdb.org/t/p/w500${r.poster_path}`
                    : '',
                  stars: r.overview ? r.overview.slice(0, 75) + '…' : '',
                  rating: r.vote_average
                    ? Number(r.vote_average.toFixed(1))
                    : undefined,
                  source: 'TMDB' as const,
                };
              }
            );
          return NextResponse.json({ results, source: 'TMDB' });
        }
      } catch {
        // Fall through to public IMDb live search
      }
    }

    // 1B. Zero-config Public Live Search via IMDb Suggestion API
    const publicResults = await searchImdbPublicSuggestions(q);
    return NextResponse.json({
      results: publicResults,
      source: 'PUBLIC_LIVE',
    });
  }

  // ==================== ACTION 2: BUILD LIVE 3D CLUSTER ====================
  if (action === 'cluster') {
    const tmdbId = parseInt(searchParams.get('tmdbId') || '', 10);
    const imdbId = searchParams.get('imdbId') || '';
    const mediaType =
      (searchParams.get('type') as MediaType) === 'TV' ? 'TV' : 'MOVIE';
    const title = searchParams.get('title') || 'Selected Title';
    const year = parseInt(searchParams.get('year') || '2024', 10);
    const posterUrl = searchParams.get('posterUrl') || '';

    // 2A. If TMDB API Key / Read Token is available and we have a valid tmdbId
    if (hasTmdbAuth && !Number.isNaN(tmdbId) && tmdbId > 0 && !imdbId.startsWith('tt')) {
      const focalData = await fetchFullTmdbMediaItem(
        tmdbId,
        mediaType,
        tmdbKey,
        omdbKey,
        tmdbReadToken
      );
      if (focalData) {
        const topRecs = focalData.rawRecs.slice(0, 12);
        const recResults: Array<{ item: MediaItem; rawRecs: Array<{ id: number; mediaType: MediaType }> } | null> = [];
        for (const r of topRecs) {
          recResults.push(
            await fetchFullTmdbMediaItem(
              r.id,
              r.mediaType,
              tmdbKey,
              undefined,
              tmdbReadToken,
              true
            )
          );
        }
        // Only retain recommended items that share a concrete craft or narrative connection
        const clusterItems = recResults
          .filter((r): r is NonNullable<typeof r> => r !== null)
          .map((r) => r.item)
          .filter((item) =>
            hasConcreteSharedConnection(calculateSimilarity(focalData.item, item))
          );

        focalData.item.coWatchIds = clusterItems.map((c) => c.id);
        await syncServerCacheToFirestore(firebaseProjectId, firebaseApiKey);

        return NextResponse.json({
          focalItem: focalData.item,
          clusterItems,
          source: 'TMDB_OMDB',
        });
      }
    }

    // If TMDB Key / Read Token is available and we have an imdbId, resolve it via TMDB /find/{imdb_id}
    if (hasTmdbAuth && imdbId.startsWith('tt')) {
      try {
        const findRes = await fetchTmdb(
          `/find/${encodeURIComponent(imdbId)}`,
          { external_source: 'imdb_id' },
          tmdbKey,
          tmdbReadToken,
          3600
        );
        if (findRes.ok) {
          const findData = await findRes.json();
          const movieHit = findData.movie_results?.[0];
          const tvHit = findData.tv_results?.[0];
          const hit = movieHit || tvHit;
          const resolvedType: MediaType = tvHit ? 'TV' : 'MOVIE';
          if (hit?.id) {
            const focalData = await fetchFullTmdbMediaItem(
              hit.id,
              resolvedType,
              tmdbKey,
              omdbKey,
              tmdbReadToken
            );
            if (focalData) {
              const topRecs = focalData.rawRecs.slice(0, 12);
              const recResults: Array<{ item: MediaItem; rawRecs: Array<{ id: number; mediaType: MediaType }> } | null> = [];
              for (const r of topRecs) {
                recResults.push(
                  await fetchFullTmdbMediaItem(
                    r.id,
                    r.mediaType,
                    tmdbKey,
                    undefined,
                    tmdbReadToken,
                    true
                  )
                );
              }
              const clusterItems = recResults
                .filter((r): r is NonNullable<typeof r> => r !== null)
                .map((r) => r.item)
                .filter((item) =>
                  hasConcreteSharedConnection(calculateSimilarity(focalData.item, item))
                );
              focalData.item.coWatchIds = clusterItems.map((c) => c.id);
              await syncServerCacheToFirestore(firebaseProjectId, firebaseApiKey);

              return NextResponse.json({
                focalItem: focalData.item,
                clusterItems,
                source: 'TMDB_OMDB',
              });
            }
          }
        }
      } catch {
        // Fall through to Wikidata live cluster
      }
    }

    // 2B. Zero-Key Public Live Cluster Builder (Wikidata SPARQL + IMDb + OMDb)
    let resolvedImdbId = imdbId;
    if (!resolvedImdbId.startsWith('tt')) {
      const sug = await searchImdbPublicSuggestions(title);
      if (sug[0]?.imdbId) {
        resolvedImdbId = sug[0].imdbId;
      }
    }

    if (resolvedImdbId.startsWith('tt')) {
      const liveCluster = await fetchWikidataClusterByImdbId(
        resolvedImdbId,
        title,
        year,
        mediaType,
        posterUrl,
        omdbKey,
        false
      );
      await syncServerCacheToFirestore(firebaseProjectId, firebaseApiKey);
      return NextResponse.json({
        ...liveCluster,
        source: 'PUBLIC_LIVE_GRAPH',
      });
    }

    return NextResponse.json(
      { error: 'Unable to resolve live cluster for item' },
      { status: 404 }
    );
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
