import React, { useId } from 'react';

interface BeeLogoProps {
  size?: number;
  className?: string;
}

/* Abstract bee: a hexagon (the hive) with two stripes (the bee's body)
   and two thin line-art wings. Wings use currentColor so they stay visible
   in both light and dark themes. */
export const BeeLogo: React.FC<BeeLogoProps> = ({ size = 32, className = '' }) => {
  const clipId = `wathive-hex-${useId().replace(/:/g, '')}`;

  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="WatHive"
      fill="none"
    >
      <defs>
        <clipPath id={clipId}>
          <path d="M16 9 L23.8 13.5 V22.5 L16 27 L8.2 22.5 V13.5 Z" />
        </clipPath>
      </defs>

      {/* Wings: thin outlines, no fill */}
      <path
        d="M15 8 C11.5 2.5 6 3.5 6.5 7.5 C7 10 11.5 9.5 15 8 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M17 8 C20.5 2.5 26 3.5 25.5 7.5 C25 10 20.5 9.5 17 8 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />

      {/* Hexagon body */}
      <path d="M16 9 L23.8 13.5 V22.5 L16 27 L8.2 22.5 V13.5 Z" fill="#FFD54F" />

      {/* Two stripes, clipped to the hexagon */}
      <g clipPath={`url(#${clipId})`} fill="#1C1917">
        <rect x="6" y="15.2" width="20" height="2.4" />
        <rect x="6" y="20.2" width="20" height="2.4" />
      </g>
    </svg>
  );
};
