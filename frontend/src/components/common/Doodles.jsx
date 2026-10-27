import React from 'react';
import { cn } from '@/lib/utils';

/**
 * NIYANTRAN Distinctive Doodle Graphics Language
 * 
 * Palette:
 * - Vermilion Red-Orange: #E43D12
 * - Rose Pink: #D6536D
 * - Golden Yellow: #EFB112
 * 
 * Designed for "Professional regulatory intelligence meets expressive editorial graphics."
 * All decorative elements use aria-hidden="true" and pointer-events: none.
 */

// 1. Folded Document Sheet Doodle
export const FoldedDocumentDoodle = ({ className = "", color = "#E43D12" }) => (
  <svg
    width="54"
    height="64"
    viewBox="0 0 54 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("pointer-events-none select-none", className)}
    aria-hidden="true"
  >
    {/* Page base with subtle fill */}
    <path
      d="M6 4H36L48 16V58C48 59.1046 47.1046 60 46 60H6C4.89543 60 4 59.1046 4 58V6C4 4.89543 4.89543 4 6 4Z"
      fill="#FFFFFF"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Folded corner flap */}
    <path
      d="M36 4V16H48"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="#FDF1EE"
    />
    {/* Text lines */}
    <line x1="12" y1="24" x2="34" y2="24" stroke="#696C73" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 2" />
    <line x1="12" y1="32" x2="40" y2="32" stroke="#696C73" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="12" y1="40" x2="30" y2="40" stroke="#696C73" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="12" y1="48" x2="24" y2="48" stroke="#D6536D" strokeWidth="1.5" strokeLinecap="round" />
    {/* Small Golden Stamp on bottom right */}
    <circle cx="38" cy="46" r="6" stroke="#EFB112" strokeWidth="1.5" fill="#FEF9EB" />
    <path d="M36 46L37.5 47.5L40.5 44.5" stroke="#E43D12" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// 2. Magnifying Inspection Glass Doodle
export const MagnifierDoodle = ({ className = "" }) => (
  <svg
    width="56"
    height="56"
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("pointer-events-none select-none", className)}
    aria-hidden="true"
  >
    {/* Lens glass */}
    <circle
      cx="24"
      cy="24"
      r="16"
      stroke="#E43D12"
      strokeWidth="2"
      fill="rgba(253, 241, 238, 0.4)"
      strokeLinecap="round"
    />
    {/* Internal reflection glint */}
    <path
      d="M16 16C18.5 13.5 22 12.5 25.5 13"
      stroke="#EFB112"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    {/* Handle */}
    <path
      d="M36 36L48 48"
      stroke="#171A20"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    {/* Crosshair focal point */}
    <circle cx="24" cy="24" r="2.5" fill="#D6536D" />
  </svg>
);

