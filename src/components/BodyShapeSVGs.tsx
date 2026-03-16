'use client';

import React from 'react';

interface BodyShapeProps {
  className?: string;
  fill?: string;
}

// ── Male Body Shapes ────────────────────────────────────────

export const MaleSlim: React.FC<BodyShapeProps> = ({ className = '', fill = '#9CA3AF' }) => (
  <svg viewBox="0 0 60 120" className={className} fill={fill} xmlns="http://www.w3.org/2000/svg">
    <circle cx="30" cy="12" r="8" />
    <path d="M26 20h8l3 8h-14l3-8z" />
    <rect x="23" y="28" width="14" height="28" rx="4" />
    <path d="M23 56l-2 32h6l3-28 3 28h6l-2-32z" />
    <rect x="17" y="88" width="8" height="4" rx="1" />
    <rect x="35" y="88" width="8" height="4" rx="1" />
    <rect x="19" y="28" width="4" height="22" rx="2" />
    <rect x="37" y="28" width="4" height="22" rx="2" />
  </svg>
);

export const MaleAverage: React.FC<BodyShapeProps> = ({ className = '', fill = '#9CA3AF' }) => (
  <svg viewBox="0 0 60 120" className={className} fill={fill} xmlns="http://www.w3.org/2000/svg">
    <circle cx="30" cy="12" r="9" />
    <path d="M24 21h12l4 8H20l4-8z" />
    <rect x="20" y="29" width="20" height="30" rx="5" />
    <path d="M20 59l-3 32h8l5-28 5 28h8l-3-32z" />
    <rect x="14" y="91" width="10" height="5" rx="2" />
    <rect x="36" y="91" width="10" height="5" rx="2" />
    <rect x="14" y="29" width="6" height="24" rx="3" />
    <rect x="40" y="29" width="6" height="24" rx="3" />
  </svg>
);

export const MaleAthletic: React.FC<BodyShapeProps> = ({ className = '', fill = '#9CA3AF' }) => (
  <svg viewBox="0 0 60 120" className={className} fill={fill} xmlns="http://www.w3.org/2000/svg">
    <circle cx="30" cy="11" r="9" />
    <path d="M22 20h16l6 8H16l6-8z" />
    <path d="M16 28h28v10q0 4-4 6l-2 1v12q0 3-4 3h-8q-4 0-4-3V45l-2-1q-4-2-4-6V28z" />
    <path d="M20 60l-4 32h9l5-27 5 27h9l-4-32z" />
    <rect x="12" y="92" width="12" height="5" rx="2" />
    <rect x="36" y="92" width="12" height="5" rx="2" />
    <rect x="10" y="28" width="7" height="26" rx="3.5" />
    <rect x="43" y="28" width="7" height="26" rx="3.5" />
  </svg>
);

export const MaleStocky: React.FC<BodyShapeProps> = ({ className = '', fill = '#9CA3AF' }) => (
  <svg viewBox="0 0 60 120" className={className} fill={fill} xmlns="http://www.w3.org/2000/svg">
    <circle cx="30" cy="11" r="9" />
    <path d="M22 20h16l5 8H17l5-8z" />
    <rect x="17" y="28" width="26" height="32" rx="6" />
    <path d="M19 60l-3 32h9l5-27 5 27h9l-3-32z" />
    <rect x="13" y="92" width="11" height="5" rx="2" />
    <rect x="36" y="92" width="11" height="5" rx="2" />
    <rect x="11" y="28" width="7" height="24" rx="3.5" />
    <rect x="42" y="28" width="7" height="24" rx="3.5" />
  </svg>
);

export const MaleHeavy: React.FC<BodyShapeProps> = ({ className = '', fill = '#9CA3AF' }) => (
  <svg viewBox="0 0 60 120" className={className} fill={fill} xmlns="http://www.w3.org/2000/svg">
    <circle cx="30" cy="11" r="10" />
    <path d="M22 21h16l5 7H17l5-7z" />
    <ellipse cx="30" cy="46" rx="16" ry="20" />
    <path d="M18 62l-2 30h10l4-24 4 24h10l-2-30z" />
    <rect x="12" y="92" width="12" height="5" rx="2" />
    <rect x="36" y="92" width="12" height="5" rx="2" />
    <rect x="10" y="28" width="8" height="24" rx="4" />
    <rect x="42" y="28" width="8" height="24" rx="4" />
  </svg>
);

// ── Female Body Shapes ──────────────────────────────────────

export const FemaleSlim: React.FC<BodyShapeProps> = ({ className = '', fill = '#9CA3AF' }) => (
  <svg viewBox="0 0 60 120" className={className} fill={fill} xmlns="http://www.w3.org/2000/svg">
    <circle cx="30" cy="12" r="8" />
    <path d="M26 20h8l3 7h-14l3-7z" />
    <path d="M23 27h14v14q0 4-2 6l-1 1v8q0 3 3 5l4 3v-1H19v1l4-3q3-2 3-5v-8l-1-1q-2-2-2-6V27z" />
    <path d="M19 64l-2 28h7l6-24 6 24h7l-2-28z" />
    <rect x="14" y="92" width="9" height="4" rx="1" />
    <rect x="37" y="92" width="9" height="4" rx="1" />
    <rect x="17" y="27" width="5" height="20" rx="2.5" />
    <rect x="38" y="27" width="5" height="20" rx="2.5" />
  </svg>
);

