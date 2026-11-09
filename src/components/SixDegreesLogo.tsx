'use client';

import React from 'react';

export function SixDegreesLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 select-none group ${className}`}>
      {/* Criterion-inspired Archival Spine Emblem ("The Criterion 6°") */}
      <div className="relative w-8 h-8 flex items-center justify-center rounded-md bg-[#B8292F] group-hover:bg-[#8C1D22] text-[#FBF8F2] border border-[#8C1D22] shadow-archival-sm transition-colors shrink-0">
        <svg
          viewBox="0 0 256 256"
          className="w-4 h-4"
          fill="none"
          role="img"
          aria-label="SixDegrees 6° Emblem"
        >
          <path
            fill="currentColor"
            fillRule="evenodd"
            d="M 164 30 A 124 124 0 0 0 40 154 A 72 72 0 1 0 109.96 82.03 A 90 90 0 0 1 164 64 V 30 Z M 69.99 154 L 91 190.37 L 133 190.37 L 154.01 154 L 133 117.63 L 91 117.63 Z M 123 154 A 11 11 0 1 1 101 154 A 11 11 0 1 1 123 154 Z M 220 48 A 20 20 0 1 1 180 48 A 20 20 0 1 1 220 48 Z M 209 48 A 9 9 0 1 0 191 48 A 9 9 0 1 0 209 48 Z"
          />
        </svg>
      </div>

      {/* Minimal Monograph Wordmark */}
      <span className="font-heading text-lg font-bold tracking-tight text-[#171412] inline-flex items-baseline group-hover:text-[#8C1D22] transition-colors">
        <span>SixDegrees</span>
        <span
          className="ml-0.5 text-[#B8292F] font-semibold text-sm leading-none translate-y-[-0.35em]"
          aria-hidden="true"
        >
          °
        </span>
      </span>
    </div>
  );
}
