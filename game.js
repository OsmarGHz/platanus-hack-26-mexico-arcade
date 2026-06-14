// Super Platanus — Arcade Edition
// Co-op bubble popper for Platanus Hack 26 CDMX
// Inspired by Super Pang — all graphics procedurally generated

const W = 800, H = 600;
const WALL_L = 48, WALL_R = 752, TOP_Y = 48, FLOOR_Y = 532;
const GRAVITY = 620;
const P_SPEED = 250;
const P_HW = 14, P_HH = 22; // player half-width, half-height
const HARP_SPEED = 950;

// Ball config per size (1=tiny..4=huge)
const BDATA = {
  4: { r: 50, col: 0xdc3030, glow: 0xff7070, bvy: -465, spd: 82,  pts: 10 },
  3: { r: 34, col: 0xe07820, glow: 0xffaa55, bvy: -415, spd: 112, pts: 20 },
  2: { r: 20, col: 0xcca800, glow: 0xffdd30, bvy: -365, spd: 155, pts: 40 },
  1: { r: 11, col: 0x18a850, glow: 0x40e880, bvy: -305, spd: 205, pts: 80 },
};

// Level definitions: [size, startX, dir(+1/-1)]
const LEVELS = [
  [[4,280,1],[4,520,-1]],
  [[4,250,1],[4,550,-1],[3,400,1]],
  [[4,210,1],[4,590,-1],[3,340,1],[2,460,-1]],
  [[4,180,1],[4,400,-1],[4,620,1],[3,290,-1]],
  [[4,160,1],[4,390,-1],[4,630,1],[3,275,1],[3,525,-1]],
  [[4,150,1],[4,350,-1],[4,550,1],[4,700,-1],[3,250,1],[2,430,-1]],
];

const NAME_GRID = [
  ['A','B','C','D','E','F','G'],
  ['H','I','J','K','L','M','N'],
  ['O','P','Q','R','S','T','U'],
  ['V','W','X','Y','Z','.','_'],
  ['DEL','OK'],
];

// Arcade cabinet button mapping — DO NOT remove or replace existing keys
const CABINET_KEYS = {
  P1_U:['w'],   P1_D:['s'],   P1_L:['a'],   P1_R:['d'],
  P1_1:['u'],   P1_2:['i'],   P1_3:['o'],
  P1_4:['j'],   P1_5:['k'],   P1_6:['l'],
  P2_U:['ArrowUp'], P2_D:['ArrowDown'], P2_L:['ArrowLeft'], P2_R:['ArrowRight'],
  P2_1:['r'],   P2_2:['t'],   P2_3:['y'],
  P2_4:['f'],   P2_5:['g'],   P2_6:['h'],
  START1:['Enter'], START2:['2'],
};

const K2A = {};
for (const [c, ks] of Object.entries(CABINET_KEYS))
  for (const k of ks) K2A[k.length === 1 ? k.toLowerCase() : k] = c;

const held = Object.create(null);
const pressed = Object.create(null);
window.addEventListener('keydown', e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key, c = K2A[k];
  if (c) { if (!held[c]) pressed[c] = true; held[c] = true; }
});
window.addEventListener('keyup', e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key, c = K2A[k];
  if (c) held[c] = false;
});
const cp = c => { const v = pressed[c]; pressed[c] = false; return !!v; };
const cpAny = cs => cs.some(c => cp(c));

// ── Phaser Game ───────────────────────────────────────────────────────────────
new Phaser.Game({
  type: Phaser.AUTO,
  width: W, height: H,
  parent: 'game-root',
  backgroundColor: '#050810',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
  scene: { preload, create, update },
});

function preload() {}

// ── Scene-level state ─────────────────────────────────────────────────────────
let sc;
let gBg, gWall, gBall, gHarp, gPlayer, gFx;
let phase = 'menu';
let level = 1, score = 0, lives = 3, twoPlayer = false;
let balls = [], players = [], harpoons = [], parts = [], popups = [];
let highScores = [];
let nameLetters = [], nameRow = 0, nameCol = 0, nameCd = 0;
let menuCursor = 0, menuCd = 0;
let lvlTimer = 0, flashTimer = 0, goTimer = 0;

// UI refs
let hudScoreTxt, hudLevelTxt, hudLivesTxt;
let menuCtn, goCtn, lvlCtn, nameCtn, savedCtn;
let menuBgs, menuLbls, menuScoresTxt;
let lvlTxt;
let nameScoreTxt, nameDisplayTxt, nameGrid = [];
let savedBodyTxt;

function create() {
  sc = this;
  gBg     = sc.add.graphics();
  gWall   = sc.add.graphics();
  gBall   = sc.add.graphics();
  gHarp   = sc.add.graphics();
  gPlayer = sc.add.graphics();
  gFx     = sc.add.graphics();

  drawBg();
  drawArena();
  buildHUD();
  buildMenu();
  buildGO();
  buildLvlClear();
  buildNameEntry();
  buildSaved();

  loadScores().then(s => { highScores = s; refreshMenuScores(); });
  showMenu();
}

