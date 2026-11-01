/**
 * Pure mathematical routines for the IOX dot-matrix halftone simulation.
 * Adapted from reference/kindred-—-dot-matrix-hands-hero.
 */

export const LOOP = 20;
export const LEVELS = [0, 0.26, 0.52, 0.78, 1] as const;

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function fract(n: number): number {
  return n - Math.floor(n);
}

export function hash(a: number, b: number): number {
  return fract(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
}

export function smooth(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export function mixAt(t: number, on: number, off: number, dur: number): number {
  return smooth(on, on + dur, t) * (1 - smooth(off, off + dur, t));
}

export function computeDissolveSeed(i: number, j: number): number {
  return 0.55 * hash(i, j) + 0.45 * hash(j * 3.1, 7.7);
}

export function getQuantizedLevel(v: number): number {
  for (let idx = LEVELS.length - 1; idx >= 0; idx--) {
    const level = LEVELS[idx];
    if (v >= level - 0.13) {
      return level;
    }
  }
  return 0;
}

export function getDotRadius(level: number, baseRadius: number): number {
  if (level <= 0) return 0;
  if (level === 0.26) {
    return baseRadius * 0.38;
  }
  return baseRadius * level;
}

export function computeRowShift(j: number, tick: number): number {
  if (hash(j, tick) > 0.965) {
    return Math.round((hash(tick, j) - 0.5) * 8);
  }
  return 0;
}

export interface HandParams {
  x: number;
  y: number;
  hw: number;
  hh: number;
  rot: number;
  scale: number;
  pivotX: number;
  pivotY: number;
}

export function computeHandMotion(
  t: number,
  isLeft: boolean,
  W: number,
  H: number,
  isPortrait: boolean
): HandParams {
  const a = (2 * Math.PI * (t % LOOP)) / LOOP;
  const ph = isLeft ? 0 : Math.PI;

  const hw = isPortrait ? W * 0.66 : W * 0.53;
  // Aspect ratio preserved from reference source: (0.40 * 1520) / (0.47 * 2688)
  const hh = hw * ((0.4 * 1520) / (0.47 * 2688));
  const cy = isPortrait ? H * 0.66 : H * 0.54;

  const reach = (0.035 * Math.sin(a + ph) + 0.012 * Math.sin(2 * a + 1.3 + ph)) * W;
  const scale = 1 + 0.07 * Math.sin(a + 0.9 + ph);
  const rot = (isLeft ? 1 : -1) * 0.045 * Math.sin(a + 2.1 + ph);

  const x = isLeft ? reach - W * 0.045 : W - hw + W * 0.045 - reach;
  const y = cy - hh / 2;

  const pivotX = isLeft ? 0 : W;
  const pivotY = cy;

  return {
    x,
    y,
    hw,
    hh,
    rot,
    scale,
    pivotX,
    pivotY,
  };
}
