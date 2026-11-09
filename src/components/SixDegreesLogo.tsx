'use client';

import React from 'react';

export function SixDegreesLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Criterion-inspired Archival Spine Emblem */}
      <div className="relative w-9 h-9 flex items-center justify-center rounded bg-[#B8292F] text-[#FBF8F2] border border-[#8C1D22] shadow-archival-sm shrink-0">
        <svg
          viewBox="0 0 40 40"
          className="w-6 h-6"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="20"
            cy="20"
            r="15.5"
            stroke="#FBF8F2"
            strokeOpacity="0.35"
            strokeWidth="1"
          />
          <path
            d="M15 10 L24 19 M10 20 L22 32 M12 29 L24 19"
            stroke="#FBF8F2"
            strokeOpacity="0.45"
            strokeWidth="1"
          />
          <path
            d="M26 7 L15 10 L10 20 L12 30 L22 32 L29 26 L24 19 L13 20"
            stroke="#FBF8F2"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="26" cy="7" r="2" fill="#FBF8F2" />
          <circle cx="15" cy="10" r="1.8" fill="#FBF8F2" />
          <circle cx="10" cy="20" r="2" fill="#FBF8F2" />
          <circle cx="12" cy="30" r="1.8" fill="#FBF8F2" />
          <circle cx="22" cy="32" r="2.2" fill="#FBF8F2" />
          <circle cx="29" cy="26" r="1.8" fill="#FBF8F2" />
          <circle cx="24" cy="19" r="2.5" fill="#F6F1E7" />
        </svg>
      </div>

      {/* Monograph Title & Subtitle */}
      <div className="flex items-baseline gap-2.5">
        <span className="font-heading text-xl font-bold tracking-tight text-[#171412]">
          SixDegrees
        </span>
        <span className="hidden xl:inline-block px-2 py-0.5 rounded text-[11px] font-medium text-[#52483E] bg-[#E5DEC9] border border-[#C8BEAA]">
          Film &amp; Series Lineage
        </span>
      </div>
    </div>
  );
}
