export interface WebMenuLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  expanded: boolean;
  wheel: boolean;
  buttonX: number;
  buttonY: number;
}

export interface WebChromeLayout {
  revision: number;
  headless: boolean;
  menu: WebMenuLayout;
}

export interface WebMenuChange {
  expanded?: boolean;
  position?: [number, number];
  wheel?: boolean;
}

interface ChromeTransport {
  listen: (handler: (layout: WebChromeLayout) => void) => Promise<() => void>;
  invoke: <T>(command: string, args?: WebMenuChange) => Promise<T>;
}

/** Native layout is authoritative. Subscribe before reading and reject stale IPC/event replies. */
export function createWebChromeClient(
  transport: ChromeTransport,
  onLayout: (layout: WebChromeLayout) => void,
  onError: (error: unknown) => void,
) {
  let disposed = false;
  let revision = -1;
  let unlisten: (() => void) | undefined;
  let pending: WebMenuChange | null = null;
  let waiters: ((success: boolean) => void)[] = [];
  let running = false;

  const accept = (layout: WebChromeLayout) => {
    if (!disposed && layout.revision > revision) {
      revision = layout.revision;
      onLayout(layout);
    }
  };

  const ready = transport.listen(accept).then(async (cleanup) => {
    if (disposed) {
      cleanup();
      return;
    }
    unlisten = cleanup;
    accept(await transport.invoke<WebChromeLayout>('get_web_chrome'));
  }).catch((error: unknown) => {
    if (!disposed) onError(error);
  });

  async function flush() {
    if (running) return;
    running = true;
    await ready;
    while (!disposed && pending) {
      const changes = pending;
      const batch = waiters;
      pending = null;
      waiters = [];
      let success = false;
      try {
        accept(await transport.invoke<WebChromeLayout>('layout_web_menu', changes));
        success = !disposed;
      } catch (error) {
        if (!disposed) onError(error);
      }
      batch.forEach((resolve) => resolve(success));
    }
    running = false;
  }

  return {
    ready,
    update(changes: WebMenuChange): Promise<boolean> {
      if (disposed) return Promise.resolve(false);
      const presentation = { ...changes };
      if (presentation.wheel === true) presentation.expanded = false;
      else if (presentation.expanded !== undefined) presentation.wheel ??= false;
      pending = { ...pending, ...presentation };
      const result = new Promise<boolean>((resolve) => waiters.push(resolve));
      void flush();
      return result;
    },
    dispose() {
      disposed = true;
      unlisten?.();
      pending = null;
      waiters.forEach((resolve) => resolve(false));
      waiters = [];
    },
  };
}