// ── Main update ───────────────────────────────────────────────────────────────
function update(_, raw) {
  const dt = Math.min(raw / 1000, 0.05);
  if (flashTimer > 0) flashTimer -= raw;

  if (phase === 'menu')      { updateMenu(dt); return; }
  if (phase === 'playing')   { updateGame(dt); return; }
  if (phase === 'lvlclear')  { updateLvlClear(dt); return; }
  if (phase === 'nameentry') { updateNameEntry(dt); return; }
  if (phase === 'gameover')  { /* waiting for timer */ return; }
  if (phase === 'saved') {
    if (cpAny(['START1','START2','P1_1','P2_1'])) showMenu();
  }
}

// ── Background & Arena ────────────────────────────────────────────────────────
function drawBg() {
  const g = gBg;
  g.fillGradientStyle(0x050810, 0x050810, 0x0a1025, 0x0a1025, 1);
  g.fillRect(0, 0, W, H);
  g.lineStyle(1, 0x162040, 0.5);
  for (let x = 0; x <= W; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.strokePath(); }
  for (let y = 0; y <= H; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.strokePath(); }
  // Scanline overlay
  g.lineStyle(1, 0x000000, 0.12);
  for (let y = 0; y < H; y += 3) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.strokePath(); }
}

function drawArena() {
  const g = gWall;
  const FILL = 0x0e2040;
  const BORD = 0x2a6fff;
  // Walls fill
  g.fillStyle(FILL);
  g.fillRect(0, 0, WALL_L, H);
  g.fillRect(WALL_R, 0, W - WALL_R, H);
  g.fillRect(0, 0, W, TOP_Y);
  g.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
  // Neon border
  g.lineStyle(3, BORD, 1);
  g.strokeRect(WALL_L, TOP_Y, WALL_R - WALL_L, FLOOR_Y - TOP_Y);
  // Corner glow dots
  const corners = [[WALL_L, TOP_Y],[WALL_R, TOP_Y],[WALL_L, FLOOR_Y],[WALL_R, FLOOR_Y]];
  g.fillStyle(BORD);
  for (const [cx, cy] of corners) g.fillCircle(cx, cy, 5);
  // Wall decorations
  g.lineStyle(1, BORD, 0.25);
  for (let y = TOP_Y + 20; y < FLOOR_Y; y += 32) {
    g.beginPath(); g.moveTo(WALL_L - 8, y); g.lineTo(WALL_L - 2, y + 8); g.lineTo(WALL_L - 8, y + 16); g.strokePath();
    g.beginPath(); g.moveTo(WALL_R + 8, y); g.lineTo(WALL_R + 2, y + 8); g.lineTo(WALL_R + 8, y + 16); g.strokePath();
  }
}

// ── HUD ───────────────────────────────────────────────────────────────────────
function buildHUD() {
  const ts = { fontFamily:'monospace', fontSize:'18px', fontStyle:'bold' };
  hudScoreTxt = sc.add.text(W/2, 14, 'SCORE 0', { ...ts, color:'#e1ff00' }).setOrigin(0.5, 0).setDepth(5);
  hudLevelTxt = sc.add.text(WALL_R - 8, 14, 'LV 1', { ...ts, color:'#4a9eff' }).setOrigin(1, 0).setDepth(5);
  hudLivesTxt = sc.add.text(WALL_L + 8, 14, '♥ 3', { ...ts, color:'#ff6ec7' }).setOrigin(0, 0).setDepth(5);
}

function refreshHUD() {
  hudScoreTxt && hudScoreTxt.setText('SCORE ' + score);
  hudLevelTxt && hudLevelTxt.setText('LV ' + level);
  hudLivesTxt && hudLivesTxt.setText('♥ ' + Math.max(0, lives));
}

