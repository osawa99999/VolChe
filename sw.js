/* ============================================================
   VolChe Service Worker  v1.1.0
   完全オフライン対応版

   キャッシュ戦略:
   - VolChe本体・manifest → Cache First（確実にオフライン動作）
   - CDN(unpkg/fonts)     → Stale While Revalidate
                            （キャッシュあれば即返す＋裏でアップデート）
   - それ以外             → Network First（通常通り）

   ★ 初回オンラインで開くだけで全リソースがキャッシュされる
   ★ 2回目以降はオフラインでも完全動作
   ============================================================ */

const CACHE_NAME = 'volche-v1.6010';
const CACHE_CDN  = 'volche-cdn-v1.6010';

// ── 必ずキャッシュするファイル（VolChe本体）
const PRECACHE_URLS = [
  './',
  './VolChe_v1_6010.html',
  './manifest.json',
];

// ── CDNホスト判定（Stale While Revalidate 対象）
const CDN_HOSTS = [
  'unpkg.com',
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];
const isCDN = (url) => CDN_HOSTS.some(h => url.includes(h));

// ─── インストール: 本体を事前キャッシュ
self.addEventListener('install', event => {
  console.log('[SW] install:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ─── アクティベート: 古いキャッシュを削除
self.addEventListener('activate', event => {
  console.log('[SW] activate:', CACHE_NAME);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== CACHE_CDN)
          .map(k => { console.log('[SW] 削除:', k); return caches.delete(k); })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── フェッチ
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  if (!url.startsWith('http')) return;

  if (isCDN(url)) {
    // CDN: Stale While Revalidate
    event.respondWith(staleWhileRevalidate(event.request, CACHE_CDN));
  } else {
    // VolChe本体・その他: Cache First
    event.respondWith(cacheFirst(event.request, CACHE_NAME));
  }
});

// ── Cache First
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    console.warn('[SW] オフライン & キャッシュなし:', request.url);
  }
}

// ── Stale While Revalidate
async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  // 裏でネットワーク取得してキャッシュ更新（失敗しても無視）
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  // キャッシュがあれば即返す、なければネットワーク待ち
  return cached || fetchPromise;
}
