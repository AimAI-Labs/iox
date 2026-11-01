import test from "node:test";
import assert from "node:assert/strict";
import {
  getQuantizedLevel,
  createDotGridBuffers,
  stepDotGridPhysics,
  DEFAULT_DOT_GRID_CONFIG,
} from "../src/utils/matrix-math.ts";

// Quick verification of pure halftone math invariants
test("dot-matrix quantization & clamping invariants", () => {
  assert.equal(getQuantizedLevel(0.05), 0);
  assert.equal(getQuantizedLevel(0.2), 0.26);
  assert.equal(getQuantizedLevel(0.5), 0.52);
  assert.equal(getQuantizedLevel(0.95), 1);
});

test("DotGrid cursor proximity pushes nearby dots outward and raises activity", () => {
  const cols = 20;
  const rows = 20;
  const stepX = 10;
  const stepY = 10;
  const buffers = createDotGridBuffers(cols, rows);

  // Place active cursor at (55, 55) moving right
  const pointer = {
    x: 55,
    y: 55,
    vx: 400,
    vy: 0,
    active: true,
  };

  stepDotGridPhysics(
    buffers,
    stepX,
    stepY,
    pointer,
    [],
    1.0,
    0.016,
    DEFAULT_DOT_GRID_CONFIG
  );

  // Cell (6, 5) is at (65, 55) — just to the right of the cursor
  const nearIdx = 5 * cols + 6;
  // Cell (19, 19) is at (195, 195) — outside proximity (145px)
  const farIdx = 19 * cols + 19;

  assert.ok(buffers.ox[nearIdx] > 0, "dot to the right of cursor should be pushed +x");
  assert.ok(buffers.activity[nearIdx] > 0.5, "dot near cursor should become active");
  assert.equal(buffers.ox[farIdx], 0, "dot outside proximity should stay at rest");
  assert.equal(buffers.activity[farIdx], 0);
});

test("DotGrid click shockwave propagates outward and spring returns dots toward rest", () => {
  const cols = 30;
  const rows = 30;
  const stepX = 10;
  const stepY = 10;
  const buffers = createDotGridBuffers(cols, rows);

  const inactivePointer = { x: 0, y: 0, vx: 0, vy: 0, active: false };
  const shockwaves = [{ x: 150, y: 150, startTime: 0 }];

  // Step at t = 0.15s so shockwave ring expands outward from (150, 150)
  stepDotGridPhysics(
    buffers,
    stepX,
    stepY,
    inactivePointer,
    shockwaves,
    0.15,
    0.016,
    DEFAULT_DOT_GRID_CONFIG
  );

  let energizedCount = 0;
  for (let i = 0; i < buffers.activity.length; i++) {
    if (buffers.activity[i] > 0.05) energizedCount++;
  }
  assert.ok(energizedCount > 0, "shockwave ring should energize dots along its radius");

  // Simulate 120 frames with no active pointer or shockwaves; spring should settle dots back
  for (let f = 0; f < 120; f++) {
    stepDotGridPhysics(
      buffers,
      stepX,
      stepY,
      inactivePointer,
      [],
      1.0 + f * 0.016,
      0.016,
      DEFAULT_DOT_GRID_CONFIG
    );
  }

  let maxResidualOffset = 0;
  for (let i = 0; i < buffers.ox.length; i++) {
    maxResidualOffset = Math.max(
      maxResidualOffset,
      Math.hypot(buffers.ox[i], buffers.oy[i])
    );
  }
  assert.ok(
    maxResidualOffset < 0.25,
    `spring-damper should settle dots back near rest (residual=${maxResidualOffset})`
  );
});

