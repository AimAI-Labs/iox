import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

test('wheel positions keep up to eight actions inside the panel and clear of the original trigger', async () => {
  const path = new URL('../src/lib/webWheel.ts', import.meta.url);
  assert.ok(existsSync(path), 'Wheel geometry helper is required');
  const js = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const { getWebWheelPositions } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
  for (const [width, height] of [[280, 280], [216, 196]]) {
    for (const [buttonX, buttonY] of [[0, 0], [width - 44, 0], [0, height - 44], [width - 44, height - 44], [width / 2 - 22, height / 2 - 22], [width / 2 - 22, 0]]) {
      for (const count of [0, 1, 4, 8]) {
        const points = getWebWheelPositions(count, width, height, buttonX, buttonY);
        assert.equal(points.length, count);
        const radii = points.map((point) => Math.hypot(point.x - buttonX - 22, point.y - buttonY - 22));
        if (radii.length) assert.ok(Math.max(...radii) - Math.min(...radii) < 0.01, 'Actions must orbit the floating button');
        for (let i = 0; i < points.length; i++) {
          const p = points[i];
          assert.ok(p.x >= 20 && p.x <= width - 20 && p.y >= 20 && p.y <= height - 20, JSON.stringify(p));
          assert.ok(Math.hypot(p.x - buttonX - 22, p.y - buttonY - 22) >= 44, 'Action overlaps preserved trigger');
          for (const q of points.slice(i + 1)) assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= (width === 280 ? 40 : 32), 'Actions overlap');
        }
      }
    }
  }
});
