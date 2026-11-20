import React from 'react';

interface GooseProps {
  size?: number;
  state?: 'idle' | 'chasing' | 'looking';
  className?: string;
}

/**
 * Shared Waterloo Goose component reused across the Landing Page and quiet empty states.
 */
export const Goose: React.FC<GooseProps> = ({
  size = 88,
  state = 'idle',
  className = ''
}) => {
  const isChasing = state === 'chasing';
  const isIdle = state === 'idle';

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`goose ${isChasing ? 'goose--chasing' : ''} ${isIdle ? 'goose--idle' : ''} ${className}`}
      role="img"
      aria-label="Waterloo goose"
      style={{ overflow: 'visible' }}
    >
      {/* Soft warm shadow */}
      <ellipse cx="62" cy="105" rx="34" ry="7" fill="var(--color-accent-soft)" />

      {/* Legs / feet (waddle during chase) */}
      <g className="goose-leg goose-leg--left">
        <path
          d="M52 86 L50 101 M50 101 L43 103 M50 101 L55 103"
          stroke="#F59E0B"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g className="goose-leg goose-leg--right">
        <path
          d="M70 86 L72 101 M72 101 L66 103 M72 101 L78 103"
          stroke="#F59E0B"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Back wing (flaps during chase) */}
      <g transform="translate(66 64)">
        <path
          className="goose-wing goose-wing--back"
          d="M0 0 C6 -16 24 -18 28 -4 C22 4 10 6 0 0 Z"
          fill="var(--color-surface-soft)"
          stroke="var(--color-ink)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      </g>

      {/* Tail feathers */}
      <path
        d="M84 68 L97 58 L92 73 Z"
        fill="var(--color-surface)"
        stroke="var(--color-ink)"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />

      {/* Goose body */}
      <ellipse
        cx="64"
        cy="74"
        rx="26"
        ry="18"
        fill="var(--color-surface)"
        stroke="var(--color-ink)"
        strokeWidth="2.5"
      />

      {/* Front wing anchored at shoulder */}
      <g transform="translate(54 67)">
        <path
          className="goose-wing goose-wing--front"
          d="M0 0 C8 -8 24 -6 29 5 C21 13 7 13 -1 6 Z"
          fill="var(--color-surface-soft)"
          stroke="var(--color-ink)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      </g>

      {/* Neck & head */}
      <path
        d="M46 70 C41 57 40 36 44 26 C47 18 57 18 59 26 C60 32 54 37 54 45 C54 53 57 61 61 67"
        fill="var(--color-surface)"
        stroke="var(--color-ink)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* UW gold scarf */}
      <path d="M42 49 C47 52 53 51 56 48" stroke="var(--color-accent)" strokeWidth="5.8" strokeLinecap="round" />
      <path d="M53 50 L58 60" stroke="var(--color-accent)" strokeWidth="4.6" strokeLinecap="round" />

      {/* Orange beak */}
      <path
        d={isChasing ? 'M41 25 L26 22 L40 30 L27 33 L42 32 Z' : 'M42 25 C34 25 28 27.5 28 30 C28 32.5 35 33 42 31.5 Z'}
        fill="#F59E0B"
        stroke="var(--color-ink)"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Eye + cute cheek */}
      <circle cx="48.5" cy="25.5" r="2.1" fill="var(--color-ink)" />
      <circle cx="48" cy="24.8" r="0.65" fill="#FFFFFF" />
      <circle cx="51.5" cy="29.5" r="1.8" fill="#FF9AA2" opacity="0.65" />

      {/* Subtle curiosity dots for empty-state 'looking' */}
      {state === 'looking' && (
        <>
          <circle cx="24" cy="20" r="2.8" fill="var(--color-accent)" />
          <circle cx="16" cy="29" r="1.8" fill="var(--color-accent)" fillOpacity="0.65" />
        </>
      )}
    </svg>
  );
};
