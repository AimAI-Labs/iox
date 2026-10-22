/**
 * 回答内链接的提取与展示工具
 */

export interface LinkInfo {
  href: string;
  domain: string;
  title: string;
}

/** 从绝对/相对 URL 中取出用于展示的域名 */
export function getDomain(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

export function isHttpUrl(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** 站点图标服务（Google s2），失败时由 LinkFavicon 回退为首字母 */
export function getFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

/** 从已渲染的 Markdown 容器中收集外链（去重、保持出现顺序） */
export function collectLinksFromRoot(root: ParentNode): LinkInfo[] {
  const seen = new Set<string>();
  const links: LinkInfo[] = [];

  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
    // 只收集作者显式写出的绝对外链，排除相对路径、页内锚点与脚注引用
    const rawHref = anchor.getAttribute('href') || '';
    if (!/^https?:\/\//i.test(rawHref)) return;

    let url: URL;
    try {
      url = new URL(rawHref);
    } catch {
      return;
    }

    // 同一页面的锚点跳转视为同一链接
    url.hash = '';
    const href = url.toString();
    if (seen.has(href)) return;
    seen.add(href);

    const domain = url.hostname.replace(/^www\./i, '');
    const text = (anchor.textContent || '').replace(/\s+/g, ' ').trim();
    links.push({
      href,
      domain,
      title: (text || domain).slice(0, 200),
    });
  });

  return links;
}

/** 轻量比较，避免流式输出时每个 token 都触发无意义的状态更新 */
export function linksEqual(a: LinkInfo[], b: LinkInfo[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (link, index) => link.href === b[index].href && link.title === b[index].title
  );
}
