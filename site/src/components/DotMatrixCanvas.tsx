import React, { useEffect, useRef } from 'react';
import {
  clamp,
  computeDissolveSeed,
  computeHandMotion,
  computeRowShift,
  getDotRadius,
  getQuantizedLevel,
  hash,
  LOOP,
  mixAt,
  smooth,
  HandParams,
} from '../utils/matrix-math';

import handSheetAsset from '../../assets/HAND_SHEET.png';

const HAND_SHEET_URL = handSheetAsset;

// Sheet layout [x, y, w, h] as fractions of sheet width and height
const RECT_LA = [0, 0.06, 0.47, 0.4];
const RECT_RA = [0.53, 0.06, 0.47, 0.4];
const RECT_LB = [0, 0.55, 0.47, 0.4];
const RECT_RB = [0.53, 0.55, 0.47, 0.4];

interface Tiles {
  tileLA: HTMLCanvasElement;
  tileRA: HTMLCanvasElement;
  tileLB: HTMLCanvasElement;
  tileRB: HTMLCanvasElement;
}

function createTile(
  img: HTMLImageElement,
  rect: number[],
  targetWidth = 420
): HTMLCanvasElement {
  const sx = rect[0] * img.naturalWidth;
  const sy = rect[1] * img.naturalHeight;
  const sw = rect[2] * img.naturalWidth;
  const sh = rect[3] * img.naturalHeight;

  const targetHeight = Math.max(1, Math.round(targetWidth * (sh / sw)));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
  }
  return canvas;
}

