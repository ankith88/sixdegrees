import { SEED_MEDIA_ITEMS } from './seed-data';
import {
  MediaItem,
  MediaType,
} from './types';

const OMDB_BASE_URL = 'https://www.omdbapi.com/';

const STORAGE_TMDB_KEY = 'sixdegrees_tmdb_api_key';
const STORAGE_OMDB_KEY = 'sixdegrees_omdb_api_key';

export interface LiveSearchResult {
  id: string;
  tmdbId: number;
  imdbId: string;
  title: string;
  year: number;
  mediaType: MediaType;
  posterUrl: string;
  stars?: string;
  rating?: number;
  source: 'TMDB' | 'PUBLIC_LIVE' | 'SEED';
}

export function getActiveApiKeys(): { tmdbKey: string; omdbKey: string } {
  if (typeof window === 'undefined') {
    return { tmdbKey: '', omdbKey: '' };
  }
  return {
    tmdbKey: localStorage.getItem(STORAGE_TMDB_KEY) || '',
    omdbKey: localStorage.getItem(STORAGE_OMDB_KEY) || '',
  };
}

export function saveRuntimeApiKeys(tmdbKey: string, omdbKey: string): void {
  if (typeof window === 'undefined') return;
  if (tmdbKey.trim()) {
    localStorage.setItem(STORAGE_TMDB_KEY, tmdbKey.trim());
  } else {
    localStorage.removeItem(STORAGE_TMDB_KEY);
  }
  if (omdbKey.trim()) {
    localStorage.setItem(STORAGE_OMDB_KEY, omdbKey.trim());
  } else {
    localStorage.removeItem(STORAGE_OMDB_KEY);
  }
}

export function hasLiveApiKeys(): { tmdb: boolean; omdb: boolean } {
  const { tmdbKey, omdbKey } = getActiveApiKeys();
  return {
    tmdb: Boolean(tmdbKey),
    omdb: Boolean(omdbKey),
  };
}

/**
 * Queries the server route to check if server-side .env.local keys are configured
 * (Returns booleans only; secret keys never leave the server)
 */
export async function fetchServerApiKeyStatus(): Promise<{
  tmdb: boolean;
  omdb: boolean;
}> {
  const local = hasLiveApiKeys();
  try {
    const res = await fetch('/api/live-media?action=status');
    if (!res.ok) return local;
    const data = await res.json();
    return {
      tmdb: Boolean(data.tmdb || local.tmdb),
      omdb: Boolean(data.omdb || local.omdb),
    };
  } catch {
    return local;
  }
}

/**
 * Returns the pre-loaded rich seed dataset centered on Inception (2010)
 * connected to 30+ similar Movies and TV Shows.
 */
export function getInitialMediaLibrary(): MediaItem[] {
  return SEED_MEDIA_ITEMS;
}

/**
 * Live Omni-Search across global Movies & TV Shows (TMDB /search/multi or Public IMDb Live API)
 */
export async function searchLiveCatalog(
  query: string
): Promise<{ results: LiveSearchResult[]; source: string }> {
  const q = query.trim();
  if (!q) return { results: [], source: 'NONE' };

  const { tmdbKey, omdbKey } = getActiveApiKeys();
  const params = new URLSearchParams({
    action: 'search',
    q,
  });
  if (tmdbKey) params.set('tmdbKey', tmdbKey);
  if (omdbKey) params.set('omdbKey', omdbKey);

  try {
    const res = await fetch(`/api/live-media?${params.toString()}`);
    if (!res.ok) return { results: [], source: 'ERROR' };
    const data = await res.json();
    return {
      results: Array.isArray(data.results) ? data.results : [],
      source: data.source || 'PUBLIC_LIVE',
    };
  } catch {
    return { results: [], source: 'ERROR' };
  }
}

/**
 * Fetches a single Movie or TV Show to add to the archive graph without importing
 * unrelated recommendations or forcing a focal cluster.
 */
