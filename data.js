// ============================================================================
//  素材資料庫 — 所有「有哪些模型、放哪、多大、叫什麼」都集中在這裡
// ============================================================================
//
//  ▓ 如何新增一個素材包(例如又下載了 kenney_xxx):
//    1) 把 .glb 放進  models/<資料夾>/ ,共用貼圖放  models/<資料夾>/Textures/
//    2) 在下面加一個「清單陣列」列出檔名(不含 .glb)
//    3) 在 PACK_META 加一列: { cat:'代號', folder:'資料夾', scale:縮放, list: 你的陣列 }
//       - cat  : 這批東西的內部代號,同時決定它在遊戲裡的「散佈池 / 行為」
//                目前引擎認得的行為: coin(硬幣加分)、rug(平的不佔位)、brick(隨機上色)
//                其餘一律當一般可吃物件。想要新行為再到 game.js 加。
//       - scale: 整批的縮放倍率(Kenney 各包單位不一,用這個校準到遊戲尺度)
//    4) (可選) 到 NAMES 補中文名;沒補的話會用 nameOf() 的規則自動命名。
//    5) 若某檔名跟別包撞名,在 FILE_OVERRIDE 指定實際檔名。
//
//  完成後:載入、路徑、名稱、隨機散佈、「每種至少出現一個」全部自動套用,
//  不需要改動 game.js 的引擎邏輯。
//
//  ▓ cat 與散佈池:game.js 透過 POOLS[cat] 取得該類所有 key。
//    尺寸分級(small/med/large/huge)只是散佈與擺放用的分類,可自由增減。
// ============================================================================

// ---- 各素材包清單(檔名,不含副檔名)-------------------------------------
const FOODS = ['maki-salmon','rice-ball','cookie-chocolate','egg','mushroom','cookie','donut','candy-bar','strawberry','cherries','tomato','carrot','banana','apple','ice-cream','burger-cheese','sandwich','sausage','cupcake','donut-sprinkles','pancakes','avocado','paprika','pear','orange','lollypop','burger','pizza','cake-birthday','cake','pineapple','cauliflower','watermelon','turkey','bread'];

const FURN_SMALL = ['bear','books','pillow','pillowBlue','pillowLong','pillowBlueLong','plantSmall1','plantSmall2','plantSmall3','pottedPlant','laptop','computerKeyboard','computerMouse','computerScreen','radio','speakerSmall','toaster','kitchenBlender','kitchenMicrowave','kitchenCoffeeMachine','trashcan','lampRoundTable','lampSquareTable','lampSquareCeiling','lampWall','ceilingFan','coatRack','cabinetBed','cabinetBedDrawer','cabinetBedDrawerTable','bathroomMirror','bathroomCabinet','kitchenBarEnd','kitchenCabinetUpperCorner'];
const FURN_MED = ['stoolBar','stoolBarSquare','chair','chairCushion','chairDesk','chairModernCushion','chairModernFrameCushion','chairRounded','coatRackStanding','sideTable','sideTableDrawers','tableCoffee','tableCoffeeGlass','tableCoffeeGlassSquare','tableCoffeeSquare','televisionModern','televisionVintage','televisionAntenna','speaker','lampRoundFloor','lampSquareFloor','cardboardBoxClosed','cardboardBoxOpen','bench','benchCushion','benchCushionLow','bookcaseOpenLow','toiletSquare','washerDryerStacked','bathroomCabinetDrawer','bathroomSinkSquare','kitchenCabinetUpper','kitchenCabinetUpperDouble','kitchenCabinetUpperLow','hoodLarge','hoodModern','paneling','doorway','doorwayFront','doorwayOpen','floorCorner','floorCornerRound','floorFull','floorHalf'];
const FURN_LARGE = ['tableRound','table','tableCloth','tableGlass','tableCross','tableCrossCloth','desk','deskCorner','bookcaseOpen','bookcaseClosed','bookcaseClosedWide','bookcaseClosedDoors','cabinetTelevision','cabinetTelevisionDoors','loungeChair','loungeChairRelax','loungeDesignChair','loungeSofa','bathtub','toilet','bathroomSink','washer','dryer','kitchenFridgeSmall','kitchenFridgeLarge','kitchenFridgeBuiltIn','kitchenStove','kitchenStoveElectric','kitchenSink','kitchenCabinet','kitchenCabinetDrawer','kitchenCabinetCornerRound','kitchenCabinetCornerInner','bedSingle','kitchenBar','shower','showerRound','wall','wallHalf','wallCorner','wallCornerRond','wallDoorway','wallDoorwayWide','wallWindow','wallWindowSlide'];
const FURN_HUGE = ['loungeDesignSofa','loungeDesignSofaCorner','loungeSofaLong','loungeSofaCorner','loungeSofaOttoman','bedDouble','bedBunk','kitchenFridge','stairs','stairsCorner','stairsOpen','stairsOpenSingle'];
const RUGS = ['rugRound','rugRectangle','rugDoormat','rugSquare','rugRounded'];

