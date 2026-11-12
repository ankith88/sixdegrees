'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  RotateCcw,
  Film,
  Tv,
  Award,
  UserCheck,
  Hash,
  Music,
  X,
  Crosshair,
  Loader2,
  CheckCircle2,
  Orbit,
  Network,
  Plus,
  SlidersHorizontal,
  Compass,
  Check,
  User,
  BookmarkCheck,
  Bookmark,
  Sun,
  Moon,
  ArrowLeft,
} from 'lucide-react';
import { SixDegreesLogo } from './SixDegreesLogo';
import { PwaInstallButton } from './PwaInstallButton';
import {
  AppTheme,
  GraphFilterState,
  GraphNode,
  GraphScopeMode,
  MediaItem,
  UserProfile,
  ViewMode,
} from '@/lib/types';
import {
  LiveSearchResult,
  searchLiveCatalog,
} from '@/lib/api';

interface TopNavBarProps {
  nodes: GraphNode[];
  linksCount: number;
  focalItem: MediaItem | null;
  onClearFocal: () => void;
  onResetEverything?: () => void;
  hasActiveSelection?: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onResetPitch: () => void;
  allMediaItems: MediaItem[];
  onSelectNodeById: (nodeId: string) => void;
  onMakeFocal: (mediaId: string) => void;
  onAddLiveMedia?: (target: LiveSearchResult) => Promise<void>;
  onBuildLiveCluster?: (target: LiveSearchResult) => Promise<void>;
  isBuildingCluster?: boolean;
  onToggleMobileMenu?: () => void;
  activeFilterCount?: number;
  watchedIds?: string[];
  onToggleWatched?: (mediaId: string) => void;
  interestedIds?: string[];
  onToggleInterested?: (mediaId: string) => void;
  activeUser?: UserProfile | null;
  graphScope?: GraphScopeMode;
  onGraphScopeChange?: (scope: GraphScopeMode) => void;
  onOpenProfileModal?: () => void;
  layoutMode?: string;
  onLayoutModeChange?: (mode: any) => void;
  matchingMediaCount?: number;
  theme?: AppTheme;
  onThemeChange?: (theme: AppTheme) => void;
  isCatalogOpen?: boolean;
  onToggleCatalog?: () => void;
  graphFilters?: GraphFilterState;
  onGraphFiltersChange?: (next: GraphFilterState) => void;
}

