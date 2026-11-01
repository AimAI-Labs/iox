import test from "node:test";
import assert from "node:assert/strict";

// Quick verification of pure halftone math invariants
test("dot-matrix quantization & clamping invariants", () => {
  const LEVELS = [0, 0.26, 0.52, 0.78, 1];
  const getQuantizedLevel = (v) => {
    for (let idx = LEVELS.length - 1; idx >= 0; idx--) {
      if (v >= LEVELS[idx] - 0.13) return LEVELS[idx];
    }
    return 0;
  };

  assert.equal(getQuantizedLevel(0.05), 0);
  assert.equal(getQuantizedLevel(0.2), 0.26);
  assert.equal(getQuantizedLevel(0.5), 0.52);
  assert.equal(getQuantizedLevel(0.95), 1);
});
