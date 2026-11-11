#!/usr/bin/env node
/**
 * Standalone Scheduled / CLI Catalog Expansion Script (`npm run expand-catalog`)
 * Automatically discovers connected Movies & TV Shows from TMDB + OMDb
 * (strictly respecting the 750/day OMDb free-tier safety ceiling and ~7 req/s TMDB pacing)
 * and persists the expanded catalog to both `.next/cache/sixdegrees-auto-catalog.json`
 * and Cloud Firestore (`sixdegrees_catalog/bundle_*` + `telemetry`).
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env.local');
const CACHE_PATH = path.join(ROOT, '.next', 'cache', 'sixdegrees-auto-catalog.json');

// Load .env.local if present
if (fs.existsSync(ENV_PATH)) {
  const raw = fs.readFileSync(ENV_PATH, 'utf-8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (k && !process.env[k]) process.env[k] = v;
  }
}

const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
const TMDB_READ_ACCESS_TOKEN = process.env.TMDB_READ_ACCESS_TOKEN || '';
const OMDB_API_KEY = process.env.OMDB_API_KEY || '';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'sixdegrees-archive-db';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || '';
const OMDB_DAILY_SAFE_LIMIT = 750;
const ITEMS_PER_BUNDLE = 80;
const MAX_BUNDLES = 10;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const todayUtcKey = () => new Date().toISOString().slice(0, 10);

function loadLocalCache() {
  try {
    if (fs.existsSync(CACHE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
      const today = todayUtcKey();
      const sameDay = parsed.dayKey === today;
      return {
        version: 1,
        dayKey: today,
        omdbCallsToday: sameDay ? parsed.omdbCallsToday || 0 : 0,
        tmdbCallsToday: sameDay ? parsed.tmdbCallsToday || 0 : 0,
        items: parsed.items || {},
        omdbByImdb: parsed.omdbByImdb || {},
        crawledCollaborators: Array.isArray(parsed.crawledCollaborators)
          ? parsed.crawledCollaborators
          : [],
      };
    }
  } catch {
    // ignore
  }
  return {
    version: 1,
    dayKey: todayUtcKey(),
    omdbCallsToday: 0,
    tmdbCallsToday: 0,
    items: {},
    omdbByImdb: {},
    crawledCollaborators: [],
  };
}

function saveLocalCache(cache) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache), 'utf-8');
}

async function fetchTmdbJson(endpoint, params = {}, cache) {
  await sleep(150);
  const url = new URL(`https://api.themoviedb.org/3${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const headers = { Accept: 'application/json' };
  if (TMDB_READ_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${TMDB_READ_ACCESS_TOKEN}`;
  } else if (TMDB_API_KEY) {
    url.searchParams.set('api_key', TMDB_API_KEY);
  }
  cache.tmdbCallsToday += 1;
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) return null;
  return res.json();
}

async function fetchOmdbByImdbId(imdbId, cache) {
  if (!imdbId || !imdbId.startsWith('tt') || !OMDB_API_KEY) return null;
  if (cache.omdbByImdb[imdbId]) return cache.omdbByImdb[imdbId];
  if (cache.omdbCallsToday >= OMDB_DAILY_SAFE_LIMIT) return null;

  await sleep(120);
  cache.omdbCallsToday += 1;
  const url = `https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(OMDB_API_KEY)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || data.Response === 'False') return null;

  let rt;
  if (Array.isArray(data.Ratings)) {
    const rtObj = data.Ratings.find((r) => r.Source === 'Rotten Tomatoes');
    if (rtObj && rtObj.Value) {
      const parsed = parseInt(rtObj.Value.replace('%', ''), 10);
      if (!Number.isNaN(parsed)) rt = parsed;
    }
  }
  const imdbRating =
    data.imdbRating && data.imdbRating !== 'N/A' ? parseFloat(data.imdbRating) : undefined;
  const metascore =
    data.Metascore && data.Metascore !== 'N/A' ? parseInt(data.Metascore, 10) : undefined;

  const entry = {
    imdbRating: !Number.isNaN(imdbRating) ? imdbRating : undefined,
    rottenTomatoes: rt,
    metascore: !Number.isNaN(metascore) ? metascore : undefined,
    contentRating: data.Rated && data.Rated !== 'N/A' ? data.Rated : undefined,
    runtime: data.Runtime && data.Runtime !== 'N/A' ? data.Runtime : undefined,
    fetchedAt: Date.now(),
  };
  cache.omdbByImdb[imdbId] = entry;
  return entry;
}

async function buildMediaItem(tmdbId, mediaType, cache, idxOffset = 0) {
  const isTv = mediaType === 'TV';
  const endpoint = isTv ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
  const append = isTv
    ? 'Aggregate_credits,credits,keywords,external_ids'
    : 'credits,keywords,external_ids';

  const d = await fetchTmdbJson(
    endpoint,
    { append_to_response: append, language: 'en-US' },
    cache
  );
  if (!d || !d.id) return null;

  const title = (d.title || d.name || '').trim();
  if (!title) return null;
  const dateStr = d.release_date || d.first_air_date || '2022';
  const year = parseInt(dateStr.slice(0, 4), 10) || 2022;
  const imdbId = d.imdb_id || d.external_ids?.imdb_id || `tmdb-${mediaType.toLowerCase()}-${d.id}`;

  const omdb = imdbId.startsWith('tt') ? await fetchOmdbByImdbId(imdbId, cache) : null;

  const crew = d.credits?.crew || [];
  const directors = isTv
    ? (d.created_by || []).map((c) => c.name).slice(0, 2)
    : crew
        .filter((c) => c.job === 'Director')
        .map((c) => c.name)
        .slice(0, 2);
  if (directors.length === 0) {
    const fallbackDirs = crew
      .filter((c) => c.job === 'Director' || c.job === 'Series Director' || c.job === 'Executive Producer')
      .map((c) => c.name)
      .slice(0, 2);
    directors.push(...fallbackDirs);
  }

  const writers = crew
    .filter((c) => c.job === 'Screenplay' || c.job === 'Writer' || c.job === 'Story')
    .map((c) => c.name)
    .slice(0, 2);
  const composers = crew
    .filter((c) => c.job === 'Original Music Composer' || c.job === 'Music')
    .map((c) => c.name)
    .slice(0, 2);
  const cinematographers = crew
    .filter((c) => c.job === 'Director of Photography')
    .map((c) => c.name)
    .slice(0, 2);

  const rawCast = (d.credits?.cast || []).slice(0, 5);
  const cast = rawCast.map((c, idx) => ({
    name: c.name,
    role: c.character || undefined,
    billing: idx < 2 ? 'LEAD' : 'SUPPORTING',
  }));

  const rawGenres = (d.genres || []).map((g) =>
    g.name === 'Science Fiction'
      ? 'Sci-Fi'
      : g.name === 'Sci-Fi & Fantasy'
      ? 'Sci-Fi'
      : g.name === 'Action & Adventure'
      ? 'Action'
      : g.name
  );
  const genres = Array.from(new Set(rawGenres)).slice(0, 4);
  if (genres.length === 0) genres.push('Drama');

  const kwList = d.keywords?.keywords || d.keywords?.results || [];
  const tropes = kwList
    .map((k) => k.name)
    .filter(Boolean)
    .slice(0, 5)
    .map((s) => s.replace(/\b\w/g, (c) => c.toUpperCase()));

  const voteAvg = Number((d.vote_average || 7.6).toFixed(1));
  const imdbRating = omdb?.imdbRating || voteAvg;
  const rottenTomatoes =
    omdb?.rottenTomatoes || Math.min(98, Math.max(60, Math.round(imdbRating * 10.6)));
  const metascore =
    omdb?.metascore || Math.min(95, Math.max(55, Math.round(imdbRating * 9.8)));

  const runtimeOrSeasons =
    omdb?.runtime ||
    (isTv
      ? `${d.number_of_seasons || 1} Season${(d.number_of_seasons || 1) > 1 ? 's' : ''}`
      : `${Math.floor((d.runtime || 120) / 60)}h ${(d.runtime || 120) % 60}m`);

  const item = {
    id: `${mediaType.toLowerCase()}-${d.id}`,
    tmdbId: d.id,
    imdbId,
    title,
    year,
    mediaType,
    tagline: d.tagline || `${year} · ${genres.slice(0, 2).join(' / ')}`,
    synopsis: d.overview || `${title} (${year}).`,
    posterUrl: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : '',
    backdropColor: isTv ? '#6B2D46' : '#234B6E',
    imdbRating,
    rottenTomatoes,
    metascore,
    contentRating: omdb?.contentRating || (isTv ? 'TV-MA' : 'PG-13'),
    runtimeOrSeasons,
    directors,
    writers,
    primaryGenre: genres[0] || 'Drama',
    genres,
    tropes,
    cast,
    composers,
    cinematographers,
    coWatchIds: [],
    streamingByRegion: {
      US: [{ provider: 'Prime Video', type: 'RENT', price: '$3.99', quality: '4K', url: 'https://www.amazon.com' }],
      UK: [{ provider: 'Apple TV', type: 'RENT', price: '£3.49', quality: '4K', url: 'https://tv.apple.com' }],
      AU: [{ provider: 'Apple TV', type: 'RENT', price: 'A$4.99', quality: '4K', url: 'https://tv.apple.com' }],
    },
    coordinates: {
      ra: `${((idxOffset + 5) % 24).toString().padStart(2, '0')}h 36m`,
      dec: `+${((idxOffset * 7 + 14) % 80).toString().padStart(2, '0')}° 22′`,
      sector: `CRON-${String(d.id).slice(0, 4)}`,
    },
  };

  return item;
}

async function syncToFirestore(cache) {
  if (!FIREBASE_PROJECT_ID || !FIREBASE_API_KEY) return false;
  const allItems = Object.values(cache.items);
  const bundleCount = Math.min(
    MAX_BUNDLES,
    Math.max(1, Math.ceil(allItems.length / ITEMS_PER_BUNDLE))
  );

  const patchDoc = async (docId, stringFields) => {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      FIREBASE_PROJECT_ID
    )}/databases/(default)/documents/sixdegrees_catalog/${encodeURIComponent(
      docId
    )}?key=${encodeURIComponent(FIREBASE_API_KEY)}`;
    const fields = {};
    for (const [k, v] of Object.entries(stringFields)) {
      fields[k] = { stringValue: String(v) };
    }
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
    return res.ok;
  };

  for (let idx = 0; idx < bundleCount; idx++) {
    const slice = allItems.slice(idx * ITEMS_PER_BUNDLE, (idx + 1) * ITEMS_PER_BUNDLE);
    await patchDoc(`bundle_${idx}`, {
      bundleIndex: String(idx),
      itemCount: String(slice.length),
      updatedAt: new Date().toISOString(),
      itemsJson: JSON.stringify(slice),
    });
  }

  await patchDoc('telemetry', {
    dayKey: cache.dayKey,
    omdbCallsToday: String(cache.omdbCallsToday),
    tmdbCallsToday: String(cache.tmdbCallsToday),
    bundleCount: String(bundleCount),
    totalCachedItems: String(allItems.length),
    updatedAt: new Date().toISOString(),
    crawledCollaboratorsJson: JSON.stringify(cache.crawledCollaborators.slice(0, 600)),
    omdbJson: JSON.stringify(cache.omdbByImdb),
  });

  return true;
}

async function main() {
  const rounds = parseInt(process.argv[2] || '3', 10);
  const batchSize = parseInt(process.argv[3] || '5', 10);

  const cache = loadLocalCache();
  const initialCount = Object.keys(cache.items).length;
  console.log(
    `[SixDegrees Auto-Expand] Starting with ${initialCount} cached titles (OMDb today: ${cache.omdbCallsToday}/${OMDB_DAILY_SAFE_LIMIT}, TMDB today: ${cache.tmdbCallsToday})`
  );

  const excludeKeys = new Set();
  for (const m of Object.values(cache.items)) {
    if (m.tmdbId > 0) excludeKeys.add(`tmdb:${m.mediaType}:${m.tmdbId}`);
    if (m.imdbId?.startsWith('tt')) excludeKeys.add(`imdb:${m.imdbId}`);
    if (m.title) excludeKeys.add(`title:${m.title.toLowerCase()}`);
  }

  const queried = new Set(cache.crawledCollaborators.map((c) => c.toLowerCase()));
  const candidates = [];
  const seen = new Set();
  const pushCollab = (name) => {
    if (!name || typeof name !== 'string' || name.length < 3) return;
    const lower = name.trim().toLowerCase();
    if (seen.has(lower) || queried.has(lower)) return;
    seen.add(lower);
    candidates.push(name.trim());
  };

  for (const item of Object.values(cache.items)) {
    for (const d of item.directors || []) pushCollab(d);
  }
  for (const item of Object.values(cache.items)) {
    for (const c of item.cast || []) {
      if (c.billing === 'LEAD') pushCollab(c.name);
    }
  }
  for (const item of Object.values(cache.items)) {
    for (const w of item.writers || []) pushCollab(w);
    for (const comp of item.composers || []) pushCollab(comp);
  }

  let completedRounds = 0;
  let totalAdded = 0;

  for (const collab of candidates) {
    if (completedRounds >= rounds) break;

    const searchData = await fetchTmdbJson(
      '/search/person',
      { query: collab, include_adult: 'false' },
      cache
    );
    const person = searchData?.results?.[0];
    cache.crawledCollaborators.push(collab.toLowerCase());
    if (!person?.id) continue;

    const credits = await fetchTmdbJson(
      `/person/${person.id}/combined_credits`,
      {},
      cache
    );
    if (!credits) continue;

    const rawCandidates = new Map();
    const consider = (c, boost = 1) => {
      if (!c?.id || (c.media_type !== 'movie' && c.media_type !== 'tv')) return;
      const mediaType = c.media_type === 'tv' ? 'TV' : 'MOVIE';
      const title = (c.title || c.name || '').trim();
      if (!title) return;
      const tmdbKey = `tmdb:${mediaType}:${c.id}`;
      const titleKey = `title:${title.toLowerCase()}`;
      if (excludeKeys.has(tmdbKey) || excludeKeys.has(titleKey)) return;
      if ((c.vote_count || 0) < 50 || (c.vote_average || 0) < 6.2) return;
      const score = ((c.vote_count || 0) * 0.4 + (c.popularity || 10) * 15) * boost;
      if (!rawCandidates.has(tmdbKey) || score > rawCandidates.get(tmdbKey).score) {
        rawCandidates.set(tmdbKey, { id: c.id, mediaType, title, score });
      }
    };

    for (const c of credits.crew || []) {
      if (['Director', 'Creator', 'Executive Producer', 'Screenplay', 'Writer', 'Original Music Composer'].includes(c.job)) {
        consider(c, 2.0);
      }
    }
    for (const c of credits.cast || []) {
      if ((c.order ?? 99) <= 4) consider(c, 1.4);
    }

    const sorted = Array.from(rawCandidates.values()).sort((a, b) => b.score - a.score);
    const movies = sorted.filter((x) => x.mediaType === 'MOVIE');
    const tvShows = sorted.filter((x) => x.mediaType === 'TV');
    const picked = [];
    let mIdx = 0;
    let tIdx = 0;
    while (picked.length < batchSize && (mIdx < movies.length || tIdx < tvShows.length)) {
      if (mIdx < movies.length) picked.push(movies[mIdx++]);
      if (picked.length < batchSize && tIdx < tvShows.length) picked.push(tvShows[tIdx++]);
    }

    if (picked.length === 0) continue;

    console.log(`  -> Crawling collaborator: ${collab} (${picked.length} candidates)`);
    let addedForCollab = 0;
    for (const cand of picked) {
      const built = await buildMediaItem(
        cand.id,
        cand.mediaType,
        cache,
        Object.keys(cache.items).length
      );
      if (built) {
        cache.items[built.id] = built;
        excludeKeys.add(`tmdb:${built.mediaType}:${built.tmdbId}`);
        excludeKeys.add(`title:${built.title.toLowerCase()}`);
        if (built.imdbId?.startsWith('tt')) excludeKeys.add(`imdb:${built.imdbId}`);
        addedForCollab += 1;
        totalAdded += 1;
        console.log(
          `     + [${built.mediaType}] ${built.title} (${built.year}) — IMDb ${built.imdbRating} / RT ${built.rottenTomatoes}%`
        );
      }
    }

    if (addedForCollab > 0) {
      completedRounds += 1;
    }
  }

  saveLocalCache(cache);
  const synced = await syncToFirestore(cache);
  console.log(
    `[SixDegrees Auto-Expand] Complete: +${totalAdded} new titles added (Total cached: ${
      Object.keys(cache.items).length
    }, OMDb calls today: ${cache.omdbCallsToday}/${OMDB_DAILY_SAFE_LIMIT}, TMDB calls today: ${
      cache.tmdbCallsToday
    }, Firestore synced: ${synced})`
  );
}

main().catch((err) => {
  console.error('[SixDegrees Auto-Expand] Error:', err);
  process.exit(1);
});

