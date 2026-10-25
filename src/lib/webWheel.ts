const TURN = Math.PI * 2;
const STEP = TURN / 360;

/** Find the widest continuous arc that fits inside the transparent local WebView. */
function availableArc(cx: number, cy: number, radius: number, width: number, height: number) {
  const visible = Array.from({ length: 360 }, (_, index) => {
    const angle = -Math.PI / 2 + index * STEP;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    return x >= 22 - 1e-6 && x <= width - 22 + 1e-6 && y >= 22 - 1e-6 && y <= height - 22 + 1e-6;
  });
  if (visible.every(Boolean)) return { start: -Math.PI / 2, span: TURN, full: true, empty: false };
  let run = 0;
  let longest = 0;
  let end = 0;
  for (let index = 0; index < 720; index++) {
    run = visible[index % 360] ? run + 1 : 0;
    if (run > longest) { longest = run; end = index; }
  }
  return { start: -Math.PI / 2 + (end - longest + 1) * STEP, span: Math.max(0, longest - 1) * STEP, full: false, empty: longest === 0 };
}

/** All actions orbit the original floating button; edges restrict the orbit to an inward arc. */
export function getWebWheelPositions(count: number, width: number, height: number, buttonX: number, buttonY: number) {
  count = Math.min(8, Math.max(0, Math.floor(count)));
  if (!count) return [];
  const cx = buttonX + 22;
  const cy = buttonY + 22;
  let best = Array.from({ length: count }, () => ({ x: cx, y: cy }));
  let bestSpacing = 0;
  for (let radius = 64; radius <= Math.hypot(width, height); radius += 4) {
    const arc = availableArc(cx, cy, radius, width, height);
    if (arc.empty) continue;
    const gap = arc.span / (arc.full ? count : Math.max(1, count - 1));
    const spacing = count === 1 ? Infinity : 2 * radius * Math.sin(Math.min(Math.PI, gap) / 2);
    if (spacing <= bestSpacing) continue;
    bestSpacing = spacing;
    best = Array.from({ length: count }, (_, index) => {
      const angle = arc.start + (count === 1 && !arc.full ? arc.span / 2 : gap * index);
      return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
    });
    if (spacing >= 44) break;
  }
  return best;
}
