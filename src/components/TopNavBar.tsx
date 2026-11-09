'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Globe,
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
  KeyRound,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import { SixDegreesLogo } from './SixDegreesLogo';
import {
  GraphNode,
  MediaItem,
  RegionCode,
  ViewMode,
} from '@/lib/types';
import {
  LiveSearchResult,
  searchLiveCatalog,
  getActiveApiKeys,
  saveRuntimeApiKeys,
} from '@/lib/api';

interface TopNavBarProps {
  nodes: GraphNode[];
  linksCount: number;
  fov: number;
  focalItem: MediaItem | null;
  onClearFocal: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  region: RegionCode;
  onRegionChange: (region: RegionCode) => void;
  onResetPitch: () => void;
  allMediaItems: MediaItem[];
  onSelectNodeById: (nodeId: string) => void;
  onMakeFocal: (mediaId: string) => void;
  onBuildLiveCluster?: (target: LiveSearchResult) => Promise<void>;
  isBuildingCluster?: boolean;
  liveDataSourceLabel?: string;
  onApiKeysUpdated?: () => void;
}

export function TopNavBar({
  nodes,
  linksCount,
  focalItem,
  onClearFocal,
  viewMode,
  onViewModeChange,
  region,
  onRegionChange,
  onResetPitch,
  allMediaItems,
  onSelectNodeById,
  onMakeFocal,
  onBuildLiveCluster,
  isBuildingCluster = false,
  liveDataSourceLabel = 'Catalog Keys',
  onApiKeysUpdated,
}: TopNavBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [liveResults, setLiveResults] = useState<LiveSearchResult[]>([]);
  const [isSearchingLive, setIsSearchingLive] = useState(false);
  const [liveSearchSource, setLiveSearchSource] = useState<string>('PUBLIC_LIVE');

  const [apiModalOpen, setApiModalOpen] = useState(false);
  const [tmdbInput, setTmdbInput] = useState('');
  const [omdbInput, setOmdbInput] = useState('');
  const [keysSavedBanner, setKeysSavedBanner] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const { tmdbKey, omdbKey } = getActiveApiKeys();
    setTmdbInput(tmdbKey);
    setOmdbInput(omdbKey);
  }, [apiModalOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => inputRef.current?.focus(), 20);
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
        setApiModalOpen(false);
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
      const { results, source } = await searchLiveCatalog(q);
      if (!cancelled) {
        setLiveResults(results);
        setLiveSearchSource(source);
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

  const mediaNodesCount = useMemo(
    () => nodes.filter((n) => n.type === 'MOVIE' || n.type === 'TV').length,
    [nodes]
  );

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-14 z-40 bg-[#EFE8DA] border-b border-[#D5CCB9] px-4 flex items-center justify-between gap-3">
        {/* LEFT: Brand Mark + Catalog Search */}
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={onClearFocal}
            className="text-left cursor-pointer focus:outline-none"
            title="Show Full Graph (All Movies & TV Shows)"
          >
            <SixDegreesLogo />
          </button>

          {/* Catalog Search Input */}
          <div ref={dropdownRef} className="relative flex-1 sm:flex-initial w-44 sm:w-72 lg:w-96">
            <div
              onClick={() => {
                setSearchOpen(true);
                inputRef.current?.focus();
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#FBF8F2] border border-[#C8BEAA] hover:border-[#8F816B] focus-within:border-[#B8292F] transition-colors cursor-text"
            >
              {isSearchingLive || isBuildingCluster ? (
                <Loader2 className="w-3.5 h-3.5 text-[#B8292F] animate-spin shrink-0" />
              ) : (
                <Search className="w-3.5 h-3.5 text-[#6B5E50] shrink-0" />
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
                placeholder="Find a film, series, director, actor, or theme…"
                className="w-full bg-transparent text-xs text-[#171412] placeholder:text-[#6B5E50] focus:outline-none"
              />
              {query ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuery('');
                  }}
                  className="text-[#6B5E50] hover:text-[#171412]"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-tabular text-[#52483E] bg-[#E5DEC9] border border-[#C8BEAA] shrink-0">
                  Cmd+K
                </kbd>
              )}
            </div>

            {/* Search Results Sheet */}
            {searchOpen && (
              <div className="absolute left-0 right-0 top-11 rounded-lg bg-[#FBF8F2] border border-[#B5A892] shadow-archival p-3 max-h-[480px] overflow-y-auto z-50">
                {query.trim().length >= 2 && (
                  <div className="mb-3 pb-2.5 border-b border-[#D5CCB9]">
                    <div className="flex items-center justify-between px-2 py-1">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#2A6B53]">
                        <BookOpen className="w-3.5 h-3.5" />
                        Worldwide Catalog (
                        {liveSearchSource === 'TMDB'
                          ? 'TMDB & OMDb'
                          : 'IMDb & Wikidata'}
                        )
                      </span>
                      {isSearchingLive && (
                        <span className="text-[11px] text-[#52483E] flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Searching…
                        </span>
                      )}
                    </div>

                    {liveResults.length > 0 ? (
                      liveResults.map((liveItem) => (
                        <div
                          key={`${liveItem.source}-${liveItem.id}-${liveItem.imdbId}`}
                          onClick={async () => {
                            setSearchOpen(false);
                            if (onBuildLiveCluster) {
                              await onBuildLiveCluster(liveItem);
                            }
                          }}
                          className="flex items-center justify-between gap-2 px-2.5 py-2 rounded hover:bg-[#EFE8DA] cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {liveItem.posterUrl ? (
                              <img
                                src={liveItem.posterUrl}
                                alt={liveItem.title}
                                className="w-7 h-10 rounded-sm object-cover shrink-0 border border-[#C8BEAA]"
                              />
                            ) : liveItem.mediaType === 'MOVIE' ? (
                              <Film className="w-4 h-4 text-[#234B6E] shrink-0" />
                            ) : (
                              <Tv className="w-4 h-4 text-[#6B3A6E] shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-[#171412] truncate flex items-center gap-1.5">
                                <span className="truncate">{liveItem.title}</span>
                                <span className="text-[#52483E] font-tabular text-[11px] shrink-0">
                                  ({liveItem.year})
                                </span>
                              </div>
                              <div className="text-[11px] text-[#52483E] truncate">
                                {liveItem.mediaType === 'MOVIE' ? 'Film' : 'Series'}
                                {liveItem.stars ? ` · ${liveItem.stars}` : ''}
                              </div>
                            </div>
                          </div>

                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-[#F5E4E4] text-[#8C1D22] border border-[#D8B4B6] shrink-0">
                            <Crosshair className="w-3 h-3" />
                            Explore Connections
                          </span>
                        </div>
                      ))
                    ) : !isSearchingLive ? (
                      <div className="px-2.5 py-2 text-xs text-[#6B5E50]">
                        No catalog matches found for &ldquo;{query}&rdquo;.
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="text-[11px] font-semibold text-[#52483E] px-2 py-1">
                  In This Collection ({localResults.media.length})
                </div>
                {localResults.media.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      onSelectNodeById(item.id);
                      setSearchOpen(false);
                    }}
                    className="flex items-center justify-between gap-2 px-2.5 py-2 rounded hover:bg-[#EFE8DA] cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {item.mediaType === 'MOVIE' ? (
                        <Film className="w-3.5 h-3.5 text-[#234B6E] shrink-0" />
                      ) : (
                        <Tv className="w-3.5 h-3.5 text-[#6B3A6E] shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#171412] truncate">
                          {item.title}{' '}
                          <span className="text-[#52483E] font-normal font-tabular">
                            ({item.year})
                          </span>
                        </div>
                        <div className="text-[11px] text-[#52483E] truncate">
                          {item.directors[0]} · IMDb {item.imdbRating.toFixed(1)} ·{' '}
                          {item.tropes.slice(0, 2).join(', ')}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMakeFocal(item.id);
                        setSearchOpen(false);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-[#E5DEC9] text-[#171412] border border-[#C8BEAA] hover:bg-[#B8292F] hover:text-[#FBF8F2] hover:border-[#8C1D22] transition-colors shrink-0"
                    >
                      <Crosshair className="w-2.5 h-2.5" />
                      Center Here
                    </button>
                  </div>
                ))}

                {localResults.entities.length > 0 && (
                  <>
                    <div className="text-[11px] font-semibold text-[#52483E] px-2 py-1 mt-2 border-t border-[#D5CCB9] pt-2">
                      Shared Collaborators &amp; Themes ({localResults.entities.length})
                    </div>
                    {localResults.entities.map((ent) => (
                      <div
                        key={ent.id}
                        onClick={() => {
                          onSelectNodeById(ent.id);
                          setSearchOpen(false);
                        }}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded hover:bg-[#EFE8DA] cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {ent.type === 'DIRECTOR' && (
                            <Award className="w-3.5 h-3.5 text-[#B8292F]" />
                          )}
                          {ent.type === 'ACTOR' && (
                            <UserCheck className="w-3.5 h-3.5 text-[#B86B14]" />
                          )}
                          {ent.type === 'TROPE' && (
                            <Hash className="w-3.5 h-3.5 text-[#2A6B53]" />
                          )}
                          {ent.type === 'COMPOSER' && (
                            <Music className="w-3.5 h-3.5 text-[#A63A2B]" />
                          )}
                          <span className="text-xs font-medium text-[#171412] truncate">
                            {ent.label}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#52483E]">
                          {ent.subLabel}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CENTER: View Mode Switcher */}
        <nav
          aria-label="View Modes"
          className="hidden md:flex items-center gap-1 p-1 rounded-md bg-[#E5DEC9] border border-[#C8BEAA]"
        >
          <button
            type="button"
            onClick={() => onViewModeChange('3D')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all ${
              viewMode === '3D'
                ? 'bg-[#FBF8F2] text-[#171412] border border-[#B5A892] shadow-archival-sm'
                : 'text-[#52483E] hover:text-[#171412]'
            }`}
          >
            {viewMode === '3D' && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#B8292F]" />
            )}
            <span>3D Constellation</span>
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange('2D')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all ${
              viewMode === '2D'
                ? 'bg-[#FBF8F2] text-[#171412] border border-[#B5A892] shadow-archival-sm'
                : 'text-[#52483E] hover:text-[#171412]'
            }`}
          >
            {viewMode === '2D' && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#B8292F]" />
            )}
            <span>2D Map</span>
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange('MATRIX')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all ${
              viewMode === 'MATRIX'
                ? 'bg-[#FBF8F2] text-[#171412] border border-[#B5A892] shadow-archival-sm'
                : 'text-[#52483E] hover:text-[#171412]'
            }`}
          >
            {viewMode === 'MATRIX' && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#B8292F]" />
            )}
            <span>Critical Ledger</span>
          </button>
        </nav>

        {/* RIGHT: Collection Summary + Catalog Keys + Region + Reset View */}
        <div className="flex items-center gap-2">
          <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded bg-[#FBF8F2] border border-[#C8BEAA] text-xs font-tabular text-[#52483E]">
            <span>
              <strong className="text-[#171412] font-semibold">
                {mediaNodesCount}
              </strong>{' '}
              Titles
            </span>
            <span className="text-[#B5A892]">·</span>
            <span>
              <strong className="text-[#171412] font-semibold">
                {linksCount}
              </strong>{' '}
              Threads
            </span>
          </div>

          <button
            type="button"
            onClick={() => setApiModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#FBF8F2] hover:bg-[#E5DEC9] border border-[#C8BEAA] text-xs font-medium text-[#171412] transition-colors"
            title="Optional TMDB & OMDb Catalog Keys"
          >
            <KeyRound className="w-3.5 h-3.5 text-[#8C1D22]" />
            <span className="hidden lg:inline">{liveDataSourceLabel}</span>
          </button>

          <div className="relative flex items-center bg-[#FBF8F2] border border-[#C8BEAA] rounded px-2.5 py-1 text-xs text-[#171412]">
            <Globe className="w-3.5 h-3.5 text-[#234B6E] mr-1.5 shrink-0" />
            <label htmlFor="region-select" className="sr-only">
              Streaming Region
            </label>
            <select
              id="region-select"
              value={region}
              onChange={(e) => onRegionChange(e.target.value as RegionCode)}
              className="bg-transparent text-xs font-semibold text-[#171412] focus:outline-none cursor-pointer pr-1"
            >
              <option value="AU" className="bg-[#FBF8F2] text-[#171412]">
                AU — Australia
              </option>
              <option value="US" className="bg-[#FBF8F2] text-[#171412]">
                US — United States
              </option>
              <option value="UK" className="bg-[#FBF8F2] text-[#171412]">
                UK — United Kingdom
              </option>
            </select>
          </div>

          <button
            type="button"
            onClick={onResetPitch}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#FBF8F2] hover:bg-[#E5DEC9] text-xs font-medium text-[#171412] border border-[#C8BEAA] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#52483E]" />
            <span className="hidden sm:inline">Reset View</span>
          </button>
        </div>
      </header>

      {/* External Catalog & API Keys Modal */}
      {apiModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#171412]/45 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-lg bg-[#FBF8F2] border border-[#B5A892] shadow-archival p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D5CCB9]">
              <h2 className="font-heading text-lg font-bold text-[#171412]">
                Catalog Data &amp; Optional API Keys
              </h2>
              <button
                type="button"
                onClick={() => setApiModalOpen(false)}
                className="p-1 rounded text-[#52483E] hover:text-[#171412] hover:bg-[#E5DEC9]"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded bg-[#EFE8DA] border border-[#D5CCB9] text-xs text-[#171412] leading-relaxed">
              <strong className="text-[#2A6B53] font-semibold">
                Built-in Catalog Ready:
              </strong>{' '}
              You can search any film or series in the{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-[#E5DEC9] border border-[#C8BEAA] font-tabular text-[10px]">
                Cmd+K
              </kbd>{' '}
              search bar right away using our public IMDb &amp; Wikidata index. Add
              optional TMDB and OMDb keys below to include live regional streaming
              providers and critic scores.
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="tmdb-key-input"
                  className="block text-xs font-semibold text-[#171412] mb-1"
                >
                  TMDB API Key (optional, for regional watch providers)
                </label>
                <input
                  id="tmdb-key-input"
                  type="password"
                  value={tmdbInput}
                  onChange={(e) => setTmdbInput(e.target.value)}
                  placeholder="e.g. a1b2c3d4e5f6..."
                  className="w-full px-3 py-2 rounded bg-[#F6F1E7] border border-[#C8BEAA] text-xs text-[#171412] placeholder:text-[#6B5E50] focus:outline-none focus:border-[#B8292F]"
                />
              </div>

              <div>
                <label
                  htmlFor="omdb-key-input"
                  className="block text-xs font-semibold text-[#171412] mb-1"
                >
                  OMDb API Key (optional, for Rotten Tomatoes &amp; Metascore)
                </label>
                <input
                  id="omdb-key-input"
                  type="password"
                  value={omdbInput}
                  onChange={(e) => setOmdbInput(e.target.value)}
                  placeholder="e.g. 9f8e7d6c..."
                  className="w-full px-3 py-2 rounded bg-[#F6F1E7] border border-[#C8BEAA] text-xs text-[#171412] placeholder:text-[#6B5E50] focus:outline-none focus:border-[#B8292F]"
                />
              </div>
            </div>

            {keysSavedBanner && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2A6B53]">
                <CheckCircle2 className="w-4 h-4" />
                <span>Keys saved for this browser session.</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D5CCB9]">
              <button
                type="button"
                onClick={() => setApiModalOpen(false)}
                className="px-3.5 py-2 rounded text-xs font-semibold text-[#52483E] hover:text-[#171412]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  saveRuntimeApiKeys(tmdbInput, omdbInput);
                  onApiKeysUpdated?.();
                  setKeysSavedBanner(true);
                  setTimeout(() => {
                    setKeysSavedBanner(false);
                    setApiModalOpen(false);
                  }, 900);
                }}
                className="px-4 py-2 rounded text-xs font-semibold bg-[#B8292F] hover:bg-[#8C1D22] text-[#FBF8F2] transition-colors"
              >
                Save Keys
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
