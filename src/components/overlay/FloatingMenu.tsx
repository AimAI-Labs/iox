import React, { useEffect, useRef, useState } from 'react';
import { ActionConfig, AppConfig } from '@/types/config';
import { DynamicIcon } from '@/components/Icons';
import { ArrowUp, Settings, X, Quote, Sparkles } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from '@/hooks/useTranslation';

export type FloatingMenuCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface FloatingMenuProps {
  config: AppConfig;
  selectedText?: string;
  corner: FloatingMenuCorner;
  isClosing?: boolean;
  onClose: () => void;
  onTriggerAction: (action: ActionConfig, customPrompt?: string) => void;
  onOpenSettings: () => void;
  onInputFocusChange: (focused: boolean) => void;
}

export const FloatingMenu: React.FC<FloatingMenuProps> = ({
  config, selectedText = '', corner, isClosing = false, onClose, onTriggerAction, onOpenSettings, onInputFocusChange,
}) => {
  const { t } = useTranslation();
  const [inputText, setInputText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const enabledActions = config.actions.filter((action) => action.enabled);
  const defaultAction = enabledActions.find((action) => action.actionType === 'api') || enabledActions[0];
  const canSend = Boolean(defaultAction && (inputText.trim() || selectedText));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSend = (event: React.FormEvent) => {
    event.preventDefault();
    if (!defaultAction || !canSend) return;
    onTriggerAction(defaultAction, inputText.trim() || selectedText);
  };

  const activateInput = async (event: React.PointerEvent<HTMLInputElement>) => {
    if (event.button !== 0) return;
    // Hover must preserve the host selection; activation requires an explicit click.
    if (document.activeElement === inputRef.current && document.hasFocus()) return;
    event.preventDefault();
    onInputFocusChange(true);
    try {
      await invoke('focus_floating_ball_input');
      inputRef.current?.focus();
    } catch (error) {
      onInputFocusChange(false);
      console.error('Failed to focus floating menu input:', error);
    }
  };

  return (
    <section
      id="floating-action-menu"
      role="dialog"
      aria-label={t('bubble.quickAction')}
      className="floating-menu"
      inert={isClosing}
      data-corner={corner}
    >
      <header className="floating-menu-header">
        <div className="floating-menu-heading">
          <h2>{t('bubble.quickAction')}</h2>
          <p>{t('bubble.floatingMenuHint')}</p>
        </div>
      </header>

      <div className="floating-menu-content">
        {selectedText && (
          <div className="floating-menu-selection">
            <span className="floating-menu-selection-label"><Quote size={12} />{t('bubble.selectedContext')}</span>
            <p>{selectedText}</p>
          </div>
        )}
        {enabledActions.length ? (
          <div className="floating-menu-actions">
            {enabledActions.map((action) => (
              <button key={action.id} type="button" className="floating-menu-action"
                onClick={() => onTriggerAction(action, selectedText)} title={action.name}>
                <span className="floating-menu-action-icon"><DynamicIcon name={action.icon} size={19} /></span>
                <span className="floating-menu-action-name">{action.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <button type="button" className="floating-menu-empty" onClick={onOpenSettings}>
            <Sparkles size={20} /><span>{t('bubble.configureActions')}</span>
          </button>
        )}
      </div>

      <form className="floating-menu-composer" onSubmit={handleSend}>
        <input ref={inputRef} value={inputText} onChange={(event) => setInputText(event.target.value)}
          onPointerDown={activateInput}
          onFocus={() => onInputFocusChange(true)} onBlur={() => onInputFocusChange(false)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault();
          }}
          aria-label={t('bubble.floatingInputPlaceholder')}
          placeholder={t('bubble.floatingInputPlaceholder')}
        />
        <button type="submit" disabled={!canSend} aria-label={t('card.send')} title={t('card.send')}>
          <ArrowUp size={17} strokeWidth={2.4} />
        </button>
      </form>

      <footer className="floating-menu-footer">
        <span className="floating-menu-shortcut"><kbd>Esc</kbd>{t('bubble.collapseMenu')}</span>
        <div className="floating-menu-tools">
          <button type="button" onClick={onOpenSettings} title={t('bubble.openSettings')}
            aria-label={t('bubble.openSettings')}><Settings size={15} /></button>
          <button type="button" onClick={onClose} title={t('common.close')}
            aria-label={t('common.close')}><X size={16} /></button>
        </div>
      </footer>
    </section>
  );
};
