import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileText, LoaderCircle, Settings, X } from 'lucide-react';
import { ActionConfig } from '@/types/config';
import { DynamicIcon } from '@/components/Icons';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

interface FileSelectionMenuProps {
  files: string[];
  actions: ActionConfig[];
  isClosing: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

export function FileSelectionMenu({ files, actions, isClosing, onClose, onOpenSettings }: FileSelectionMenuProps) {
  const { resolvedLanguage } = useTranslation();
  const isZh = resolvedLanguage === 'zh';
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      await invoke('trigger_web_file_action', { actionId: action.id, files });
      if (activeRef.current) onClose();
    } catch (reason) {
      if (activeRef.current) setError(String(reason));
    } finally {
      busyRef.current = false;
      if (activeRef.current) setPendingId(null);
    }
  }

  return (
    <div className={cn(
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
        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto pb-1">
          {webActions.map((action) => (
            <button type="button" key={action.id} disabled={pendingId !== null} onClick={() => void sendFiles(action)}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-2.5 text-xs transition-colors hover:border-primary/40 hover:bg-accent disabled:opacity-50"
              title={isZh ? `发送文件到 ${action.name}` : `Send files to ${action.name}`}>
              {pendingId === action.id ? <LoaderCircle size={14} className="animate-spin" /> : <DynamicIcon name={action.icon} size={14} />}
              {action.name}
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
          : (isZh ? '选择 AI 官网添加附件，再到官网输入问题并发送' : 'Choose an AI website, then write your question and send there'))}
      </p>
    </div>
  );
}
