import React from 'react';
import { ActionConfig } from '../types/config';
import { DynamicIcon } from './Icons';
import { Settings as SettingsIcon } from 'lucide-react';

interface BubbleBarProps {
  actions: ActionConfig[];
  onActionClick: (action: ActionConfig) => void;
  onOpenSettings?: () => void;
}

export const BubbleBar: React.FC<BubbleBarProps> = ({
  actions,
  onActionClick,
  onOpenSettings,
}) => {
  const enabledActions = actions.filter((a) => a.enabled);

  return (
    <div className="bubble-bar-container">
      <div className="bubble-bar">
        {enabledActions.map((action) => (
          <button
            key={action.id}
            className="bubble-btn"
            onClick={() => onActionClick(action)}
            title={action.name}
          >
            <DynamicIcon name={action.icon} size={15} />
            <span className="bubble-btn-text">{action.name}</span>
          </button>
        ))}

        {onOpenSettings && (
          <>
            <div className="bubble-divider" />
            <button
              className="bubble-btn bubble-btn-icon-only"
              onClick={onOpenSettings}
              title="设置"
            >
              <SettingsIcon size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
