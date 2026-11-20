import React, { useId } from 'react';

interface BeeProps {
  size?: number;      // width in px
  flying?: boolean;   // wings flap when true, static when false
  className?: string;
}

export const Bee: React.FC<BeeProps> = ({ size = 48, flying = true, className = '' }) => {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 64 56"
      width={size}
      height={(size * 56) / 64}
      className={`bee ${flying ? 'bee--flying' : ''} ${className}`}
      role="img"
      aria-label="Bee"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <clipPath id={`bee-body-${id}`}>
          <ellipse cx="30" cy="36" rx="15" ry="10.5" />
        </clipPath>
      </defs>

      {/* WINGS (drawn first so they sit behind the body).
          Each wing path has its TIP at (0,0). The outer <g> positions and tilts it
          at the thorax; the CSS animation rotates the path around its tip. */}
      <g transform="translate(26 27) rotate(-22)">
        <path
          className="bee-wing bee-wing--back"
          d="M0 0 C-7 -5 -8 -17 0 -22 C8 -17 7 -5 0 0 Z"
        />
      </g>
      <g transform="translate(33 27) rotate(12)">
        <path
          className="bee-wing bee-wing--front"
          d="M0 0 C-7 -5 -8 -17 0 -22 C8 -17 7 -5 0 0 Z"
        />
      </g>

      {/* Stinger */}
      <path d="M15.5 34.5 L9 36.5 L15.5 38.5 Z" fill="#1C1917" />

      {/* Body + stripes clipped to the body shape */}
      <ellipse cx="30" cy="36" rx="15" ry="10.5" fill="#FFC933" />
      <g clipPath={`url(#bee-body-${id})`}>
        <rect x="22" y="24" width="4.5" height="26" fill="#1C1917" />
        <rect x="31" y="24" width="4.5" height="26" fill="#1C1917" />
      </g>

      {/* Head, eye, cheek, smile, antennae */}
      <circle cx="46" cy="35" r="7.5" fill="#FFC933" stroke="#1C1917" strokeWidth="1.5" />
      <circle cx="48.5" cy="33.5" r="2.2" fill="#1C1917" />
      <circle cx="49.2" cy="32.8" r="0.7" fill="#FFFFFF" />
      <circle cx="46" cy="38.5" r="1.6" fill="#FF9AA2" opacity="0.7" />
      <path d="M48 38 Q50.5 40 52.5 37.8" stroke="#1C1917" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M45 28.5 Q45 23.5 41 22" stroke="#1C1917" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M49 28.8 Q51 24 55 23.5" stroke="#1C1917" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="41" cy="22" r="1.4" fill="#1C1917" />
      <circle cx="55" cy="23.5" r="1.4" fill="#1C1917" />
    </svg>
  );
};
