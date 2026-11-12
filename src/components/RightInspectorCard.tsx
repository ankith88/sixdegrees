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
  Check,
  Sparkles,
  RotateCcw,
  Bookmark,
} from 'lucide-react';
import {
  AppTheme,
  GraphNode,
  MediaItem,
  RegionCode,
  SimilarityBreakdown,
  StreamingOffer,
} from '@/lib/types';
import { getPosterFallbackDataUri } from '@/lib/seed-data';
import {
  toEntityNodeId,
  assignItemSemanticCluster,
  blendHexColors,
} from '@/lib/similarity';

interface RightInspectorCardProps {
  inspectedItem: MediaItem | null;
  activeEntityNode?: GraphNode | null;
  focalItem: MediaItem | null;
  allMediaItems: MediaItem[];
  similarity: SimilarityBreakdown | null;
  region: RegionCode;
  onMakeFocal: (mediaId: string) => void;
  onClearFocal: () => void;
  onClearInspected: () => void;
  onResetEverything?: () => void;
  onOrbitNode: (nodeId: string) => void;
  onSelectEntityNode: (entityNodeId: string) => void;
  topRecommendations: Array<{
    item: MediaItem;
    similarity: SimilarityBreakdown;
  }>;
  onSelectMedia: (item: MediaItem) => void;
  watchedIds?: string[];
  onToggleWatched?: (mediaId: string) => void;
  interestedIds?: string[];
  onToggleInterested?: (mediaId: string) => void;
  onSuggestFromMedia?: (mediaId: string) => void;
  theme?: AppTheme;
  isCatalogOpen?: boolean;
  onCloseCatalog?: () => void;
  onOpenCatalog?: () => void;
}