const VEHICLES = ['vehicle-drag-racer','vehicle-monster-truck','vehicle-racer','vehicle-racer-low','vehicle-speedster','vehicle-suv','vehicle-truck','vehicle-vintage-racer'];
const COINS = ['item-coin-bronze','item-coin-silver','item-coin-gold'];
const PROPS = ['item-box','item-cone','item-banana','wheel-small','wheel-medium','smoke','gate','gate-finish'];
const TREES = ['tree','tree-pine'];

const TRAINS = ['train-locomotive-a','train-locomotive-b','train-locomotive-c','train-locomotive-passenger-a','train-locomotive-passenger-b','train-diesel-a','train-diesel-b','train-diesel-c','train-diesel-box-a','train-diesel-box-b','train-diesel-box-c','train-electric-bullet-a','train-electric-bullet-b','train-electric-bullet-c','train-electric-city-a','train-electric-city-b','train-electric-city-c','train-electric-double-a','train-electric-double-b','train-electric-double-c','train-electric-square-a','train-electric-square-b','train-electric-square-c','train-electric-subway-a','train-electric-subway-b','train-electric-subway-c','train-tram-classic','train-tram-modern','train-tram-round','train-carriage-box','train-carriage-coal','train-carriage-container-blue','train-carriage-container-green','train-carriage-container-red','train-carriage-dirt','train-carriage-flatbed','train-carriage-flatbed-wood','train-carriage-lumber','train-carriage-tank','train-carriage-tank-large','train-carriage-wood','train-connector','railroad-straight','railroad-rail-straight','track-single'];
const ARCADE = ['arcade-machine','air-hockey','basketball-game','cash-register','claw-machine','column','dance-machine','floor','gambling-machine','pinball','prize-wheel','prizes','ticket-machine','vending-machine','wall-arc','wall-corner-arc','wall-door-rotate','wall-window-arc'];
const PEOPLE = ['character-employee','character-gamer'];
const BRICKS = ['bevel-hq-brick-1x1','bevel-hq-brick-1x1-round','bevel-hq-brick-1x2','bevel-hq-brick-1x4','bevel-hq-brick-1x6','bevel-hq-brick-1x8','bevel-hq-brick-2x2','bevel-hq-brick-2x4','bevel-hq-brick-2x6','bevel-hq-brick-2x8','bevel-hq-brick-corner','bevel-hq-brick-slope-1x2','bevel-hq-brick-slope-2x2','bevel-hq-brick-slope-2x3','bevel-hq-brick-slope-2x4','bevel-hq-brick-slope-3x1','bevel-hq-brick-slope-3x2','bevel-hq-brick-slope-corner-inside-2x2','bevel-hq-brick-slope-corner-inside-inverted-2x2','bevel-hq-brick-slope-corner-outside-2x2','bevel-hq-brick-slope-corner-outside-inverted-2x2','bevel-hq-brick-slope-inverted-1x2','bevel-hq-brick-slope-inverted-2x2','bevel-hq-plate-1x1','bevel-hq-plate-1x1-round','bevel-hq-plate-1x2','bevel-hq-plate-1x4','bevel-hq-plate-1x6','bevel-hq-plate-1x8','bevel-hq-plate-2x2','bevel-hq-plate-2x4','bevel-hq-plate-2x6','bevel-hq-plate-2x8','bevel-hq-plate-4x4','bevel-hq-plate-4x6','bevel-hq-plate-4x8','bevel-hq-plate-corner'];

