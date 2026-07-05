// 玩具屋大黑洞 — hole.io 風格網頁遊戲(原創實作,素材:Kenney CC0)
// 模式:battle(2分鐘對戰)/ endless(無限:物品與地圖跟著洞一起變大)
import * as THREE from 'three';
import { GLTFLoader } from './lib/loaders/GLTFLoader.js';
// 素材資料(清單/名稱/縮放/路徑)集中在 data.js,新增素材包只改那裡
import { POOLS, CAT_SCALE, pathOf, nameOf, allEntries } from './data.js';

// ============================================================ 設定
const CFG = {
  GAME_SECONDS: 120,
  WORLD: 72,                 // 起始地板邊長
  START_RADIUS: 0.8,
  MAX_RADIUS_BATTLE: 4.2,
  MAX_RADIUS_ENDLESS: 9,     // 無限:洞的絕對上限(過大會破圖,改為有界成長)
  BASE_SPEED: 8.0,
  EAT_GATE: 0.92,            // 物件有效半徑 < 洞半徑*此值 才吃得下
  EAT_DIST: 0.82,            // 物件中心進入 洞半徑*此值 開始掉落
  SUCTION_DIST: 1.5,
  RESPAWN_SMALL_SEC: 0.1,    // 對戰:小物件重生秒數(+亂數)
  ENDLESS_RESPAWN_SEC: 6,    // 無限:所有物件重生秒數(+亂數)
  ENDLESS_MAP_MAX: 2,        // 無限:地圖最大放大倍數(有界)
  ENDLESS_XP_CAP: 30,        // 無限:單顆物品最多給多少 xp(防止滾雪球暴衝)
};
let MODE = null;             // 'battle' | 'endless'
let worldSize = CFG.WORLD;
const HALF = () => worldSize / 2;
const WALL = () => HALF() - 0.6;

// xp → 洞半徑
function radiusOf(xp){
  if (MODE === 'endless')
    return Math.min(CFG.MAX_RADIUS_ENDLESS, CFG.START_RADIUS * Math.pow(1 + xp/260, 0.7));
  return Math.min(CFG.MAX_RADIUS_BATTLE, CFG.START_RADIUS + 2.0 * Math.pow(xp / 300, 0.62));
}
const xpOf = r => Math.max(2, Math.round(r * r * 26));
// 無限模式:單顆給的 xp 用「範本原始尺寸」算並設上限,避免物品長大後 xp 也跟著爆
function xpGain(o){
  const t = templates.get(o.key);
  const base = t ? t.eff : o.r;
  let xp = Math.max(2, Math.round(base * base * 26));
  return MODE === 'endless' ? Math.min(CFG.ENDLESS_XP_CAP, xp) : xp;
}
function speedOf(r){
  if (MODE === 'endless') return Math.min(60, CFG.BASE_SPEED * (0.85 + 0.3 * r));
  return CFG.BASE_SPEED * (1 - Math.min(0.35, (r - CFG.START_RADIUS) * 0.055));
}
// 無限模式的世界成長係數(以玩家的洞為準)
const growG = () => MODE === 'endless' && player ? Math.max(1, player.r / CFG.START_RADIUS) : 1;

// 模型清單/名稱/縮放/路徑 → 見 data.js(POOLS、CAT_SCALE、pathOf、nameOf、allEntries)

// ============================================================ 全域狀態
let scene, camera, renderer, clock, sun;
const templates = new Map();
let objects = [];
let holes = [];
let player;
let timeLeft = CFG.GAME_SECONDS, elapsed = 0, playing = false, gameOver = false;
const respawnQueue = [];
let lastTick = -1, lastTopUp = 0, lastShadowR = 0;
let floorMesh, floorTex, wallMeshes = [], outerStrips = [];

const holesUniform = { value: [new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,0)] };

// ============================================================ 音效(WebAudio 合成)
let AC = null, masterGain = null;
let muted = localStorage.getItem('holeMuted') === '1';
function audioInit(){
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = AC.createGain();
    masterGain.gain.value = muted ? 0 : 0.5;
    masterGain.connect(AC.destination);
  } catch(e){ AC = null; }
}
function tone(f0, f1, dur, type='sine', vol=0.5, delay=0){
  if (!AC || muted) return;
  const t = AC.currentTime + delay;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1,f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(masterGain);
  o.start(t); o.stop(t + dur + 0.02);
}
function sndEat(rRatio){
  const k = Math.min(1, rRatio);
  tone(300 - 160*k, 70 - 30*k, 0.12 + 0.14*k, 'sine', 0.45 + 0.4*k);
}
function sndCoin(){ tone(988, 988, 0.06, 'square', 0.18); tone(1319, 1319, 0.10, 'square', 0.18, 0.06); }
function sndSwallow(){ tone(420, 50, 0.5, 'sawtooth', 0.5); }
function sndTick(){ tone(1000, 1000, 0.05, 'square', 0.2); }
function sndEnd(){ [523,659,784,1047].forEach((f,i)=>tone(f, f, 0.16, 'triangle', 0.4, i*0.13)); }
function vibrate(ms){ try { navigator.vibrate && navigator.vibrate(ms); } catch(e){} }

