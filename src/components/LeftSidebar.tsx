'use client';

import React, { useState } from 'react';
import {
  Check,
  RotateCcw,
  Globe,
  Crosshair,
  Film,
  Tv,
  Layers,
  Award,
  UserCheck,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Loader2,
  Play,
  Pause,
  Plus,
  ShieldCheck,
  Database,
} from 'lucide-react';
import {
  EntityNodeType,
  EntityVisibility,
  ForceSettings,
  GraphNode,
  GravityPreset,
  MediaItem,
} from '@/lib/types';
import {
  FirestoreSyncTelemetry,
  QuotaTelemetry,
  getActiveApiKeys,
  saveRuntimeApiKeys,
} from '@/lib/api';

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
  // Auto-Catalog Expansion & Cloud Firestore Props
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
  autoExpandEnabled = true,
  onToggleAutoExpand,
  onTriggerExpandNow,
  isAutoExpanding = false,
  autoExpandTarget = 180,
  lastCollaboratorCrawled = null,
  quotaTelemetry = null,
  firestoreTelemetry = null,
  expandedCount = 0,
  onResetExpandedCatalog,
  onFirestoreConfigUpdated,
}: LeftSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showFirestoreModal, setShowFirestoreModal] = useState(false);
  const [projectIdInput, setProjectIdInput] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');

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
      icon: Sparkles,
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
      shapeLabel: 'Widescreen TV Set',
      color: '#6B3A6E',
    },
    {
      type: 'DIRECTOR',
      label: 'Directors & Writers',
      shapeLabel: 'Director Clapperboard',
      color: '#B8292F',
    },
    {
      type: 'ACTOR',
      label: 'Actors & Cast',
      shapeLabel: 'Cinema Star Trophy',
      color: '#B86B14',
    },
    {
      type: 'TROPE',
      label: 'Specific Themes',
      shapeLabel: 'Open Story Book',
      color: '#2A6B53',
    },
    {
      type: 'COMPOSER',
      label: 'Score & Camera',
      shapeLabel: 'Musical Eighth Note',
      color: '#A63A2B',
    },
  ];

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
            <circle cx="8" cy="3.8" r="1.25" fill="#FBF8F2" />
            <circle cx="12" cy="6.7" r="1.25" fill="#FBF8F2" />
            <circle cx="10.5" cy="11.4" r="1.25" fill="#FBF8F2" />
            <circle cx="5.5" cy="11.4" r="1.25" fill="#FBF8F2" />
            <circle cx="4" cy="6.7" r="1.25" fill="#FBF8F2" />
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
              d="M5.2 1.8L7.3 4.2M10.8 1.8L8.7 4.2"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <rect
              x="2"
              y="4"
              width="12"
              height="8.5"
              rx="2"
              fill="currentColor"
            />
            <rect
              x="3.6"
              y="5.4"
              width="8.8"
              height="5.7"
              rx="1"
              fill="#FBF8F2"
            />
            <path
              d="M5.5 14.2H10.5"
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
              height="8"
              rx="1.5"
              fill="currentColor"
            />
            <path
              d="M2.2 5.4L13.5 2.4L14.1 4.6L2.8 7.6Z"
              fill="currentColor"
            />
            <path
              d="M4.5 9.5H11.5M4.5 11.8H9"
              stroke="#FBF8F2"
              strokeWidth="1.2"
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
            <polygon
              points="8,1.3 9.9,5.6 14.6,6.1 11.1,9.3 12.1,13.9 8,11.5 3.9,13.9 4.9,9.3 1.4,6.1 6.1,5.6"
              fill="currentColor"
            />
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
              d="M8 3.6C6.2 2.4 3.5 2.6 1.8 3.6V12.6C3.5 11.6 6.2 11.4 8 12.6C9.8 11.4 12.5 11.6 14.2 12.6V3.6C12.5 2.6 9.8 2.4 8 3.6Z"
              fill="currentColor"
            />
            <path
              d="M8 3.8V12.4"
              stroke="#FBF8F2"
              strokeWidth="1.3"
              strokeLinecap="round"
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
            <circle cx="4.8" cy="12" r="2.2" fill="currentColor" />
            <circle cx="11.5" cy="10.6" r="2.2" fill="currentColor" />
            <path
              d="M6.6 12V3.8L13.3 2.4V10.6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
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
  const hasCustomSettings =
    Boolean(focalItem) ||
    mediaFilter !== 'ALL' ||
    preset !== 'VIBE_TROPES' ||
    forceSettings.matchThreshold !== 15 ||
    hasAnyHiddenLayer;

  const handleResetAll = () => {
    if (focalItem) onClearFocal();
    onMediaFilterChange('ALL');
    onPresetChange('VIBE_TROPES');
    onForceSettingsChange({
      ...forceSettings,
      matchThreshold: 15,
    });
    onResetAllVisibility?.();
  };

  // Minimal Collapsed Rail (52px wide)
  if (collapsed) {
    return (
      <aside
        aria-label="Collapsed Controls"
        className="hidden lg:flex w-13 shrink-0 h-[calc(100vh-3.5rem)] bg-[#EFE8DA] border-r border-[#D5CCB9] flex-col items-center py-3 gap-2.5 z-20 select-none"
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="w-8 h-8 rounded-lg bg-[#FBF8F2] hover:bg-[#E5DEC9] border border-[#C8BEAA] flex items-center justify-center text-[#171412] transition-colors cursor-pointer"
          aria-label="Expand Sidebar"
          title="Expand Sidebar"
        >
          <PanelLeftOpen className="w-4 h-4 text-[#52483E]" aria-hidden="true" />
        </button>

        <div className="w-6 h-px bg-[#D5CCB9]" aria-hidden="true" />

        {entityToggles.map((item) => {
          const active = visibility[item.type];
          return (
            <button
              key={item.type}
              type="button"
              onClick={() => onToggleVisibility(item.type)}
              className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                active
                  ? 'bg-[#FBF8F2] border-[#C8BEAA]'
                  : 'bg-transparent border-transparent opacity-35 hover:opacity-75'
              }`}
              title={`${item.label} (${item.shapeLabel}): ${active ? 'Visible' : 'Hidden'} (${nodeCountsByType[item.type]})`}
              aria-label={`Toggle ${item.label}`}
              aria-pressed={active}
            >
              {renderCategoryShapeIcon(item.type, item.color)}
            </button>
          );
        })}
      </aside>
    );
  }

  const sidebarContent = (
    <>
      {/* Minimal Header */}
      <div className="px-4 py-2.5 border-b border-[#D5CCB9] flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#52483E]">
          Filters &amp; Lenses
        </span>

        <div className="flex items-center gap-1">
          {hasCustomSettings && (
            <button
              type="button"
              onClick={handleResetAll}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-[#8C1D22] hover:bg-[#E5DEC9] transition-colors cursor-pointer"
              title="Reset all filters"
            >
              <RotateCcw className="w-2.5 h-2.5" aria-hidden="true" />
              Reset
            </button>
          )}

          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="hidden lg:inline-flex items-center justify-center w-6 h-6 rounded text-[#52483E] hover:text-[#171412] hover:bg-[#E5DEC9] transition-colors cursor-pointer"
            aria-label="Collapse Sidebar"
            title="Collapse sidebar"
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

      {/* Scrollable Content */}
      <div className="px-4 py-4 space-y-5 overflow-y-auto flex-1">
        {/* 1. Scope & Format */}
        <section className="space-y-2.5">
          {focalItem && (
            <div className="p-2.5 rounded-lg bg-[#FBF8F2] border border-[#B5A892] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Crosshair className="w-3.5 h-3.5 text-[#B8292F] shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-[10px] text-[#52483E]">Centered on</div>
                  <div className="text-xs font-bold text-[#171412] truncate">
                    {focalItem.title}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClearFocal}
                className="px-2 py-1 rounded text-[11px] font-semibold bg-[#EFE8DA] hover:bg-[#B8292F] text-[#171412] hover:text-[#FBF8F2] border border-[#C8BEAA] transition-colors cursor-pointer shrink-0"
              >
                All
              </button>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-[#171412]">Format</span>
              <span className="text-[11px] font-tabular text-[#52483E]">
                {totalMediaCount} Titles
              </span>
            </div>

            <div
              role="group"
              aria-label="Media format"
              className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#E5DEC9] border border-[#C8BEAA]"
            >
              {(
                [
                  {
                    id: 'ALL',
                    label: 'All',
                    count: mediaCounts?.all,
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
                    className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      active
                        ? 'bg-[#FBF8F2] text-[#171412] border border-[#B5A892] shadow-archival-sm'
                        : 'text-[#52483E] hover:text-[#171412] border border-transparent'
                    }`}
                  >
                    <Icon
                      className={`w-3 h-3 shrink-0 ${
                        active ? 'text-[#B8292F]' : 'text-[#6B5E50]'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* 2. Curatorial Lens */}
        <section className="pt-4 border-t border-[#D5CCB9] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#171412]">
              Weighting Lens
            </span>
          </div>

          <div className="rounded-lg overflow-hidden border border-[#C8BEAA] divide-y divide-[#E5DEC9] bg-[#FBF8F2]">
            {presets.map((p) => {
              const active = preset === p.id;
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onPresetChange(p.id)}
                  className={`w-full text-left py-2 px-2.5 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#FBF8F2] border-l-[3px] border-l-[#B8292F]'
                      : 'bg-[#EFE8DA]/35 hover:bg-[#EFE8DA]/75'
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
                      <span className="text-xs font-semibold text-[#171412] truncate">
                        {p.title}
                      </span>
                    </div>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-tabular font-semibold ${
                        active
                          ? 'bg-[#F5E4E4] text-[#8C1D22]'
                          : 'text-[#6B5E50]'
                      }`}
                    >
                      {p.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#52483E] mt-0.5 pl-5.5 truncate">
                    {p.subtitle}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. Minimum Match Threshold */}
        <section className="pt-4 border-t border-[#D5CCB9] space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="slider-threshold"
              className="text-xs font-bold text-[#171412]"
            >
              Minimum Affinity
            </label>
            <span className="text-xs font-bold font-tabular text-[#8C1D22]">
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
            className="w-full accent-[#B8292F] h-1.5 bg-[#D5CCB9] rounded-lg cursor-pointer"
          />

          <div className="flex justify-between text-[10px] font-tabular text-[#6B5E50]">
            <span>5%</span>
            <span>35%</span>
            <span>70%</span>
          </div>
        </section>

        {/* 4. Visible Layers */}
        <section className="pt-4 border-t border-[#D5CCB9] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#171412]">
              Visible Layers
            </span>
            {hasAnyHiddenLayer && onResetAllVisibility && (
              <button
                type="button"
                onClick={onResetAllVisibility}
                className="text-[10px] font-semibold text-[#8C1D22] hover:underline cursor-pointer"
              >
                Show All
              </button>
            )}
          </div>

          <div className="rounded-lg overflow-hidden border border-[#C8BEAA] divide-y divide-[#E5DEC9] bg-[#FBF8F2]">
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
                      ? 'bg-[#FBF8F2] text-[#171412]'
                      : 'bg-[#EFE8DA]/40 text-[#6B5E50] opacity-60'
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
                    {renderCategoryShapeIcon(item.type, item.color)}
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate leading-tight">
                        {item.label}
                      </div>
                      <div className="text-[10px] text-[#6B5E50] truncate leading-tight">
                        {item.shapeLabel}
                      </div>
                    </div>
                  </div>

                  <span className="text-[11px] font-tabular text-[#52483E] shrink-0">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 5. Quota-Safe Auto-Catalog Expansion */}
        <section className="pt-4 border-t border-[#D5CCB9] space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <ShieldCheck
                className="w-3.5 h-3.5 text-[#2A6B53] shrink-0"
                aria-hidden="true"
              />
              <span className="text-xs font-bold text-[#171412]">
                Auto-Expand Archive
              </span>
            </div>

            {onToggleAutoExpand && (
              <button
                type="button"
                onClick={onToggleAutoExpand}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors cursor-pointer ${
                  autoExpandEnabled
                    ? 'bg-[#E4F0EA] text-[#1E563F] border-[#B3D4C5]'
                    : 'bg-[#E5DEC9] text-[#52483E] border-[#C8BEAA]'
                }`}
                title={
                  autoExpandEnabled
                    ? 'Pause automatic background trickle'
                    : 'Resume automatic background trickle'
                }
              >
                {autoExpandEnabled ? (
                  <>
                    <Pause className="w-2.5 h-2.5" aria-hidden="true" />
                    Active
                  </>
                ) : (
                  <>
                    <Play className="w-2.5 h-2.5" aria-hidden="true" />
                    Paused
                  </>
                )}
              </button>
            )}
          </div>

          <div className="p-2.5 rounded-lg bg-[#FBF8F2] border border-[#C8BEAA] space-y-2">
            {/* Progress toward target catalog size */}
            <div className="flex items-center justify-between text-[11px] font-tabular">
              <span className="text-[#52483E]">
                Archive Size:{' '}
                <strong className="text-[#171412]">
                  {mediaCounts?.all ?? totalMediaCount}
                </strong>{' '}
                / {autoExpandTarget}
              </span>
              {expandedCount > 0 && (
                <span className="text-[#2A6B53] font-semibold">
                  +{expandedCount} Added
                </span>
              )}
            </div>

            <div className="w-full h-1.5 rounded-full bg-[#E5DEC9] overflow-hidden">
              <div
                className="h-full bg-[#2A6B53] transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      ((mediaCounts?.all ?? totalMediaCount) /
                        Math.max(1, autoExpandTarget)) *
                        100
                    )
                  )}%`,
                }}
              />
            </div>

            {lastCollaboratorCrawled && (
              <div className="text-[10px] text-[#52483E] truncate flex items-center gap-1">
                {isAutoExpanding ? (
                  <Loader2
                    className="w-2.5 h-2.5 animate-spin text-[#B8292F] shrink-0"
                    aria-hidden="true"
                  />
                ) : null}
                <span className="truncate">
                  {isAutoExpanding ? 'Crawling:' : 'Last hub:'}{' '}
                  <strong className="text-[#171412]">
                    {lastCollaboratorCrawled}
                  </strong>
                </span>
              </div>
            )}

            <div className="flex items-center gap-1.5 pt-0.5">
              {onTriggerExpandNow && (
                <button
                  type="button"
                  disabled={isAutoExpanding}
                  onClick={onTriggerExpandNow}
                  className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded text-[11px] font-semibold bg-[#EFE8DA] hover:bg-[#B8292F] text-[#171412] hover:text-[#FBF8F2] border border-[#C8BEAA] hover:border-[#8C1D22] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isAutoExpanding ? (
                    <>
                      <Loader2
                        className="w-3 h-3 animate-spin"
                        aria-hidden="true"
                      />
                      Expanding…
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3" aria-hidden="true" />
                      Expand +5 Now
                    </>
                  )}
                </button>
              )}

              {expandedCount > 0 && onResetExpandedCatalog && (
                <button
                  type="button"
                  onClick={onResetExpandedCatalog}
                  className="py-1.5 px-2 rounded text-[10px] font-semibold text-[#6B5E50] hover:text-[#8C1D22] hover:bg-[#EFE8DA] border border-transparent hover:border-[#C8BEAA] transition-colors cursor-pointer"
                  title="Reset auto-expanded titles back to base seed archive"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Free-Tier Quota Guard & Cloud Firestore Telemetry */}
            <div className="pt-1.5 border-t border-[#E5DEC9] space-y-1.5 text-[10px] font-tabular text-[#6B5E50]">
              <div className="flex items-center justify-between">
                <span>
                  OMDb Quota:{' '}
                  <strong className="text-[#171412]">
                    {quotaTelemetry?.omdbCallsToday ?? 0}
                  </strong>
                  /{quotaTelemetry?.omdbDailySafeLimit ?? 750}
                </span>
                <span className="text-[#2A6B53] font-medium">
                  0 OMDb on Bulk
                </span>
              </div>

              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1 min-w-0 truncate">
                  <Database
                    className={`w-3 h-3 shrink-0 ${
                      firestoreTelemetry?.enabled
                        ? 'text-[#2A6B53]'
                        : 'text-[#8F816B]'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="truncate">
                    Firestore:{' '}
                    <strong
                      className={
                        firestoreTelemetry?.enabled
                          ? 'text-[#1E563F]'
                          : 'text-[#52483E]'
                      }
                    >
                      {firestoreTelemetry?.enabled
                        ? firestoreTelemetry.projectId
                        : 'Local Disk'}
                    </strong>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const current = getActiveApiKeys();
                    setProjectIdInput(
                      current.firebaseProjectId ||
                        firestoreTelemetry?.projectId ||
                        ''
                    );
                    setApiKeyInput(current.firebaseApiKey || '');
                    setShowFirestoreModal((v) => !v);
                  }}
                  className="text-[10px] font-semibold text-[#234B6E] hover:underline shrink-0 cursor-pointer"
                >
                  {firestoreTelemetry?.enabled ? 'Config' : 'Connect'}
                </button>
              </div>

              {firestoreTelemetry?.enabled && (
                <div className="flex items-center justify-between text-[9px] text-[#6B5E50]">
                  <span>
                    Bundled Reads: {firestoreTelemetry.firestoreReadsSession} ·
                    Writes: {firestoreTelemetry.firestoreWritesSession}
                  </span>
                  <span>Spark Free Tier</span>
                </div>
              )}

              {showFirestoreModal && (
                <div className="pt-1.5 mt-1 border-t border-[#D5CCB9] space-y-1.5">
                  <div className="text-[10px] font-semibold text-[#171412]">
                    Cloud Firestore (Free Tier)
                  </div>
                  <input
                    type="text"
                    value={projectIdInput}
                    onChange={(e) => setProjectIdInput(e.target.value)}
                    placeholder="FIREBASE_PROJECT_ID"
                    className="w-full px-2 py-1 rounded text-[11px] bg-[#EFE8DA] border border-[#C8BEAA] text-[#171412] placeholder:text-[#6B5E50] focus:outline-none focus:border-[#B8292F]"
                  />
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="FIREBASE_API_KEY (Web API Key)"
                    className="w-full px-2 py-1 rounded text-[11px] bg-[#EFE8DA] border border-[#C8BEAA] text-[#171412] placeholder:text-[#6B5E50] focus:outline-none focus:border-[#B8292F]"
                  />
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setShowFirestoreModal(false)}
                      className="px-2 py-0.5 rounded text-[10px] text-[#52483E] hover:bg-[#E5DEC9] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const existing = getActiveApiKeys();
                        saveRuntimeApiKeys(
                          existing.tmdbKey,
                          existing.omdbKey,
                          projectIdInput,
                          apiKeyInput
                        );
                        setShowFirestoreModal(false);
                        onFirestoreConfigUpdated?.();
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#2A6B53] text-[#FBF8F2] hover:bg-[#1E563F] cursor-pointer"
                    >
                      Save &amp; Sync
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );

  return (
    <>
      <aside
        aria-label="Filters & Lenses"
        className="hidden lg:flex w-64 shrink-0 h-[calc(100vh-3.5rem)] bg-[#EFE8DA] border-r border-[#D5CCB9] flex-col z-20 select-none"
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
          <aside className="relative w-64 max-w-[85vw] h-full bg-[#EFE8DA] border-r border-[#B5A892] shadow-archival flex flex-col z-10">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
