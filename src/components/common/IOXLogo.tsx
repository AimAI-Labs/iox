import React from 'react';
import ioxTransparency from '@/assets/iox-transparency.png';
import ioxSolid from '@/assets/iox.png';
import { cn } from '@/lib/utils';

export interface IOXLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  size?: number | string;
  variant?: 'transparent' | 'solid';
  className?: string;
  glow?: boolean;
}

export const IOXLogo: React.FC<IOXLogoProps> = ({
  size = 20,
  variant = 'transparent',
  className,
  glow = false,
  alt = 'IOX Logo',
  ...rest
}) => {
  const src = variant === 'solid' ? ioxSolid : ioxTransparency;

  const sizeStyle = typeof size === 'number' ? { width: `${size}px`, height: `${size}px` } : { width: size, height: size };

  return (
    <img
      src={src}
      alt={alt}
      style={sizeStyle}
      draggable={false}
      className={cn(
        'select-none object-contain pointer-events-none transition-transform duration-200',
        glow && 'drop-shadow-[0_0_8px_rgba(59,130,246,0.35)]',
        className
      )}
      {...rest}
    />
  );
};

export default IOXLogo;
