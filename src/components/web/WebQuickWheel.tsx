import type { CSSProperties } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { getWebWheelPositions } from '@/lib/webWheel';
import type { WebMenuLayout } from '@/lib/webChromeClient';
import { WebMenuAction, type WebMenuOperation } from './WebMenuAction';

export function WebQuickWheel({ layout, operations, dismiss }: {
  layout: WebMenuLayout; operations: WebMenuOperation[]; dismiss: () => void;
}) {
  const { t } = useTranslation();
  const points = getWebWheelPositions(operations.length, layout.width, layout.height, layout.buttonX, layout.buttonY);
  const spacing = Math.min(44, ...points.flatMap((point, index) => points.slice(index + 1)
    .map((other) => Math.hypot(point.x - other.x, point.y - other.y))));
  const style = { '--web-wheel-action-size': `${Math.max(24, spacing - 4)}px` } as CSSProperties;
  return <section className="web-quick-wheel" role="menu" aria-label={t('settings.web.menu.quickActions')} style={style}>
    {operations.map((operation, index) => <div className="web-wheel-slot" key={operation.id}
      style={{ left: points[index].x, top: points[index].y }}>
      <WebMenuAction operation={operation} radial beforeRun={dismiss} />
    </div>)}
  </section>;
}
