import { useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { ActionConfig, AppConfig } from '@/types/config';
import type { OverlayMode } from '@/state/overlayReducer';
import type { GenerationPlan } from '@/types/session';
import type { ConversationWorkspace } from '@/conversation/workspace';
import { exportMarkdown } from '@/conversation/transcript';
import { formatQuoteText } from '@/lib/formatQuote';
import { getThinkingRequestOptions, type ThinkingMode } from '@/lib/reasoning';
import { createActionStreamClient, type ActionStreamClient } from '@/lib/actionStreamClient';
import { isProviderSelectable, resolveProviderModel } from '@/lib/provider';

interface UseActionStreamProps {
  config: AppConfig | null;
  workspace: ConversationWorkspace;
  selectionText: string;
  isPinned: boolean;
  onShowCard: () => void;
  updateWindowSize: (mode: OverlayMode, allowFocus?: boolean, customSize?: { width: number; height: number }) => Promise<void>;
  executeGracefulHide: () => void;
}

export function useActionStream({ config, workspace, selectionText, isPinned, onShowCard,
  updateWindowSize, executeGracefulHide }: UseActionStreamProps) {
  const clientRef = useRef<ActionStreamClient | null>(null);
  const getStreamClient = useCallback(() => {
    if (!clientRef.current) clientRef.current = createActionStreamClient({
      invoke, listen, createRequestId: () => crypto.randomUUID(),
      onToken: (token, owner) => { if (owner) workspace.append(owner, token); },
      onDone: (canceled, owner) => { if (owner) workspace.finish(owner, { canceled }); },
      onError: (error, owner) => { if (owner) workspace.finish(owner, { error }); },
    });
    return clientRef.current;
  }, [workspace]);

  useEffect(() => {
    const client = getStreamClient();
    void client.connect().catch(() => {});
    return () => {
      workspace.stop();
      client.dispose();
      if (clientRef.current === client) clientRef.current = null;
    };
  }, [getStreamClient, workspace]);

  const handleDetachStream = useCallback(() => {
    workspace.stop();
    void clientRef.current?.detach();
  }, [workspace]);

  const send = useCallback(async (plan: GenerationPlan | null, prepare?: () => Promise<void>) => {
    if (!plan) return;
    const provider = config?.providers.find((p) => p.id === plan.providerId);
    await getStreamClient().start({ actionId: plan.actionId, text: plan.text,
      modelOverride: plan.modelOverride, providerOverride: plan.providerId, promptOverride: plan.promptOverride,
      ...getThinkingRequestOptions(plan.thinkingMode, provider),
    }, prepare, plan.generationId);
  }, [config?.providers, getStreamClient]);

  // 动作绑定的服务商即使已停用也照常执行；停用只影响选择器可见性。
  const defaultModel = (action: ActionConfig) =>
    resolveProviderModel(config?.providers.find((p) => p.id === action.providerId));
  const reportMissingModel = () => workspace.reportError('⚠️ 当前未配置可用模型，请在下方切换服务商或前往设置添加模型。');

  async function triggerWeb(action: ActionConfig, text: string, autoSubmitOverride?: boolean) {
    try {
      await invoke('trigger_web_action', { actionId: action.id, text,
        copyToClipboard: action.copyToClipboard || false, ...(autoSubmitOverride === undefined ? {} : { autoSubmitOverride }) });
      if (!isPinned) executeGracefulHide();
    } catch (error) { workspace.reportError(String(error)); }
  }
  async function copyText(text: string) {
    try { await navigator.clipboard.writeText(text); }
    catch (error) { console.warn('Copy action failed:', error); }
  }
  function detachForeignView() {
    workspace.stop();
    void clientRef.current?.detach(false);
  }

  const handleTriggerAction = async (action: ActionConfig) => {
    if (action.actionType === 'copy') {
      detachForeignView();
      if (selectionText) await copyText(selectionText);
      if (!isPinned) executeGracefulHide();
      return;
    }
    if (action.actionType === 'web') {
      detachForeignView();
      if (action.copyToClipboard && selectionText) await copyText(selectionText);
      await triggerWeb(action, selectionText); return;
    }
    const model = defaultModel(action);
    const thinkingMode = workspace.getSnapshot().active?.thinkingMode;
    if (!model.trim()) {
      void clientRef.current?.detach(clientRef.current.activeActionId === action.id);
      const failed = workspace.startInitial(action, model, selectionText, thinkingMode);
      workspace.finish(failed.generationId, { error: '⚠️ 当前未配置可用模型，请在下方切换服务商或前往设置添加模型。' });
      onShowCard();
      await updateWindowSize('card', true); return;
    }
    const plan = workspace.startInitial(action, model, selectionText, thinkingMode);
    onShowCard();
    await send(plan, () => updateWindowSize('card', true));
  };

  const handleTriggerActionWithoutText = async (action: ActionConfig) => {
    if (action.actionType === 'copy') return;
    workspace.stop();
    void clientRef.current?.detach(clientRef.current.activeActionId === action.id);
    if (action.actionType === 'web') {
      try {
        await invoke('trigger_web_action', { actionId: action.id, text: '', copyToClipboard: false });
        if (!isPinned) executeGracefulHide();
      } catch (error) { workspace.reportError(String(error)); }
      return;
    }
    workspace.openEmpty(action, defaultModel(action)); onShowCard();
    await updateWindowSize('card', true);
  };

  const handleTriggerQuoteAction = async (action: ActionConfig) => {
    if (action.actionType === 'copy') return;
    workspace.stop();
    void clientRef.current?.detach(clientRef.current.activeActionId === action.id);
    const quote = formatQuoteText(selectionText);
    if (action.actionType === 'web') {
      if (action.copyToClipboard && quote) await copyText(quote);
      await triggerWeb(action, quote, false); return;
    }
    workspace.openEmpty(action, defaultModel(action), quote); onShowCard();
    await updateWindowSize('card', true);
  };

  const hasModel = () => {
    if (workspace.getSnapshot().active?.selectedModel.trim()) return true;
    reportMissingModel(); return false;
  };
  const maxTurns = () => config?.apiCard?.contextTurns ?? 5;
  const handleSendFollowUp = async (prompt: string) => {
    if (hasModel()) await send(workspace.followUp(prompt, maxTurns()));
  };
  const handleEditMessage = async (index: number, prompt: string): Promise<boolean> => {
    if (!hasModel()) return false;
    const plan = workspace.edit(index, prompt, maxTurns());
    await send(plan); return plan !== null;
  };
  const handleRegenerateCurrentTurn = async () => {
    if (hasModel()) await send(workspace.regenerate(maxTurns()));
  };
  const handleProviderChange = (id: string) => {
    const provider = config?.providers.find((p) => p.id === id && isProviderSelectable(p));
    if (provider) workspace.chooseProvider(id, resolveProviderModel(provider));
  };
  const handleModelChange = (model: string) => workspace.chooseModel(model);
  const handleThinkingModeChange = (mode: ThinkingMode) => workspace.chooseThinkingMode(mode);

  // Domain navigation revokes generation ownership synchronously; cancellation targets the old execution.
  const navigate = (intent: () => void) => {
    const generation = workspace.getSnapshot().active?.generation?.id;
    intent();
    if (generation && workspace.getSnapshot().active?.generation?.id !== generation) void clientRef.current?.detach();
  };
  const handleNewChat = () => navigate(() => workspace.newTab());
  const handleSelectTab = (id: string) => navigate(() => workspace.select(id));
  const handleCloseTab = (id: string) => navigate(() => workspace.close(id));
  const handleCloseOtherTabs = (id: string) => navigate(() => workspace.closeOthers(id));
  const handleCloseLeftTabs = (id: string) => navigate(() => workspace.closeLeft(id));
  const handleCloseRightTabs = (id: string) => navigate(() => workspace.closeRight(id));
  const handleExportMarkdown = async () => {
    const active = workspace.getSnapshot().active;
    if (active) await copyText(exportMarkdown(active));
  };
  const handleCancel = async () => { await clientRef.current?.cancel(); };

  return { handleTriggerAction, handleTriggerActionWithoutText, handleTriggerQuoteAction,
    handleSendFollowUp, handleEditMessage, handleRegenerateCurrentTurn,
    handleProviderChange, handleModelChange, handleThinkingModeChange, handleNewChat,
    handleSelectTab, handleCloseTab, handleCloseOtherTabs, handleCloseLeftTabs, handleCloseRightTabs,
    handleExportMarkdown, handleCancel, handleDetachStream };
}
