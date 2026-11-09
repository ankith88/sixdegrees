'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Film,
  Tv,
  Crosshair,
  Compass,
  ExternalLink,
  ArrowLeft,
  Search,
  Globe,
  X,
} from 'lucide-react';
import {
  MediaItem,
  RegionCode,
  SimilarityBreakdown,
  StreamingOffer,
} from '@/lib/types';
import { getPosterFallbackDataUri } from '@/lib/seed-data';
import { toEntityNodeId } from '@/lib/similarity';

interface RightInspectorCardProps {
  inspectedItem: MediaItem | null;
  focalItem: MediaItem | null;
  allMediaItems: MediaItem[];
  similarity: SimilarityBreakdown | null;
  region: RegionCode;
  onMakeFocal: (mediaId: string) => void;
  onClearFocal: () => void;
  onClearInspected: () => void;
  onOrbitNode: (nodeId: string) => void;
  onSelectEntityNode: (entityNodeId: string) => void;
  topRecommendations: Array<{
    item: MediaItem;
    similarity: SimilarityBreakdown;
  }>;
  onSelectMedia: (item: MediaItem) => void;
}

export function RightInspectorCard({
  inspectedItem,
  focalItem,
  allMediaItems,
  similarity,
  region,
  onMakeFocal,
  onClearFocal,
  onClearInspected,
  onOrbitNode,
  onSelectEntityNode,
  topRecommendations,
  onSelectMedia,
}: RightInspectorCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [catalogTypeFilter, setCatalogTypeFilter] = useState<
    'ALL' | 'MOVIE' | 'TV'
  >('ALL');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogSort, setCatalogSort] = useState<
    'CONNECTIVITY' | 'RATING' | 'YEAR' | 'TITLE'
  >('CONNECTIVITY');

  const movieCount = useMemo(
    () => allMediaItems.filter((m) => m.mediaType === 'MOVIE').length,
    [allMediaItems]
  );
  const tvCount = useMemo(
    () => allMediaItems.filter((m) => m.mediaType === 'TV').length,
    [allMediaItems]
  );

  // Build connectivity score map from topRecommendations
  const scoreByMediaId = useMemo(() => {
    const map = new Map<string, SimilarityBreakdown>();
    for (const entry of topRecommendations) {
      map.set(entry.item.id, entry.similarity);
    }
    return map;
  }, [topRecommendations]);

  const filteredCatalogItems = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    const list = allMediaItems.filter((item) => {
      if (catalogTypeFilter === 'MOVIE' && item.mediaType !== 'MOVIE') {
        return false;
      }
      if (catalogTypeFilter === 'TV' && item.mediaType !== 'TV') {
        return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.directors.some((d) => d.toLowerCase().includes(q)) ||
        item.cast.some((c) => c.name.toLowerCase().includes(q)) ||
        item.tropes.some((t) => t.toLowerCase().includes(q)) ||
        item.primaryGenre.toLowerCase().includes(q)
      );
    });

    list.sort((a, b) => {
      if (catalogSort === 'RATING') {
        return b.imdbRating - a.imdbRating || b.rottenTomatoes - a.rottenTomatoes;
      }
      if (catalogSort === 'YEAR') {
        return b.year - a.year || b.imdbRating - a.imdbRating;
      }
      if (catalogSort === 'TITLE') {
        return a.title.localeCompare(b.title);
      }
      const sA = scoreByMediaId.get(a.id)?.totalScore ?? 0;
      const sB = scoreByMediaId.get(b.id)?.totalScore ?? 0;
      return sB - sA || b.imdbRating - a.imdbRating;
    });

    return list;
  }, [allMediaItems, catalogTypeFilter, catalogQuery, catalogSort, scoreByMediaId]);

  if (collapsed) {
    return (
      <div className="fixed right-4 top-20 z-30">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#FBF8F2] border border-[#B5A892] shadow-archival text-xs font-semibold text-[#171412] hover:bg-[#EFE8DA] transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 text-[#B8292F]" />
          {inspectedItem ? (
            <>
              <span>Notes: {inspectedItem.title}</span>
              {focalItem && inspectedItem.id !== focalItem.id && similarity && (
                <span className="px-1.5 py-0.5 rounded bg-[#E3EFEA] text-[#2A6B53] font-tabular font-bold">
                  {similarity.totalScore}%
                </span>
              )}
            </>
          ) : (
            <span>Graph Index ({allMediaItems.length} Titles)</span>
          )}
        </button>
      </div>
    );
  }

  // ==================== MODE 1: FULL GRAPH MEDIA CATALOGUE (DEFAULT WHEN NO SINGLE TITLE IS INSPECTED) ====================
  if (!inspectedItem) {
    return (
      <aside
        aria-label="Graph Media Catalogue — All Movies and TV Shows"
        className="fixed right-4 top-[4.5rem] bottom-4 w-[396px] max-w-[calc(100vw-2rem)] z-30 rounded-lg bg-[#FBF8F2] border border-[#B5A892] shadow-archival flex flex-col overflow-hidden"
      >
        {/* Top Strip */}
        <div className="px-4 py-2.5 bg-[#EFE8DA] border-b border-[#D5CCB9] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-[#52483E]">
            <span className="w-2 h-2 rounded-full bg-[#2A6B53]" />
            <span>Complete Graph Index</span>
            <span className="text-[#B5A892]">·</span>
            <span className="font-tabular font-semibold text-[#171412]">
              {allMediaItems.length} Titles
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="p-1 rounded text-[#52483E] hover:text-[#171412] hover:bg-[#E5DEC9] transition-colors"
            title="Collapse Graph Index"
            aria-label="Collapse Graph Index"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Catalogue Header & Controls */}
        <div className="px-4 pt-3.5 pb-3 border-b border-[#D5CCB9] bg-[#FBF8F2] space-y-2.5">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h1 className="font-heading text-xl font-bold text-[#171412] leading-tight">
                All Movies &amp; TV Series
              </h1>
              {focalItem && (
                <button
                  type="button"
                  onClick={onClearFocal}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#F5E4E4] text-[#8C1D22] border border-[#D8B4B6] hover:bg-[#B8292F] hover:text-[#FBF8F2] transition-colors shrink-0 cursor-pointer"
                >
                  <Globe className="w-3 h-3" />
                  Reset Focal
                </button>
              )}
            </div>
            <p className="text-xs text-[#52483E] mt-0.5">
              Every film and series in the constellation. Select any title to
              inspect its monograph or center the graph around it.
            </p>
          </div>

          {/* Filter Tabs: All / Films / Series */}
          <div className="flex items-center justify-between gap-2">
            <div className="grid grid-cols-3 gap-1 p-0.5 rounded bg-[#EFE8DA] border border-[#C8BEAA] flex-1">
              <button
                type="button"
                onClick={() => setCatalogTypeFilter('ALL')}
                className={`py-1 px-2 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                  catalogTypeFilter === 'ALL'
                    ? 'bg-[#FBF8F2] text-[#171412] border border-[#B5A892] shadow-archival-sm'
                    : 'text-[#52483E] hover:text-[#171412]'
                }`}
              >
                All ({allMediaItems.length})
              </button>
              <button
                type="button"
                onClick={() => setCatalogTypeFilter('MOVIE')}
                className={`py-1 px-2 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                  catalogTypeFilter === 'MOVIE'
                    ? 'bg-[#FBF8F2] text-[#234B6E] border border-[#B5A892] shadow-archival-sm'
                    : 'text-[#52483E] hover:text-[#171412]'
                }`}
              >
                Films ({movieCount})
              </button>
              <button
                type="button"
                onClick={() => setCatalogTypeFilter('TV')}
                className={`py-1 px-2 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                  catalogTypeFilter === 'TV'
                    ? 'bg-[#FBF8F2] text-[#6B3A6E] border border-[#B5A892] shadow-archival-sm'
                    : 'text-[#52483E] hover:text-[#171412]'
                }`}
              >
                Series ({tvCount})
              </button>
            </div>

            <select
              aria-label="Sort graph catalogue"
              value={catalogSort}
              onChange={(e) =>
                setCatalogSort(
                  e.target.value as
                    | 'CONNECTIVITY'
                    | 'RATING'
                    | 'YEAR'
                    | 'TITLE'
                )
              }
              className="px-2 py-1.5 rounded bg-[#EFE8DA] border border-[#C8BEAA] text-[11px] font-semibold text-[#171412] focus:outline-none cursor-pointer"
            >
              <option value="CONNECTIVITY">Sort: Graph Links</option>
              <option value="RATING">Sort: IMDb Rating</option>
              <option value="YEAR">Sort: Release Year</option>
              <option value="TITLE">Sort: Title A–Z</option>
            </select>
          </div>

          {/* Quick Filter Input */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-[#6B5E50] absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={catalogQuery}
              onChange={(e) => setCatalogQuery(e.target.value)}
              placeholder="Filter by title, director, actor, or theme…"
              className="w-full pl-8 pr-7 py-1.5 rounded bg-[#F6F1E7] border border-[#C8BEAA] text-xs text-[#171412] placeholder:text-[#6B5E50] focus:outline-none focus:border-[#B8292F]"
            />
            {catalogQuery && (
              <button
                type="button"
                onClick={() => setCatalogQuery('')}
                className="absolute right-2 text-[#6B5E50] hover:text-[#171412]"
                aria-label="Clear filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Full Media List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#D5CCB9]">
          {filteredCatalogItems.map((item, idx) => {
            const sim = scoreByMediaId.get(item.id);
            const isItemFocal = focalItem?.id === item.id;
            const streamOffers = (item.streamingByRegion[region] || []).filter(
              (o) => o.type === 'STREAM'
            );

            return (
              <div
                key={item.id}
                onClick={() => onSelectMedia(item)}
                className="p-3.5 hover:bg-[#EFE8DA]/75 transition-colors cursor-pointer group flex gap-3 items-start"
              >
                {/* Spine Number + Poster */}
                <div className="flex items-start gap-2 shrink-0">
                  <span className="w-5 text-right font-heading text-xs font-bold font-tabular text-[#6B5E50] pt-0.5">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className="w-12 h-[72px] rounded-sm overflow-hidden border border-[#C8BEAA] bg-[#EFE8DA] shrink-0">
                    <img
                      src={item.posterUrl}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = getPosterFallbackDataUri(item);
                      }}
                    />
                  </div>
                </div>

                {/* Metadata + Actions */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-heading text-sm font-bold text-[#171412] group-hover:text-[#B8292F] transition-colors truncate">
                      {item.title}
                    </h2>
                    <span className="text-[11px] font-tabular font-bold text-[#171412] shrink-0">
                      ★ {item.imdbRating.toFixed(1)}
                    </span>
                  </div>

                  <div className="flex items-center flex-wrap gap-1.5 mt-0.5 text-[11px] text-[#52483E]">
                    <span
                      className={`inline-flex items-center gap-0.5 font-semibold ${
                        item.mediaType === 'MOVIE'
                          ? 'text-[#234B6E]'
                          : 'text-[#6B3A6E]'
                      }`}
                    >
                      {item.mediaType === 'MOVIE' ? (
                        <Film className="w-3 h-3" />
                      ) : (
                        <Tv className="w-3 h-3" />
                      )}
                      {item.mediaType === 'MOVIE' ? 'Film' : 'Series'}
                    </span>
                    <span>·</span>
                    <span className="font-tabular">{item.year}</span>
                    <span>·</span>
                    <span className="truncate">{item.directors[0]}</span>
                  </div>

                  {/* Themes & Action Bar */}
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <div className="flex items-center gap-1 flex-wrap min-w-0">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#EFE8DA] text-[#52483E] border border-[#D5CCB9] truncate max-w-[130px]">
                        {item.tropes[0] || item.primaryGenre}
                      </span>
                      {streamOffers[0] && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#E3EFEA] text-[#2A6B53] border border-[#B4D4C7]">
                          {streamOffers[0].provider}
                        </span>
                      )}
                      {sim && !focalItem && (
                        <span className="text-[10px] font-tabular text-[#6B5E50]">
                          {sim.sharedConnections.length} threads
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMakeFocal(item.id);
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors shrink-0 cursor-pointer ${
                        isItemFocal
                          ? 'bg-[#F5E4E4] text-[#8C1D22] border-[#D8B4B6]'
                          : 'bg-[#F6F1E7] hover:bg-[#B8292F] text-[#52483E] hover:text-[#FBF8F2] border-[#C8BEAA] hover:border-[#8C1D22]'
                      }`}
                      title="Center graph around this title"
                    >
                      <Crosshair className="w-2.5 h-2.5" />
                      <span>{isItemFocal ? 'Centered' : 'Center'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredCatalogItems.length === 0 && (
            <div className="p-6 text-center text-xs text-[#6B5E50]">
              No titles in the graph match &ldquo;{catalogQuery}&rdquo;.
            </div>
          )}
        </div>
      </aside>
    );
  }

  // ==================== MODE 2: SINGLE-TITLE MONOGRAPH INSPECTOR ====================
  const isFocal = focalItem ? inspectedItem.id === focalItem.id : false;
  const regionalOffers: StreamingOffer[] =
    inspectedItem.streamingByRegion[region] || [];

  const streamOffers = regionalOffers.filter((o) => o.type === 'STREAM');
  const rentOffers = regionalOffers.filter((o) => o.type === 'RENT');
  const buyOffers = regionalOffers.filter((o) => o.type === 'BUY');

  // When in Global Mode (no focalItem) or inspecting the focal item itself, list the title's own primary creative threads
  const displayPills =
    focalItem && !isFocal && similarity
      ? similarity.sharedConnections
      : [
          ...inspectedItem.directors.map((d) => ({
            id: `focal-dir-${d}`,
            prefix: 'Director',
            value: d,
            points: 25,
            color: '#B8292F',
            entityNodeId: toEntityNodeId('DIRECTOR', d),
          })),
          ...inspectedItem.cast.slice(0, 2).map((c) => ({
            id: `focal-cast-${c.name}`,
            prefix: 'Starring',
            value: c.name,
            points: 6,
            color: '#B86B14',
            entityNodeId: toEntityNodeId('ACTOR', c.name),
          })),
          ...inspectedItem.composers.map((comp) => ({
            id: `focal-comp-${comp}`,
            prefix: 'Score',
            value: comp,
            points: 6,
            color: '#A63A2B',
            entityNodeId: toEntityNodeId('COMPOSER', comp),
          })),
          ...inspectedItem.tropes.slice(0, 3).map((t) => ({
            id: `focal-trope-${t}`,
            prefix: 'Theme',
            value: t,
            points: 12,
            color: '#2A6B53',
            entityNodeId: toEntityNodeId('TROPE', t),
          })),
        ];

  const craftSegments = similarity
    ? [
        {
          label: 'Themes',
          pts: similarity.rawPoints.tropes,
          max: 35,
          color: '#2A6B53',
        },
        {
          label: 'Auteur',
          pts: similarity.rawPoints.auteur,
          max: 25,
          color: '#B8292F',
        },
        {
          label: 'Genre',
          pts: similarity.rawPoints.genres,
          max: 15,
          color: '#234B6E',
        },
        {
          label: 'Cast',
          pts: similarity.rawPoints.cast,
          max: 10,
          color: '#B86B14',
        },
        {
          label: 'Score & Camera',
          pts: similarity.rawPoints.sonicVisual,
          max: 10,
          color: '#A63A2B',
        },
        {
          label: 'Viewers',
          pts: similarity.rawPoints.coWatch,
          max: 5,
          color: '#6B3A6E',
        },
      ]
    : [];

  const totalRaw = Math.max(
    1,
    craftSegments.reduce((sum, seg) => sum + seg.pts, 0)
  );

  return (
    <aside
      aria-label="Catalogue Notes & Title Inspector"
      className="fixed right-4 top-[4.5rem] bottom-4 w-[396px] max-w-[calc(100vw-2rem)] z-30 rounded-lg bg-[#FBF8F2] border border-[#B5A892] shadow-archival flex flex-col overflow-hidden"
    >
      {/* Top Strip with Back to All Graph Titles */}
      <div className="px-4 py-2.5 bg-[#EFE8DA] border-b border-[#D5CCB9] flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onClearInspected}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#234B6E] hover:text-[#B8292F] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All Graph Titles ({allMediaItems.length})</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="font-tabular text-[11px] text-[#6B5E50]">
            {inspectedItem.imdbId}
          </span>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="p-1 rounded text-[#52483E] hover:text-[#171412] hover:bg-[#E5DEC9] transition-colors"
            title="Hide Catalogue Notes"
            aria-label="Hide Catalogue Notes"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Monograph Sheet Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* HEADER: Title First (no kicker above heading), Metadata & Match Badge Below */}
        <div className="pb-4 border-b border-[#D5CCB9]">
          <div className="flex items-start justify-between gap-2">
            <h1 className="font-heading text-2xl font-bold text-[#171412] leading-tight">
              {inspectedItem.title}
            </h1>

            {isFocal ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#F5E4E4] text-[#8C1D22] border border-[#D8B4B6] shrink-0 mt-0.5">
                <Crosshair className="w-3 h-3" />
                Focal Center
              </span>
            ) : focalItem && similarity ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold font-tabular bg-[#E3EFEA] text-[#2A6B53] border border-[#B4D4C7] shrink-0 mt-0.5">
                {similarity.totalScore}% Match
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#EFE8DA] text-[#52483E] border border-[#C8BEAA] shrink-0 mt-0.5">
                Archive Entry
              </span>
            )}
          </div>

          <div className="flex items-center flex-wrap gap-2 mt-1.5 text-xs text-[#52483E]">
            <span
              className={`inline-flex items-center gap-1 font-semibold ${
                inspectedItem.mediaType === 'MOVIE'
                  ? 'text-[#234B6E]'
                  : 'text-[#6B3A6E]'
              }`}
            >
              {inspectedItem.mediaType === 'MOVIE' ? (
                <Film className="w-3.5 h-3.5" />
              ) : (
                <Tv className="w-3.5 h-3.5" />
              )}
              {inspectedItem.mediaType === 'MOVIE' ? 'Feature Film' : 'Series'}
            </span>
            <span className="text-[#B5A892]">·</span>
            <span className="font-tabular font-medium">
              {inspectedItem.year}
            </span>
            <span className="text-[#B5A892]">·</span>
            <span>
              {inspectedItem.mediaType === 'MOVIE'
                ? 'Directed by '
                : 'Created by '}
              <strong className="text-[#171412] font-semibold">
                {inspectedItem.directors.join(', ')}
              </strong>
            </span>
          </div>
        </div>

        {/* POSTER PLATE & CRITICAL CONSENSUS LEDGER (No nested cards) */}
        <div className="py-4 border-b border-[#D5CCB9] flex gap-4 items-start">
          {/* 2:3 Archival Poster Plate */}
          <div className="w-28 aspect-[2/3] rounded overflow-hidden shrink-0 border border-[#C8BEAA] bg-[#EFE8DA] shadow-archival-sm relative">
            <img
              src={inspectedItem.posterUrl}
              alt={`${inspectedItem.title} poster`}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = getPosterFallbackDataUri(inspectedItem);
              }}
            />
          </div>

          {/* Inline Hairline Ledger Rows */}
          <dl className="flex-1 divide-y divide-[#D5CCB9] border-t border-b border-[#D5CCB9] text-xs">
            <div className="py-2 flex items-baseline justify-between gap-2">
              <dt className="text-[#52483E] font-medium">IMDb Audience</dt>
              <dd className="font-tabular font-bold text-[#171412]">
                {inspectedItem.imdbRating.toFixed(1)}{' '}
                <span className="font-normal text-[#6B5E50]">/ 10</span>
              </dd>
            </div>

            <div className="py-2 flex items-baseline justify-between gap-2">
              <dt className="text-[#52483E] font-medium">Rotten Tomatoes</dt>
              <dd className="font-tabular font-bold text-[#8C1D22]">
                {inspectedItem.rottenTomatoes}%{' '}
                <span className="font-normal text-[#6B5E50]">Critics</span>
              </dd>
            </div>

            <div className="py-2 flex items-baseline justify-between gap-2">
              <dt className="text-[#52483E] font-medium">Metacritic</dt>
              <dd className="font-tabular font-bold text-[#2A6B53]">
                {inspectedItem.metascore}{' '}
                <span className="font-normal text-[#6B5E50]">/ 100</span>
              </dd>
            </div>

            <div className="py-2 flex items-baseline justify-between gap-2">
              <dt className="text-[#52483E] font-medium">Format</dt>
              <dd className="font-tabular font-semibold text-[#171412] text-right">
                {inspectedItem.contentRating} · {inspectedItem.runtimeOrSeasons}
              </dd>
            </div>

            <div className="py-2 flex items-baseline justify-between gap-2">
              <dt className="text-[#52483E] font-medium">Primary Genre</dt>
              <dd className="font-semibold text-[#234B6E]">
                {inspectedItem.primaryGenre}
              </dd>
            </div>
          </dl>
        </div>

        {/* SYNOPSIS */}
        <div className="py-4 border-b border-[#D5CCB9]">
          <p className="text-[13px] text-[#2C2620] leading-relaxed">
            {inspectedItem.synopsis}
          </p>
        </div>

        {/* PROPORTIONAL CRAFT LINEAGE BAR (When comparing to a Focal Selection) */}
        {focalItem && !isFocal && similarity && (
          <section className="pt-4 pb-4 border-b border-[#D5CCB9]">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="font-heading text-sm font-bold text-[#171412]">
                How It Connects to {focalItem.title}
              </h2>
              <span className="text-xs font-tabular font-semibold text-[#2A6B53]">
                {similarity.totalScore} / 100 pts
              </span>
            </div>

            {/* Proportional 6-segment bar */}
            <div
              className="h-2.5 w-full rounded-sm overflow-hidden flex bg-[#E5DEC9] border border-[#C8BEAA]"
              role="img"
              aria-label="Proportional craft similarity breakdown"
            >
              {craftSegments.map(
                (seg) =>
                  seg.pts > 0 && (
                    <div
                      key={seg.label}
                      style={{
                        width: `${(seg.pts / totalRaw) * 100}%`,
                        backgroundColor: seg.color,
                      }}
                      title={`${seg.label}: +${seg.pts} pts`}
                      className="h-full border-r border-[#FBF8F2]/40 last:border-r-0"
                    />
                  )
              )}
            </div>

            {/* Compact tabular legend */}
            <div className="grid grid-cols-3 gap-x-3 gap-y-1 mt-2 text-[11px] font-tabular">
              {craftSegments.map((seg) => (
                <div
                  key={seg.label}
                  className="flex items-center justify-between text-[#52483E]"
                >
                  <span className="inline-flex items-center gap-1 truncate">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="truncate">{seg.label}</span>
                  </span>
                  <span className="font-semibold text-[#171412]">
                    +{seg.pts}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* WHERE TO WATCH (Regional Availability) */}
        <section className="pt-4 pb-4 border-b border-[#D5CCB9]">
          <div className="flex items-baseline justify-between mb-2.5">
            <h2 className="font-heading text-sm font-bold text-[#171412]">
              Where to Watch ({region})
            </h2>
            <span className="text-[11px] text-[#6B5E50]">
              Regional Catalogue
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {/* STREAM */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-14 text-[11px] font-semibold text-[#2A6B53]">
                Stream
              </span>
              {streamOffers.length > 0 ? (
                streamOffers.map((offer, i) => (
                  <a
                    key={`${offer.provider}-${i}`}
                    href={offer.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-[#EFE8DA] hover:bg-[#E5DEC9] text-[#171412] border border-[#C8BEAA] transition-colors"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: offer.color }}
                    />
                    <span>{offer.provider}</span>
                    {offer.quality && (
                      <span className="px-1 py-0.2 rounded bg-[#E5DEC9] text-[10px] font-tabular text-[#52483E]">
                        {offer.quality}
                      </span>
                    )}
                    <ExternalLink className="w-3 h-3 text-[#6B5E50]" />
                  </a>
                ))
              ) : (
                <span className="text-xs text-[#6B5E50]">
                  Not currently on subscription streaming in {region}
                </span>
              )}
            </div>

            {/* RENT */}
            {rentOffers.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap pt-1.5 border-t border-[#E5DEC9]">
                <span className="w-14 text-[11px] font-semibold text-[#234B6E]">
                  Rent
                </span>
                {rentOffers.map((offer, i) => (
                  <a
                    key={`rent-${offer.provider}-${i}`}
                    href={offer.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs bg-[#F6F1E7] hover:bg-[#E5DEC9] text-[#171412] border border-[#D5CCB9] transition-colors"
                  >
                    <span>{offer.provider}</span>
                    {offer.price && (
                      <span className="font-tabular font-semibold text-[#234B6E]">
                        {offer.price}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            )}

            {/* BUY */}
            {buyOffers.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap pt-1.5 border-t border-[#E5DEC9]">
                <span className="w-14 text-[11px] font-semibold text-[#6B3A6E]">
                  Buy
                </span>
                {buyOffers.map((offer, i) => (
                  <a
                    key={`buy-${offer.provider}-${i}`}
                    href={offer.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs bg-[#F6F1E7] hover:bg-[#E5DEC9] text-[#171412] border border-[#D5CCB9] transition-colors"
                  >
                    <span>{offer.provider}</span>
                    {offer.price && (
                      <span className="font-tabular font-semibold text-[#6B3A6E]">
                        {offer.price}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* SHARED CREATIVE THREADS */}
        <section className="pt-4">
          <h2 className="font-heading text-sm font-bold text-[#171412] mb-2">
            {focalItem && !isFocal
              ? `Shared Credits & Themes with ${focalItem.title}`
              : 'Key Collaborators & Themes'}
          </h2>

          <div className="flex flex-wrap gap-1.5">
            {displayPills.map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => {
                  if (pill.entityNodeId) {
                    onSelectEntityNode(pill.entityNodeId);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-[#EFE8DA] hover:bg-[#E5DEC9] border border-[#C8BEAA] transition-colors text-left cursor-pointer"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: pill.color }}
                />
                <span className="text-[#52483E]">{pill.prefix}:</span>
                <span className="text-[#171412] font-semibold">
                  {pill.value}
                </span>
                <span
                  className="text-[11px] font-tabular font-bold ml-0.5"
                  style={{ color: pill.color }}
                >
                  +{pill.points}
                </span>
              </button>
            ))}
          </div>

          {/* Closest Matches in Graph */}
          <div className="pt-4 mt-4 border-t border-[#D5CCB9]">
            <h3 className="font-heading text-sm font-bold text-[#171412] mb-2">
              {focalItem && !isFocal
                ? `Other Titles Connected to ${focalItem.title}`
                : `Closest Connected Titles to ${inspectedItem.title}`}
            </h3>
            {topRecommendations.filter((r) => r.item.id !== inspectedItem.id)
              .length > 0 ? (
              <div className="divide-y divide-[#D5CCB9] border-t border-b border-[#D5CCB9]">
                {topRecommendations
                  .filter((r) => r.item.id !== inspectedItem.id)
                  .slice(0, 5)
                  .map(({ item, similarity: s }) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectMedia(item)}
                      className="w-full flex items-center justify-between gap-2 py-2 px-1.5 hover:bg-[#EFE8DA] text-left transition-colors cursor-pointer"
                    >
                      <span className="text-xs font-semibold text-[#171412] truncate">
                        {item.title}{' '}
                        <span className="font-normal font-tabular text-[#52483E]">
                          ({item.year})
                        </span>
                      </span>
                      <span className="text-xs font-tabular font-bold text-[#2A6B53] shrink-0">
                        {s.totalScore}% Affinity
                      </span>
                    </button>
                  ))}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-[#EFE8DA]/70 border border-[#D5CCB9] text-xs text-[#52483E] leading-relaxed">
                <p className="font-semibold text-[#171412] mb-0.5">
                  Standalone Archival Node
                </p>
                <p>
                  No verified shared directors, cast members, composers, or
                  specific narrative themes connect{' '}
                  <span className="font-medium text-[#171412]">
                    {inspectedItem.title}
                  </span>{' '}
                  to other titles in the current collection above the{' '}
                  match threshold. Click{' '}
                  <span className="font-semibold text-[#8C1D22]">
                    Center Graph Here
                  </span>{' '}
                  below to discover and import its connected constellation.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ACTION BUTTONS FOOTER */}
      <div className="p-3.5 bg-[#EFE8DA] border-t border-[#D5CCB9] grid grid-cols-2 gap-2.5">
        {isFocal ? (
          <button
            type="button"
            onClick={onClearFocal}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded text-xs font-semibold bg-[#FBF8F2] hover:bg-[#E5DEC9] text-[#8C1D22] border border-[#D8B4B6] transition-colors cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Show Full Graph</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onMakeFocal(inspectedItem.id)}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded text-xs font-semibold bg-[#B8292F] hover:bg-[#8C1D22] text-[#FBF8F2] border border-[#8C1D22] shadow-archival-sm transition-colors cursor-pointer"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Center Map Here</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onOrbitNode(inspectedItem.id)}
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded text-xs font-semibold bg-[#FBF8F2] hover:bg-[#E5DEC9] text-[#171412] border border-[#B5A892] transition-colors cursor-pointer"
        >
          <Compass className="w-3.5 h-3.5 text-[#234B6E]" />
          <span>Focus in Map</span>
        </button>
      </div>
    </aside>
  );
}
