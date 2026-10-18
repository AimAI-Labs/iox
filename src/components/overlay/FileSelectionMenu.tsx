import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { FileText, LoaderCircle, Settings, X } from 'lucide-react';
import { ActionConfig } from '@/types/config';
import { DynamicIcon } from '@/components/Icons';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { fileDragScrollDirection, findFileDropTarget } from '@/lib/file-drop';

interface FileSelectionMenuProps {
  files: string[];
  dragId: number;
  actions: ActionConfig[];
  isClosing: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

interface FileDragEvent {
  dragId: number;
  x: number;
  y: number;
  scaleFactor: number;
}

export function FileSelectionMenu({ files, dragId, actions, isClosing, onClose, onOpenSettings }: FileSelectionMenuProps) {
  const { resolvedLanguage } = useTranslation();
  const isZh = resolvedLanguage === 'zh';
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hasDropped, setHasDropped] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const droppedRef = useRef(false);
  const activeRef = useRef(true);
  const busyRef = useRef(false);
  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);

  const webActions = actions.filter((action) => action.enabled && action.actionType === 'web');
  const firstName = files[0]?.split(/[\\/]/).pop() || '';
  const title = files.length === 1 ? firstName : (isZh ? `${files.length} 个文件 · ${firstName}` : `${files.length} files · ${firstName}`);

  async function sendFiles(action: ActionConfig): Promise<void> {
    if (busyRef.current) return;
    busyRef.current = true;
    setPendingId(action.id);
    setError(null);
    try {
      await invoke('trigger_web_file_action', { actionId: action.id, files, dragId });
      if (activeRef.current) onClose();
    } catch (reason) {
      if (activeRef.current) setError(String(reason));
    } finally {
      busyRef.current = false;
      if (activeRef.current) setPendingId(null);
    }
  }

  const handlersRef = useRef({ webActions, sendFiles, onClose });
  handlersRef.current = { webActions, sendFiles, onClose };

  useEffect(() => {
    let disposed = false;
    let hover: FileDragEvent | null = null;
    let frame: number | null = null;
    function stopScrolling(): void {
      hover = null;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    }
    function targetAt(payload: FileDragEvent): string | null {
      const { x, y, scaleFactor } = payload;
      const hit = document.elementFromPoint(x / scaleFactor, y / scaleFactor)
        ?.closest<HTMLButtonElement>('button[data-file-action-id]');
      if (!hit || !rootRef.current?.contains(hit)) return null;
      return findFileDropTarget(payload, scaleFactor, [{
        ...hit.getBoundingClientRect().toJSON(),
        id: hit.dataset.fileActionId!,
        disabled: hit.disabled,
      }]);
    }
    function scrollTargets(): void {
      frame = null;
      const row = actionsRef.current;
      if (!row || !hover || disposed) return;
      const direction = fileDragScrollDirection(hover, hover.scaleFactor, row.getBoundingClientRect());
      const before = row.scrollLeft;
      row.scrollLeft += direction * 4;
      setHoveredId(targetAt(hover));
      if (direction && row.scrollLeft !== before) frame = requestAnimationFrame(scrollTargets);
    }
    const listeners = [
      listen<FileDragEvent>('file-drag-over', ({ payload }) => {
        if (disposed || payload.dragId !== dragId || droppedRef.current) return;
        hover = payload;
        setHoveredId(targetAt(payload));
        if (frame === null) frame = requestAnimationFrame(scrollTargets);
      }),
      listen<FileDragEvent>('file-drag-drop', ({ payload }) => {
        if (disposed || payload.dragId !== dragId || droppedRef.current) return;
        droppedRef.current = true;
        stopScrolling();
        setHasDropped(true);
        setHoveredId(null);
        const id = targetAt(payload);
        const action = handlersRef.current.webActions.find((candidate) => candidate.id === id);
        if (action) void handlersRef.current.sendFiles(action);
        else handlersRef.current.onClose();
      }),
      listen<number>('file-drag-leave', ({ payload }) => {
        if (!disposed && payload === dragId) {
          stopScrolling();
          setHoveredId(null);
        }
      }),
      listen<number>('file-drag-cancelled', ({ payload }) => {
        if (!disposed && payload === dragId) {
          stopScrolling();
          handlersRef.current.onClose();
        }
      }),
    ];
    return () => {
      disposed = true;
      stopScrolling();
      listeners.forEach((listener) => { void listener.then((unlisten) => unlisten()); });
    };
  }, [dragId]);

  return (
    <div ref={rootRef} className={cn(
      'capsule-glass flex h-full w-full flex-col gap-2 rounded-xl border border-border/70 p-3 text-foreground',
      isClosing ? 'animate-capsule-out' : 'animate-capsule-in',
    )}>
      <div className="flex min-w-0 items-center gap-2">
        <FileText size={15} className="shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium" title={files.join('\n')}>{title}</span>
        <button type="button" className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" onClick={onOpenSettings} aria-label={isZh ? '设置官网动作' : 'Configure website actions'}>
          <Settings size={13} />
        </button>
        <button type="button" className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" onClick={onClose} aria-label={isZh ? '关闭' : 'Close'}>
          <X size={14} />
        </button>
      </div>
      {webActions.length ? (
        <div ref={actionsRef} data-file-actions className="flex shrink-0 items-center gap-1.5 overflow-x-auto pb-1">
          {webActions.map((action) => (
            <button type="button" key={action.id} data-file-action-id={action.id}
              data-drag-hovered={hoveredId === action.id || undefined}
              disabled={pendingId !== null}
              onClick={() => { if (hasDropped) void sendFiles(action); }}
              className={cn('inline-flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/60 p-2 text-xs transition-colors hover:border-primary/40 hover:bg-accent disabled:opacity-50',
                hoveredId === action.id && 'border-primary bg-primary/15 ring-1 ring-primary/50')}
              title={isZh ? `拖入文件到 ${action.name}` : `Drop files onto ${action.name}`}>
              {pendingId === action.id ? <LoaderCircle size={28} className="shrink-0 animate-spin" /> : <DynamicIcon name={action.icon} size={28} />}
              <span className="w-full truncate text-center">{action.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <button type="button" onClick={onOpenSettings} className="h-8 shrink-0 text-left text-xs text-primary hover:underline">
          {isZh ? '尚未启用官网动作，点击添加' : 'Add an AI website action to get started'}
        </button>
      )}
      <p role={error ? 'alert' : 'status'} className={cn('line-clamp-2 text-[10px] leading-4', error ? 'text-destructive' : 'text-muted-foreground')} title={error || undefined}>
        {error || (pendingId
          ? (isZh ? '正在打开官网并准备附件…' : 'Opening website and preparing attachments…')
          : (isZh ? '拖到 AI 上松手添加附件 · 两侧悬停查看更多 AI' : 'Drop onto an AI to attach files · Hover at either edge for more'))}
      </p>
    </div>
  );
}