// ============================================================ 初始化
init();
async function init(){
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#dccdb8');   // 不加霧 — 白屏 bug 的教訓

  camera = new THREE.PerspectiveCamera(52, innerWidth/innerHeight, 0.1, 2000);

  renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('app').appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  sun = new THREE.DirectionalLight(0xfff2e0, 1.45);
  sun.position.set(18, 30, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  setShadowArea(HALF() + 4);
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(-14, 18, -10);
  scene.add(fill);

  makeFloor();
  makeWalls();

  addEventListener('resize', onResize);
  setupInput();
  setupMute();

  await loadModels();
  buildWorld();
  makeHoles();

  document.getElementById('loading').classList.add('hidden');
  clock = new THREE.Clock();
  animate();
  setupModeSelect();
}

function setShadowArea(d){
  sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
  sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
  sun.shadow.camera.near = 4; sun.shadow.camera.far = 90 + d*2;
  sun.shadow.camera.updateProjectionMatrix();
}

// ---------- 模式選擇
function setupModeSelect(){
  const sel = document.getElementById('modeSel');
  const urlMode = new URLSearchParams(location.search).get('mode');
  const start = (m) => {
    MODE = m;
    sel.classList.add('hidden');
    document.getElementById('endBtn').classList.toggle('hidden', m !== 'endless');
    // 對戰:兩個對手 + 排行榜;無限:單人休閒,收起排行榜
    if (m === 'battle'){ createBots(); document.getElementById('board').classList.remove('hidden'); }
    else { document.getElementById('board').classList.add('hidden'); }
    document.getElementById('timerVal').textContent = m === 'battle' ? '2:00' : '0:00';
    document.getElementById('hint').textContent = m === 'battle'
      ? '按住拖曳操控黑洞,2 分鐘內吃越多越好!'
      : '無限模式:越吃越大,世界也會跟著長大!';
    player.r = radiusOf(0); player.rShow = player.r;   // 依模式重算起始半徑
    playing = true;
    clock.getDelta();
    setTimeout(()=>{ document.getElementById('hint').style.opacity = '0'; }, 4500);
  };
  if (urlMode === 'battle' || urlMode === 'endless'){ start(urlMode); return; }
  sel.classList.remove('hidden');
  document.getElementById('btnBattle').addEventListener('click', ()=>{ audioInit(); start('battle'); });
  document.getElementById('btnEndless').addEventListener('click', ()=>{ audioInit(); start('endless'); });
}

// ---------- 地板(木紋 + 開洞 shader;1×1 幾何,用 scale 支援地圖成長)
function makeFloor(){
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  const plankH = 64;
  for (let row = 0; row < 8; row++){
    const base = 28 + Math.random()*10;
    g.fillStyle = `hsl(${base}, 42%, ${62 + Math.random()*6}%)`;
    g.fillRect(0, row*plankH, 512, plankH);
    g.strokeStyle = 'rgba(120,80,40,.12)'; g.lineWidth = 1.5;
    for (let i = 0; i < 5; i++){
      g.beginPath();
      const y = row*plankH + 8 + Math.random()*(plankH-16);
      g.moveTo(0, y); g.bezierCurveTo(170, y+6, 340, y-6, 512, y);
      g.stroke();
    }
    g.fillStyle = 'rgba(90,60,30,.35)';
    g.fillRect(0, row*plankH, 512, 2);
    const off = (row % 2) * 128;
    g.fillRect((off + 200) % 512, row*plankH, 2, plankH);
    g.fillRect((off + 420) % 512, row*plankH, 2, plankH);
  }
  floorTex = new THREE.CanvasTexture(c);
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(worldSize/10, worldSize/10);
  floorTex.anisotropy = 4;

  const mat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.92, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uHoles = holesUniform;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform vec3 uHoles[3];')
      .replace('void main() {', `void main() {
        for (int i = 0; i < 3; i++){
          if (uHoles[i].z > 0.0 && distance(vWPos.xz, uHoles[i].xy) < uHoles[i].z) discard;
        }`);
  };
  floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), mat);
  floorMesh.rotation.x = -Math.PI/2;
  floorMesh.scale.set(worldSize, worldSize, 1);
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // 地板外圍(4 條,避免蓋住洞底)
  const outMat = new THREE.MeshStandardMaterial({ color:'#b7a389', roughness:1 });
  for (let i = 0; i < 4; i++){
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), outMat);
    p.rotation.x = -Math.PI/2;
    p.position.y = -0.02;
    scene.add(p);
    outerStrips.push(p);
  }
  layoutOuter();
}
function layoutOuter(){
  const W = 400;
  const s = [
    [worldSize + W*2, W, 0, -(HALF() + W/2)],
    [worldSize + W*2, W, 0,  (HALF() + W/2)],
    [W, worldSize, -(HALF() + W/2), 0],
    [W, worldSize,  (HALF() + W/2), 0],
  ];
  outerStrips.forEach((p, i) => {
    p.scale.set(s[i][0], s[i][1], 1);
    p.position.set(s[i][2], -0.02, s[i][3]);
  });
}

function makeWalls(){
  const mat = new THREE.MeshStandardMaterial({ color:'#8a6a4f', roughness:.85 });
  const t = 1.4, h = 1.8;
  for (let i = 0; i < 4; i++){
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, h, 1), mat);
    m.position.y = h/2 - 0.05;
    m.receiveShadow = true;
    scene.add(m);
    wallMeshes.push(m);
  }
  layoutWalls();
}
function layoutWalls(){
  const t = 1.4;
  const cfg = [
    [worldSize + t*2, t, 0,  HALF() + t/2],
    [worldSize + t*2, t, 0, -HALF() - t/2],
    [t, worldSize, HALF() + t/2, 0],
    [t, worldSize, -HALF() - t/2, 0],
  ];
  wallMeshes.forEach((m, i) => {
    m.scale.set(cfg[i][0], 1, cfg[i][1]);
    m.position.x = cfg[i][2];
    m.position.z = cfg[i][3];
  });
}

// ---------- 模型載入(allEntries 由 data.js 提供)
async function loadModels(){
  const loader = new GLTFLoader();
  const lt = document.getElementById('loadingText');
  const entries = allEntries();
  let done = 0;
  await Promise.all(entries.map(async e => {
    try {
      const gltf = await loader.loadAsync(pathOf(e.key));
      const root = gltf.scene;
      const s = CAT_SCALE[e.cat] || 1;
      root.scale.setScalar(s);
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const ctr = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const wrap = new THREE.Group();
      wrap.add(root);
      root.position.set(-ctr.x, -box.min.y, -ctr.z);
      const foot = Math.max(size.x, size.z)/2;
      root.traverse(o => { if (o.isMesh){ o.castShadow = foot > 0.3; o.receiveShadow = true; } });
      // 吞食門檻用「面積幾何平均 + 高度」:長條物(鐵軌/火車)才不會被高估
      const eff = Math.max(Math.sqrt(size.x * size.z)/2, size.y * 0.45);
      templates.set(e.key, { obj: wrap, radius: foot, eff, height: size.y, cat: e.cat, key: e.key });
    } catch(err){ /* 缺檔跳過 */ }
    done++;
    lt.textContent = `正在把玩具屋搬進來… ${Math.round(done/entries.length*100)}%`;
  }));
}