// ── Menu ──────────────────────────────────────────────────────────────────────
function buildMenu() {
  const c = sc.add.container(0, 0).setDepth(10);
  menuCtn = c;
  c.add(sc.add.rectangle(W/2, H/2, W, H, 0x050810, 0.97));

  // Decorative tree silhouette (Platanus!)
  const tg = sc.add.graphics();
  tg.lineStyle(2, 0x1a4020, 0.6);
  // Trunk
  tg.fillStyle(0x1a4020, 0.5); tg.fillRect(W - 80, H - 120, 14, 90);
  // Branches
  tg.fillStyle(0x1e5a28, 0.4);
  tg.fillCircle(W - 73, H - 130, 40); tg.fillCircle(W - 50, H - 150, 30); tg.fillCircle(W - 100, H - 145, 28);
  tg.fillStyle(0x22702e, 0.3);
  tg.fillCircle(W - 73, H - 155, 25);
  c.add(tg);

  const title = sc.add.text(W/2, 105, 'SUPER PLATANUS', {
    fontFamily:'monospace', fontSize:'50px', color:'#e1ff00', fontStyle:'bold',
  }).setOrigin(0.5);
  c.add(title);
  sc.tweens.add({ targets: title, scaleX: 1.02, scaleY: 1.02, alpha: 0.88, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  c.add(sc.add.text(W/2, 164, '🌿  POP ALL THE BUBBLES  🌿', {
    fontFamily:'monospace', fontSize:'15px', color:'#4a9eff',
  }).setOrigin(0.5));

  const opts = ['1 PLAYER', '2 PLAYERS CO-OP'];
  menuBgs = []; menuLbls = [];
  for (let i = 0; i < opts.length; i++) {
    const y = 236 + i * 58;
    const bg = sc.add.rectangle(W/2, y, 320, 46, 0x0d1a30, 0.95).setStrokeStyle(2, 0x1a3560, 0.8);
    const lbl = sc.add.text(W/2, y, opts[i], { fontFamily:'monospace', fontSize:'24px', color:'#c8d8f0', fontStyle:'bold' }).setOrigin(0.5);
    c.add(bg); c.add(lbl);
    menuBgs.push(bg); menuLbls.push(lbl);
  }

  c.add(sc.add.text(W/2, 374, 'TOP SCORES', { fontFamily:'monospace', fontSize:'13px', color:'#e1ff00', fontStyle:'bold' }).setOrigin(0.5));
  menuScoresTxt = sc.add.text(W/2, 394, 'NO SCORES YET', { fontFamily:'monospace', fontSize:'12px', color:'#a8b8d0', align:'center', lineSpacing:3 }).setOrigin(0.5, 0);
  c.add(menuScoresTxt);

  c.add(sc.add.text(W/2, H - 20, 'MOVE ↕   CONFIRM B1 / START', { fontFamily:'monospace', fontSize:'11px', color:'#1e3050' }).setOrigin(0.5));
  c.setVisible(false);
  refreshMenuHighlight();
}

function refreshMenuHighlight() {
  if (!menuBgs) return;
  menuBgs.forEach((bg, i) => {
    const act = i === menuCursor;
    bg.setFillStyle(act ? 0xe1ff00 : 0x0d1a30, act ? 1 : 0.95);
    bg.setStrokeStyle(2, act ? 0xffffff : 0x1a3560, act ? 1 : 0.8);
    menuLbls[i].setColor(act ? '#050810' : '#c8d8f0');
  });
}

function refreshMenuScores() {
  if (!menuScoresTxt) return;
  if (!highScores.length) { menuScoresTxt.setText('NO SCORES YET'); return; }
  menuScoresTxt.setText(
    highScores.slice(0, 5).map((e, i) =>
      `${String(i+1).padStart(2,'0')}  ${(e.name||'???').padEnd(3,' ')}  ${String(e.score||0).padStart(7,' ')}  LV${e.level||1}`
    ).join('\n')
  );
}

function showMenu() {
  phase = 'menu'; menuCursor = 0; menuCd = 0;
  menuCtn.setVisible(true);
  goCtn && goCtn.setVisible(false);
  nameCtn && nameCtn.setVisible(false);
  savedCtn && savedCtn.setVisible(false);
  lvlCtn && lvlCtn.setVisible(false);
  refreshMenuHighlight(); refreshMenuScores();
  gBall.clear(); gPlayer.clear(); gHarp.clear(); gFx.clear();
}

function updateMenu(dt) {
  menuCd -= dt;
  if (menuCd <= 0) {
    const up = held.P1_U || held.P2_U, dn = held.P1_D || held.P2_D;
    if (up || dn) {
      menuCursor = up ? Math.max(0, menuCursor - 1) : Math.min(1, menuCursor + 1);
      menuCd = 0.18; refreshMenuHighlight();
    }
  }
  if (cpAny(['P1_1','P2_1','P1_2','P2_2','START1','START2'])) {
    startGame(menuCursor === 1);
  }
}

// ── Game Start / Level ─────────────────────────────────────────────────────────
function startGame(tp) {
  twoPlayer = tp; level = 1; score = 0; lives = 3;
  menuCtn.setVisible(false);
  goCtn && goCtn.setVisible(false);
  savedCtn && savedCtn.setVisible(false);
  startLevel();
}

function startLevel() {
  balls = []; players = []; harpoons = []; parts = []; popups.forEach(p => p.t && p.t.destroy()); popups = [];
  phase = 'playing';

  const def = LEVELS[Math.min(level - 1, LEVELS.length - 1)];
  const lvlScale = 1 + (level - 1) * 0.07;
  for (const [sz, bx, dir] of def) {
    const d = BDATA[sz];
    spawnBall(bx, FLOOR_Y - d.r - 2, sz, d.spd * dir * lvlScale, d.bvy * (1 + (level-1)*0.035));
  }
  spawnPlayer(0, WALL_L + 90);
  if (twoPlayer) spawnPlayer(1, WALL_R - 90);

  lvlCtn && lvlCtn.setVisible(false);
  refreshHUD();
}

// ── Ball ──────────────────────────────────────────────────────────────────────
function spawnBall(x, y, size, vx, vy) {
  balls.push({ x, y, vx, vy, size, r: BDATA[size].r, active: true });
}

function updateBalls(dt) {
  for (const b of balls) {
    if (!b.active) continue;
    b.vy += GRAVITY * dt;
    b.x  += b.vx * dt;
    b.y  += b.vy * dt;
    if (b.x - b.r < WALL_L)  { b.x = WALL_L + b.r;  b.vx =  Math.abs(b.vx); }
    if (b.x + b.r > WALL_R)  { b.x = WALL_R - b.r;  b.vx = -Math.abs(b.vx); }
    if (b.y - b.r < TOP_Y)   { b.y = TOP_Y + b.r;   b.vy =  Math.abs(b.vy) * 0.6; }
    if (b.y + b.r > FLOOR_Y) {
      b.y = FLOOR_Y - b.r;
      const d = BDATA[b.size];
      b.vy = d.bvy * (1 + (level - 1) * 0.035);
    }
  }
}

function popBall(b, fromHarpIdx) {
  b.active = false;
  const d = BDATA[b.size];
  const pts = d.pts * (1 + Math.floor((level - 1) / 2));
  score += pts;
  spawnParts(b.x, b.y, d.glow, b.size * 6 + 4);
  spawnPopup(b.x, b.y - b.r, '+' + pts);
  sfxPop(b.size);
  if (b.size > 1) {
    const ns = b.size - 1, nd = BDATA[ns];
    const spd = nd.spd * (1 + (level - 1) * 0.07);
    spawnBall(b.x - 8, b.y, ns, -spd, nd.bvy * (1 + (level-1)*0.035));
    spawnBall(b.x + 8, b.y, ns,  spd, nd.bvy * (1 + (level-1)*0.035));
  }
}

// ── Player ────────────────────────────────────────────────────────────────────
function spawnPlayer(id, x) {
  players.push({ id, x, y: FLOOR_Y - P_HH, alive: true, invTimer: 0, respTimer: 0, shootCd: 0 });
  harpoons.push(null);
}

function updatePlayers(dt) {
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (!p.alive) {
      p.respTimer -= dt;
      if (p.respTimer <= 0 && lives > 0) { p.alive = true; p.invTimer = 2.8; p.x = i === 0 ? WALL_L + 90 : WALL_R - 90; }
      continue;
    }
    if (p.invTimer > 0) p.invTimer -= dt;
    if (p.shootCd > 0) p.shootCd -= dt;

    const lKey = i === 0 ? 'P1_L' : 'P2_L';
    const rKey = i === 0 ? 'P1_R' : 'P2_R';
    const shK  = i === 0 ? ['P1_1','P1_2','P1_3'] : ['P2_1','P2_2','P2_3'];

    if (held[lKey]) p.x -= P_SPEED * dt;
    if (held[rKey]) p.x += P_SPEED * dt;
    p.x = Math.max(WALL_L + P_HW + 2, Math.min(WALL_R - P_HW - 2, p.x));
    p.y = FLOOR_Y - P_HH;

    if (p.shootCd <= 0 && !harpoons[i] && shK.some(k => held[k])) {
      harpoons[i] = { x: p.x, top: p.y - P_HH - 2, bot: p.y - P_HH - 2, ext: true, owner: i };
      p.shootCd = 0.12;
      sfxShoot();
    }
  }
}

function killPlayer(p) {
  lives--;
  p.alive = false;
  p.respTimer = 2.2;
  const idx = players.indexOf(p);
  if (idx >= 0) harpoons[idx] = null;
  spawnParts(p.x, p.y, p.id === 0 ? 0xe1ff00 : 0xff6ec7, 14);
  sfxDeath();
  flashTimer = 350;
  refreshHUD();
  if (lives <= 0) { phase = 'gameover'; sc.time.delayedCall(1400, triggerGameOver, [], sc); }
}

// ── Harpoon ───────────────────────────────────────────────────────────────────
function updateHarpoons(dt) {
  for (let i = 0; i < harpoons.length; i++) {
    const h = harpoons[i];
    if (!h) continue;
    if (h.ext) {
      h.top -= HARP_SPEED * dt;
      if (h.top <= TOP_Y + 4) { h.top = TOP_Y + 4; h.ext = false; }
      if (checkHarpBalls(h, i)) continue;
    } else {
      h.top += HARP_SPEED * dt;
      if (h.top >= h.bot) harpoons[i] = null;
    }
  }
}

function checkHarpBalls(h, hi) {
  for (const b of balls) {
    if (!b.active) continue;
    if (Math.abs(h.x - b.x) > b.r + 5) continue;
    if (h.top > b.y + b.r || h.bot < b.y - b.r) continue;
    popBall(b, hi);
    harpoons[hi] = null;
    return true;
  }
  return false;
}

// ── Ball–Player Collision ─────────────────────────────────────────────────────
function checkBallPlayer() {
  for (const p of players) {
    if (!p.alive || p.invTimer > 0) continue;
    const px1 = p.x - P_HW, px2 = p.x + P_HW, py1 = p.y - P_HH, py2 = p.y + P_HH;
    for (const b of balls) {
      if (!b.active) continue;
      const cx = Math.max(px1, Math.min(px2, b.x));
      const cy = Math.max(py1, Math.min(py2, b.y));
      const dx = b.x - cx, dy = b.y - cy;
      if (dx*dx + dy*dy < b.r * b.r) { killPlayer(p); break; }
    }
  }
}

// ── Level Clear ───────────────────────────────────────────────────────────────
function checkLevelClear() {
  if (balls.every(b => !b.active)) {
    phase = 'lvlclear'; lvlTimer = 2.8;
    const bonus = level * 500;
    score += bonus;
    refreshHUD();
    sfxLevelClear();
    lvlCtn && lvlCtn.setVisible(true);
    lvlTxt && lvlTxt.setText(`LEVEL ${level} CLEAR!\n+${bonus} BONUS`);
    level++;
  }
}

function updateLvlClear(dt) {
  lvlTimer -= dt;
  if (lvlTimer <= 0) { lvlCtn && lvlCtn.setVisible(false); startLevel(); }
}

// ── Game Over ─────────────────────────────────────────────────────────────────
function triggerGameOver() {
  goCtn && goCtn.setVisible(true);
  if (goScoreTxt) goScoreTxt.setText('SCORE: ' + score);
  if (goLvlTxt)   goLvlTxt.setText('REACHED LEVEL ' + level);
  sc.time.delayedCall(2000, () => { goCtn && goCtn.setVisible(false); showNameEntry(); }, [], sc);
}

// ── Main Game Update ──────────────────────────────────────────────────────────
function updateGame(dt) {
  updateBalls(dt);
  updatePlayers(dt);
  updateHarpoons(dt);
  checkBallPlayer();
  updateParts(dt);
  updatePopups(dt);
  renderBalls();
  renderHarpoons();
  renderPlayers();
  renderFx();
  checkLevelClear();
}

// ── Rendering ─────────────────────────────────────────────────────────────────
function renderBalls() {
  gBall.clear();
  for (const b of balls) {
    if (!b.active) continue;
    const d = BDATA[b.size];
    // Outer glow
    gBall.fillStyle(d.glow, 0.10); gBall.fillCircle(b.x, b.y, b.r + 14);
    gBall.fillStyle(d.glow, 0.16); gBall.fillCircle(b.x, b.y, b.r + 7);
    // Body
    gBall.fillStyle(d.col, 1); gBall.fillCircle(b.x, b.y, b.r);
    // Inner shine
    gBall.fillStyle(0xffffff, 0.22); gBall.fillCircle(b.x - b.r * 0.32, b.y - b.r * 0.32, b.r * 0.38);
    gBall.fillStyle(0xffffff, 0.10); gBall.fillCircle(b.x - b.r * 0.22, b.y - b.r * 0.22, b.r * 0.18);
    // Face on larger balls
    if (b.size >= 2) {
      const ew = b.r * 0.19;
      // Eyes
      gBall.fillStyle(0x000000, 0.75);
      gBall.fillEllipse(b.x - b.r * 0.28, b.y - b.r * 0.08, ew * 1.2, ew * 1.5);
      gBall.fillEllipse(b.x + b.r * 0.28, b.y - b.r * 0.08, ew * 1.2, ew * 1.5);
      // Eye shine
      gBall.fillStyle(0xffffff, 0.9);
      gBall.fillCircle(b.x - b.r * 0.22, b.y - b.r * 0.14, ew * 0.38);
      gBall.fillCircle(b.x + b.r * 0.32, b.y - b.r * 0.14, ew * 0.38);
      // Angry brows
      gBall.lineStyle(Math.max(1.5, b.r * 0.07), 0x000000, 0.7);
      gBall.beginPath(); gBall.moveTo(b.x - b.r * 0.42, b.y - b.r * 0.3); gBall.lineTo(b.x - b.r * 0.12, b.y - b.r * 0.22); gBall.strokePath();
      gBall.beginPath(); gBall.moveTo(b.x + b.r * 0.42, b.y - b.r * 0.3); gBall.lineTo(b.x + b.r * 0.12, b.y - b.r * 0.22); gBall.strokePath();
      // Mouth
      gBall.lineStyle(Math.max(1.5, b.r * 0.055), 0x000000, 0.7);
      gBall.beginPath();
      gBall.arc(b.x, b.y + b.r * 0.18, b.r * 0.24, 0.25, Math.PI - 0.25, false);
      gBall.strokePath();
    }
  }
}

const P_COLS = [0xe1ff00, 0xff6ec7];
function renderPlayers() {
  gPlayer.clear();
  const t = sc.time.now / 1000;
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const col = P_COLS[i];
    if (!p.alive) {
      // Ghost indicator while respawning
      if (lives > 0) {
        gPlayer.fillStyle(col, 0.25 + 0.2 * Math.sin(t * 9));
        gPlayer.fillCircle(i === 0 ? WALL_L + 90 : WALL_R - 90, FLOOR_Y - P_HH, 18);
        gPlayer.fillStyle(col, 0.12 + 0.1 * Math.sin(t * 9));
        gPlayer.fillCircle(i === 0 ? WALL_L + 90 : WALL_R - 90, FLOOR_Y - P_HH, 28);
      }
      continue;
    }
    // Blink during invincibility
    if (p.invTimer > 0 && Math.floor(t * 10) % 2 === 0) continue;

    const x = p.x, y = p.y;
    // Ground shadow
    gPlayer.fillStyle(0x000000, 0.2); gPlayer.fillEllipse(x, FLOOR_Y + 2, P_HW * 2 + 8, 7);
    // Body glow aura
    gPlayer.fillStyle(col, 0.1); gPlayer.fillCircle(x, y, P_HW + 10);
    // Legs
    gPlayer.fillStyle(col, 0.85);
    gPlayer.fillRect(x - P_HW + 2, y + P_HH - 10, P_HW - 3, 10);
    gPlayer.fillRect(x + 2, y + P_HH - 10, P_HW - 3, 10);
    // Feet
    gPlayer.fillStyle(col, 1);
    gPlayer.fillRect(x - P_HW, y + P_HH - 2, P_HW - 1, 4);
    gPlayer.fillRect(x + 2, y + P_HH - 2, P_HW - 1, 4);
    // Body (suit)
    gPlayer.fillStyle(col, 1);
    gPlayer.fillRoundedRect(x - P_HW + 2, y - P_HH + 12, (P_HW - 2) * 2, P_HH, 5);
    // Suit stripe
    gPlayer.fillStyle(0x050810, 0.4);
    gPlayer.fillRect(x - 2, y - P_HH + 14, 4, P_HH - 4);
    // Helmet base
    gPlayer.fillStyle(col, 1); gPlayer.fillCircle(x, y - P_HH + 9, P_HW - 1);
    // Visor
    gPlayer.fillStyle(0x050810, 0.88); gPlayer.fillEllipse(x, y - P_HH + 8, P_HW * 1.5, P_HW);
    // Visor shine
    gPlayer.fillStyle(0x88ccff, 0.55); gPlayer.fillEllipse(x - 3, y - P_HH + 6, 8, 5);
    // Cannon tube
    gPlayer.fillStyle(col, 1); gPlayer.fillRect(x - 3, y - P_HH - 6, 6, 16);
    gPlayer.fillStyle(0xffffff, 0.35); gPlayer.fillRect(x - 1, y - P_HH - 6, 2, 16);
    // Cannon tip flash ring
    gPlayer.lineStyle(2, col, 0.6); gPlayer.strokeCircle(x, y - P_HH - 8, 5);
  }
}

