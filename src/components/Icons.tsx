import React from 'react';
import * as LucideIcons from 'lucide-react';

interface IconProps {
  name: string;
  className?: string;
  size?: number;
}

export const DynamicIcon: React.FC<IconProps> = ({ name, className = '', size = 16 }) => {
  // @ts-expect-error Lucide icons indexed by dynamic string name
  const IconComponent = LucideIcons[name] || LucideIcons.Sparkles;
  return <IconComponent size={size} className={className} />;
};

export {
  LucideIcons
};