// ---------- 物件生成
const spawnedKeys = new Set();
function canPlace(x, z, r, gap = 0.25){
  if (Math.abs(x) > HALF()-1.2 || Math.abs(z) > HALF()-1.2) return false;
  for (const o of objects){
    if (o.state !== 'idle' && o.state !== 'pop') continue;
    if (o.cat === 'rug') continue;
    if (Math.hypot(x-o.x, z-o.z) < r + o.fr + gap) return false;
  }
  return true;
}
function spawnObj(key, x, z, ryDeg, opts = {}){
  const t = templates.get(key);
  if (!t) return null;
  const mesh = t.obj.clone(true);
  let jitter = (opts.exact ? 1 : (0.92 + Math.random()*0.16)) * (opts.sizeMult || 1);
  mesh.scale.multiplyScalar(jitter);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = (ryDeg !== undefined ? ryDeg * Math.PI/180 : Math.random()*Math.PI*2);
  // 積木隨機亮色
  if (t.cat === 'brick'){
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(Math.random(), 0.75, 0.55), roughness: 0.45,
    });
    mesh.traverse(o => { if (o.isMesh) o.material = mat; });
  }
  scene.add(mesh);
  const o = {
    key, cat: t.cat, mesh, jit: jitter, gk: 0.35 + Math.random()*0.75,
    r: t.eff * jitter, fr: t.radius * jitter, h: t.height * jitter,
    x, z, state: 'idle', vy: 0,
    spin: null, mobile: !!opts.mobile, rail: !!opts.rail,
    dir: opts.dir !== undefined ? opts.dir : Math.random()*Math.PI*2,
    speed: opts.speed || 0,
  };
  objects.push(o);
  spawnedKeys.add(key);
  return o;
}
function scatter(pool, count, opts = {}){
  for (let i = 0; i < count; i++){
    const key = pool[Math.floor(Math.random()*pool.length)];
    const t = templates.get(key);
    if (!t) continue;
    let ok = false, x = 0, z = 0;
    const fr = t.radius * (opts.sizeMult || 1);
    for (let tr = 0; tr < 40 && !ok; tr++){
      x = (Math.random()*2 - 1) * (HALF() - 2);
      z = (Math.random()*2 - 1) * (HALF() - 2);
      if (Math.hypot(x, z - 6) < 3.5) continue;      // 玩家出生點淨空
      if (canPlace(x, z, fr)) ok = true;
    }
    if (ok) spawnObj(key, x, z, undefined, opts);
  }
}

