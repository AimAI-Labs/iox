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

export function fileDragScrollDirection(
  point: { x: number; y: number },
  scaleFactor: number,
  bounds: Pick<FileDropTarget, 'left' | 'right' | 'top' | 'bottom'>,
): -1 | 0 | 1 {
  if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) return 0;
  const x = point.x / scaleFactor;
  const y = point.y / scaleFactor;
  if (y < bounds.top || y >= bounds.bottom || x < bounds.left || x >= bounds.right) return 0;
  if (x < bounds.left + 24) return -1;
  if (x >= bounds.right - 24) return 1;
  return 0;
}
