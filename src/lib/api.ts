import { INITIAL_BOOTSTRAP_SEEDS } from './seed-data';
import {
  MediaItem,
  MediaType,
} from './types';

const OMDB_BASE_URL = 'https://www.omdbapi.com/';

const STORAGE_TMDB_KEY = 'sixdegrees_tmdb_api_key';
const STORAGE_OMDB_KEY = 'sixdegrees_omdb_api_key';
const STORAGE_FIREBASE_PROJECT_KEY = 'sixdegrees_firebase_project_id';
const STORAGE_FIREBASE_API_KEY = 'sixdegrees_firebase_api_key';
const STORAGE_EXPANDED_CATALOG_KEY = 'sixdegrees_expanded_catalog_v1';
const STORAGE_QUERIED_COLLABORATORS_KEY =
  'sixdegrees_queried_collaborators_v1';
const STORAGE_WATCHED_MEDIA_KEY = 'sixdegrees_watched_ids_v1';
const STORAGE_INTERESTED_MEDIA_KEY = 'sixdegrees_interested_ids_v1';

export interface QuotaTelemetry {
  omdbCallsToday: number;
  omdbDailySafeLimit: number;
  tmdbCallsToday: number;
  cachedTitlesCount: number;
}

export interface FirestoreSyncTelemetry {
  enabled: boolean;
  projectId: string;
  authMode: 'SERVICE_ACCOUNT' | 'API_KEY' | 'NONE';
  lastSyncedAt: number | null;
  firestoreReadsSession: number;
  firestoreWritesSession: number;
}

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

export function getActiveApiKeys(): {
  tmdbKey: string;
  omdbKey: string;
  firebaseProjectId: string;
  firebaseApiKey: string;
} {
  if (typeof window === 'undefined') {
    return {
      tmdbKey: '',
      omdbKey: '',
      firebaseProjectId: '',
      firebaseApiKey: '',
    };
  }
  return {
    tmdbKey: localStorage.getItem(STORAGE_TMDB_KEY) || '',
    omdbKey: localStorage.getItem(STORAGE_OMDB_KEY) || '',
    firebaseProjectId: localStorage.getItem(STORAGE_FIREBASE_PROJECT_KEY) || '',
    firebaseApiKey: localStorage.getItem(STORAGE_FIREBASE_API_KEY) || '',
  };
}

export function saveRuntimeApiKeys(
  tmdbKey: string,
  omdbKey: string,
  firebaseProjectId?: string,
  firebaseApiKey?: string
): void {
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
  if (firebaseProjectId !== undefined) {
    if (firebaseProjectId.trim()) {
      localStorage.setItem(
        STORAGE_FIREBASE_PROJECT_KEY,
        firebaseProjectId.trim()
      );
    } else {
      localStorage.removeItem(STORAGE_FIREBASE_PROJECT_KEY);
    }
  }
  if (firebaseApiKey !== undefined) {
    if (firebaseApiKey.trim()) {
      localStorage.setItem(STORAGE_FIREBASE_API_KEY, firebaseApiKey.trim());
    } else {
      localStorage.removeItem(STORAGE_FIREBASE_API_KEY);
    }
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
 * Queries the server route to check if server-side .env.local keys & Cloud Firestore are configured
 * and retrieves current free-tier quota telemetry.
 */
export async function fetchServerApiKeyStatus(): Promise<{
  tmdb: boolean;
  omdb: boolean;
  quota?: QuotaTelemetry;
  firestore?: FirestoreSyncTelemetry;
}> {
  const local = hasLiveApiKeys();
  const { firebaseProjectId, firebaseApiKey } = getActiveApiKeys();
  const params = new URLSearchParams({ action: 'status' });
  if (firebaseProjectId) params.set('firebaseProjectId', firebaseProjectId);
  if (firebaseApiKey) params.set('firebaseApiKey', firebaseApiKey);

  try {
    const res = await fetch(`/api/live-media?${params.toString()}`);
    if (!res.ok) return local;
    const data = await res.json();
    return {
      tmdb: Boolean(data.tmdb || local.tmdb),
      omdb: Boolean(data.omdb || local.omdb),
      quota: data.quota,
      firestore: data.firestore,
    };
  } catch {
    return local;
  }
}

/**
 * Returns any previously cached titles in localStorage.
 * If empty on initial visit, returns an empty array and triggers hydration from
 * Cloud Firestore / server cache in 1 fast response.
 */
export function getInitialMediaLibrary(): MediaItem[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_EXPANDED_CATALOG_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw) as MediaItem[];
    if (!Array.isArray(items) || items.length === 0) return [];
    return items.filter((item) => Boolean(item?.id && item?.title));
  } catch {
    return [];
  }
}

