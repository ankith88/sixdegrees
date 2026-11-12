import { MediaType, RegionCode, StreamingOffer } from './types';

export interface SeedBootstrapItem {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
}

/**
 * Lightweight bootstrap manifest for canonical initial seed titles.
 * Notice: zero movie plots, cast arrays, or raw telemetry are hardcoded in the client bundle!
 * Instead, the server fetches rich live metadata from TMDB & OMDb APIs on cold start,
 * stores the assembled catalog in Cloud Firestore / server cache, and serves it dynamically.
 */
export const INITIAL_BOOTSTRAP_SEEDS: SeedBootstrapItem[] = [
  { tmdbId: 27205, mediaType: 'MOVIE', title: 'Inception' },
  { tmdbId: 157336, mediaType: 'MOVIE', title: 'Interstellar' },
  { tmdbId: 1124, mediaType: 'MOVIE', title: 'The Prestige' },
  { tmdbId: 577922, mediaType: 'MOVIE', title: 'Tenet' },
  { tmdbId: 77, mediaType: 'MOVIE', title: 'Memento' },
  { tmdbId: 11324, mediaType: 'MOVIE', title: 'Shutter Island' },
  { tmdbId: 4977, mediaType: 'MOVIE', title: 'Paprika' },
  { tmdbId: 603, mediaType: 'MOVIE', title: 'The Matrix' },
  { tmdbId: 335984, mediaType: 'MOVIE', title: 'Blade Runner 2049' },
  { tmdbId: 329865, mediaType: 'MOVIE', title: 'Arrival' },
  { tmdbId: 693134, mediaType: 'MOVIE', title: 'Dune: Part Two' },
  { tmdbId: 872585, mediaType: 'MOVIE', title: 'Oppenheimer' },
  { tmdbId: 155, mediaType: 'MOVIE', title: 'The Dark Knight' },
  { tmdbId: 38, mediaType: 'MOVIE', title: 'Eternal Sunshine of the Spotless Mind' },
  { tmdbId: 45612, mediaType: 'MOVIE', title: 'Source Code' },
  { tmdbId: 264660, mediaType: 'MOVIE', title: 'Ex Machina' },
  { tmdbId: 300668, mediaType: 'MOVIE', title: 'Annihilation' },
  { tmdbId: 180, mediaType: 'MOVIE', title: 'Minority Report' },
  { tmdbId: 59967, mediaType: 'MOVIE', title: 'Looper' },
  { tmdbId: 137113, mediaType: 'MOVIE', title: 'Edge of Tomorrow' },
  { tmdbId: 220289, mediaType: 'MOVIE', title: 'Coherence' },
  { tmdbId: 206487, mediaType: 'MOVIE', title: 'Predestination' },
  { tmdbId: 545611, mediaType: 'MOVIE', title: 'Everything Everywhere All at Once' },
  { tmdbId: 63, mediaType: 'MOVIE', title: '12 Monkeys' },
  { tmdbId: 70523, mediaType: 'TV', title: 'Dark' },
  { tmdbId: 95396, mediaType: 'TV', title: 'Severance' },
  { tmdbId: 63247, mediaType: 'TV', title: 'Westworld' },
  { tmdbId: 42009, mediaType: 'TV', title: 'Black Mirror' },
  { tmdbId: 62560, mediaType: 'TV', title: 'Mr. Robot' },
  { tmdbId: 81349, mediaType: 'TV', title: 'Devs' },
  { tmdbId: 108545, mediaType: 'TV', title: '3 Body Problem' },
  { tmdbId: 67195, mediaType: 'TV', title: 'Legion' },
];

