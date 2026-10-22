import React, { useEffect, useState } from 'react';
import { ExternalLink, Link as LinkIcon, X } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { LinkFavicon } from '@/components/overlay/LinkFavicon';
import type { LinkInfo } from '@/lib/links';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

// 略长于动画时长，确保退场动画完整播放
const EXIT_ANIMATION_MS = 180;

export interface LinkPanelProps {
  isOpen: boolean;
  links: LinkInfo[];
  onClose: () => void;
}

/**
 * 右侧链接详情栏：列出当前回答中的全部外链。
 */
export const LinkPanel: React.FC<LinkPanelProps> = ({ isOpen, links, onClose }) => {
  const { t } = useTranslation();
  const [isMounted, setIsMounted] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      return;
    }
    if (!isMounted) return;

    const timer = window.setTimeout(() => setIsMounted(false), EXIT_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [isOpen, isMounted]);

  // 打开时优先关闭面板，避免 Esc 直接关掉整个卡片
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  const isClosing = isMounted && !isOpen;
  if (!isMounted) return null;

  const handleOpenLink = (href: string) => {
    void openUrl(href).catch((err) => console.warn('Failed to open link:', err));
  };

  return (
    <div className={cn('absolute inset-0 z-40', isClosing && 'pointer-events-none')}>
      {/* 遮罩 */}
      <div
        className={cn(
          'absolute inset-0 bg-zinc-950/10 dark:bg-black/40',
          isClosing
            ? 'animate-out fade-out duration-150 fill-mode-forwards'
            : 'animate-in fade-in duration-150'
        )}
        onClick={onClose}
      />

      {/* 右侧详情栏 */}
      <aside
        className={cn(
          'absolute inset-y-0 right-0 flex w-[min(340px,86%)] flex-col border-l border-line bg-[#fcfcfd] shadow-2xl dark:bg-[#18181b]',
          isClosing
            ? 'animate-out slide-out-to-right-8 fade-out duration-150 fill-mode-forwards'
            : 'animate-in slide-in-from-right-8 fade-in duration-200'
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <LinkIcon size={15} className="shrink-0 text-ink-2" />
            <span className="truncate text-[13px] font-semibold text-ink">
              {t('card.linksInAnswer')}
            </span>
            <span className="rounded-full bg-field px-1.5 py-0.5 text-[10.5px] font-medium text-ink-3">
              {links.length}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-hover hover:text-ink cursor-pointer"
            title={t('common.close')}
          >
            <X size={15} />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 min-h-0 space-y-1.5 overflow-y-auto p-3">
          {links.map((link) => (
            <button
              key={link.href}
              type="button"
              onClick={() => handleOpenLink(link.href)}
              className="group flex w-full items-start gap-2.5 rounded-xl border border-line/60 bg-white/60 p-2.5 text-left transition-colors hover:border-line-strong hover:bg-hover dark:bg-zinc-900/50 cursor-pointer"
              title={t('card.openLink')}
            >
              <LinkFavicon domain={link.domain} size={26} className="mt-0.5" />

              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-[12.5px] font-medium leading-snug text-ink">
                  {link.title}
                </div>
                <div className="mt-0.5 truncate text-[11px] text-ink-3">
                  {link.domain}
                </div>
                <div className="mt-0.5 line-clamp-2 break-all text-[10.5px] leading-snug text-ink-3/80">
                  {link.href}
                </div>
              </div>

              <ExternalLink
                size={12}
                className="mt-0.5 shrink-0 text-ink-3 transition-colors group-hover:text-primary"
              />
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
};
