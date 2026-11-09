'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Sparkles,
  Film,
  Tv,
  Check,
  Plus,
  X,
  Search,
  Crosshair,
  Orbit,
  RotateCcw,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  BookmarkCheck,
  SlidersHorizontal,
  Award,
  Hash,
  Play,
} from 'lucide-react';
import {
  CuratedCategoryId,
  DecadeFilter,
  MediaItem,
  RegionCode,
  SuggestionFilterState,
  WatchSuggestion,
} from '@/lib/types';
import {
  CURATED_CATEGORIES,
  DEFAULT_SUGGESTION_FILTERS,
   computeWatchSuggestions,
  extractCatalogFacets,
} from '@/lib/recommendations';
import { LiveSearchResult, searchLiveCatalog } from '@/lib/api';
import { getPosterFallbackDataUri } from '@/lib/seed-data';

interface WatchSuggestionsViewProps {
  allMediaItems: MediaItem[];
  watchedIds: string[];
  onToggleWatched: (mediaId: string) => void;
  filters: SuggestionFilterState;
  onFiltersChange: React.Dispatch<React.SetStateAction<SuggestionFilterState>>;
  region: RegionCode;
  onRegionChange: (region: RegionCode) => void;
  selectedMediaId: string | null;
  onSelectMedia: (item: MediaItem) => void;
  onExploreIn3D: (mediaId: string) => void;
  onAddLiveMediaAndWatch: (target: LiveSearchResult) => Promise<void>;
  onFetchLiveSuggestions: (options: {
    seedItem?: MediaItem | null;
    genre?: string;
    mediaType?: 'ALL' | 'MOVIE' | 'TV';
  }) => Promise<void>;
  isFetchingLive: boolean;
}

