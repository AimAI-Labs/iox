import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { ActionConfig, ProviderConfig } from '../types/config';
import { DynamicIcon } from './Icons';
import {
  Pin,
  PinOff,
  X,
  Copy,
  Check,
  Send,
  Square,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';

interface ResultCardProps {
  action: ActionConfig;
  providers: ProviderConfig[];
  selectedModel: string;
  streamText: string;
  isLoading: boolean;
  isPinned: boolean;
  error: string | null;
  onModelChange: (model: string) => void;
  onSendFollowUp: (prompt: string) => void;
  onCancel: () => void;
  onPinToggle: () => void;
  onClose: () => void;
}

export const ResultCard: React.FC<ResultCardProps> = ({
  action,
  providers,
  selectedModel,
  streamText,
  isLoading,
  isPinned,
  error,
  onModelChange,
  onSendFollowUp,
  onCancel,
  onPinToggle,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [followUpInput, setFollowUpInput] = useState('');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const provider = providers.find((p) => p.id === action.providerId);
  const availableModels = provider?.models || [];

  // 自动滚屏到底部
  useEffect(() => {
    if (bodyRef.current && isLoading) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [streamText, isLoading]);

  // 复制结果
  const handleCopy = async () => {
    if (!streamText) return;
    try {
      await navigator.clipboard.writeText(streamText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleFollowUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpInput.trim() || isLoading) return;
    onSendFollowUp(followUpInput);
    setFollowUpInput('');
  };

  return (
    <div className="result-card">
      {/* 头部控制栏 */}
      <div className="result-header">
        <div className="result-header-left">
          <DynamicIcon name={action.icon} size={16} className="text-primary" />
          <span className="result-title">{action.name}</span>

          {/* 模型选择下拉 */}
          {availableModels.length > 0 && (
            <div className="model-selector-wrapper">
              <button
                className="model-pill-btn"
                onClick={() => setShowModelPicker((prev) => !prev)}
                title="切换模型"
              >
                <span>{selectedModel || '默认模型'}</span>
                <ChevronDown size={12} />
              </button>

              {showModelPicker && (
                <div className="model-dropdown">
                  {availableModels.map((m) => (
                    <div
                      key={m}
                      className={`model-option ${m === selectedModel ? 'active' : ''}`}
                      onClick={() => {
                        onModelChange(m);
                        setShowModelPicker(false);
                      }}
                    >
                      {m}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="result-header-actions">
          {streamText && (
            <button className="icon-btn" onClick={handleCopy} title="复制回答">
              {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            </button>
          )}

          <button
            className={`icon-btn ${isPinned ? 'active-pin' : ''}`}
            onClick={onPinToggle}
            title={isPinned ? '取消固定' : '固定悬浮窗'}
          >
            {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>

          <button className="icon-btn close-btn" onClick={onClose} title="关闭 (Esc)">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* 渲染正文区 */}
      <div className="result-body" ref={bodyRef}>
        {error ? (
          <div className="error-banner">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        ) : streamText ? (
          <div className="markdown-content">
            <ReactMarkdown>{streamText}</ReactMarkdown>
            {isLoading && <span className="typing-cursor">▌</span>}
          </div>
        ) : (
          <div className="loading-state">
            <div className="pulse-dots">
              <span />
              <span />
              <span />
            </div>
            <p className="text-subtle">AI 正在思考中...</p>
          </div>
        )}
      </div>

      {/* 底部追问栏 */}
      <div className="result-footer">
        <form onSubmit={handleFollowUpSubmit} className="follow-up-form">
          <input
            type="text"
            className="follow-up-input"
            placeholder="追问或进一步要求... (Enter 发送)"
            value={followUpInput}
            onChange={(e) => setFollowUpInput(e.target.value)}
            disabled={isLoading}
          />
          {isLoading ? (
            <button
              type="button"
              className="action-btn stop-btn"
              onClick={onCancel}
              title="停止生成"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              type="submit"
              className="action-btn send-btn"
              disabled={!followUpInput.trim()}
              title="发送"
            >
              <Send size={14} />
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
