'use client';

import React, { useState, useMemo } from 'react';
import {
  Film,
  Tv,
  Crosshair,
  ArrowUpRight,
  Globe,
  X,
  Check,
} from 'lucide-react';
import {
  GravityPreset,
  MediaItem,
  RegionCode,
  SimilarityBreakdown,
} from '@/lib/types';
import { getPosterFallbackDataUri } from '@/lib/seed-data';

interface SimilarityMatrixViewProps {
  focalItem: MediaItem | null;
  rankedMatches: Array<{ item: MediaItem; similarity: SimilarityBreakdown }>;
  region: RegionCode;
  preset: GravityPreset;
  selectedMediaId: string | null;
  onSelectMedia: (item: MediaItem) => void;
  onMakeFocal: (mediaId: string) => void;
  onClearFocal: () => void;
  watchedIds?: string[];
  onToggleWatched?: (mediaId: string) => void;
}

export function SimilarityMatrixView({
  focalItem,
  rankedMatches,
  region,
  preset,
  selectedMediaId,
  onSelectMedia,
  onMakeFocal,
  onClearFocal,
  watchedIds = [],
  onToggleWatched,
}: SimilarityMatrixViewProps) {
  const [sortBy, setSortBy] = useState<
    'CONNECTIVITY' | 'RATING' | 'YEAR' | 'TITLE'
  >('CONNECTIVITY');

  const presetLabel =
    preset === 'VIBE_TROPES'
      ? 'Story & Themes Lens (Default)'
      : preset === 'AUTEUR_ORBIT'
        ? 'Director & Craft Lens (2× Auteur & Score)'
        : 'Shared Cast Lens (3× Principal Cast)';

  const sortedEntries = useMemo(() => {
    const list = [...rankedMatches];
    if (!focalItem) {
      list.sort((a, b) => {
        if (sortBy === 'RATING') {
          return (
            b.item.imdbRating - a.item.imdbRating ||
            b.item.rottenTomatoes - a.item.rottenTomatoes
          );
        }
        if (sortBy === 'YEAR') {
          return b.item.year - a.item.year || b.item.imdbRating - a.item.imdbRating;
        }
        if (sortBy === 'TITLE') {
          return a.item.title.localeCompare(b.item.title);
        }
        return (
          b.similarity.totalScore - a.similarity.totalScore ||
          b.item.imdbRating - a.item.imdbRating
        );
      });
    }
    return list;
  }, [rankedMatches, focalItem, sortBy]);

  const movieCount = useMemo(
    () => rankedMatches.filter((r) => r.item.mediaType === 'MOVIE').length,
    [rankedMatches]
  );
  const tvCount = useMemo(
    () => rankedMatches.filter((r) => r.item.mediaType === 'TV').length,
    [rankedMatches]
  );

  const rubricItems = [
    {
      title: 'Themes & Motifs',
      pts: 'Up to 35 pts',
      desc: '+12 pts per shared theme',
      color: '#2A6B53',
    },
    {
      title: 'Director & Writer',
      pts: 'Up to 25 pts',
      desc: '+25 Director / +15 Writer',
      color: '#B8292F',
    },
    {
      title: 'Genre Kinship',
      pts: 'Up to 15 pts',
      desc: '+10 primary / +5 shared',
      color: '#234B6E',
    },
    {
      title: 'Shared Cast',
      pts: 'Up to 10 pts',
      desc: '+6 Lead / +4 Supporting',
      color: '#B86B14',
    },
    {
      title: 'Score & Camera',
      pts: 'Up to 10 pts',
      desc: '+6 Composer / +4 Camera',
      color: '#A63A2B',
    },
    {
      title: 'Paired Viewers',
      pts: 'Up to 5 pts',
      desc: '+5 audience pairing',
      color: '#6B3A6E',
    },
  ];

  return (
    <div className="w-full h-full overflow-y-auto px-6 py-6 pr-[420px] pb-24">
      {/* Ledger Header (Heading first — no kicker above heading) */}
      <div className="max-w-5xl mx-auto mb-5 pb-4 border-b border-[#C8BEAA] flex flex-wrap items-baseline justify-between gap-4">
        <div>
          {focalItem ? (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="font-heading text-2xl font-bold text-[#171412]">
                  Critical Lineage Ledger for{' '}
                  <span className="text-[#B8292F]">
                    {focalItem.title} ({focalItem.year})
                  </span>
                </h2>
                <button
                  type="button"
                  onClick={onClearFocal}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-[#EFE8DA] hover:bg-[#B8292F] text-[#171412] hover:text-[#FBF8F2] border border-[#B5A892] hover:border-[#8C1D22] transition-colors cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Show All Graph Titles</span>
                  <X className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xs text-[#52483E] mt-1">
                Ranked across our 100-point craft rubric · Active lens:{' '}
                <strong className="text-[#171412] font-semibold">
                  {presetLabel}
                </strong>
              </p>
            </>
          ) : (
            <>
              <h2 className="font-heading text-2xl font-bold text-[#171412]">
                Complete Graph Constellation Ledger —{' '}
                <span className="text-[#234B6E]">
                  All {rankedMatches.length} Movies &amp; TV Series
                </span>
              </h2>
              <p className="text-xs text-[#52483E] mt-1">
                Showing all{' '}
                <strong className="text-[#234B6E] font-semibold">
                  {movieCount} feature films
                </strong>{' '}
                and{' '}
                <strong className="text-[#6B3A6E] font-semibold">
                  {tvCount} television series
                </strong>{' '}
                in the active graph · Lens:{' '}
                <strong className="text-[#171412] font-semibold">
                  {presetLabel}
                </strong>
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!focalItem && (
            <div className="flex items-center gap-1 p-1 rounded bg-[#EFE8DA] border border-[#C8BEAA] text-xs">
              {(
                [
                  { id: 'CONNECTIVITY', label: 'Graph Links' },
                  { id: 'RATING', label: 'IMDb Rating' },
                  { id: 'YEAR', label: 'Year' },
                  { id: 'TITLE', label: 'A–Z' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSortBy(opt.id)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                    sortBy === opt.id
                      ? 'bg-[#FBF8F2] text-[#171412] border border-[#B5A892] shadow-archival-sm'
                      : 'text-[#52483E] hover:text-[#171412]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          <div className="text-xs font-tabular text-[#52483E]">
            Showing{' '}
            <strong className="text-[#171412] font-bold">
              {sortedEntries.length}
            </strong>{' '}
            {focalItem ? 'connected titles' : 'titles in graph'}
          </div>
        </div>
      </div>

      {/* 6-Part Craft Rubric Strip (Hairline table, no nested cards) */}
      <div className="max-w-5xl mx-auto mb-6 bg-[#EFE8DA] border-t border-b border-[#C8BEAA] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-[#D5CCB9]">
        {rubricItems.map((rubric) => (
          <div key={rubric.title} className="px-3 py-2.5">
            <div className="flex items-center justify-between gap-1 text-xs">
              <span className="font-semibold text-[#171412] truncate">
                {rubric.title}
              </span>
              <span
                style={{ color: rubric.color }}
                className="font-tabular font-bold text-[11px] shrink-0"
              >
                {rubric.pts}
              </span>
            </div>
            <div className="text-[11px] text-[#52483E] mt-0.5">
              {rubric.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Ranked Ledger Entries */}
      <div className="max-w-5xl mx-auto divide-y divide-[#C8BEAA] border-t border-b border-[#C8BEAA] bg-[#FBF8F2]">
        {sortedEntries.map(({ item, similarity }, index) => {
          const isSelected = item.id === selectedMediaId;
          const regionStream = (item.streamingByRegion[region] || []).filter(
            (s) => s.type === 'STREAM'
          );

          const segments = [
            {
              label: 'Themes',
              pts: similarity.rawPoints.tropes,
              color: '#2A6B53',
            },
            {
              label: 'Auteur',
              pts: similarity.rawPoints.auteur,
              color: '#B8292F',
            },
            {
              label: 'Genre',
              pts: similarity.rawPoints.genres,
              color: '#234B6E',
            },
            {
              label: 'Cast',
              pts: similarity.rawPoints.cast,
              color: '#B86B14',
            },
            {
              label: 'Score',
              pts: similarity.rawPoints.sonicVisual,
              color: '#A63A2B',
            },
            {
              label: 'Paired',
              pts: similarity.rawPoints.coWatch,
              color: '#6B3A6E',
            },
          ];
          const totalRaw = Math.max(
            1,
            segments.reduce((acc, s) => acc + s.pts, 0)
          );

          return (
            <article
              key={item.id}
              onClick={() => onSelectMedia(item)}
              className={`group cursor-pointer p-4 transition-colors ${
                isSelected ? 'bg-[#EFE8DA]' : 'hover:bg-[#F6F1E7]'
              }`}
            >
              <div className="flex gap-4 items-start">
                {/* Spine Number + Poster Plate */}
                <div className="flex items-start gap-3 shrink-0">
                  <span className="w-7 text-right font-heading text-base font-bold font-tabular text-[#6B5E50] pt-1">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="w-16 h-24 rounded-sm overflow-hidden border border-[#C8BEAA] bg-[#EFE8DA] shrink-0">
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

                {/* Title & Craft Breakdown */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {/* Title Heading First (no kicker above h3) */}
                      <h3 className="font-heading text-lg font-bold text-[#171412] truncate">
                        {item.title}
                      </h3>
                      <div className="flex items-center flex-wrap gap-2 mt-0.5 text-xs text-[#52483E]">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
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
                        <span>{item.directors.join(', ')}</span>
                        <span>·</span>
                        <span className="font-tabular font-semibold text-[#171412]">
                          IMDb {item.imdbRating.toFixed(1)}
                        </span>
                        <span>·</span>
                        <span className="font-tabular text-[#8C1D22] font-semibold">
                          RT {item.rottenTomatoes}%
                        </span>
                      </div>
                    </div>

                    {/* Match Score / Graph Connectivity Badge */}
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-tabular font-bold border ${
                          similarity.totalScore >= 75
                            ? 'bg-[#E3EFEA] text-[#2A6B53] border-[#B4D4C7]'
                            : similarity.totalScore >= 50
                              ? 'bg-[#E4ECF2] text-[#234B6E] border-[#B6C9D9]'
                              : 'bg-[#EFE8DA] text-[#52483E] border-[#C8BEAA]'
                        }`}
                      >
                        {focalItem
                          ? `${similarity.totalScore}% Match`
                          : `${similarity.totalScore}% Cluster Affinity`}
                      </span>
                    </div>
                  </div>

                  {/* Proportional 6-Part Craft Lineage Bar + Tabular Breakdown */}
                  <div className="mt-3">
                    <div className="h-2 w-full rounded-sm overflow-hidden flex bg-[#E5DEC9]">
                      {segments.map(
                        (seg) =>
                          seg.pts > 0 && (
                            <div
                              key={seg.label}
                              style={{
                                width: `${(seg.pts / totalRaw) * 100}%`,
                                backgroundColor: seg.color,
                              }}
                              className="h-full border-r border-[#FBF8F2]/40 last:border-r-0"
                            />
                          )
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[11px] font-tabular text-[#52483E]">
                      {segments.map((seg) => (
                        <span key={seg.label}>
                          {seg.label}:{' '}
                          <strong
                            style={{ color: seg.color }}
                            className="font-bold"
                          >
                            +{seg.pts}
                          </strong>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Shared Connections & Streaming Row */}
                  <div className="mt-3 pt-2.5 border-t border-[#E5DEC9] flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex flex-wrap gap-1.5">
                      {similarity.sharedConnections.slice(0, 4).map((conn) => (
                        <span
                          key={conn.id}
                          className="px-2 py-0.5 rounded text-[11px] bg-[#EFE8DA] border border-[#D5CCB9] text-[#171412]"
                        >
                          <strong style={{ color: conn.color }}>
                            {conn.prefix}:
                          </strong>{' '}
                          {conn.value}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      {regionStream.slice(0, 2).map((s) => (
                        <a
                          key={s.provider}
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#EFE8DA] hover:bg-[#E5DEC9] text-[#171412] border border-[#C8BEAA]"
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          {s.provider}
                          <ArrowUpRight className="w-3 h-3 text-[#52483E]" />
                        </a>
                      ))}

                      {onToggleWatched && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleWatched(item.id);
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                            watchedIds.includes(item.id)
                              ? 'bg-[#E4F0EA] text-[#1E563F] border-[#B3D4C5]'
                              : 'bg-[#FBF8F2] hover:bg-[#EFE8DA] text-[#171412] border-[#C8BEAA]'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                          <span>
                            {watchedIds.includes(item.id)
                              ? 'Watched ✓'
                              : 'Mark Watched'}
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMakeFocal(item.id);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-[#F5E4E4] hover:bg-[#B8292F] text-[#8C1D22] hover:text-[#FBF8F2] border border-[#D8B4B6] transition-colors cursor-pointer"
                      >
                        <Crosshair className="w-3 h-3" />
                        Center Here
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
