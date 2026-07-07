// ============================================================
// Service Worker — 玩具屋大黑洞 離線快取(全自動更新版)
// ------------------------------------------------------------
// 策略總覽(★ 平常不用碰版本號):
//   會改的檔案(HTML / game.js / data.js / manifest / 圖示)
//      → 「網路優先」:每次連線都拿最新的,拿不到才用快取(離線可玩)。
//        所以你改完 commit→push,手機重開就是新版,不必手動 +1。
//   幾乎不變的大檔(模型 .glb / 貼圖 / lib 載入器)
//      → 「快取優先」:存過就直接用,省流量、載入快。
//
// CACHE_VER 的角色退化為「核彈按鈕」:
//   平常都不用動;只有想「強制清掉所有人手機上的舊快取(含模型)」時才 +1。
// ============================================================

const CACHE_VER  = 6;                       // 平常不用動;要強制全清才 +1
const CORE_CACHE = `khole-core-v${CACHE_VER}`;
const RUN_CACHE  = `khole-runtime-v${CACHE_VER}`;

// 離線也一定要能開遊戲的最小集合(install 時先抓一份墊底,之後靠網路優先保持最新)
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './game.js',
  './data.js',
  './lib/three.module.js',
  './icons/icon.png',
];

// ---- 安裝:預先抓核心資源當離線墊底 ----
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CORE_CACHE)
      // 個別抓,單一檔失敗不整批爆掉
      .then((c) => Promise.allSettled(CORE_ASSETS.map((u) => c.add(u))))
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

  // 「快取優先」只給幾乎不變的大檔:模型 .glb、貼圖、lib 內的載入器。
  // 注意:圖示 icons/icon.png 故意不走這裡 → 讓它跟著網路優先自動更新。
  const isBigAsset =
    /\.(glb|bin|hdr)$/i.test(url.pathname)
    || url.pathname.includes('/models/')
    || url.pathname.includes('/lib/');

  if (isBigAsset) {
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

  // 其餘(HTML / game.js / data.js / manifest / 圖示…)→ 網路優先,
  // 抓到就順手更新快取;離線失敗才回退快取(仍可玩)。
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CORE_CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || caches.match('./index.html'))
      )
  );
});