function renderHarpoons() {
  gHarp.clear();
  for (let i = 0; i < harpoons.length; i++) {
    const h = harpoons[i];
    if (!h) continue;
    const col = i === 0 ? 0xe1ff00 : 0xff6ec7;
    // Glow
    gHarp.lineStyle(7, col, 0.18); gHarp.beginPath(); gHarp.moveTo(h.x, h.bot); gHarp.lineTo(h.x, h.top); gHarp.strokePath();
    // Wire
    gHarp.lineStyle(2, 0xffffff, 0.92); gHarp.beginPath(); gHarp.moveTo(h.x, h.bot); gHarp.lineTo(h.x, h.top); gHarp.strokePath();
    // Arrowhead tip
    gHarp.fillStyle(col, 1);
    gHarp.fillTriangle(h.x - 5, h.top + 9, h.x + 5, h.top + 9, h.x, h.top);
  }
}

function renderFx() {
  gFx.clear();
  for (const p of parts) {
    if (p.life <= 0) continue;
    const a = (p.life / p.maxLife) * 0.9;
    gFx.fillStyle(p.col, a); gFx.fillCircle(p.x, p.y, p.r * (p.life / p.maxLife));
  }
  if (flashTimer > 0) { gFx.fillStyle(0xff0000, (flashTimer / 350) * 0.22); gFx.fillRect(0, 0, W, H); }
}

