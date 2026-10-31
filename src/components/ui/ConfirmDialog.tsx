import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** 破坏性操作使用警示配色，确认按钮不会成为默认焦点 */
  destructive?: boolean;
  /** 提交中禁止重复点击 */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 窗口内二次确认弹窗：与设置页现有确认弹窗保持同一视觉与交互。 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}) => {
  const titleId = React.useId();
  const descriptionId = React.useId();

  // 捕获阶段拦截 Esc：避免关闭弹窗的同时触发窗口级 Esc 处理
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      if (!busy) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="w-full max-w-sm space-y-4 rounded-xl border border-border/80 bg-card/95 p-5 shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-destructive/25 bg-destructive/10 text-destructive">
            <AlertTriangle size={15} />
          </div>
          <div className="min-w-0">
            <h3 id={titleId} className="text-sm font-semibold text-foreground">{title}</h3>
            {description && (
              <p id={descriptionId} className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          {/* 破坏性操作默认聚焦取消，避免误按回车直接清空 */}
          <Button variant="outline" size="sm" onClick={onCancel} disabled={busy} autoFocus>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            size="sm"
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