// ---- 中繼表:一列 = 一個素材類別 ------------------------------------------
//  cat / 資料夾(models 下的子資料夾,'' 代表根目錄) / 縮放 / 清單
export const PACK_META = [
  { cat:'food',    folder:'',          scale:1.6, list:FOODS },
  { cat:'small',   folder:'furniture', scale:2.0, list:FURN_SMALL },
  { cat:'med',     folder:'furniture', scale:2.2, list:FURN_MED },
  { cat:'large',   folder:'furniture', scale:2.6, list:FURN_LARGE },
  { cat:'huge',    folder:'furniture', scale:3.2, list:FURN_HUGE },
  { cat:'rug',     folder:'furniture', scale:2.6, list:RUGS },
  { cat:'vehicle', folder:'toys',      scale:1.6, list:VEHICLES },
  { cat:'coin',    folder:'toys',      scale:1.5, list:COINS },
  { cat:'prop',    folder:'toys',      scale:1.5, list:PROPS },
  { cat:'tree',    folder:'toys',      scale:2.0, list:TREES },
  { cat:'train',   folder:'trains',    scale:1.4, list:TRAINS },
  { cat:'arcade',  folder:'arcade',    scale:2.2, list:ARCADE },
  { cat:'people',  folder:'arcade',    scale:1.8, list:PEOPLE },
  { cat:'brick',   folder:'bricks',    scale:2.0, list:BRICKS },
];

// 檔名覆蓋(key 與實際 .glb 檔名不同時;例如避免與別包撞名)
const FILE_OVERRIDE = { 'wall-arc':'wall', 'wall-corner-arc':'wall-corner', 'wall-window-arc':'wall-window' };

