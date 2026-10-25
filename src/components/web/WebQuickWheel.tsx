import type { CSSProperties } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { getWebWheelPositions } from '@/lib/webWheel';
import type { WebMenuLayout } from '@/lib/webChromeClient';
import { WebMenuAction, type WebMenuOperation } from './WebMenuAction';

export function WebQuickWheel({ layout, operations, dismiss, closing }: {
  layout: WebMenuLayout; operations: WebMenuOperation[]; dismiss: () => void; closing: boolean;
}) {
  const { t } = useTranslation();
  const points = getWebWheelPositions(operations.length, layout.width, layout.height, layout.buttonX, layout.buttonY);
  const spacing = Math.min(44, ...points.flatMap((point, index) => points.slice(index + 1)
    .map((other) => Math.hypot(point.x - other.x, point.y - other.y))));
  const style = { '--web-wheel-action-size': `${Math.max(24, spacing - 4)}px` } as CSSProperties;
  return <section className="web-quick-wheel" role="menu" aria-label={t('settings.web.menu.quickActions')}
    data-closing={closing} inert={closing} style={style}>
    {operations.map((operation, index) => {
      const point = points[index];
      const dx = layout.buttonX + 22 - point.x;
      const dy = layout.buttonY + 22 - point.y;
      const travel = Math.min(1, 12 / Math.hypot(dx, dy));
      const motion = {
        left: point.x, top: point.y,
        '--web-action-enter-x': `${dx * travel}px`, '--web-action-enter-y': `${dy * travel}px`,
        '--web-action-delay': `${Math.min(index, 6) * 6}ms`,
      } as CSSProperties;
      return <div className="web-wheel-slot" key={operation.id} style={motion}>
        <WebMenuAction operation={operation} radial beforeRun={dismiss} />
      </div>;
    })}
  </section>;
}
