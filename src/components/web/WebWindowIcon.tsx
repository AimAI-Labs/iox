import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DynamicIcon } from '@/components/Icons';

const ICON_SIZE = 64;

/** Render the same action icon for the owning native window, including local SVG/image icons. */
export function WebWindowIcon({ icon, actionId }: { icon?: string; actionId?: string | null }) {
  const container = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!icon || !actionId) return;
    let disposed = false;
    let revision = 0;
    let pendingImage: HTMLImageElement | undefined;
    const update = () => {
      const source = container.current?.querySelector('svg, img');
      if (!source) return;
      const current = ++revision;
      if (pendingImage) pendingImage.onload = pendingImage.onerror = null;
      let url: string;
      if (source instanceof SVGSVGElement) {
        const svg = source.cloneNode(true) as SVGSVGElement;
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svg.style.color = getComputedStyle(source).color;
        url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
      } else {
        url = (source as HTMLImageElement).src;
      }
      const image = new window.Image();
      pendingImage = image;
      image.onload = () => {
        if (disposed || current !== revision) return;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = ICON_SIZE;
        const context = canvas.getContext('2d');
        if (!context) return;
        try {
          context.drawImage(image, 0, 0, ICON_SIZE, ICON_SIZE);
          const rgba = Array.from(context.getImageData(0, 0, ICON_SIZE, ICON_SIZE).data);
          void invoke('set_web_window_icon', { actionId, rgba, width: ICON_SIZE, height: ICON_SIZE })
            .catch((error) => console.warn('Failed to update Web window icon:', error));
        } catch (error) {
          console.warn('Failed to render Web window icon:', error);
        }
      };
      image.onerror = () => {
        if (!disposed) console.warn('Failed to load Web window icon');
      };
      image.src = url;
    };
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-ui-style'] });
    update();
    return () => {
      disposed = true;
      observer.disconnect();
      if (pendingImage) pendingImage.onload = pendingImage.onerror = null;
    };
  }, [actionId, icon]);

  return <span hidden aria-hidden className="text-foreground" ref={container}>
    {icon && <DynamicIcon name={icon} size={ICON_SIZE} />}
  </span>;
}
