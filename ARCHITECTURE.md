# 玩具屋大黑洞 — 專案架構與開發規範

這份文件說明專案怎麼組織、改東西要動哪裡、以及命名與慣例。
**日後版本更新請遵循本規範**,才能維持「加素材/加規則都很快」的狀態。

---

## 1. 檔案結構

```
index.html          遊戲頁面:HTML 骨架 + CSS + 掛載 game.js + 掛 PWA
game.js             ★ 引擎層:玩法邏輯、成長、AI、鏡頭、輸入、音效、HUD
data.js             ★ 資料層:有哪些模型、放哪、多大、叫什麼
manifest.json       PWA 身分證:App 名稱、圖示、全螢幕(可加到主畫面)
sw.js               PWA Service Worker:離線快取(核心預存、模型用到才存)
icons/icon.png      App 圖示(512+ 方圖;來源在 object/)
table.html          第一版「餐桌大胃王」(獨立保留,和主遊戲無關)
foods.json          table.html 專用的舊食物清單
models/             3D 模型(.glb),依素材包分子資料夾
  <folder>/Textures/  各素材包共用貼圖
lib/                Three.js 引擎與 GLTFLoader(本地,不依賴 CDN)
object/             素材來源存放(.gitkeep 佔位;zip 不進版控)
SETUP.md            給非工程師的上架/使用說明
ARCHITECTURE.md     本文件
```

---

## 2. 核心原則:引擎與資料分離

| 層 | 檔案 | 放什麼 | 什麼時候改 |
|----|------|--------|-----------|
| **資料層** | `data.js` | 素材清單、中文名、縮放、資料夾對應 | 加/換素材、改名、改單一類別縮放 |
| **引擎層** | `game.js` | 遊戲怎麼運作(規則、物理、AI、鏡頭…) | 改玩法、加行為、加模式、調數值 |

> **鐵則:加素材只改 data.js,不准動 game.js 的邏輯。**
> 若加素材時發現「非改 game.js 不可」,代表需要的是「新行為」(見 §4),
> 那就在 game.js 加行為、在 data.js 用 `cat` 掛上去,而不是把資料寫死進引擎。

資料如何流進引擎:

```
data.js  ──(import)──►  game.js
  PACK_META  →  POOLS[cat] / CAT_SCALE / pathOf / nameOf / allEntries
                    │
   loadModels() 用 allEntries() 逐一載入 → 建立 templates(Map: key → 範本)
                    │
   buildWorld() / scatter() / spawnObj() 從 POOLS 取 key 生成場上物件
```

---

## 3. 資料層規範(data.js)

### 3.1 中繼表 `PACK_META`

一列 = 一個素材類別:

```js
{ cat:'代號', folder:'資料夾', scale:縮放, list:[檔名陣列] }
```

- `cat`：內部代號,**同時是這批東西的「散佈池」與「行為」識別**。
  引擎透過 `POOLS[cat]` 取得該類全部 key。
- `folder`：`models/` 下的子資料夾(`''` = 根目錄)。
- `scale`：整批縮放(校準各 Kenney 包不一的單位到遊戲尺度)。
- `list`：檔名陣列(不含 `.glb`)。

由中繼表**自動衍生**(通常不必手動維護):
`CAT_SCALE`、`POOLS`、`pathOf(key)`、`nameOf(key)`、`allEntries()`、`catOf(key)`。

### 3.2 引擎目前認得的特殊 `cat` 行為

大多數 `cat` 都當「普通可吃物件」。以下 cat 有特別行為(定義在 game.js):

| cat | 特別行為 |
|-----|---------|
| `coin` | 吃到有額外加分、播金幣音效 |
| `rug` | 視為平面,不佔位(不參與防重疊) |
| `brick` | 生成時隨機上鮮豔顏色 |

> 想新增「會動」「會加時間」等行為 → 見 §4。

### 3.3 新增一個素材包(標準流程)

1. `.glb` 放進 `models/<folder>/`,共用貼圖放 `models/<folder>/Textures/`。
2. 在 data.js 新增檔名陣列。
3. 在 `PACK_META` 加一列 `{ cat, folder, scale, list }`。
4. (可選)到 `NAMES` 補中文名;沒補的會由 `nameOf()` 規則自動命名。
5. 若檔名和別包撞名,在 `FILE_OVERRIDE` 指定實際檔名。

