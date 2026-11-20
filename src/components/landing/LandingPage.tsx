import React, { useEffect, useId, useRef, useState } from 'react';
import {
  motion,
  animate,
  useMotionValue,
  useSpring,
  useReducedMotion,
  AnimatePresence
} from 'motion/react';
import { ArrowRight, Sun, Moon } from 'lucide-react';
import { ThemeMode } from '../../hooks/useTheme';
import { Bee } from '../common/Bee';
import { BeeLogo } from '../common/BeeLogo';
import { Goose } from '../common/Goose';
import { HoneycombCluster } from './HoneycombCluster';

import campusSocialImg from '../../assets/images/wathive_campus_social_1792617947412.jpg';
import hackathonImg from '../../assets/images/wathive_hackathon_1792617946142.jpg';
import sportsImg from '../../assets/images/wathive_sports_intramural_1792617947784.jpg';
import careerFairImg from '../../assets/images/wathive_career_fair_1792617948325.jpg';
import researchLabImg from '../../assets/images/wathive_research_lab_1792617948983.jpg';

interface LandingPageProps {
  onEnterApp: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

const BEE_SIZE = 40;
const BEE_WIDTH = BEE_SIZE;
const BEE_HEIGHT = (BEE_SIZE * 56) / 64; // 35px
const INTRO_DURATION_SEC = 2.8;

const HONEYCOMB_TILES = [
  {
    src: campusSocialImg,
    alt: 'University of Waterloo students mingling at a campus social gathering'
  },
  {
    src: hackathonImg,
    alt: 'Students collaborating together at a Waterloo hackathon'
  },
  {
    src: sportsImg,
    alt: 'Students playing intramural sports at campus recreation'
  },
  {
    src: careerFairImg,
    alt: 'Students chatting and networking at a Waterloo campus fair'
  },
  {
    src: researchLabImg,
    alt: 'Waterloo students working on a creative campus project'
  }
];

function buildFlightPath(vw: number, vh: number, endX: number, endY: number): string {
  const safeEndX = Math.max(120, endX);
  const loopCx = Math.max(72, Math.min(safeEndX * 0.48, safeEndX - 68));
  const loopRx = Math.min(46, Math.max(22, (safeEndX - 48) * 0.14));
  const loopRy = Math.min(44, Math.max(24, loopRx * 0.96));
  const loopCy = Math.max(
    loopRy + 36,
    endY - Math.min(108, Math.max(66, vh * 0.12))
  );

  // Start off-screen left
  const p0x = -48;
  const p0y = loopCy - loopRy * 0.35;

  // Swoop valley (C1 horizontal tangent right)
  const p1x = loopCx * 0.34;
  const p1y = loopCy + loopRy * 0.95;
  const c1ax = Math.max(-16, vw * 0.01);
  const c1ay = loopCy + loopRy * 0.65;
  const c1bx = p1x - loopRx * 0.72;
  const c1by = p1y;

  // Loop right edge (C1 vertical tangent straight up)
  const p2x = loopCx + loopRx;
  const p2y = loopCy;
  const c2ax = p1x + loopRx * 0.82;
  const c2ay = p1y;
  const c2bx = p2x;
  const c2by = p2y + loopRy * 0.72;

  // Loop left edge over top (C1 vertical tangent straight down; moves left across peak)
  const p3x = loopCx - loopRx;
  const p3y = loopCy;
  const c3ax = p2x;
  const c3ay = p2y - loopRy * 1.33;
  const c3bx = p3x;
  const c3by = p3y - loopRy * 1.33;

  // Loop bottom exit crossing beneath entry swoop
  const p4x = loopCx + loopRx * 0.48;
  const p4y = loopCy + loopRy * 0.95;
  const c4ax = p3x;
  const c4ay = p3y + loopRy * 0.85;
  const c4bx = loopCx - loopRx * 0.15;
  const c4by = loopCy + loopRy * 1.12;

  // Final swoop from loop exit to period center (exact C1 continuity at p4)
  const outVx = p4x - c4bx;
  const outVy = p4y - c4by;
  const remX = Math.max(40, endX - p4x);
  const c5ax = p4x + outVx * 0.95;
  const c5ay = p4y + outVy * 0.95;
  const c5bx = endX - Math.max(26, remX * 0.36);
  const c5by = endY - Math.max(24, Math.min(54, Math.abs(endY - loopCy) * 0.45));

  const f = (n: number) => n.toFixed(1);

  return [
    `M ${f(p0x)} ${f(p0y)}`,
    `C ${f(c1ax)} ${f(c1ay)}, ${f(c1bx)} ${f(c1by)}, ${f(p1x)} ${f(p1y)}`,
    `C ${f(c2ax)} ${f(c2ay)}, ${f(c2bx)} ${f(c2by)}, ${f(p2x)} ${f(p2y)}`,
    `C ${f(c3ax)} ${f(c3ay)}, ${f(c3bx)} ${f(c3by)}, ${f(p3x)} ${f(p3y)}`,
    `C ${f(c4ax)} ${f(c4ay)}, ${f(c4bx)} ${f(c4by)}, ${f(p4x)} ${f(p4y)}`,
    `C ${f(c5ax)} ${f(c5ay)}, ${f(c5bx)} ${f(c5by)}, ${f(endX)} ${f(endY)}`
  ].join(' ');
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onEnterApp,
  theme,
  onToggleTheme
}) => {
  const prefersReduced = Boolean(useReducedMotion());
  const trailMaskId = `bee-trail-mask-${useId().replace(/:/g, '')}`;

  const [introLanded, setIntroLanded] = useState<boolean>(prefersReduced);
  const [beeSettled, setBeeSettled] = useState<boolean>(prefersReduced);
  const [trailFading, setTrailFading] = useState<boolean>(false);
  const [trailRemoved, setTrailRemoved] = useState<boolean>(prefersReduced);
  const [wordVisible, setWordVisible] = useState<[boolean, boolean, boolean]>(
    prefersReduced ? [true, true, true] : [false, false, false]
  );

  const [flightRun, setFlightRun] = useState<{
    d: string;
    vw: number;
    vh: number;
    endX: number;
    endY: number;
    snap: boolean;
  } | null>(null);

  const [gooseHovered, setGooseHovered] = useState(false);
  const [gooseChasing, setGooseChasing] = useState(false);
  const [beeFacingLeft, setBeeFacingLeft] = useState(false);
  const [gooseFacingRight, setGooseFacingRight] = useState(false);

  const periodRef = useRef<HTMLSpanElement | null>(null);
  const word0Ref = useRef<HTMLSpanElement | null>(null);
  const word1Ref = useRef<HTMLSpanElement | null>(null);
  const word2Ref = useRef<HTMLSpanElement | null>(null);
  const maskPathRef = useRef<SVGPathElement | null>(null);
  const introBeeRef = useRef<HTMLDivElement | null>(null);
  const gooseBtnRef = useRef<HTMLButtonElement | null>(null);

  const progress = useMotionValue(prefersReduced ? 1 : 0);

  // Cursor-following bee motion values (viewport coordinates centered on bee)
  const beeTargetX = useMotionValue(-120);
  const beeTargetY = useMotionValue(-120);
  const beeX = useSpring(beeTargetX, { stiffness: 120, damping: 18, mass: 0.7 });
  const beeY = useSpring(beeTargetY, { stiffness: 120, damping: 18, mass: 0.7 });
  const beeRotateTarget = useMotionValue(0);
  const beeRotate = useSpring(beeRotateTarget, { stiffness: 180, damping: 20 });

  // Goose chase offset from its home bottom-right corner
  const gooseTargetX = useMotionValue(0);
  const gooseTargetY = useMotionValue(0);
  const gooseTargetRotate = useMotionValue(0);
  const gooseX = useSpring(gooseTargetX, { stiffness: 85, damping: 16, mass: 0.95 });
  const gooseY = useSpring(gooseTargetY, { stiffness: 85, damping: 16, mass: 0.95 });
  const gooseRotate = useSpring(gooseTargetRotate, { stiffness: 140, damping: 16 });

  const hasPointerMovedRef = useRef(false);
  const landedAtRef = useRef<number>(0);
  const manualHonkTimerRef = useRef<number | null>(null);
  const manualChaseRef = useRef(false);
  const wordThresholdsRef = useRef<[number, number, number]>([0.16, 0.44, 0.76]);

  const measurePeriodCenter = () => {
    const rect = periodRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0) {
      return {
        endX: rect.left + rect.width / 2,
        endY: rect.top + rect.height / 2
      };
    }
    return {
      endX: Math.min(420, window.innerWidth * 0.55),
      endY: window.innerHeight * 0.38
    };
  };

  // 1. Measure period center after fonts load & recompute on window resize
  useEffect(() => {
    if (prefersReduced) {
      setIntroLanded(true);
      setBeeSettled(true);
      setTrailRemoved(true);
      setWordVisible([true, true, true]);
      setFlightRun(null);
      return;
    }

    let cancelled = false;

    const triggerMeasure = (snap: boolean) => {
      if (cancelled) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const { endX, endY } = measurePeriodCenter();
      const d = buildFlightPath(vw, vh, endX, endY);
      if (snap) {
        setWordVisible([true, true, true]);
        setIntroLanded(true);
        setBeeSettled(!hasPointerMovedRef.current);
        setTrailFading(true);
        setTrailRemoved(true);
        if (!hasPointerMovedRef.current) {
          beeTargetX.set(endX);
          beeTargetY.set(endY);
          beeX.jump(endX);
          beeY.jump(endY);
          beeRotateTarget.set(-6);
          beeRotate.jump(-6);
          setBeeFacingLeft(false);
        }
      }
      setFlightRun({ d, vw, vh, endX, endY, snap });
    };

    const fontsReady =
      document.fonts && document.fonts.ready
        ? Promise.race([
            document.fonts.ready,
            new Promise<void>((resolve) => window.setTimeout(resolve, 400))
          ])
        : Promise.resolve();

    fontsReady.then(() => triggerMeasure(false));

    const handleResize = () => triggerMeasure(true);
    window.addEventListener('resize', handleResize);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleResize);
    };
  }, [prefersReduced, beeX, beeY, beeTargetX, beeTargetY, beeRotate, beeRotateTarget]);

  // 2. Drive bee & masked dotted trail from the committed SVG <path>
  useEffect(() => {
    if (prefersReduced || !flightRun || flightRun.snap) return;

    const pathEl = maskPathRef.current;
    if (!pathEl) return;

    const total = pathEl.getTotalLength();
    if (!total || !Number.isFinite(total)) return;

    let cancelled = false;
    let fadeTimer = 0;

    setIntroLanded(false);
    setBeeSettled(false);
    setTrailFading(false);
    setTrailRemoved(false);
    setWordVisible([false, false, false]);
    progress.set(0);

    pathEl.style.strokeDasharray = `${total}`;
    pathEl.style.strokeDashoffset = `${total}`;

    // Compute progress thresholds where the bee passes each word's x-position
    const w0Rect = word0Ref.current?.getBoundingClientRect();
    const w1Rect = word1Ref.current?.getBoundingClientRect();
    const w2Rect = word2Ref.current?.getBoundingClientRect();
    const w0X = w0Rect ? w0Rect.left + w0Rect.width * 0.35 : flightRun.endX * 0.25;
    const w1X = w1Rect ? w1Rect.left + w1Rect.width * 0.35 : flightRun.endX * 0.55;
    const w2X = w2Rect ? w2Rect.left + w2Rect.width * 0.3 : flightRun.endX * 0.8;

    const samples: Array<{ t: number; x: number }> = [];
    const steps = 100;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const pt = pathEl.getPointAtLength(t * total);
      samples.push({ t, x: pt.x });
    }
    const t0Raw = samples.find((s) => s.x >= w0X)?.t ?? 0.14;
    const t0 = Math.max(0.06, Math.min(0.28, t0Raw));
    const t1Raw = samples.find((s) => s.t >= t0 + 0.14 && s.x >= w1X)?.t ?? 0.42;
    const t1 = Math.max(t0 + 0.14, Math.min(0.65, t1Raw));
    const t2Raw =
      samples.find((s) => s.t >= Math.max(t1 + 0.14, 0.7) && s.x >= w2X)?.t ?? 0.78;
    const t2 = Math.max(t1 + 0.14, Math.min(0.88, t2Raw));
    wordThresholdsRef.current = [t0, t1, t2];

    let smoothedTilt = 0;
    let currentFlip: 1 | -1 = 1;
    let shown0 = false;
    let shown1 = false;
    let shown2 = false;

    const applyAtProgress = (v: number) => {
      const len = Math.max(0, Math.min(total, v * total));
      const p = pathEl.getPointAtLength(len);
      const q =
        len + 6 <= total
          ? pathEl.getPointAtLength(len + 6)
          : pathEl.getPointAtLength(total);
      const pRef =
        len + 6 <= total
          ? p
          : pathEl.getPointAtLength(Math.max(0, total - 6));

      const dx = q.x - pRef.x;
      const dy = q.y - pRef.y;

      if (Math.abs(dx) > 0.05) {
        currentFlip = dx < 0 ? -1 : 1;
      }

      const rawDeg = (Math.atan2(dy, Math.abs(dx)) * 180) / Math.PI;
      const clampedDeg = Math.max(-35, Math.min(35, rawDeg));
      smoothedTilt = smoothedTilt + (clampedDeg - smoothedTilt) * 0.25;

      const rot = currentFlip === 1 ? smoothedTilt : -smoothedTilt;
      const x = p.x - BEE_WIDTH / 2;
      const y = p.y - BEE_HEIGHT / 2;

      if (introBeeRef.current) {
        introBeeRef.current.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(
          2
        )}px) rotate(${rot.toFixed(2)}deg) scaleX(${currentFlip})`;
      }
      pathEl.style.strokeDashoffset = `${Math.max(0, total - len).toFixed(2)}`;

      const [th0, th1, th2] = wordThresholdsRef.current;
      if (!shown0 && v >= th0) {
        shown0 = true;
        setWordVisible([true, shown1, shown2]);
      }
      if (!shown1 && v >= th1) {
        shown1 = true;
        setWordVisible([shown0, true, shown2]);
      }
      if (!shown2 && v >= th2) {
        shown2 = true;
        setWordVisible([shown0, shown1, true]);
      }
    };

    applyAtProgress(0);
    const unsubscribe = progress.on('change', applyAtProgress);

    const animControls = animate(progress, 1, {
      duration: INTRO_DURATION_SEC,
      ease: [0.45, 0, 0.25, 1],
      onComplete: () => {
        if (cancelled) return;
        applyAtProgress(1);
        const finalCenter = measurePeriodCenter();
        const landingAngle = currentFlip === 1 ? smoothedTilt : -smoothedTilt;

        // Exact coordinate handoff from intro bee to cursor-following bee (zero jump)
        beeTargetX.set(finalCenter.endX);
        beeTargetY.set(finalCenter.endY);
        beeX.jump(finalCenter.endX);
        beeY.jump(finalCenter.endY);
        beeRotateTarget.set(landingAngle);
        beeRotate.jump(landingAngle);
        setBeeFacingLeft(currentFlip === -1);

        landedAtRef.current = performance.now();
        setWordVisible([true, true, true]);
        setIntroLanded(true);
        setBeeSettled(true);
        setTrailFading(true);

        // Tiny landing bounce & settle on the period
        window.requestAnimationFrame(() => {
          if (cancelled || hasPointerMovedRef.current) return;
          beeTargetY.set(finalCenter.endY + 3.5);
          beeRotateTarget.set(-6);
          setBeeFacingLeft(false);
          window.setTimeout(() => {
            if (cancelled || hasPointerMovedRef.current) return;
            beeTargetY.set(finalCenter.endY);
          }, 110);
        });

        fadeTimer = window.setTimeout(() => {
          if (!cancelled) setTrailRemoved(true);
        }, 650);
      }
    });

    return () => {
      cancelled = true;
      animControls.stop();
      unsubscribe();
      window.clearTimeout(fadeTimer);
    };
  }, [
    flightRun,
    prefersReduced,
    progress,
    beeX,
    beeY,
    beeTargetX,
    beeTargetY,
    beeRotate,
    beeRotateTarget
  ]);

  // Cursor & touch tracking for the bee (wrapper-only transforms)
  useEffect(() => {
    if (!introLanded || prefersReduced) return;

    let lastX = beeTargetX.get();
    let lastY = beeTargetY.get();

    const moveBee = (clientX: number, clientY: number) => {
      if (!hasPointerMovedRef.current) {
        hasPointerMovedRef.current = true;
        setBeeSettled(false);
      }
      const nextX = clientX + 14;
      const nextY = clientY - 14;
      const dx = nextX - lastX;
      const dy = nextY - lastY;

      if (Math.abs(dx) > 1.5) {
        setBeeFacingLeft(dx < 0);
      }

      if (Math.hypot(dx, dy) > 2) {
        const tilt = Math.max(-24, Math.min(24, dy * 0.45 + Math.abs(dx) * 0.15));
        beeRotateTarget.set(tilt);
      }

      lastX = nextX;
      lastY = nextY;
      beeTargetX.set(nextX);
      beeTargetY.set(nextY);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      moveBee(e.clientX, e.clientY);
    };

    const handlePointerDown = (e: PointerEvent) => {
      moveBee(e.clientX, e.clientY);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });

    // Gentle idle hover centered on the period after the landing bounce settles
    let rafId = 0;
    const tickIdle = (now: number) => {
      if (
        !hasPointerMovedRef.current &&
        periodRef.current &&
        now - landedAtRef.current > 320
      ) {
        const rect = periodRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const t = (now - landedAtRef.current - 320) / 1000;
        beeTargetX.set(cx + Math.sin(t * 1.2) * 2.5);
        beeTargetY.set(cy + Math.cos(t * 1.8) * 2.5);
        beeRotateTarget.set(-6 + Math.sin(t * 1.2) * 4);
      }
      rafId = window.requestAnimationFrame(tickIdle);
    };
    rafId = window.requestAnimationFrame(tickIdle);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.cancelAnimationFrame(rafId);
    };
  }, [introLanded, prefersReduced, beeTargetX, beeTargetY, beeRotateTarget]);

  // Goose-chases-bee proximity loop (capped speed)
  useEffect(() => {
    if (!introLanded || prefersReduced) return;

    let rafId = 0;
    const step = (now: number) => {
      const gooseEl = gooseBtnRef.current;
      if (gooseEl) {
        const rect = gooseEl.getBoundingClientRect();
        const currentOffsetX = gooseX.get();
        const currentOffsetY = gooseY.get();

        // Goose home center in viewport coordinates
        const homeX = rect.left + rect.width / 2 - currentOffsetX;
        const homeY = rect.top + rect.height / 2 - currentOffsetY;

        const currBeeX = beeX.get();
        const currBeeY = beeY.get();
        const gooseCenterX = homeX + currentOffsetX;
        const gooseCenterY = homeY + currentOffsetY;

        const distToCurrentGoose = Math.hypot(currBeeX - gooseCenterX, currBeeY - gooseCenterY);
        const distFromHome = Math.hypot(currBeeX - homeX, currBeeY - homeY);

        if (distToCurrentGoose < 120 || distFromHome < 120 || manualChaseRef.current) {
          setGooseChasing(true);

          const dx = currBeeX - homeX;
          const dy = currBeeY - homeY;
          const mag = Math.max(1, Math.hypot(dx, dy));
          const maxReach = 175;
          const reach = Math.min(maxReach, Math.max(48, mag * 0.72));
          const targetOx = (dx / mag) * reach;
          const targetOy = (dy / mag) * reach;

          setGooseFacingRight(currBeeX > gooseCenterX);

          // Step toward targetOx/Oy at capped speed so chase feels playful
          const stepDx = targetOx - currentOffsetX;
          const stepDy = targetOy - currentOffsetY;
          const stepDist = Math.hypot(stepDx, stepDy);
          const maxStep = 4.5;
          if (stepDist > maxStep) {
            gooseTargetX.set(currentOffsetX + (stepDx / stepDist) * maxStep);
            gooseTargetY.set(currentOffsetY + (stepDy / stepDist) * maxStep);
          } else {
            gooseTargetX.set(targetOx);
            gooseTargetY.set(targetOy);
          }

          // Playful waddle rock
          gooseTargetRotate.set(Math.sin(now * 0.018) * 11);

          // Bee zips playfully away when goose gets close
          if (distToCurrentGoose < 88 && hasPointerMovedRef.current) {
            const awayDx = currBeeX - gooseCenterX;
            const awayDy = currBeeY - gooseCenterY;
            const awayMag = Math.max(1, Math.hypot(awayDx, awayDy));
            setBeeFacingLeft(awayDx < 0);
            beeTargetX.set(Math.max(36, Math.min(window.innerWidth - 36, currBeeX + (awayDx / awayMag) * 72)));
            beeTargetY.set(Math.max(36, Math.min(window.innerHeight - 36, currBeeY + (awayDy / awayMag) * 72)));
          }
        } else {
          setGooseChasing(false);
          setGooseFacingRight(false);
          // Smoothly waddle back home
          gooseTargetX.set(0);
          gooseTargetY.set(Math.sin(now * 0.0022) * 3);
          gooseTargetRotate.set(Math.sin(now * 0.0018) * 2);
        }
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [
    introLanded,
    prefersReduced,
    beeX,
    beeY,
    beeTargetX,
    beeTargetY,
    gooseX,
    gooseY,
    gooseTargetX,
    gooseTargetY,
    gooseTargetRotate
  ]);

  const handleGooseClick = () => {
    if (prefersReduced) return;
    manualChaseRef.current = true;
    setGooseChasing(true);
    if (manualHonkTimerRef.current) {
      window.clearTimeout(manualHonkTimerRef.current);
    }
    manualHonkTimerRef.current = window.setTimeout(() => {
      manualChaseRef.current = false;
    }, 1500);
  };

  useEffect(() => {
    return () => {
      if (manualHonkTimerRef.current) {
        window.clearTimeout(manualHonkTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-canvas bg-honeycomb-pattern text-ink flex flex-col relative overflow-x-hidden transition-colors duration-200">
      {/* Full-viewport Intro Flight Overlay (1:1 SVG path + bee wrapper in same container) */}
      {!prefersReduced && (!introLanded || !trailRemoved) && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none z-40 overflow-hidden"
        >
          {flightRun && !trailRemoved && (
            <svg
              viewBox={`0 0 ${flightRun.vw} ${flightRun.vh}`}
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-[600ms] ease-out ${
                trailFading ? 'opacity-0' : 'opacity-100'
              }`}
            >
              <defs>
                <mask
                  id={trailMaskId}
                  maskUnits="userSpaceOnUse"
                  x="0"
                  y="0"
                  width={flightRun.vw}
                  height={flightRun.vh}
                >
                  <path
                    ref={maskPathRef}
                    d={flightRun.d}
                    fill="none"
                    stroke="white"
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeDasharray="9999"
                    strokeDashoffset="9999"
                  />
                </mask>
              </defs>
              <path
                d={flightRun.d}
                fill="none"
                stroke="var(--color-accent)"
                strokeOpacity={0.6}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="1 10"
                mask={`url(#${trailMaskId})`}
              />
            </svg>
          )}

          {!introLanded && (
            <div
              ref={introBeeRef}
              className="absolute left-0 top-0 pointer-events-none select-none"
              style={{
                width: BEE_WIDTH,
                height: BEE_HEIGHT,
                transformOrigin: '50% 50%',
                transform: 'translate(-120px, -120px)'
              }}
            >
              <Bee size={BEE_SIZE} flying />
            </div>
          )}
        </div>
      )}

      {/* Minimal Top Bar: Brand + Theme Toggle only */}
      <header className="relative z-20 max-w-[1280px] w-full mx-auto px-5 sm:px-8 h-20 flex items-center justify-between gap-6">
        <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
          <BeeLogo size={30} className="text-ink" />
          <span className="font-display font-bold text-xl tracking-tight text-ink">
            WatHive
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-10 h-10 rounded-2xl bg-surface/90 hover:bg-surface text-ink shadow-soft flex items-center justify-center transition-colors cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-accent" />
          ) : (
            <Moon className="w-4 h-4 text-ink" />
          )}
        </button>
      </header>

      {/* Main Hero Area */}
      <main className="relative z-10 flex-1 flex items-center max-w-[1280px] w-full mx-auto px-5 sm:px-8 py-8 sm:py-12 pb-28 lg:pb-16">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-y-10 sm:gap-y-12 lg:gap-12 items-center">
          {/* Left Column: Headline + Single CTA */}
          <div className="lg:col-span-6 relative">
            {/* Soft gold blurred blob behind headline */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-10 -left-10 w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-accent/25 blur-3xl"
            />

            <div className="relative pt-14 sm:pt-16">
              {/* Headline: "Meet Your People." revealed word by word as bee passes */}
              <h1
                className="relative font-display font-bold text-ink tracking-tight leading-[1.05] text-5xl sm:text-6xl xl:text-[4.5rem] max-w-xl"
                style={{ textWrap: 'balance' }}
              >
                <motion.span
                  ref={word0Ref}
                  className="inline-block mr-3 sm:mr-4"
                  initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
                  animate={
                    prefersReduced || wordVisible[0]
                      ? { opacity: 1, y: 0 }
                      : { opacity: 0, y: 14 }
                  }
                  transition={{ duration: prefersReduced ? 0 : 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
                  Meet
                </motion.span>
                <motion.span
                  ref={word1Ref}
                  className="inline-block mr-3 sm:mr-4"
                  initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
                  animate={
                    prefersReduced || wordVisible[1]
                      ? { opacity: 1, y: 0 }
                      : { opacity: 0, y: 14 }
                  }
                  transition={{ duration: prefersReduced ? 0 : 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
                  Your
                </motion.span>
                <motion.span
                  ref={word2Ref}
                  className="inline-block whitespace-nowrap"
                  initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
                  animate={
                    prefersReduced || wordVisible[2]
                      ? { opacity: 1, y: 0 }
                      : { opacity: 0, y: 14 }
                  }
                  transition={{ duration: prefersReduced ? 0 : 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
                  People
                  <span ref={periodRef} className="relative inline-block text-accent-text">
                    .
                    {prefersReduced && (
                      <span
                        aria-hidden="true"
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                      >
                        <Bee size={36} flying={false} />
                      </span>
                    )}
                  </span>
                </motion.span>
              </h1>

              {/* Subtitle & Single CTA fading in as bee lands */}
              <motion.div
                className="relative mt-6 space-y-7 max-w-md"
                initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                animate={
                  prefersReduced || introLanded
                    ? { opacity: 1, y: 0 }
                    : { opacity: 0, y: 12 }
                }
                transition={{
                  duration: prefersReduced ? 0 : 0.45,
                  ease: [0.16, 1, 0.3, 1]
                }}
              >
                <p className="text-base sm:text-lg text-muted leading-relaxed">
                  Discover University of Waterloo events and pair up with a student buddy who shares your vibe.
                </p>

                <div>
                  <button
                    type="button"
                    onClick={onEnterApp}
                    className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-accent hover:bg-accent-hover text-accent-ink font-semibold text-base shadow-soft hover:shadow-lift hover:-translate-y-0.5 transition-all duration-200 cursor-pointer whitespace-nowrap"
                  >
                    <span>Find your hive</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.4]" />
                  </button>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Right Column: Honeycomb Cluster of Student Photos */}
          <div className="lg:col-span-6 flex items-center justify-center pt-2 lg:pt-0">
            <motion.div
              initial={prefersReduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: prefersReduced ? 0 : 0.65, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="w-full"
            >
              <HoneycombCluster tiles={HONEYCOMB_TILES} prefersReduced={prefersReduced} />
            </motion.div>
          </div>
        </div>
      </main>

      {/* Separate full-screen floating layer for cursor-following Bee and Goose */}
      <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden">
        {!prefersReduced && introLanded && (
          <motion.div
            aria-hidden="true"
            style={{
              x: beeX,
              y: beeY,
              rotate: beeRotate,
              translateX: '-50%',
              translateY: '-50%',
              width: BEE_WIDTH,
              height: BEE_HEIGHT
            }}
            className="absolute top-0 left-0 pointer-events-none select-none"
          >
            <div
              style={{
                transform: beeFacingLeft ? 'scaleX(-1)' : 'scaleX(1)',
                transition: 'transform 120ms ease'
              }}
            >
              <Bee
                size={BEE_SIZE}
                flying
                className={beeSettled ? 'bee--settled' : ''}
              />
            </div>
          </motion.div>
        )}

        {/* Animated Waterloo Goose in Bottom-Right Corner */}
        <div className="absolute bottom-3 right-3 sm:bottom-5 sm:right-6 flex items-end gap-2.5">
          <AnimatePresence>
            {(gooseHovered || gooseChasing) && (
              <motion.div
                initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 6, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.96 }}
                transition={{ duration: 0.16 }}
                className="mb-12 bg-surface text-ink border border-line shadow-lift rounded-2xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap pointer-events-none"
              >
                {gooseChasing ? 'HONK!' : "Honk if you're going"}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            ref={gooseBtnRef}
            type="button"
            onClick={handleGooseClick}
            onMouseEnter={() => setGooseHovered(true)}
            onMouseLeave={() => setGooseHovered(false)}
            onFocus={() => setGooseHovered(true)}
            onBlur={() => setGooseHovered(false)}
            aria-label="Waterloo goose mascot. Click for a playful honk."
            style={
              prefersReduced
                ? undefined
                : {
                    x: gooseX,
                    y: gooseY,
                    rotate: gooseRotate
                  }
            }
            className="pointer-events-auto w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center cursor-pointer focus-visible:outline-2"
          >
            <div
              style={{
                transform: gooseFacingRight ? 'scaleX(-1)' : 'scaleX(1)',
                transition: 'transform 150ms ease'
              }}
            >
              <Goose
                size={88}
                state={prefersReduced ? 'looking' : gooseChasing ? 'chasing' : 'idle'}
              />
            </div>
          </motion.button>
        </div>
      </div>
    </div>
  );
};
