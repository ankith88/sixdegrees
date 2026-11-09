export type MediaType = 'MOVIE' | 'TV';

export type EntityNodeType =
  | 'MOVIE'
  | 'TV'
  | 'DIRECTOR'
  | 'ACTOR'
  | 'TROPE'
  | 'COMPOSER';

export type RegionCode = 'AU' | 'US' | 'UK';

export type ViewMode = '2D' | '3D' | 'MATRIX';

export type GravityPreset = 'VIBE_TROPES' | 'AUTEUR_ORBIT' | 'STAR_CONSTELLATION';

export type CameraMode = 'ORBIT' | 'FREE_LOOK' | 'FLY_THROUGH';

export interface StreamingOffer {
  provider: string;
  shortName: string;
  type: 'STREAM' | 'RENT' | 'BUY';
  price?: string;
  quality?: '4K' | 'HD';
  color: string;
  textColor?: string;
  url: string;
}

export interface CastMember {
  name: string;
  character?: string;
  billing: 'LEAD' | 'SUPPORTING'; // LEAD = #1/#2 billed (+6 pts), SUPPORTING = top-5 (+4 pts)
}

export interface MediaItem {
  id: string;
  tmdbId: number;
  imdbId: string;
  title: string;
  year: number;
  mediaType: MediaType;
  tagline: string;
  synopsis: string;
  posterUrl: string;
  backdropColor: string;
  // Ratings & Telemetry
  imdbRating: number;
  rottenTomatoes: number;
  metascore: number;
  contentRating: string;
  runtimeOrSeasons: string;
  // Creative & Technical Credits
  directors: string[]; // Director or Showrunner (+25 pts)
  writers: string[]; // Screenwriter / Co-Creator (+15 pts)
  primaryGenre: string; // Primary genre (+5 bonus pts if matched)
  genres: string[]; // Broad genres (+5 pts each)
  tropes: string[]; // Micro-tropes & thematic keywords (+12 pts each, max 35)
  cast: CastMember[]; // Primary cast (Lead +6, Supporting +4, max 10)
  composers: string[]; // Composer (+6 pts)
  cinematographers: string[]; // Cinematographer (+4 pts)
  coWatchIds: string[]; // Native TMDB /recommendations IDs (+5 pts)
  // Regional Watch Providers
  streamingByRegion: Record<RegionCode, StreamingOffer[]>;
  // Spatial coordinates hint
  coordinates?: { ra: string; dec: string; sector: string };
}

export interface SharedConnection {
  id: string;
  label: string;
  prefix: string; // e.g., "Dir", "Lead", "Score", "Trope", "Genre", "DP", "Co-Watch"
  value: string;
  category:
    | 'TROPE'
    | 'AUTEUR'
    | 'GENRE'
    | 'CAST'
    | 'SONIC_VISUAL'
    | 'COWATCH';
  entityType: EntityNodeType;
  entityNodeId?: string;
  points: number;
  color: string;
}

export interface SimilarityBreakdown {
  totalScore: number; // 0 - 100
  rawPoints: {
    tropes: number; // Max 35
    auteur: number; // Max 25
    genres: number; // Max 15
    cast: number; // Max 10
    sonicVisual: number; // Max 10
    coWatch: number; // Max 5
  };
  sharedConnections: SharedConnection[];
  linkDistance: number; // 180 - (matchScore * 1.2)
}

export interface GraphNode {
  id: string;
  label: string;
  subLabel?: string;
  type: EntityNodeType;
  isFocal?: boolean;
  matchScore?: number; // For MOVIE / TV nodes relative to focal
  similarity?: SimilarityBreakdown;
  mediaItem?: MediaItem;
  color: string;
  glowColor: string;
  radius: number;
  // 3D Physics state
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fx?: number | null;
  fy?: number | null;
  fz?: number | null;
  connectedMediaIds: string[];
}

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  kind: 'SIMILARITY_DIRECT' | 'ENTITY_BRIDGE';
  entityType: EntityNodeType;
  label: string;
  weight: number;
  distance: number;
  color: string;
  mediaIds: string[]; // Media item IDs participating in this link for hover illumination
}

export interface ForceSettings {
  sphericalForce: number; // 0.1 - 2.0 (default 1.0)
  linkDistanceMultiplier: number; // 0.5 - 1.8 (default 1.0)
  zRepulsion: number; // 0.2 - 2.5 (default 1.2)
  matchThreshold: number; // 0 - 80% (default 18%)
}

export interface EntityVisibility {
  MOVIE: boolean;
  TV: boolean;
  DIRECTOR: boolean;
  ACTOR: boolean;
  TROPE: boolean;
  COMPOSER: boolean;
}