function buildWorld(){
  const zone = (cx, cz, list) => {
    for (const [k, dx, dz, ry] of list){
      const t = templates.get(k); if (!t) continue;
      if (canPlace(cx+dx, cz+dz, t.radius, 0.05)) spawnObj(k, cx+dx, cz+dz, ry, { exact:true });
      else spawnObj(k, cx+dx, cz+dz, ry, { exact:true });   // 手擺區允許貼緊
    }
  };
  // 客廳(左下)
  zone(-18, -15, [
    ['rugRound', 0, -0.5],
    ['loungeSofa', 0, -4.5, 0], ['loungeSofaLong', -6, -0.5, 90], ['loungeChair', 5, -2.5, -40],
    ['tableCoffee', 0, -0.5, 0],
    ['cabinetTelevision', -0.5, 4.2, 180], ['televisionModern', 2.5, 4.2, 180],
    ['bookcaseClosedWide', -5.5, 4.5, 180], ['speaker', 4.6, 4.2, 180],
    ['lampRoundFloor', 6.8, 0.8], ['pottedPlant', -6.5, 4.4], ['radio', 2.6, 0.8],
  ]);
  // 臥室(右下)
  zone(19, -16, [
    ['rugRectangle', 0, 0],
    ['bedDouble', 0, -2.5, 0], ['bedSingle', 5.5, -2.8, 0], ['bedBunk', -5.5, -3, 0],
    ['sideTableDrawers', 2.8, -4.6, 0], ['lampRoundTable', 2.8, -3.4],
    ['coatRackStanding', 7, 2.5], ['bookcaseClosed', -6.5, 2.5, 90],
    ['bear', 1.5, 1.5, 30], ['pillow', -1.5, 1.8], ['pillowBlue', 3.5, 1.2],
  ]);
  // 廚房+餐廳(左上)
  zone(-18, 20, [
    ['kitchenBar', -1, -2.5, 0],
    ['stoolBar', -3, -4.4], ['stoolBar', -1, -4.6], ['stoolBarSquare', 1, -4.4],
    ['kitchenFridge', -6.5, 4.6, 180], ['kitchenCabinet', -4.3, 4.7, 180],
    ['kitchenStove', -2.2, 4.7, 180], ['kitchenSink', 0, 4.7, 180], ['kitchenCabinetDrawer', 2.2, 4.7, 180],
    ['tableCloth', 6.5, -0.5, 0],
    ['chairModernCushion', 5, -2, 0], ['chairModernCushion', 8, -2, 0],
    ['chairModernCushion', 5, 1, 180], ['chairModernCushion', 8, 1, 180],
    ['toaster', 4.5, 4.6], ['kitchenBlender', 6, 4.6], ['kitchenMicrowave', 7.6, 4.5],
  ]);
  // 浴室+洗衣(右上)
  zone(22, 22, [
    ['rugDoormat', 0, -3],
    ['bathtub', 1, 3.4, 180], ['toilet', 4.5, 3.6, 180], ['bathroomSink', 6.5, 3.6, 180],
    ['washer', -3, 3.6, 180], ['dryer', -5.2, 3.6, 180], ['trashcan', 3, 0.5],
  ]);
  // 書房(中下)
  zone(0, -26, [
    ['desk', 0, -0.8, 180], ['chairDesk', 0, 1.2, 0],
    ['computerScreen', 2.6, -0.8], ['computerKeyboard', 2.5, 0.6], ['computerMouse', 3.4, 0.7],
    ['laptop', -2.6, 0.4, 20], ['bookcaseOpen', 5, -1, 90], ['books', -4, 0.5],
  ]);
  // 遊戲廳(右中)
  zone(26, 2, [
    ['arcade-machine', 0, -4, -90], ['pinball', 0, -1.8, -90], ['dance-machine', 0, 0.6, -90],
    ['gambling-machine', 0, 2.8, -90], ['vending-machine', 0, 5, -90],
    ['claw-machine', 4, -4, 90], ['basketball-game', 4, -1.6, 90], ['air-hockey', 4, 1, 90],
    ['prize-wheel', 4, 3.4, 90], ['ticket-machine', 4, 5.4, 90],
    ['cash-register', -3, 0, 90], ['prizes', -3, 2.4, 90], ['column', -3, -2.6],
    ['character-employee', -1.8, 0.4, 120], ['character-gamer', 2, -2.6, -60],
  ]);
  // 積木角(左中)
  for (const bk of POOLS.brick){
    const t = templates.get(bk); if (!t) continue;
    let x, z, ok = false;
    for (let tr = 0; tr < 30 && !ok; tr++){
      x = -27 + (Math.random()*2-1)*5.5;
      z = -2 + (Math.random()*2-1)*5.5;
      if (canPlace(x, z, t.radius, 0.12)) ok = true;
    }
    if (ok) spawnObj(bk, x, z);
  }
  // 玩具區(中央)
  const ring = 8;
  for (let i = 0; i < ring; i++){
    const a = i / ring * Math.PI * 2;
    spawnObj(POOLS.coin[i % 3], Math.cos(a)*4.5, 4 + Math.sin(a)*4.5, undefined, { exact:true });
  }
  zone(0, 4, [
    ['tree', -7, 2], ['tree-pine', 7, 2], ['tree', -8, -3], ['tree-pine', 8.5, -2],
    ['item-box', -4, -3], ['item-cone', 4, -3], ['item-cone', 5, -2.2],
    ['wheel-medium', -5, 0.5], ['wheel-small', 5.5, 0.8], ['gate', 0, -4.5, 0],
  ]);
  // 鐵道(橫貫 z=12)+ 行駛中的火車
  const railT = templates.get('railroad-straight');
  if (railT){
    const len = railT.radius * 2;
    for (let x = -HALF() + len/2 + 1; x < HALF() - 1; x += len){
      spawnObj('railroad-straight', x, 12, 90, { exact:true });
    }
  }
  const convoy = ['train-locomotive-a','train-carriage-coal','train-carriage-box','train-carriage-container-red'];
  convoy.forEach((k, i) => {
    spawnObj(k, -6 - i*4.2, 12, undefined, { mobile:true, rail:true, dir:0, speed:3.2, exact:true });
  });

  // 全場散布
  scatter(POOLS.food, 22);
  scatter(POOLS.coin, 12);
  scatter(POOLS.small, 14);
  scatter(POOLS.med, 10);
  scatter(POOLS.brick, 8);
  scatter(POOLS.people, 5);

  // 會跑的玩具車
  for (let i = 0; i < 7; i++){
    const key = POOLS.vehicle[i % POOLS.vehicle.length];
    const t = templates.get(key); if (!t) continue;
    let x, z, tries = 0;
    do { x = (Math.random()*2-1)*(HALF()-4); z = (Math.random()*2-1)*(HALF()-4); tries++; }
    while (!canPlace(x, z, t.radius) && tries < 30);
    spawnObj(key, x, z, undefined, { mobile:true, speed: 2.0 + Math.random()*1.2 });
  }

  // ★ 沒出現過的模型全部上場,一種一個
  for (const [key, t] of templates){
    if (spawnedKeys.has(key)) continue;
    let ok = false, x = 0, z = 0;
    for (let tr = 0; tr < 60 && !ok; tr++){
      x = (Math.random()*2 - 1) * (HALF() - 2.5);
      z = (Math.random()*2 - 1) * (HALF() - 2.5);
      if (Math.hypot(x, z - 6) < 4) continue;
      if (canPlace(x, z, t.radius, 0.2)) ok = true;
    }
    if (ok) spawnObj(key, x, z);
  }
}

// ============================================================ 洞
function makeLabel(text, color){
  const c = document.createElement('canvas'); c.width = 256; c.height = 80;
  const g = c.getContext('2d');
  g.font = '700 44px -apple-system, "PingFang TC", "Microsoft JhengHei", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.55)';
  g.strokeText(text, 128, 40);
  g.fillStyle = color;
  g.fillText(text, 128, 40);
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sp.scale.set(3.2, 1.0, 1);
  sp.renderOrder = 5;
  return sp;
}

function makeHoleVisual(rimColor){
  const grp = new THREE.Group();
  const wallM = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 6, 48, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x0c0906, side: THREE.BackSide })
  );
  wallM.position.y = -3;
  grp.add(wallM);
  const bottom = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshBasicMaterial({ color: 0x030202 })
  );
  bottom.rotation.x = -Math.PI/2;
  bottom.position.y = -5.9;
  grp.add(bottom);
  const rim = new THREE.Mesh(
    new THREE.RingGeometry(0.94, 1.10, 64),
    new THREE.MeshBasicMaterial({ color: rimColor, side: THREE.DoubleSide })
  );
  rim.rotation.x = -Math.PI/2;
  rim.position.y = 0.035;
  grp.add(rim);
  const inner = new THREE.Mesh(
    new THREE.RingGeometry(0.86, 0.95, 64),
    new THREE.MeshBasicMaterial({ color: 0x140f0b, side: THREE.DoubleSide })
  );
  inner.rotation.x = -Math.PI/2;
  inner.position.y = 0.03;
  grp.add(inner);
  scene.add(grp);
  return grp;
}

function makeHole(name, color, x, z, isBot){
  const h = {
    name, color, isBot,
    x, z, vx: 0, vz: 0,
    xp: 0, r: CFG.START_RADIUS, rShow: CFG.START_RADIUS,
    score: 0, eaten: 0, biggest: null, biggestR: 0,
    alive: true, dyingT: 0, respawnAt: 0,
    grp: makeHoleVisual(color),
    label: makeLabel(name, color),
    target: null, retargetAt: 0, wander: null,
  };
  scene.add(h.label);
  holes.push(h);
  return h;
}