完成後:載入、路徑、名稱、隨機散佈、「每種模型至少出現一個」全部自動套用。

### 3.4 命名慣例

- 檔名/key 一律用 Kenney 原始檔名(kebab-case 或 camelCase 都可,照原檔)。
- `cat` 用小寫、語意化(`food`/`train`/`arcade`…)。
- 中文名放 `NAMES`,結算畫面「最大戰利品」會用到。

---

## 4. 引擎層規範(game.js)

### 4.1 檔案分區(用 `// ===` 分隔線標示,請維持順序)

```
設定 CFG / 尺寸換算(radiusOf, xpGain, speedOf)
→ import 資料層
→ 全域狀態
→ 音效(WebAudio 合成)
→ 初始化 init / 模式選擇
→ 場景(地板 shader 挖洞、牆、外圍)
→ 模型載入 loadModels
→ 物件生成 spawnObj / scatter / buildWorld
→ 洞 makeHole / 視覺
→ 輸入(浮動搖桿)
→ Bot AI
→ 洞更新 / 吞噬 eatCheck / updateFalling / award
→ 移動物件(車/火車)
→ 無限模式成長 updateEndlessGrowth
→ 重生 processRespawns
→ HUD
→ 主迴圈 stepGame / animate / updateCamera
→ 結束 endGame
```

### 4.2 關鍵資料結構

**範本 `templates`**(Map: `key` → 範本,載入時建立一次):
```
{ obj, radius, eff, height, cat, key }
  radius = 底面外接半徑(佔位用)
  eff    = 有效吃食半徑 = max(底面幾何均值, 高度*0.45)  ← 長條物才不會被高估
```

**場上物件 `objects[]`**(每個 = 一個實體):
```
{ key, cat, mesh, jit,           // jit=生成時縮放
  r, fr, h,                      // r=吃食半徑(eff*jit), fr=佔位半徑, h=高
  x, z, state, vy, spin,         // state: idle|falling|pop|gone
  mobile, rail, dir, speed }     // 會移動的車/火車
```

**洞 `holes[]`**(`holes[0]` 一定是玩家 `player`):
```
{ name, color, isBot, x, z, vx, vz,
  xp, r, rShow, score, eaten, biggest, biggestR,
  alive, dyingT, respawnAt, grp, label, target… }
  r     = 邏輯半徑(由 xp 換算)
  rShow = 顯示半徑(平滑追 r,做出成長彈性)
```

### 4.3 吃食判定的三個門檻(都以「洞半徑 r」為基準)

- `EAT_GATE`：物件 `r < 洞r*EAT_GATE` 才吃得下(否則太大)。
- `EAT_DIST`：物件中心進入 `洞r*EAT_DIST` → 開始掉落被吃。
- `SUCTION_DIST`：`洞r*SUCTION_DIST` 內的可吃物會被吸過來。
- **太大吃不下的物件**:會被推到洞緣(軟碰撞),避免懸在挖空的地板上方。

### 4.4 兩種模式

- `MODE = 'battle'`:2 分鐘倒數、有 2 個 bot + 排行榜、洞上限 `MAX_RADIUS_BATTLE`。
- `MODE = 'endless'`:正數計時、單人、洞上限 `MAX_RADIUS_ENDLESS`,
  物品/地圖隨洞成長(**有界**,避免暴衝破圖)。
- 模式在開場選單決定;`?mode=battle` / `?mode=endless` 可直接進。
- bot 只在 battle 建立(`createBots()`);endless 收起排行榜。

### 4.5 無限模式的「有界成長」(重要)

早期版本因為「洞越大→物品越大→算分用放大後尺寸→洞暴衝」而破圖。**現行規範**:

- 單顆給的 xp 用**範本原始尺寸**計算並設上限 `ENDLESS_XP_CAP`(斬斷滾雪球)。
- 不做「既有物品就地無限放大」;改由**新生成物品的尺寸綁在目前洞半徑附近且有界**
  (`endlessSizeMult`)來呈現「物品變大」。
