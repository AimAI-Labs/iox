import React from 'react';
import * as LucideIcons from 'lucide-react';
import { Sparkles } from 'lucide-react';

interface IconProps {
  name: string;
  className?: string;
  size?: number;
}

/**
 * 统一使用 Lucide 图标的动态映射组件
 */
export const DynamicIcon: React.FC<IconProps> = ({ name, className = '', size = 16 }) => {
  if (!name) {
    return <Sparkles size={size} className={className} />;
  }

  // 映射常见中文/英文别名到 Lucide 官方图标名
  const iconAliases: Record<string, string> = {
    Search: 'Search',
    Languages: 'Languages',
    Translate: 'Languages',
    FileText: 'FileText',
    Summary: 'FileText',
    Copy: 'Copy',
    MessageSquare: 'MessageSquare',
    Bot: 'Bot',
    Chat: 'MessageSquare',
    Sparkles: 'Sparkles',
    HelpCircle: 'HelpCircle',
    Settings: 'Settings',
    Wand2: 'Wand2',
  };

  const resolvedName = iconAliases[name] || name;

  const iconRecord = LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>;
  const PotentialComponent = iconRecord[resolvedName] || iconRecord[name];
  const IconComponent = typeof PotentialComponent === 'function' || (typeof PotentialComponent === 'object' && PotentialComponent !== null)
    ? PotentialComponent
    : Sparkles;

  return <IconComponent size={size} className={className} />;
};

export { LucideIcons };