// ---- 中文名稱(沒列到的會用 nameOf 規則自動命名)---------------------------
export const NAMES = {
  'maki-salmon':'鮭魚壽司','rice-ball':'飯糰','cookie-chocolate':'巧克力餅乾','egg':'水煮蛋','mushroom':'蘑菇','cookie':'餅乾','donut':'甜甜圈','candy-bar':'巧克力棒','strawberry':'草莓','cherries':'櫻桃','tomato':'番茄','carrot':'紅蘿蔔','banana':'香蕉','apple':'蘋果','ice-cream':'冰淇淋','burger-cheese':'起司漢堡','sandwich':'三明治','sausage':'香腸','cupcake':'杯子蛋糕','donut-sprinkles':'彩糖甜甜圈','pancakes':'鬆餅','avocado':'酪梨','paprika':'甜椒','pear':'西洋梨','orange':'柳橙','lollypop':'棒棒糖','burger':'漢堡','pizza':'披薩','cake-birthday':'生日蛋糕','cake':'蛋糕','pineapple':'鳳梨','cauliflower':'花椰菜','watermelon':'西瓜','turkey':'烤火雞','bread':'麵包',
  bear:'泰迪熊',books:'一疊書',pillow:'枕頭',pillowBlue:'藍枕頭',pillowLong:'長枕頭',pillowBlueLong:'藍長枕頭',plantSmall1:'小盆栽',plantSmall2:'小盆栽',plantSmall3:'小盆栽',pottedPlant:'盆栽',laptop:'筆電',computerKeyboard:'鍵盤',computerMouse:'滑鼠',computerScreen:'螢幕',radio:'收音機',speakerSmall:'小音響',speaker:'音響',toaster:'烤麵包機',kitchenBlender:'果汁機',kitchenMicrowave:'微波爐',kitchenCoffeeMachine:'咖啡機',trashcan:'垃圾桶',lampRoundTable:'檯燈',lampSquareTable:'檯燈',lampRoundFloor:'立燈',lampSquareFloor:'立燈',lampSquareCeiling:'吊燈',lampWall:'壁燈',ceilingFan:'吊扇',coatRack:'掛衣架',cabinetBed:'床頭櫃',cabinetBedDrawer:'床頭櫃',cabinetBedDrawerTable:'床頭櫃',bathroomMirror:'浴室鏡',bathroomCabinet:'浴櫃',kitchenBarEnd:'吧台端',kitchenCabinetUpperCorner:'吊櫃',
  stoolBar:'吧台椅',stoolBarSquare:'吧台椅',chair:'椅子',chairCushion:'軟墊椅',chairDesk:'辦公椅',chairModernCushion:'餐椅',chairModernFrameCushion:'餐椅',chairRounded:'圓背椅',coatRackStanding:'衣帽架',sideTable:'邊桌',sideTableDrawers:'邊櫃',tableCoffee:'咖啡桌',tableCoffeeGlass:'玻璃茶几',tableCoffeeGlassSquare:'玻璃茶几',tableCoffeeSquare:'方茶几',televisionModern:'電視',televisionVintage:'復古電視',televisionAntenna:'天線電視',cardboardBoxClosed:'紙箱',cardboardBoxOpen:'紙箱',bench:'長凳',benchCushion:'軟墊長凳',benchCushionLow:'矮凳',bookcaseOpenLow:'矮書櫃',toiletSquare:'方形馬桶',washerDryerStacked:'洗烘衣機',bathroomCabinetDrawer:'浴櫃',bathroomSinkSquare:'洗手台',kitchenCabinetUpper:'吊櫃',kitchenCabinetUpperDouble:'雙門吊櫃',kitchenCabinetUpperLow:'吊櫃',hoodLarge:'抽油煙機',hoodModern:'抽油煙機',paneling:'壁板',doorway:'門框',doorwayFront:'門框',doorwayOpen:'門洞',floorCorner:'地板塊',floorCornerRound:'地板塊',floorFull:'地板塊',floorHalf:'地板塊',
  tableRound:'圓桌',table:'餐桌',tableCloth:'餐桌',tableGlass:'玻璃桌',tableCross:'交叉腳桌',tableCrossCloth:'餐桌',desk:'書桌',deskCorner:'轉角書桌',bookcaseOpen:'書櫃',bookcaseClosed:'書櫃',bookcaseClosedWide:'大書櫃',bookcaseClosedDoors:'書櫃',cabinetTelevision:'電視櫃',cabinetTelevisionDoors:'電視櫃',loungeChair:'單人沙發',loungeChairRelax:'躺椅',loungeDesignChair:'設計椅',loungeSofa:'沙發',bathtub:'浴缸',toilet:'馬桶',bathroomSink:'洗手台',washer:'洗衣機',dryer:'烘衣機',kitchenFridgeSmall:'小冰箱',kitchenFridgeLarge:'大冰箱',kitchenFridgeBuiltIn:'嵌入式冰箱',kitchenStove:'瓦斯爐',kitchenStoveElectric:'電磁爐',kitchenSink:'流理台',kitchenCabinet:'廚櫃',kitchenCabinetDrawer:'廚櫃',kitchenCabinetCornerRound:'轉角廚櫃',kitchenCabinetCornerInner:'轉角廚櫃',bedSingle:'單人床',kitchenBar:'廚房中島',shower:'淋浴間',showerRound:'淋浴間',wall:'牆板',wallHalf:'半牆',wallCorner:'轉角牆',wallCornerRond:'圓角牆',wallDoorway:'門牆',wallDoorwayWide:'寬門牆',wallWindow:'窗牆',wallWindowSlide:'落地窗牆',
  loungeDesignSofa:'設計沙發',loungeDesignSofaCorner:'L型設計沙發',loungeSofaLong:'長沙發',loungeSofaCorner:'L型沙發',loungeSofaOttoman:'沙發躺椅',bedDouble:'雙人床',bedBunk:'上下舖',kitchenFridge:'大冰箱',stairs:'樓梯',stairsCorner:'轉角樓梯',stairsOpen:'鏤空樓梯',stairsOpenSingle:'單邊樓梯',
  rugRound:'圓地毯',rugRectangle:'地毯',rugDoormat:'門墊',rugSquare:'方地毯',rugRounded:'圓角地毯',
  'vehicle-drag-racer':'直線賽車','vehicle-monster-truck':'怪獸卡車','vehicle-racer':'玩具賽車','vehicle-racer-low':'低底盤賽車','vehicle-speedster':'玩具跑車','vehicle-suv':'玩具休旅車','vehicle-truck':'玩具卡車','vehicle-vintage-racer':'老爺賽車',
  'item-coin-bronze':'銅幣','item-coin-silver':'銀幣','item-coin-gold':'金幣',
  'item-box':'木箱','item-cone':'三角錐','item-banana':'香蕉皮','wheel-small':'小輪胎','wheel-medium':'輪胎',smoke:'煙霧',gate:'拱門',
  'gate-finish':'終點拱門',tree:'小樹','tree-pine':'松樹',
  'arcade-machine':'街機','air-hockey':'桌上冰球','basketball-game':'投籃機','cash-register':'收銀台','claw-machine':'夾娃娃機',column:'柱子','dance-machine':'跳舞機',floor:'地磚','gambling-machine':'拉霸機',pinball:'彈珠台','prize-wheel':'幸運轉盤',prizes:'獎品架','ticket-machine':'兌票機','vending-machine':'販賣機','wall-arc':'遊戲廳牆','wall-corner-arc':'遊戲廳牆角','wall-door-rotate':'旋轉門','wall-window-arc':'遊戲廳窗',
  'character-employee':'店員','character-gamer':'玩家小人',
  'train-connector':'車廂連結器','track-single':'木軌道','railroad-straight':'鐵軌','railroad-rail-straight':'鐵軌',
};