export function TopNavBar({
  nodes,
  linksCount,
  focalItem,
  onClearFocal,
  onResetEverything,
  hasActiveSelection = false,
  viewMode,
  onViewModeChange,
  onResetPitch,
  allMediaItems,
  onSelectNodeById,
  onMakeFocal,
  onAddLiveMedia,
  onBuildLiveCluster,
  isBuildingCluster = false,
  onToggleMobileMenu,
  activeFilterCount = 0,
  watchedIds = [],
  onToggleWatched,
  interestedIds = [],
  onToggleInterested,
  activeUser = null,
  graphScope = 'FULL_ARCHIVE',
  onGraphScopeChange,
  onOpenProfileModal,
  layoutMode = 'SEMANTIC_GALAXY',
  onLayoutModeChange,
  matchingMediaCount,
  theme = 'MOVIE_MAP_DARK',
  onThemeChange,
  isCatalogOpen = false,
  onToggleCatalog,
  graphFilters,
  onGraphFiltersChange,
}: TopNavBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [liveResults, setLiveResults] = useState<LiveSearchResult[]>([]);
  const [isSearchingLive, setIsSearchingLive] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const mobileInputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => inputRef.current?.focus(), 20);
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        !inputRef.current?.contains(target) &&
        !mobileInputRef.current?.contains(target)
      ) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setLiveResults([]);
      setIsSearchingLive(false);
      return;
    }

    let cancelled = false;
    setIsSearchingLive(true);

    const timer = setTimeout(async () => {
      const { results } = await searchLiveCatalog(q);
      if (!cancelled) {
        setLiveResults(results);
        setIsSearchingLive(false);
      }
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const localResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return {
        media: allMediaItems.slice(0, 6),
        entities: nodes
          .filter((n) => n.type === 'DIRECTOR' || n.type === 'ACTOR')
          .slice(0, 5),
      };
    }

    const matchedMedia = allMediaItems.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.directors.some((d) => d.toLowerCase().includes(q)) ||
        m.cast.some((c) => c.name.toLowerCase().includes(q)) ||
        m.tropes.some((t) => t.toLowerCase().includes(q)) ||
        m.composers.some((c) => c.toLowerCase().includes(q))
    );

    const matchedEntities = nodes.filter(
      (n) =>
        (n.type === 'DIRECTOR' || n.type === 'ACTOR') &&
        n.label.toLowerCase().includes(q)
    );

    return {
      media: matchedMedia.slice(0, 5),
      entities: matchedEntities.slice(0, 5),
    };
  }, [query, allMediaItems, nodes]);

  const findExistingMediaMatch = (liveItem: LiveSearchResult): MediaItem | undefined => {
    return allMediaItems.find(
      (m) =>
        (liveItem.imdbId && m.imdbId === liveItem.imdbId) ||
        (liveItem.tmdbId > 0 && m.tmdbId === liveItem.tmdbId && m.mediaType === liveItem.mediaType) ||
        (m.title.toLowerCase() === liveItem.title.toLowerCase() &&
          Math.abs(m.year - liveItem.year) <= 1)
    );
  };

  const mediaNodesCount = useMemo(
    () => nodes.filter((n) => n.type === 'MOVIE' || n.type === 'TV').length,
    [nodes]
  );

  const viewModes: Array<{
    id: ViewMode;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
      {
        id: '3D',
        label: '3D Constellation',
        shortLabel: '3D',
        icon: Orbit,
      },
      {
        id: '2D',
        label: '2D Map',
        shortLabel: '2D',
        icon: Network,
      },
      {
        id: 'SUGGEST',
        label: 'Watch Next',
        shortLabel: 'Suggest',
        icon: Compass,
      },
    ];

  const isDark = theme === 'MOVIE_MAP_DARK';

  return (
    <header
      className={`sticky top-0 left-0 right-0 z-40 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-3 transition-colors pt-[env(safe-area-inset-top,0px)] min-h-[calc(3.5rem+env(safe-area-inset-top,0px))] ${theme === 'MOVIE_MAP_DARK'
          ? 'bg-[#0A0E17]/90 border-b border-white/10 text-[#F0F4FC]'
          : 'bg-[#EFE8DA]/95 border-b border-[#D5CCB9] text-[#171412]'
        }`}
    >
      {/* MOBILE FULL-WIDTH SEARCH BAR (Active on < sm when searchOpen is true) */}
      {searchOpen && (
        <div className="sm:hidden flex items-center gap-2 w-full py-1.5 z-50">
          <button
            type="button"
            onClick={() => {
              setSearchOpen(false);
              setQuery('');
            }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors shrink-0 cursor-pointer ${theme === 'MOVIE_MAP_DARK'
                ? 'bg-[#141C2C] hover:bg-[#1C263A] border-white/10 text-[#F0F4FC]'
                : 'bg-[#FBF8F2] hover:bg-[#E5DEC9] border-[#C8BEAA] text-[#171412]'
              }`}
            aria-label="Back / Close Search"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          </button>

          <div
            className={`flex-1 flex items-center gap-2 h-9 px-3 rounded-lg border transition-all ${theme === 'MOVIE_MAP_DARK'
                ? 'bg-[#141C2C] border-[#00D2FF] ring-2 ring-[#00D2FF]/20 text-[#F0F4FC]'
                : 'bg-[#FBF8F2] border-[#B8292F] ring-2 ring-[#B8292F]/15 text-[#171412]'
              }`}
          >
            {isSearchingLive || isBuildingCluster ? (
              <Loader2
                className={`w-3.5 h-3.5 animate-spin shrink-0 ${theme === 'MOVIE_MAP_DARK' ? 'text-[#00D2FF]' : 'text-[#B8292F]'
                  }`}
                aria-hidden="true"
              />
            ) : (
              <Search
                className={`w-3.5 h-3.5 shrink-0 ${theme === 'MOVIE_MAP_DARK' ? 'text-[#00D2FF]' : 'text-[#B8292F]'
                  }`}
                aria-hidden="true"
              />
            )}
            <input
              ref={mobileInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search films, series, creators, themes..."
              className={`w-full bg-transparent text-xs focus:outline-none font-normal ${theme === 'MOVIE_MAP_DARK'
                  ? 'text-[#F0F4FC] placeholder:text-[#6C7D99]'
                  : 'text-[#171412] placeholder:text-[#6B5E50]'
                }`}
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  mobileInputRef.current?.focus();
                }}
                className={`p-1 rounded cursor-pointer shrink-0 ${isDark ? 'text-white/60 hover:text-white' : 'text-[#6B5E50] hover:text-[#171412]'
                  }`}
                aria-label="Clear search query"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* LEFT: Brand Mark + Desktop Search */}
      <div className={`${searchOpen ? 'hidden sm:flex' : 'flex'} items-center gap-2 sm:gap-3 min-w-0 flex-1 max-w-xl`}>
        <button
          type="button"
          onClick={onResetEverything || onClearFocal}
          className="text-left cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3366] shrink-0"
          title="Reset everything & show full archive"
        >
          <SixDegreesLogo theme={theme} />
        </button>

        {/* Minimal Command Search Bar (Tablet / Desktop inline) */}
        <div
          ref={dropdownRef}
          className="hidden sm:block relative flex-1 min-w-[150px] max-w-sm"
        >
          <div
            onClick={() => {
              setSearchOpen(true);
              inputRef.current?.focus();
            }}
            className={`group flex items-center gap-2 h-9 px-3 rounded-lg border transition-all duration-150 cursor-text ${theme === 'MOVIE_MAP_DARK'
                ? searchOpen
                  ? 'bg-[#141C2C] border-[#00D2FF] ring-2 ring-[#00D2FF]/20 text-[#F0F4FC]'
                  : 'bg-[#101624] border-white/10 hover:border-white/20 text-[#F0F4FC]'
                : searchOpen
                  ? 'bg-[#FBF8F2] border-[#B8292F] ring-2 ring-[#B8292F]/15 text-[#171412]'
                  : 'bg-[#FBF8F2] border-[#C8BEAA] hover:border-[#8F816B] text-[#171412]'
              }`}
          >
            {isSearchingLive || isBuildingCluster ? (
              <Loader2
                className={`w-3.5 h-3.5 animate-spin shrink-0 ${theme === 'MOVIE_MAP_DARK' ? 'text-[#00D2FF]' : 'text-[#B8292F]'
                  }`}
                aria-hidden="true"
              />
            ) : (
              <Search
                className={`w-3.5 h-3.5 shrink-0 transition-colors ${theme === 'MOVIE_MAP_DARK'
                    ? searchOpen
                      ? 'text-[#00D2FF]'
                      : 'text-[#6C7D99] group-hover:text-[#F0F4FC]'
                    : searchOpen
                      ? 'text-[#B8292F]'
                      : 'text-[#6B5E50] group-hover:text-[#171412]'
                  }`}
                aria-hidden="true"
              />
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              placeholder="Search or add films, series, creators, themes... (⌘K)"
              className={`w-full bg-transparent text-xs focus:outline-none font-normal ${theme === 'MOVIE_MAP_DARK'
                  ? 'text-[#F0F4FC] placeholder:text-[#6C7D99]'
                  : 'text-[#171412] placeholder:text-[#6B5E50]'
                }`}
            />
            {query ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className={`p-0.5 rounded cursor-pointer shrink-0 ${isDark ? 'text-white/60 hover:text-white' : 'text-[#6B5E50] hover:text-[#171412]'
                  }`}
                aria-label="Clear search query"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            ) : (
              <kbd className={`hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-tabular border shrink-0 ${isDark
                  ? 'text-white/50 bg-white/10 border-white/15'
                  : 'text-[#52483E] bg-[#EFE8DA] border-[#C8BEAA]'
                }`}>
                ⌘K
              </kbd>
            )}
          </div>

          {/* Mobile Search Backdrop */}
          {searchOpen && (
            <div
              className="sm:hidden fixed inset-0 top-[calc(3.5rem+env(safe-area-inset-top,0px))] bg-[#0A0E17]/60 backdrop-blur-xs z-40"
              onClick={() => setSearchOpen(false)}
              aria-hidden="true"
            />
          )}

          {/* Search Results Popover */}
          {searchOpen && (
            <div
              role="region"
              aria-label="Search results"
              className={`fixed sm:absolute inset-x-2 sm:inset-x-auto sm:left-0 sm:right-auto sm:w-[440px] top-[calc(3.5rem+env(safe-area-inset-top,0px)+0.35rem)] sm:top-11 rounded-2xl sm:rounded-xl shadow-2xl p-2.5 max-h-[calc(85dvh-4rem)] sm:max-h-[440px] overflow-y-auto z-50 space-y-2.5 border backdrop-blur-md ${isDark
                  ? 'bg-[#0E1524]/95 border-white/15 text-[#F0F4FC] shadow-black/70'
                  : 'bg-[#FBF8F2] border-[#B5A892] text-[#171412] shadow-2xl'
                }`}
            >
              {/* Worldwide Catalog Results */}
              {query.trim().length >= 2 && (
                <div className={`pb-2 border-b ${isDark ? 'border-white/10' : 'border-[#D5CCB9]'}`}>
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className={`text-[10px] font-bold uppercase tracking-[0.08em] ${isDark ? 'text-cyan-400' : 'text-[#2A6B53]'
                      }`}>
                      Worldwide Catalog
                    </span>
                    {isSearchingLive && (
                      <span className={`text-[11px] inline-flex items-center gap-1 ${isDark ? 'text-white/60' : 'text-[#52483E]'
                        }`}>
                        <Loader2 className={`w-3 h-3 animate-spin ${isDark ? 'text-cyan-400' : 'text-[#B8292F]'}`} aria-hidden="true" />
                        Searching…
                      </span>
                    )}
                  </div>

                  {liveResults.length > 0 ? (
                    <div className="space-y-0.5">
                      {liveResults.map((liveItem) => {
                        const existingMatch = findExistingMediaMatch(liveItem);
                        return (
                          <div
                            key={`${liveItem.source}-${liveItem.id}-${liveItem.imdbId}`}
                            onClick={async () => {
                              setSearchOpen(false);
                              if (existingMatch) {
                                onSelectNodeById(existingMatch.id);
                              } else if (onAddLiveMedia) {
                                await onAddLiveMedia(liveItem);
                              } else if (onBuildLiveCluster) {
                                await onBuildLiveCluster(liveItem);
                              }
                            }}
                            className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors group ${isDark
                                ? 'hover:bg-white/10 text-white'
                                : 'hover:bg-[#EFE8DA] text-[#171412]'
                              }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {liveItem.posterUrl ? (
                                <img
                                  src={liveItem.posterUrl}
                                  alt=""
                                  className={`w-7 h-10 rounded object-cover shrink-0 border ${isDark ? 'border-white/15' : 'border-[#C8BEAA]'
                                    }`}
                                />
                              ) : liveItem.mediaType === 'MOVIE' ? (
                                <Film className={`w-4 h-4 shrink-0 ${isDark ? 'text-[#00D2FF]' : 'text-[#234B6E]'}`} aria-hidden="true" />
                              ) : (
                                <Tv className={`w-4 h-4 shrink-0 ${isDark ? 'text-[#FF3366]' : 'text-[#6B3A6E]'}`} aria-hidden="true" />
                              )}
                              <div className="min-w-0">
                                <div className={`text-xs font-semibold truncate flex items-center gap-1.5 ${isDark ? 'text-[#F0F4FC]' : 'text-[#171412]'
                                  }`}>
                                  <span className="truncate">{liveItem.title}</span>
                                  <span className={`font-normal font-tabular text-[11px] shrink-0 ${isDark ? 'text-white/60' : 'text-[#52483E]'
                                    }`}>
                                    ({liveItem.year})
                                  </span>
                                </div>
                                <div className={`text-[11px] truncate ${isDark ? 'text-white/60' : 'text-[#52483E]'}`}>
                                  {liveItem.mediaType === 'MOVIE' ? 'Film' : 'Series'}
                                  {liveItem.stars ? ` · ${liveItem.stars}` : ''}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {existingMatch ? (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${isDark
                                    ? 'bg-[#1E563F]/40 text-[#8CE8C3] border-[#2A6B53]'
                                    : 'bg-[#E4F0EA] text-[#1E563F] border-[#B3D4C5]'
                                  }`}>
                                  <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                                  In Graph
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setSearchOpen(false);
                                    if (onAddLiveMedia) {
                                      await onAddLiveMedia(liveItem);
                                    }
                                  }}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer border ${isDark
                                      ? 'bg-white/10 group-hover:bg-cyan-500 text-white group-hover:text-[#0A0E17] border-white/20 group-hover:border-cyan-400'
                                      : 'bg-[#FBF8F2] group-hover:bg-[#B8292F] text-[#171412] group-hover:text-[#FBF8F2] border-[#C8BEAA] group-hover:border-[#8C1D22]'
                                    }`}
                                  title="Add only this title to the graph"
                                >
                                  <Plus className="w-3 h-3" aria-hidden="true" />
                                  Add
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : !isSearchingLive ? (
                    <div className={`px-2 py-1.5 text-xs ${isDark ? 'text-white/60' : 'text-[#6B5E50]'}`}>
                      No catalog matches found for &ldquo;{query}&rdquo;.
                    </div>
                  ) : null}
                </div>
              )}

              {/* In This Collection */}
              <div>
                <div className={`text-[10px] font-bold uppercase tracking-[0.08em] px-2 py-1 ${isDark ? 'text-white/50' : 'text-[#52483E]'
                  }`}>
                  In This Collection ({localResults.media.length})
                </div>
                {localResults.media.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      onSelectNodeById(item.id);
                      setSearchOpen(false);
                    }}
                    className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-[#EFE8DA] text-[#171412]'
                      }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {item.mediaType === 'MOVIE' ? (
                        <Film className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-[#00D2FF]' : 'text-[#234B6E]'}`} aria-hidden="true" />
                      ) : (
                        <Tv className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-[#FF3366]' : 'text-[#6B3A6E]'}`} aria-hidden="true" />
                      )}
                      <div className="min-w-0">
                        <div className={`text-xs font-semibold truncate ${isDark ? 'text-[#F0F4FC]' : 'text-[#171412]'
                          }`}>
                          {item.title}{' '}
                          <span className={`font-normal font-tabular ${isDark ? 'text-white/50' : 'text-[#52483E]'
                            }`}>
                            ({item.year})
                          </span>
                        </div>
                        <div className={`text-[11px] truncate ${isDark ? 'text-white/60' : 'text-[#52483E]'
                          }`}>
                          {item.directors[0] || item.primaryGenre} · IMDb{' '}
                          {item.imdbRating.toFixed(1)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {onToggleInterested && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleInterested(item.id);
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${interestedIds.includes(item.id)
                              ? isDark
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                : 'bg-[#E6EEF6] text-[#234B6E] border-[#B6C8DC]'
                              : isDark
                                ? 'bg-white/5 text-white/70 border-white/10 hover:text-white hover:bg-white/10'
                                : 'bg-[#FBF8F2] text-[#52483E] border-[#C8BEAA] hover:text-[#171412]'
                            }`}
                          title={
                            interestedIds.includes(item.id)
                              ? 'In Want to Watch / Interested list'
                              : 'Save to Want to Watch / Interested list'
                          }
                        >
                          <Bookmark className="w-2.5 h-2.5" aria-hidden="true" />
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
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${watchedIds.includes(item.id)
                              ? isDark
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-[#E4F0EA] text-[#1E563F] border-[#B3D4C5]'
                              : isDark
                                ? 'bg-white/5 text-white/70 border-white/10 hover:text-white hover:bg-white/10'
                                : 'bg-[#FBF8F2] text-[#52483E] border-[#C8BEAA] hover:text-[#171412]'
                            }`}
                          title={
                            watchedIds.includes(item.id)
                              ? 'Marked as Watched'
                              : 'Mark as Watched for suggestions'
                          }
                        >
                          <Check className="w-2.5 h-2.5" aria-hidden="true" />
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
                          setSearchOpen(false);
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold border shrink-0 transition-colors cursor-pointer ${isDark
                            ? 'bg-white/10 hover:bg-cyan-500 text-white hover:text-[#0A0E17] border-white/15 hover:border-cyan-400'
                            : 'bg-[#EFE8DA] text-[#171412] border-[#C8BEAA] hover:bg-[#B8292F] hover:text-[#FBF8F2] hover:border-[#8C1D22]'
                          }`}
                      >
                        <Crosshair className="w-2.5 h-2.5" aria-hidden="true" />
                        Center
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Shared Collaborators */}
              {localResults.entities.length > 0 && (
                <div className={`pt-1.5 border-t ${isDark ? 'border-white/10' : 'border-[#D5CCB9]'}`}>
                  <div className={`text-[10px] font-bold uppercase tracking-[0.08em] px-2 py-1 ${isDark ? 'text-white/50' : 'text-[#52483E]'
                    }`}>
                    Collaborators ({localResults.entities.length})
                  </div>
                  {localResults.entities.map((ent) => (
                    <div
                      key={ent.id}
                      onClick={() => {
                        onSelectNodeById(ent.id);
                        setSearchOpen(false);
                      }}
                      className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-[#EFE8DA] text-[#171412]'
                        }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {ent.type === 'DIRECTOR' && (
                          <Award className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-[#FF3366]' : 'text-[#B8292F]'}`} aria-hidden="true" />
                        )}
                        {ent.type === 'ACTOR' && (
                          <UserCheck className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-[#00D2FF]' : 'text-[#B86B14]'}`} aria-hidden="true" />
                        )}
                        <span className={`text-xs font-medium truncate ${isDark ? 'text-[#F0F4FC]' : 'text-[#171412]'
                          }`}>
                          {ent.label}
                        </span>
                      </div>
                      <span className={`text-[11px] font-tabular shrink-0 ${isDark ? 'text-white/50' : 'text-[#52483E]'
                        }`}>
                        {ent.subLabel}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CENTER: Minimal View Mode Switcher */}
      <nav
        aria-label="View Modes"
        className={`hidden md:flex items-center gap-1 p-1 rounded-lg border shrink-0 transition-colors ${theme === 'MOVIE_MAP_DARK'
            ? 'bg-[#101624] border-white/10'
            : 'bg-[#E5DEC9] border-[#C8BEAA]'
          }`}
      >
        {viewModes.map((mode) => {
          const Icon = mode.icon;
          const active = viewMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              aria-pressed={active}
              onClick={() => onViewModeChange(mode.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8292F] ${active
                  ? theme === 'MOVIE_MAP_DARK'
                    ? 'bg-[#162035] text-[#00D2FF] border border-[#00D2FF]/40 shadow-[0_0_8px_rgba(0,210,255,0.2)]'
                    : 'bg-[#FBF8F2] text-[#171412] border border-[#B5A892] shadow-archival-sm'
                  : theme === 'MOVIE_MAP_DARK'
                    ? 'text-[#94A3B8] hover:text-[#F0F4FC] border border-transparent'
                    : 'text-[#52483E] hover:text-[#171412] border border-transparent'
                }`}
            >
              <Icon
                className={`w-3.5 h-3.5 shrink-0 ${active
                    ? theme === 'MOVIE_MAP_DARK'
                      ? 'text-[#00D2FF]'
                      : 'text-[#B8292F]'
                    : theme === 'MOVIE_MAP_DARK'
                      ? 'text-[#64748B]'
                      : 'text-[#6B5E50]'
                  }`}
                aria-hidden="true"
              />
              <span className="hidden lg:inline">{mode.label}</span>
              <span className="lg:hidden">{mode.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* RIGHT: Grouped into Context & Discovery, Curator & Lists, and App Utilities */}
      <div className={`${searchOpen ? 'hidden sm:flex' : 'flex'} items-center gap-2 sm:gap-2.5 shrink-0`}>
        {/* Mobile Search Trigger Icon Button */}
        <button
          type="button"
          onClick={() => {
            setSearchOpen(true);
            setTimeout(() => mobileInputRef.current?.focus(), 60);
          }}
          className={`sm:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors cursor-pointer shrink-0 ${theme === 'MOVIE_MAP_DARK'
              ? 'bg-[#101624] hover:bg-[#162035] text-[#94A3B8] border-white/10'
              : 'bg-[#FBF8F2] hover:bg-[#E5DEC9] text-[#171412] border-[#C8BEAA]'
            }`}
          aria-label="Search"
          title="Search or add titles (⌘K)"
        >
          <Search className="w-3.5 h-3.5" aria-hidden="true" />
        </button>

        {/* 1. Context & Discovery Group: Focal Pill + Reset */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Active Focal Filter Pill */}
          {focalItem && (
            <button
              type="button"
              onClick={onClearFocal}
              className={`inline-flex items-center gap-1 sm:gap-1.5 h-8 px-2 sm:px-2.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer shrink-0 ${theme === 'MOVIE_MAP_DARK'
                  ? 'bg-[#FF3366]/20 text-[#FF3366] border-[#FF3366]/40 hover:bg-[#FF3366]/30'
                  : 'bg-[#F5E4E4] text-[#8C1D22] border-[#D8B4B6] hover:bg-[#B8292F] hover:text-[#FBF8F2]'
                }`}
              title={`Centered on "${focalItem.title}" — Click to clear and show full archive`}
            >
              <Crosshair className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span className="max-w-[70px] sm:max-w-[110px] truncate">{focalItem.title}</span>
              <X className="w-3 h-3 shrink-0 opacity-70 hover:opacity-100" aria-hidden="true" />
            </button>
          )}

          {/* Reset Action */}
          <button
            type="button"
            onClick={() => {
              if (onResetEverything) {
                onResetEverything();
              } else {
                onClearFocal();
                onResetPitch();
              }
            }}
            className={`group inline-flex items-center justify-center sm:gap-1.5 h-8 w-8 sm:w-auto px-0 sm:px-2.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3366] ${hasActiveSelection ||
                focalItem ||
                activeFilterCount > 0 ||
                graphScope !== 'FULL_ARCHIVE'
                ? theme === 'MOVIE_MAP_DARK'
                  ? 'bg-[#FF3366] text-[#0A0E17] border-[#FF3366] font-bold shadow-[0_0_10px_rgba(255,51,102,0.3)]'
                  : 'bg-[#B8292F] hover:bg-[#8C1D22] text-[#FBF8F2] border-[#8C1D22] shadow-archival-sm'
                : theme === 'MOVIE_MAP_DARK'
                  ? 'bg-[#101624] hover:bg-[#162035] text-[#94A3B8] hover:text-[#F0F4FC] border-white/10'
                  : 'bg-[#FBF8F2] hover:bg-[#E5DEC9] text-[#52483E] hover:text-[#171412] border-[#C8BEAA]'
              }`}
            title="Reset selection, filters, and camera to show the full graph"
          >
            <RotateCcw
              className="w-3.5 h-3.5 group-hover:-rotate-45 transition-transform duration-200"
              aria-hidden="true"
            />
            <span className="hidden md:inline">
              {hasActiveSelection ||
                focalItem ||
                activeFilterCount > 0 ||
                graphScope !== 'FULL_ARCHIVE'
                ? 'Reset All'
                : 'Reset'}
            </span>
          </button>
        </div>

        {/* Vertical Separator */}
        <div
          className={`hidden sm:block h-4 w-px ${theme === 'MOVIE_MAP_DARK' ? 'bg-white/15' : 'bg-[#D5CCB9]'
            }`}
          aria-hidden="true"
        />

        {/* 2. Curator & Personal Lists Group */}
        {activeUser && onGraphScopeChange ? (
          <div
            className={`hidden sm:inline-flex items-center p-0.5 rounded-lg border gap-0.5 ${theme === 'MOVIE_MAP_DARK'
                ? 'bg-[#101624] border-white/10'
                : 'bg-[#E5DEC9]/70 border-[#C8BEAA]'
              }`}
          >
            <button
              type="button"
              onClick={() => {
                if (onGraphFiltersChange && graphFilters) {
                  onGraphFiltersChange({
                    ...graphFilters,
                    watchedFilter:
                      graphFilters.watchedFilter === 'WATCHED' ? 'ALL' : 'WATCHED',
                  });
                  if (graphScope !== 'FULL_ARCHIVE' && onGraphScopeChange) {
                    onGraphScopeChange('FULL_ARCHIVE');
                  }
                } else if (onGraphScopeChange) {
                  const nextScope: GraphScopeMode =
                    graphScope === 'WATCHED_ONLY' ? 'FULL_ARCHIVE' : 'WATCHED_ONLY';
                  onGraphScopeChange(nextScope);
                }
                if (viewMode === 'SUGGEST') {
                  onViewModeChange('3D');
                }
              }}
              aria-pressed={
                graphFilters?.watchedFilter === 'WATCHED' ||
                graphScope === 'WATCHED_ONLY'
              }
              className={`inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${graphFilters?.watchedFilter === 'WATCHED' ||
                  graphScope === 'WATCHED_ONLY'
                  ? theme === 'MOVIE_MAP_DARK'
                    ? 'bg-[#10B981]/25 text-[#10B981] border border-[#10B981]/50 shadow-xs'
                    : 'bg-[#2A6B53] text-[#FBF8F2] shadow-xs'
                  : theme === 'MOVIE_MAP_DARK'
                    ? 'text-[#94A3B8] hover:text-[#F0F4FC] hover:bg-white/5'
                    : 'text-[#1E563F] hover:bg-[#FBF8F2]'
                }`}
              title="Highlight Watched titles"
            >
              <BookmarkCheck className="w-3 h-3" aria-hidden="true" />
              <span className="font-tabular">{watchedIds.length}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onGraphFiltersChange && graphFilters) {
                  onGraphFiltersChange({
                    ...graphFilters,
                    watchedFilter:
                      graphFilters.watchedFilter === 'INTERESTED'
                        ? 'ALL'
                        : 'INTERESTED',
                  });
                  if (graphScope !== 'FULL_ARCHIVE' && onGraphScopeChange) {
                    onGraphScopeChange('FULL_ARCHIVE');
                  }
                } else if (onGraphScopeChange) {
                  const nextScope: GraphScopeMode =
                    graphScope === 'INTERESTED_ONLY'
                      ? 'FULL_ARCHIVE'
                      : 'INTERESTED_ONLY';
                  onGraphScopeChange(nextScope);
                }
                if (viewMode === 'SUGGEST') {
                  onViewModeChange('3D');
                }
              }}
              aria-pressed={
                graphFilters?.watchedFilter === 'INTERESTED' ||
                graphScope === 'INTERESTED_ONLY'
              }
              className={`inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${graphFilters?.watchedFilter === 'INTERESTED' ||
                  graphScope === 'INTERESTED_ONLY'
                  ? theme === 'MOVIE_MAP_DARK'
                    ? 'bg-[#F59E0B]/25 text-[#F59E0B] border border-[#F59E0B]/50 shadow-xs'
                    : 'bg-[#B45309] text-[#FBF8F2] shadow-xs'
                  : theme === 'MOVIE_MAP_DARK'
                    ? 'text-[#94A3B8] hover:text-[#F0F4FC] hover:bg-white/5'
                    : 'text-[#234B6E] hover:bg-[#FBF8F2]'
                }`}
              title="Highlight Want to Watch titles"
            >
              <Bookmark className="w-3 h-3" aria-hidden="true" />
              <span className="font-tabular">{interestedIds.length}</span>
            </button>

            {onOpenProfileModal && (
              <button
                type="button"
                onClick={onOpenProfileModal}
                className={`inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-semibold transition-colors cursor-pointer ${theme === 'MOVIE_MAP_DARK'
                    ? 'text-[#F0F4FC] hover:bg-white/10'
                    : 'text-[#171412] hover:bg-[#FBF8F2]'
                  }`}
                title={`Signed in as ${activeUser.displayName} (@${activeUser.handle}) — Click to manage profile & lists`}
              >
                <span
                  className="w-4 h-4 rounded-full text-[10px] font-bold text-[#FBF8F2] flex items-center justify-center shrink-0"
                  style={{ backgroundColor: activeUser.avatarColor }}
                >
                  {activeUser.displayName.slice(0, 1).toUpperCase()}
                </span>
                <span className="max-w-[80px] truncate hidden xl:inline">
                  {activeUser.displayName}
                </span>
              </button>
            )}
          </div>
        ) : onOpenProfileModal ? (
          <button
            type="button"
            onClick={onOpenProfileModal}
            className={`inline-flex items-center justify-center sm:gap-1.5 h-8 px-2 sm:px-2.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer shrink-0 ${theme === 'MOVIE_MAP_DARK'
                ? 'bg-[#101624] hover:bg-[#162035] text-[#94A3B8] hover:text-[#F0F4FC] border-white/10'
                : 'bg-[#FBF8F2] hover:bg-[#EFE8DA] text-[#52483E] hover:text-[#171412] border-[#C8BEAA]'
              }`}
            title="Sign in to access your Watchlist and personal graphs"
          >
            <User className="w-3.5 h-3.5 text-[#B8292F] shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Sign In</span>
          </button>
        ) : null}

        {/* Vertical Separator */}
        <div
          className={`hidden sm:block h-4 w-px ${theme === 'MOVIE_MAP_DARK' ? 'bg-white/15' : 'bg-[#D5CCB9]'
            }`}
          aria-hidden="true"
        />

        {/* 3. Global App Utilities Group: Theme + Install */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onThemeChange && (
            <button
              type="button"
              onClick={() =>
                onThemeChange(
                  theme === 'MOVIE_MAP_DARK' ? 'ARCHIVAL_FOLIO' : 'MOVIE_MAP_DARK'
                )
              }
              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-semibold border transition-all cursor-pointer shrink-0 ${theme === 'MOVIE_MAP_DARK'
                  ? 'bg-[#141C2C] hover:bg-[#1C263A] text-[#00D2FF] border-[#00D2FF]/30 shadow-sm'
                  : 'bg-[#FBF8F2] hover:bg-[#EFE8DA] text-[#B8292F] border-[#C8BEAA]'
                }`}
              aria-label={
                theme === 'MOVIE_MAP_DARK'
                  ? 'Switch to Archival Folio light theme'
                  : 'Switch to Movie Map dark theme'
              }
              title={
                theme === 'MOVIE_MAP_DARK'
                  ? 'Switch to Archival Folio theme'
                  : 'Switch to Movie Map Dark theme'
              }
            >
              {theme === 'MOVIE_MAP_DARK' ? (
                <Moon className="w-3.5 h-3.5 text-[#00D2FF]" aria-hidden="true" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-[#B8292F]" aria-hidden="true" />
              )}
            </button>
          )}

          {/* PWA Install Button (Compact on Desktop) */}
          <div className="hidden xl:inline-flex shrink-0">
            <PwaInstallButton variant="topbar" />
          </div>
        </div>
      </div>
    </header>
  );
}
