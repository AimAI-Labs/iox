import React, { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CloudOff, Cloud, Loader2, PlugZap, RefreshCw } from "lucide-react";
import { SyncConfig } from "@/types/config";
import { Button, Card, CardContent, Input, Label, Select, Separator, Switch } from "@/components/ui";
import { useTranslation } from "@/hooks/useTranslation";

interface SyncStatus {
  state: "disabled" | "idle" | "syncing" | "error";
  lastSuccessAt: number;
  lastError: string | null;
  lastPulled: number;
  lastPushed: number;
}

interface SyncOutcome {
  applied: number;
  skipped: number;
  pushed: number;
}

interface SyncTabProps {
  sync: SyncConfig;
  onUpdateSync: (updated: Partial<SyncConfig>) => void;
}

const fieldClassName =
  "h-8 text-xs bg-white/80 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80";

const formatTime = (seconds: number): string =>
  seconds > 0 ? new Date(seconds * 1000).toLocaleString() : "—";

export const SyncTab: React.FC<SyncTabProps> = ({ sync, onUpdateSync }) => {
  const { t, resolvedLanguage } = useTranslation();
  const isZh = resolvedLanguage === "zh";
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await invoke<SyncStatus>("get_sync_status"));
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    const timer = window.setInterval(() => void refreshStatus(), 5000);
    return () => window.clearInterval(timer);
  }, [refreshStatus]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const version = await invoke<string>("test_pg_connection", { settings: sync });
      setTestResult(t("settings.sync.testOk", { version }));
    } catch (error) {
      setTestResult(String(error));
    } finally {
      setTesting(false);
    }
  };

  const handleSyncNow = async () => {
    setRunning(true);
    try {
      const outcome = await invoke<SyncOutcome>("sync_now");
      setTestResult(
        t("settings.sync.syncDone", {
          applied: outcome.applied,
          pushed: outcome.pushed,
        }),
      );
    } catch (error) {
      setTestResult(String(error));
    } finally {
      setRunning(false);
      void refreshStatus();
    }
  };

  const stateLabel = (() => {
    if (!sync.enabled) return t("settings.sync.statusDisabled");
    if (running || status?.state === "syncing") return t("settings.sync.statusSyncing");
    if (status?.state === "error") return t("settings.sync.statusError");
    return t("settings.sync.statusIdle");
  })();

  return (
    <div className="space-y-4">
      <div className="pb-1 border-b border-border/30">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {t("settings.sync.title")}
        </h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">{t("settings.sync.subtitle")}</p>
      </div>

      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                {t("settings.sync.enabled")}
              </Label>
              <p className="text-[11px] text-muted-foreground">{t("settings.sync.enabledDesc")}</p>
            </div>
            <Switch
              checked={sync.enabled}
              onCheckedChange={(checked) => onUpdateSync({ enabled: checked })}
            />
          </div>

          <Separator />

          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-foreground font-medium">
                {t("settings.sync.host")}
              </Label>
              <Input
                value={sync.host}
                className={fieldClassName}
                placeholder="db.example.com"
                onChange={(event) => onUpdateSync({ host: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-foreground font-medium">
                {t("settings.sync.port")}
              </Label>
              <Input
                value={String(sync.port)}
                className={fieldClassName}
                inputMode="numeric"
                onChange={(event) => {
                  const port = Number.parseInt(event.target.value, 10);
                  onUpdateSync({ port: Number.isFinite(port) ? Math.min(65535, Math.max(1, port)) : 5432 });
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-foreground font-medium">
                {t("settings.sync.database")}
              </Label>
              <Input
                value={sync.database}
                className={fieldClassName}
                onChange={(event) => onUpdateSync({ database: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-foreground font-medium">
                {t("settings.sync.user")}
              </Label>
              <Input
                value={sync.user}
                className={fieldClassName}
                onChange={(event) => onUpdateSync({ user: event.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-foreground font-medium">
                {t("settings.sync.password")}
              </Label>
              <Input
                type="password"
                value={sync.password}
                className={fieldClassName}
                onChange={(event) => onUpdateSync({ password: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-foreground font-medium">
                {t("settings.sync.sslMode")}
              </Label>
              <Select
                value={sync.sslMode}
                onChange={(value) => onUpdateSync({ sslMode: value as SyncConfig["sslMode"] })}
                options={[
                  { value: "prefer", label: t("settings.sync.sslPrefer") },
                  { value: "require", label: t("settings.sync.sslRequire") },
                  { value: "disable", label: t("settings.sync.sslDisable") },
                ]}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-foreground font-medium">
              {t("settings.sync.namespace")}
            </Label>
            <Input
              value={sync.namespace}
              className={fieldClassName}
              onChange={(event) => onUpdateSync({ namespace: event.target.value })}
            />
            <p className="text-[11px] text-muted-foreground">{t("settings.sync.namespaceDesc")}</p>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {sync.enabled ? <Cloud size={13} /> : <CloudOff size={13} />}
              <span>{stateLabel}</span>
              <span className="text-border">·</span>
              <span>
                {t("settings.sync.lastSuccess")}: {formatTime(status?.lastSuccessAt ?? 0)}
              </span>
              {status && status.lastPulled + status.lastPushed > 0 && (
                <span>
                  ({t("settings.sync.lastCounts", { pulled: status.lastPulled, pushed: status.lastPushed })})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2.5 text-xs"
                disabled={testing}
                onClick={() => void handleTest()}
              >
                {testing ? <Loader2 size={13} className="animate-spin" /> : <PlugZap size={13} />}
                {t("settings.sync.test")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2.5 text-xs"
                disabled={running || !sync.enabled}
                onClick={() => void handleSyncNow()}
              >
                {running ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                {t("settings.sync.syncNow")}
              </Button>
            </div>
          </div>

          {testResult && (
            <p className="text-[11px] break-all text-muted-foreground">{testResult}</p>
          )}
          {sync.enabled && status?.lastError && (
            <p className="text-[11px] break-all text-red-500">{status.lastError}</p>
          )}

          <p className="text-[11px] text-muted-foreground">
            {isZh
              ? "本地历史始终是读写真源：远程不可达时会话保存不受影响，恢复连接后自动补推。"
              : "Local history stays authoritative: saving works while offline, and pending changes are pushed once the remote is reachable."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