export function RightInspectorCard({
  inspectedItem,
  activeEntityNode = null,
  focalItem,
  allMediaItems,
  similarity,
  region,
  onMakeFocal,
  onClearFocal,
  onClearInspected,
  onResetEverything,
  onOrbitNode,
  onSelectEntityNode,
  topRecommendations,
  onSelectMedia,
  watchedIds = [],
  onToggleWatched,
  interestedIds = [],
  onToggleInterested,
  onSuggestFromMedia,
  theme = 'MOVIE_MAP_DARK',
  isCatalogOpen = false,
  onCloseCatalog,
  onOpenCatalog,
}: RightInspectorCardProps) {
  const isDark = theme === 'MOVIE_MAP_DARK';

  // Keyboard shortcut: Escape dismisses inspector or catalog
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inspectedItem || activeEntityNode) {
          onClearInspected();
        } else if (isCatalogOpen && onCloseCatalog) {
          onCloseCatalog();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectedItem, activeEntityNode, isCatalogOpen, onClearInspected, onCloseCatalog]);
  const [catalogTypeFilter, setCatalogTypeFilter] = useState<
    'ALL' | 'MOVIE' | 'TV'
  >('ALL');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogSort, setCatalogSort] = useState<
    'CONNECTIVITY' | 'RATING' | 'YEAR' | 'TITLE'
  >('CONNECTIVITY');
  const [inspectorTab, setInspectorTab] = useState<'OVERVIEW' | 'SIMILAR'>('OVERVIEW');

  const scopedMediaItems = useMemo(() => {
    if (!activeEntityNode) return allMediaItems;
    const connectedSet = new Set(activeEntityNode.connectedMediaIds);
    return allMediaItems.filter((m) => connectedSet.has(m.id));
  }, [allMediaItems, activeEntityNode]);

  const movieCount = useMemo(
    () => scopedMediaItems.filter((m) => m.mediaType === 'MOVIE').length,
    [scopedMediaItems]
  );
  const tvCount = useMemo(
    () => scopedMediaItems.filter((m) => m.mediaType === 'TV').length,
    [scopedMediaItems]
  );

  // Build connectivity score map from topRecommendations
  const scoreByMediaId = useMemo(() => {
    const map = new Map<string, SimilarityBreakdown>();
    for (const entry of topRecommendations) {
      map.set(entry.item.id, entry.similarity);
    }
    return map;
  }, [topRecommendations]);

  // Archival Cluster Kinship & Spatial Sector Telemetry
  const clusterTelemetry = useMemo(() => {
    if (!inspectedItem) return null;
    const { primary, secondary, blendRatio } = assignItemSemanticCluster(inspectedItem, theme);
    const blendedColor = blendHexColors(primary.color, secondary.color, blendRatio);
    return {
      primary,
      secondary,
      blendRatio,
      blendedColor,
    };
  }, [inspectedItem, theme]);

  const filteredCatalogItems = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    const list = scopedMediaItems.filter((item) => {
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
  }, [scopedMediaItems, catalogTypeFilter, catalogQuery, catalogSort, scoreByMediaId]);

  // Only display the drawer when an item or entity node is explicitly clicked, or catalog opened
  const isVisible = Boolean(inspectedItem || activeEntityNode || isCatalogOpen);
  if (!isVisible) {
    return null;
  }

  // ==================== MODE 1: FULL GRAPH MEDIA CATALOGUE / CONNECTED ENTITY INDEX ====================
  if (!inspectedItem) {
    return (
      <aside
        aria-label="Graph Media Catalogue — All Movies and TV Shows"
        className={`fixed inset-x-0 bottom-0 top-14 sm:top-[4.5rem] sm:right-4 sm:bottom-4 sm:left-auto sm:w-[396px] sm:max-w-[calc(100vw-2rem)] z-40 sm:z-30 sm:rounded-xl rounded-t-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 sm:slide-in-from-right-6 duration-200 ease-out ${
          isDark
            ? 'bg-[#0B101B]/95 border-t sm:border border-[#1C273C] text-[#F0F4FC] shadow-2xl backdrop-blur-xl'
            : 'bg-[#FBF8F2] border-t sm:border border-[#B5A892] text-[#171412] shadow-archival'
        }`}
      >
        <div className="sm:hidden w-10 h-1 rounded-full bg-white/20 mx-auto my-1.5 shrink-0" />
        {/* Top Strip */}
        <div className={`px-4 py-2.5 border-b flex items-center justify-between ${
          isDark ? 'bg-[#121A2B] border-[#1C273C]' : 'bg-[#EFE8DA] border-[#D5CCB9]'
        }`}>
          <div className={`flex items-center gap-2 text-xs font-medium ${
            isDark ? 'text-[#94A3B8]' : 'text-[#52483E]'
          }`}>
            <span
              className={`w-2 h-2 rounded-full ${
                activeEntityNode
                  ? isDark ? 'bg-[#FF3366]' : 'bg-[#B8292F]'
                  : isDark ? 'bg-[#00D2FF]' : 'bg-[#2A6B53]'
              }`}
            />
            <span>
              {activeEntityNode ? 'Isolated Connected Index' : 'Complete Graph Index'}
            </span>
            <span className={isDark ? 'text-[#64748B]' : 'text-[#B5A892]'}>·</span>
            <span className={`font-tabular font-semibold ${isDark ? 'text-[#F0F4FC]' : 'text-[#171412]'}`}>
              {scopedMediaItems.length} Titles
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (activeEntityNode) {
                onClearInspected();
              } else if (onCloseCatalog) {
                onCloseCatalog();
              } else {
                onClearInspected();
              }
            }}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDark
                ? 'text-[#94A3B8] hover:text-[#F0F4FC] bg-[#162035]/60 hover:bg-[#1C273C] border-[#1C273C]'
                : 'text-[#52483E] hover:text-[#171412] bg-[#EFE8DA] hover:bg-[#E5DEC9] border-[#C8BEAA]'
            }`}
            title="Close (Esc)"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Catalogue Header & Controls */}
        <div className={`px-4 pt-3.5 pb-3 border-b space-y-2.5 ${
          isDark ? 'bg-[#121A2B]/60 border-[#1C273C]' : 'bg-[#FBF8F2] border-[#D5CCB9]'
        }`}>
          <div>
            <div className="flex items-start justify-between gap-2">
              <h1 className={`font-heading text-xl font-bold leading-tight ${
                isDark ? 'text-[#F0F4FC]' : 'text-[#171412]'
              }`}>
                {activeEntityNode
                  ? `Connected to ${activeEntityNode.label}`
                  : 'All Movies & TV Series'}
              </h1>
              {(activeEntityNode || focalItem) && (
                <button
                  type="button"
                  onClick={onResetEverything || onClearFocal}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors shrink-0 cursor-pointer ${
                    isDark
                      ? 'bg-[#FF3366] hover:bg-[#FF3366]/80 text-[#0A0E17] font-bold border border-[#FF3366]'
                      : 'bg-[#B8292F] text-[#FBF8F2] border border-[#8C1D22] hover:bg-[#8C1D22]'
                  }`}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset All</span>
                </button>
              )}
            </div>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-[#94A3B8]' : 'text-[#52483E]'}`}>
              {activeEntityNode
                ? `Showing only the ${scopedMediaItems.length} films & series linked to ${activeEntityNode.label}. Click Reset All to restore the full archive.`
                : 'Every film and series in the constellation. Select any title to inspect its monograph or center the graph around it.'}
            </p>
          </div>

          {/* Filter Tabs: All / Films / Series */}
          <div className="flex items-center justify-between gap-2">
            <div className={`grid grid-cols-3 gap-1 p-0.5 rounded border flex-1 ${
              isDark ? 'bg-[#0B101B] border-[#1C273C]' : 'bg-[#EFE8DA] border-[#C8BEAA]'
            }`}>
              <button
                type="button"
                onClick={() => setCatalogTypeFilter('ALL')}
                className={`py-1 px-2 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                  catalogTypeFilter === 'ALL'
                    ? isDark
                      ? 'bg-[#00D2FF]/20 text-[#00D2FF] border border-[#00D2FF]/40 shadow-[0_0_8px_rgba(0,210,255,0.2)]'
                      : 'bg-[#FBF8F2] text-[#171412] border border-[#B5A892] shadow-archival-sm'
                    : isDark ? 'text-[#94A3B8] hover:text-[#F0F4FC]' : 'text-[#52483E] hover:text-[#171412]'
                }`}
              >
                All ({scopedMediaItems.length})
              </button>
              <button
                type="button"
                onClick={() => setCatalogTypeFilter('MOVIE')}
                className={`py-1 px-2 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                  catalogTypeFilter === 'MOVIE'
                    ? isDark
                      ? 'bg-[#00D2FF]/20 text-[#00D2FF] border border-[#00D2FF]/40 shadow-[0_0_8px_rgba(0,210,255,0.2)]'
                      : 'bg-[#FBF8F2] text-[#234B6E] border border-[#B5A892] shadow-archival-sm'
                    : isDark ? 'text-[#94A3B8] hover:text-[#F0F4FC]' : 'text-[#52483E] hover:text-[#171412]'
                }`}
              >
                Films ({movieCount})
              </button>
              <button
                type="button"
                onClick={() => setCatalogTypeFilter('TV')}
                className={`py-1 px-2 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                  catalogTypeFilter === 'TV'
                    ? isDark
                      ? 'bg-[#FF3366]/20 text-[#FF3366] border border-[#FF3366]/40 shadow-[0_0_8px_rgba(255,51,102,0.2)]'
                      : 'bg-[#FBF8F2] text-[#6B3A6E] border border-[#B5A892] shadow-archival-sm'
                    : isDark ? 'text-[#94A3B8] hover:text-[#F0F4FC]' : 'text-[#52483E] hover:text-[#171412]'
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
              className={`px-2 py-1.5 rounded border text-[11px] font-semibold focus:outline-none cursor-pointer ${
                isDark ? 'bg-[#0B101B] border-[#1C273C] text-[#F0F4FC]' : 'bg-[#EFE8DA] border-[#C8BEAA] text-[#171412]'
              }`}
            >
              <option value="CONNECTIVITY">Sort: Graph Links</option>
              <option value="RATING">Sort: IMDb Rating</option>
              <option value="YEAR">Sort: Release Year</option>
              <option value="TITLE">Sort: Title A–Z</option>
            </select>
          </div>

          {/* Quick Filter Input */}
          <div className="relative flex items-center">
            <Search className={`w-3.5 h-3.5 absolute left-2.5 pointer-events-none ${isDark ? 'text-[#64748B]' : 'text-[#6B5E50]'}`} />
            <input
              type="text"
              value={catalogQuery}
              onChange={(e) => setCatalogQuery(e.target.value)}
              placeholder="Filter by title, director, actor, or theme…"
              className={`w-full pl-8 pr-7 py-1.5 rounded text-xs focus:outline-none ${
                isDark
                  ? 'bg-[#0B101B] border border-[#1C273C] text-[#F0F4FC] placeholder:text-[#64748B] focus:border-[#00D2FF]'
                  : 'bg-[#F6F1E7] border border-[#C8BEAA] text-[#171412] placeholder:text-[#6B5E50] focus:border-[#B8292F]'
              }`}
            />
            {catalogQuery && (
              <button
                type="button"
                onClick={() => setCatalogQuery('')}
                className={`absolute right-2 ${isDark ? 'text-[#64748B] hover:text-[#F0F4FC]' : 'text-[#6B5E50] hover:text-[#171412]'}`}
                aria-label="Clear filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Full Media List */}
        <div className={`flex-1 overflow-y-auto divide-y ${isDark ? 'divide-[#1C273C]' : 'divide-[#D5CCB9]'}`}>
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
                className={`p-3.5 transition-colors cursor-pointer group flex gap-3 items-start ${
                  isDark ? 'hover:bg-[#162035]/80' : 'hover:bg-[#EFE8DA]/75'
                }`}
              >
                {/* Spine Number + Poster */}
                <div className="flex items-start gap-2 shrink-0">
                  <span className={`w-5 text-right font-heading text-xs font-bold font-tabular pt-0.5 ${
                    isDark ? 'text-[#64748B]' : 'text-[#6B5E50]'
                  }`}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className={`w-12 h-[72px] rounded-sm overflow-hidden border shrink-0 ${
                    isDark ? 'border-[#1C273C] bg-[#121A2B]' : 'border-[#C8BEAA] bg-[#EFE8DA]'
                  }`}>
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
                    <h2 className={`font-heading text-sm font-bold transition-colors truncate ${
                      isDark ? 'text-[#F0F4FC] group-hover:text-[#00D2FF]' : 'text-[#171412] group-hover:text-[#B8292F]'
                    }`}>
                      {item.title}
                    </h2>
                    <span className={`text-[11px] font-tabular font-bold shrink-0 ${
                      isDark ? 'text-[#00D2FF]' : 'text-[#171412]'
                    }`}>
                      ★ {item.imdbRating.toFixed(1)}
                    </span>
                  </div>

                  <div className={`flex items-center flex-wrap gap-1.5 mt-0.5 text-[11px] ${
                    isDark ? 'text-[#94A3B8]' : 'text-[#52483E]'
                  }`}>
                    <span
                      className={`inline-flex items-center gap-0.5 font-semibold ${
                        item.mediaType === 'MOVIE'
                          ? isDark ? 'text-[#00D2FF]' : 'text-[#234B6E]'
                          : isDark ? 'text-[#FF3366]' : 'text-[#6B3A6E]'
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
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border truncate max-w-[130px] ${
                        isDark ? 'bg-[#121A2B] text-[#94A3B8] border-[#1C273C]' : 'bg-[#EFE8DA] text-[#52483E] border-[#D5CCB9]'
                      }`}>
                        {item.tropes[0] || item.primaryGenre}
                      </span>
                      {streamOffers[0] && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                          isDark ? 'bg-[#00D2FF]/15 text-[#00D2FF] border-[#00D2FF]/30' : 'bg-[#E3EFEA] text-[#2A6B53] border-[#B4D4C7]'
                        }`}>
                          {streamOffers[0].provider}
                        </span>
                      )}
                      {sim && !focalItem && (
                        <span className={`text-[10px] font-tabular ${isDark ? 'text-[#64748B]' : 'text-[#6B5E50]'}`}>
                          {sim.sharedConnections.length} threads
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {onToggleInterested && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleInterested(item.id);
                          }}
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-colors cursor-pointer ${
                            interestedIds.includes(item.id)
                              ? isDark
                                ? 'bg-[#FF3366]/20 text-[#FF3366] border-[#FF3366]/40'
                                : 'bg-[#E6EEF6] text-[#234B6E] border-[#B6C8DC]'
                              : isDark
                                ? 'bg-[#121A2B] hover:bg-[#162035] text-[#94A3B8] border-[#1C273C]'
                                : 'bg-[#F6F1E7] hover:bg-[#EFE8DA] text-[#52483E] border-[#C8BEAA]'
                          }`}
                          title={
                            interestedIds.includes(item.id)
                              ? 'In Want to Watch / Interested (click to remove)'
                              : 'Add to Want to Watch / Interested list'
                          }
                        >
                          <Bookmark className="w-2.5 h-2.5" />
                          <span>
                            {interestedIds.includes(item.id)
                              ? 'Interested'
                              : 'Want'}
                          </span>
                        </button>
                      )}
                      {onToggleWatched && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleWatched(item.id);
                          }}
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-colors cursor-pointer ${
                            watchedIds.includes(item.id)
                              ? isDark
                                ? 'bg-[#00D2FF]/20 text-[#00D2FF] border-[#00D2FF]/40'
                                : 'bg-[#E4F0EA] text-[#1E563F] border-[#B3D4C5]'
                              : isDark
                                ? 'bg-[#121A2B] hover:bg-[#162035] text-[#94A3B8] border-[#1C273C]'
                                : 'bg-[#F6F1E7] hover:bg-[#EFE8DA] text-[#52483E] border-[#C8BEAA]'
                          }`}
                          title={
                            watchedIds.includes(item.id)
                              ? 'Watched (click to unmark)'
                              : 'Mark as Watched for suggestions'
                          }
                        >
                          <Check className="w-2.5 h-2.5" />
                          <span>
                            {watchedIds.includes(item.id) ? 'Watched' : 'Watch'}
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMakeFocal(item.id);
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors shrink-0 cursor-pointer ${
                          isItemFocal
                            ? isDark
                              ? 'bg-[#FF3366]/20 text-[#FF3366] border-[#FF3366]/40'
                              : 'bg-[#F5E4E4] text-[#8C1D22] border-[#D8B4B6]'
                            : isDark
                              ? 'bg-[#121A2B] hover:bg-[#00D2FF]/20 text-[#94A3B8] hover:text-[#00D2FF] border-[#1C273C] hover:border-[#00D2FF]/40'
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
          ...inspectedItem.cast.slice(0, 3).map((c) => ({
            id: `focal-cast-${c.name}`,
            prefix: 'Starring',
            value: c.name,
            points: 6,
            color: '#B86B14',
            entityNodeId: toEntityNodeId('ACTOR', c.name),
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
      className={`fixed inset-x-0 bottom-0 top-14 sm:top-[4.5rem] sm:right-4 sm:bottom-4 sm:left-auto sm:w-[396px] sm:max-w-[calc(100vw-2rem)] z-40 sm:z-30 sm:rounded-xl rounded-t-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 sm:slide-in-from-right-6 duration-200 ease-out ${
        isDark
          ? 'bg-[#0B101B]/95 border-t sm:border border-[#1C273C] text-[#F0F4FC] shadow-2xl backdrop-blur-xl'
          : 'bg-[#FBF8F2] border-t sm:border border-[#B5A892] text-[#171412] shadow-archival'
      }`}
    >
      <div className="sm:hidden w-10 h-1 rounded-full bg-white/20 mx-auto my-1.5 shrink-0" />
      {/* Top Strip with Badges, Actions, and Close Button */}
      <div className={`px-4 py-2.5 border-b flex items-center justify-between gap-2 ${
        isDark ? 'bg-[#121A2B] border-[#1C273C]' : 'bg-[#EFE8DA] border-[#D5CCB9]'
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
            inspectedItem.mediaType === 'TV'
              ? isDark ? 'bg-[#FF3366]/20 text-[#FF3366] border border-[#FF3366]/40' : 'bg-[#F5E4E4] text-[#8C1D22] border border-[#D8B4B6]'
              : isDark ? 'bg-[#00D2FF]/20 text-[#00D2FF] border border-[#00D2FF]/40' : 'bg-[#E0EBF5] text-[#234B6E] border border-[#AEC5DD]'
          }`}>
            {inspectedItem.mediaType === 'TV' ? 'Series' : 'Film'}
          </span>
          <span className={`text-xs truncate font-medium ${isDark ? 'text-[#94A3B8]' : 'text-[#6B5E50]'}`}>
            {inspectedItem.year} · {inspectedItem.primaryGenre}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onOpenCatalog && (
            <button
              type="button"
              onClick={onOpenCatalog}
              className={`hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer border ${
                isDark
                  ? 'bg-[#101624] hover:bg-[#162035] text-[#94A3B8] hover:text-[#00D2FF] border-[#1C273C]'
                  : 'bg-[#FBF8F2] hover:bg-[#EFE8DA] text-[#52483E] hover:text-[#171412] border-[#C8BEAA]'
              }`}
              title={`View complete list of all ${allMediaItems.length} titles`}
            >
              <Film className="w-3 h-3" />
              <span>All Titles</span>
            </button>
          )}

          {onResetEverything && (
            <button
              type="button"
              onClick={onResetEverything}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                isDark
                  ? 'bg-[#FF3366] hover:bg-[#FF3366]/80 text-[#0A0E17] font-bold border border-[#FF3366]'
                  : 'bg-[#B8292F] hover:bg-[#8C1D22] text-[#FBF8F2]'
              }`}
              title="Reset selection, filters, and view back to full archive"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClearInspected}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDark
                ? 'text-[#94A3B8] hover:text-[#F0F4FC] bg-[#162035]/60 hover:bg-[#1C273C] border-[#1C273C]'
                : 'text-[#52483E] hover:text-[#171412] bg-[#EFE8DA] hover:bg-[#E5DEC9] border-[#C8BEAA]'
            }`}
            title="Close Inspector (Esc or click graph)"
            aria-label="Close Inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MOVIE MAP REA: INSPECTOR TABS (Overview vs Similar Films) */}
      <div className={`px-4 py-1.5 border-b flex items-center gap-1 ${
        isDark ? 'bg-[#121A2B] border-[#1C273C]' : 'bg-[#EFE8DA] border-[#D5CCB9]'
      }`}>
        <button
          type="button"
          onClick={() => setInspectorTab('OVERVIEW')}
          className={`flex-1 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
            inspectorTab === 'OVERVIEW'
              ? isDark
                ? 'bg-[#00D2FF]/20 text-[#00D2FF] border border-[#00D2FF]/40 shadow-[0_0_8px_rgba(0,210,255,0.2)]'
                : 'bg-[#FBF8F2] text-[#171412] border border-[#B5A892] shadow-archival-sm'
              : isDark ? 'text-[#94A3B8] hover:text-[#F0F4FC]' : 'text-[#52483E] hover:text-[#171412]'
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setInspectorTab('SIMILAR')}
          className={`flex-1 py-1 rounded text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
            inspectorTab === 'SIMILAR'
              ? isDark
                ? 'bg-[#00D2FF]/20 text-[#00D2FF] border border-[#00D2FF]/40 shadow-[0_0_8px_rgba(0,210,255,0.2)]'
                : 'bg-[#FBF8F2] text-[#171412] border border-[#B5A892] shadow-archival-sm'
              : isDark ? 'text-[#94A3B8] hover:text-[#F0F4FC]' : 'text-[#52483E] hover:text-[#171412]'
          }`}
        >
          <span>Similar Films</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-tabular font-bold ${
            isDark ? 'bg-[#00D2FF]/20 text-[#00D2FF]' : 'bg-[#E4F0EA] text-[#1E563F]'
          }`}>
            {topRecommendations.slice(0, 20).length}
          </span>
        </button>
      </div>

      {/* Scrollable Monograph Sheet Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {inspectorTab === 'SIMILAR' ? (
          /* ==================== SIMILAR FILMS TAB (TOP 20 NEAREST NEIGHBORS) ==================== */
          <div className="space-y-3">
            <div className={`flex items-center justify-between pb-2 border-b ${isDark ? 'border-[#1C273C]' : 'border-[#D5CCB9]'}`}>
              <h3 className={`font-heading text-base font-bold ${isDark ? 'text-[#F0F4FC]' : 'text-[#171412]'}`}>
                Nearest Semantic Neighbors
              </h3>
              <span className={`text-xs font-tabular ${isDark ? 'text-[#94A3B8]' : 'text-[#6B5E50]'}`}>
                Top {topRecommendations.slice(0, 20).length} Films
              </span>
            </div>

            <p className={`text-xs leading-relaxed ${isDark ? 'text-[#94A3B8]' : 'text-[#52483E]'}`}>
              Titles in the archive with the closest multi-dimensional craft vector to{' '}
              <strong className={`font-semibold ${isDark ? 'text-[#00D2FF]' : 'text-[#171412]'}`}>{inspectedItem.title}</strong>, ranked by shared narrative tropes, auteurs, cast, and aesthetics.
            </p>

            <div className="space-y-2 pt-1">
              {topRecommendations
                .filter((r) => r.item.id !== inspectedItem.id)
                .slice(0, 20)
                .map(({ item, similarity: s }, rankIdx) => (
                  <div
                    key={item.id}
                    onClick={() => onSelectMedia(item)}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer flex gap-3 items-center group ${
                      isDark
                        ? 'bg-[#121A2B] hover:bg-[#162035] border-[#1C273C] hover:border-[#00D2FF]/40'
                        : 'bg-[#EFE8DA]/50 hover:bg-[#EFE8DA] border-[#D5CCB9]'
                    }`}
                  >
                    <span className={`w-5 text-center font-tabular text-xs font-bold shrink-0 ${
                      isDark ? 'text-[#64748B]' : 'text-[#8C8070]'
                    }`}>
                      #{rankIdx + 1}
                    </span>

                    <div className={`w-10 h-14 rounded overflow-hidden shrink-0 border ${
                      isDark ? 'border-[#1C273C] bg-[#0B101B]' : 'border-[#C8BEAA] bg-[#E5DEC9]'
                    }`}>
                      <img
                        src={item.posterUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = getPosterFallbackDataUri(item);
                        }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-1">
                        <span className={`font-heading text-xs font-bold truncate transition-colors ${
                          isDark ? 'text-[#F0F4FC] group-hover:text-[#00D2FF]' : 'text-[#171412] group-hover:text-[#B8292F]'
                        }`}>
                          {item.title}
                        </span>
                        <span className={`text-[11px] font-tabular font-bold shrink-0 ${
                          isDark ? 'text-[#00D2FF]' : 'text-[#2A6B53]'
                        }`}>
                          {s.totalScore}%
                        </span>
                      </div>

                      <div className={`text-[10px] truncate mt-0.5 ${isDark ? 'text-[#94A3B8]' : 'text-[#6B5E50]'}`}>
                        {item.year} · {item.primaryGenre} · IMDb {item.imdbRating.toFixed(1)}
                      </div>

                      {/* Top shared connection badge */}
                      {s.sharedConnections[0] && (
                        <div className="mt-1 flex items-center gap-1">
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold truncate max-w-[170px]"
                            style={{
                              backgroundColor: `${s.sharedConnections[0].color}15`,
                              color: s.sharedConnections[0].color,
                            }}
                          >
                            {s.sharedConnections[0].prefix}: {s.sharedConnections[0].value}
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMakeFocal(item.id);
                      }}
                      title="Center graph around this title"
                      className={`p-1 rounded border border-transparent transition-colors shrink-0 ${
                        isDark
                          ? 'text-[#94A3B8] hover:text-[#00D2FF] hover:bg-[#0B101B] hover:border-[#1C273C]'
                          : 'text-[#52483E] hover:text-[#B8292F] hover:bg-[#FBF8F2] hover:border-[#C8BEAA]'
                      }`}
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

              {topRecommendations.filter((r) => r.item.id !== inspectedItem.id).length === 0 && (
                <div className={`p-4 text-center text-xs ${isDark ? 'text-[#64748B]' : 'text-[#6B5E50]'}`}>
                  No similar titles found in the active scope.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ==================== OVERVIEW TAB ==================== */
          <>
            {/* HEADER: Title First (no kicker above heading), Metadata & Match Badge Below */}
            <div className={`pb-4 border-b ${isDark ? 'border-[#1C273C]' : 'border-[#D5CCB9]'}`}>
              <div className="flex items-start justify-between gap-2">
                <h1 className={`font-heading text-2xl font-bold leading-tight ${isDark ? 'text-[#F0F4FC]' : 'text-[#171412]'}`}>
                  {inspectedItem.title}
                </h1>

                {isFocal ? (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold shrink-0 mt-0.5 ${
                    isDark ? 'bg-[#FF3366]/20 text-[#FF3366] border border-[#FF3366]/40' : 'bg-[#F5E4E4] text-[#8C1D22] border border-[#D8B4B6]'
                  }`}>
                    <Crosshair className="w-3 h-3" />
                    Focal Center
                  </span>
                ) : focalItem && similarity ? (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold font-tabular shrink-0 mt-0.5 ${
                    isDark ? 'bg-[#00D2FF]/20 text-[#00D2FF] border border-[#00D2FF]/40' : 'bg-[#E3EFEA] text-[#2A6B53] border border-[#B4D4C7]'
                  }`}>
                    {similarity.totalScore}% Match
                  </span>
                ) : (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold shrink-0 mt-0.5 ${
                    isDark ? 'bg-[#121A2B] text-[#94A3B8] border border-[#1C273C]' : 'bg-[#EFE8DA] text-[#52483E] border border-[#C8BEAA]'
                  }`}>
                    Archive Entry
                  </span>
                )}
              </div>

              <div className={`flex items-center flex-wrap gap-2 mt-1.5 text-xs ${isDark ? 'text-[#94A3B8]' : 'text-[#52483E]'}`}>
                <span
                  className={`inline-flex items-center gap-1 font-semibold ${
                    inspectedItem.mediaType === 'MOVIE'
                      ? isDark ? 'text-[#00D2FF]' : 'text-[#234B6E]'
                      : isDark ? 'text-[#FF3366]' : 'text-[#6B3A6E]'
                  }`}
                >
                  {inspectedItem.mediaType === 'MOVIE' ? (
                    <Film className="w-3.5 h-3.5" />
                  ) : (
                    <Tv className="w-3.5 h-3.5" />
                  )}
                  {inspectedItem.mediaType === 'MOVIE' ? 'Feature Film' : 'Series'}
                </span>
                <span className={isDark ? 'text-[#64748B]' : 'text-[#B5A892]'}>·</span>
                <span className="font-tabular font-medium">
                  {inspectedItem.year}
                </span>
                <span className={isDark ? 'text-[#64748B]' : 'text-[#B5A892]'}>·</span>
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
        <div className={`py-4 border-b ${isDark ? 'border-[#1C273C]' : 'border-[#D5CCB9]'}`}>
          <p className={`text-[13px] leading-relaxed ${isDark ? 'text-[#CBD5E1]' : 'text-[#2C2620]'}`}>
            {inspectedItem.synopsis}
          </p>
        </div>

        {/* CLUSTER KINSHIP & SPATIAL SECTOR TELEMETRY */}
        {clusterTelemetry && (
          <section className={`py-4 border-b ${isDark ? 'border-[#1C273C]' : 'border-[#D5CCB9]'}`}>
            <div className="flex items-baseline justify-between mb-2">
              <h2 className={`font-heading text-xs font-bold uppercase tracking-wider ${
                isDark ? 'text-[#94A3B8]' : 'text-[#6B5E50]'
              }`}>
                Cluster Kinship & Sector Telemetry
              </h2>
              <span className={`text-[10px] font-tabular font-semibold ${
                isDark ? 'text-[#00D2FF]' : 'text-[#234B6E]'
              }`}>
                Sector [X:{clusterTelemetry.primary.centroid.x} Y:{clusterTelemetry.primary.centroid.y}]
              </span>
            </div>

            <div className={`p-3 rounded-lg border ${
              isDark ? 'bg-[#0B101B] border-[#1C273C]' : 'bg-[#EFE8DA]/60 border-[#D5CCB9]'
            }`}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: clusterTelemetry.blendedColor }}
                  />
                  <span className={`font-heading text-xs font-bold ${
                    isDark ? 'text-[#F0F4FC]' : 'text-[#171412]'
                  }`}>
                    {clusterTelemetry.primary.label}
                  </span>
                </div>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold font-tabular border"
                  style={{
                    backgroundColor: `${clusterTelemetry.primary.color}18`,
                    color: clusterTelemetry.primary.color,
                    borderColor: `${clusterTelemetry.primary.color}35`,
                  }}
                >
                  {clusterTelemetry.blendRatio > 0.04 && clusterTelemetry.secondary.id !== clusterTelemetry.primary.id
                    ? `${Math.round((1 - clusterTelemetry.blendRatio) * 100)}% Primary Archetype`
                    : '100% Primary Archetype'}
                </span>
              </div>

              <p className={`text-[11px] leading-relaxed mb-2.5 ${
                isDark ? 'text-[#94A3B8]' : 'text-[#52483E]'
              }`}>
                {clusterTelemetry.primary.description}
              </p>

              {/* Soft Boundary Blending Telemetry Bar */}
              {clusterTelemetry.blendRatio > 0.04 && clusterTelemetry.secondary.id !== clusterTelemetry.primary.id && (
                <div className="space-y-1.5 pt-2 border-t border-dashed border-current/15">
                  <div className="flex items-center justify-between text-[10px] font-tabular">
                    <span className={isDark ? 'text-[#94A3B8]' : 'text-[#6B5E50]'}>
                      Soft Boundary Color Interpolation:
                    </span>
                    <span className={`font-semibold ${isDark ? 'text-[#F0F4FC]' : 'text-[#171412]'}`}>
                      {Math.round((1 - clusterTelemetry.blendRatio) * 100)}% {clusterTelemetry.primary.shortLabel} · {Math.round(clusterTelemetry.blendRatio * 100)}% {clusterTelemetry.secondary.shortLabel}
                    </span>
                  </div>
                  <div
                    className="h-2 w-full rounded-full overflow-hidden border border-current/20 shadow-xs"
                    style={{
                      background: `linear-gradient(90deg, ${clusterTelemetry.primary.color} 0%, ${clusterTelemetry.blendedColor} 50%, ${clusterTelemetry.secondary.color} 100%)`,
                    }}
                    role="img"
                    aria-label="Soft boundary cluster kinship gradient"
                  />
                  <div className={`flex justify-between text-[9px] font-tabular ${isDark ? 'text-[#64748B]' : 'text-[#8C8070]'}`}>
                    <span>{clusterTelemetry.primary.shortLabel}</span>
                    <span>Kinship Blend</span>
                    <span>{clusterTelemetry.secondary.shortLabel}</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

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
          <h2 className={`font-heading text-sm font-bold mb-2 ${isDark ? 'text-[#F0F4FC]' : 'text-[#171412]'}`}>
            {focalItem && !isFocal
              ? `Shared Credits & Themes with ${focalItem.title}`
              : 'Key Collaborators'}
          </h2>

          <div className="flex flex-wrap gap-1.5">
            {displayPills.map((pill) => {
              const isClickable = Boolean(pill.entityNodeId);
              return (
                <button
                  key={pill.id}
                  type="button"
                  disabled={!isClickable}
                  onClick={() => {
                    if (pill.entityNodeId) {
                      onSelectEntityNode(pill.entityNodeId);
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border transition-colors text-left ${
                    isClickable ? 'cursor-pointer' : 'cursor-default'
                  } ${
                    isDark
                      ? 'bg-[#121A2B] hover:bg-[#162035] border-[#1C273C] text-[#F0F4FC]'
                      : 'bg-[#EFE8DA] hover:bg-[#E5DEC9] border-[#C8BEAA]'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: pill.color }}
                  />
                  <span className={isDark ? 'text-[#94A3B8]' : 'text-[#52483E]'}>{pill.prefix}:</span>
                  <span className={`font-semibold ${isDark ? 'text-[#F0F4FC]' : 'text-[#171412]'}`}>
                    {pill.value}
                  </span>
                  <span
                    className="text-[11px] font-tabular font-bold ml-0.5"
                    style={{ color: pill.color }}
                  >
                    +{pill.points}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Closest Matches in Graph */}
          <div className={`pt-4 mt-4 border-t ${isDark ? 'border-[#1C273C]' : 'border-[#D5CCB9]'}`}>
            <h3 className={`font-heading text-sm font-bold mb-2 ${isDark ? 'text-[#F0F4FC]' : 'text-[#171412]'}`}>
              {focalItem && !isFocal
                ? `Other Titles Connected to ${focalItem.title}`
                : `Closest Connected Titles to ${inspectedItem.title}`}
            </h3>
            {topRecommendations.filter((r) => r.item.id !== inspectedItem.id)
              .length > 0 ? (
              <div className={`divide-y border-t border-b ${
                isDark ? 'divide-[#1C273C] border-[#1C273C]' : 'divide-[#D5CCB9] border-[#D5CCB9]'
              }`}>
                {topRecommendations
                  .filter((r) => r.item.id !== inspectedItem.id)
                  .slice(0, 5)
                  .map(({ item, similarity: s }) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectMedia(item)}
                      className={`w-full flex items-center justify-between gap-2 py-2 px-1.5 text-left transition-colors cursor-pointer ${
                        isDark ? 'hover:bg-[#162035]' : 'hover:bg-[#EFE8DA]'
                      }`}
                    >
                      <span className={`text-xs font-semibold truncate ${isDark ? 'text-[#F0F4FC]' : 'text-[#171412]'}`}>
                        {item.title}{' '}
                        <span className={`font-normal font-tabular ${isDark ? 'text-[#94A3B8]' : 'text-[#52483E]'}`}>
                          ({item.year})
                        </span>
                      </span>
                      <span className={`text-xs font-tabular font-bold shrink-0 ${isDark ? 'text-[#00D2FF]' : 'text-[#2A6B53]'}`}>
                        {s.totalScore}% Affinity
                      </span>
                    </button>
                  ))}
              </div>
            ) : (
              <div className={`p-3 rounded-lg border text-xs leading-relaxed ${
                isDark ? 'bg-[#121A2B] border-[#1C273C] text-[#94A3B8]' : 'bg-[#EFE8DA]/70 border-[#D5CCB9] text-[#52483E]'
              }`}>
                <p className={`font-semibold mb-0.5 ${isDark ? 'text-[#F0F4FC]' : 'text-[#171412]'}`}>
                  Standalone Archival Node
                </p>
                <p>
                  No verified shared directors, cast members, composers, or
                  specific narrative themes connect{' '}
                  <span className={`font-medium ${isDark ? 'text-[#F0F4FC]' : 'text-[#171412]'}`}>
                    {inspectedItem.title}
                  </span>{' '}
                  to other titles in the current collection above the{' '}
                  match threshold. Click{' '}
                  <span className={`font-semibold ${isDark ? 'text-[#FF3366]' : 'text-[#8C1D22]'}`}>
                    Center Graph Here
                  </span>{' '}
                  below to discover and import its connected constellation.
                </p>
              </div>
            )}
          </div>
        </section>
        </>
        )}
      </div>

      {/* ACTION BUTTONS FOOTER */}
      <div className={`p-3.5 border-t space-y-2 ${
        isDark ? 'bg-[#121A2B] border-[#1C273C]' : 'bg-[#EFE8DA] border-[#D5CCB9]'
      }`}>
        {(onToggleWatched || onToggleInterested || onSuggestFromMedia) && (
          <div className="grid grid-cols-3 gap-1.5">
            {onToggleWatched && (
              <button
                type="button"
                onClick={() => onToggleWatched(inspectedItem.id)}
                className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                  watchedIds.includes(inspectedItem.id)
                    ? isDark
                      ? 'bg-[#00D2FF]/20 text-[#00D2FF] border-[#00D2FF]/40'
                      : 'bg-[#E4F0EA] text-[#1E563F] border-[#B3D4C5]'
                    : isDark
                      ? 'bg-[#0B101B] hover:bg-[#162035] text-[#94A3B8] border-[#1C273C]'
                      : 'bg-[#FBF8F2] hover:bg-[#E5DEC9] text-[#171412] border border-[#B5A892]'
                }`}
              >
                <Check className="w-3 h-3" />
                <span>
                  {watchedIds.includes(inspectedItem.id)
                    ? 'Watched ✓'
                    : 'Watched'}
                </span>
              </button>
            )}

            {onToggleInterested && (
              <button
                type="button"
                onClick={() => onToggleInterested(inspectedItem.id)}
                className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                  interestedIds.includes(inspectedItem.id)
                    ? isDark
                      ? 'bg-[#FF3366]/20 text-[#FF3366] border-[#FF3366]/40'
                      : 'bg-[#E6EEF6] text-[#234B6E] border-[#B6C8DC]'
                    : isDark
                      ? 'bg-[#0B101B] hover:bg-[#162035] text-[#94A3B8] border-[#1C273C]'
                      : 'bg-[#FBF8F2] hover:bg-[#E5DEC9] text-[#171412] border border-[#B5A892]'
                }`}
              >
                <Bookmark className="w-3 h-3" />
                <span>
                  {interestedIds.includes(inspectedItem.id)
                    ? 'Interested ✓'
                    : 'Want to Watch'}
                </span>
              </button>
            )}

            {onSuggestFromMedia && (
              <button
                type="button"
                onClick={() => onSuggestFromMedia(inspectedItem.id)}
                className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-[#00D2FF]/15 text-[#00D2FF] hover:bg-[#00D2FF]/25 border border-[#00D2FF]/30'
                    : 'bg-[#F5E4E4] hover:bg-[#B8292F] text-[#8C1D22] hover:text-[#FBF8F2] border border-[#D8B4B6] hover:border-[#8C1D22]'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>Suggest</span>
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          {isFocal ? (
            <button
              type="button"
              onClick={onClearFocal}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded text-xs font-semibold transition-colors cursor-pointer ${
                isDark
                  ? 'bg-[#0B101B] hover:bg-[#162035] text-[#FF3366] border border-[#1C273C]'
                  : 'bg-[#FBF8F2] hover:bg-[#E5DEC9] text-[#8C1D22] border border-[#D8B4B6]'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Show Full Graph</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onMakeFocal(inspectedItem.id)}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded text-xs font-semibold transition-colors cursor-pointer ${
                isDark
                  ? 'bg-[#00D2FF] hover:bg-[#00B4DB] text-[#0A0E17] font-bold border border-[#00D2FF] shadow-[0_0_12px_rgba(0,210,255,0.3)]'
                  : 'bg-[#B8292F] hover:bg-[#8C1D22] text-[#FBF8F2] border border-[#8C1D22] shadow-archival-sm'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Center Map Here</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onOrbitNode(inspectedItem.id)}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded text-xs font-semibold transition-colors cursor-pointer ${
              isDark
                ? 'bg-[#0B101B] hover:bg-[#162035] text-[#F0F4FC] border border-[#1C273C]'
                : 'bg-[#FBF8F2] hover:bg-[#E5DEC9] text-[#171412] border border-[#B5A892]'
            }`}
          >
            <Compass className={`w-3.5 h-3.5 ${isDark ? 'text-[#00D2FF]' : 'text-[#234B6E]'}`} />
            <span>Focus in Map</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