function makeHoles(){
  // 只先建立玩家;bot 依模式決定(對戰才有,無限是單人休閒)
  player = makeHole('你', '#ff9430', 0, 6, false);
}
function createBots(){
  makeHole('小藍', '#48a8ff', -22, 22, true);
  makeHole('小綠', '#5cd579', 22, -22, true);
  updateBoard();
}

// ============================================================ 輸入(浮動搖桿)
const joyEl = document.getElementById('joy');
const knobEl = document.getElementById('joyKnob');
const input = { active:false, id:null, ox:0, oy:0, dx:0, dy:0 };
const keys = {};

function setupInput(){
  const down = (id, x, y) => {
    audioInit();
    if (input.active) return;
    input.active = true; input.id = id; input.ox = x; input.oy = y; input.dx = 0; input.dy = 0;
    joyEl.style.left = x+'px'; joyEl.style.top = y+'px'; joyEl.style.display = 'block';
    knobEl.style.left = x+'px'; knobEl.style.top = y+'px'; knobEl.style.display = 'block';
  };
  const move = (id, x, y) => {
    if (!input.active || id !== input.id) return;
    let dx = x - input.ox, dy = y - input.oy;
    const len = Math.hypot(dx, dy), max = 56;
    if (len > max){ dx = dx/len*max; dy = dy/len*max; }
    input.dx = dx/56; input.dy = dy/56;
    knobEl.style.left = (input.ox+dx)+'px'; knobEl.style.top = (input.oy+dy)+'px';
  };
  const up = (id) => {
    if (!input.active || id !== input.id) return;
    input.active = false; input.dx = 0; input.dy = 0;
    joyEl.style.display = 'none'; knobEl.style.display = 'none';
  };
  addEventListener('touchstart', e => { if (e.target.closest('button')) return; const t = e.changedTouches[0]; down(t.identifier, t.clientX, t.clientY); }, { passive:true });
  addEventListener('touchmove', e => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    for (const t of e.changedTouches) move(t.identifier, t.clientX, t.clientY);
  }, { passive:false });
  addEventListener('touchend', e => { for (const t of e.changedTouches) up(t.identifier); });
  addEventListener('touchcancel', e => { for (const t of e.changedTouches) up(t.identifier); });
  addEventListener('mousedown', e => { if (e.target.closest('button')) return; down('m', e.clientX, e.clientY); });
  addEventListener('mousemove', e => move('m', e.clientX, e.clientY));
  addEventListener('mouseup', () => up('m'));
  addEventListener('keydown', e => { keys[e.key] = true; audioInit(); });
  addEventListener('keyup', e => { keys[e.key] = false; });
}

function playerDir(){
  let dx = input.dx, dy = input.dy;
  if (keys.ArrowLeft || keys.a) dx -= 1;
  if (keys.ArrowRight || keys.d) dx += 1;
  if (keys.ArrowUp || keys.w) dy -= 1;
  if (keys.ArrowDown || keys.s) dy += 1;
  const len = Math.hypot(dx, dy);
  if (len > 1){ dx /= len; dy /= len; }
  return [dx, dy];
}

function setupMute(){
  const btn = document.getElementById('muteBtn');
  btn.textContent = muted ? '🔇' : '🔊';
  btn.addEventListener('click', () => {
    muted = !muted;
    localStorage.setItem('holeMuted', muted ? '1' : '0');
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.5;
    btn.textContent = muted ? '🔇' : '🔊';
  });
  document.getElementById('endBtn').addEventListener('click', () => { if (MODE === 'endless' && playing) endGame(); });
}

// ============================================================ Bot AI
function botThink(b, now){
  if (now < b.retargetAt) return;
  b.retargetAt = now + 0.3 + Math.random()*0.25;
  for (const e of holes){
    if (e === b || !e.alive) continue;
    const d = Math.hypot(e.x-b.x, e.z-b.z);
    if (e.r > b.r*1.25 && d < e.r*1.2 + 5){
      b.target = { x: b.x + (b.x-e.x)/d*12, z: b.z + (b.z-e.z)/d*12 };
      return;
    }
  }
  for (const e of holes){
    if (e === b || !e.alive) continue;
    const d = Math.hypot(e.x-b.x, e.z-b.z);
    if (e.r < b.r*0.72 && d < 11 + b.r*2){ b.target = { hole:e }; return; }
  }
  let best = null, bestV = 0;
  const range = 17 + b.r * 3;
  for (const o of objects){
    if (o.state !== 'idle' || o.r >= b.r*CFG.EAT_GATE) continue;
    const d = Math.hypot(o.x-b.x, o.z-b.z);
    if (d > range) continue;
    const v = xpOf(o.r) / (d + 2);
    if (v > bestV){ bestV = v; best = o; }
  }
  if (best){ b.target = { obj: best }; return; }
  if (!b.wander || Math.hypot(b.wander.x-b.x, b.wander.z-b.z) < 3){
    b.wander = { x:(Math.random()*2-1)*(HALF()-5), z:(Math.random()*2-1)*(HALF()-5) };
  }
  b.target = { x: b.wander.x, z: b.wander.z };
}

function botDir(b){
  let tx = null, tz = null;
  const t = b.target;
  if (t){
    if (t.obj){ if (t.obj.state !== 'idle'){ b.target = null; return [0,0]; } tx = t.obj.x; tz = t.obj.z; }
    else if (t.hole){ if (!t.hole.alive){ b.target = null; return [0,0]; } tx = t.hole.x; tz = t.hole.z; }
    else { tx = t.x; tz = t.z; }
  }
  if (tx === null) return [0,0];
  const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
  if (d < 0.3) return [0,0];
  return [dx/d, dz/d];
}

