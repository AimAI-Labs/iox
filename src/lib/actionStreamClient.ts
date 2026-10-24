import type { ReasoningEffort } from '@/lib/reasoning';

export interface ActionStreamRequest {
  actionId: string;
  text: string;
  modelOverride?: string;
  promptOverride?: string | null;
  thinkingEnabled?: boolean;
  reasoningEffort?: ReasoningEffort;
}

interface StreamPayload {
  actionId: string;
  requestId: string;
  token?: string;
  canceled?: boolean;
  error?: string;
}

interface StreamClientOptions {
  invoke: (command: string, args: Record<string, unknown>) => Promise<unknown>;
  listen: (name: string, handler: (event: { payload: StreamPayload }) => void) => Promise<() => void>;
  createRequestId: () => string;
  onToken: (token: string) => void;
  onDone: (canceled: boolean) => void;
  onError: (error: string) => void;
}

interface Execution {
  actionId: string;
  requestId: string;
  submitted: boolean;
  accepted: boolean;
  canceled: boolean;
  terminal: boolean;
  settled: Promise<void>;
  settle: () => void;
  cancellation?: Promise<void>;
}

/** Owns the view's execution identity; transport and React state stay at its seam. */
export function createActionStreamClient(options: StreamClientOptions) {
  let current: Execution | null = null;
  let disposed = false;
  let connection: Promise<void> | undefined;
  const unlisteners = new Set<() => void>();
  const starts = new Map<string, Promise<void>>();

  const owns = (execution: Execution) => !disposed && current === execution && !execution.terminal;

  function finish(execution: Execution, error?: string, canceled = false) {
    if (!owns(execution)) return;
    execution.terminal = true;
    current = null;
    if (error !== undefined) options.onError(error);
    else options.onDone(canceled);
  }

  function receive(kind: 'token' | 'done' | 'error', payload: StreamPayload) {
    const execution = current;
    if (!execution || !owns(execution) || !execution.submitted ||
        payload?.actionId !== execution.actionId || payload.requestId !== execution.requestId) return;
    if (kind === 'token' && typeof payload.token === 'string') options.onToken(payload.token);
    if (kind === 'done') finish(execution, undefined, payload.canceled === true);
    if (kind === 'error' && typeof payload.error === 'string') finish(execution, payload.error);
  }

  function clearListeners() {
    unlisteners.forEach((unlisten) => unlisten());
    unlisteners.clear();
  }

  function connect(): Promise<void> {
    if (disposed) return Promise.reject(new Error('Stream client is disposed'));
    if (!connection) {
      let failed = false;
      connection = Promise.all((['token', 'done', 'error'] as const).map(async (kind) => {
        const unlisten = await options.listen(`action-stream-${kind}`, (event) => receive(kind, event.payload));
        if (disposed || failed) unlisten();
        else unlisteners.add(unlisten);
      })).then(() => undefined).catch((error: unknown) => {
        failed = true;
        clearListeners();
        throw error;
      });
    }
    return connection;
  }

  function cancelExecution(execution: Execution): Promise<void> {
    if (execution.cancellation) return execution.cancellation;
    execution.canceled = true;
    if (!execution.submitted) {
      finish(execution, undefined, true);
      return Promise.resolve();
    }
    execution.cancellation = (async () => {
      await execution.settled;
      if (!execution.accepted || execution.terminal) return;
      try {
        await options.invoke('cancel_action', {
          actionId: execution.actionId,
          requestId: execution.requestId,
        });
      } catch (error) {
        // A detached execution cannot report into a newer view.
        finish(execution, String(error));
      }
    })();
    return execution.cancellation;
  }

  async function start(args: ActionStreamRequest, prepare?: () => Promise<void>): Promise<void> {
    if (disposed) return;
    const previous = current;
    let settle!: () => void;
    const execution: Execution = {
      actionId: args.actionId,
      requestId: options.createRequestId(),
      submitted: false,
      accepted: false,
      canceled: false,
      terminal: false,
      settled: new Promise<void>((resolve) => { settle = resolve; }),
      settle: () => settle(),
    };
    current = execution;
    if (previous?.actionId === args.actionId) void cancelExecution(previous);

    try {
      await connect();
      if (!owns(execution) || execution.canceled) return;
      // Preparation does not block newer requests from reaching the acceptance queue.
      await prepare?.();
      if (!owns(execution) || execution.canceled) return;

      const preceding = starts.get(args.actionId) ?? Promise.resolve();
      const starting = preceding.then(async () => {
        if (!owns(execution) || execution.canceled) return;
        execution.submitted = true;
        try {
          await options.invoke('trigger_api_action', { ...args, requestId: execution.requestId });
          execution.accepted = true;
        } finally {
          execution.settle();
        }
      });
      // Failed acceptance must not poison the next start for this action.
      const tail = starting.catch(() => undefined);
      starts.set(args.actionId, tail);
      try {
        await starting;
      } finally {
        if (starts.get(args.actionId) === tail) starts.delete(args.actionId);
      }
    } catch (error) {
      finish(execution, String(error));
    } finally {
      execution.settle();
    }
  }

  function detach(cancel = true): Promise<void> {
    const execution = current;
    current = null;
    return execution && cancel ? cancelExecution(execution) : Promise.resolve();
  }

  function dispose() {
    void detach();
    disposed = true;
    clearListeners();
  }

  return {
    connect,
    start,
    cancel: () => current ? cancelExecution(current) : Promise.resolve(),
    detach,
    dispose,
    get activeActionId() { return current?.actionId; },
  };
}

export type ActionStreamClient = ReturnType<typeof createActionStreamClient>;