function createFallbackTile(isLeft: boolean, isPoseA: boolean): HTMLCanvasElement {
  // Graceful fallback tile in case image fails to load
  const canvas = document.createElement('canvas');
  canvas.width = 420;
  canvas.height = 202;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 420, 202);

    ctx.fillStyle = '#404040';
    ctx.beginPath();
    if (isLeft) {
      ctx.ellipse(140, 100, 160, 45, 0.05, 0, Math.PI * 2);
      ctx.ellipse(280, isPoseA ? 95 : 85, 100, 18, 0, 0, Math.PI * 2);
    } else {
      ctx.ellipse(280, 100, 160, 45, -0.05, 0, Math.PI * 2);
      ctx.ellipse(140, isPoseA ? 105 : 115, 100, 18, 0, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  return canvas;
}

export const DotMatrixCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const t0 = performance.now();
    let isMounted = true;

    // Offscreen field canvases
    const fA = document.createElement('canvas');
    const ctxA = fA.getContext('2d', { willReadFrequently: true });
    const fB = document.createElement('canvas');
    const ctxB = fB.getContext('2d', { willReadFrequently: true });

    let tiles: Tiles | null = null;
    let seedGrid = new Float32Array(0);
    let rowShifts = new Int16Array(0);

    let W = 0;
    let H = 0;
    let DPR = 1;
    let step = 7;
    let rowStep = 14;
    let cols = 0;
    let rows = 0;
    let R = 3;

    function handleResize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      W = Math.max(320, Math.round(rect.width));
      H = Math.max(480, Math.round(rect.height));
      DPR = Math.min(2, window.devicePixelRatio || 1);

      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);

      step = Math.max(5, W / 205);
      rowStep = step * 2.05;
      cols = Math.ceil(W / step);
      rows = Math.ceil(H / rowStep);
      R = step * 0.46;

      fA.width = cols;
      fA.height = rows;
      fB.width = cols;
      fB.height = rows;

      // Recompute per-cell dissolve seeds
      seedGrid = new Float32Array(cols * rows);
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          seedGrid[j * cols + i] = computeDissolveSeed(i, j);
        }
      }
      rowShifts = new Int16Array(rows);
    }

    handleResize();
    window.addEventListener('resize', handleResize);

    // Load sheet image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = HAND_SHEET_URL;

    img.onload = () => {
      if (!isMounted) return;
      try {
        tiles = {
          tileLA: createTile(img, RECT_LA, 420),
          tileRA: createTile(img, RECT_RA, 420),
          tileLB: createTile(img, RECT_LB, 420),
          tileRB: createTile(img, RECT_RB, 420),
        };
      } catch (err) {
        console.warn('Could not slice tiles with getImageData CORS fallback', err);
        tiles = {
          tileLA: createFallbackTile(true, true),
          tileRA: createFallbackTile(false, true),
          tileLB: createFallbackTile(true, false),
          tileRB: createFallbackTile(false, false),
        };
      }
    };

    img.onerror = () => {
      console.warn('Hand sheet image failed to load, falling back to procedural silhouette');
      tiles = {
        tileLA: createFallbackTile(true, true),
        tileRA: createFallbackTile(false, true),
        tileLB: createFallbackTile(true, false),
        tileRB: createFallbackTile(false, false),
      };
    };

    function drawHandToField(
      fCtx: CanvasRenderingContext2D,
      tile: HTMLCanvasElement,
      params: HandParams
    ) {
      fCtx.save();
      fCtx.scale(cols / W, rows / H);
      fCtx.translate(params.pivotX, params.pivotY);
      fCtx.rotate(params.rot);
      fCtx.scale(params.scale, params.scale);
      fCtx.translate(-params.pivotX, -params.pivotY);
      fCtx.drawImage(tile, params.x, params.y, params.hw, params.hh);
      fCtx.restore();
    }

    function render(timeSec: number) {
      if (!ctx || !ctxA || !ctxB || cols <= 0 || rows <= 0) return;

      const t = ((timeSec % LOOP) + LOOP) % LOOP;
      const isPortrait = H > W;

      // Clear main canvas with high-DPI transform
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);

      if (!tiles) return;

      // 1. Fill fields with pure white
      ctxA.fillStyle = '#ffffff';
      ctxA.fillRect(0, 0, cols, rows);

      ctxB.fillStyle = '#ffffff';
      ctxB.fillRect(0, 0, cols, rows);

      // 2. Compute hand motion
      const leftParams = computeHandMotion(t, true, W, H, isPortrait);
      const rightParams = computeHandMotion(t, false, W, H, isPortrait);

      // 3. Draw pose A tiles to fA and pose B tiles to fB
      drawHandToField(ctxA, tiles.tileLA, leftParams);
      drawHandToField(ctxA, tiles.tileRA, rightParams);

      drawHandToField(ctxB, tiles.tileLB, leftParams);
      drawHandToField(ctxB, tiles.tileRB, rightParams);

      // 4. Sample luminance
      const dataA = ctxA.getImageData(0, 0, cols, rows).data;
      const dataB = ctxB.getImageData(0, 0, cols, rows).data;

      // 5. Pose switches timing
      const mL = mixAt(t, 6.2, 14.6, 1.6);
      const mR = mixAt(t, 2.4, 10.4, 1.6);
      const halfCols = Math.floor(cols / 2);

      // Row glitch
      const tick = Math.floor(t * 7);
      for (let j = 0; j < rows; j++) {
        rowShifts[j] = computeRowShift(j, tick);
      }

      // Draw all dots in dark ink `#0d0d0d`
      ctx.fillStyle = '#0d0d0d';
      ctx.beginPath();

      const quietCenterY = isPortrait ? 0.33 : 0.385;
      const quietWidthScale = isPortrait ? 0.44 : 0.2;

      for (let j = 0; j < rows; j++) {
        const shift = rowShifts[j];
        const dotY = (j + 0.5) * rowStep;
        const ey = (dotY / H - quietCenterY) / 0.085;
        const ey2 = ey * ey;

        for (let i = 0; i < cols; i++) {
          const sampleI = clamp(i - shift, 0, cols - 1);
          const pixelIdx = (j * cols + sampleI) * 4;
          const seed = seedGrid[j * cols + i];

          const isLeftHalf = i < halfCols;
          const m = isLeftHalf ? mL : mR;
          const useB = seed < m;

          const red = useB ? dataB[pixelIdx] : dataA[pixelIdx];
          const lum = red / 255;

          let v = clamp((1 - lum - 0.16) / 0.42, 0, 1);
          if (v <= 0) continue;

          // Glitch front during switch
          if (m > 0.001 && m < 0.999) {
            const diff = Math.abs(seed - m);
            if (diff < 0.12) {
              v *= diff / 0.12;
              if (hash(i + tick, j) <= 0.4) {
                v *= 0.3;
              }
            }
          }

          // Shimmer
          v *= 0.86 + 0.14 * Math.sin(t * 3.2 + seed * 40);

          // Centre fade
          const cx = Math.abs((i + 0.5) / cols - 0.5);
          v *= smooth(0.035, 0.11, cx);

          // Copy quiet zone
          const ex = cx / quietWidthScale;
          const distQuiet = Math.sqrt(ex * ex + ey2);
          v *= smooth(0.85, 1.25, distQuiet);

          // Quantise level
          const level = getQuantizedLevel(v);
          if (level <= 0) continue;

          const radius = getDotRadius(level, R);
          if (radius <= 0) continue;

          const dotX = (i + 0.5) * step;

          ctx.moveTo(dotX + radius, dotY);
          ctx.arc(dotX, dotY, radius, 0, 6.2831853);
        }
      }

      ctx.fill();
    }

    // Expose window.__render for deterministic tests & recorders
    (window as unknown as { __render: (t: number) => void }).__render = render;

    function frameLoop(now: number) {
      if (!isMounted) return;
      const elapsed = (now - t0) / 1000;
      render(elapsed);
      animId = requestAnimationFrame(frameLoop);
    }

    animId = requestAnimationFrame(frameLoop);

    return () => {
      isMounted = false;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas id="dots" ref={canvasRef} data-testid="dot-matrix-canvas" />;
};