- 地圖放大有上限 `ENDLESS_MAP_MAX`。
- **調整無限模式難度/節奏,一律改 CFG 這幾個值,不要重新引入無界成長。**

### 4.6 常見修改指引

| 想做的事 | 改哪裡 |
|----------|--------|
| 加/換素材 | `data.js`(§3.3) |
| 調對戰時間、速度、洞上限、成長曲線 | `game.js` 的 `CFG` 與 `radiusOf` |
| 調某類物件大小 | `data.js` 的 `PACK_META.scale` |
| 加新的「行為」(如會加時間的道具) | `game.js`:在 `award()`/`spawnObj()` 依 `o.cat` 加分支,再到 data.js 用該 cat 掛素材 |
| 加第三種遊戲模式 | `game.js`:`setupModeSelect` 加按鈕與 `start()` 分支;`index.html` 加對應 UI |

### 4.7 編碼慣例

- 純前端、原生 ES modules,不引入打包工具或框架。
- 縮排 2 空格;分區用 `// ====...` 註解;函式盡量小而單一職責。
- 座標系:`x`/`z` 為地面平面,`y` 為高度(洞往 `-y` 挖)。
- 尺寸相關的判定一律以「洞半徑」為基準做相對運算,別寫死絕對值。
- 不加霧(fog):早期霧 + 鏡頭拉遠造成過白屏,已移除,請勿再加。

---

## 5. 版本快取慣例(★ 已改自動更新,平常不用碰版本)

**現行:全自動更新。** `sw.js` 對「會改的檔案」(HTML / game.js / data.js / manifest / 圖示)
採**網路優先**:每次連線都拿最新的,拿不到才用快取(離線可玩)。
註冊時 `updateViaCache:'none'` 讓瀏覽器每次都重抓 `sw.js`,新版秒生效。

所以**一般改動(改玩法、換素材、換圖示)只要 `commit → push`,玩家重開即最新版**,
不必再手動改 `game.js?v=N` 或 `CACHE_VER`。`index.html` 已改為不帶版本參數的 `./game.js`。

### 什麼時候才動 `CACHE_VER`(sw.js 最上方)

只有想「**強制清掉所有人手機上的舊快取,連模型 `.glb` 都重抓**」時才 +1
(例如換了大量模型、或懷疑某人卡在壞掉的舊快取)。平常不用碰。

## 5.1 PWA / 離線(manifest.json + sw.js)

- `manifest.json`:App 名稱、圖示(`icons/icon.png`)、`display:standalone`(全螢幕、可加到主畫面)。
- `sw.js` 的快取分兩種策略:
  - **網路優先**(會改的檔案):HTML / game.js / data.js / manifest / **圖示**。
    永遠拿最新,離線才回退快取。新增這類核心檔案時,補進 `CORE_ASSETS`(離線墊底用)。
  - **快取優先**(幾乎不變的大檔):模型 `.glb`、貼圖、`lib/` 載入器「用到才存、存了就留」,
    省流量、載入快。
- 圖示來源放 `object/`,實際使用的是 `icons/icon.png`。**換圖 SOP:把新圖存成 `icons/icon.png`
  覆蓋 → `commit → push`**(不必動版本)。圖建議方圖、主體飽滿、勿透明底/圓角。
- 本機測 PWA 要用 `http://localhost`(SW 只在 localhost 或 HTTPS 生效);GitHub Pages 是 HTTPS,線上自動生效。

---

## 6. 驗證與上線流程

1. 本機起簡易伺服器(ES modules 不能直接雙擊):
   `python -m http.server 8000` → 開 `http://localhost:8000`,或 VSCode Live Server。
2. **兩種模式各玩一次**確認正常(載入、成長、吃食、結算)。
3. 更新 `game.js?v=N`。
4. `git add -A && git commit`(訊息說明這次改了什麼)。
5. `git push` 到 GitHub → Settings → Pages 部署(main / root)。

---

## 7. 授權

所有 3D 模型來自 Kenney,CC0(公共領域,可商用、免標註)。來源:kenney.nl