// ── Particles ─────────────────────────────────────────────────────────────────
function spawnParts(x, y, col, n) {
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i / n) + Math.random() * 0.6;
    const spd = 70 + Math.random() * 170;
    const life = 0.5 + Math.random() * 0.55;
    parts.push({ x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd - 50, r: 2.5 + Math.random()*3.5, col, life, maxLife: life });
  }
  if (parts.length > 240) parts.splice(0, parts.length - 240);
}

function updateParts(dt) {
  for (const p of parts) {
    if (p.life <= 0) continue;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += 210 * dt;
    p.life -= dt;
  }
}

// ── Score Popups ──────────────────────────────────────────────────────────────
function spawnPopup(x, y, txt) {
  const t = sc.add.text(x, y, txt, { fontFamily:'monospace', fontSize:'20px', color:'#ffffff', fontStyle:'bold' }).setOrigin(0.5).setDepth(30);
  popups.push({ t, life: 1.1, vy: -75 });
}

function updatePopups(dt) {
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.t.y += p.vy * dt; p.vy *= 0.95;
    p.life -= dt; p.t.setAlpha(Math.max(0, p.life));
    if (p.life <= 0) { p.t.destroy(); popups.splice(i, 1); }
  }
}

// ── Screens ───────────────────────────────────────────────────────────────────
let goScoreTxt, goLvlTxt;
function buildGO() {
  const c = sc.add.container(0, 0).setDepth(20);
  goCtn = c;
  c.add(sc.add.rectangle(W/2, H/2, W, H, 0x050810, 0.95));
  c.add(sc.add.text(W/2, 110, 'GAME OVER', { fontFamily:'monospace', fontSize:'52px', color:'#ff4040', fontStyle:'bold' }).setOrigin(0.5));
  goScoreTxt = sc.add.text(W/2, 182, '', { fontFamily:'monospace', fontSize:'26px', color:'#e1ff00' }).setOrigin(0.5);
  goLvlTxt   = sc.add.text(W/2, 218, '', { fontFamily:'monospace', fontSize:'18px', color:'#4a9eff' }).setOrigin(0.5);
  c.add(goScoreTxt); c.add(goLvlTxt);
  c.setVisible(false);
}

