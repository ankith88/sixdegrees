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
  TableProperties,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Check,
  User,
  BookmarkCheck,
  Bookmark,
  Sun,
  Moon,
} from 'lucide-react';
import { SixDegreesLogo } from './SixDegreesLogo';
import { PwaInstallButton } from './PwaInstallButton';
import {
  AppTheme,
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
}: TopNavBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [liveResults, setLiveResults] = useState<LiveSearchResult[]>([]);
  const [isSearchingLive, setIsSearchingLive] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
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
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
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
          .filter((n) => n.type !== 'MOVIE' && n.type !== 'TV')
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
        n.type !== 'MOVIE' &&
        n.type !== 'TV' &&
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
      id: 'MATRIX',
      label: 'Critical Ledger',
      shortLabel: 'Ledger',
      icon: TableProperties,
    },
    {
      id: 'SUGGEST',
      label: 'Watch Next',
      shortLabel: 'Suggest',
      icon: Sparkles,
    },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 h-14 z-40 backdrop-blur-md px-4 flex items-center justify-between gap-3 transition-colors ${
        theme === 'MOVIE_MAP_DARK'
          ? 'bg-[#0A0E17]/88 border-b border-white/10 text-[#F0F4FC]'
          : 'bg-[#EFE8DA]/95 border-b border-[#D5CCB9] text-[#171412]'
      }`}
    >
      {/* LEFT: Mobile Menu Trigger + Brand Mark + Search */}
      <div className="flex items-center gap-3 min-w-0 flex-1 max-w-xl">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className={`lg:hidden relative inline-flex items-center justify-center w-8 h-8 rounded-md border transition-colors cursor-pointer shrink-0 ${
              theme === 'MOVIE_MAP_DARK'
                ? 'bg-[#141C2C] hover:bg-[#1C263A] border-white/10 text-[#F0F4FC]'
                : 'bg-[#FBF8F2] hover:bg-[#E5DEC9] border-[#C8BEAA] text-[#171412]'
            }`}
            aria-label="Open Curatorial Menu"
          >
            <SlidersHorizontal className="w-4 h-4 text-inherit opacity-75" aria-hidden="true" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#FF3366] text-[#FFFFFF] text-[9px] font-tabular font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={onResetEverything || onClearFocal}
          className="text-left cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3366] shrink-0"
          title="Reset everything & show full archive"
        >
          <SixDegreesLogo theme={theme} />
        </button>

        {/* Minimal Command Search Bar */}
        <div
          ref={dropdownRef}
          className="relative flex-1 min-w-[150px] max-w-sm"
        >
          <div
            onClick={() => {
              setSearchOpen(true);
              inputRef.current?.focus();
            }}
            className={`group flex items-center gap-2 h-9 px-3 rounded-lg border transition-all duration-150 cursor-text ${
              theme === 'MOVIE_MAP_DARK'
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
                className={`w-3.5 h-3.5 animate-spin shrink-0 ${
                  theme === 'MOVIE_MAP_DARK' ? 'text-[#00D2FF]' : 'text-[#B8292F]'
                }`}
                aria-hidden="true"
              />
            ) : (
              <Search
                className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                  theme === 'MOVIE_MAP_DARK'
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
              className={`w-full bg-transparent text-xs focus:outline-none font-normal ${
                theme === 'MOVIE_MAP_DARK'
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
                className="p-0.5 rounded text-[#6B5E50] hover:text-[#171412] cursor-pointer shrink-0"
                aria-label="Clear search query"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-tabular text-[#52483E] bg-[#EFE8DA] border border-[#C8BEAA] shrink-0">
                ⌘K
              </kbd>
            )}
          </div>

          {/* Search Results Popover */}
          {searchOpen && (
            <div
              role="region"
              aria-label="Search results"
              className="absolute left-0 right-0 sm:w-[440px] top-11 rounded-xl bg-[#FBF8F2] border border-[#B5A892] shadow-archival p-2.5 max-h-[440px] overflow-y-auto z-50 space-y-2.5"
            >
              {/* Worldwide Catalog Results */}
              {query.trim().length >= 2 && (
                <div className="pb-2 border-b border-[#D5CCB9]">
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#2A6B53]">
                      Worldwide Catalog
                    </span>
                    {isSearchingLive && (
                      <span className="text-[11px] text-[#52483E] inline-flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin text-[#B8292F]" aria-hidden="true" />
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
                            className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[#EFE8DA] cursor-pointer transition-colors group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {liveItem.posterUrl ? (
                                <img
                                  src={liveItem.posterUrl}
                                  alt=""
                                  className="w-7 h-10 rounded object-cover shrink-0 border border-[#C8BEAA]"
                                />
                              ) : liveItem.mediaType === 'MOVIE' ? (
                                <Film className="w-4 h-4 text-[#234B6E] shrink-0" aria-hidden="true" />
                              ) : (
                                <Tv className="w-4 h-4 text-[#6B3A6E] shrink-0" aria-hidden="true" />
                              )}
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-[#171412] truncate flex items-center gap-1.5">
                                  <span className="truncate">{liveItem.title}</span>
                                  <span className="text-[#52483E] font-normal font-tabular text-[11px] shrink-0">
                                    ({liveItem.year})
                                  </span>
                                </div>
                                <div className="text-[11px] text-[#52483E] truncate">
                                  {liveItem.mediaType === 'MOVIE' ? 'Film' : 'Series'}
                                  {liveItem.stars ? ` · ${liveItem.stars}` : ''}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {existingMatch ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#E4F0EA] text-[#1E563F] border border-[#B3D4C5]">
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
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-[#FBF8F2] group-hover:bg-[#B8292F] text-[#171412] group-hover:text-[#FBF8F2] border border-[#C8BEAA] group-hover:border-[#8C1D22] transition-colors cursor-pointer"
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
                    <div className="px-2 py-1.5 text-xs text-[#6B5E50]">
                      No catalog matches found for &ldquo;{query}&rdquo;.
                    </div>
                  ) : null}
                </div>
              )}

              {/* In This Collection */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#52483E] px-2 py-1">
                  In This Collection ({localResults.media.length})
                </div>
                {localResults.media.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      onSelectNodeById(item.id);
                      setSearchOpen(false);
                    }}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[#EFE8DA] cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {item.mediaType === 'MOVIE' ? (
                        <Film className="w-3.5 h-3.5 text-[#234B6E] shrink-0" aria-hidden="true" />
                      ) : (
                        <Tv className="w-3.5 h-3.5 text-[#6B3A6E] shrink-0" aria-hidden="true" />
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#171412] truncate">
                          {item.title}{' '}
                          <span className="text-[#52483E] font-normal font-tabular">
                            ({item.year})
                          </span>
                        </div>
                        <div className="text-[11px] text-[#52483E] truncate">
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
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                            interestedIds.includes(item.id)
                              ? 'bg-[#E6EEF6] text-[#234B6E] border-[#B6C8DC]'
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
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                            watchedIds.includes(item.id)
                              ? 'bg-[#E4F0EA] text-[#1E563F] border-[#B3D4C5]'
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
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-[#EFE8DA] text-[#171412] border border-[#C8BEAA] hover:bg-[#B8292F] hover:text-[#FBF8F2] hover:border-[#8C1D22] transition-colors shrink-0 cursor-pointer"
                      >
                        <Crosshair className="w-2.5 h-2.5" aria-hidden="true" />
                        Center
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Shared Collaborators & Themes */}
              {localResults.entities.length > 0 && (
                <div className="pt-1.5 border-t border-[#D5CCB9]">
                  <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#52483E] px-2 py-1">
                    Collaborators &amp; Themes ({localResults.entities.length})
                  </div>
                  {localResults.entities.map((ent) => (
                    <div
                      key={ent.id}
                      onClick={() => {
                        onSelectNodeById(ent.id);
                        setSearchOpen(false);
                      }}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[#EFE8DA] cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {ent.type === 'DIRECTOR' && (
                          <Award className="w-3.5 h-3.5 text-[#B8292F] shrink-0" aria-hidden="true" />
                        )}
                        {ent.type === 'ACTOR' && (
                          <UserCheck className="w-3.5 h-3.5 text-[#B86B14] shrink-0" aria-hidden="true" />
                        )}
                        {ent.type === 'TROPE' && (
                          <Hash className="w-3.5 h-3.5 text-[#2A6B53] shrink-0" aria-hidden="true" />
                        )}
                        {ent.type === 'COMPOSER' && (
                          <Music className="w-3.5 h-3.5 text-[#A63A2B] shrink-0" aria-hidden="true" />
                        )}
                        <span className="text-xs font-medium text-[#171412] truncate">
                          {ent.label}
                        </span>
                      </div>
                      <span className="text-[11px] font-tabular text-[#52483E] shrink-0">
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
        className="hidden md:flex items-center gap-1 p-1 rounded-lg bg-[#E5DEC9] border border-[#C8BEAA] shrink-0"
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
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8292F] ${
                active
                  ? 'bg-[#FBF8F2] text-[#171412] border border-[#B5A892] shadow-archival-sm'
                  : 'text-[#52483E] hover:text-[#171412] border border-transparent'
              }`}
            >
              <Icon
                className={`w-3.5 h-3.5 shrink-0 ${
                  active ? 'text-[#B8292F]' : 'text-[#6B5E50]'
                }`}
                aria-hidden="true"
              />
              <span className="hidden lg:inline">{mode.label}</span>
              <span className="lg:hidden">{mode.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* RIGHT: Personal Watched / Interested Graph Toggles (Logged-in Users Only) + User Profile + Counts + Reset View */}
      <div className="flex items-center gap-1.5 shrink-0">
        {activeUser && onGraphScopeChange && (
          <>
            <button
              type="button"
              onClick={() => {
                const nextScope: GraphScopeMode =
                  graphScope === 'WATCHED_ONLY' ? 'FULL_ARCHIVE' : 'WATCHED_ONLY';
                onGraphScopeChange(nextScope);
                if (viewMode === 'SUGGEST') {
                  onViewModeChange('3D');
                }
              }}
              aria-pressed={graphScope === 'WATCHED_ONLY'}
              className={`hidden sm:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                graphScope === 'WATCHED_ONLY'
                  ? 'bg-[#2A6B53] hover:bg-[#1E563F] text-[#FBF8F2] border-[#1E563F] shadow-archival-sm'
                  : 'bg-[#FBF8F2] hover:bg-[#E4F0EA] text-[#1E563F] border-[#B3D4C5]'
              }`}
              title={
                graphScope === 'WATCHED_ONLY'
                  ? 'Viewing My Watched Graph — click to return to Full Archive'
                  : 'Switch 3D/2D constellation to only Movies & TV Shows you have watched'
              }
            >
              <BookmarkCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Watched ({watchedIds.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const nextScope: GraphScopeMode =
                  graphScope === 'INTERESTED_ONLY'
                    ? 'FULL_ARCHIVE'
                    : 'INTERESTED_ONLY';
                onGraphScopeChange(nextScope);
                if (viewMode === 'SUGGEST') {
                  onViewModeChange('3D');
                }
              }}
              aria-pressed={graphScope === 'INTERESTED_ONLY'}
              className={`hidden md:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                graphScope === 'INTERESTED_ONLY'
                  ? 'bg-[#234B6E] hover:bg-[#193854] text-[#FBF8F2] border-[#193854] shadow-archival-sm'
                  : 'bg-[#FBF8F2] hover:bg-[#E6EEF6] text-[#234B6E] border-[#B6C8DC]'
              }`}
              title={
                graphScope === 'INTERESTED_ONLY'
                  ? 'Viewing My Interested / Want to Watch Graph — click to return to Full Archive'
                  : 'Switch 3D/2D constellation to your Interested / Want to Watch list'
              }
            >
              <Bookmark className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Interested ({interestedIds.length})</span>
            </button>
          </>
        )}

        {onOpenProfileModal && (
          <button
            type="button"
            onClick={onOpenProfileModal}
            className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              activeUser
                ? 'bg-[#FBF8F2] hover:bg-[#EFE8DA] text-[#171412] border-[#B5A892] shadow-archival-sm'
                : 'bg-[#FBF8F2] hover:bg-[#EFE8DA] text-[#52483E] hover:text-[#171412] border-[#C8BEAA]'
            }`}
            title={
              activeUser
                ? `Signed in as ${activeUser.displayName} (@${activeUser.handle}) — Click to manage profile, watchlist & interested graph`
                : 'Sign in to access your Watchlist, Interested list, and personal graphs'
            }
          >
            {activeUser ? (
              <>
                <span
                  className="w-4 h-4 rounded-full text-[9px] font-bold text-[#FBF8F2] flex items-center justify-center shrink-0"
                  style={{ backgroundColor: activeUser.avatarColor }}
                >
                  {activeUser.displayName.slice(0, 1).toUpperCase()}
                </span>
                <span className="max-w-[96px] truncate hidden md:inline">
                  {activeUser.displayName}
                </span>
              </>
            ) : (
              <>
                <User className="w-3.5 h-3.5 text-[#B8292F] shrink-0" aria-hidden="true" />
                <span className="hidden md:inline">Sign In</span>
              </>
            )}
          </button>
        )}

        {/* Movie Map Dark vs Archival Folio Theme Toggle */}
        {onThemeChange && (
          <button
            type="button"
            onClick={() =>
              onThemeChange(
                theme === 'MOVIE_MAP_DARK' ? 'ARCHIVAL_FOLIO' : 'MOVIE_MAP_DARK'
              )
            }
            className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              theme === 'MOVIE_MAP_DARK'
                ? 'bg-[#141C2C] hover:bg-[#1C263A] text-[#00D2FF] border-[#00D2FF]/30 shadow-sm'
                : 'bg-[#FBF8F2] hover:bg-[#EFE8DA] text-[#B8292F] border-[#C8BEAA]'
            }`}
            title={
              theme === 'MOVIE_MAP_DARK'
                ? 'Currently in Movie Map Dark Void theme — click to switch to Archival Folio'
                : 'Currently in Archival Folio theme — click to switch to Movie Map Dark Void'
            }
          >
            {theme === 'MOVIE_MAP_DARK' ? (
              <>
                <Moon className="w-3.5 h-3.5 text-[#00D2FF]" aria-hidden="true" />
                <span className="hidden sm:inline">Movie Map</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-[#B8292F]" aria-hidden="true" />
                <span className="hidden sm:inline">Folio</span>
              </>
            )}
          </button>
        )}

        {/* Browse All Titles Catalogue Toggle Button */}
        {onToggleCatalog && (
          <button
            type="button"
            onClick={onToggleCatalog}
            className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              isCatalogOpen
                ? theme === 'MOVIE_MAP_DARK'
                  ? 'bg-[#00D2FF]/20 text-[#00D2FF] border-[#00D2FF]/40 shadow-[0_0_10px_rgba(0,210,255,0.2)]'
                  : 'bg-[#FBF8F2] text-[#171412] border-[#171412]'
                : theme === 'MOVIE_MAP_DARK'
                  ? 'bg-[#101624] hover:bg-[#162035] text-[#94A3B8] hover:text-[#F0F4FC] border-white/10'
                  : 'bg-[#FBF8F2] hover:bg-[#E5DEC9] text-[#171412] border-[#C8BEAA]'
            }`}
            title={isCatalogOpen ? 'Close Catalogue (Esc)' : 'Browse Complete Catalogue'}
          >
            <Film className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Titles</span>
            <span className="font-tabular text-[11px] opacity-75">
              ({matchingMediaCount ?? allMediaItems.length})
            </span>
          </button>
        )}

        {focalItem && (
          <button
            type="button"
            onClick={onClearFocal}
            className={`hidden sm:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              theme === 'MOVIE_MAP_DARK'
                ? 'bg-[#FF3366]/20 text-[#FF3366] border-[#FF3366]/40 hover:bg-[#FF3366]/30'
                : 'bg-[#F5E4E4] text-[#8C1D22] border-[#D8B4B6] hover:bg-[#B8292F] hover:text-[#FBF8F2]'
            }`}
            title="Clear focal filter and return to full archive"
          >
            <Crosshair className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span className="max-w-[110px] truncate">{focalItem.title}</span>
            <X className="w-3 h-3 shrink-0" aria-hidden="true" />
          </button>
        )}

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
          className={`group flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3366] ${
            hasActiveSelection ||
            focalItem ||
            activeFilterCount > 0 ||
            graphScope !== 'FULL_ARCHIVE'
              ? theme === 'MOVIE_MAP_DARK'
                ? 'bg-[#FF3366] text-[#0A0E17] border-[#FF3366] font-bold shadow-[0_0_10px_rgba(255,51,102,0.3)]'
                : 'bg-[#B8292F] hover:bg-[#8C1D22] text-[#FBF8F2] border-[#8C1D22] shadow-archival-sm'
              : theme === 'MOVIE_MAP_DARK'
                ? 'bg-[#101624] hover:bg-[#162035] text-[#94A3B8] hover:text-[#F0F4FC] border-white/10'
                : 'bg-[#FBF8F2] hover:bg-[#E5DEC9] text-[#171412] border-[#C8BEAA]'
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

        <PwaInstallButton variant="topbar" />
      </div>
    </header>
  );
}