// ============================================================ 洞更新 / 吞噬
function moveHole(h, dirX, dirZ, dt){
  const sp = speedOf(h.r);
  h.vx += (dirX*sp - h.vx) * Math.min(1, dt*10);
  h.vz += (dirZ*sp - h.vz) * Math.min(1, dt*10);
  h.x += h.vx * dt;
  h.z += h.vz * dt;
  const lim = WALL() - h.r*0.4;
  h.x = Math.max(-lim, Math.min(lim, h.x));
  h.z = Math.max(-lim, Math.min(lim, h.z));
}

function updateHoleVisual(h, dt){
  h.rShow += (h.r - h.rShow) * Math.min(1, dt*5);
  const s = h.alive ? h.rShow : Math.max(0.001, h.rShow * (1 - h.dyingT*2));
  h.grp.scale.set(s, Math.max(1, s*0.7), s);
  h.grp.position.set(h.x, 0, h.z);
  h.grp.visible = h.alive || h.dyingT < 0.5;
  h.label.position.set(h.x, 1.5 + h.rShow*0.4, h.z);
  const ls = 0.75 + h.rShow*0.18;
  h.label.scale.set(3.2*ls, 1.0*ls, 1);
  h.label.visible = h.grp.visible;
}

function eatCheck(h, dt){
  if (!h.alive) return;
  const gate = h.r * CFG.EAT_GATE;
  for (const o of objects){
    if (o.state !== 'idle') continue;
    const dx = o.x - h.x, dz = o.z - h.z;
    const d = Math.hypot(dx, dz) || 0.0001;
    if (o.r < gate){
      // 吃得下
      if (d < h.r * CFG.EAT_DIST){
        o.state = 'falling';
        o.vy = 0;
        o.fallHole = h;
        o.spin = { x:(Math.random()-0.5)*7, y:(Math.random()-0.5)*9, z:(Math.random()-0.5)*7 };
      } else if (d < h.r * CFG.SUCTION_DIST){
        const pull = (1 - d/(h.r*CFG.SUCTION_DIST)) * 3.2 * dt;
        o.x -= dx/d * pull * h.r;
        o.z -= dz/d * pull * h.r;
        o.mesh.position.set(o.x, o.mesh.position.y, o.z);
      }
    } else if (!o.mobile){
      // 太大吃不下:別讓它懸在洞口的坑上方 → 推到洞緣(軟碰撞,像被洞頂開)
      const minD = h.r + o.fr * 0.85;
      if (d < minD){
        const push = minD - d;
        o.x += dx/d * push;
        o.z += dz/d * push;
        const lim = HALF() - 1;
        o.x = Math.max(-lim, Math.min(lim, o.x));
        o.z = Math.max(-lim, Math.min(lim, o.z));
        o.mesh.position.set(o.x, 0, o.z);
      }
    }
  }
}

function updateFalling(dt){
  for (const o of objects){
    if (o.state !== 'falling') continue;
    const h = o.fallHole;
    const g = 26 * Math.max(1, h.r * 0.5);
    o.vy -= g * dt;
    let y = o.mesh.position.y + o.vy * dt;
    o.x += (h.x - o.x) * Math.min(1, dt*7);
    o.z += (h.z - o.z) * Math.min(1, dt*7);
    o.mesh.position.set(o.x, y, o.z);
    o.mesh.rotation.x += o.spin.x * dt;
    o.mesh.rotation.y += o.spin.y * dt;
    o.mesh.rotation.z += o.spin.z * dt;
    const depth = Math.min(5.9 * Math.max(1, h.rShow*0.7) - 0.5, 2.2 + h.r * 1.3);
    if (y < -depth){
      o.state = 'gone';
      scene.remove(o.mesh);
      award(h, o);
    }
  }
}

function award(h, o){
  let xp = xpGain(o);
  if (o.cat === 'coin') xp += 4;
  h.xp += xp;
  h.score = h.xp * 10;
  h.eaten++;
  h.r = radiusOf(h.xp);
  if (o.r > h.biggestR){ h.biggestR = o.r; h.biggest = nameOf(o.key); }
  if (h === player){
    const el = document.getElementById('scoreVal');
    el.textContent = h.score;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    if (o.cat === 'coin') sndCoin(); else sndEat(o.r / Math.max(1, h.r));
    vibrate(o.r > h.r*0.5 ? 30 : 12);
    updateLevel();
  }
  // 重生排程
  if (MODE === 'endless'){
    respawnQueue.push({ key: o.key, at: timeNow + CFG.ENDLESS_RESPAWN_SEC + Math.random()*7 });
  } else if ((o.cat === 'food' || o.cat === 'coin' || o.cat === 'small' || o.cat === 'prop' || o.cat === 'brick')
             && objects.filter(x=>x.state==='idle').length < 300){
    respawnQueue.push({ key: o.key, at: timeNow + CFG.RESPAWN_SMALL_SEC + Math.random()*8 });
  }
}

function holeVsHole(){
  for (const a of holes){
    if (!a.alive) continue;
    for (const b of holes){
      if (a === b || !b.alive) continue;
      if (a.r > b.r * 1.3){
        const d = Math.hypot(a.x-b.x, a.z-b.z);
        if (d < a.r * 0.7) swallowHole(a, b);
      }
    }
  }
}
function swallowHole(winner, loser){
  loser.alive = false;
  loser.dyingT = 0;
  loser.respawnAt = timeNow + 3;
  winner.xp += 30 + Math.round(loser.xp * 0.3);
  winner.score = winner.xp * 10;
  winner.r = radiusOf(winner.xp);
  if (winner === player){
    sndSwallow(); vibrate(70);
    document.getElementById('scoreVal').textContent = winner.score;
    updateLevel();
  }
  if (loser === player){
    sndSwallow(); vibrate([60,40,60]);
    showRespawn();
  }
}
function respawnHole(h){
  h.alive = true;
  h.dyingT = 0;
  h.xp = Math.round(h.xp * 0.55);
  h.r = radiusOf(h.xp);
  h.rShow = h.r;
  h.score = h.xp * 10;
  const c = HALF() - 8;
  const corners = [[-c,-c],[c,-c],[-c,c],[c,c]];
  let best = corners[0], bestD = -1;
  for (const cc of corners){
    let dMin = 1e9;
    for (const e of holes){ if (e !== h && e.alive) dMin = Math.min(dMin, Math.hypot(cc[0]-e.x, cc[1]-e.z)); }
    if (dMin > bestD){ bestD = dMin; best = cc; }
  }
  h.x = best[0]; h.z = best[1]; h.vx = h.vz = 0;
  if (h === player){
    document.getElementById('respawn').classList.add('hidden');
    document.getElementById('scoreVal').textContent = h.score;
    updateLevel();
  }
}
function showRespawn(){
  const el = document.getElementById('respawn');
  el.classList.remove('hidden');
  const cnt = document.getElementById('respawnCnt');
  cnt.textContent = '3';
  let n = 3;
  const iv = setInterval(() => {
    n--;
    if (n <= 0 || gameOver){ clearInterval(iv); return; }
    cnt.textContent = n;
  }, 1000);
}

