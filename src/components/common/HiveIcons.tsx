import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Bee } from './Bee';

/**
 * Small bee spinner for loading states using the shared Bee component.
 */
export const BeeSpinner: React.FC<{ label?: string; className?: string }> = ({
  label = 'Loading campus events...',
  className = ''
}) => {
  const prefersReduced = useReducedMotion();

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex flex-col items-center justify-center gap-3 ${className}`}
    >
      <div className="relative w-12 h-12 flex items-center justify-center">
        <svg viewBox="0 0 48 48" className="w-12 h-12" aria-hidden="true">
          <path
            d="M24 4L41.3 14V34L24 44L6.7 34V14L24 4Z"
            fill="var(--color-accent-soft)"
            stroke="var(--color-accent)"
            strokeWidth="2"
          />
        </svg>
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={prefersReduced ? undefined : { rotate: 360 }}
          transition={prefersReduced ? undefined : { duration: 1.8, repeat: Infinity, ease: 'linear' }}
        >
          <div className="-translate-y-5">
            <Bee size={22} flying={!prefersReduced} />
          </div>
        </motion.div>
      </div>
      {label && <span className="text-xs font-medium text-muted">{label}</span>}
    </div>
  );
};

/**
 * Gold hexagon confetti burst triggered on RSVP.
 */
const CONFETTI_PARTICLES = [
  { x: -34, y: -28, rot: -35, scale: 0.9, delay: 0 },
  { x: -18, y: -42, rot: 25, scale: 1.05, delay: 0.03 },
  { x: 4, y: -46, rot: -15, scale: 0.85, delay: 0.02 },
  { x: 24, y: -38, rot: 45, scale: 1.0, delay: 0.04 },
  { x: 38, y: -22, rot: -20, scale: 0.8, delay: 0.01 },
  { x: -28, y: 12, rot: 30, scale: 0.75, delay: 0.05 },
  { x: 32, y: 14, rot: -40, scale: 0.75, delay: 0.04 }
];

export const HexConfettiBurst: React.FC<{ active: boolean }> = ({ active }) => {
  const prefersReduced = useReducedMotion();
  if (!active || prefersReduced) return null;

  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible z-30" aria-hidden="true">
      {CONFETTI_PARTICLES.map((p, idx) => (
        <motion.svg
          key={idx}
          viewBox="0 0 16 16"
          className="w-3 h-3 absolute"
          initial={{ opacity: 1, x: 0, y: 0, scale: 0.3, rotate: 0 }}
          animate={{ opacity: 0, x: p.x, y: p.y, scale: p.scale, rotate: p.rot }}
          transition={{ duration: 0.65, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
        >
          <polygon
            points="8,1 14.5,4.5 14.5,11.5 8,15 1.5,11.5 1.5,4.5"
            fill={idx % 2 === 0 ? '#FFD54F' : '#FBC02D'}
          />
        </motion.svg>
      ))}
    </span>
  );
};