export function WatchSuggestionsView({
  allMediaItems,
  watchedIds,
  onToggleWatched,
  filters,
  onFiltersChange,
  region,
  onRegionChange,
  selectedMediaId,
  onSelectMedia,
  onExploreIn3D,
  onAddLiveMediaAndWatch,
  onFetchLiveSuggestions,
  isFetchingLive,
}: WatchSuggestionsViewProps) {
  const [watchedQuery, setWatchedQuery] = useState('');
  const [watchedDropdownOpen, setWatchedDropdownOpen] = useState(false);
  const [liveWatchedResults, setLiveWatchedResults] = useState<
    LiveSearchResult[]
  >([]);
  const [isSearchingWatchedLive, setIsSearchingWatchedLive] = useState(false);
  const [showAllTropes, setShowAllTropes] = useState(false);

  const watchedSearchRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        watchedSearchRef.current &&
        !watchedSearchRef.current.contains(e.target as Node)
      ) {
        setWatchedDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Live catalog search when adding a watched movie/show not yet in the archive
  useEffect(() => {
    const q = watchedQuery.trim();
    if (q.length < 2) {
      setLiveWatchedResults([]);
      setIsSearchingWatchedLive(false);
      return;
    }

    let cancelled = false;
    setIsSearchingWatchedLive(true);
    const timer = setTimeout(async () => {
      const { results } = await searchLiveCatalog(q);
      if (!cancelled) {
        setLiveWatchedResults(results);
        setIsSearchingWatchedLive(false);
      }
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [watchedQuery]);

  const watchedSet = useMemo(() => new Set(watchedIds), [watchedIds]);

  const watchedMediaItems = useMemo(
    () => allMediaItems.filter((m) => watchedSet.has(m.id)),
    [allMediaItems, watchedSet]
  );

  const focusedSeedItems = useMemo(
    () => allMediaItems.filter((m) => filters.seedMediaIds.includes(m.id)),
    [allMediaItems, filters.seedMediaIds]
  );

  const facets = useMemo(
    () => extractCatalogFacets(allMediaItems, region),
    [allMediaItems, region]
  );

  const suggestions: WatchSuggestion[] = useMemo(
    () =>
      computeWatchSuggestions(allMediaItems, watchedSet, filters, region),
    [allMediaItems, watchedSet, filters, region]
  );

  const localWatchedSearchMatches = useMemo(() => {
    const q = watchedQuery.trim().toLowerCase();
    if (!q) {
      return allMediaItems
        .filter((m) => !watchedSet.has(m.id))
        .slice(0, 8);
    }
    return allMediaItems
      .filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.directors.some((d) => d.toLowerCase().includes(q)) ||
          m.cast.some((c) => c.name.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [allMediaItems, watchedQuery, watchedSet]);

  const starterSeedCandidates = useMemo(() => {
    const preferredIds = [
      'inception',
      'severance',
      'dark',
      'interstellar',
      'the-prestige',
      'blade-runner-2049',
      'arrival',
      'black-mirror',
      'oppenheimer',
      'true-detective',
      'the-matrix',
      'ex-machina',
    ];
    return preferredIds
      .map((id) => allMediaItems.find((m) => m.id === id))
      .filter((m): m is MediaItem => Boolean(m && !watchedSet.has(m.id)))
      .slice(0, 8);
  }, [allMediaItems, watchedSet]);

  const toggleGenre = (genre: string) => {
    onFiltersChange((prev) => {
      const exists = prev.selectedGenres.some(
        (g) => g.toLowerCase() === genre.toLowerCase()
      );
      return {
        ...prev,
        selectedGenres: exists
          ? prev.selectedGenres.filter(
              (g) => g.toLowerCase() !== genre.toLowerCase()
            )
          : [...prev.selectedGenres, genre],
      };
    });
  };

  const toggleTrope = (trope: string) => {
    onFiltersChange((prev) => {
      const exists = prev.selectedTropes.some(
        (t) => t.toLowerCase() === trope.toLowerCase()
      );
      return {
        ...prev,
        selectedTropes: exists
          ? prev.selectedTropes.filter(
              (t) => t.toLowerCase() !== trope.toLowerCase()
            )
          : [...prev.selectedTropes, trope],
      };
    });
  };

  const toggleSeedFocus = (mediaId: string) => {
    onFiltersChange((prev) => {
      const exists = prev.seedMediaIds.includes(mediaId);
      return {
        ...prev,
        seedMediaIds: exists
          ? prev.seedMediaIds.filter((id) => id !== mediaId)
          : [...prev.seedMediaIds, mediaId],
      };
    });
  };

  const hasCustomFilters =
    filters.seedMediaIds.length > 0 ||
    filters.selectedGenres.length > 0 ||
    filters.selectedTropes.length > 0 ||
    filters.selectedCollaborator !== null ||
    filters.curatedCategory !== 'ALL' ||
    filters.mediaFilter !== 'ALL' ||
    filters.decadeFilter !== 'ALL' ||
    filters.minImdbRating > 0 ||
    filters.streamingOnlyInRegion ||
    filters.selectedProvider !== null;

  const handleResetFilters = () => {
    onFiltersChange({
      ...DEFAULT_SUGGESTION_FILTERS,
      hideWatched: filters.hideWatched,
      preset: filters.preset,
    });
  };

  const primarySeedForLiveFetch =
    focusedSeedItems[0] || watchedMediaItems[0] || null;

  return (
    <div className="w-full h-full overflow-y-auto px-5 py-6 lg:pr-[420px] pb-24">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ==================== HEADER & REGION / LIVE DISCOVERY BAR ==================== */}
        <header className="pb-4 border-b border-[#C8BEAA] flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#171412]">
                What to Watch Next
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F5E4E4] text-[#8C1D22] border border-[#D8B4B6]">
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                {suggestions.length} Suggestions
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#52483E] mt-1 max-w-2xl">
              Discover films and television series tailored to what you have
              already watched, or filter by genre, narrative theme, curated mood
              category, collaborator, and regional streaming service.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* Hide / Show Already Watched Toggle */}
            <button
              type="button"
              onClick={() =>
                onFiltersChange((prev) => ({
                  ...prev,
                  hideWatched: !prev.hideWatched,
                }))
              }
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                filters.hideWatched
                  ? 'bg-[#E4F0EA] text-[#1E563F] border-[#B3D4C5]'
                  : 'bg-[#FBF8F2] text-[#52483E] border-[#C8BEAA] hover:bg-[#EFE8DA]'
              }`}
              title="Toggle whether titles you have already watched are excluded from suggestions"
            >
              {filters.hideWatched ? (
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>
                {filters.hideWatched
                  ? `Hiding ${watchedIds.length} Watched`
                  : `Showing Watched (${watchedIds.length})`}
              </span>
            </button>

            {/* Regional Streaming Selector (AU / US / UK) */}
            <div
              role="group"
              aria-label="Streaming region"
              className="inline-flex items-center p-0.5 rounded-lg bg-[#EFE8DA] border border-[#C8BEAA]"
            >
              {(['AU', 'US', 'UK'] as const).map((rCode) => (
                <button
                  key={rCode}
                  type="button"
                  onClick={() => onRegionChange(rCode)}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                    region === rCode
                      ? 'bg-[#FBF8F2] text-[#171412] border border-[#B5A892] shadow-archival-sm'
                      : 'text-[#52483E] hover:text-[#171412]'
                  }`}
                >
                  {rCode}
                </button>
              ))}
            </div>

            {/* Live Catalog Suggestion Fetcher */}
            <button
              type="button"
              disabled={isFetchingLive}
              onClick={() =>
                onFetchLiveSuggestions({
                  seedItem: primarySeedForLiveFetch,
                  genre: filters.selectedGenres[0],
                  mediaType: filters.mediaFilter,
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#B8292F] hover:bg-[#8C1D22] disabled:opacity-60 text-[#FBF8F2] border border-[#8C1D22] shadow-archival-sm transition-colors cursor-pointer"
              title="Fetch additional live Movies & TV Shows from TMDB matching your current watched list or genre"
            >
              {isFetchingLive ? (
                <Loader2
                  className="w-3.5 h-3.5 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>
                {isFetchingLive
                  ? 'Discovering Live Titles…'
                  : 'Fetch More Live Matches'}
              </span>
            </button>

            {hasCustomFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#FBF8F2] hover:bg-[#E5DEC9] text-[#8C1D22] border border-[#C8BEAA] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </header>

        {/* ==================== 1. BASED ON WHAT YOU HAVE ALREADY WATCHED ==================== */}
        <section
          aria-label="Based on what you have already watched"
          className="p-4 rounded-xl bg-[#FBF8F2] border border-[#C8BEAA] shadow-archival-sm space-y-3.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-base font-bold text-[#171412] flex items-center gap-2">
                <BookmarkCheck
                  className="w-4 h-4 text-[#2A6B53]"
                  aria-hidden="true"
                />
                <span>
                  1. Based on Movies &amp; Shows You&apos;ve Already Watched
                </span>
              </h2>
              <p className="text-xs text-[#52483E] mt-0.5">
                Mark titles you have watched or enjoyed. Suggestions are ranked
                by shared narrative themes, directors, cast, composers, and
                genre kinship—while hiding titles you&apos;ve already seen.
              </p>
            </div>

            {/* Search & Add Any Watched Movie or TV Show */}
            <div ref={watchedSearchRef} className="relative w-full sm:w-72">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F6F1E7] border border-[#B5A892] focus-within:border-[#B8292F]">
                {isSearchingWatchedLive ? (
                  <Loader2 className="w-3.5 h-3.5 text-[#B8292F] animate-spin shrink-0" />
                ) : (
                  <Search className="w-3.5 h-3.5 text-[#6B5E50] shrink-0" />
                )}
                <input
                  type="text"
                  value={watchedQuery}
                  onFocus={() => setWatchedDropdownOpen(true)}
                  onChange={(e) => {
                    setWatchedQuery(e.target.value);
                    setWatchedDropdownOpen(true);
                  }}
                  placeholder="Add a movie or show you've watched…"
                  aria-label="Add a movie or show you've watched"
                  className="w-full bg-transparent text-xs text-[#171412] placeholder:text-[#6B5E50] focus:outline-none"
                />
                {watchedQuery && (
                  <button
                    type="button"
                    onClick={() => setWatchedQuery('')}
                    className="text-[#6B5E50] hover:text-[#171412]"
                    aria-label="Clear watched search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {watchedDropdownOpen && (
                <div className="absolute right-0 left-0 sm:w-80 top-10 rounded-xl bg-[#FBF8F2] border border-[#B5A892] shadow-archival p-2 max-h-80 overflow-y-auto z-40 space-y-2">
                  {/* Matches in Current Collection */}
                  <div>
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#52483E]">
                      In Graph Archive
                    </div>
                    {localWatchedSearchMatches.map((item) => {
                      const isWatched = watchedSet.has(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (!isWatched) {
                              onToggleWatched(item.id);
                            }
                            setWatchedQuery('');
                            setWatchedDropdownOpen(false);
                          }}
                          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[#EFE8DA] text-left transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {item.mediaType === 'MOVIE' ? (
                              <Film className="w-3.5 h-3.5 text-[#234B6E] shrink-0" />
                            ) : (
                              <Tv className="w-3.5 h-3.5 text-[#6B3A6E] shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-[#171412] truncate">
                                {item.title}{' '}
                                <span className="font-normal font-tabular text-[#52483E]">
                                  ({item.year})
                                </span>
                              </div>
                              <div className="text-[10px] text-[#6B5E50] truncate">
                                {item.primaryGenre} · {item.directors[0]}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                              isWatched
                                ? 'bg-[#E4F0EA] text-[#1E563F]'
                                : 'bg-[#EFE8DA] text-[#171412] border border-[#C8BEAA]'
                            }`}
                          >
                            {isWatched ? 'Watched ✓' : '+ Watched'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Worldwide Live Catalog Matches */}
                  {watchedQuery.trim().length >= 2 && (
                    <div className="pt-1.5 border-t border-[#D5CCB9]">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#2A6B53]">
                        Worldwide Catalog (Import &amp; Mark Watched)
                      </div>
                      {liveWatchedResults.length > 0 ? (
                        liveWatchedResults.slice(0, 5).map((liveItem) => (
                          <button
                            key={`${liveItem.source}-${liveItem.id}-${liveItem.imdbId}`}
                            type="button"
                            onClick={async () => {
                              setWatchedDropdownOpen(false);
                              setWatchedQuery('');
                              await onAddLiveMediaAndWatch(liveItem);
                            }}
                            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[#EFE8DA] text-left transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {liveItem.mediaType === 'MOVIE' ? (
                                <Film className="w-3.5 h-3.5 text-[#234B6E] shrink-0" />
                              ) : (
                                <Tv className="w-3.5 h-3.5 text-[#6B3A6E] shrink-0" />
                              )}
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-[#171412] truncate">
                                  {liveItem.title}{' '}
                                  <span className="font-normal font-tabular text-[#52483E]">
                                    ({liveItem.year})
                                  </span>
                                </div>
                                <div className="text-[10px] text-[#6B5E50] truncate">
                                  {liveItem.mediaType === 'MOVIE'
                                    ? 'Film'
                                    : 'Series'}
                                  {liveItem.stars ? ` · ${liveItem.stars}` : ''}
                                </div>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#B8292F] text-[#FBF8F2] shrink-0">
                              + Import &amp; Watch
                            </span>
                          </button>
                        ))
                      ) : !isSearchingWatchedLive ? (
                        <div className="px-2 py-1 text-xs text-[#6B5E50]">
                          No external catalog matches found.
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Active Watched Titles Shelf */}
          {watchedMediaItems.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-[#52483E]">
                <span>
                  Your Watched Titles ({watchedMediaItems.length}) — click any
                  title to focus suggestions specifically on it:
                </span>
                {filters.seedMediaIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      onFiltersChange((prev) => ({ ...prev, seedMediaIds: [] }))
                    }
                    className="text-[#8C1D22] font-semibold hover:underline cursor-pointer"
                  >
                    Use All Watched Titles ({watchedMediaItems.length})
                  </button>
                )}
              </div>

              <div className="flex items-center flex-wrap gap-2">
                {watchedMediaItems.map((item) => {
                  const isFocusedSeed = filters.seedMediaIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`inline-flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-lg border text-xs transition-all ${
                        isFocusedSeed
                          ? 'bg-[#F5E4E4] border-[#B8292F] text-[#8C1D22] shadow-archival-sm'
                          : 'bg-[#EFE8DA] border-[#C8BEAA] text-[#171412]'
                      }`}
                    >
                      <img
                        src={item.posterUrl}
                        alt=""
                        className="w-5 h-7 rounded-sm object-cover border border-[#C8BEAA] shrink-0"
                        onError={(e) => {
                          e.currentTarget.src = getPosterFallbackDataUri(item);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => toggleSeedFocus(item.id)}
                        className="font-semibold hover:text-[#B8292F] cursor-pointer text-left truncate max-w-[170px]"
                        title={
                          isFocusedSeed
                            ? 'Focused seed (click to unfocus and use all watched titles)'
                            : 'Click to focus suggestions specifically around this title'
                        }
                      >
                        {item.title}{' '}
                        <span className="font-normal font-tabular opacity-75">
                          ({item.year})
                        </span>
                      </button>
                      {isFocusedSeed && (
                        <span className="px-1.5 py-0.2 rounded bg-[#B8292F] text-[#FBF8F2] text-[9px] font-bold uppercase">
                          Focused
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onToggleWatched(item.id)}
                        className="p-0.5 rounded text-[#6B5E50] hover:text-[#8C1D22] cursor-pointer"
                        title={`Remove ${item.title} from Watched`}
                        aria-label={`Remove ${item.title} from Watched`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-[#EFE8DA]/60 border border-[#D5CCB9] text-xs text-[#52483E]">
              You haven&apos;t marked any movies or shows as watched yet. Click
              any title below to add it to your watched history:
            </div>
          )}

          {/* Quick-Add Popular Titles Bar */}
          {starterSeedCandidates.length > 0 && (
            <div className="pt-2 border-t border-[#E5DEC9] flex items-center flex-wrap gap-1.5">
              <span className="text-[11px] font-semibold text-[#6B5E50] mr-1">
                Quick-mark watched:
              </span>
              {starterSeedCandidates.map((cand) => (
                <button
                  key={cand.id}
                  type="button"
                  onClick={() => onToggleWatched(cand.id)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F6F1E7] hover:bg-[#E4F0EA] text-[#52483E] hover:text-[#1E563F] border border-[#D5CCB9] hover:border-[#B3D4C5] transition-colors cursor-pointer"
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>{cand.title}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ==================== 2. BROWSE BY GENRE, THEME & CURATED CATEGORY ==================== */}
        <section
          aria-label="Browse by genre, narrative theme, and category"
          className="p-4 rounded-xl bg-[#FBF8F2] border border-[#C8BEAA] shadow-archival-sm space-y-4"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="font-heading text-base font-bold text-[#171412] flex items-center gap-2">
              <SlidersHorizontal
                className="w-4 h-4 text-[#B8292F]"
                aria-hidden="true"
              />
              <span>2. Filter by Genre, Curated Category &amp; Theme</span>
            </h2>

            {/* Format Segmented Pill */}
            <div
              role="group"
              aria-label="Filter suggestions by format"
              className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#EFE8DA] border border-[#C8BEAA]"
            >
              {(
                [
                  { id: 'ALL', label: 'All Formats' },
                  { id: 'MOVIE', label: 'Feature Films' },
                  { id: 'TV', label: 'TV Series' },
                ] as const
              ).map((fmt) => {
                const active = filters.mediaFilter === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() =>
                      onFiltersChange((prev) => ({
                        ...prev,
                        mediaFilter: fmt.id,
                      }))
                    }
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      active
                        ? 'bg-[#FBF8F2] text-[#171412] border border-[#B5A892] shadow-archival-sm'
                        : 'text-[#52483E] hover:text-[#171412]'
                    }`}
                  >
                    {fmt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* A. Curated Mood & Editorial Categories */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#52483E] mb-2">
              Curated Categories &amp; Moods
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {CURATED_CATEGORIES.map((cat) => {
                const active = filters.curatedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      onFiltersChange((prev) => ({
                        ...prev,
                        curatedCategory:
                          prev.curatedCategory === cat.id && cat.id !== 'ALL'
                            ? 'ALL'
                            : (cat.id as CuratedCategoryId),
                      }))
                    }
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-[#F5E4E4]/65 border-[#B8292F] shadow-archival-sm'
                        : 'bg-[#F6F1E7] hover:bg-[#EFE8DA] border-[#D5CCB9]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#171412] truncate">
                        {cat.title}
                      </span>
                      <span
                        className="px-1.5 py-0.2 rounded text-[10px] font-tabular font-semibold shrink-0"
                        style={{
                          backgroundColor: active ? '#B8292F' : '#EFE8DA',
                          color: active ? '#FBF8F2' : cat.accentColor,
                        }}
                      >
                        {cat.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#52483E] mt-0.5 line-clamp-1">
                      {cat.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* B. Broad Genres Multi-Select */}
          <div className="pt-3 border-t border-[#E5DEC9]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#52483E]">
                Genres (Select one or more)
              </span>
              {filters.selectedGenres.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    onFiltersChange((prev) => ({ ...prev, selectedGenres: [] }))
                  }
                  className="text-[11px] font-semibold text-[#8C1D22] hover:underline cursor-pointer"
                >
                  Clear Genres ({filters.selectedGenres.length})
                </button>
              )}
            </div>

            <div className="flex items-center flex-wrap gap-1.5">
              {facets.genres.map((g) => {
                const selected = filters.selectedGenres.some(
                  (sel) => sel.toLowerCase() === g.value.toLowerCase()
                );
                return (
                  <button
                    key={g.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleGenre(g.value)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      selected
                        ? 'bg-[#234B6E] text-[#FBF8F2] border-[#1A3854] shadow-archival-sm'
                        : 'bg-[#EFE8DA] hover:bg-[#E5DEC9] text-[#171412] border-[#C8BEAA]'
                    }`}
                  >
                    <span>{g.value}</span>
                    <span
                      className={`text-[10px] font-tabular ${
                        selected ? 'text-[#FBF8F2]/80' : 'text-[#6B5E50]'
                      }`}
                    >
                      {g.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* C. Specific Narrative Themes & Micro-Tropes */}
          <div className="pt-3 border-t border-[#E5DEC9]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#52483E]">
                Narrative Themes &amp; Story Tropes
              </span>
              <div className="flex items-center gap-3">
                {filters.selectedTropes.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      onFiltersChange((prev) => ({
                        ...prev,
                        selectedTropes: [],
                      }))
                    }
                    className="text-[11px] font-semibold text-[#8C1D22] hover:underline cursor-pointer"
                  >
                    Clear Themes ({filters.selectedTropes.length})
                  </button>
                )}
                {facets.tropes.length > 10 && (
                  <button
                    type="button"
                    onClick={() => setShowAllTropes((v) => !v)}
                    className="text-[11px] font-semibold text-[#2A6B53] hover:underline cursor-pointer"
                  >
                    {showAllTropes
                      ? 'Show Top Themes'
                      : `Show All ${facets.tropes.length} Themes`}
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-1.5">
              {(showAllTropes ? facets.tropes : facets.tropes.slice(0, 10)).map(
                (t) => {
                  const selected = filters.selectedTropes.some(
                    (sel) => sel.toLowerCase() === t.value.toLowerCase()
                  );
                  return (
                    <button
                      key={t.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleTrope(t.value)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                        selected
                          ? 'bg-[#2A6B53] text-[#FBF8F2] border-[#1E563F] font-semibold shadow-archival-sm'
                          : 'bg-[#F6F1E7] hover:bg-[#EFE8DA] text-[#171412] border-[#D5CCB9]'
                      }`}
                    >
                      <Hash className="w-3 h-3 opacity-75 shrink-0" />
                      <span>{t.value}</span>
                      <span
                        className={`text-[10px] font-tabular ${
                          selected ? 'text-[#FBF8F2]/80' : 'text-[#6B5E50]'
                        }`}
                      >
                        {t.count}
                      </span>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* D. Secondary Filters: Collaborator, Release Era, Min Rating & Streaming Service */}
          <div className="pt-3 border-t border-[#E5DEC9] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Collaborator Filter */}
            <div>
              <label
                htmlFor="suggest-collab-select"
                className="block text-[10px] font-bold uppercase tracking-wider text-[#52483E] mb-1"
              >
                Director, Actor or Composer
              </label>
              <select
                id="suggest-collab-select"
                value={filters.selectedCollaborator || ''}
                onChange={(e) =>
                  onFiltersChange((prev) => ({
                    ...prev,
                    selectedCollaborator: e.target.value || null,
                  }))
                }
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#EFE8DA] border border-[#C8BEAA] text-xs font-semibold text-[#171412] focus:outline-none cursor-pointer"
              >
                <option value="">All Collaborators</option>
                {facets.collaborators.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.value} ({c.subLabel} · {c.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Release Era / Decade Filter */}
            <div>
              <label
                htmlFor="suggest-decade-select"
                className="block text-[10px] font-bold uppercase tracking-wider text-[#52483E] mb-1"
              >
                Release Era
              </label>
              <select
                id="suggest-decade-select"
                value={filters.decadeFilter}
                onChange={(e) =>
                  onFiltersChange((prev) => ({
                    ...prev,
                    decadeFilter: e.target.value as DecadeFilter,
                  }))
                }
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#EFE8DA] border border-[#C8BEAA] text-xs font-semibold text-[#171412] focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Eras</option>
                <option value="2020s">2020s (Recent Releases)</option>
                <option value="2010s">2010s Modern Classics</option>
                <option value="2000s">2000s Essentials</option>
                <option value="CLASSIC">Pre-2000 Classics</option>
              </select>
            </div>

            {/* Minimum IMDb Rating */}
            <div>
              <label
                htmlFor="suggest-rating-select"
                className="block text-[10px] font-bold uppercase tracking-wider text-[#52483E] mb-1"
              >
                Minimum IMDb Rating
              </label>
              <select
                id="suggest-rating-select"
                value={String(filters.minImdbRating)}
                onChange={(e) =>
                  onFiltersChange((prev) => ({
                    ...prev,
                    minImdbRating: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#EFE8DA] border border-[#C8BEAA] text-xs font-semibold text-[#171412] focus:outline-none cursor-pointer"
              >
                <option value="0">Any Rating</option>
                <option value="7.5">★ 7.5+ Acclaimed</option>
                <option value="8.0">★ 8.0+ Must-Watch</option>
                <option value="8.5">★ 8.5+ All-Time Greats</option>
              </select>
            </div>

            {/* Streaming Service in Region */}
            <div>
              <label
                htmlFor="suggest-provider-select"
                className="block text-[10px] font-bold uppercase tracking-wider text-[#52483E] mb-1"
              >
                Streaming Service ({region})
              </label>
              <select
                id="suggest-provider-select"
                value={
                  filters.selectedProvider
                    ? `provider:${filters.selectedProvider}`
                    : filters.streamingOnlyInRegion
                      ? 'STREAM_ONLY'
                      : 'ALL'
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'ALL') {
                    onFiltersChange((prev) => ({
                      ...prev,
                      streamingOnlyInRegion: false,
                      selectedProvider: null,
                    }));
                  } else if (val === 'STREAM_ONLY') {
                    onFiltersChange((prev) => ({
                      ...prev,
                      streamingOnlyInRegion: true,
                      selectedProvider: null,
                    }));
                  } else if (val.startsWith('provider:')) {
                    onFiltersChange((prev) => ({
                      ...prev,
                      streamingOnlyInRegion: true,
                      selectedProvider: val.replace('provider:', ''),
                    }));
                  }
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#EFE8DA] border border-[#C8BEAA] text-xs font-semibold text-[#171412] focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Availability ({region})</option>
                <option value="STREAM_ONLY">
                  Any Subscription Stream ({region})
                </option>
                {facets.providers.map((p) => (
                  <option key={p.value} value={`provider:${p.value}`}>
                    {p.value} ({p.count} titles)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* ==================== 3. RANKED WATCH SUGGESTIONS RESULTS ==================== */}
        <section aria-label="Suggested Movies and TV Shows">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-lg font-bold text-[#171412]">
              Top Tailored Suggestions ({suggestions.length})
            </h2>
            <span className="text-xs text-[#52483E]">
              Click any title to inspect its full monograph or view in the 3D
              constellation
            </span>
          </div>

          {suggestions.length > 0 ? (
            <div className="space-y-3">
              {suggestions.map((suggestion, index) => {
                const { item, matchScore, becauseYouWatched, reasons } =
                  suggestion;
                const isSelected = item.id === selectedMediaId;
                const isWatched = watchedSet.has(item.id);
                const streamOffers = (
                  item.streamingByRegion[region] || []
                ).filter((o) => o.type === 'STREAM');

                return (
                  <article
                    key={item.id}
                    onClick={() => onSelectMedia(item)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#EFE8DA] border-[#B8292F] shadow-archival'
                        : 'bg-[#FBF8F2] hover:bg-[#EFE8DA]/65 border-[#C8BEAA] shadow-archival-sm'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                      {/* Left: Rank + 2:3 Poster */}
                      <div className="flex items-start gap-3 shrink-0">
                        <div className="w-7 pt-1 text-right font-heading text-sm font-bold font-tabular text-[#6B5E50]">
                          #{String(index + 1).padStart(2, '0')}
                        </div>
                        <div className="w-20 sm:w-24 aspect-[2/3] rounded overflow-hidden border border-[#C8BEAA] bg-[#EFE8DA] shadow-archival-sm shrink-0">
                          <img
                            src={item.posterUrl}
                            alt={item.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src =
                                getPosterFallbackDataUri(item);
                            }}
                          />
                        </div>
                      </div>

                      {/* Center: Metadata, "Because You Watched", Synopsis & Reason Pills */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-heading text-lg font-bold text-[#171412] hover:text-[#B8292F] transition-colors">
                                {item.title}
                              </h3>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  item.mediaType === 'MOVIE'
                                    ? 'bg-[#234B6E]/10 text-[#234B6E]'
                                    : 'bg-[#6B3A6E]/10 text-[#6B3A6E]'
                                }`}
                              >
                                {item.mediaType === 'MOVIE' ? (
                                  <Film className="w-3 h-3" />
                                ) : (
                                  <Tv className="w-3 h-3" />
                                )}
                                {item.mediaType === 'MOVIE' ? 'Film' : 'Series'}
                              </span>
                            </div>

                            <div className="flex items-center flex-wrap gap-1.5 text-xs text-[#52483E] mt-0.5">
                              <span className="font-tabular font-medium">
                                {item.year}
                              </span>
                              <span>·</span>
                              <span>
                                {item.mediaType === 'MOVIE'
                                  ? 'Dir. '
                                  : 'Created by '}
                                <strong className="text-[#171412] font-semibold">
                                  {item.directors.join(', ')}
                                </strong>
                              </span>
                              <span>·</span>
                              <span className="font-tabular">
                                {item.contentRating} · {item.runtimeOrSeasons}
                              </span>
                            </div>
                          </div>

                          {/* Match Score & Critical Ratings */}
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right text-xs font-tabular">
                              <div className="font-bold text-[#171412]">
                                ★ {item.imdbRating.toFixed(1)}{' '}
                                <span className="text-[#8C1D22] ml-1">
                                  {item.rottenTomatoes}% RT
                                </span>
                              </div>
                              <div className="text-[10px] text-[#6B5E50]">
                                Metascore {item.metascore}
                              </div>
                            </div>

                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold font-tabular bg-[#E3EFEA] text-[#1E563F] border border-[#B3D4C5]">
                              {matchScore}% Match
                            </span>
                          </div>
                        </div>

                        {/* "Because You Watched..." Lineage Banner */}
                        {becauseYouWatched.length > 0 && (
                          <div className="px-3 py-1.5 rounded-lg bg-[#EFE8DA] border border-[#D5CCB9] text-xs text-[#171412] flex items-center flex-wrap gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-[#B8292F] shrink-0" />
                            <span className="text-[#52483E]">
                              Because you watched
                            </span>
                            {becauseYouWatched.map((bw, i) => (
                              <React.Fragment key={bw.id}>
                                <strong className="font-semibold text-[#171412]">
                                  {bw.title} ({bw.year})
                                </strong>
                                {i < becauseYouWatched.length - 1 && (
                                  <span className="text-[#6B5E50]">&amp;</span>
                                )}
                              </React.Fragment>
                            ))}
                            {becauseYouWatched[0]?.topShared.length > 0 && (
                              <span className="text-[#52483E]">
                                — {becauseYouWatched[0].topShared.join(' · ')}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Synopsis */}
                        <p className="text-xs text-[#2C2620] leading-relaxed line-clamp-2">
                          {item.synopsis}
                        </p>

                        {/* Shared Craft, Genre & Theme Reason Pills */}
                        <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
                          {reasons.map((reason) => (
                            <span
                              key={reason.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-[#F6F1E7] border border-[#D5CCB9] text-[#171412]"
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: reason.color }}
                              />
                              <span className="text-[#52483E]">
                                {reason.prefix}:
                              </span>
                              <span className="font-semibold">
                                {reason.value}
                              </span>
                            </span>
                          ))}
                        </div>

                        {/* Bottom Bar: Regional Streaming + Quick Actions */}
                        <div className="pt-2 border-t border-[#E5DEC9] flex flex-wrap items-center justify-between gap-2">
                          {/* Regional Streaming Badges */}
                          <div className="flex items-center flex-wrap gap-1.5 text-xs">
                            <span className="text-[11px] font-semibold text-[#6B5E50]">
                              Watch ({region}):
                            </span>
                            {streamOffers.length > 0 ? (
                              streamOffers.map((offer, i) => (
                                <a
                                  key={`${offer.provider}-${i}`}
                                  href={offer.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#E3EFEA] hover:bg-[#D1E6DD] text-[#1E563F] border border-[#B3D4C5] transition-colors"
                                >
                                  <Play className="w-2.5 h-2.5 fill-current" />
                                  <span>{offer.provider}</span>
                                  <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                                </a>
                              ))
                            ) : (
                              <span className="text-[11px] text-[#6B5E50]">
                                Rent / Buy on Apple TV &amp; Prime Video
                              </span>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div
                            className="flex items-center flex-wrap gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => onToggleWatched(item.id)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                                isWatched
                                  ? 'bg-[#E4F0EA] text-[#1E563F] border-[#B3D4C5]'
                                  : 'bg-[#F6F1E7] hover:bg-[#EFE8DA] text-[#171412] border-[#C8BEAA]'
                              }`}
                            >
                              <Check className="w-3 h-3" />
                              <span>
                                {isWatched ? 'Watched ✓' : 'Mark Watched'}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (!isWatched) {
                                  onToggleWatched(item.id);
                                }
                                onFiltersChange((prev) => ({
                                  ...prev,
                                  seedMediaIds: [item.id],
                                }));
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-[#F6F1E7] hover:bg-[#EFE8DA] text-[#52483E] hover:text-[#171412] border border-[#C8BEAA] transition-colors cursor-pointer"
                              title="Pivot suggestions around this title"
                            >
                              <Crosshair className="w-3 h-3 text-[#B8292F]" />
                              <span>More Like This</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onExploreIn3D(item.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-[#234B6E] hover:bg-[#1A3854] text-[#FBF8F2] transition-colors cursor-pointer"
                              title="Center 3D Constellation around this title"
                            >
                              <Orbit className="w-3 h-3" />
                              <span>3D Map</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-[#FBF8F2] border border-[#C8BEAA] text-center space-y-3">
              <p className="font-heading text-base font-bold text-[#171412]">
                No titles match this exact filter combination in the local
                archive yet.
              </p>
              <p className="text-xs text-[#52483E] max-w-md mx-auto">
                You can fetch fresh live matches from the global catalog for
                this genre/seed, or relax one of your active filters.
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={isFetchingLive}
                  onClick={() =>
                    onFetchLiveSuggestions({
                      seedItem: primarySeedForLiveFetch,
                      genre: filters.selectedGenres[0],
                      mediaType: filters.mediaFilter,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#B8292F] hover:bg-[#8C1D22] text-[#FBF8F2] cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Fetch Live Matches Now</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#EFE8DA] hover:bg-[#E5DEC9] text-[#171412] border border-[#C8BEAA] cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Filters</span>
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
