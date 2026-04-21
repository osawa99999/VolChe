/* ============================================================
   VolChe Service Worker  v1.2.0

   キャッシュ戦略: Cache First（全リソース）
   ★ 更新は「最新版を確認する」ボタンから手動で行う設計
   ★ バージョンアップ時は CACHE_NAME を変えるだけでOK
   ============================================================ */

const CACHE_NAME = 'volche-v1.6011';

// ── インストール: 本体を事前キャッシュ ──────────────────────
self.addEventListener('install', event => {
    console.log('[SW] install:', CACHE_NAME);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll([
                './',
                './index.html',
                './manifest.json',
            ]))
            .then(() => self.skipWaiting())
    );
});

// ── アクティベート: 古いキャッシュを削除 ────────────────────
self.addEventListener('activate', event => {
    console.log('[SW] activate:', CACHE_NAME);
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_NAME)
                    .map(k => { console.log('[SW] 古いキャッシュ削除:', k); return caches.delete(k); })
            ))
            .then(() => self.clients.claim())
    );
});

// ── フェッチ: Cache First ────────────────────────────────────
// キャッシュになければネットワークから取得してキャッシュに追加
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith('http')) return;

    // no-store リクエスト（更新チェック用）はキャッシュをスキップ
    if (event.request.cache === 'no-store') return;

    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;

            return fetch(event.request).then(response => {
                if (!response || response.status !== 200) return response;
                const toCache = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
                return response;
            }).catch(() => {
                console.warn('[SW] オフライン & キャッシュなし:', event.request.url);
            });
        })
    );
});
