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

/**
 * React Bits DotGrid interactive physics configuration.
 * Matches https://www.reactbits.dev/backgrounds/dot-grid property semantics.
 */
export interface DotGridPhysicsConfig {
  /** Radius around cursor that pushes & illuminates dots (px) */
  proximity: number;
  /** How hard a moving/hovering cursor pushes dots */
  strength: number;
  /** Overshoot / wobble factor as dots settle (0..1) */
  bounce: number;
  /** How strongly each dot pulls on its 4 neighbors like jelly (0..1) */
  tension: number;
  /** Approximate settle duration back to rest (seconds) */
  returnDuration: number;
  /** How far a click shockwave travels (px) */
  shockRadius: number;
  /** How hard a click shockwave pushes dots */
  shockStrength: number;
  /** How much lit/active dots grow in radius */
  swell: number;
  /** How much fast-moving dots stretch along their velocity vector */
  stretch: number;
}

export const DEFAULT_DOT_GRID_CONFIG: DotGridPhysicsConfig = {
  proximity: 145,
  strength: 1.0,
  bounce: 0.62,
  tension: 0.32,
  returnDuration: 0.85,
  shockRadius: 340,
  shockStrength: 5.2,
  swell: 0.58,
  stretch: 0.45,
};

export interface PointerFieldState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
}

export interface Shockwave {
  x: number;
  y: number;
  startTime: number;
}

export interface DotGridPhysicsBuffers {
  cols: number;
  rows: number;
  ox: Float32Array;
  oy: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  activity: Float32Array;
}

export function createDotGridBuffers(
  cols: number,
  rows: number
): DotGridPhysicsBuffers {
  const count = Math.max(0, cols * rows);
  return {
    cols,
    rows,
    ox: new Float32Array(count),
    oy: new Float32Array(count),
    vx: new Float32Array(count),
    vy: new Float32Array(count),
    activity: new Float32Array(count),
  };
}

/**
 * Advances the springy dot-grid simulation by `dt` seconds.
 * Combines:
 * 1. Cursor proximity radial repulsion + velocity drag
 * 2. Expanding click shockwave ring impulses
 * 3. 4-neighbor jelly tension coupling
 * 4. Underdamped Hookean spring return to origin
 */