// ============================================================ 移動物件(玩具車 + 火車)
function updateVehicles(dt){
  for (const o of objects){
    if (!o.mobile || o.state !== 'idle') continue;
    o.x += Math.cos(o.dir) * o.speed * dt;
    o.z += Math.sin(o.dir) * o.speed * dt;
    if (o.rail){
      if (o.x > HALF() + 5) o.x = -HALF() - 5;   // 火車繞圈
      if (o.x < -HALF() - 5) o.x = HALF() + 5;
    } else {
      const lim = HALF() - 2;
      if (Math.abs(o.x) > lim || Math.abs(o.z) > lim){
        o.x = Math.max(-lim, Math.min(lim, o.x));
        o.z = Math.max(-lim, Math.min(lim, o.z));
        o.dir += Math.PI * (0.6 + Math.random()*0.8);
      }
    }
    o.mesh.position.set(o.x, 0, o.z);
    o.mesh.rotation.y = -o.dir + Math.PI/2;
  }
}

// 無限模式:新生成物品的大小綁在「目前洞的半徑」附近 —— 永遠有得吃、又不會冒出巨型灰塊
function endlessSizeMult(t){
  const targetEff = player.r * (0.32 + Math.random()*0.95);   // 0.32~1.27 倍洞半徑
  return Math.max(0.45, Math.min(8, targetEff / t.eff));
}

// ============================================================ 無限模式:世界成長
function updateEndlessGrowth(dt){
  const G = growG();
  // 1) 地圖隨洞緩慢放大(有界:最多 ENDLESS_MAP_MAX 倍)
  const targetWorld = CFG.WORLD * Math.min(CFG.ENDLESS_MAP_MAX, 1 + (G - 1) * 0.35);
  if (targetWorld > worldSize + 0.01){
    worldSize += Math.min(targetWorld - worldSize, dt * 2.4);
    floorMesh.scale.set(worldSize, worldSize, 1);
    floorTex.repeat.set(worldSize/10, worldSize/10);
    layoutWalls();
    layoutOuter();
  }
  // 2) 密度補充:場上空了就補「跟得上洞的大小」的新物品(尺寸有界,不會爆)
  if (timeNow - lastTopUp > 2){
    lastTopUp = timeNow;
    const targetCount = Math.min(300, Math.round(170 * (worldSize/CFG.WORLD) ** 1.5));
    const idle = objects.filter(o => o.state === 'idle').length;
    if (idle < targetCount){
      const entries = allEntries();
      const n = Math.min(12, targetCount - idle);
      for (let i = 0; i < n; i++){
        const e = entries[Math.floor(Math.random()*entries.length)];
        const t = templates.get(e.key); if (!t) continue;
        const sizeMult = endlessSizeMult(t);
        for (let tr = 0; tr < 25; tr++){
          const x = (Math.random()*2-1)*(HALF()-3), z = (Math.random()*2-1)*(HALF()-3);
          let nearHole = false;
          for (const h of holes){ if (h.alive && Math.hypot(x-h.x, z-h.z) < h.r*2 + 4) nearHole = true; }
          if (nearHole) continue;
          if (!canPlace(x, z, t.radius*sizeMult, 0.15)) continue;
          const o = spawnObj(e.key, x, z, undefined, { sizeMult });
          if (o){ o.mesh.scale.multiplyScalar(0.01); o.pop = 0; o.state = 'pop'; }
          break;
        }
      }
    }
  }
  // 3) 陰影框 + 太陽跟著玩家放大,避免大地圖陰影糊掉
  const k = Math.max(1, player.r / 3);
  if (Math.abs(player.r - lastShadowR) > 0.4){
    lastShadowR = player.r;
    setShadowArea(Math.min(90, 26 + player.r * 6));
  }
  sun.position.set(player.x + 18*k, 30*k, player.z + 14*k);
  sun.target.position.set(player.x, 0, player.z);
}

// ============================================================ 重生排程
function processRespawns(){
  for (let i = respawnQueue.length - 1; i >= 0; i--){
    const q = respawnQueue[i];
    if (timeNow < q.at) continue;
    respawnQueue.splice(i, 1);
    const t = templates.get(q.key); if (!t) continue;
    const sizeMult = MODE === 'endless' ? endlessSizeMult(t) : 1;
    for (let tr = 0; tr < 30; tr++){
      const x = (Math.random()*2-1)*(HALF()-3), z = (Math.random()*2-1)*(HALF()-3);
      let nearHole = false;
      for (const h of holes){ if (h.alive && Math.hypot(x-h.x, z-h.z) < h.r + 4) nearHole = true; }
      if (nearHole) continue;
      if (!canPlace(x, z, t.radius*sizeMult, 0.15)) continue;
      const o = spawnObj(q.key, x, z, undefined, { sizeMult });
      if (o){ o.mesh.scale.multiplyScalar(0.01); o.pop = 0; o.state = 'pop'; }
      break;
    }
  }
}
function updatePops(dt){
  for (const o of objects){
    if (o.state !== 'pop') continue;
    o.pop += dt * 3;
    const s = Math.min(1, o.pop);
    o.mesh.scale.setScalar(o.jit * (s < 0.8 ? s * 1.15 : 1.15 - (s-0.8)*0.75));
    if (o.pop >= 1){ o.mesh.scale.setScalar(o.jit); o.state = 'idle'; }
  }
}

