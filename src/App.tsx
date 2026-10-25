import { useEffect, useState, Suspense, lazy, type ReactNode } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useConfig } from '@/hooks/useConfig';
import { useTheme } from '@/hooks/useTheme';
import { I18nProvider } from '@/hooks/useTranslation';
import { ThemeProvider } from '@/themes/ThemeProvider';
import { FloatingBall } from '@/components/overlay';
import { OverlaySurface } from '@/components/overlay/OverlaySurface';
import { Toaster } from 'sonner';
import './App.css';

// 懒加载非悬浮窗视图，极大加速 Overlay 首屏渲染与降低内存占用
const Settings = lazy(() => import('@/components/settings').then((m) => ({ default: m.Settings })));
const WebTitleBar = lazy(() => import('@/components/web').then((m) => ({ default: m.WebTitleBar })));

export function App() {
  const { config, loading, updateConfig } = useConfig();
  const [windowLabel, setWindowLabel] = useState<string>('main');
  const urlParams = new URLSearchParams(window.location.search);
  const isWebTitleBar = urlParams.get('view') === 'web_titlebar' || windowLabel.endsWith('_bar');

  useEffect(() => {
    try {
      const current = getCurrentWebviewWindow();
      setWindowLabel(current.label);
    } catch {
      // 在纯浏览器环境预览时默认为 main
      setWindowLabel('main');
    }
  }, []);

  // 统一应用与监听主题及透明度
  useTheme(config?.general.theme, config?.general.overlayOpacity);

  // 所有视图共享同一套界面样式策略（CSS 令牌 + 组件策略）
  const withTheme = (node: ReactNode) => (
    <ThemeProvider style={config?.general.uiStyle}>{node}</ThemeProvider>
  );

  if (loading || !config) {
    if (windowLabel === 'overlay' || windowLabel === 'floating_ball') {
      return null;
    }
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" />
        </div>
      </div>
    );
  }

  // 0. Web 官网浮窗标题栏视图
  if (isWebTitleBar) {
    return withTheme(
      <I18nProvider languageSetting={config.general.language}>
        <Suspense fallback={null}>
          <WebTitleBar actions={config.actions} dragHoldDelayMs={config.general.webDragHoldDelayMs} />
        </Suspense>
      </I18nProvider>
    );
  }

  // 1. 常驻悬浮球视图
  if (windowLabel === 'floating_ball') {
    if (config.general.enableFloatingBall === false) {
      return null;
    }
    return withTheme(
      <I18nProvider languageSetting={config.general.language}>
        <FloatingBall config={config} />
      </I18nProvider>
    );
  }

  // 2. Overlay 悬浮窗视图：生命周期 hook 只在 overlay 窗口内建立
  if (windowLabel === 'overlay') {
    return withTheme(
      <I18nProvider languageSetting={config.general.language}>
        <OverlaySurface config={config} updateConfig={updateConfig} />
      </I18nProvider>
    );
  }

  // 3. Settings 设置面板视图 (主窗口异步载入)
  return withTheme(
    <I18nProvider languageSetting={config.general.language}>
      <Toaster
        position="top-center"
        richColors
        closeButton
        duration={3500}
        theme={config.general.theme === 'system' ? 'system' : (config.general.theme as 'dark' | 'light')}
      />
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen bg-transparent">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" />
            </div>
          </div>
        }
      >
        <Settings config={config} onSave={updateConfig} />
      </Suspense>
    </I18nProvider>
  );
}

export default App;