/**
 * Saves cached MediaItems to localStorage so the catalog persists across reloads
 * without re-spending any API quota.
 */
export function saveExpandedCatalogToStorage(allItems: MediaItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (allItems.length > 0) {
      localStorage.setItem(STORAGE_EXPANDED_CATALOG_KEY, JSON.stringify(allItems));
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function clearExpandedCatalogStorage(): MediaItem[] {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_EXPANDED_CATALOG_KEY);
    localStorage.removeItem(STORAGE_QUERIED_COLLABORATORS_KEY);
  }
  return [];
}

export function getQueriedCollaborators(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_QUERIED_COLLABORATORS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function markCollaboratorQueried(name: string): void {
  if (typeof window === 'undefined') return;
  try {
    const set = getQueriedCollaborators();
    set.add(name.toLowerCase());
    localStorage.setItem(
      STORAGE_QUERIED_COLLABORATORS_KEY,
      JSON.stringify(Array.from(set))
    );
  } catch {
    // Ignore storage errors
  }
}

/**
 * Hydrates any titles already cached in Cloud Firestore or the server's `.next/cache` store.
 */
export async function fetchServerCachedCatalog(): Promise<{
  items: MediaItem[];
  crawledCollaborators?: string[];
  quota?: QuotaTelemetry;
  firestore?: FirestoreSyncTelemetry;
}> {
  const { firebaseProjectId, firebaseApiKey } = getActiveApiKeys();
  const params = new URLSearchParams({ action: 'cached-catalog' });
  if (firebaseProjectId) params.set('firebaseProjectId', firebaseProjectId);
  if (firebaseApiKey) params.set('firebaseApiKey', firebaseApiKey);

  try {
    const res = await fetch(`/api/live-media?${params.toString()}`);
    if (!res.ok) return { items: [] };
    const data = await res.json();
    if (Array.isArray(data.crawledCollaborators)) {
      for (const name of data.crawledCollaborators) {
        if (typeof name === 'string' && name) {
          markCollaboratorQueried(name);
        }
      }
    }
    return {
      items: Array.isArray(data.items) ? data.items : [],
      crawledCollaborators: data.crawledCollaborators,
      quota: data.quota,
      firestore: data.firestore,
    };
  } catch {
    return { items: [] };
  }
}

/**
 * Automatically fetches a small quota-safe batch of Movies & TV Shows connected to
 * a specific collaborator in the graph (uses 0 OMDb calls, paced TMDB calls, and syncs to Firestore).
 */
export async function fetchAutoExpandBatch(
  collaborator: string,
  existingItems: MediaItem[],
  batchSize = 5
): Promise<{
  collaborator: string;
  items: MediaItem[];
  source: string;
  quota?: QuotaTelemetry;
  firestore?: FirestoreSyncTelemetry;
} | null> {
  const { tmdbKey, omdbKey, firebaseProjectId, firebaseApiKey } =
    getActiveApiKeys();
  const excludeTokens: string[] = [];
  for (const m of existingItems.slice(0, 220)) {
    if (m.tmdbId > 0) excludeTokens.push(`tmdb:${m.mediaType}:${m.tmdbId}`);
    if (m.imdbId?.startsWith('tt')) excludeTokens.push(`imdb:${m.imdbId}`);
    excludeTokens.push(`title:${m.title.toLowerCase()}`);
  }

  const params = new URLSearchParams({
    action: 'auto-expand',
    collaborator,
    batchSize: String(batchSize),
    exclude: excludeTokens.join('|'),
  });
  if (tmdbKey) params.set('tmdbKey', tmdbKey);
  if (omdbKey) params.set('omdbKey', omdbKey);
  if (firebaseProjectId) params.set('firebaseProjectId', firebaseProjectId);
  if (firebaseApiKey) params.set('firebaseApiKey', firebaseApiKey);

  try {
    const res = await fetch(`/api/live-media?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data.crawledCollaborators)) {
      for (const name of data.crawledCollaborators) {
        if (typeof name === 'string' && name) {
          markCollaboratorQueried(name);
        }
      }
    }
    return {
      collaborator: data.collaborator || collaborator,
      items: Array.isArray(data.items) ? data.items : [],
      source: data.source || 'AUTO_EXPAND',
      quota: data.quota,
      firestore: data.firestore,
    };
  } catch {
    return null;
  }
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

/**
 * Loads user-marked Watched media IDs from localStorage (defaults to ['inception'] so
 * first-time visitors immediately see "Because you watched Inception" suggestions ready to customize).
 */
export function getInitialWatchedIds(): string[] {
  if (typeof window === 'undefined') {
    return ['inception'];
  }
  try {
    const raw = localStorage.getItem(STORAGE_WATCHED_MEDIA_KEY);
    if (!raw) return ['inception'];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : ['inception'];
  } catch {
    return ['inception'];
  }
}

export function saveWatchedIdsToStorage(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_WATCHED_MEDIA_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage quota errors
  }
}

export function getInitialInterestedIds(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_INTERESTED_MEDIA_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

export function saveInterestedIdsToStorage(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_INTERESTED_MEDIA_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Fetches live Movie & TV Show suggestions from TMDB / public catalog based on a seed title or genre/category
 */
export async function fetchLiveSuggestions(options: {
  seedTmdbId?: number;
  seedImdbId?: string;
  seedMediaType?: MediaType;
  seedTitle?: string;
  genre?: string;
  mediaType?: 'ALL' | 'MOVIE' | 'TV';
}): Promise<{
  items: MediaItem[];
  source: string;
  quota?: QuotaTelemetry;
  firestore?: FirestoreSyncTelemetry;
} | null> {
  const { tmdbKey, omdbKey, firebaseProjectId, firebaseApiKey } =
    getActiveApiKeys();
  const params = new URLSearchParams({
    action: 'suggest',
  });
  if (options.seedTmdbId) params.set('seedTmdbId', String(options.seedTmdbId));
  if (options.seedImdbId) params.set('seedImdbId', options.seedImdbId);
  if (options.seedMediaType) params.set('seedMediaType', options.seedMediaType);
  if (options.seedTitle) params.set('seedTitle', options.seedTitle);
  if (options.genre) params.set('genre', options.genre);
  if (options.mediaType) params.set('mediaType', options.mediaType);
  if (tmdbKey) params.set('tmdbKey', tmdbKey);
  if (omdbKey) params.set('omdbKey', omdbKey);
  if (firebaseProjectId) params.set('firebaseProjectId', firebaseProjectId);
  if (firebaseApiKey) params.set('firebaseApiKey', firebaseApiKey);

  try {
    const res = await fetch(`/api/live-media?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      items: Array.isArray(data.items) ? data.items : [],
      source: data.source || 'LIVE_SUGGEST',
      quota: data.quota,
      firestore: data.firestore,
    };
  } catch {
    return null;
  }
}

