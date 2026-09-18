// RUNLOG Service Worker - 離線優先策略
const CACHE_NAME = 'runlog-v4.25';
const CORE_ASSETS = [
  './',
  './v4.25waiting.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800&family=Barlow:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&family=Noto+Sans+TC:wght@400;500;700;900&display=swap'
];

// 安裝時快取核心檔案
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

// 啟用時清理舊快取
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 攔截請求：HTML 走網路優先，其他走快取優先
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // 只處理同來源 + Google Fonts
  const isOwn = url.origin === location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!isOwn && !isFont) return;

  // 不攔截 Firebase 動態請求
  if (url.hostname.includes('firestore') || url.hostname.includes('firebase')) return;

  if (e.request.mode === 'navigate') {
    // HTML：網路優先，失敗用快取（這樣才能拿到最新版本）
    e.respondWith(
      fetch(e.request).catch(() => caches.match('./v4.25waiting.html'))
    );
    return;
  }

  // 其他資源：快取優先
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// 監聽 message：可從頁面觸發更新
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});