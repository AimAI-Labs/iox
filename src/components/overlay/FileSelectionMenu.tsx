import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { LoaderCircle } from 'lucide-react';
import { ActionConfig } from '@/types/config';
import { DynamicIcon } from '@/components/Icons';
import { cn } from '@/lib/utils';
import { findFileDropTarget, type FileMenuLayout } from '@/lib/file-drop';

interface FileSelectionMenuProps {
  files: string[];
  dragId: number;
  layout: FileMenuLayout;
  actions: ActionConfig[];
  isClosing: boolean;
  onClose: () => void;
}

interface FileDragEvent {
  dragId: number;
  x: number;
  y: number;
  scaleFactor: number;
}

export function FileSelectionMenu({ files, dragId, layout, actions, isClosing, onClose }: FileSelectionMenuProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<{ actionId: string; message: string } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hasDropped, setHasDropped] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const droppedRef = useRef(false);
  const activeRef = useRef(true);
  const busyRef = useRef(false);
  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);

  const webActions = actions.filter((action) => action.enabled && action.actionType === 'web');
  const activeId = pendingId ?? hoveredId;
  const stackedActions = webActions.map((action, index) => ({ action, index }))
    .sort((a, b) => Number(a.action.id === activeId) - Number(b.action.id === activeId));

  async function sendFiles(action: ActionConfig): Promise<void> {
    if (busyRef.current) return;
    busyRef.current = true;
    setPendingId(action.id);
    setError(null);
    try {
      await invoke('trigger_web_file_action', { actionId: action.id, files, dragId });
      if (activeRef.current) onClose();
    } catch (reason) {
      if (activeRef.current) setError({ actionId: action.id, message: String(reason) });
    } finally {
      busyRef.current = false;
      if (activeRef.current) setPendingId(null);
    }
  }

  const handlersRef = useRef({ webActions, sendFiles, onClose });
  handlersRef.current = { webActions, sendFiles, onClose };

  useEffect(() => {
    let disposed = false;
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
    const listeners = [
      listen<FileDragEvent>('file-drag-over', ({ payload }) => {
        if (disposed || payload.dragId !== dragId || droppedRef.current) return;
        setHoveredId(targetAt(payload));
      }),
      listen<FileDragEvent>('file-drag-drop', ({ payload }) => {
        if (disposed || payload.dragId !== dragId || droppedRef.current) return;
        droppedRef.current = true;
        setHasDropped(true);
        setHoveredId(null);
        const id = targetAt(payload);
        const action = handlersRef.current.webActions.find((candidate) => candidate.id === id);
        if (action) void handlersRef.current.sendFiles(action);
        else handlersRef.current.onClose();
      }),
      listen<number>('file-drag-leave', ({ payload }) => {
        if (!disposed && payload === dragId) {
          setHoveredId(null);
        }
      }),
      listen<number>('file-drag-cancelled', ({ payload }) => {
        if (!disposed && payload === dragId) {
          handlersRef.current.onClose();
        }
      }),
    ];
    return () => {
      disposed = true;
      listeners.forEach((listener) => { void listener.then((unlisten) => unlisten()); });
    };
  }, [dragId]);

  if (!webActions.length) return null;

  return (
    <div ref={rootRef} className={cn(
      'h-full w-full text-foreground',
      isClosing ? 'animate-capsule-out' : 'animate-capsule-in',
    )}>
      <svg data-file-actions className="h-full w-full" viewBox={`0 0 ${layout.width} ${layout.height}`}>
        {stackedActions.map(({ action, index }) => (
          <g key={action.id} transform={`rotate(${layout.buttons[index].rotation} ${layout.buttons[index].x + 40} ${layout.buttons[index].y + 40})`}>
            <foreignObject x={layout.buttons[index].x} y={layout.buttons[index].y} width={80} height={80} overflow="visible">
              <button type="button" data-file-action-id={action.id}
                data-drag-hovered={hoveredId === action.id || undefined}
                disabled={pendingId !== null}
                onClick={() => { if (hasDropped) void sendFiles(action); }}
                onMouseEnter={() => setHoveredId(action.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="relative inline-block h-20 w-20 rounded-xl text-[11px] disabled:opacity-50"
                title={error?.actionId === action.id ? error.message : action.name}>
                <span className={cn('file-ai-card-surface pointer-events-none flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl border border-border/80 bg-background p-2',
                  hoveredId === action.id && 'border-primary bg-accent ring-1 ring-primary/50',
                  error?.actionId === action.id && 'border-destructive')}>
                  {pendingId === action.id ? <LoaderCircle size={28} className="shrink-0 animate-spin" /> : <DynamicIcon name={action.icon} size={28} />}
                  <span className="w-full truncate text-center">{action.name}</span>
                </span>
              </button>
            </foreignObject>
          </g>
        ))}
      </svg>
      {error && <span role="alert" className="sr-only">{error.message}</span>}
    </div>
  );
}
