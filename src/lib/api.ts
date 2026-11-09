import { SEED_MEDIA_ITEMS } from './seed-data';
import {
  CastMember,
  MediaItem,
  MediaType,
  RegionCode,
  StreamingOffer,
} from './types';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
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

const PROVIDER_BRAND_COLORS: Record<string, { short: string; color: string }> = {
  Netflix: { short: 'N', color: '#B81D24' },
  'Apple TV': { short: 'ATV', color: '#1F242B' },
  'Apple TV Plus': { short: 'tv+', color: '#1F242B' },
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
  NOW: { short: 'NOW', color: '#195E47' },
};

export function getActiveApiKeys(): { tmdbKey: string; omdbKey: string } {
  const envTmdb = process.env.NEXT_PUBLIC_TMDB_API_KEY || '';
  const envOmdb = process.env.NEXT_PUBLIC_OMDB_API_KEY || '';
  if (typeof window === 'undefined') {
    return { tmdbKey: envTmdb, omdbKey: envOmdb };
  }
  return {
    tmdbKey: localStorage.getItem(STORAGE_TMDB_KEY) || envTmdb,
    omdbKey: localStorage.getItem(STORAGE_OMDB_KEY) || envOmdb,
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

interface TmdbWatchProviderEntry {
  provider_name: string;
}

interface TmdbRegionProviders {
  link?: string;
  flatrate?: TmdbWatchProviderEntry[];
  rent?: TmdbWatchProviderEntry[];
  buy?: TmdbWatchProviderEntry[];
}

function parseTmdbRegionalProviders(
  results: Record<string, TmdbRegionProviders> | undefined,
  fallbackTitle: string
): Record<RegionCode, StreamingOffer[]> {
  const regions: RegionCode[] = ['AU', 'US', 'UK'];
  const out: Record<RegionCode, StreamingOffer[]> = { AU: [], US: [], UK: [] };

  for (const reg of regions) {
    const regData = results?.[reg];
    if (!regData) continue;
    const link =
      regData.link ||
      `https://www.themoviedb.org/search?query=${encodeURIComponent(fallbackTitle)}`;

    const pushOffers = (
      entries: TmdbWatchProviderEntry[] | undefined,
      type: 'STREAM' | 'RENT' | 'BUY'
    ) => {
      if (!entries) return;
      for (const entry of entries.slice(0, 4)) {
        const brand = PROVIDER_BRAND_COLORS[entry.provider_name] || {
          short: entry.provider_name.slice(0, 4).toUpperCase(),
          color: '#234B6E',
        };
        out[reg].push({
          provider: entry.provider_name,
          shortName: brand.short,
          type,
          quality: '4K',
          color: brand.color,
          url: link,
        });
      }
    };

    pushOffers(regData.flatrate, 'STREAM');
    pushOffers(regData.rent, 'RENT');
    pushOffers(regData.buy, 'BUY');
  }

  return out;
}

/**
 * Fetches full Movie or TV Show telemetry from TMDB API + OMDb API
 */
export async function fetchMediaFromTmdbAndOmdb(
  tmdbId: number,
  mediaType: MediaType,
  fallbackItem?: MediaItem
): Promise<MediaItem | null> {
  const { tmdbKey } = getActiveApiKeys();
  if (!tmdbKey) {
    return fallbackItem || null;
  }

  const endpoint = mediaType === 'MOVIE' ? 'movie' : 'tv';
  const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${encodeURIComponent(
    tmdbKey
  )}&append_to_response=credits,keywords,recommendations,external_ids,watch/providers`;

  try {
    const res = await fetch(url);
    if (!res.ok) return fallbackItem || null;
    const data = await res.json();

    const imdbId =
      data.imdb_id ||
      data.external_ids?.imdb_id ||
      fallbackItem?.imdbId ||
      '';

    const omdbData = imdbId ? await fetchOmdbRatings(imdbId) : null;

    const title = data.title || data.name || fallbackItem?.title || 'Unknown';
    const releaseDate = data.release_date || data.first_air_date || '';
    const year = releaseDate
      ? parseInt(releaseDate.slice(0, 4), 10)
      : fallbackItem?.year || 2024;

    const directors: string[] = [];
    if (mediaType === 'TV' && Array.isArray(data.created_by)) {
      for (const creator of data.created_by) {
        if (creator?.name) directors.push(creator.name);
      }
    }
    const crew = data.credits?.crew || [];
    for (const member of crew) {
      if (member.job === 'Director' && !directors.includes(member.name)) {
        directors.push(member.name);
      }
    }

    const writers: string[] = [];
    for (const member of crew) {
      if (
        (member.job === 'Screenplay' ||
          member.job === 'Writer' ||
          member.department === 'Writing') &&
        !writers.includes(member.name)
      ) {
        writers.push(member.name);
      }
    }

    const composers: string[] = [];
    const cinematographers: string[] = [];
    for (const member of crew) {
      if (
        (member.job === 'Original Music Composer' ||
          member.job === 'Music') &&
        !composers.includes(member.name)
      ) {
        composers.push(member.name);
      }
      if (
        member.job === 'Director of Photography' &&
        !cinematographers.includes(member.name)
      ) {
        cinematographers.push(member.name);
      }
    }

    const rawCast = Array.isArray(data.credits?.cast)
      ? data.credits.cast.slice(0, 5)
      : [];
    const cast: CastMember[] = rawCast.map(
      (c: { name: string; character?: string }, idx: number) => ({
        name: c.name,
        character: c.character,
        billing: idx < 2 ? 'LEAD' : 'SUPPORTING',
      })
    );

    const genres: string[] = Array.isArray(data.genres)
      ? data.genres.map((g: { name: string }) =>
          g.name === 'Science Fiction' ? 'Sci-Fi' : g.name
        )
      : fallbackItem?.genres || ['Sci-Fi'];

    const rawKeywords =
      data.keywords?.keywords || data.keywords?.results || [];
    const tropes: string[] =
      fallbackItem?.tropes && fallbackItem.tropes.length > 0
        ? fallbackItem.tropes
        : rawKeywords.slice(0, 5).map((k: { name: string }) =>
            k.name
              .split(' ')
              .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ')
          );

    const parsedProviders = parseTmdbRegionalProviders(
      data['watch/providers']?.results,
      title
    );

    const streamingByRegion: Record<RegionCode, StreamingOffer[]> = {
      AU:
        parsedProviders.AU.length > 0
          ? parsedProviders.AU
          : fallbackItem?.streamingByRegion.AU || [],
      US:
        parsedProviders.US.length > 0
          ? parsedProviders.US
          : fallbackItem?.streamingByRegion.US || [],
      UK:
        parsedProviders.UK.length > 0
          ? parsedProviders.UK
          : fallbackItem?.streamingByRegion.UK || [],
    };

    const runtimeMinutes = data.runtime;
    const formattedRuntime =
      mediaType === 'MOVIE' && runtimeMinutes
        ? `${Math.floor(runtimeMinutes / 60)}h ${runtimeMinutes % 60}m`
        : mediaType === 'TV' && data.number_of_seasons
          ? `${data.number_of_seasons} Season${data.number_of_seasons > 1 ? 's' : ''}`
          : omdbData?.runtime || fallbackItem?.runtimeOrSeasons || '2h 15m';

    return {
      id:
        fallbackItem?.id ||
        title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      tmdbId,
      imdbId,
      title,
      year,
      mediaType,
      tagline: data.tagline || fallbackItem?.tagline || '',
      synopsis: data.overview || fallbackItem?.synopsis || '',
      posterUrl: data.poster_path
        ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
        : fallbackItem?.posterUrl || '',
      backdropColor: fallbackItem?.backdropColor || '#234B6E',
      imdbRating:
        omdbData?.imdbRating ||
        (data.vote_average ? Number(data.vote_average.toFixed(1)) : 8.0),
      rottenTomatoes:
        omdbData?.rottenTomatoes ||
        fallbackItem?.rottenTomatoes ||
        Math.min(98, Math.round((data.vote_average || 7.8) * 10)),
      metascore:
        omdbData?.metascore ||
        fallbackItem?.metascore ||
        Math.min(95, Math.round((data.vote_average || 7.8) * 9.5)),
      contentRating:
        omdbData?.contentRating ||
        fallbackItem?.contentRating ||
        (mediaType === 'TV' ? 'TV-MA' : 'PG-13'),
      runtimeOrSeasons: formattedRuntime,
      directors:
        directors.length > 0 ? directors : fallbackItem?.directors || [],
      writers: writers.length > 0 ? writers.slice(0, 3) : fallbackItem?.writers || [],
      primaryGenre: genres[0] || 'Sci-Fi',
      genres,
      tropes,
      cast: cast.length > 0 ? cast : fallbackItem?.cast || [],
      composers:
        composers.length > 0 ? composers : fallbackItem?.composers || [],
      cinematographers:
        cinematographers.length > 0
          ? cinematographers
          : fallbackItem?.cinematographers || [],
      coWatchIds: fallbackItem?.coWatchIds || [],
      streamingByRegion,
      coordinates: fallbackItem?.coordinates,
    };
  } catch {
    return fallbackItem || null;
  }
}
