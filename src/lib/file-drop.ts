export interface FileMenuLayout {
  width: number;
  height: number;
  buttons: { x: number; y: number; rotation: number }[];
}

export interface FileDropTarget {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  disabled: boolean;
}

export function findFileDropTarget(
  point: { x: number; y: number },
  scaleFactor: number,
  targets: FileDropTarget[],
): string | null {
  if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) return null;
  const x = point.x / scaleFactor;
  const y = point.y / scaleFactor;
  return targets.find((target) => !target.disabled
    && x >= target.left && x < target.right
    && y >= target.top && y < target.bottom)?.id ?? null;
}
