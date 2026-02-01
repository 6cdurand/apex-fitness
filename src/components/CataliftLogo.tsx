'use client';

import React from 'react';

interface CataliftLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export function CataliftLogo({ size = 'md', showText = true, className = '' }: CataliftLogoProps) {
  const sizes = {
    sm: { icon: 24, text: 'text-lg', gap: 'gap-1.5' },
    md: { icon: 32, text: 'text-2xl', gap: 'gap-2' },
    lg: { icon: 48, text: 'text-3xl', gap: 'gap-3' },
    xl: { icon: 64, text: 'text-5xl', gap: 'gap-4' },
  };

  const { icon, text, gap } = sizes[size];

  return (
    <div className={`flex items-center ${gap} ${className}`}>
      {/* Rocket/Arrow Icon with gradient */}
      <div className="relative">
        <svg
          width={icon}
          height={icon}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Gradient definitions */}
          <defs>
            <linearGradient id="cataliftGradient" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0EA5E9" />
              <stop offset="50%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#F97316" />
            </linearGradient>
            <linearGradient id="starGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FBBF24" />
              <stop offset="100%" stopColor="#F97316" />
            </linearGradient>
          </defs>
          
          {/* Main rocket/arrow shape */}
          <path
            d="M24 4L8 44L24 36L40 44L24 4Z"
            fill="url(#cataliftGradient)"
          />
          
          {/* Inner detail */}
          <path
            d="M24 12L16 36L24 32L32 36L24 12Z"
            fill="white"
            fillOpacity="0.3"
          />
          
          {/* Star accent */}
          <path
            d="M38 8L40 12L44 10L42 14L46 16L42 18L44 22L40 20L38 24L36 20L32 22L34 18L30 16L34 14L32 10L36 12L38 8Z"
            fill="url(#starGradient)"
          />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col">
          <span className={`font-bold ${text} bg-gradient-to-r from-sky-400 via-sky-300 to-orange-400 bg-clip-text text-transparent`}>
            Catalift
          </span>
          {size !== 'sm' && (
            <span className="text-xs text-sky-300/70 tracking-widest uppercase -mt-1">
              Ignite Your Rise
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function CataliftIcon({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="cataliftIconGradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0EA5E9" />
          <stop offset="50%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#F97316" />
        </linearGradient>
        <linearGradient id="starIconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#F97316" />
        </linearGradient>
      </defs>
      
      <path
        d="M24 4L8 44L24 36L40 44L24 4Z"
        fill="url(#cataliftIconGradient)"
      />
      
      <path
        d="M24 12L16 36L24 32L32 36L24 12Z"
        fill="white"
        fillOpacity="0.3"
      />
      
      <path
        d="M38 8L40 12L44 10L42 14L46 16L42 18L44 22L40 20L38 24L36 20L32 22L34 18L30 16L34 14L32 10L36 12L38 8Z"
        fill="url(#starIconGradient)"
      />
    </svg>
  );
}