// ============================================================ HUD
function updateLevel(){
  const lv = Math.floor((player.r - CFG.START_RADIUS) / 0.45) + 1;
  const frac = ((player.r - CFG.START_RADIUS) % 0.45) / 0.45;
  document.getElementById('lvlText').textContent = 'LV ' + lv;
  const maxR = MODE === 'endless' ? CFG.MAX_RADIUS_ENDLESS : CFG.MAX_RADIUS_BATTLE;
  document.getElementById('lvlFill').style.width = (player.r >= maxR ? 100 : Math.round(frac*100)) + '%';
}
let boardAt = 0;
function updateBoard(){
  const sorted = [...holes].sort((a,b) => b.score - a.score);
  const el = document.getElementById('board');
  el.innerHTML = sorted.map((h, i) =>
    `<div class="row${h.isBot ? '' : ' me'}"><span class="dot" style="background:${h.color}"></span>` +
    `<span class="nm">${i===0?'👑':''}${h.name}</span><span>${h.score}</span></div>`
  ).join('');
}

// ============================================================ 主迴圈
let timeNow = 0;
function stepGame(dt){
  timeNow += dt;
  if (player.alive){
    const [dx, dy] = playerDir();
    moveHole(player, dx, dy, dt);
    eatCheck(player, dt);
  }
  for (const h of holes){
    if (!h.isBot) continue;
    if (h.alive){
      botThink(h, timeNow);
      const [bx, bz] = botDir(h);
      moveHole(h, bx, bz, dt);
      eatCheck(h, dt);
    }
  }
  for (const h of holes){
    if (!h.alive){
      h.dyingT += dt;
      if (h.respawnAt > 0 && timeNow >= h.respawnAt){ h.respawnAt = 0; respawnHole(h); }
    }
  }
  holeVsHole();
  updateFalling(dt);
  updateVehicles(dt);
  updatePops(dt);
  processRespawns();
  if (MODE === 'endless') updateEndlessGrowth(dt);

  // 計時
  if (MODE === 'battle'){
    timeLeft -= dt;
    const sec = Math.ceil(timeLeft);
    if (sec !== lastTick){
      lastTick = sec;
      if (sec <= 5 && sec > 0){ sndTick(); document.getElementById('timer').classList.add('hurry'); }
    }
    if (timeLeft <= 0){ timeLeft = 0; endGame(); }
    const mm = Math.floor(timeLeft/60), ss = Math.floor(timeLeft%60);
    document.getElementById('timerVal').textContent = `${mm}:${ss.toString().padStart(2,'0')}`;
  } else {
    elapsed += dt;
    const mm = Math.floor(elapsed/60), ss = Math.floor(elapsed%60);
    document.getElementById('timerVal').textContent = `${mm}:${ss.toString().padStart(2,'0')}`;
  }
  if (timeNow - boardAt > 0.3){ boardAt = timeNow; updateBoard(); }
}

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock ? clock.getDelta() : 0.016, 0.05);
  if (playing) stepGame(dt);
  else timeNow += dt;

  for (const h of holes) updateHoleVisual(h, dt);
  for (let i = 0; i < 3; i++){
    const h = holes[i];
    if (h && h.alive) holesUniform.value[i].set(h.x, h.z, h.rShow);
    else if (h) holesUniform.value[i].set(h.x, h.z, Math.max(0, h.rShow*(1-h.dyingT*2)));
    else holesUniform.value[i].set(0, 0, 0);
  }
  updateCamera(dt);
  renderer.render(scene, camera);
}

const camPos = new THREE.Vector3(0, 14, 14);
const camLook = new THREE.Vector3();
function updateCamera(dt){
  const r = player ? player.rShow : CFG.START_RADIUS;
  const px = player ? player.x : 0, pz = player ? player.z : 6;
  const hgt = 8.5 + r * 3.6;
  camPos.x += (px - camPos.x) * Math.min(1, dt*6);
  camPos.y += (hgt - camPos.y) * Math.min(1, dt*4);
  camPos.z += ((pz + hgt*0.58) - camPos.z) * Math.min(1, dt*6);
  camera.position.copy(camPos);
  camLook.x += (px - camLook.x) * Math.min(1, dt*6);
  camLook.z += (pz - camLook.z) * Math.min(1, dt*6);
  camera.lookAt(camLook.x, 0, camLook.z);
}

// ============================================================ 結束
function endGame(){
  if (gameOver) return;
  gameOver = true;
  playing = false;
  sndEnd();
  document.getElementById('respawn').classList.add('hidden');
  const sorted = [...holes].sort((a,b) => b.score - a.score);
  const rank = sorted.indexOf(player) + 1;
  const medals = ['🥇','🥈','🥉'];
  if (MODE === 'battle'){
    document.getElementById('ovIcon').textContent = rank === 1 ? '🏆' : rank === 2 ? '🥈' : '🥉';
    document.getElementById('ovTitle').textContent = rank === 1 ? '你是第 1 名!' : `第 ${rank} 名`;
  } else {
    document.getElementById('ovIcon').textContent = '🕳️';
    document.getElementById('ovTitle').textContent = '這一場超能吃!';
  }
  let desc = `吃掉 ${player.eaten} 個東西`;
  if (player.biggest) desc += `,最大戰利品:${player.biggest}`;
  if (MODE === 'endless'){
    const mm = Math.floor(elapsed/60), ss = Math.floor(elapsed%60);
    desc += `,存活 ${mm}:${ss.toString().padStart(2,'0')},洞的大小 ${player.r.toFixed(1)}`;
  }
  document.getElementById('ovDesc').textContent = desc;
  document.getElementById('ovBoard').innerHTML = sorted.map((h, i) =>
    `<div class="row"><span>${medals[i]||''}</span><span class="dot" style="background:${h.color}"></span>` +
    `<span class="nm">${h.name}</span><span>${h.score}</span></div>`
  ).join('');
  document.getElementById('overlay').classList.remove('hidden');
}
document.getElementById('restartBtn').addEventListener('click', () => {
  location.href = location.pathname;   // 清掉 ?mode= 回到選單
});

function onResize(){
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
