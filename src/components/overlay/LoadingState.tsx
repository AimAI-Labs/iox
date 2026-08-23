import React, { useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────
 * BUI LoadingState — 像素网格加载器 (beautifului.dev)
 * 3x3 4px 方形单元，Chevron 斜向波前驱动；
 * 650ms 循环短于扫描周期，因此始终有两道波前在途中。
 * ───────────────────────────────────────────────────────── */

/* Chevron 波前延时矩阵 (ms)：列号 + |行号 - 中心行| */
const chevron = Array.from({ length: 9 }, (_, i) => {
  const r = Math.floor(i / 3);
  const c = i % 3;
  return (c + Math.abs(r - 1)) * 90;
});

/** 超过此秒数后显示"取消"按钮，避免用户被永久卡住 */
const CANCEL_BUTTON_THRESHOLD_S = 8;

function useElapsed() {
  const [ds, setDs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDs((d) => d + 1), 100);
    return () => clearInterval(t);
  }, []);
  const total = ds / 10;
  const format =
    total < 60
      ? `${total.toFixed(1)}s`
      : `${Math.floor(total / 60)}m ${(total % 60).toFixed(1)}s`;
  return { format, seconds: total };
}

export interface LoadingStateProps {
  label?: string;
  className?: string;
  /** 取消回调；传入后超过 8s 会显示可点击的"取消"按钮 */
  onCancel?: () => void;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  label,
  className,
  onCancel,
}) => {
  const { t } = useTranslation();
  const displayLabel = label || t('card.thinkingInProgress');
  const { format: elapsed, seconds: elapsedS } = useElapsed();
  const showCancel = Boolean(onCancel) && elapsedS >= CANCEL_BUTTON_THRESHOLD_S;

  return (
    <div
      role="status"
      className={cn('flex w-fit items-center gap-2.5 select-none', className)}
    >
      {/* 3x3 像素网格 */}
      <span
        aria-hidden
        className="grid shrink-0 grid-cols-[repeat(3,4px)] gap-[1.5px]"
      >
        {chevron.map((delay, index) => (
          <span
            key={index}
            className="size-[4px] rounded-[1px] bg-ink"
            style={{
              opacity: 0.15,
              animation: `pixel-on 650ms ease-in-out ${delay}ms infinite`,
            }}
          />
        ))}
      </span>

      {/* 流光渐变文字 */}
      <span
        className="bg-clip-text text-[13px] font-medium text-transparent"
        style={{
          backgroundImage:
            'linear-gradient(90deg, var(--ink-3) 35%, var(--ink) 50%, var(--ink-3) 65%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer-text 1.4s linear infinite',
        }}
      >
        {displayLabel}
      </span>

      {/* mono 等宽实时耗时 */}
      <span className="font-mono text-[12px] text-ink-3 tabular-nums">
        {elapsed}
      </span>

      {/* 超时取消按钮 */}
      {showCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="ml-1 inline-flex h-5 items-center rounded-[4px] bg-field px-1.5 text-[11px] text-ink-2 transition-colors duration-100 hover:bg-hover hover:text-ink active:scale-[0.96] cursor-pointer"
        >
          {t('common.cancel')}
        </button>
      )}
    </div>
  );
};
