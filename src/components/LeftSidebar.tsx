'use client';

import React, { useState } from 'react';
import {
  Check,
  RotateCcw,
  Crosshair,
  Film,
  Tv,
  Layers,
  Award,
  UserCheck,
  Compass,
  Bookmark,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  User,
  Orbit,
  Sparkles,
} from 'lucide-react';
import {
  EntityNodeType,
  EntityVisibility,
  FilterMatchMode,
  ForceSettings,
  GraphFilterBehavior,
  GraphFilterState,
  GraphLayoutMode,
  GraphNode,
  GraphScopeMode,
  GravityPreset,
  LabelDisplayMode,
  MediaItem,
  NodeColorMode,
  NodeSizeMode,
  SemanticCluster,
  UserProfile,
} from '@/lib/types';
import { SEMANTIC_CLUSTER_DEFINITIONS } from '@/lib/similarity';
import { FirestoreSyncTelemetry, QuotaTelemetry } from '@/lib/api';
import { PwaInstallButton } from './PwaInstallButton';

interface LeftSidebarProps {
  focalItem: MediaItem | null;
  totalMediaCount: number;
  mediaCounts?: {
    all: number;
    movies: number;
    tv: number;
  };
  nodes?: GraphNode[];
  onClearFocal: () => void;
  mediaFilter: 'ALL' | 'MOVIE' | 'TV';
  onMediaFilterChange: (val: 'ALL' | 'MOVIE' | 'TV') => void;
  preset: GravityPreset;
  onPresetChange: (val: GravityPreset) => void;
  forceSettings: ForceSettings;
  onForceSettingsChange: (next: ForceSettings) => void;
  visibility: EntityVisibility;
  onToggleVisibility: (type: EntityNodeType) => void;
  onResetAllVisibility?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  autoExpandEnabled?: boolean;
  onToggleAutoExpand?: () => void;
  onTriggerExpandNow?: () => void;
  isAutoExpanding?: boolean;
  autoExpandTarget?: number;
  lastCollaboratorCrawled?: string | null;
  quotaTelemetry?: QuotaTelemetry | null;
  firestoreTelemetry?: FirestoreSyncTelemetry | null;
  expandedCount?: number;
  onResetExpandedCatalog?: () => void;
  onFirestoreConfigUpdated?: () => void;
  watchedCount?: number;
  interestedCount?: number;
  isSuggestMode?: boolean;
  onOpenSuggestions?: () => void;
  onSuggestByGenre?: (genre: string) => void;
  activeUser?: UserProfile | null;
  graphScope?: GraphScopeMode;
  onGraphScopeChange?: (scope: GraphScopeMode) => void;
  onOpenProfileModal?: () => void;
  // Movie Map REA Filter & Display Props
  graphFilters?: GraphFilterState;
  onGraphFiltersChange?: (next: GraphFilterState) => void;
  layoutMode?: GraphLayoutMode;
  onLayoutModeChange?: (mode: GraphLayoutMode) => void;
  colorMode?: NodeColorMode;
  onColorModeChange?: (mode: NodeColorMode) => void;
  sizeMode?: NodeSizeMode;
  onSizeModeChange?: (mode: NodeSizeMode) => void;
  labelMode?: LabelDisplayMode;
  onLabelModeChange?: (mode: LabelDisplayMode) => void;
  clusters?: SemanticCluster[];
  matchingMediaCount?: number;
}