// ============================================================================
//  以下由中繼表自動衍生 —— 新增素材通常不必動這裡
// ============================================================================
export const CAT_SCALE = {};   // cat -> 縮放
export const POOLS = {};       // cat -> [key, ...] (散佈池)
const FOLDER = {};             // cat -> 資料夾
const CAT_OF = {};             // key -> cat
const ALL = [];                // [{key, cat}, ...] 每一個模型

for (const p of PACK_META){
  CAT_SCALE[p.cat] = p.scale;
  FOLDER[p.cat] = p.folder;
  POOLS[p.cat] = p.list.slice();
  for (const key of p.list){
    CAT_OF[key] = p.cat;
    ALL.push({ key, cat: p.cat });
  }
}

export const catOf = (key) => CAT_OF[key];

export function pathOf(key){
  const folder = FOLDER[CAT_OF[key]] || '';
  const file = FILE_OVERRIDE[key] || key;
  return `models/${folder ? folder + '/' : ''}${file}.glb`;
}

export function nameOf(key){
  if (NAMES[key]) return NAMES[key];
  if (key.includes('plate')) return '積木薄板';
  if (key.startsWith('bevel')) return '積木';
  if (key.startsWith('train-carriage')) return '貨運車廂';
  if (key.startsWith('train-locomotive')) return '火車頭';
  if (key.startsWith('train-diesel')) return '柴油火車';
  if (key.startsWith('train-tram')) return '路面電車';
  if (key.startsWith('train-electric')) return '電聯車';
  return { food:'食物', coin:'硬幣', brick:'積木', train:'火車', arcade:'遊戲機', people:'小人', vehicle:'玩具車' }[CAT_OF[key]] || '傢俱';
}

// 給 loadModels 用:所有 {key, cat}
export const allEntries = () => ALL.slice();