export async function fetchSingleLiveMedia(target: {
  tmdbId?: number;
  imdbId?: string;
  mediaType: MediaType;
  title: string;
  year?: number;
  posterUrl?: string;
}): Promise<{ item: MediaItem; source: string } | null> {
  const { tmdbKey, omdbKey } = getActiveApiKeys();
  const params = new URLSearchParams({
    action: 'item',
    type: target.mediaType,
    title: target.title,
    year: String(target.year || 2024),
  });
  if (target.tmdbId) params.set('tmdbId', String(target.tmdbId));
  if (target.imdbId) params.set('imdbId', target.imdbId);
  if (target.posterUrl) params.set('posterUrl', target.posterUrl);
  if (tmdbKey) params.set('tmdbKey', tmdbKey);
  if (omdbKey) params.set('omdbKey', omdbKey);

  try {
    const res = await fetch(`/api/live-media?${params.toString()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.item) return null;
    return {
      item: data.item,
      source: data.source || 'PUBLIC_LIVE_GRAPH',
    };
  } catch {
    return null;
  }
}

/**
 * Dynamically builds a live 3D recommendation cluster for ANY Movie or TV Show
 * using TMDB + OMDb (when keys are set) or Public Live Wikidata/IMDb Graph (zero-key).
 */
export async function fetchLiveCluster(target: {
  tmdbId?: number;
  imdbId?: string;
  mediaType: MediaType;
  title: string;
  year?: number;
  posterUrl?: string;
}): Promise<{
  focalItem: MediaItem;
  clusterItems: MediaItem[];
  source: string;
} | null> {
  const { tmdbKey, omdbKey } = getActiveApiKeys();
  const params = new URLSearchParams({
    action: 'cluster',
    type: target.mediaType,
    title: target.title,
    year: String(target.year || 2024),
  });
  if (target.tmdbId) params.set('tmdbId', String(target.tmdbId));
  if (target.imdbId) params.set('imdbId', target.imdbId);
  if (target.posterUrl) params.set('posterUrl', target.posterUrl);
  if (tmdbKey) params.set('tmdbKey', tmdbKey);
  if (omdbKey) params.set('omdbKey', omdbKey);

  try {
    const res = await fetch(`/api/live-media?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.focalItem) return null;
    return {
      focalItem: data.focalItem,
      clusterItems: Array.isArray(data.clusterItems) ? data.clusterItems : [],
      source: data.source || 'PUBLIC_LIVE_GRAPH',
    };
  } catch {
    return null;
  }
}

/**
 * Fetches IMDb Rating, Rotten Tomatoes %, and Metascore from OMDb API using imdb_id
 */
export async function fetchOmdbRatings(imdbId: string): Promise<{
  imdbRating?: number;
  rottenTomatoes?: number;
  metascore?: number;
  contentRating?: string;
  runtime?: string;
} | null> {
  const { omdbKey } = getActiveApiKeys();
  if (!omdbKey || !imdbId) return null;

  try {
    const res = await fetch(
      `${OMDB_BASE_URL}?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(omdbKey)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.Response === 'False') return null;

    let rottenTomatoes: number | undefined;
    if (Array.isArray(data.Ratings)) {
      const rtObj = data.Ratings.find(
        (r: { Source: string; Value: string }) =>
          r.Source === 'Rotten Tomatoes'
      );
      if (rtObj?.Value) {
        const parsed = parseInt(rtObj.Value.replace('%', ''), 10);
        if (!Number.isNaN(parsed)) rottenTomatoes = parsed;
      }
    }

    const imdbRating = data.imdbRating ? parseFloat(data.imdbRating) : undefined;
    const metascore = data.Metascore ? parseInt(data.Metascore, 10) : undefined;

    return {
      imdbRating: !Number.isNaN(imdbRating ?? NaN) ? imdbRating : undefined,
      rottenTomatoes,
      metascore: !Number.isNaN(metascore ?? NaN) ? metascore : undefined,
      contentRating:
        data.Rated && data.Rated !== 'N/A' ? data.Rated : undefined,
      runtime:
        data.Runtime && data.Runtime !== 'N/A' ? data.Runtime : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Fetches full Movie or TV Show telemetry from the server-side /api/live-media route
 * (which securely uses server-only TMDB_API_KEY / TMDB_READ_ACCESS_TOKEN and OMDB_API_KEY)
 */
export async function fetchMediaFromTmdbAndOmdb(
  tmdbId: number,
  mediaType: MediaType,
  fallbackItem?: MediaItem
): Promise<MediaItem | null> {
  const { tmdbKey, omdbKey } = getActiveApiKeys();
  const params = new URLSearchParams({
    action: 'item',
    tmdbId: String(tmdbId),
    type: mediaType,
  });
  if (tmdbKey) params.set('tmdbKey', tmdbKey);
  if (omdbKey) params.set('omdbKey', omdbKey);

  try {
    const res = await fetch(`/api/live-media?${params.toString()}`);
    if (!res.ok) return fallbackItem || null;
    const data = await res.json();
    const serverItem: MediaItem | null = data?.item || null;
    if (!serverItem) return fallbackItem || null;

    return {
      ...serverItem,
      id: fallbackItem?.id || serverItem.id,
      backdropColor: fallbackItem?.backdropColor || serverItem.backdropColor,
      tropes:
        fallbackItem?.tropes && fallbackItem.tropes.length > 0
          ? fallbackItem.tropes
          : serverItem.tropes,
      coWatchIds:
        fallbackItem?.coWatchIds && fallbackItem.coWatchIds.length > 0
          ? fallbackItem.coWatchIds
          : serverItem.coWatchIds,
      coordinates: fallbackItem?.coordinates || serverItem.coordinates,
    };
  } catch {
    return fallbackItem || null;
  }
}
