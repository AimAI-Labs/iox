import type { ReactNode } from 'react';
import type { WebMenuActionId } from '@/types/config';

export interface WebMenuOperation {
  id: WebMenuActionId;
  label: string;
  icon: ReactNode;
  run: () => void;
  disabled?: boolean;
  danger?: boolean;
}

/** Both list and wheel retain the held-pointer gesture required by native window dragging. */
export function WebMenuAction({ operation, radial = false, beforeRun }: {
  operation: WebMenuOperation; radial?: boolean; beforeRun?: () => void;
}) {
  const run = () => { beforeRun?.(); operation.run(); };
  return <button type="button" className={radial ? 'web-wheel-action' : 'web-menu-action'}
    role={radial ? 'menuitem' : undefined} aria-label={operation.label} title={radial ? operation.label : undefined}
    disabled={operation.disabled} data-danger={operation.danger || undefined}
    onPointerDown={(event) => {
      if (operation.id === 'moveWindow' && event.button === 0) run();
    }} onClick={(event) => {
      if (operation.id !== 'moveWindow' || event.detail === 0) run();
    }} onKeyDown={(event) => {
      if (operation.id === 'moveWindow' && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        run();
      }
    }}>
    {operation.icon}{!radial && <span>{operation.label}</span>}
  </button>;
}