function buildLvlClear() {
  const c = sc.add.container(0, 0).setDepth(20);
  lvlCtn = c;
  c.add(sc.add.rectangle(W/2, H/2, W, H, 0x050810, 0.72));
  lvlTxt = sc.add.text(W/2, H/2 - 20, '', { fontFamily:'monospace', fontSize:'40px', color:'#e1ff00', fontStyle:'bold', align:'center' }).setOrigin(0.5);
  c.add(lvlTxt);
  c.setVisible(false);
}

let nameDisplayTxt2;
function buildNameEntry() {
  const c = sc.add.container(0, 0).setDepth(22);
  nameCtn = c;
  c.add(sc.add.rectangle(W/2, H/2, W, H, 0x050810, 0.97));
  c.add(sc.add.text(W/2, 38, 'ENTER YOUR NAME', { fontFamily:'monospace', fontSize:'26px', color:'#e1ff00', fontStyle:'bold' }).setOrigin(0.5));
  nameScoreTxt = sc.add.text(W/2, 72, '', { fontFamily:'monospace', fontSize:'16px', color:'#c8d8f0' }).setOrigin(0.5);
  c.add(nameScoreTxt);
  nameDisplayTxt2 = sc.add.text(W/2, 114, '___', { fontFamily:'monospace', fontSize:'42px', color:'#ff6ec7', fontStyle:'bold', letterSpacing:14 }).setOrigin(0.5);
  c.add(nameDisplayTxt2);

  // Letter grid
  for (let row = 0; row < NAME_GRID.length; row++) {
    const row_items = NAME_GRID[row];
    const rw = row_items.length * 62;
    for (let col = 0; col < row_items.length; col++) {
      const val = row_items[col];
      const cx = W/2 - rw/2 + 31 + col * 62;
      const cy = 194 + row * 38;
      const bg = sc.add.rectangle(cx, cy, val.length > 1 ? 70 : 50, 30, 0x0d1a30, 0.95).setStrokeStyle(2, 0x1a3560, 0.7);
      const lbl = sc.add.text(cx, cy, val, { fontFamily:'monospace', fontSize: val.length > 1 ? '13px' : '19px', color:'#c8d8f0', fontStyle:'bold' }).setOrigin(0.5);
      c.add(bg); c.add(lbl);
      nameGrid.push({ bg, lbl, row, col, val });
    }
  }
  c.add(sc.add.text(W/2, H - 18, 'JOYSTICK MOVE   BUTTON SELECT', { fontFamily:'monospace', fontSize:'11px', color:'#1e3050' }).setOrigin(0.5));
  c.setVisible(false);
}

