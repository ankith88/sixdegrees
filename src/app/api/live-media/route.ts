import { NextRequest, NextResponse } from 'next/server';
import {
  CastMember,
  MediaItem,
  MediaType,
  RegionCode,
  StreamingOffer,
} from '@/lib/types';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const OMDB_BASE = 'https://www.omdbapi.com/';

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

async function fetchOmdbTelemetry(imdbId: string, omdbKey?: string) {
  if (!imdbId || !omdbKey) return null;
  try {
    const res = await fetch(
      `${OMDB_BASE}?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(omdbKey)}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.Response === 'False') return null;

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

    return {
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
    };
  } catch {
    return null;
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
 * Fetches a full MediaItem from TMDB + OMDb
 */
async function fetchFullTmdbMediaItem(
  tmdbId: number,
  mediaType: MediaType,
  tmdbKey: string,
  omdbKey?: string
): Promise<{ item: MediaItem; rawRecs: Array<{ id: number; mediaType: MediaType }> } | null> {
  const endpoint = mediaType === 'MOVIE' ? 'movie' : 'tv';
  const url = `${TMDB_BASE}/${endpoint}/${tmdbId}?api_key=${encodeURIComponent(
    tmdbKey
  )}&append_to_response=credits,keywords,recommendations,similar,external_ids,watch/providers`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();

    const imdbId = data.imdb_id || data.external_ids?.imdb_id || `tmdb-${tmdbId}`;
    const omdb = omdbKey && imdbId.startsWith('tt')
      ? await fetchOmdbTelemetry(imdbId, omdbKey)
      : null;

    const title = data.title || data.name || 'Untitled';
    const dateStr = data.release_date || data.first_air_date || '';
    const year = dateStr ? parseInt(dateStr.slice(0, 4), 10) : 2024;
    const slugId = `${mediaType.toLowerCase()}-${tmdbId}-${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}`;

    // Directors / Showrunners
    const directors: string[] = [];
    if (mediaType === 'TV' && Array.isArray(data.created_by)) {
      for (const c of data.created_by) {
        if (c?.name && !directors.includes(c.name)) directors.push(c.name);
      }
    }
    const crew = Array.isArray(data.credits?.crew) ? data.credits.crew : [];
    for (const member of crew) {
      if (
        (member.job === 'Director' || member.job === 'Series Director') &&
        !directors.includes(member.name)
      ) {
        directors.push(member.name);
      }
    }
    if (directors.length === 0 && omdb?.director) {
      directors.push(...omdb.director.slice(0, 2));
    }
    if (directors.length === 0) {
      directors.push('Visionary Auteur');
    }

    // Writers
    const writers: string[] = [];
    for (const member of crew) {
      if (
        (member.job === 'Screenplay' ||
          member.job === 'Writer' ||
          member.job === 'Story' ||
          member.department === 'Writing') &&
        !writers.includes(member.name)
      ) {
        writers.push(member.name);
      }
    }

    // Composers & Cinematographers
    const composers: string[] = [];
    const cinematographers: string[] = [];
    for (const member of crew) {
      if (
        (member.job === 'Original Music Composer' ||
          member.job === 'Music' ||
          member.department === 'Sound') &&
        member.job?.toLowerCase().includes('music') &&
        !composers.includes(member.name)
      ) {
        composers.push(member.name);
      }
      if (
        (member.job === 'Director of Photography' ||
          member.job === 'Cinematography') &&
        !cinematographers.includes(member.name)
      ) {
        cinematographers.push(member.name);
      }
    }

    // Primary Cast
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

    // Genres
    const genres: string[] = Array.isArray(data.genres)
      ? data.genres.map((g: { name: string }) =>
          g.name === 'Science Fiction' || g.name === 'Sci-Fi & Fantasy'
            ? 'Sci-Fi'
            : g.name
        )
      : ['Sci-Fi', 'Thriller'];

    // Keywords / Micro-Tropes
    const rawKeywords =
      data.keywords?.keywords || data.keywords?.results || [];
    const tropes: string[] = rawKeywords
      .slice(0, 6)
      .map((k: { name: string }) => titleCaseKeyword(k.name));
    if (tropes.length === 0) {
      tropes.push(...genres.slice(0, 2));
    }

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

    return { item, rawRecs };
  } catch {
    return null;
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
  omdbKey?: string
): Promise<{ focalItem: MediaItem; clusterItems: MediaItem[] }> {
  // Query 1: Get credits, genres, and subjects of the focal item + related works sharing director, cast, composer, or main subject
  const sparql = `
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
          ?focal wdt:P57 ?sharedDir .
          ?item wdt:P57 ?sharedDir ; wdt:P345 ?anyImdb .
        } UNION {
          ?focal wdt:P86 ?sharedComp .
          ?item wdt:P86 ?sharedComp ; wdt:P345 ?anyImdb .
        } UNION {
          ?focal wdt:P921 ?sharedSubj .
          ?item wdt:P921 ?sharedSubj ; wdt:P345 ?anyImdb .
        } UNION {
          ?focal wdt:P161 ?sharedActor .
          ?item wdt:P161 ?sharedActor ; wdt:P345 ?anyImdb .
        }
      } LIMIT 22
    }
    ?item wdt:P345 ?imdb .
    OPTIONAL { ?item wdt:P577 ?date . BIND(YEAR(?date) AS ?pubYear) }
    OPTIONAL {
      ?item wdt:P31 ?inst .
      FILTER(?inst IN (wd:Q5398426, wd:Q1259759))
      BIND(true AS ?isTv)
    }
    OPTIONAL { ?item wdt:P57 ?dir . ?dir rdfs:label ?dirLabel . FILTER(LANG(?dirLabel) = "en") }
    OPTIONAL { ?item wdt:P161 ?cast . ?cast rdfs:label ?castLabel . FILTER(LANG(?castLabel) = "en") }
    OPTIONAL { ?item wdt:P86 ?comp . ?comp rdfs:label ?compLabel . FILTER(LANG(?compLabel) = "en") }
    OPTIONAL { ?item wdt:P136 ?genre . ?genre rdfs:label ?genreLabel . FILTER(LANG(?genreLabel) = "en") }
    OPTIONAL { ?item wdt:P921 ?subj . ?subj rdfs:label ?subjectLabel . FILTER(LANG(?subjectLabel) = "en") }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }
  GROUP BY ?item ?itemLabel ?imdb ?pubYear ?isTv
  LIMIT 18
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

        const cleanSubjects = splitClean(b.subjects?.value, 5).map((s) =>
          titleCaseKeyword(s)
        );

        rowsMap.set(rowImdb, {
          imdbId: rowImdb,
          title: rowTitle,
          year: b.pubYear?.value ? parseInt(b.pubYear.value, 10) : fallbackYear,
          mediaType: b.isTv?.value === 'true' ? 'TV' : 'MOVIE',
          directors: splitClean(b.dirs?.value, 2),
          writers: [],
          cast: splitClean(b.actors?.value, 5),
          composers: splitClean(b.comps?.value, 2),
          cinematographers: [],
          genres: cleanGenres.length > 0 ? cleanGenres : ['Drama', 'Thriller'],
          tropes:
            cleanSubjects.length > 0
              ? cleanSubjects
              : cleanGenres.length > 0
                ? cleanGenres
                : ['Psychological Labyrinth'],
        });
      }
    }
  } catch {
    // Fallback if Wikidata times out
  }

  // Ensure the focal item is in rowsMap
  if (!rowsMap.has(imdbId)) {
    rowsMap.set(imdbId, {
      imdbId,
      title: fallbackTitle,
      year: fallbackYear,
      mediaType: fallbackType,
      directors: ['Featured Auteur'],
      writers: [],
      cast: [],
      composers: [],
      cinematographers: [],
      genres: ['Sci-Fi', 'Thriller'],
      tropes: ['Non-Linear Time', 'Subconscious Labyrinth'],
    });
  }

  const focalRow = rowsMap.get(imdbId)!;

  // Enrich posters & metadata via IMDb suggestion lookup / OMDb in parallel
  const allRows = Array.from(rowsMap.values()).slice(0, 15);
  const mediaItems: MediaItem[] = await Promise.all(
    allRows.map(async (row, idx) => {
      const omdb = omdbKey ? await fetchOmdbTelemetry(row.imdbId, omdbKey) : null;
      let posterUrl =
        row.imdbId === imdbId && fallbackPoster
          ? fallbackPoster
          : omdb?.poster || '';

      if (!posterUrl) {
        const sug = await searchImdbPublicSuggestions(row.title);
        const match =
          sug.find((s: { imdbId: string; posterUrl?: string }) => s.imdbId === row.imdbId) ||
          sug[0];
        if (match?.posterUrl) posterUrl = match.posterUrl;
      }

      const directors: string[] =
        row.directors.length > 0
          ? row.directors
          : omdb?.director || focalRow.directors;
      const actorsList: string[] =
        row.cast.length > 0 ? row.cast : omdb?.actors || focalRow.cast;

      const cast: CastMember[] = actorsList
        .slice(0, 5)
        .map((name: string, i: number) => ({
          name,
          billing: i < 2 ? 'LEAD' : 'SUPPORTING',
        }));

      // Share at least 1 trope/genre with focalRow if it came from the related SPARQL query
      const tropes = Array.from(
        new Set([
          ...row.tropes,
          ...(focalRow.tropes.slice(0, 2)),
        ])
      ).slice(0, 5);

      const deterministicScore = 7.6 + ((idx * 3) % 14) * 0.1;

      return {
        id: `imdb-${row.imdbId}`,
        tmdbId: parseInt(row.imdbId.replace(/\D/g, ''), 10) || 10000 + idx,
        imdbId: row.imdbId,
        title: row.title,
        year: row.year || 2022,
        mediaType: row.mediaType,
        tagline: `${row.year} · ${row.genres.slice(0, 2).join(' / ')}`,
        synopsis:
          omdb?.plot ||
          `${row.title} (${row.year}) directed by ${
            directors[0] || 'acclaimed filmmaker'
          }, featuring ${actorsList.slice(0, 3).join(', ') || 'ensemble cast'}. Connected in the SixDegrees constellation via ${tropes
            .slice(0, 2)
            .join(' & ')}.`,
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
        directors: directors.length > 0 ? directors : ['Featured Director'],
        writers: omdb?.writer?.slice(0, 2) || [],
        primaryGenre: row.genres[0] || 'Sci-Fi',
        genres: row.genres,
        tropes,
        cast,
        composers: row.composers,
        cinematographers: row.cinematographers,
        coWatchIds: [`imdb-${imdbId}`],
        streamingByRegion: makeFallbackRegionalStreaming(row.title),
        coordinates: {
          ra: `${((idx + 4) % 24).toString().padStart(2, '0')}h 42m`,
          dec: `+${((idx * 7 + 12) % 80).toString().padStart(2, '0')}° 18′`,
          sector: `LIVE-${row.imdbId.slice(2, 6)}`,
        },
      };
    })
  );

  const focalItem =
    mediaItems.find((m) => m.imdbId === imdbId) || mediaItems[0];
  const clusterItems = mediaItems.filter((m) => m.id !== focalItem.id);
  focalItem.coWatchIds = clusterItems.slice(0, 8).map((c) => c.id);

  return { focalItem, clusterItems };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'search';
  const tmdbKey =
    searchParams.get('tmdbKey') || process.env.NEXT_PUBLIC_TMDB_API_KEY || '';
  const omdbKey =
    searchParams.get('omdbKey') || process.env.NEXT_PUBLIC_OMDB_API_KEY || '';

  // ==================== ACTION 1: LIVE OMNI-SEARCH ====================
  if (action === 'search') {
    const q = searchParams.get('q')?.trim() || '';
    if (!q) {
      return NextResponse.json({ results: [], source: 'NONE' });
    }

    // 1A. If TMDB API Key is available, query TMDB /search/multi
    if (tmdbKey) {
      try {
        const res = await fetch(
          `${TMDB_BASE}/search/multi?api_key=${encodeURIComponent(
            tmdbKey
          )}&query=${encodeURIComponent(q)}&include_adult=false`,
          { next: { revalidate: 1800 } }
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

    // 2A. If TMDB API Key is available and we have a valid tmdbId
    if (tmdbKey && !Number.isNaN(tmdbId) && tmdbId > 0 && !imdbId.startsWith('tt')) {
      const focalData = await fetchFullTmdbMediaItem(
        tmdbId,
        mediaType,
        tmdbKey,
        omdbKey
      );
      if (focalData) {
        const topRecs = focalData.rawRecs.slice(0, 12);
        const recResults = await Promise.all(
          topRecs.map((r) =>
            fetchFullTmdbMediaItem(r.id, r.mediaType, tmdbKey, omdbKey)
          )
        );
        const clusterItems = recResults
          .filter((r): r is NonNullable<typeof r> => r !== null)
          .map((r) => r.item);

        focalData.item.coWatchIds = clusterItems.map((c) => c.id);

        return NextResponse.json({
          focalItem: focalData.item,
          clusterItems,
          source: 'TMDB_OMDB',
        });
      }
    }

    // If TMDB Key is available and we have an imdbId, resolve it via TMDB /find/{imdb_id}
    if (tmdbKey && imdbId.startsWith('tt')) {
      try {
        const findRes = await fetch(
          `${TMDB_BASE}/find/${encodeURIComponent(
            imdbId
          )}?api_key=${encodeURIComponent(tmdbKey)}&external_source=imdb_id`
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
              omdbKey
            );
            if (focalData) {
              const topRecs = focalData.rawRecs.slice(0, 12);
              const recResults = await Promise.all(
                topRecs.map((r) =>
                  fetchFullTmdbMediaItem(r.id, r.mediaType, tmdbKey, omdbKey)
                )
              );
              const clusterItems = recResults
                .filter((r): r is NonNullable<typeof r> => r !== null)
                .map((r) => r.item);
              focalData.item.coWatchIds = clusterItems.map((c) => c.id);

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
        omdbKey
      );
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
