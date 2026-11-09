'use client';

import React from 'react';
import { Check, RotateCcw, Globe, Crosshair } from 'lucide-react';
import {
  EntityNodeType,
  EntityVisibility,
  ForceSettings,
  GravityPreset,
  MediaItem,
} from '@/lib/types';

interface LeftSidebarProps {
  focalItem: MediaItem | null;
  totalMediaCount: number;
  onClearFocal: () => void;
  mediaFilter: 'ALL' | 'MOVIE' | 'TV';
  onMediaFilterChange: (val: 'ALL' | 'MOVIE' | 'TV') => void;
  preset: GravityPreset;
  onPresetChange: (val: GravityPreset) => void;
  forceSettings: ForceSettings;
  onForceSettingsChange: (next: ForceSettings) => void;
  visibility: EntityVisibility;
  onToggleVisibility: (type: EntityNodeType) => void;
}

export function LeftSidebar({
  focalItem,
  totalMediaCount,
  onClearFocal,
  mediaFilter,
  onMediaFilterChange,
  preset,
  onPresetChange,
  forceSettings,
  onForceSettingsChange,
  visibility,
  onToggleVisibility,
}: LeftSidebarProps) {
  const presets: Array<{
    id: GravityPreset;
    title: string;
    subtitle: string;
    badge: string;
  }> = [
    {
      id: 'VIBE_TROPES',
      title: 'Story & Themes',
      subtitle: 'Prioritises shared narrative motifs, moods, and genre kinship',
      badge: 'Default',
    },
    {
      id: 'AUTEUR_ORBIT',
      title: 'Director & Craft',
      subtitle: 'Doubles the weight of shared directors, writers, and composers',
      badge: '2× Craft',
    },
    {
      id: 'STAR_CONSTELLATION',
      title: 'Shared Cast',
      subtitle: 'Triples the weight of shared lead and supporting actors',
      badge: '3× Cast',
    },
  ];

  const entityToggles: Array<{
    type: EntityNodeType;
    label: string;
    sub: string;
    color: string;
  }> = [
    {
      type: 'MOVIE',
      label: 'Feature Films',
      sub: 'Prussian blue spheres',
      color: '#234B6E',
    },
    {
      type: 'TV',
      label: 'Television Series',
      sub: 'Plum ringed cubes',
      color: '#6B3A6E',
    },
    {
      type: 'DIRECTOR',
      label: 'Directors & Writers',
      sub: 'Crimson polyhedra',
      color: '#B8292F',
    },
    {
      type: 'ACTOR',
      label: 'Actors & Cast',
      sub: 'Ochre satellites',
      color: '#B86B14',
    },
    {
      type: 'TROPE',
      label: 'Themes & Genres',
      sub: 'Verdigris clusters',
      color: '#2A6B53',
    },
    {
      type: 'COMPOSER',
      label: 'Score & Camera',
      sub: 'Terracotta rings',
      color: '#A63A2B',
    },
  ];

  return (
    <aside
      aria-label="Catalogue Filters & Curatorial Lenses"
      className="hidden lg:flex w-[268px] shrink-0 h-[calc(100vh-3.5rem)] bg-[#EFE8DA] border-r border-[#D5CCB9] overflow-y-auto px-4 py-5 flex-col z-20"
    >
      {/* SECTION 0: Constellation Scope (Full Archive vs Single Title Focus) */}
      <section className="pb-5 border-b border-[#D5CCB9] mb-5">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-heading text-sm font-bold text-[#171412]">
            Constellation Scope
          </h2>
          <span className="text-[11px] font-semibold text-[#2A6B53]">
            {focalItem ? 'Single Focus' : 'Full Graph'}
          </span>
        </div>

        {focalItem ? (
          <div className="p-2.5 rounded bg-[#FBF8F2] border border-[#B5A892] space-y-2">
            <div className="flex items-start gap-2">
              <Crosshair className="w-3.5 h-3.5 text-[#B8292F] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[11px] text-[#52483E]">Centered on:</div>
                <div className="text-xs font-bold text-[#171412] truncate">
                  {focalItem.title} ({focalItem.year})
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClearFocal}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded text-xs font-semibold bg-[#EFE8DA] hover:bg-[#B8292F] text-[#171412] hover:text-[#FBF8F2] border border-[#C8BEAA] hover:border-[#8C1D22] transition-colors cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Show All {totalMediaCount} Titles</span>
            </button>
          </div>
        ) : (
          <div className="p-2.5 rounded bg-[#FBF8F2] border border-[#B5A892]">
            <div className="flex items-center gap-2 text-xs font-bold text-[#171412]">
              <Globe className="w-3.5 h-3.5 text-[#2A6B53] shrink-0" />
              <span>All {totalMediaCount} Movies &amp; TV Shows</span>
            </div>
            <p className="text-[11px] text-[#52483E] mt-1 leading-snug">
              Displaying the full interconnected archive without centering on any
              single title.
            </p>
          </div>
        )}
      </section>

      {/* SECTION 1: Media Format */}
      <section className="pb-5">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-heading text-sm font-bold text-[#171412]">
            Format
          </h2>
          <span className="text-[11px] font-semibold text-[#52483E]">
            {mediaFilter === 'ALL'
              ? 'All Titles'
              : mediaFilter === 'MOVIE'
                ? 'Films Only'
                : 'Series Only'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1 p-1 rounded bg-[#E5DEC9] border border-[#C8BEAA]">
          {(
            [
              { id: 'ALL', label: 'All' },
              { id: 'MOVIE', label: 'Films' },
              { id: 'TV', label: 'Series' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onMediaFilterChange(tab.id)}
              className={`py-1.5 px-2 rounded text-xs font-semibold transition-all truncate ${
                mediaFilter === tab.id
                  ? 'bg-[#FBF8F2] text-[#171412] border border-[#B5A892] shadow-archival-sm'
                  : 'text-[#52483E] hover:text-[#171412]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* SECTION 2: Curatorial Weighting Lens */}
      <section className="pt-5 pb-5 border-t border-[#D5CCB9]">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-heading text-sm font-bold text-[#171412]">
            Curatorial Lens
          </h2>
          <span className="text-[11px] font-tabular text-[#52483E]">
            100-pt scale
          </span>
        </div>

        <div className="divide-y divide-[#D5CCB9] border-t border-b border-[#D5CCB9]">
          {presets.map((p) => {
            const active = preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onPresetChange(p.id)}
                className={`w-full text-left py-2.5 px-2.5 transition-colors ${
                  active ? 'bg-[#FBF8F2]' : 'hover:bg-[#F6F1E7]/70'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-3 h-3 rounded-full border flex items-center justify-center shrink-0 ${
                        active
                          ? 'border-[#B8292F] bg-[#B8292F]'
                          : 'border-[#8F816B] bg-transparent'
                      }`}
                    >
                      {active && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FBF8F2]" />
                      )}
                    </span>
                    <span className="text-xs font-bold text-[#171412] truncate">
                      {p.title}
                    </span>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold font-tabular shrink-0 ${
                      active
                        ? 'bg-[#F5E4E4] text-[#8C1D22] border border-[#D8B4B6]'
                        : 'bg-[#E5DEC9] text-[#52483E]'
                    }`}
                  >
                    {p.badge}
                  </span>
                </div>
                <p className="text-[11px] text-[#52483E] mt-1 pl-5 leading-snug">
                  {p.subtitle}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* SECTION 3: Minimum Match Score (Simplified from raw physics sliders) */}
      <section className="pt-5 pb-5 border-t border-[#D5CCB9]">
        <div className="flex items-baseline justify-between mb-1.5">
          <label
            htmlFor="slider-threshold"
            className="font-heading text-sm font-bold text-[#171412]"
          >
            Minimum Match
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold font-tabular text-[#8C1D22]">
              {forceSettings.matchThreshold}% or higher
            </span>
            {forceSettings.matchThreshold !== 15 && (
              <button
                type="button"
                onClick={() =>
                  onForceSettingsChange({
                    ...forceSettings,
                    matchThreshold: 15,
                  })
                }
                className="text-[11px] text-[#52483E] hover:text-[#171412] inline-flex items-center gap-0.5"
                title="Reset minimum match to 15%"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                Reset
              </button>
            )}
          </div>
        </div>
        <p className="text-[11px] text-[#52483E] mb-2.5 leading-snug">
          Hide weaker connections scoring below {forceSettings.matchThreshold}{' '}
          out of 100 points.
        </p>
        <input
          id="slider-threshold"
          type="range"
          min="0"
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
        <div className="flex justify-between text-[10px] font-tabular text-[#6B5E50] mt-1">
          <span>Show all (0%)</span>
          <span>Balanced (35%)</span>
          <span>Closest (70%)</span>
        </div>
      </section>

      {/* SECTION 4: Visible Threads */}
      <section className="pt-5 border-t border-[#D5CCB9]">
        <h2 className="font-heading text-sm font-bold text-[#171412] mb-2">
          Visible Threads
        </h2>

        <div className="divide-y divide-[#D5CCB9] border-t border-b border-[#D5CCB9]">
          {entityToggles.map((item) => {
            const checked = visibility[item.type];
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => onToggleVisibility(item.type)}
                className={`w-full flex items-center justify-between gap-2 py-2 px-2 text-left transition-colors ${
                  checked
                    ? 'bg-[#FBF8F2]/85 text-[#171412]'
                    : 'bg-transparent text-[#6B5E50] opacity-65'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-4 h-4 rounded-sm flex items-center justify-center border shrink-0 transition-colors ${
                      checked
                        ? 'border-transparent text-[#FBF8F2]'
                        : 'border-[#8F816B] bg-transparent'
                    }`}
                    style={{
                      backgroundColor: checked ? item.color : 'transparent',
                    }}
                  >
                    {checked && <Check className="w-3 h-3 stroke-[3]" />}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-[#52483E] truncate">
                      {item.sub}
                    </div>
                  </div>
                </div>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: item.color,
                  }}
                />
              </button>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
