import React from 'react';
import {
  Sparkles,
  Search,
  Languages,
  FileText,
  Copy,
  MessageSquare,
  Bot,
  HelpCircle,
  Settings,
  Wand2,
  Globe,
  Cpu,
  LayoutTemplate,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Check,
  RotateCw,
  ExternalLink,
  Pin,
  PinOff,
  X,
  Send,
  Square,
  ChevronDown,
  AlertCircle,
  GripVertical,
  MoreHorizontal,
  Box,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Code,
  Compass,
  BookOpen,
  Feather,
  Flame,
  Zap,
  Brain,
  PenTool,
  Share2,
  Key,
  FileCheck,
  Lightbulb,
  type LucideProps,
} from 'lucide-react';

interface IconProps {
  name: string;
  className?: string;
  size?: number;
}

/**
 * 显式图标映射表，避免全量打包整个 lucide-react 库
 */
const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  Sparkles,
  Search,
  Languages,
  FileText,
  Copy,
  MessageSquare,
  Bot,
  HelpCircle,
  Settings,
  Wand2,
  Globe,
  Cpu,
  LayoutTemplate,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Check,
  RotateCw,
  ExternalLink,
  Pin,
  PinOff,
  X,
  Send,
  Square,
  ChevronDown,
  AlertCircle,
  GripVertical,
  MoreHorizontal,
  Box,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Code,
  Compass,
  BookOpen,
  Feather,
  Flame,
  Zap,
  Brain,
  PenTool,
  Share2,
  Key,
  FileCheck,
  Lightbulb,
};

// 语义别名映射（中文/常用简写）
const ALIAS_MAP: Record<string, string> = {
  Translate: 'Languages',
  Summary: 'FileText',
  Chat: 'MessageSquare',
  Ai: 'Bot',
  AiSearch: 'Search',
  Web: 'Globe',
  Model: 'Cpu',
  Prompt: 'FileText',
  Metaso: 'Compass',
  ChatGPT: 'Bot',
  Phind: 'Code',
  Felo: 'Globe',
};

/**
 * 统一使用 Lucide 图标的按需映射组件
 */
export const DynamicIcon: React.FC<IconProps> = ({ name, className = '', size = 16 }) => {
  if (!name) {
    return <Sparkles size={size} className={className} />;
  }

  const resolvedName = ALIAS_MAP[name] || name;
  const Component = ICON_MAP[resolvedName] || ICON_MAP[name] || Sparkles;

  return <Component size={size} className={className} />;
};