function buildSaved() {
  const c = sc.add.container(0, 0).setDepth(23);
  savedCtn = c;
  c.add(sc.add.rectangle(W/2, H/2, W, H, 0x050810, 0.97));
  c.add(sc.add.text(W/2, H/2 - 80, '🏆  SCORE SAVED!', { fontFamily:'monospace', fontSize:'34px', color:'#e1ff00', fontStyle:'bold' }).setOrigin(0.5));
  savedBodyTxt = sc.add.text(W/2, H/2, '', { fontFamily:'monospace', fontSize:'16px', color:'#a8b8d0', align:'center', lineSpacing:5 }).setOrigin(0.5);
  c.add(savedBodyTxt);
  c.add(sc.add.text(W/2, H - 24, 'PRESS START TO CONTINUE', { fontFamily:'monospace', fontSize:'13px', color:'#1e3050' }).setOrigin(0.5));
  c.setVisible(false);
}

function showNameEntry() {
  phase = 'nameentry'; nameLetters = []; nameRow = 0; nameCol = 0; nameCd = 0;
  nameCtn.setVisible(true);
  nameScoreTxt && nameScoreTxt.setText('SCORE: ' + score + '   LEVEL: ' + level);
  refreshNameDisplay(); refreshNameGrid();
}

function refreshNameDisplay() {
  const s = nameLetters.join('').padEnd(3, '_').slice(0, 3);
  nameDisplayTxt2 && nameDisplayTxt2.setText(s);
}

