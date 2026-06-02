/* Novel Builder Service Worker - v2 (2026-06-02)
 * 修复记录：
 *   1) 不再拦截 /api/*（避免缓存 SSE 流、配置写、加密读写）
 *   2) navigate 请求改为「网络优先」：在线时永远拿最新；离线时回退到 /index.html
 *   3) 静态资源使用 stale-while-revalidate，命中缓存立即返回的同时后台刷新
 *   4) 旧 cache（novelbuilder-pwa-v1）在 activate 阶段被清理
 *   5) 安装阶段仅 precache app shell，不再依赖运行时网络
 */

const CACHE_VERSION = 'v2';
const CACHE_STATIC = `novelbuilder-static-${CACHE_VERSION}`;
const CACHE_RUNTIME = `novelbuilder-runtime-${CACHE_VERSION}`;
const CACHE_PAGES = `novelbuilder-pages-${CACHE_VERSION}`;

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons.svg',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/icon-maskable.svg',
];

// 这些路径前缀绝对不能进缓存（Vite HMR、后端 API、Node 模块）
const NEVER_CACHE_PREFIXES = ['/api/', '/@vite/', '/@id/', '/@fs/', '/node_modules/', '/src/', '/__vite_ping'];
const NEVER_CACHE_EXACT = new Set(['/sw.js']);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_STATIC)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => ![CACHE_STATIC, CACHE_RUNTIME, CACHE_PAGES].includes(key))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

function shouldNeverCache(url) {
  if (NEVER_CACHE_EXACT.has(url.pathname)) return true;
  return NEVER_CACHE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 只处理同源 GET
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (shouldNeverCache(url)) return;

  // 1) HTML 导航：网络优先 → 失败回退缓存
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          // 仅缓存成功响应
          if (fresh && fresh.ok) {
            const cache = await caches.open(CACHE_PAGES);
            cache.put('/index.html', fresh.clone());
          }
          return fresh;
        } catch (err) {
          const cached = await caches.match('/index.html');
          return cached || caches.match('/');
        }
      })(),
    );
    return;
  }

  // 2) 静态资源：stale-while-revalidate
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_RUNTIME);
      const cached = await cache.match(request);
      const networkPromise = fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === 'basic') {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        // 后台刷新，不阻塞当前渲染
        event.waitUntil(networkPromise);
        return cached;
      }
      const fresh = await networkPromise;
      if (fresh) return fresh;
      // 真离线且无缓存：HTML 请求兜底，其他返回 503
      if (request.headers.get('accept')?.includes('text/html')) {
        return (await caches.match('/index.html')) || Response.error();
      }
      return Response.error();
    })(),
  );
});
