# 玩具屋大黑洞 — 上架與使用說明

hole.io 風格的「黑洞吃東西」網頁遊戲(原創實作,素材為 Kenney CC0)。
純網頁、免 App Store、免費。手機/平板直接玩。

## 玩法

- 按住畫面任意處拖曳(浮動搖桿),操控黑洞在玩具屋裡移動;電腦可用 WASD/方向鍵
- 吃得下的東西會被吸進洞裡:先吃食物、金幣、積木,洞變大後吃椅子、沙發、床、火車
- 場上有兩個 AI 對手(小藍、小綠)搶食物;洞比對方大很多時可以直接吞掉對方!
- 被吞掉會扣分並在 3 秒後重生

### 兩種模式(開場選擇)

- **⚔️ 對戰模式**:2 分鐘結算,看誰分數最高
- **♾️ 無限模式**:沒有時限;物品會跟著你的洞一起長大、地圖也會越變越大,
  想結束時按畫面上方的 🏁。用網址參數可直接進指定模式:`?mode=battle` / `?mode=endless`

## 一、本機測試(可選)

因為用到 ES modules,不能直接雙擊 index.html,要用簡易伺服器:

- 有 Python:在專案資料夾開終端機 `python -m http.server 8000`,瀏覽器開 `http://localhost:8000`
- 或 VSCode 的 Live Server 擴充套件:右鍵 index.html → Open with Live Server

## 二、部署到 GitHub Pages

1. 到 github.com 建新 repository,設為 **Public**,例如 `hole-game`
2. 上傳這個資料夾的**所有檔案**(保持資料夾結構:index.html 在最外層,models/、lib/ 原樣)
   - 網頁操作:進倉庫 → Add file → Upload files → 拖進去 → Commit
3. 倉庫 **Settings → Pages** → Source 選 **Deploy from a branch** → Branch 選 **main** / **(root)** → Save
4. 等 1~2 分鐘,出現網址 `https://你的帳號.github.io/hole-game/`
5. 網址傳到手機 → Safari/Chrome 開啟即玩
6. Safari「分享 → 加入主畫面」可變成全螢幕 App 圖示

> 已部署過的話:重新上傳覆蓋檔案即可,等 1~2 分鐘自動更新。
> 若手機看到舊版,重新整理或清快取(index.html 內的 `game.js?v=1` 改成 `?v=2` 可強制更新)。

## 三、專案結構

```
index.html          遊戲頁面(UI / 樣式)
game.js             遊戲引擎(玩法邏輯、成長、AI、鏡頭…)
data.js             ★ 素材資料庫(有哪些模型、放哪、多大、叫什麼)
table.html          第一版「餐桌大胃王」小遊戲(保留,可直接開)
foods.json          第一版的食物清單(table.html 用)
models/             35 個食物模型(Kenney Food Kit)
  furniture/        140 個家具模型(Kenney Furniture Kit 全集)
  toys/             21 個玩具模型(Kenney Toy Car Kit)
  trains/           45 個火車/鐵軌模型(Kenney Train Kit)
  arcade/           20 個遊戲廳模型(Kenney Mini Arcade)
  bricks/           37 個積木模型(Kenney Brick Kit,遊戲內隨機上色)
  Textures/         食物模型共用貼圖(各子資料夾另有共用貼圖)
lib/                Three.js 引擎與 GLTF 載入器(本地,不依賴 CDN)
object/             素材來源存放處(可留可刪,不影響遊戲)
```

> 程式碼分工:**要調玩法改 [game.js]、要加/換素材改 [data.js]**,兩者分離,互不干擾。

## 四、新增素材包(最常做的事)

只改 `data.js` 一個檔,四步驟:

1. 把新的 `.glb` 放進 `models/<你的資料夾>/`,共用貼圖放 `models/<你的資料夾>/Textures/`
2. 在 data.js 加一個清單陣列,列出檔名(不含 .glb)
3. 在 `PACK_META` 加一列:`{ cat:'代號', folder:'資料夾', scale:縮放, list:你的陣列 }`
4. (可選)到 `NAMES` 補中文名

完成——載入、路徑、名稱、隨機散佈、「每種至少出現一個」全部自動套用,不必動 game.js。
data.js 檔案最上方有更詳細的中文說明。

## 五、調整玩法

game.js 最上方的 `CFG` 區塊:

- `GAME_SECONDS` 對戰模式一場秒數
- `START_RADIUS` / `MAX_RADIUS_BATTLE` / `MAX_RADIUS_ENDLESS` 洞的起始/兩模式最大尺寸
- `BASE_SPEED` 移動速度
- `EAT_GATE` 吃得下的門檻(越小越難吃大東西)
- `ENDLESS_XP_CAP` 無限模式單顆物品給的 xp 上限(防止暴衝)
- `ENDLESS_MAP_MAX` 無限模式地圖最大放大倍數
- 各類縮放在 data.js 的 `PACK_META`(scale 欄)

## 六、素材授權

所有 3D 模型來自 Kenney(Food Kit / Furniture Kit / Toy Car Kit / Train Kit / Mini Arcade / Brick Kit),
CC0 授權(公共領域,可商用、免標註)。來源:kenney.nl

> 註:積木包的 8 種樣式變體只收錄一套(37 種形狀全都有,遊戲內隨機上色);
> 火車包與玩具車包的「軌道鋪路模組」(彎道/坡道等數十種變體)非物品類,未放入。
> 專案總大小約 22 MB,手機第一次載入需要一點時間,之後有快取就快了。
