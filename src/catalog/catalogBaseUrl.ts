export function getCatalogBaseUrl(): string {
  const DEFAULT_FALLBACK = "https://jn01020304.github.io/nai-tag-builder/";

  const extractBaseUrl = (src: string | null): string | null => {
    if (!src) return null;
    try {
      const url = new URL(src, window.location.href);
      const pathname = url.pathname;
      const lastSlashIndex = pathname.lastIndexOf("/");
      if (lastSlashIndex !== -1) {
        url.pathname = pathname.substring(0, lastSlashIndex + 1);
      }
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      return null;
    }
  };

  // 1. #nai-tag-builder-loader
  const loaderScript = document.getElementById("nai-tag-builder-loader") as HTMLScriptElement;
  if (loaderScript && loaderScript.src) {
    const url = extractBaseUrl(loaderScript.src);
    if (url) return url;
  }

  // 2. document.currentScript
  if (document.currentScript && (document.currentScript as HTMLScriptElement).src) {
    const url = extractBaseUrl((document.currentScript as HTMLScriptElement).src);
    if (url) return url;
  }

  // 3. script[src*="nai-tag-builder.js"]
  const scripts = document.querySelectorAll('script[src*="nai-tag-builder.js"]');
  for (let i = 0; i < scripts.length; i++) {
    const src = (scripts[i] as HTMLScriptElement).src;
    const url = extractBaseUrl(src);
    if (url) return url;
  }

  // 4. Build-time fallback (Vite dev server)
  if (import.meta.env?.DEV) {
    return "/"; // Root of dev server
  }

  // 5. Default GitHub Pages URL
  return DEFAULT_FALLBACK;
}
