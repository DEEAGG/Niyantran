import React from 'react';

export default function BrandLogo({ size = 'md', showSubtitle = true }) {
  const symbolSizes = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const textSizes = {
    sm: 'text-sm font-bold',
    md: 'text-base font-bold',
    lg: 'text-lg font-extrabold',
  };

  return (
    <div className="flex items-center gap-2.5 group select-none">
      {/* Precision Node Symbol with Vermilion / Pink / Golden Identity */}
      <div className={`${symbolSizes[size] || symbolSizes.md} rounded-lg bg-white border border-[#E4E2DC] flex items-center justify-center relative overflow-hidden transition-colors group-hover:border-[#E43D12] shadow-sm shrink-0`}>
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none">
          {/* Vermilion Top Roof */}
          <path
            d="M6 8L12 4.5L18 8L12 11.5L6 8Z"
            stroke="#E43D12"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          {/* Rose Pink Core Spine */}
          <path
            d="M12 11.5V19.5"
            stroke="#D6536D"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
          {/* Rose Pink Base Plinth */}
          <path
            d="M6 16L12 12.5L18 16L12 19.5L6 16Z"
            stroke="#D6536D"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          {/* Golden Yellow Regulatory Anchor Sparkle */}
          <circle cx="12" cy="12.5" r="1.8" fill="#EFB112" stroke="#FFFFFF" strokeWidth="0.8" />
        </svg>
      </div>

      {/* Wordmark */}
      <div className="flex flex-col text-left leading-none">
        <span className={`${textSizes[size] || textSizes.md} tracking-wider text-text-primary font-sans font-semibold group-hover:text-accent transition-colors`}>
          NIYANTRAN
        </span>
        {showSubtitle && (
          <span className="text-[9px] font-mono tracking-widest text-text-muted uppercase mt-0.5">
            Powered by ReguTrace
          </span>
        )}
      </div>
    </div>
  );
}
