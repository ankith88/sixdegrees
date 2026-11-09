import {
  EntityNodeType,
  EntityVisibility,
  ForceSettings,
  GraphLink,
  GraphNode,
  GravityPreset,
  MediaItem,
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
        entityNodeId: toEntityNodeId('TROPE', trope),
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
        entityNodeId: toEntityNodeId('COMPOSER', comp),
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
        entityNodeId: toEntityNodeId('COMPOSER', dp),
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
    return {
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

  return {
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
}

export function buildSpatialGraph({
  items,
  focalId,
  preset,
  mediaFilter,
  forceSettings,
  visibility,
}: BuildGraphOptions): {
  nodes: GraphNode[];
  links: GraphLink[];
  focalItem: MediaItem | null;
  rankedMatches: Array<{ item: MediaItem; similarity: SimilarityBreakdown }>;
} {
  const focalItem = focalId
    ? items.find((m) => m.id === focalId) || null
    : null;

  const nodesMap = new Map<string, GraphNode>();
  const links: GraphLink[] = [];

  // ==================== MODE A: GLOBAL ARCHIVE CONSTELLATION (ALL MEDIA, NO SINGLE FOCAL ITEM) ====================
  if (!focalItem) {
    const filteredMedia = items.filter((item) => {
      if (mediaFilter === 'MOVIE' && item.mediaType !== 'MOVIE') return false;
      if (mediaFilter === 'TV' && item.mediaType !== 'TV') return false;
      if (!visibility.MOVIE && item.mediaType === 'MOVIE') return false;
      if (!visibility.TV && item.mediaType === 'TV') return false;
      return true;
    });

    const effectiveThreshold = Math.max(15, forceSettings.matchThreshold);

    // Compute pairwise similarities across all active media items (only keeping pairs with concrete shared connections)
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
        const sim = calculateSimilarity(itemA, itemB, preset);
        if (
          hasConcreteSharedConnection(sim) &&
          sim.totalScore >= effectiveThreshold
        ) {
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
        if (countForNode >= 5) break;
        if (
          !hasConcreteSharedConnection(peer.similarity) ||
          peer.similarity.totalScore < effectiveThreshold
        ) {
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
      const isUnlinked = (connectedMediaByNode.get(item.id)?.size || 1) <= 1;
      const shellOffset = (idx % 3) * 24;
      const baseRadius = isUnlinked
        ? 245 * forceSettings.linkDistanceMultiplier
        : (82 +
            (idx / Math.max(1, rankedMatches.length - 1)) * 78 +
            shellOffset) *
          forceSettings.linkDistanceMultiplier;
      const pos = seededSphericalPosition(
        idx,
        rankedMatches.length,
        baseRadius
      );
      const zScaled = pos.z * forceSettings.zRepulsion;
      const ratingScale = Math.max(0, (item.imdbRating - 7.0) * 1.35);

      nodesMap.set(item.id, {
        id: item.id,
        label: item.title,
        subLabel: `${item.year} · IMDb ${item.imdbRating.toFixed(1)} · ${item.primaryGenre}`,
        type: item.mediaType,
        isFocal: false,
        matchScore: undefined,
        similarity,
        mediaItem: item,
        color: ENTITY_COLORS[item.mediaType].primary,
        glowColor: ENTITY_COLORS[item.mediaType].glow,
        radius: 7.2 + ratingScale,
        x: pos.x,
        y: pos.y,
        z: zScaled,
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
      if (type === 'TROPE' && !isSpecificNarrativeTrope(name)) return;
      if (type !== 'TROPE' && !isValidPersonName(name)) return;
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
      // Do not register entity bridge links for unlinked standalone titles
      if ((connectedMediaByNode.get(media.id)?.size || 1) <= 1) continue;
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
      for (const trope of media.tropes) {
        registerEntity('TROPE', trope, 'Narrative Theme', media.id);
      }
      for (const comp of media.composers) {
        registerEntity('COMPOSER', comp, 'Original Score', media.id);
      }
    }

    const validEntities = Array.from(entityAcc.values())
      .map((ent) => {
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
        color: ENTITY_COLORS[ent.type].primary,
        glowColor: ENTITY_COLORS[ent.type].glow,
        radius:
          ent.type === 'DIRECTOR'
            ? 5.8
            : ent.type === 'TROPE'
              ? 5.2
              : ent.type === 'COMPOSER'
                ? 5.0
                : 4.6,
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

    return {
      nodes: Array.from(nodesMap.values()),
      links,
      focalItem: null,
      rankedMatches,
    };
  }

  // ==================== MODE B: SINGLE FOCAL TITLE MODE ====================
  const allScored = items
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
      similarity: calculateSimilarity(focalItem, item, preset),
    }))
    .filter(
      (entry) =>
        entry.item.id === focalItem.id ||
        (hasConcreteSharedConnection(entry.similarity) &&
          entry.similarity.totalScore >= forceSettings.matchThreshold)
    );

  const rankedMatches = allScored
    .filter((e) => e.item.id !== focalItem.id)
    .sort((a, b) => b.similarity.totalScore - a.similarity.totalScore);

  // 1. Add Focal Centerpiece Node at origin (0, 0, 0)
  nodesMap.set(focalItem.id, {
    id: focalItem.id,
    label: focalItem.title,
    subLabel: `${focalItem.year} · Selected Title`,
    type: focalItem.mediaType,
    isFocal: true,
    matchScore: 100,
    similarity: calculateSimilarity(focalItem, focalItem, preset),
    mediaItem: focalItem,
    color: '#B8292F',
    glowColor: '#D43D43',
    radius: 13,
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
    const effectiveDistance =
      similarity.linkDistance * forceSettings.linkDistanceMultiplier;
    const pos = seededSphericalPosition(
      idx,
      rankedMatches.length,
      effectiveDistance
    );
    const zScaled = pos.z * forceSettings.zRepulsion;

    nodesMap.set(item.id, {
      id: item.id,
      label: item.title,
      subLabel: `${item.year} · ${similarity.totalScore}% Match`,
      type: item.mediaType,
      isFocal: false,
      matchScore: similarity.totalScore,
      similarity,
      mediaItem: item,
      color: ENTITY_COLORS[item.mediaType].primary,
      glowColor: ENTITY_COLORS[item.mediaType].glow,
      radius: 6.5 + (similarity.totalScore / 100) * 4.5,
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
    if (type === 'TROPE' && !isSpecificNarrativeTrope(name)) return;
    if (type !== 'TROPE' && !isValidPersonName(name)) return;
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
    for (const trope of media.tropes) {
      registerEntity('TROPE', trope, 'Narrative Theme', media.id);
    }
    for (const comp of media.composers) {
      registerEntity('COMPOSER', comp, 'Original Score', media.id);
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
          ? 5.8
          : ent.type === 'TROPE'
            ? 5.2
            : ent.type === 'COMPOSER'
              ? 5.0
              : 4.6,
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

  return {
    nodes: Array.from(nodesMap.values()),
    links,
    focalItem,
    rankedMatches,
  };
}