// 3. Document Stack Doodle (Multiple dossiers)
export const DocumentStackDoodle = ({ className = "" }) => (
  <svg
    width="68"
    height="64"
    viewBox="0 0 68 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("pointer-events-none select-none", className)}
    aria-hidden="true"
  >
    {/* Under sheet 2 */}
    <rect
      x="14"
      y="14"
      width="44"
      height="46"
      rx="3"
      transform="rotate(6 36 37)"
      fill="#FFFFFF"
      stroke="#D6536D"
      strokeWidth="1.6"
      strokeDasharray="4 2"
    />
    {/* Under sheet 1 */}
    <rect
      x="8"
      y="10"
      width="44"
      height="46"
      rx="3"
      transform="rotate(-4 30 33)"
      fill="#FFFFFF"
      stroke="#EFB112"
      strokeWidth="1.6"
    />
    {/* Top sheet */}
    <rect
      x="6"
      y="6"
      width="44"
      height="48"
      rx="3"
      fill="#FFFFFF"
      stroke="#E43D12"
      strokeWidth="1.8"
    />
    {/* Document lines */}
    <line x1="14" y1="18" x2="38" y2="18" stroke="#171A20" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="14" y1="26" x2="42" y2="26" stroke="#696C73" strokeWidth="1.4" strokeLinecap="round" />
    <line x1="14" y1="34" x2="32" y2="34" stroke="#696C73" strokeWidth="1.4" strokeLinecap="round" />
    {/* Verification Badge */}
    <circle cx="38" cy="42" r="7" fill="#FDF1EE" stroke="#E43D12" strokeWidth="1.5" />
    <path d="M35 42L37 44L41 39.5" stroke="#E43D12" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// 4. Regulatory Circular Seal / Stamp Doodle
export const DecorativeStamp = ({ text = "VERIFIED", className = "", color = "#E43D12" }) => (
  <div
    className={cn(
      "pointer-events-none select-none relative inline-flex items-center justify-center rounded-full border-2 border-dashed p-2 font-mono text-[9px] font-bold tracking-widest uppercase",
      className
    )}
    style={{ borderColor: color, color: color }}
    aria-hidden="true"
  >
    <div className="absolute inset-1 rounded-full border border-current opacity-30" />
    <span className="relative px-2 py-0.5 transform -rotate-6">{text}</span>
  </div>
);

// 5. Sparkle / Star Accents
export const SparkleDoodle = ({ size = 20, color = "#EFB112", className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("pointer-events-none select-none animate-pulse", className)}
    aria-hidden="true"
  >
    <path
      d="M12 2L13.8 8.8L20 10.5L14.8 14.8L16.2 21.5L12 17.8L7.8 21.5L9.2 14.8L4 10.5L10.2 8.8L12 2Z"
      fill={color}
      opacity="0.85"
    />
  </svg>
);

// 6. Evidence Node Connector (Dotted curved trajectory)
export const EvidenceConnectorDoodle = ({ className = "" }) => (
  <svg
    width="160"
    height="70"
    viewBox="0 0 160 70"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("pointer-events-none select-none", className)}
    aria-hidden="true"
  >
    <path
      d="M8 58C40 10 110 80 152 18"
      stroke="#D6536D"
      strokeWidth="1.6"
      strokeDasharray="4 4"
      strokeLinecap="round"
      opacity="0.55"
    />
    {/* Source Node */}
    <circle cx="8" cy="58" r="4.5" fill="#EFB112" stroke="#FFFFFF" strokeWidth="1.5" />
    {/* Mid Node */}
    <circle cx="82" cy="44" r="3.5" fill="#E43D12" stroke="#FFFFFF" strokeWidth="1" />
    {/* Destination Node */}
    <circle cx="152" cy="18" r="5" fill="#D6536D" stroke="#FFFFFF" strokeWidth="1.5" />
  </svg>
);

// 7. Hero Ambient Doodle Background Cluster
export const DoodleHeroCluster = ({ className = "" }) => {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden select-none z-0",
        className
      )}
      aria-hidden="true"
    >
      {/* Top Left: Stacked Document & Sparkle */}
      <div className="absolute -top-2 left-6 lg:left-12 opacity-80 hidden sm:block transform -rotate-12 transition-transform duration-700 hover:rotate-0">
        <DocumentStackDoodle />
      </div>
      <div className="absolute top-10 left-28 hidden md:block">
        <SparkleDoodle size={16} color="#EFB112" />
      </div>

      {/* Top Right: Magnifier & Regulatory Stamp */}
      <div className="absolute top-4 right-8 lg:right-20 opacity-85 hidden sm:block transform rotate-6">
        <MagnifierDoodle />
      </div>
      <div className="absolute top-24 right-28 hidden lg:block transform rotate-12">
        <DecorativeStamp text="VERIFIED" color="#E43D12" />
      </div>
      <div className="absolute top-8 right-64 hidden xl:block">
        <SparkleDoodle size={18} color="#D6536D" />
      </div>

      {/* Mid Left: Dotted Connector Trajectory */}
      <div className="absolute top-44 left-2 hidden lg:block opacity-65">
        <EvidenceConnectorDoodle />
      </div>

      {/* Mid Right: Folded Document */}
      <div className="absolute top-52 right-8 hidden md:block opacity-75 transform rotate-6">
        <FoldedDocumentDoodle color="#D6536D" />
      </div>
      <div className="absolute top-68 right-24 hidden lg:block">
        <SparkleDoodle size={14} color="#EFB112" />
      </div>

      {/* Subtle organic color blurs for warmth */}
      <div className="absolute -top-10 left-1/4 w-72 h-72 rounded-full bg-[#E43D12]/[0.025] blur-3xl pointer-events-none" />
      <div className="absolute top-20 right-1/4 w-80 h-80 rounded-full bg-[#D6536D]/[0.025] blur-3xl pointer-events-none" />
      <div className="absolute top-40 left-1/3 w-64 h-64 rounded-full bg-[#EFB112]/[0.02] blur-3xl pointer-events-none" />
    </div>
  );
};

export default {
  FoldedDocumentDoodle,
  MagnifierDoodle,
  DocumentStackDoodle,
  DecorativeStamp,
  SparkleDoodle,
  EvidenceConnectorDoodle,
  DoodleHeroCluster,
};
