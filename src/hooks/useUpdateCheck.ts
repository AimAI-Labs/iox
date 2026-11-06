import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getVersion } from '@tauri-apps/api/app';

export type UpdateState = 'available' | 'current' | 'unknown' | 'unavailable';

export interface UpdateStatus {
  state: UpdateState;
  currentVersion: string;
  latestVersion: string | null;
  releaseUrl: string | null;
  publishedAt: string | null;
  checkedAt: number;
}

/** 事件与缓存读取可能乱序到达，只接受检查时间更新的状态。 */
function mergeStatus(previous: UpdateStatus | null, next: UpdateStatus): UpdateStatus {
  return !previous || next.checkedAt >= previous.checkedAt ? next : previous;
}

/**
 * 更新状态读取后端缓存；自动检查由 Rust 后台任务发起，设置页打开时不再重复请求。
 * 检查失败返回 `unavailable`，界面据此展示降级提示而不是错误弹窗。
 */
export function useUpdateCheck() {
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    listen<UpdateStatus>('update_status', (event) => {
      if (!disposed) setStatus((previous) => mergeStatus(previous, event.payload));
    })
      .then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      })
      .catch(() => {});

    invoke<UpdateStatus | null>('get_update_status')
      .then((cached) => {
        if (!disposed && cached) setStatus((previous) => mergeStatus(previous, cached));
      })
      .catch(() => {});

    getVersion()
      .then((value) => {
        if (!disposed) setVersion(value);
      })
      .catch(() => {});

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const check = useCallback(async () => {
    if (checkingRef.current) return null;
    checkingRef.current = true;
    setChecking(true);
    try {
      const result = await invoke<UpdateStatus>('check_for_updates');
      setStatus((previous) => mergeStatus(previous, result));
      return result;
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }, []);

  return { version, status, checking, check };
}
