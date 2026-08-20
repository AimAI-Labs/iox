import React, { useEffect, useState } from 'react';
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

function useElapsed() {
  const [ds, setDs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDs((d) => d + 1), 100);
    return () => clearInterval(t);
  }, []);
  const total = ds / 10;
  if (total < 60) return `${total.toFixed(1)}s`;
  return `${Math.floor(total / 60)}m ${(total % 60).toFixed(1)}s`;
}

export interface LoadingStateProps {
  label?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  label = 'AI 正在深入思考分析中...',
  className,
}) => {
  const elapsed = useElapsed();

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
        {label}
      </span>

      {/* mono 等宽实时耗时 */}
      <span className="font-mono text-[12px] text-ink-3 tabular-nums">
        {elapsed}
      </span>
    </div>
  );
};
