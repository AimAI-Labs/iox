import { useEffect, useId, useRef, useState } from 'react';
import { RefreshCw, Wallet } from 'lucide-react';
import { HoverPopover, type PopoverAnchorRect } from './HoverPopover';
import { useProviderBalance } from '@/hooks/useProviderBalance';
import { formatBalanceAmount } from '@/lib/providerBalance';
import { translations } from '@/locales';
import type { ProviderConfig } from '@/types/config';

export function BalancePill({ provider, isZh }: { provider?: ProviderConfig; isZh: boolean }) {
  const { snapshot, refresh } = useProviderBalance(provider);
  const [anchorRect, setAnchorRect] = useState<PopoverAnchorRect | null>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const open = anchorRect !== null;
  const labels = translations[isZh ? 'zh' : 'en'].card.balance;
  const locale = isZh ? 'zh-CN' : 'en-US';

  useEffect(() => { setAnchorRect(null); }, [provider?.id, provider?.baseUrl]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!groupRef.current?.contains(target) && !panelRef.current?.contains(target)) setAnchorRect(null);
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setAnchorRect(null);
      buttonRef.current?.focus();
    };
    const reposition = () => {
      if (groupRef.current) setAnchorRect(groupRef.current.getBoundingClientRect());
    };
    document.addEventListener('pointerdown', dismiss);
    window.addEventListener('keydown', keyDown, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('keydown', keyDown, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  if (!snapshot) return null;
  const { data, loading, error, updatedAt } = snapshot;
  const primary = data?.balanceInfos.find((info) => info.currency === 'CNY') ?? data?.balanceInfos[0];
  const amount = primary ? formatBalanceAmount(primary.totalBalance, primary.currency, locale) : '—';
  const errorLabel = error ? labels.errors[error] : null;
  const extraCurrencies = (data?.balanceInfos.length ?? 0) - 1;
  const updated = updatedAt === null ? labels.neverUpdated : new Date(updatedAt).toLocaleString(locale, {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  let status = labels.available;
  if (!data) status = loading ? labels.loading : labels.unavailable;
  else if (!data.isAvailable) status = labels.insufficient;
  if (errorLabel) status = errorLabel;

  return (
    <>
      <div ref={groupRef} className="balance-pill" data-warning={Boolean(error || (data && !data.isAvailable))}
        role="group" aria-label={`${provider?.name} ${labels.title}`}>
        <button ref={buttonRef} type="button" className="balance-pill-amount"
          aria-label={`${labels.title}: ${amount}. ${status}`} aria-haspopup="dialog"
          aria-expanded={open} aria-controls={open ? panelId : undefined}
          title={`${provider?.name} · ${labels.title} · ${status}`}
          onClick={() => setAnchorRect(open ? null : groupRef.current!.getBoundingClientRect())}>
          <Wallet size={12} strokeWidth={1.7} aria-hidden="true" />
          <span>{loading && !data ? labels.loading : amount}</span>
          {extraCurrencies > 0 && <small>+{extraCurrencies}</small>}
          {error && data && <i className="balance-pill-stale" aria-label={labels.stale} />}
        </button>
        <button type="button" className="balance-pill-refresh" onClick={() => void refresh?.()}
          disabled={loading || !provider?.apiKey.trim()}
          aria-label={loading ? labels.refreshing : labels.refresh}
          title={loading ? labels.refreshing : labels.refresh} aria-busy={loading}>
          <RefreshCw size={11} strokeWidth={1.8} className={loading ? 'balance-refresh-spinning' : undefined} aria-hidden="true" />
        </button>
      </div>

      {anchorRect && (
        <HoverPopover open anchorRect={anchorRect} interactive className="balance-popover shadow-overlay custom-scrollbar">
          <div ref={panelRef} id={panelId} role="dialog" aria-label={labels.details} className="balance-details">
            <header><span>{provider?.name}</span><strong>{labels.title}</strong></header>
            <p className="balance-status" data-warning={Boolean(error || (data && !data.isAvailable))}>{status}</p>
            {data?.balanceInfos.map((info) => (
              <section key={info.currency} className="balance-currency">
                <div className="balance-total"><span>{labels.total} <small>{info.currency}</small></span>
                  <strong>{formatBalanceAmount(info.totalBalance, info.currency, locale)}</strong></div>
                <dl>
                  <div><dt>{labels.granted}</dt><dd>{formatBalanceAmount(info.grantedBalance, info.currency, locale)}</dd></div>
                  <div><dt>{labels.toppedUp}</dt><dd>{formatBalanceAmount(info.toppedUpBalance, info.currency, locale)}</dd></div>
                </dl>
              </section>
            ))}
            {error && data && <p className="balance-stale-note">{labels.stale}</p>}
            <footer><span>{labels.updated}</span><time>{updated}</time></footer>
            <p className="balance-schedule">{labels.autoRefresh}</p>
          </div>
        </HoverPopover>
      )}
    </>
  );
}