export const FemalePear: React.FC<BodyShapeProps> = ({ className = '', fill = '#9CA3AF' }) => (
  <svg viewBox="0 0 60 120" className={className} fill={fill} xmlns="http://www.w3.org/2000/svg">
    <circle cx="30" cy="12" r="8" />
    <path d="M26 20h8l3 7h-14l3-7z" />
    <path d="M24 27h12v14q0 3-1 5v10q0 3 4 5l5 3H16l5-3q4-2 4-5V46q-1-2-1-5V27z" />
    <path d="M16 64l-2 28h8l8-24 8 24h8l-2-28z" />
    <rect x="11" y="92" width="11" height="5" rx="2" />
    <rect x="38" y="92" width="11" height="5" rx="2" />
    <rect x="18" y="27" width="5" height="20" rx="2.5" />
    <rect x="37" y="27" width="5" height="20" rx="2.5" />
  </svg>
);

export const FemaleHourglass: React.FC<BodyShapeProps> = ({ className = '', fill = '#9CA3AF' }) => (
  <svg viewBox="0 0 60 120" className={className} fill={fill} xmlns="http://www.w3.org/2000/svg">
    <circle cx="30" cy="12" r="8" />
    <path d="M24 20h12l5 8H19l5-8z" />
    <path d="M19 28h22v10q0 5-4 7h-2v6h2q4 2 4 7v4H19v-4q0-5 4-7h2v-6h-2q-4-2-4-7V28z" />
    <path d="M17 62l-2 30h8l7-25 7 25h8l-2-30z" />
    <rect x="12" y="92" width="11" height="5" rx="2" />
    <rect x="37" y="92" width="11" height="5" rx="2" />
    <rect x="14" y="28" width="6" height="22" rx="3" />
    <rect x="40" y="28" width="6" height="22" rx="3" />
  </svg>
);

export const FemaleAthletic: React.FC<BodyShapeProps> = ({ className = '', fill = '#9CA3AF' }) => (
  <svg viewBox="0 0 60 120" className={className} fill={fill} xmlns="http://www.w3.org/2000/svg">
    <circle cx="30" cy="11" r="8" />
    <path d="M23 19h14l5 8H18l5-8z" />
    <path d="M18 27h24v12q0 4-3 6l-1 1v8q0 3 3 5l3 3H16l3-3q3-2 3-5v-8l-1-1q-3-2-3-6V27z" />
    <path d="M18 62l-3 30h9l6-25 6 25h9l-3-30z" />
    <rect x="12" y="92" width="11" height="5" rx="2" />
    <rect x="37" y="92" width="11" height="5" rx="2" />
    <rect x="12" y="27" width="7" height="24" rx="3.5" />
    <rect x="41" y="27" width="7" height="24" rx="3.5" />
  </svg>
);

export const FemalePlus: React.FC<BodyShapeProps> = ({ className = '', fill = '#9CA3AF' }) => (
  <svg viewBox="0 0 60 120" className={className} fill={fill} xmlns="http://www.w3.org/2000/svg">
    <circle cx="30" cy="11" r="9" />
    <path d="M24 20h12l4 7H20l4-7z" />
    <ellipse cx="30" cy="44" rx="15" ry="20" />
    <path d="M17 62l-2 30h9l6-24 6 24h9l-2-30z" />
    <rect x="12" y="92" width="12" height="5" rx="2" />
    <rect x="36" y="92" width="12" height="5" rx="2" />
    <rect x="11" y="27" width="7" height="22" rx="3.5" />
    <rect x="42" y="27" width="7" height="22" rx="3.5" />
  </svg>
);

// ── Shape definitions ───────────────────────────────────────

export interface BodyShapeOption {
  id: string;
  label: string;
  description: string;
  Component: React.FC<BodyShapeProps>;
}

export const MALE_SHAPES: BodyShapeOption[] = [
  { id: 'slim', label: 'Slim', description: 'Lean, narrow frame', Component: MaleSlim },
  { id: 'average', label: 'Average', description: 'Standard build', Component: MaleAverage },
  { id: 'athletic', label: 'Athletic', description: 'Muscular, V-taper', Component: MaleAthletic },
  { id: 'stocky', label: 'Stocky', description: 'Wide, solid frame', Component: MaleStocky },
  { id: 'heavy', label: 'Heavy', description: 'Larger build', Component: MaleHeavy },
];

export const FEMALE_SHAPES: BodyShapeOption[] = [
  { id: 'slim', label: 'Slim', description: 'Petite, lean frame', Component: FemaleSlim },
  { id: 'pear', label: 'Pear', description: 'Wider hips', Component: FemalePear },
  { id: 'hourglass', label: 'Hourglass', description: 'Balanced curves', Component: FemaleHourglass },
  { id: 'athletic', label: 'Athletic', description: 'Toned, broader shoulders', Component: FemaleAthletic },
  { id: 'plus', label: 'Plus', description: 'Fuller figure', Component: FemalePlus },
];
