import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { createWebChromeClient, type WebChromeLayout, type WebMenuChange } from '@/lib/webChromeClient';

export function useWebChrome() {
  const [layout, setLayout] = useState<WebChromeLayout | null>(null);
  const [failed, setFailed] = useState(false);
  const clientRef = useRef<ReturnType<typeof createWebChromeClient> | null>(null);

  useEffect(() => {
    const client = createWebChromeClient({
      invoke: (command, args) => invoke(command, args && { ...args }),
      listen: (handler) => listen<WebChromeLayout>('web_chrome_layout_changed', (event) => handler(event.payload)),
    }, (next) => {
      setLayout(next);
      setFailed(false);
    }, () => setFailed(true));
    clientRef.current = client;
    return () => {
      clientRef.current = null;
      client.dispose();
    };
  }, []);

  const update = useCallback((changes: WebMenuChange) =>
    clientRef.current?.update(changes) ?? Promise.resolve(false), []);

  return { layout, update, failed };
}