export function makeRegionalStreaming(
  auStream: Array<{ name: string; short: string; color: string; url: string }>,
  usStream: Array<{ name: string; short: string; color: string; url: string }>,
  ukStream: Array<{ name: string; short: string; color: string; url: string }>,
  titleSlug: string
): Record<RegionCode, StreamingOffer[]> {
  const commonRentBuy: StreamingOffer[] = [
    {
      provider: 'Apple TV',
      shortName: 'ATV',
      type: 'RENT',
      price: '$4.99',
      quality: '4K',
      color: '#E5DEC9',
      textColor: '#171412',
      url: `https://tv.apple.com/search?term=${encodeURIComponent(titleSlug)}`,
    },
    {
      provider: 'Prime Video',
      shortName: 'PV',
      type: 'RENT',
      price: '$4.99',
      quality: '4K',
      color: '#165B7D',
      textColor: '#FFFFFF',
      url: `https://www.amazon.com/s?k=${encodeURIComponent(titleSlug)}&i=instant-video`,
    },
    {
      provider: 'Apple TV Store',
      shortName: 'ATV',
      type: 'BUY',
      price: '$14.99',
      quality: '4K',
      color: '#D5CCB9',
      textColor: '#171412',
      url: `https://tv.apple.com/search?term=${encodeURIComponent(titleSlug)}`,
    },
  ];

  return {
    AU: [
      ...auStream.map((p) => ({
        provider: p.name,
        shortName: p.short,
        type: 'STREAM' as const,
        quality: '4K' as const,
        color: p.color,
        url: p.url,
      })),
      ...commonRentBuy,
    ],
    US: [
      ...usStream.map((p) => ({
        provider: p.name,
        shortName: p.short,
        type: 'STREAM' as const,
        quality: '4K' as const,
        color: p.color,
        url: p.url,
      })),
      ...commonRentBuy,
    ],
    UK: [
      ...ukStream.map((p) => ({
        provider: p.name,
        shortName: p.short,
        type: 'STREAM' as const,
        quality: '4K' as const,
        color: p.color,
        url: p.url,
      })),
      ...commonRentBuy,
    ],
  };
}

/**
 * Generates an always-crisp SVG poster data URI fallback with bespoke archival folio styling
 * so every movie/show has a rich 2:3 artwork card even if offline or blocked by adblockers.
 */
export function getPosterFallbackDataUri(item: {
  title: string;
  mediaType: string;
  year: number;
  directors: string[];
  imdbRating: number;
  rottenTomatoes?: number;
}): string {
  const accent = item.mediaType === 'MOVIE' ? '#234B6E' : '#6B2D46';
  const secondary = '#B8292F';
  const titleLines: string[] = [];
  const words = (item.title || 'Untitled').split(' ');
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).trim().length > 15 && current) {
      titleLines.push(current);
      current = w;
    } else {
      current = (current + ' ' + w).trim();
    }
  }
  if (current) titleLines.push(current);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 450" width="300" height="450">
    <rect width="300" height="450" fill="#EFE8DA"/>
    <rect x="16" y="16" width="268" height="418" fill="#F6F1E7" stroke="#C8BEAA" stroke-width="1.5"/>
    <line x1="16" y1="68" x2="284" y2="68" stroke="#D5CCB9" stroke-width="1"/>
    <rect x="16" y="16" width="8" height="418" fill="${accent}"/>
    <text x="36" y="42" fill="#52483E" font-family="Georgia, serif" font-size="10" font-weight="600" letter-spacing="1.5">THE SIXDEGREES ARCHIVE</text>
    <text x="36" y="56" fill="${secondary}" font-family="sans-serif" font-size="10" font-weight="700">${item.mediaType} · ${item.year}</text>
    <circle cx="154" cy="175" r="56" fill="none" stroke="${accent}" stroke-opacity="0.35" stroke-width="1.2"/>
    <circle cx="154" cy="175" r="34" fill="none" stroke="${secondary}" stroke-opacity="0.45" stroke-width="1.2"/>
    <circle cx="154" cy="175" r="6" fill="${secondary}"/>
    ${titleLines
      .slice(0, 3)
      .map(
        (line, i) =>
          `<text x="36" y="${285 + i * 28}" fill="#171412" font-family="Georgia, serif" font-size="22" font-weight="700">${line.replace(/&/g, '&amp;')}</text>`
      )
      .join('')}
    <line x1="36" y1="368" x2="264" y2="368" stroke="#D5CCB9" stroke-width="1"/>
    <text x="36" y="390" fill="#52483E" font-family="sans-serif" font-size="11" font-weight="600">${(item.directors?.[0] || '').replace(/&/g, '&amp;')}</text>
    <text x="36" y="410" fill="#8C1D22" font-family="sans-serif" font-size="11" font-weight="700">IMDb ${(item.imdbRating || 0).toFixed(1)}  |  RT ${item.rottenTomatoes || 80}%</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
