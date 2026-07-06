// ============================================================
// Service Worker — 玩具屋大黑洞 離線快取
// ------------------------------------------------------------
// 快取策略:
//   核心程式(HTML/JS/Three.js/圖示/manifest)→ 預先快取(install 時全抓)
//     保證「開得起來」,離線也能進遊戲。
//   模型 .glb / 貼圖 → runtime 快取(用到才存、存了就留)
//     玩過一次的素材離線可用,不必第一次就狂塞一堆大檔。
//
// ★ 改版規範:每次改完 game.js / data.js 要上線,
//   把 CACHE_VER +1(和 index.html 的 game.js?v=N 一起 +1)。
//   舊快取會在新版啟用時自動清掉,手機才不會吃到舊版。
// ============================================================

const CACHE_VER  = 5;                       // ← 和 index.html 的 game.js?v=N 同步
const CORE_CACHE = `khole-core-v${CACHE_VER}`;
const RUN_CACHE  = `khole-runtime-v${CACHE_VER}`;

// 核心資源:離線也一定要能開遊戲的最小集合
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  `./game.js?v=${CACHE_VER}`,
  './data.js',
  './lib/three.module.js',
  './icons/icon.png',
];

// ---- 安裝:預先抓核心資源 ----
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CORE_CACHE)
      .then((c) => c.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())       // 新 SW 裝好就搶著接手
  );
});

// ---- 啟用:清掉舊版快取 ----
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CORE_CACHE && k !== RUN_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ---- 攔截請求 ----
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;         // 只管 GET

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;  // 只管同源

  // 模型 / 貼圖 / lib 內的載入器 → 快取優先,沒有才連線並存起來(runtime)
  const isAsset = /\.(glb|png|jpg|jpeg|webp|bin|hdr)$/i.test(url.pathname)
    || url.pathname.includes('/models/')
    || url.pathname.includes('/lib/');

  if (isAsset) {
    e.respondWith(
      caches.match(req).then((hit) =>
        hit ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(RUN_CACHE).then((c) => c.put(req, copy));
          return res;
        }).catch(() => hit)                 // 離線又沒存過 → 只能放棄該檔
      )
    );
    return;
  }

  // 其餘(HTML / 核心 JS 等)→ 網路優先,失敗回退快取(離線可玩)
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CORE_CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