function refreshNameGrid() {
  for (const obj of nameGrid) {
    const act = obj.row === nameRow && obj.col === nameCol;
    obj.bg.setFillStyle(act ? 0xe1ff00 : 0x0d1a30, act ? 1 : 0.95);
    obj.bg.setStrokeStyle(2, act ? 0xffffff : 0x1a3560, act ? 1 : 0.7);
    obj.lbl.setColor(act ? '#050810' : '#c8d8f0');
  }
}

function updateNameEntry(dt) {
  nameCd -= dt;
  if (nameCd <= 0) {
    const up = held.P1_U||held.P2_U, dn = held.P1_D||held.P2_D;
    const lt = held.P1_L||held.P2_L, rt = held.P1_R||held.P2_R;
    let mv = false;
    if (up && nameRow > 0)                                      { nameRow--; mv = true; }
    else if (dn && nameRow < NAME_GRID.length - 1)             { nameRow++; mv = true; }
    else if (lt && nameCol > 0)                                 { nameCol--; mv = true; }
    else if (rt && nameCol < NAME_GRID[nameRow].length - 1)    { nameCol++; mv = true; }
    if (mv) { nameCol = Math.min(nameCol, NAME_GRID[nameRow].length - 1); nameCd = 0.16; refreshNameGrid(); }
  }
  if (cpAny(['P1_1','P2_1','P1_2','P2_2','START1','START2'])) {
    const val = NAME_GRID[nameRow][nameCol];
    if (val === 'DEL') { if (nameLetters.length > 0) nameLetters.pop(); }
    else if (val === 'OK') { doSubmit(); return; }
    else if (nameLetters.length < 3) {
      nameLetters.push(val);
      if (nameLetters.length === 3) { doSubmit(); return; }
    }
    refreshNameDisplay();
  }
}

async function doSubmit() {
  const name = (nameLetters.join('') || 'AAA').padEnd(3, 'A').slice(0, 3);
  nameCtn.setVisible(false);
  const updated = await saveScore(name, score, level);
  highScores = updated;
  refreshMenuScores();
  phase = 'saved';
  savedCtn.setVisible(true);
  if (savedBodyTxt) {
    const lines = highScores.slice(0, 8).map((e, i) =>
      `${String(i+1).padStart(2,'0')}  ${(e.name||'???').padEnd(3,' ')}  ${String(e.score||0).padStart(7,' ')}  LV${e.level||1}`
    );
    savedBodyTxt.setText(lines.join('\n'));
  }
}

// ── Audio (Web Audio API) ─────────────────────────────────────────────────────
function tone(freq, type, dur, vol = 0.28, delay = 0) {
  try {
    const ctx = sc.sound.context;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime + delay);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(ctx.currentTime + delay); osc.stop(ctx.currentTime + delay + dur);
  } catch(e) {}
}

function sfxShoot() { tone(920, 'square', 0.055, 0.12); tone(460, 'square', 0.04, 0.06, 0.04); }

function sfxPop(size) {
  const f = [0, 400, 270, 185, 115][size] || 200;
  tone(f, 'sine', 0.2, 0.28); tone(f * 1.6, 'sine', 0.12, 0.14, 0.07);
}

function sfxDeath() {
  tone(220, 'sawtooth', 0.25, 0.4); tone(140, 'sawtooth', 0.28, 0.35, 0.14); tone(85, 'sawtooth', 0.35, 0.3, 0.32);
}

function sfxLevelClear() {
  [440, 554, 659, 880, 1108].forEach((f, i) => tone(f, 'sine', 0.28, 0.32, i * 0.1));
}

// ── Storage ───────────────────────────────────────────────────────────────────
function getStorage() {
  if (window.platanusArcadeStorage) return window.platanusArcadeStorage;
  return {
    async get(k) {
      try { const r = localStorage.getItem(k); return r ? { found: true, value: JSON.parse(r) } : { found: false, value: null }; }
      catch { return { found: false, value: null }; }
    },
    async set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
}

async function loadScores() {
  const r = await getStorage().get('super-platanus-v1');
  return r.found && Array.isArray(r.value) ? r.value : [];
}

async function saveScore(name, sc_score, sc_level) {
  let s = await loadScores();
  s.push({ name, score: sc_score, level: sc_level });
  s.sort((a, b) => b.score - a.score);
  s = s.slice(0, 12);
  await getStorage().set('super-platanus-v1', s);
  return s;
}