export function LeftSidebar({
  focalItem,
  totalMediaCount,
  mediaCounts,
  nodes = [],
  onClearFocal,
  mediaFilter,
  onMediaFilterChange,
  preset,
  onPresetChange,
  forceSettings,
  onForceSettingsChange,
  visibility,
  onToggleVisibility,
  onResetAllVisibility,
  mobileOpen = false,
  onCloseMobile,
  watchedCount = 0,
  interestedCount = 0,
  isSuggestMode = false,
  onOpenSuggestions,
  onSuggestByGenre,
  activeUser = null,
  graphScope = 'FULL_ARCHIVE',
  onGraphScopeChange,
  onOpenProfileModal,
  graphFilters,
  onGraphFiltersChange,
  layoutMode = 'FORCE_CONSTELLATION',
  onLayoutModeChange,
  colorMode = 'CATEGORY',
  onColorModeChange,
  sizeMode = 'RATING',
  onSizeModeChange,
  labelMode = 'AUTO',
  onLabelModeChange,
  clusters = [],
  matchingMediaCount,
}: LeftSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [keywordSearch, setKeywordSearch] = useState('');

  const presets: Array<{
    id: GravityPreset;
    title: string;
    subtitle: string;
    badge: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'VIBE_TROPES',
      title: 'Story & Themes',
      subtitle: 'Shared narrative motifs & structural kinship',
      badge: '1×',
      icon: Compass,
    },
    {
      id: 'AUTEUR_ORBIT',
      title: 'Director & Craft',
      subtitle: 'Prioritises directors, writers & composers',
      badge: '2×',
      icon: Award,
    },
    {
      id: 'STAR_CONSTELLATION',
      title: 'Shared Cast',
      subtitle: 'Prioritises shared lead & supporting actors',
      badge: '3×',
      icon: UserCheck,
    },
  ];

  const entityToggles: Array<{
    type: EntityNodeType;
    label: string;
    shapeLabel: string;
    color: string;
  }> = [
    {
      type: 'MOVIE',
      label: 'Feature Films',
      shapeLabel: '35mm Film Reel',
      color: '#234B6E',
    },
    {
      type: 'TV',
      label: 'TV Series',
      shapeLabel: 'Broadcast Monitor',
      color: '#6B3A6E',
    },
    {
      type: 'DIRECTOR',
      label: 'Directors & Writers',
      shapeLabel: 'Auteur Clapperboard',
      color: '#B8292F',
    },
    {
      type: 'ACTOR',
      label: 'Actors & Cast',
      shapeLabel: '5-Point Cast Star',
      color: '#B86B14',
    },
    {
      type: 'TROPE',
      label: 'Specific Themes',
      shapeLabel: 'Open Story Tome',
      color: '#2A6B53',
    },
    {
      type: 'COMPOSER',
      label: 'Score & Camera',
      shapeLabel: 'Harmonic Eighth Note',
      color: '#A63A2B',
    },
  ];

  /**
   * Renders the exact category emblem matching the 3D sculptural models & 2D medallions in the graph:
   * - MOVIE: 35mm Cinema Film Reel with 5 spool cutouts
   * - TV: Widescreen Broadcast Monitor with V-antennae & pedestal
   * - DIRECTOR: Hinged Director's Clapperboard with diagonal stripes
   * - ACTOR: 5-Pointed Walk-of-Fame Star Medallion
   * - TROPE: Open Archival Story Book with spine
   * - COMPOSER: Beamed Musical Eighth Note (♫)
   */
  const renderCategoryShapeIcon = (type: EntityNodeType, color: string) => {
    switch (type) {
      case 'MOVIE':
        return (
          <svg
            className="w-4 h-4 shrink-0"
            style={{ color }}
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="8" cy="8" r="6.6" fill="currentColor" />
            <circle
              cx="8"
              cy="8"
              r="5.6"
              stroke="#FBF8F2"
              strokeWidth="0.6"
              strokeOpacity="0.55"
            />
            <circle cx="8" cy="4.1" r="1.25" fill="#FBF8F2" />
            <circle cx="11.7" cy="6.8" r="1.25" fill="#FBF8F2" />
            <circle cx="10.3" cy="11.15" r="1.25" fill="#FBF8F2" />
            <circle cx="5.7" cy="11.15" r="1.25" fill="#FBF8F2" />
            <circle cx="4.3" cy="6.8" r="1.25" fill="#FBF8F2" />
            <circle cx="8" cy="8" r="1.05" fill="#FBF8F2" />
          </svg>
        );
      case 'TV':
        return (
          <svg
            className="w-4 h-4 shrink-0"
            style={{ color }}
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5.1 1.7L7.3 4.1M10.9 1.7L8.7 4.1"
              stroke="currentColor"
              strokeWidth="1.35"
              strokeLinecap="round"
            />
            <rect
              x="1.8"
              y="3.9"
              width="12.4"
              height="8.4"
              rx="1.8"
              fill="currentColor"
            />
            <rect
              x="3.1"
              y="5.2"
              width="8.2"
              height="5.8"
              rx="0.9"
              fill="#FBF8F2"
            />
            <circle cx="12.7" cy="6.7" r="0.65" fill="#FBF8F2" />
            <circle cx="12.7" cy="9.1" r="0.65" fill="#FBF8F2" />
            <path
              d="M5.2 14.1H10.8"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        );
      case 'DIRECTOR':
        return (
          <svg
            className="w-4 h-4 shrink-0"
            style={{ color }}
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="2"
              y="6.2"
              width="12"
              height="7.8"
              rx="1.4"
              fill="currentColor"
            />
            <path
              d="M2.1 5.3L13.4 2.2L14.1 4.4L2.8 7.5Z"
              fill="currentColor"
            />
            <path
              d="M5.2 4.5L6.2 6.5M8.4 3.6L9.4 5.6M11.5 2.8L12.5 4.8"
              stroke="#FBF8F2"
              strokeWidth="1.15"
              strokeLinecap="round"
            />
            <path
              d="M4.3 9.4H11.7M4.3 11.6H8.8"
              stroke="#FBF8F2"
              strokeWidth="1.15"
              strokeLinecap="round"
            />
          </svg>
        );
      case 'ACTOR':
        return (
          <svg
            className="w-4 h-4 shrink-0"
            style={{ color }}
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="8"
              cy="8"
              r="6.6"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeOpacity="0.45"
            />
            <polygon
              points="8,1.5 9.85,5.6 14.3,6.1 10.95,9.1 11.95,13.5 8,11.2 4.05,13.5 5.05,9.1 1.7,6.1 6.15,5.6"
              fill="currentColor"
            />
            <circle cx="8" cy="8.1" r="1.35" fill="#FBF8F2" />
          </svg>
        );
      case 'TROPE':
        return (
          <svg
            className="w-4 h-4 shrink-0"
            style={{ color }}
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M8 3.5C6.1 2.3 3.4 2.5 1.6 3.5V12.7C3.4 11.7 6.1 11.5 8 12.7C9.9 11.5 12.6 11.7 14.4 12.7V3.5C12.6 2.5 9.9 2.3 8 3.5Z"
              fill="currentColor"
            />
            <path
              d="M8 3.6V12.5"
              stroke="#FBF8F2"
              strokeWidth="1.25"
              strokeLinecap="round"
            />
            <path
              d="M3.4 6.2H6.3M3.4 8.4H6.1M9.7 6.2H12.6M9.7 8.4H12.3"
              stroke="#FBF8F2"
              strokeWidth="0.95"
              strokeLinecap="round"
              strokeOpacity="0.85"
            />
          </svg>
        );
      case 'COMPOSER':
        return (
          <svg
            className="w-4 h-4 shrink-0"
            style={{ color }}
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <ellipse
              cx="4.7"
              cy="12.1"
              rx="2.3"
              ry="1.75"
              transform="rotate(-18 4.7 12.1)"
              fill="currentColor"
            />
            <ellipse
              cx="11.4"
              cy="10.7"
              rx="2.3"
              ry="1.75"
              transform="rotate(-18 11.4 10.7)"
              fill="currentColor"
            />
            <path
              d="M6.5 11.8V3.7L13.2 2.3V10.4"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M6.5 5.6L13.2 4.2"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        );
    }
  };

  const nodeCountsByType = React.useMemo(() => {
    const counts: Record<EntityNodeType, number> = {
      MOVIE: 0,
      TV: 0,
      DIRECTOR: 0,
      ACTOR: 0,
      TROPE: 0,
      COMPOSER: 0,
    };
    for (const n of nodes) {
      counts[n.type] = (counts[n.type] || 0) + 1;
    }
    return counts;
  }, [nodes]);

  const activeLayersCount = Object.values(visibility).filter(Boolean).length;
  const hasAnyHiddenLayer = activeLayersCount < 6;
  const allGenresList = React.useMemo(() => {
    const set = new Set<string>();
    for (const n of nodes) {
      if (n.mediaItem?.genres) {
        for (const g of n.mediaItem.genres) set.add(g);
      }
    }
    return Array.from(set).sort();
  }, [nodes]);

  const allTropesList = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const n of nodes) {
      if (n.mediaItem?.tropes) {
        for (const t of n.mediaItem.tropes) {
          const count = map.get(t) || 0;
          map.set(t, count + 1);
        }
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t);
  }, [nodes]);

  const filteredTropes = React.useMemo(() => {
    if (!keywordSearch.trim()) return allTropesList.slice(0, 18);
    const q = keywordSearch.trim().toLowerCase();
    return allTropesList.filter((t) => t.toLowerCase().includes(q)).slice(0, 24);
  }, [allTropesList, keywordSearch]);

  const hasMovieMapFilters = Boolean(
    graphFilters &&
      (graphFilters.selectedGenres.length > 0 ||
        graphFilters.selectedTropes.length > 0 ||
        graphFilters.yearRange[0] > 1970 ||
        graphFilters.yearRange[1] < 2030 ||
        graphFilters.minImdbRating > 0 ||
        graphFilters.watchedFilter !== 'ALL' ||
        Boolean(graphFilters.activeClusterId))
  );

  const hasCustomSettings =
    Boolean(focalItem) ||
    mediaFilter !== 'ALL' ||
    preset !== 'VIBE_TROPES' ||
    forceSettings.matchThreshold !== 15 ||
    hasAnyHiddenLayer ||
    hasMovieMapFilters ||
    layoutMode !== 'FORCE_CONSTELLATION' ||
    colorMode !== 'CATEGORY' ||
    sizeMode !== 'RATING' ||
    labelMode !== 'AUTO';

  const handleResetAll = () => {
    if (focalItem) onClearFocal();
    onMediaFilterChange('ALL');
    onPresetChange('VIBE_TROPES');
    onForceSettingsChange({
      ...forceSettings,
      matchThreshold: 15,
    });
    onResetAllVisibility?.();
    if (onGraphFiltersChange && graphFilters) {
      onGraphFiltersChange({
        ...graphFilters,
        selectedGenres: [],
        selectedTropes: [],
        matchMode: 'OR',
        filterBehavior: 'DIM',
        yearRange: [1970, 2030],
        minImdbRating: 0,
        watchedFilter: 'ALL',
        activeClusterId: null,
        searchHighlightQuery: '',
      });
    }
    onLayoutModeChange?.('FORCE_CONSTELLATION');
    onColorModeChange?.('CATEGORY');
    onSizeModeChange?.('RATING');
    onLabelModeChange?.('AUTO');
  };

  // Minimal Collapsed Rail (52px wide)
  if (collapsed) {
    return (
      <aside
        aria-label="Collapsed Curatorial Controls"
        className="hidden lg:flex w-[52px] shrink-0 h-[calc(100vh-3.5rem)] bg-[#EFE8DA] border-r border-[#D5CCB9] flex-col items-center py-3 gap-2 z-20 select-none"
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="w-8 h-8 rounded bg-[#FBF8F2] hover:bg-[#E5DEC9] border border-[#C8BEAA] flex items-center justify-center text-[#171412] shadow-archival-sm transition-colors cursor-pointer"
          aria-label="Expand Curatorial Sidebar"
          title="Expand Curatorial Sidebar"
        >
          <PanelLeftOpen className="w-4 h-4 text-[#52483E]" aria-hidden="true" />
        </button>

        {focalItem && (
          <button
            type="button"
            onClick={onClearFocal}
            className="w-8 h-8 rounded bg-[#F5E4E4] hover:bg-[#B8292F] text-[#8C1D22] hover:text-[#FBF8F2] border border-[#D8B4B6] flex items-center justify-center transition-colors cursor-pointer"
            title={`Centered on "${focalItem.title}" — Click to show all titles`}
            aria-label={`Clear focal title ${focalItem.title}`}
          >
            <Crosshair className="w-4 h-4" aria-hidden="true" />
          </button>
        )}

        <div className="w-6 h-px bg-[#D5CCB9] my-0.5" aria-hidden="true" />

        {entityToggles.map((item) => {
          const active = visibility[item.type];
          const count = nodeCountsByType[item.type] || 0;
          return (
            <button
              key={item.type}
              type="button"
              onClick={() => onToggleVisibility(item.type)}
              className={`relative w-8 h-8 rounded border flex items-center justify-center transition-all cursor-pointer ${
                active
                  ? 'bg-[#FBF8F2] border-[#C8BEAA] shadow-archival-sm'
                  : 'bg-[#E5DEC9]/45 border-transparent opacity-40 hover:opacity-80'
              }`}
              title={`${item.label} (${item.shapeLabel}): ${active ? 'Visible' : 'Hidden'} (${count} in graph)`}
              aria-label={`Toggle ${item.label}`}
              aria-pressed={active}
            >
              {renderCategoryShapeIcon(item.type, item.color)}
              {active && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#FBF8F2]"
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}

        {hasCustomSettings && (
          <>
            <div className="w-6 h-px bg-[#D5CCB9] my-0.5" aria-hidden="true" />
            <button
              type="button"
              onClick={handleResetAll}
              className="w-8 h-8 rounded bg-[#FBF8F2] hover:bg-[#B8292F] text-[#8C1D22] hover:text-[#FBF8F2] border border-[#C8BEAA] flex items-center justify-center transition-colors cursor-pointer"
              title="Reset all filters and lenses"
              aria-label="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </>
        )}
      </aside>
    );
  }

  const sidebarContent = (
    <>
      {/* Editorial Rail Header */}
      <div className="h-11 px-4 border-b border-[#D5CCB9] bg-[#EFE8DA] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="font-heading text-[15px] font-bold text-[#171412] tracking-tight truncate">
            Filters &amp; Lenses
          </h2>
          {hasCustomSettings && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#B8292F] shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-1">
          {hasCustomSettings && (
            <button
              type="button"
              onClick={handleResetAll}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold text-[#8C1D22] bg-[#F5E4E4]/70 hover:bg-[#B8292F] hover:text-[#FBF8F2] border border-[#D8B4B6] transition-colors cursor-pointer"
              title="Reset all filters and lenses"
            >
              <RotateCcw className="w-2.5 h-2.5" aria-hidden="true" />
              <span>Reset</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="hidden lg:inline-flex items-center justify-center w-6 h-6 rounded text-[#52483E] hover:text-[#171412] hover:bg-[#E5DEC9] transition-colors cursor-pointer"
            aria-label="Collapse Sidebar"
            title="Collapse sidebar to icon rail"
          >
            <PanelLeftClose className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden inline-flex items-center justify-center w-6 h-6 rounded text-[#52483E] hover:text-[#171412] hover:bg-[#E5DEC9] transition-colors cursor-pointer"
              aria-label="Close Menu"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Curatorial Sections (hairline-divided, zero nested card boxes) */}
      <div className="divide-y divide-[#D5CCB9] overflow-y-auto flex-1">
        {/* 0. Personal Profile & My Watched / Interested Graphs */}
        <section className="px-4 py-4 space-y-2.5 bg-[#FBF8F2]/65">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-heading text-[15px] font-bold text-[#171412] flex items-center gap-1.5">
              <Bookmark
                className="w-3.5 h-3.5 text-[#B8292F] shrink-0"
                aria-hidden="true"
              />
              <span>Personal Graphs</span>
            </h3>
            {activeUser && (
              <div className="flex items-center gap-1">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-tabular font-semibold bg-[#E3EFEA] text-[#2A6B53] border border-[#B4D4C7]">
                  {watchedCount}W
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-tabular font-semibold bg-[#E6EEF6] text-[#234B6E] border border-[#B6C8DC]">
                  {interestedCount}I
                </span>
              </div>
            )}
          </div>

          {onOpenProfileModal && (
            <button
              type="button"
              onClick={onOpenProfileModal}
              className="w-full py-2 px-2.5 rounded-lg bg-[#EFE8DA] hover:bg-[#E5DEC9] border border-[#C8BEAA] flex items-center justify-between gap-2 text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                {activeUser ? (
                  <span
                    className="w-6 h-6 rounded-full text-[10px] font-bold text-[#FBF8F2] flex items-center justify-center shrink-0"
                    style={{ backgroundColor: activeUser.avatarColor }}
                  >
                    {activeUser.displayName.slice(0, 2).toUpperCase()}
                  </span>
                ) : (
                  <span className="w-6 h-6 rounded-full bg-[#B8292F]/15 text-[#B8292F] flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5" aria-hidden="true" />
                  </span>
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#171412] truncate">
                    {activeUser
                      ? activeUser.displayName
                      : 'Sign In to Unlock Lists'}
                  </div>
                  <div className="text-[10px] text-[#52483E] truncate">
                    {activeUser
                      ? `@${activeUser.handle} · Watchlist & Interested`
                      : 'Access Watched & Interested graphs'}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-[#B8292F] shrink-0">
                {activeUser ? 'Manage' : 'Sign In'}
              </span>
            </button>
          )}

          {activeUser && onGraphScopeChange && (
            <div className="space-y-1 pt-0.5">
              <div className="text-[11px] font-semibold text-[#52483E]">
                Constellation Source
              </div>
              <div
                role="group"
                aria-label="Constellation graph scope"
                className="grid grid-cols-1 gap-1 p-1 rounded bg-[#E5DEC9] border border-[#C8BEAA]"
              >
                {(
                  [
                    {
                      id: 'FULL_ARCHIVE',
                      label: 'Full Archive Catalog',
                      icon: Layers,
                    },
                    {
                      id: 'WATCHED_ONLY',
                      label: `My Watched Graph (${watchedCount})`,
                      icon: Orbit,
                    },
                    {
                      id: 'INTERESTED_ONLY',
                      label: `My Interested Graph (${interestedCount})`,
                      icon: Bookmark,
                    },
                    {
                      id: 'WATCHED_AND_INTERESTED',
                      label: `Watched + Interested (${watchedCount + interestedCount})`,
                      icon: Orbit,
                    },
                    {
                      id: 'WATCHED_PLUS_SUGGESTIONS',
                      label: 'Watched + Top Suggestions',
                      icon: Sparkles,
                    },
                  ] as const
                ).map((sc) => {
                  const Icon = sc.icon;
                  const active = graphScope === sc.id;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onGraphScopeChange(sc.id)}
                      className={`flex items-center justify-between gap-2 py-1.5 px-2.5 rounded text-xs font-semibold transition-all cursor-pointer ${
                        active
                          ? 'bg-[#FBF8F2] text-[#171412] border border-[#B5A892] shadow-archival-sm'
                          : 'text-[#52483E] hover:text-[#171412] border border-transparent'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <Icon
                          className={`w-3.5 h-3.5 shrink-0 ${
                            active ? 'text-[#2A6B53]' : 'text-[#6B5E50]'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="truncate">{sc.label}</span>
                      </span>
                      {active && (
                        <Check
                          className="w-3 h-3 text-[#2A6B53] shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {onOpenSuggestions && (
            <button
              type="button"
              onClick={onOpenSuggestions}
              className={`w-full py-2 px-3 rounded text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                isSuggestMode
                  ? 'bg-[#F5E4E4] text-[#8C1D22] border-[#D8B4B6]'
                  : 'bg-[#B8292F] hover:bg-[#8C1D22] text-[#FBF8F2] border-[#8C1D22] shadow-archival-sm'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {isSuggestMode
                  ? 'Suggestion Studio Active'
                  : 'Open Watch Suggestions'}
              </span>
            </button>
          )}

          {onSuggestByGenre && (
            <div className="pt-0.5 flex items-center flex-wrap gap-1">
              {(
                ['Sci-Fi', 'Thriller', 'Mystery', 'Drama', 'Crime'] as const
              ).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => onSuggestByGenre(g)}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FBF8F2] hover:bg-[#234B6E] text-[#52483E] hover:text-[#FBF8F2] border border-[#C8BEAA] hover:border-[#234B6E] transition-colors cursor-pointer"
                >
                  {g}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* 1. Scope & Media Format */}
        <section className="px-4 py-4 space-y-3">
          {focalItem && (
            <div className="pb-3 border-b border-[#D5CCB9] flex items-center justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <Crosshair
                  className="w-3.5 h-3.5 text-[#B8292F] shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <div className="font-heading text-sm font-bold text-[#171412] truncate">
                    {focalItem.title}
                  </div>
                  <div className="text-[11px] text-[#52483E]">
                    Centered focal title ({focalItem.year})
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClearFocal}
                className="px-2 py-1 rounded text-[11px] font-semibold bg-[#FBF8F2] hover:bg-[#B8292F] text-[#171412] hover:text-[#FBF8F2] border border-[#C8BEAA] hover:border-[#8C1D22] transition-colors cursor-pointer shrink-0"
              >
                Show All
              </button>
            </div>
          )}

          {/* MOVIE MAP REA: GALAXY & NODE STYLE SECTION */}
          <div className="space-y-2.5 pb-3 border-b border-[#D5CCB9]">
            <div className="flex items-baseline justify-between">
              <h3 className="font-heading text-[15px] font-bold text-[#171412] flex items-center gap-1.5">
                <Orbit className="w-3.5 h-3.5 text-[#234B6E]" aria-hidden="true" />
                <span>Galaxy Projection</span>
              </h3>
              <span className="text-[11px] font-semibold text-[#6B5E50]">
                {layoutMode === 'SEMANTIC_GALAXY' ? 'UMAP Clusters' : 'Physics Orbit'}
              </span>
            </div>

            {/* Layout Mode: Constellation vs Semantic Galaxy */}
            <div
              role="group"
              aria-label="Graph layout projection"
              className="grid grid-cols-2 gap-1 p-1 rounded bg-[#E5DEC9] border border-[#C8BEAA]"
            >
              <button
                type="button"
                onClick={() => onLayoutModeChange?.('FORCE_CONSTELLATION')}
                className={`py-1.5 px-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  layoutMode === 'FORCE_CONSTELLATION'
                    ? 'bg-[#FBF8F2] text-[#171412] border border-[#B5A892] shadow-archival-sm'
                    : 'text-[#52483E] hover:text-[#171412] border border-transparent'
                }`}
              >
                <Compass className="w-3 h-3 text-[#234B6E]" />
                <span>Constellation</span>
              </button>
              <button
                type="button"
                onClick={() => onLayoutModeChange?.('SEMANTIC_GALAXY')}
                className={`py-1.5 px-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  layoutMode === 'SEMANTIC_GALAXY'
                    ? 'bg-[#FBF8F2] text-[#171412] border border-[#B5A892] shadow-archival-sm'
                    : 'text-[#52483E] hover:text-[#171412] border border-transparent'
                }`}
              >
                <Sparkles className="w-3 h-3 text-[#B8292F]" />
                <span>Semantic Galaxy</span>
              </button>
            </div>

            {/* Color By Mode: Cluster, Genre, Decade, Category */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[#52483E]">
                Color Nodes By
              </label>
              <div className="grid grid-cols-4 gap-1 p-1 rounded bg-[#E5DEC9] border border-[#C8BEAA]">
                {(
                  [
                    { id: 'CLUSTER', label: 'Cluster' },
                    { id: 'GENRE', label: 'Genre' },
                    { id: 'DECADE', label: 'Decade' },
                    { id: 'CATEGORY', label: 'Type' },
                  ] as const
                ).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onColorModeChange?.(c.id)}
                    className={`py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                      colorMode === c.id
                        ? 'bg-[#FBF8F2] text-[#171412] border border-[#B5A892] shadow-archival-sm'
                        : 'text-[#52483E] hover:text-[#171412] border border-transparent'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Size By Mode: Rating, Connections, Uniform */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[#52483E]">
                Size Nodes By
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 rounded bg-[#E5DEC9] border border-[#C8BEAA]">
                {(
                  [
                    { id: 'RATING', label: 'IMDb Rating' },
                    { id: 'CONNECTIONS', label: 'Bridges' },
                    { id: 'UNIFORM', label: 'Uniform' },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSizeModeChange?.(s.id)}
                    className={`py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                      sizeMode === s.id
                        ? 'bg-[#FBF8F2] text-[#171412] border border-[#B5A892] shadow-archival-sm'
                        : 'text-[#52483E] hover:text-[#171412] border border-transparent'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Label Display Mode (Auto, All, Off) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-[#52483E]">
                  Canvas Labels
                </label>
                <span className="text-[10px] text-[#6B5E50] font-mono">Press 'L'</span>
              </div>
              <div className="grid grid-cols-3 gap-1 p-1 rounded bg-[#E5DEC9] border border-[#C8BEAA]">
                {(
                  [
                    { id: 'AUTO', label: 'Auto (LOD)' },
                    { id: 'ALL', label: 'All Labels' },
                    { id: 'OFF', label: 'Off' },
                  ] as const
                ).map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => onLabelModeChange?.(l.id)}
                    className={`py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                      labelMode === l.id
                        ? 'bg-[#FBF8F2] text-[#171412] border border-[#B5A892] shadow-archival-sm'
                        : 'text-[#52483E] hover:text-[#171412] border border-transparent'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* MOVIE MAP REA: MULTI-FACETED FILTER CONTROLS */}
          {graphFilters && onGraphFiltersChange && (
            <div className="space-y-3 pb-3 border-b border-[#D5CCB9]">
              <div className="flex items-baseline justify-between">
                <h3 className="font-heading text-[15px] font-bold text-[#171412] flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-[#B8292F]" aria-hidden="true" />
                  <span>Map Filters</span>
                </h3>
                <span className="text-xs font-tabular font-bold text-[#2A6B53]">
                  {matchingMediaCount !== undefined ? matchingMediaCount : totalMediaCount} of {totalMediaCount}
                </span>
              </div>

              {/* Match Mode (OR vs AND) & Filter Behavior (DIM vs HIDE) */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-[#6B5E50] uppercase tracking-wider block mb-1">
                    Match Logic
                  </label>
                  <div className="grid grid-cols-2 gap-0.5 p-0.5 rounded bg-[#E5DEC9] border border-[#C8BEAA]">
                    <button
                      type="button"
                      onClick={() =>
                        onGraphFiltersChange({
                          ...graphFilters,
                          matchMode: 'OR',
                        })
                      }
                      className={`py-1 text-[11px] font-bold rounded cursor-pointer ${
                        graphFilters.matchMode === 'OR'
                          ? 'bg-[#FBF8F2] text-[#8C1D22] shadow-archival-sm'
                          : 'text-[#52483E]'
                      }`}
                    >
                      Any (OR)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onGraphFiltersChange({
                          ...graphFilters,
                          matchMode: 'AND',
                        })
                      }
                      className={`py-1 text-[11px] font-bold rounded cursor-pointer ${
                        graphFilters.matchMode === 'AND'
                          ? 'bg-[#FBF8F2] text-[#8C1D22] shadow-archival-sm'
                          : 'text-[#52483E]'
                      }`}
                    >
                      All (AND)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-[#6B5E50] uppercase tracking-wider block mb-1">
                    Canvas Mode
                  </label>
                  <div className="grid grid-cols-2 gap-0.5 p-0.5 rounded bg-[#E5DEC9] border border-[#C8BEAA]">
                    <button
                      type="button"
                      onClick={() =>
                        onGraphFiltersChange({
                          ...graphFilters,
                          filterBehavior: 'DIM',
                        })
                      }
                      title="Keep non-matching nodes visible at low opacity"
                      className={`py-1 text-[11px] font-bold rounded cursor-pointer ${
                        graphFilters.filterBehavior === 'DIM'
                          ? 'bg-[#FBF8F2] text-[#234B6E] shadow-archival-sm'
                          : 'text-[#52483E]'
                      }`}
                    >
                      Dim
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onGraphFiltersChange({
                          ...graphFilters,
                          filterBehavior: 'HIDE',
                        })
                      }
                      title="Prune non-matching nodes entirely"
                      className={`py-1 text-[11px] font-bold rounded cursor-pointer ${
                        graphFilters.filterBehavior === 'HIDE'
                          ? 'bg-[#FBF8F2] text-[#234B6E] shadow-archival-sm'
                          : 'text-[#52483E]'
                      }`}
                    >
                      Hide
                    </button>
                  </div>
                </div>
              </div>

              {/* Watched / Want to Watch Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[#52483E]">
                  Watched Status
                </label>
                <div className="grid grid-cols-4 gap-1 p-1 rounded bg-[#E5DEC9] border border-[#C8BEAA]">
                  {(
                    [
                      { id: 'ALL', label: 'All' },
                      { id: 'WATCHED', label: 'Watched' },
                      { id: 'UNWATCHED', label: 'Unwatched' },
                      { id: 'INTERESTED', label: 'Want Watch' },
                    ] as const
                  ).map((wf) => (
                    <button
                      key={wf.id}
                      type="button"
                      onClick={() =>
                        onGraphFiltersChange({
                          ...graphFilters,
                          watchedFilter: wf.id,
                        })
                      }
                      className={`py-1 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                        graphFilters.watchedFilter === wf.id
                          ? 'bg-[#FBF8F2] text-[#171412] border border-[#B5A892] shadow-archival-sm'
                          : 'text-[#52483E] hover:text-[#171412] border border-transparent'
                      }`}
                    >
                      {wf.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Semantic Cluster Filter Chips */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-[#52483E]">
                    Semantic Cluster Focus
                  </label>
                  {graphFilters.activeClusterId && (
                    <button
                      type="button"
                      onClick={() =>
                        onGraphFiltersChange({
                          ...graphFilters,
                          activeClusterId: null,
                        })
                      }
                      className="text-[10px] text-[#B8292F] hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-1">
                  {SEMANTIC_CLUSTER_DEFINITIONS.map((c) => {
                    const isSelected = graphFilters.activeClusterId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          onGraphFiltersChange({
                            ...graphFilters,
                            activeClusterId: isSelected ? null : c.id,
                          })
                        }
                        style={{
                          backgroundColor: isSelected ? c.color : '#FBF8F2',
                          color: isSelected ? '#FBF8F2' : '#171412',
                          borderColor: isSelected ? c.color : '#C8BEAA',
                        }}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold border flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            backgroundColor: isSelected ? '#FBF8F2' : c.color,
                          }}
                        />
                        <span>{c.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Multi-Select Genres Filter */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-[#52483E]">
                    Filter by Genre ({graphFilters.selectedGenres.length} selected)
                  </label>
                  {graphFilters.selectedGenres.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        onGraphFiltersChange({
                          ...graphFilters,
                          selectedGenres: [],
                        })
                      }
                      className="text-[10px] text-[#B8292F] hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                  {allGenresList.map((g) => {
                    const active = graphFilters.selectedGenres.includes(g);
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          const next = active
                            ? graphFilters.selectedGenres.filter((item) => item !== g)
                            : [...graphFilters.selectedGenres, g];
                          onGraphFiltersChange({
                            ...graphFilters,
                            selectedGenres: next,
                          });
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#234B6E] text-[#FBF8F2] border-[#234B6E]'
                            : 'bg-[#FBF8F2] text-[#52483E] hover:text-[#171412] border-[#C8BEAA]'
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Multi-Select Themes / Tropes (Keywords) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-[#52483E]">
                    Themes &amp; Keywords ({graphFilters.selectedTropes.length} selected)
                  </label>
                  {graphFilters.selectedTropes.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        onGraphFiltersChange({
                          ...graphFilters,
                          selectedTropes: [],
                        })
                      }
                      className="text-[10px] text-[#B8292F] hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Search keywords…"
                  value={keywordSearch}
                  onChange={(e) => setKeywordSearch(e.target.value)}
                  className="w-full px-2 py-1 rounded text-xs bg-[#FBF8F2] border border-[#C8BEAA] text-[#171412] placeholder-[#8F816B] focus:outline-none focus:border-[#B8292F]"
                />
                <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-1">
                  {filteredTropes.map((t) => {
                    const active = graphFilters.selectedTropes.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          const next = active
                            ? graphFilters.selectedTropes.filter((item) => item !== t)
                            : [...graphFilters.selectedTropes, t];
                          onGraphFiltersChange({
                            ...graphFilters,
                            selectedTropes: next,
                          });
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#2A6B53] text-[#FBF8F2] border-[#2A6B53]'
                            : 'bg-[#FBF8F2] text-[#52483E] hover:text-[#171412] border-[#C8BEAA]'
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Year Era Slider */}
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <label className="text-[11px] font-semibold text-[#52483E]">
                    Release Year Range
                  </label>
                  <span className="text-xs font-tabular font-bold text-[#171412]">
                    {graphFilters.yearRange[0]} – {graphFilters.yearRange[1]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1970"
                    max="2030"
                    step="1"
                    value={graphFilters.yearRange[0]}
                    onChange={(e) =>
                      onGraphFiltersChange({
                        ...graphFilters,
                        yearRange: [
                          Math.min(parseInt(e.target.value, 10), graphFilters.yearRange[1]),
                          graphFilters.yearRange[1],
                        ],
                      })
                    }
                    className="w-full accent-[#B8292F] h-1.5 bg-[#D5CCB9] rounded cursor-pointer"
                  />
                  <input
                    type="range"
                    min="1970"
                    max="2030"
                    step="1"
                    value={graphFilters.yearRange[1]}
                    onChange={(e) =>
                      onGraphFiltersChange({
                        ...graphFilters,
                        yearRange: [
                          graphFilters.yearRange[0],
                          Math.max(parseInt(e.target.value, 10), graphFilters.yearRange[0]),
                        ],
                      })
                    }
                    className="w-full accent-[#B8292F] h-1.5 bg-[#D5CCB9] rounded cursor-pointer"
                  />
                </div>
                <div className="flex gap-1 pt-1">
                  {(
                    [
                      { label: 'All', range: [1970, 2030] },
                      { label: '2020s', range: [2020, 2030] },
                      { label: '2010s', range: [2010, 2019] },
                      { label: '2000s', range: [2000, 2009] },
                      { label: 'Classic', range: [1970, 1999] },
                    ] as const
                  ).map((era) => {
                    const isMatch =
                      graphFilters.yearRange[0] === era.range[0] &&
                      graphFilters.yearRange[1] === era.range[1];
                    return (
                      <button
                        key={era.label}
                        type="button"
                        onClick={() =>
                          onGraphFiltersChange({
                            ...graphFilters,
                            yearRange: [era.range[0], era.range[1]],
                          })
                        }
                        className={`flex-1 py-0.5 rounded text-[10px] font-semibold border transition-colors cursor-pointer ${
                          isMatch
                            ? 'bg-[#F5E4E4] text-[#8C1D22] border-[#D8B4B6]'
                            : 'bg-[#FBF8F2] text-[#6B5E50] border-[#D5CCB9]'
                        }`}
                      >
                        {era.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Minimum IMDb Rating Slider */}
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <label className="text-[11px] font-semibold text-[#52483E]">
                    Minimum Rating
                  </label>
                  <span className="text-xs font-tabular font-bold text-[#8C1D22]">
                    {graphFilters.minImdbRating > 0
                      ? `IMDb ${graphFilters.minImdbRating.toFixed(1)}+`
                      : 'Any Rating'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="9.0"
                  step="0.5"
                  value={graphFilters.minImdbRating}
                  onChange={(e) =>
                    onGraphFiltersChange({
                      ...graphFilters,
                      minImdbRating: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-[#B8292F] h-1.5 bg-[#D5CCB9] rounded cursor-pointer"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h3 className="font-heading text-[15px] font-bold text-[#171412]">
                Format
              </h3>
              <span className="text-xs font-tabular font-semibold text-[#52483E]">
                {totalMediaCount} Titles
              </span>
            </div>

            <div
              role="group"
              aria-label="Media format"
              className="grid grid-cols-3 gap-1 p-1 rounded bg-[#E5DEC9] border border-[#C8BEAA]"
            >
              {(
                [
                  {
                    id: 'ALL',
                    label: 'All',
                    count: mediaCounts?.all ?? totalMediaCount,
                    icon: Layers,
                  },
                  {
                    id: 'MOVIE',
                    label: 'Films',
                    count: mediaCounts?.movies,
                    icon: Film,
                  },
                  {
                    id: 'TV',
                    label: 'Series',
                    count: mediaCounts?.tv,
                    icon: Tv,
                  },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = mediaFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onMediaFilterChange(tab.id)}
                    className={`flex flex-col items-center justify-center py-1.5 px-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                      active
                        ? 'bg-[#FBF8F2] text-[#171412] border border-[#B5A892] shadow-archival-sm'
                        : 'text-[#52483E] hover:text-[#171412] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <Icon
                        className={`w-3 h-3 shrink-0 ${
                          active ? 'text-[#B8292F]' : 'text-[#6B5E50]'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{tab.label}</span>
                    </div>
                    {tab.count !== undefined && (
                      <span
                        className={`text-[10px] font-tabular leading-tight mt-0.5 ${
                          active ? 'text-[#52483E]' : 'text-[#6B5E50]'
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* 2. Curatorial Weighting Lens */}
        <section className="px-4 py-4 space-y-2.5">
          <div className="flex items-baseline justify-between">
            <h3 className="font-heading text-[15px] font-bold text-[#171412]">
              Curatorial Lens
            </h3>
            <span className="text-[11px] font-semibold text-[#6B5E50]">
              Weighting
            </span>
          </div>

          <div className="rounded overflow-hidden border border-[#C8BEAA] divide-y divide-[#D5CCB9] bg-[#FBF8F2]">
            {presets.map((p) => {
              const active = preset === p.id;
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onPresetChange(p.id)}
                  style={
                    active
                      ? { boxShadow: 'inset 3px 0 0 #B8292F' }
                      : undefined
                  }
                  className={`w-full text-left py-2.5 px-3 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#F5E4E4]/55'
                      : 'bg-[#FBF8F2] hover:bg-[#EFE8DA]/75'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon
                        className={`w-3.5 h-3.5 shrink-0 ${
                          active ? 'text-[#B8292F]' : 'text-[#6B5E50]'
                        }`}
                        aria-hidden="true"
                      />
                      <span
                        className={`text-xs font-bold truncate ${
                          active ? 'text-[#8C1D22]' : 'text-[#171412]'
                        }`}
                      >
                        {p.title}
                      </span>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-tabular font-bold border ${
                        active
                          ? 'bg-[#F5E4E4] text-[#8C1D22] border-[#D8B4B6]'
                          : 'bg-[#EFE8DA] text-[#52483E] border-[#D5CCB9]'
                      }`}
                    >
                      {p.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#52483E] mt-0.5 pl-5.5 leading-snug">
                    {p.subtitle}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. Minimum Affinity Cutoff */}
        <section className="px-4 py-4 space-y-2.5">
          <div className="flex items-baseline justify-between">
            <label
              htmlFor="slider-threshold"
              className="font-heading text-[15px] font-bold text-[#171412]"
            >
              Minimum Affinity
            </label>
            <span className="px-1.5 py-0.5 rounded text-xs font-bold font-tabular bg-[#FBF8F2] text-[#8C1D22] border border-[#C8BEAA]">
              {forceSettings.matchThreshold}%+
            </span>
          </div>

          <input
            id="slider-threshold"
            type="range"
            min="5"
            max="70"
            step="5"
            value={forceSettings.matchThreshold}
            onChange={(e) =>
              onForceSettingsChange({
                ...forceSettings,
                matchThreshold: parseInt(e.target.value, 10),
              })
            }
            className="w-full accent-[#B8292F] h-1.5 bg-[#D5CCB9] rounded cursor-pointer"
          />

          <div className="grid grid-cols-4 gap-1 pt-0.5">
            {([15, 30, 45, 60] as const).map((stepVal) => {
              const isCurrent = forceSettings.matchThreshold === stepVal;
              return (
                <button
                  key={stepVal}
                  type="button"
                  onClick={() =>
                    onForceSettingsChange({
                      ...forceSettings,
                      matchThreshold: stepVal,
                    })
                  }
                  className={`py-0.5 rounded text-[10px] font-tabular font-semibold border transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-[#F5E4E4] text-[#8C1D22] border-[#D8B4B6]'
                      : 'bg-[#FBF8F2] text-[#6B5E50] hover:text-[#171412] border-[#D5CCB9]'
                  }`}
                >
                  {stepVal}%
                </button>
              );
            })}
          </div>
        </section>

        {/* 4. Visible Sculpture Layers */}
        <section className="px-4 py-4 space-y-2.5">
          <div className="flex items-baseline justify-between">
            <h3 className="font-heading text-[15px] font-bold text-[#171412]">
              Visible Layers
            </h3>
            {hasAnyHiddenLayer && onResetAllVisibility ? (
              <button
                type="button"
                onClick={onResetAllVisibility}
                className="text-[11px] font-semibold text-[#8C1D22] hover:underline cursor-pointer"
              >
                Show All ({activeLayersCount}/6)
              </button>
            ) : (
              <span className="text-[11px] font-tabular font-semibold text-[#6B5E50]">
                {activeLayersCount}/6 Active
              </span>
            )}
          </div>

          <div className="rounded overflow-hidden border border-[#C8BEAA] divide-y divide-[#D5CCB9] bg-[#FBF8F2]">
            {entityToggles.map((item) => {
              const checked = visibility[item.type];
              const count = nodeCountsByType[item.type] || 0;
              return (
                <button
                  key={item.type}
                  type="button"
                  aria-pressed={checked}
                  onClick={() => onToggleVisibility(item.type)}
                  className={`w-full flex items-center justify-between gap-2 py-2 px-2.5 text-left transition-colors cursor-pointer ${
                    checked
                      ? 'bg-[#FBF8F2] hover:bg-[#EFE8DA]/60 text-[#171412]'
                      : 'bg-[#EFE8DA]/45 text-[#6B5E50] opacity-60 hover:opacity-90'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center border shrink-0 transition-colors ${
                        checked
                          ? 'border-transparent text-[#FBF8F2]'
                          : 'border-[#8F816B] bg-transparent'
                      }`}
                      style={{
                        backgroundColor: checked ? item.color : 'transparent',
                      }}
                    >
                      {checked && (
                        <Check
                          className="w-2.5 h-2.5 stroke-[3]"
                          aria-hidden="true"
                        />
                      )}
                    </span>

                    <span className="w-7 h-7 rounded bg-[#EFE8DA]/80 border border-[#D5CCB9] flex items-center justify-center shrink-0">
                      {renderCategoryShapeIcon(item.type, item.color)}
                    </span>

                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate leading-tight">
                        {item.label}
                      </div>
                      <div className="text-[10px] text-[#6B5E50] truncate leading-tight mt-0.5">
                        {item.shapeLabel}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-1.5 py-0.5 rounded text-[11px] font-tabular font-semibold shrink-0 ${
                      checked
                        ? 'bg-[#EFE8DA] text-[#171412]'
                        : 'text-[#6B5E50]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 5. Install Desktop / Mobile PWA App */}
        <section className="px-4 py-4">
          <PwaInstallButton variant="sidebar" />
        </section>
      </div>
    </>
  );

  return (
    <>
      <aside
        aria-label="Filters & Lenses"
        className="hidden lg:flex w-[268px] shrink-0 h-[calc(100vh-3.5rem)] bg-[#EFE8DA] border-r border-[#D5CCB9] flex-col z-20 select-none"
      >
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filters & Lenses"
          className="lg:hidden fixed inset-0 z-50 flex"
        >
          <div
            className="fixed inset-0 bg-[#171412]/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-[268px] max-w-[85vw] h-full bg-[#EFE8DA] border-r border-[#B5A892] shadow-archival flex flex-col z-10">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