export function stepDotGridPhysics(
  buffers: DotGridPhysicsBuffers,
  stepX: number,
  stepY: number,
  pointer: PointerFieldState,
  shockwaves: Shockwave[],
  nowSec: number,
  dtRaw: number,
  config: DotGridPhysicsConfig = DEFAULT_DOT_GRID_CONFIG
): void {
  const { cols, rows, ox, oy, vx, vy, activity } = buffers;
  if (cols <= 0 || rows <= 0) return;

  const dt = clamp(dtRaw, 0.001, 0.033);

  // Derive spring stiffness & damping from returnDuration and bounce
  const settle = Math.max(0.2, config.returnDuration);
  const omega = (6.8 / settle) * (0.85 + 0.35 * config.bounce);
  const stiffness = omega * omega;
  const zeta = clamp(1.05 - config.bounce * 0.78, 0.18, 0.95);
  const damping = Math.exp(-2 * zeta * omega * dt);
  const neighborCoupling = config.tension * 42;

  // 1. Apply cursor proximity forces inside bounding box
  if (pointer.active) {
    const prox = Math.max(16, config.proximity);
    const prox2 = prox * prox;
    const minCol = clamp(Math.floor((pointer.x - prox) / stepX), 0, cols - 1);
    const maxCol = clamp(Math.ceil((pointer.x + prox) / stepX), 0, cols - 1);
    const minRow = clamp(Math.floor((pointer.y - prox) / stepY), 0, rows - 1);
    const maxRow = clamp(Math.ceil((pointer.y + prox) / stepY), 0, rows - 1);

    const pointerSpeed = Math.hypot(pointer.vx, pointer.vy);
    const velBoost = clamp(pointerSpeed / 900, 0, 1.6);

    for (let j = minRow; j <= maxRow; j++) {
      const dotY = (j + 0.5) * stepY;
      const dy = dotY - pointer.y;
      const dy2 = dy * dy;

      for (let i = minCol; i <= maxCol; i++) {
        const dotX = (i + 0.5) * stepX;
        const dx = dotX - pointer.x;
        const dist2 = dx * dx + dy2;
        if (dist2 >= prox2) continue;

        const dist = Math.sqrt(dist2);
        const u = 1 - dist / prox;
        const falloff = u * u * (3 - 2 * u);
        const idx = j * cols + i;

        const invDist = dist > 0.001 ? 1 / dist : 0;
        const nx = dist > 0.001 ? dx * invDist : 0;
        const ny = dist > 0.001 ? dy * invDist : 1;

        // Radial repulsion + cursor momentum drag
        const radialForce = (260 + 220 * velBoost) * config.strength * falloff;
        const dragForce = 0.28 * config.strength * falloff;

        vx[idx] += (nx * radialForce + pointer.vx * dragForce) * dt;
        vy[idx] += (ny * radialForce + pointer.vy * dragForce) * dt;

        const targetAct = clamp(falloff * (0.72 + 0.45 * velBoost), 0, 1);
        if (targetAct > activity[idx]) {
          activity[idx] = targetAct;
        }
      }
    }
  }

  // 2. Apply active click shockwaves
  const shockDuration = 0.68;
  const bandHalfWidth = Math.max(28, config.shockRadius * 0.16);

  for (let s = 0; s < shockwaves.length; s++) {
    const wave = shockwaves[s];
    const age = nowSec - wave.startTime;
    if (age < 0 || age > shockDuration) continue;

    const progress = age / shockDuration;
    // Ease-out expansion of shockwave ring
    const eased = 1 - Math.pow(1 - progress, 2.2);
    const waveRadius = eased * config.shockRadius;
    const fade = 1 - progress;

    const outerR = waveRadius + bandHalfWidth;
    const innerR = Math.max(0, waveRadius - bandHalfWidth);
    const outerR2 = outerR * outerR;
    const innerR2 = innerR * innerR;

    const minCol = clamp(Math.floor((wave.x - outerR) / stepX), 0, cols - 1);
    const maxCol = clamp(Math.ceil((wave.x + outerR) / stepX), 0, cols - 1);
    const minRow = clamp(Math.floor((wave.y - outerR) / stepY), 0, rows - 1);
    const maxRow = clamp(Math.ceil((wave.y + outerR) / stepY), 0, rows - 1);

    for (let j = minRow; j <= maxRow; j++) {
      const dotY = (j + 0.5) * stepY;
      const dy = dotY - wave.y;
      const dy2 = dy * dy;

      for (let i = minCol; i <= maxCol; i++) {
        const dotX = (i + 0.5) * stepX;
        const dx = dotX - wave.x;
        const dist2 = dx * dx + dy2;
        if (dist2 > outerR2 || dist2 < innerR2) continue;

        const dist = Math.sqrt(dist2);
        const bandDist = Math.abs(dist - waveRadius) / bandHalfWidth;
        const ringPulse = smooth(1, 0, bandDist) * fade;
        if (ringPulse <= 0.001) continue;

        const idx = j * cols + i;
        const invDist = dist > 0.001 ? 1 / dist : 0;
        const impulse = 195 * config.shockStrength * ringPulse * dt;

        vx[idx] += dx * invDist * impulse;
        vy[idx] += dy * invDist * impulse;

        const shockAct = clamp(ringPulse * 1.15, 0, 1);
        if (shockAct > activity[idx]) {
          activity[idx] = shockAct;
        }
      }
    }
  }

  // 3. 4-neighbor jelly tension + Hookean spring integration
  const maxOffset = Math.max(stepX, stepY) * 2.35;
  const activityDecay = Math.exp(-dt / Math.max(0.18, settle * 0.45));

  for (let j = 0; j < rows; j++) {
    const rowOffset = j * cols;
    for (let i = 0; i < cols; i++) {
      const idx = rowOffset + i;
      const curOx = ox[idx];
      const curOy = oy[idx];
      let curVx = vx[idx];
      let curVy = vy[idx];

      // Fast skip for completely dormant nodes
      if (
        Math.abs(curOx) < 0.01 &&
        Math.abs(curOy) < 0.01 &&
        Math.abs(curVx) < 0.05 &&
        Math.abs(curVy) < 0.05 &&
        activity[idx] < 0.005
      ) {
        ox[idx] = 0;
        oy[idx] = 0;
        vx[idx] = 0;
        vy[idx] = 0;
        activity[idx] = 0;
        continue;
      }

      // 4-neighbor tension average
      if (neighborCoupling > 0) {
        const leftOx = i > 0 ? ox[idx - 1] : curOx;
        const rightOx = i + 1 < cols ? ox[idx + 1] : curOx;
        const upOx = j > 0 ? ox[idx - cols] : curOx;
        const downOx = j + 1 < rows ? ox[idx + cols] : curOx;

        const leftOy = i > 0 ? oy[idx - 1] : curOy;
        const rightOy = i + 1 < cols ? oy[idx + 1] : curOy;
        const upOy = j > 0 ? oy[idx - cols] : curOy;
        const downOy = j + 1 < rows ? oy[idx + cols] : curOy;

        const avgOx = 0.25 * (leftOx + rightOx + upOx + downOx);
        const avgOy = 0.25 * (leftOy + rightOy + upOy + downOy);

        curVx += (avgOx - curOx) * neighborCoupling * dt;
        curVy += (avgOy - curOy) * neighborCoupling * dt;
      }

      // Spring restoring acceleration toward (0, 0)
      curVx = (curVx - stiffness * curOx * dt) * damping;
      curVy = (curVy - stiffness * curOy * dt) * damping;

      const nextOx = clamp(curOx + curVx * dt, -maxOffset, maxOffset);
      const nextOy = clamp(curOy + curVy * dt, -maxOffset, maxOffset);

      ox[idx] = nextOx;
      oy[idx] = nextOy;
      vx[idx] = curVx;
      vy[idx] = curVy;

      // Combine kinetic energy + decaying proximity activity
      const dispNorm = Math.hypot(nextOx, nextOy) / (maxOffset * 0.55);
      const kineticAct = clamp(dispNorm, 0, 1);
      activity[idx] = Math.max(activity[idx] * activityDecay, kineticAct * 0.85);
    }
  }
}

