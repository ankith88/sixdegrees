'use client';

import React from 'react';
import { AppTheme } from '@/lib/types';

interface SixDegreesLogoProps {
  className?: string;
  theme?: AppTheme;
}

export function SixDegreesLogo({
  className = '',
  theme = 'MOVIE_MAP_DARK',
}: SixDegreesLogoProps) {
  const isDark = theme === 'MOVIE_MAP_DARK';

  return (
    <div className={`flex items-center gap-2 select-none group ${className}`}>
      {/* Brand Emblem: The 6° Constellation Nexus */}
      <div
        className={`relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 shrink-0 ${
          isDark
            ? 'bg-[#101726] border border-[#00D2FF]/40 text-[#00D2FF] shadow-[0_0_12px_rgba(0,210,255,0.22)] group-hover:border-[#00D2FF] group-hover:shadow-[0_0_18px_rgba(0,210,255,0.45)]'
            : 'bg-[#B8292F] group-hover:bg-[#8C1D22] text-[#FBF8F2] border border-[#8C1D22] shadow-archival-sm'
        }`}
      >
        <svg
          viewBox="0 0 256 256"
          className="w-4.5 h-4.5"
          fill="none"
          role="img"
          aria-label="SixDegrees 6° Emblem"
        >
          <defs>
            <linearGradient
              id="sixDegreesLogoGrad"
              x1="30"
              y1="30"
              x2="226"
              y2="226"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#00D2FF" />
              <stop offset="60%" stopColor="#38E1FF" />
              <stop offset="100%" stopColor="#FF3366" />
            </linearGradient>
          </defs>
          <path
            fill={isDark ? 'url(#sixDegreesLogoGrad)' : 'currentColor'}
            fillRule="evenodd"
            d="M 160 28 A 126 126 0 0 0 42 154 A 74 74 0 1 0 114 80 A 96 96 0 0 1 160 62 V 28 Z M 68 154 A 48 48 0 1 1 164 154 A 48 48 0 0 1 68 154 Z M 116 132 A 22 22 0 1 0 116 176 A 22 22 0 0 0 116 132 Z M 218 48 A 22 22 0 1 1 174 48 A 22 22 0 0 1 218 48 Z M 206 48 A 10 10 0 1 0 186 48 A 10 10 0 0 0 206 48 Z"
          />
        </svg>
      </div>

      {/* Brand Wordmark with Crystal Clear Visibility */}
      <div className="flex flex-col leading-none">
        <span
          className={`font-heading text-[1.125rem] font-bold tracking-tight inline-flex items-baseline transition-colors ${
            isDark
              ? 'text-[#F0F4FC] group-hover:text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]'
              : 'text-[#171412] group-hover:text-[#B8292F]'
          }`}
        >
          <span>SixDegrees</span>
          <span
            className={`ml-0.5 font-bold text-sm leading-none translate-y-[-0.32em] transition-all ${
              isDark
                ? 'text-[#00D2FF] group-hover:text-[#38E1FF] drop-shadow-[0_0_8px_rgba(0,210,255,0.7)]'
                : 'text-[#B8292F]'
            }`}
            aria-hidden="true"
          >
            °
          </span>
        </span>
      </div>
    </div>
  );
}
