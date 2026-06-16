// Super Platanus — Arcade Edition
// Co-op bubble popper for Platanus Hack 26 CDMX
// Inspired by Super Pang — all graphics procedurally generated

const W = 800, H = 600;
const WALL_L = 48, WALL_R = 752, TOP_Y = 48, FLOOR_Y = 532;
const GRAVITY = 620;
const P_SPEED = 250;
const P_HW = 10, P_HH = 26;
const HARP_SPEED = 950;
const MACHINE_BURST_CD = 0.20; // time between fan bursts
const MACHINE_DUR = 12;       // machine gun duration in seconds
const MACHINE_N = 4;           // bullets per fan burst
const BULLET_SPEED = 780;      // bullet travel speed px/s

const BDATA = {
  4: { r: 50, col: 0xdc3030, glow: 0xff7070, bvy: -465, spd: 82, pts: 10 },
  3: { r: 34, col: 0xe07820, glow: 0xffaa55, bvy: -415, spd: 112, pts: 20 },
  2: { r: 20, col: 0xcca800, glow: 0xffdd30, bvy: -365, spd: 155, pts: 40 },
  1: { r: 11, col: 0x18a850, glow: 0x40e880, bvy: -305, spd: 205, pts: 80 },
};

const LEVELS = [
  [[4, 280, 1], [4, 520, -1]],
  [[4, 250, 1], [4, 550, -1], [3, 400, 1]],
  [[4, 210, 1], [4, 590, -1], [3, 340, 1], [2, 460, -1]],
  [[4, 180, 1], [4, 400, -1], [4, 620, 1], [3, 290, -1]],
  [[4, 160, 1], [4, 390, -1], [4, 630, 1], [3, 275, 1], [3, 525, -1]],
  [[4, 150, 1], [4, 350, -1], [4, 550, 1], [4, 700, -1], [3, 250, 1], [2, 430, -1]],
];

// Platforms per level: {x, y, w, h} — balls bounce off top surface
const PLAT = [
  [{ x: 270, y: 358, w: 260, h: 10 }],
  [{ x: 145, y: 332, w: 155, h: 10 }, { x: 500, y: 348, w: 155, h: 10 }],
  [{ x: 132, y: 308, w: 145, h: 10 }, { x: 505, y: 330, w: 145, h: 10 }],
  [{ x: 126, y: 342, w: 118, h: 10 }, { x: 338, y: 278, w: 124, h: 10 }, { x: 556, y: 358, w: 118, h: 10 }],
  [{ x: 120, y: 316, w: 108, h: 10 }, { x: 290, y: 254, w: 112, h: 10 }, { x: 468, y: 316, w: 108, h: 10 }, { x: 575, y: 386, w: 104, h: 10 }],
  [{ x: 108, y: 296, w: 94, h: 10 }, { x: 258, y: 234, w: 94, h: 10 }, { x: 402, y: 296, w: 96, h: 10 }, { x: 548, y: 356, w: 94, h: 10 }, { x: 646, y: 276, w: 94, h: 10 }],
];

// Items: prob sums to 1.0 (life excluded from random pool, handled separately)
const ITEM_TYPES = [
  { type: 'life', col: 0xff4488, glow: 0xff88bb, label: '+1', prob: 0 },
  { type: 'double', col: 0x44aaff, glow: 0x88ccff, label: '2x', prob: 0.18 },
  { type: 'wide', col: 0xffaa00, glow: 0xffdd80, label: '||', prob: 0.16 },
  { type: 'sticky', col: 0xff8844, glow: 0xffcc88, label: '@', prob: 0.16 },
  { type: 'machine', col: 0xff2244, glow: 0xff6688, label: 'MG', prob: 0.15 },
  { type: 'freeze', col: 0x00eeff, glow: 0x80f8ff, label: '*', prob: 0.15 },
  { type: 'shield', col: 0xaaffaa, glow: 0xccffcc, label: 'SH', prob: 0.13 },
  { type: 'dynamite', col: 0xff6600, glow: 0xff9944, label: 'TNT', prob: 0.14 },
  // sum of non-life ≈ 1.07, normalized internally
];

const NAME_GRID = [
  ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  ['H', 'I', 'J', 'K', 'L', 'M', 'N'],
  ['O', 'P', 'Q', 'R', 'S', 'T', 'U'],
  ['V', 'W', 'X', 'Y', 'Z', '.', '_'],
  ['DEL', 'OK'],
];

// DO NOT remove or replace existing keys — they map to physical cabinet
const CABINET_KEYS = {
  P1_U: ['w'], P1_D: ['s'], P1_L: ['a'], P1_R: ['d'],
  P1_1: ['u'], P1_2: ['i'], P1_3: ['o'],
  P1_4: ['j'], P1_5: ['k'], P1_6: ['l'],
  P2_U: ['ArrowUp'], P2_D: ['ArrowDown'], P2_L: ['ArrowLeft'], P2_R: ['ArrowRight'],
  P2_1: ['r'], P2_2: ['t'], P2_3: ['y'],
  P2_4: ['f'], P2_5: ['g'], P2_6: ['h'],
  START1: ['Enter'], START2: ['2'],
};

const K2A = {};
for (const [c, ks] of Object.entries(CABINET_KEYS))
  for (const k of ks) K2A[k.length === 1 ? k.toLowerCase() : k] = c;

const held = Object.create(null), pressed = Object.create(null);
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
  type: Phaser.AUTO, width: W, height: H, parent: 'game-root',
  backgroundColor: '#050810',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
  scene: { preload, create, update },
});

function preload() { }

// ── State ─────────────────────────────────────────────────────────────────────
let sc;
let gBg, gLvlBg, gWall, gBall, gHarp, gPlayer, gFx, gMenuBubbles;
let phase = 'menu';
let level = 1, score = 0, lives = 3, twoPlayer = false;
let balls = [], players = [], harpoons = [], harpoons2 = [], bullets = [], parts = [], popups = [], items = [];
let highScores = [];
let nameLetters = [], nameRow = 0, nameCol = 0, nameCd = 0;
let menuCursor = 0, menuCd = 0;
let lvlTimer = 0, flashTimer = 0;
let freezeTimer = 0;
let curPlatforms = [];
let lifeDroppedThisLevel = false;
let menuBubbles = [], menuBubbleTimer = 0;
let ctrlsCtn; // controls/how-to-play screen
let pendingTwoPlayer = false; // stored mode before showing controls

let hudScoreTxt, hudLevelTxt, hudLivesTxt;
let menuCtn, goCtn, lvlCtn, nameCtn, savedCtn;
let menuBgs, menuLbls, menuScoresTxt;
let lvlTxt, goScoreTxt, goLvlTxt;
let nameScoreTxt, nameDisplayTxt2, nameGrid = [];
let savedBodyTxt, freezeTxt;

function create() {
  sc = this;
  gBg = sc.add.graphics();
  gLvlBg = sc.add.graphics(); // level-specific city background
  gMenuBubbles = sc.add.graphics(); // menu bubbles — added to container so it renders above bg
  gWall = sc.add.graphics(); gBall = sc.add.graphics();
  gHarp = sc.add.graphics(); gPlayer = sc.add.graphics(); gFx = sc.add.graphics();
  drawBg(); drawArena();
  buildHUD(); buildMenu(); buildGO(); buildLvlClear(); buildNameEntry(); buildSaved(); buildControls();
  // Freeze countdown display (center screen, big)
  freezeTxt = sc.add.text(W / 2, H / 2 - 70, '', {
    fontFamily: 'monospace', fontSize: '90px', color: '#00eeff', fontStyle: 'bold',
    stroke: '#004466', strokeThickness: 8, shadow: { blur: 20, color: '#00eeff', fill: true }
  }).setOrigin(0.5).setDepth(50).setVisible(false);
  loadScores().then(s => { highScores = s; refreshMenuScores(); });
  showMenu();
}

function update(_, raw) {
  const dt = Math.min(raw / 1000, 0.05);
  if (flashTimer > 0) flashTimer -= raw;
  if (phase === 'menu') { updateMenu(dt); return; }
  if (phase === 'controls') { updateControls(dt); return; }
  if (phase === 'playing') { updateGame(dt); return; }
  if (phase === 'lvlclear') { updateLvlClear(dt); return; }
  if (phase === 'nameentry') { updateNameEntry(dt); return; }
  if (phase === 'gameover') return;
  if (phase === 'saved' && cpAny(['START1', 'START2', 'P1_1', 'P2_1'])) showMenu();
}

// ── Background & Arena ────────────────────────────────────────────────────────
function drawBg() {
  const g = gBg;
  g.fillGradientStyle(0x050810, 0x050810, 0x0a1025, 0x0a1025, 1); g.fillRect(0, 0, W, H);
  g.lineStyle(1, 0x162040, 0.5);
  for (let x = 0; x <= W; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.strokePath(); }
  for (let y = 0; y <= H; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.strokePath(); }
  g.lineStyle(1, 0x000000, 0.12);
  for (let y = 0; y < H; y += 3) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.strokePath(); }
}

function drawArena() {
  const g = gWall, FILL = 0x0e2040, BORD = 0x2a6fff;
  g.fillStyle(FILL);
  g.fillRect(0, 0, WALL_L, H); g.fillRect(WALL_R, 0, W - WALL_R, H);
  g.fillRect(0, 0, W, TOP_Y); g.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
  g.lineStyle(3, BORD, 1); g.strokeRect(WALL_L, TOP_Y, WALL_R - WALL_L, FLOOR_Y - TOP_Y);
  g.fillStyle(BORD);
  [[WALL_L, TOP_Y], [WALL_R, TOP_Y], [WALL_L, FLOOR_Y], [WALL_R, FLOOR_Y]].forEach(([cx, cy]) => g.fillCircle(cx, cy, 5));
  g.lineStyle(1, BORD, 0.25);
  for (let y = TOP_Y + 20; y < FLOOR_Y; y += 32) {
    g.beginPath(); g.moveTo(WALL_L - 8, y); g.lineTo(WALL_L - 2, y + 8); g.lineTo(WALL_L - 8, y + 16); g.strokePath();
    g.beginPath(); g.moveTo(WALL_R + 8, y); g.lineTo(WALL_R + 2, y + 8); g.lineTo(WALL_R + 8, y + 16); g.strokePath();
  }
}

function drawPlatforms() {
  for (const pl of curPlatforms) {
    // Shadow glow beneath platform
    gLvlBg.fillStyle(0x2a6fff, 0.09); gLvlBg.fillRect(pl.x - 8, pl.y + 4, pl.w + 16, 22);
    // Platform body
    gLvlBg.fillStyle(0x0e2040, 1); gLvlBg.fillRect(pl.x, pl.y, pl.w, pl.h);
    // Bright top edge
    gLvlBg.fillStyle(0x4a9eff, 1); gLvlBg.fillRect(pl.x, pl.y, pl.w, 2);
    // Mid fill
    gLvlBg.fillStyle(0x1a5090, 0.9); gLvlBg.fillRect(pl.x, pl.y + 2, pl.w, pl.h - 2);
    // End caps
    gLvlBg.fillStyle(0x4a9eff, 0.85); gLvlBg.fillRect(pl.x, pl.y, 5, pl.h); gLvlBg.fillRect(pl.x + pl.w - 5, pl.y, 5, pl.h);
    // Outline
    gLvlBg.lineStyle(1, 0x2a6fff, 0.45); gLvlBg.strokeRect(pl.x, pl.y, pl.w, pl.h);
  }
}

// ── HUD ───────────────────────────────────────────────────────────────────────
function buildHUD() {
  const ts = { fontFamily: 'monospace', fontSize: '18px', fontStyle: 'bold' };
  hudScoreTxt = sc.add.text(W / 2, 14, 'PUNTOS 0', { ...ts, color: '#e1ff00' }).setOrigin(0.5, 0).setDepth(5);
  hudLevelTxt = sc.add.text(WALL_R - 8, 14, 'NV 1', { ...ts, color: '#4a9eff' }).setOrigin(1, 0).setDepth(5);
  hudLivesTxt = sc.add.text(WALL_L + 8, 14, '♥ 3', { ...ts, color: '#ff6ec7' }).setOrigin(0, 0).setDepth(5);
}
function refreshHUD() {
  hudScoreTxt && hudScoreTxt.setText('PUNTOS ' + score);
  hudLevelTxt && hudLevelTxt.setText('NV ' + level);
  hudLivesTxt && hudLivesTxt.setText('♥ ' + Math.max(0, lives));
}

// ── Menu ──────────────────────────────────────────────────────────────────────
function buildMenu() {
  const c = sc.add.container(0, 0).setDepth(10); menuCtn = c;
  c.add(sc.add.rectangle(W / 2, H / 2, W, H, 0x050810, 0.90));
  // Bubbles graphics inside container so they appear above the bg rect
  c.add(gMenuBubbles);
  const tg = sc.add.graphics();
  tg.fillStyle(0x1a4020, 0.5); tg.fillRect(W - 80, H - 120, 14, 90);
  tg.fillStyle(0x1e5a28, 0.4);
  tg.fillCircle(W - 73, H - 130, 40); tg.fillCircle(W - 50, H - 150, 30); tg.fillCircle(W - 100, H - 145, 28);
  tg.fillStyle(0x22702e, 0.3); tg.fillCircle(W - 73, H - 155, 25);
  c.add(tg);
  const title = sc.add.text(W / 2, 100, 'SUPER PLATANUS', { fontFamily: 'monospace', fontSize: '50px', color: '#e1ff00', fontStyle: 'bold' }).setOrigin(0.5);
  c.add(title);
  sc.tweens.add({ targets: title, scaleX: 1.02, scaleY: 1.02, alpha: 0.88, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  // Rotating description lines (in Spanish)
  const descLines = [
    '🌿  EXPLOTA TODAS LAS BURBUJAS  🌿',
    '💥  ¡SOBREVIVE AL CAOS!  💥',
    '🍌  HÉROE ARCADE PLATANERO  🍌',
    '⚡  6 CIUDADES MEXICANAS  ⚡',
    '🎮  CO-OP O EN SOLITARIO  🎮',
  ];
  const descTxt = sc.add.text(W / 2, 158, descLines[0], { fontFamily: 'monospace', fontSize: '13px', color: '#4a9eff' }).setOrigin(0.5);
  c.add(descTxt);
  let descIdx = 0;
  sc.time.addEvent({
    delay: 2200, loop: true, callback: () => {
      if (phase !== 'menu') return;
      descIdx = (descIdx + 1) % descLines.length;
      sc.tweens.add({
        targets: descTxt, alpha: 0, duration: 220, onComplete: () => {
          descTxt.setText(descLines[descIdx]);
          sc.tweens.add({ targets: descTxt, alpha: 1, duration: 220 });
        }
      });
    }
  });
  menuBgs = []; menuLbls = [];
  ['1 JUGADOR', '2 JUGADORES CO-OP'].forEach((opt, i) => {
    const y = 232 + i * 58;
    const bg = sc.add.rectangle(W / 2, y, 340, 46, 0x0d1a30, 0.95).setStrokeStyle(2, 0x1a3560, 0.8);
    const lbl = sc.add.text(W / 2, y, opt, { fontFamily: 'monospace', fontSize: '24px', color: '#c8d8f0', fontStyle: 'bold' }).setOrigin(0.5);
    c.add(bg); c.add(lbl); menuBgs.push(bg); menuLbls.push(lbl);
  });
  c.add(sc.add.text(W / 2, 366, 'MEJORES PUNTAJES', { fontFamily: 'monospace', fontSize: '13px', color: '#e1ff00', fontStyle: 'bold' }).setOrigin(0.5));
  menuScoresTxt = sc.add.text(W / 2, 384, 'SIN PUNTAJES AÚN', { fontFamily: 'monospace', fontSize: '12px', color: '#a8b8d0', align: 'center', lineSpacing: 3 }).setOrigin(0.5, 0);
  c.add(menuScoresTxt);
  c.add(sc.add.text(W / 2, H - 20, 'MOVER ↕   CONFIRMAR B1 / START', { fontFamily: 'monospace', fontSize: '11px', color: '#1e3050' }).setOrigin(0.5));
  c.setVisible(false); refreshMenuHighlight();
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
  if (!highScores.length) { menuScoresTxt.setText('SIN PUNTAJES AÚN'); return; }
  menuScoresTxt.setText(
    highScores.slice(0, 5).map((e, i) =>
      `${String(i + 1).padStart(2, '0')}  ${(e.name || '???').padEnd(3, ' ')}  ${String(e.score || 0).padStart(7, ' ')}  NV${e.level || 1}`
    ).join('\n')
  );
}

function showMenu() {
  phase = 'menu'; menuCursor = 0; menuCd = 0;
  menuCtn.setVisible(true);
  ctrlsCtn && ctrlsCtn.setVisible(false);
  goCtn && goCtn.setVisible(false); nameCtn && nameCtn.setVisible(false);
  savedCtn && savedCtn.setVisible(false); lvlCtn && lvlCtn.setVisible(false);
  refreshMenuHighlight(); refreshMenuScores();
  gBall.clear(); gPlayer.clear(); gHarp.clear(); gFx.clear();
  // Spawn initial menu bubbles
  menuBubbles = [];
  for (let i = 0; i < 14; i++) spawnMenuBubble(true);
}

function updateMenu(dt) {
  // Update animated menu bubbles
  menuBubbleTimer -= dt;
  if (menuBubbleTimer <= 0) { spawnMenuBubble(false); menuBubbleTimer = 0.6 + Math.random() * 0.8; }
  updateMenuBubbles(dt);
  drawMenuBubbles();

  menuCd -= dt;
  if (menuCd <= 0) {
    const up = held.P1_U || held.P2_U, dn = held.P1_D || held.P2_D;
    if (up || dn) { menuCursor = up ? Math.max(0, menuCursor - 1) : Math.min(1, menuCursor + 1); menuCd = 0.18; refreshMenuHighlight(); }
  }
  if (cpAny(['P1_1', 'P2_1', 'P1_2', 'P2_2', 'START1', 'START2'])) showControls(menuCursor === 1);
}

// ── Menu Bubble FX ────────────────────────────────────────────────────────────
const BUBBLE_COLS = [0x44aaff, 0xff6ec7, 0xe1ff00, 0x00eeff, 0xff8844, 0xaaffaa];
function spawnMenuBubble(initial) {
  const r = 8 + Math.random() * 24;
  const x = WALL_L + r + Math.random() * (WALL_R - WALL_L - r * 2);
  const y = initial ? TOP_Y + Math.random() * (H - TOP_Y) : H + r;
  const col = BUBBLE_COLS[Math.floor(Math.random() * BUBBLE_COLS.length)];
  const spd = 28 + Math.random() * 48;
  menuBubbles.push({ x, y, r, col, vy: -spd, vx: (Math.random() - 0.5) * 18, life: 1, wobble: Math.random() * Math.PI * 2, wobbleSpd: 0.6 + Math.random() * 1.0 });
}
function updateMenuBubbles(dt) {
  for (let i = menuBubbles.length - 1; i >= 0; i--) {
    const b = menuBubbles[i];
    b.y += b.vy * dt; b.x += b.vx * dt;
    b.wobble += b.wobbleSpd * dt;
    b.x += Math.sin(b.wobble) * 0.4;
    if (b.y < TOP_Y - b.r - 10) menuBubbles.splice(i, 1);
  }
}
function drawMenuBubbles() {
  gMenuBubbles.clear();
  if (phase !== 'menu') return;
  for (const b of menuBubbles) {
    const a = Math.min(1, Math.abs(b.y - H / 2) / 200 + 0.25) * 0.7;
    gMenuBubbles.lineStyle(2, b.col, Math.min(0.9, a));
    gMenuBubbles.strokeCircle(b.x, b.y, b.r);
    gMenuBubbles.fillStyle(b.col, a * 0.15);
    gMenuBubbles.fillCircle(b.x, b.y, b.r);
    gMenuBubbles.fillStyle(0xffffff, a * 0.5);
    gMenuBubbles.fillCircle(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.25);
    gMenuBubbles.fillStyle(0xffffff, a * 0.2);
    gMenuBubbles.fillCircle(b.x + b.r * 0.25, b.y + b.r * 0.3, b.r * 0.14);
  }
}

// ── Game Start / Level ────────────────────────────────────────────────────────
function startGame(tp) {
  twoPlayer = tp; level = 1; score = 0; lives = 3;
  menuCtn.setVisible(false); ctrlsCtn && ctrlsCtn.setVisible(false);
  goCtn && goCtn.setVisible(false); savedCtn && savedCtn.setVisible(false);
  gMenuBubbles.clear();
  startLevel();
}

function startLevel() {
  balls = []; players = []; harpoons = []; harpoons2 = []; bullets = []; parts = [];
  popups.forEach(p => p.t && p.t.destroy()); popups = [];
  items.forEach(it => it.txt && it.txt.destroy()); items = [];
  freezeTimer = 0; lifeDroppedThisLevel = false;
  curPlatforms = PLAT[(level - 1) % PLAT.length];
  phase = 'playing';
  const def = LEVELS[Math.min(level - 1, LEVELS.length - 1)], sc2 = 1 + (level - 1) * 0.07;
  // Spawn players first (so we know their positions)
  spawnPlayer(0, WALL_L + 90);
  if (twoPlayer) spawnPlayer(1, WALL_R - 90);
  // Give all players 3s starting invincibility so they can't spawn inside a ball
  players.forEach(p => { p.invTimer = 3.0; });
  // Spawn balls, shifting any that start on top of a player
  const pxs = players.map(p => p.x);
  for (const [sz, bx, dir] of def) {
    const d = BDATA[sz];
    let sx = bx;
    // If ball start X is within radius+50 of any player, push it away
    for (const px of pxs) { if (Math.abs(sx - px) < d.r + 60) sx = px + Math.sign(sx - px || 1) * (d.r + 70); }
    sx = Math.max(WALL_L + d.r + 4, Math.min(WALL_R - d.r - 4, sx));
    spawnBall(sx, FLOOR_Y - d.r - 2, sz, d.spd * dir * sc2, d.bvy * (1 + (level - 1) * 0.035));
  }
  lvlCtn && lvlCtn.setVisible(false);
  drawLevelBg(level); // draw city background for this level
  startMusic();       // start music fresh for this level
  refreshHUD();
}

// ── Ball ──────────────────────────────────────────────────────────────────────
function spawnBall(x, y, size, vx, vy) {
  balls.push({ x, y, vx, vy, size, r: BDATA[size].r, active: true });
}

function updateBalls(dt) {
  if (freezeTimer > 0) { freezeTimer -= dt; return; }
  for (const b of balls) {
    if (!b.active) continue;
    b.vy += GRAVITY * dt; b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x - b.r < WALL_L) { b.x = WALL_L + b.r; b.vx = Math.abs(b.vx); }
    if (b.x + b.r > WALL_R) { b.x = WALL_R - b.r; b.vx = -Math.abs(b.vx); }
    if (b.y - b.r < TOP_Y) { b.y = TOP_Y + b.r; b.vy = Math.abs(b.vy) * 0.6; }
    if (b.y + b.r > FLOOR_Y) { b.y = FLOOR_Y - b.r; b.vy = BDATA[b.size].bvy * (1 + (level - 1) * 0.035); }
    // Platform bounce: ball hits top surface
    for (const pl of curPlatforms) {
      if (b.x + b.r > pl.x && b.x - b.r < pl.x + pl.w && b.vy > 0 && b.y + b.r >= pl.y && b.y + b.r < pl.y + b.r + 24) {
        b.y = pl.y - b.r; b.vy = BDATA[b.size].bvy * (1 + (level - 1) * 0.035);
      }
    }
  }
}

function popBall(b) {
  b.active = false;
  const d = BDATA[b.size], pts = d.pts * (1 + Math.floor((level - 1) / 2));
  score += pts;
  spawnParts(b.x, b.y, d.glow, b.size * 6 + 4);
  spawnPopup(b.x, b.y - b.r, '+' + pts);
  sfxPop(b.size);
  if (b.size > 1) {
    const ns = b.size - 1, nd = BDATA[ns], spd = nd.spd * (1 + (level - 1) * 0.07);
    spawnBall(b.x - 8, b.y, ns, -spd, nd.bvy * (1 + (level - 1) * 0.035));
    spawnBall(b.x + 8, b.y, ns, spd, nd.bvy * (1 + (level - 1) * 0.035));
  }
  // Item drops — life: at most 1 per level, 7% chance; others: 14% chance
  const roll = Math.random();
  if (!lifeDroppedThisLevel && roll < 0.07) {
    lifeDroppedThisLevel = true; spawnItem(b.x, b.y, 'life');
  } else if (roll < 0.07 + 0.14) {
    spawnItem(b.x, b.y, null);
  }
}

// ── Items ─────────────────────────────────────────────────────────────────────
function spawnItem(x, y, forceType) {
  let chosen;
  if (forceType) {
    chosen = ITEM_TYPES.find(t => t.type === forceType) || ITEM_TYPES[1];
  } else {
    const pool = ITEM_TYPES.filter(t => t.type !== 'life');
    const total = pool.reduce((s, t) => s + t.prob, 0);
    let roll = Math.random() * total, acc = 0;
    chosen = pool[pool.length - 1];
    for (const t of pool) { acc += t.prob; if (roll < acc) { chosen = t; break; } }
  }
  const txt = sc.add.text(x, y, chosen.label, { fontFamily: 'monospace', fontSize: '13px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(15);
  items.push({ x, y, vy: 140, type: chosen.type, col: chosen.col, glow: chosen.glow, label: chosen.label, txt, life: 10, active: true });
}

function updateItems(dt) {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (!it.active) { it.txt && it.txt.destroy(); items.splice(i, 1); continue; }
    it.y += it.vy * dt;
    it.txt && it.txt.setPosition(it.x, it.y);
    it.life -= dt;
    if (it.y > FLOOR_Y + 20 || it.life <= 0) { it.txt && it.txt.destroy(); items.splice(i, 1); continue; }
    for (const p of players) {
      if (!p.alive) continue;
      const dx = p.x - it.x, dy = p.y - it.y;
      if (dx * dx + dy * dy < (14 + P_HW + 8) ** 2) { applyItem(p, it); it.txt && it.txt.destroy(); it.active = false; break; }
    }
  }
}

function applyItem(player, item) {
  spawnPopup(player.x, player.y - 44, item.label);
  switch (item.type) {
    case 'life':
      sfxLifeUp(); lives = Math.min(lives + 1, 9); refreshHUD(); break;
    case 'freeze':
      sfxItemPickup(); freezeTimer = 4.5; break;
    case 'shield':
      sfxItemPickup(); player.shielded = true; break;
    case 'dynamite':
      sfxDynamite(); dynamiteBlast(); break;
    case 'machine':
      sfxItemPickup(); player.harpType = 'machine'; player.machineTimer = MACHINE_DUR; break;
    default: // double, wide, sticky — harpoon upgrade
      sfxItemPickup(); player.harpType = item.type; break;
  }
}

function dynamiteBlast() {
  // Split every non-size-1 ball recursively down to size 1 — creates beautiful chaos!
  flashTimer = 600;
  function splitDown(x, y, size, dir) {
    // No cap — let the chaos unfold!
    if (size <= 1) {
      const d = BDATA[1], spd = d.spd * (1 + (level - 1) * 0.07) * (0.7 + Math.random() * 0.6);
      spawnBall(x, y, 1, spd * dir, d.bvy * (1 + (level - 1) * 0.035));
      return;
    }
    const ns = size - 1, nd = BDATA[ns], spd = nd.spd * (1 + (level - 1) * 0.07);
    spawnParts(x, y, BDATA[size].glow, 6);
    splitDown(x - 10, y, ns, -1);
    splitDown(x + 10, y, ns, +1);
  }
  const snapshot = balls.filter(b => b.active && b.size > 1);
  snapshot.forEach(b => { b.active = false; });
  snapshot.forEach(b => splitDown(b.x, b.y, b.size, b.vx >= 0 ? 1 : -1));
  // Size-1 balls that were already there: keep them alive (they don't split)
  refreshHUD();
}

// ── Player ────────────────────────────────────────────────────────────────────
function spawnPlayer(id, x) {
  players.push({
    id, x, y: FLOOR_Y - P_HH, alive: true, invTimer: 0, respTimer: 0,
    shootCd: 0, harpType: 'normal', machineTimer: 0, shielded: false
  });
  harpoons.push(null); harpoons2.push(null);
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
    if (p.harpType === 'machine' && p.machineTimer > 0) {
      p.machineTimer -= dt;
      if (p.machineTimer <= 0) { p.harpType = 'normal'; p.machineTimer = 0; }
    }

    const lKey = i === 0 ? 'P1_L' : 'P2_L', rKey = i === 0 ? 'P1_R' : 'P2_R';
    const shK = i === 0 ? ['P1_1', 'P1_2', 'P1_3'] : ['P2_1', 'P2_2', 'P2_3'];
    if (held[lKey]) p.x -= P_SPEED * dt;
    if (held[rKey]) p.x += P_SPEED * dt;
    p.x = Math.max(WALL_L + P_HW + 2, Math.min(WALL_R - P_HW - 2, p.x));
    p.y = FLOOR_Y - P_HH;

    const wantShoot = shK.some(k => held[k]);
    // canShoot: double needs both slots free; machine uses bullets (always can stack); others need slot1
    const s1 = !harpoons[i], s2 = !harpoons2[i];
    const isMG = p.harpType === 'machine' && p.machineTimer > 0;
    const canShoot = p.shootCd <= 0 && (isMG || (s1 && (p.harpType !== 'double' || s2)));

    if (canShoot && wantShoot) {
      if (isMG) {
        // Machine gun: fan of MACHINE_N diagonal bullets per burst — no harpoon slot used
        const angles = [];
        for (let k = 0; k < MACHINE_N; k++) angles.push(-Math.PI / 2 + (k - (MACHINE_N - 1) / 2) * 0.22);
        angles.forEach(a => {
          bullets.push({ x: p.x, y: p.y - P_HH - 4, vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED, owner: i, active: true });
        });
        p.shootCd = MACHINE_BURST_CD; sfxShoot();
      } else {
        const hw = p.harpType === 'wide' ? 14 : 5;
        const sticky = p.harpType === 'sticky';
        const base = { top: p.y - P_HH - 2, bot: p.y - P_HH - 2, ext: true, owner: i, halfW: hw, alpha: 1.0, sticky };
        if (p.harpType === 'double') {
          harpoons[i] = { ...base, x: p.x - 12 };
          harpoons2[i] = { ...base, x: p.x + 12 };
        } else {
          harpoons[i] = { ...base, x: p.x };
        }
        p.shootCd = 0.12; sfxShoot();
      }
    }
  }
}

function killPlayer(p) {
  lives--; p.alive = false; p.respTimer = 2.2;
  const idx = players.indexOf(p);
  if (idx >= 0) { harpoons[idx] = null; harpoons2[idx] = null; }
  spawnParts(p.x, p.y, p.id === 0 ? 0xe1ff00 : 0xff6ec7, 14);
  sfxDeath(); flashTimer = 350; refreshHUD();
  if (lives <= 0) { stopMusic(); phase = 'gameover'; sc.time.delayedCall(1400, triggerGameOver, [], sc); }
}

// ── Harpoon ───────────────────────────────────────────────────────────────────
// Find the lowest platform top-surface that the harpoon at x would hit above minY
function harpPlatformCeil(hx, hw) {
  let ceil = TOP_Y + 4;
  for (const pl of curPlatforms) {
    if (hx + hw > pl.x && hx - hw < pl.x + pl.w) {
      // platform top surface acts as a ceiling stop
      if (pl.y > ceil) ceil = pl.y;
    }
  }
  return ceil;
}

function updateHarpArray(harps, dt) {
  for (let i = 0; i < harps.length; i++) {
    const h = harps[i]; if (!h) continue;
    if (h.stuck) {
      h.stuckTimer -= dt;
      checkHarpBalls(h, i, harps);
      if (h.stuckTimer <= 0) harps[i] = null;
    } else if (h.ext) {
      h.top -= HARP_SPEED * dt;
      const hw = h.halfW || 5;
      const ceil = harpPlatformCeil(h.x, hw);
      if (h.top <= ceil) {
        h.top = ceil;
        if (h.sticky) { h.ext = false; h.stuck = true; h.stuckTimer = 3.5; h.bot = FLOOR_Y; h.halfW = 3; }
        else { h.ext = false; }
      }
      if (!h.stuck && checkHarpBalls(h, i, harps)) continue;
    } else {
      // Retract with fadeout — still collides while visible
      h.top += HARP_SPEED * 1.6 * dt;
      h.alpha = Math.max(0, (h.bot - h.top) / Math.max(1, h.bot - TOP_Y));
      if (h.alpha > 0.05) checkHarpBalls(h, i, harps);
      if (h.top >= h.bot) harps[i] = null;
    }
  }
}

function updateHarpoons(dt) { updateHarpArray(harpoons, dt); updateHarpArray(harpoons2, dt); }

function checkHarpBalls(h, hi, harps) {
  const hw = h.halfW || 5;
  for (const b of balls) {
    if (!b.active) continue;
    if (Math.abs(h.x - b.x) > b.r + hw) continue;
    if (h.top > b.y + b.r || h.bot < b.y - b.r) continue;
    popBall(b); harps[hi] = null; return true;
  }
  return false;
}

// ── Bullets (machine gun fan projectiles) ────────────────────────────────────
function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bu = bullets[i];
    if (!bu.active) { bullets.splice(i, 1); continue; }
    bu.x += bu.vx * dt; bu.y += bu.vy * dt;
    // Remove if out of arena
    if (bu.x < WALL_L || bu.x > WALL_R || bu.y < TOP_Y || bu.y > FLOOR_Y) { bullets.splice(i, 1); continue; }
    // Bounce off side walls (horizontal component flips)
    // (already removed above — bullets disappear at walls)
    // Check ball collision
    let hit = false;
    for (const b of balls) {
      if (!b.active) continue;
      const dx = bu.x - b.x, dy = bu.y - b.y;
      if (dx * dx + dy * dy < (b.r + 4) ** 2) { popBall(b); hit = true; break; }
    }
    if (hit) { bullets.splice(i, 1); }
  }
}

function renderBullets() {
  for (const bu of bullets) {
    const col = bu.owner === 0 ? 0xe1ff00 : 0xff6ec7;
    // Glowing flame trail shape
    gHarp.fillStyle(col, 0.25); gHarp.fillCircle(bu.x, bu.y, 7);
    gHarp.fillStyle(0xffffff, 0.95); gHarp.fillCircle(bu.x, bu.y, 3);
    gHarp.fillStyle(col, 0.7); gHarp.fillCircle(bu.x, bu.y, 5);
  }
}

// ── Ball–Player Collision ─────────────────────────────────────────────────────
function checkBallPlayer() {
  if (freezeTimer > 0) return; // freeze = full invincibility for players
  for (const p of players) {
    if (!p.alive) continue;
    const px1 = p.x - P_HW, px2 = p.x + P_HW, py1 = p.y - P_HH, py2 = p.y + P_HH;
    let hit = false;
    for (const b of balls) {
      if (!b.active) continue;
      const cx = Math.max(px1, Math.min(px2, b.x)), cy = Math.max(py1, Math.min(py2, b.y));
      const dx = b.x - cx, dy = b.y - cy;
      if (dx * dx + dy * dy < b.r * b.r) { hit = true; break; }
    }
    if (!hit) continue;
    if (p.shielded) {
      p.shielded = false; p.invTimer = 0.8;
      spawnParts(p.x, p.y, 0xaaffaa, 12); sfxShieldBreak();
    } else if (p.invTimer <= 0) {
      killPlayer(p);
    }
  }
}

// ── Level Clear ───────────────────────────────────────────────────────────────
function checkLevelClear() {
  if (balls.length > 0 && balls.every(b => !b.active)) {
    phase = 'lvlclear'; lvlTimer = 2.8;
    stopMusic(); // stop music between levels immediately
    const bonus = level * 500; score += bonus; refreshHUD(); sfxLevelClear();
    lvlCtn && lvlCtn.setVisible(true);
    lvlTxt && lvlTxt.setText(`¡NIVEL ${level} SUPERADO!\n+${bonus} BONUS`);
    level++;
  }
}

function updateLvlClear(dt) {
  lvlTimer -= dt; if (lvlTimer <= 0) { lvlCtn && lvlCtn.setVisible(false); startLevel(); }
}

function triggerGameOver() {
  goCtn && goCtn.setVisible(true); sfxGameOver();
  goScoreTxt && goScoreTxt.setText('PUNTOS: ' + score);
  goLvlTxt && goLvlTxt.setText('LLEGASTE AL NIVEL ' + level);
  sc.time.delayedCall(2500, () => { goCtn && goCtn.setVisible(false); showNameEntry(); }, [], sc);
}

// ── Main Game Update ──────────────────────────────────────────────────────────
function updateGame(dt) {
  updateBalls(dt); updatePlayers(dt); updateHarpoons(dt); updateBullets(dt); updateItems(dt);
  checkBallPlayer(); updateParts(dt); updatePopups(dt);
  renderBalls(); renderHarpoons(); renderBullets(); renderPlayers(); renderFx(); renderItems();
  updateFreezeDisplay();
  checkLevelClear();
}

function updateFreezeDisplay() {
  if (!freezeTxt) return;
  if (freezeTimer > 0) {
    const secs = Math.ceil(freezeTimer);
    freezeTxt.setText(secs.toString());
    // Pulse alpha for urgency as time runs out
    const pulse = freezeTimer < 2 ? 0.6 + 0.4 * Math.sin(sc.time.now / 120) : 1;
    freezeTxt.setAlpha(pulse);
    freezeTxt.setScale(freezeTimer < 2 ? 1 + 0.1 * Math.sin(sc.time.now / 120) : 1);
    freezeTxt.setVisible(true);
  } else {
    freezeTxt.setVisible(false);
  }
}

// ── Render: Balls ─────────────────────────────────────────────────────────────
function renderBalls() {
  gBall.clear();
  for (const b of balls) {
    if (!b.active) continue;
    const d = BDATA[b.size];
    gBall.fillStyle(d.glow, 0.10); gBall.fillCircle(b.x, b.y, b.r + 14);
    gBall.fillStyle(d.glow, 0.16); gBall.fillCircle(b.x, b.y, b.r + 7);
    gBall.fillStyle(d.col, 1); gBall.fillCircle(b.x, b.y, b.r);
    gBall.fillStyle(0xffffff, 0.22); gBall.fillCircle(b.x - b.r * 0.32, b.y - b.r * 0.32, b.r * 0.38);
    gBall.fillStyle(0xffffff, 0.10); gBall.fillCircle(b.x - b.r * 0.22, b.y - b.r * 0.22, b.r * 0.18);
    if (b.size >= 2) {
      const ew = b.r * 0.19;
      gBall.fillStyle(0x000000, 0.75);
      gBall.fillEllipse(b.x - b.r * 0.28, b.y - b.r * 0.08, ew * 1.2, ew * 1.5);
      gBall.fillEllipse(b.x + b.r * 0.28, b.y - b.r * 0.08, ew * 1.2, ew * 1.5);
      gBall.fillStyle(0xffffff, 0.9);
      gBall.fillCircle(b.x - b.r * 0.22, b.y - b.r * 0.14, ew * 0.38);
      gBall.fillCircle(b.x + b.r * 0.32, b.y - b.r * 0.14, ew * 0.38);
      gBall.lineStyle(Math.max(1.5, b.r * 0.07), 0x000000, 0.7);
      gBall.beginPath(); gBall.moveTo(b.x - b.r * 0.42, b.y - b.r * 0.3); gBall.lineTo(b.x - b.r * 0.12, b.y - b.r * 0.22); gBall.strokePath();
      gBall.beginPath(); gBall.moveTo(b.x + b.r * 0.42, b.y - b.r * 0.3); gBall.lineTo(b.x + b.r * 0.12, b.y - b.r * 0.22); gBall.strokePath();
      gBall.lineStyle(Math.max(1.5, b.r * 0.055), 0x000000, 0.7);
      gBall.beginPath(); gBall.arc(b.x, b.y + b.r * 0.18, b.r * 0.24, 0.25, Math.PI - 0.25, false); gBall.strokePath();
    }
  }
}

// ── Render: Harpoons ──────────────────────────────────────────────────────────
function renderHarpArray(harps) {
  for (let i = 0; i < harps.length; i++) {
    const h = harps[i]; if (!h) continue;
    const pCol = i === 0 ? 0xe1ff00 : 0xff6ec7;
    const a = h.stuck ? 0.85 : (h.alpha !== undefined ? h.alpha : 1.0);
    const hw = h.halfW || 5;
    if (a <= 0.01) continue;
    if (h.stuck) {
      // Sticky harpoon: glowing vertical wall
      gHarp.lineStyle(hw * 2 + 8, 0x00ffaa, 0.14); gHarp.beginPath(); gHarp.moveTo(h.x, h.top); gHarp.lineTo(h.x, h.bot); gHarp.strokePath();
      gHarp.lineStyle(2, 0x00ffaa, 0.85); gHarp.beginPath(); gHarp.moveTo(h.x, h.top); gHarp.lineTo(h.x, h.bot); gHarp.strokePath();
      // Anchor circle at top
      gHarp.fillStyle(0x00ffaa, 0.9); gHarp.fillCircle(h.x, h.top + 6, 6);
      gHarp.fillStyle(0x050810, 1); gHarp.fillCircle(h.x, h.top + 6, 3);
      // Duration bar alongside wire
      const barPct = h.stuckTimer / 3.5;
      gHarp.fillStyle(0x00ffaa, 0.35); gHarp.fillRect(h.x + 4, h.top, 4, (h.bot - h.top) * barPct);
    } else {
      gHarp.lineStyle(hw * 2 + 4, pCol, 0.18 * a); gHarp.beginPath(); gHarp.moveTo(h.x, h.bot); gHarp.lineTo(h.x, h.top); gHarp.strokePath();
      gHarp.lineStyle(hw > 5 ? hw : 2, 0xffffff, 0.92 * a); gHarp.beginPath(); gHarp.moveTo(h.x, h.bot); gHarp.lineTo(h.x, h.top); gHarp.strokePath();
      if (h.ext || a > 0.3) {
        gHarp.fillStyle(pCol, a);
        gHarp.fillTriangle(h.x - hw, h.top + hw * 2, h.x + hw, h.top + hw * 2, h.x, h.top);
      }
    }
  }
}

function renderHarpoons() { gHarp.clear(); renderHarpArray(harpoons); renderHarpArray(harpoons2); }

// ── Render: Players (Banana) ──────────────────────────────────────────────────
const P_COLS = [0xe1ff00, 0xff6ec7];
const BAN_BODY = 0xf5d020, BAN_TIP = 0x8b6914, BAN_DARK = 0xe0a800;

function drawBanana(g, cx, cy, col, tilt) {
  const lean = tilt * 4;
  // Glow
  g.fillStyle(col, 0.10); g.fillEllipse(cx + lean, cy, 30, 60);
  // Main banana body
  g.fillStyle(BAN_BODY, 1); g.fillEllipse(cx + lean * 0.5, cy, 18, 46); g.fillEllipse(cx + lean * 0.3, cy - 4, 14, 38);
  // Darker stripe
  g.fillStyle(BAN_DARK, 0.5); g.fillEllipse(cx + lean * 0.2 + 2, cy, 6, 36);
  // Brown tips
  g.fillStyle(BAN_TIP, 1); g.fillEllipse(cx + lean * 0.8, cy - 22, 7, 7); g.fillEllipse(cx + lean * 0.1, cy + 22, 7, 7);
  // Eyes
  g.fillStyle(0x1a0a00, 0.85); g.fillCircle(cx - 3 + lean * 0.2, cy - 5, 2.5); g.fillCircle(cx + 3 + lean * 0.2, cy - 5, 2.5);
  // Smile
  g.lineStyle(1.5, 0x1a0a00, 0.7); g.beginPath(); g.arc(cx + lean * 0.2, cy + 2, 4, 0.2, Math.PI - 0.2, false); g.strokePath();
  // Cannon nozzle
  const nx = cx + lean * 0.8, ny = cy - 24;
  g.fillStyle(col, 0.9); g.fillRect(nx - 2, ny - 10, 4, 12);
  g.fillStyle(0xffffff, 0.3); g.fillRect(nx - 1, ny - 10, 1, 12);
  g.fillStyle(col, 0.7); g.fillEllipse(nx, ny - 10, 10, 5);
}

function renderPlayers() {
  gPlayer.clear();
  const t = sc.time.now / 1000;
  for (let i = 0; i < players.length; i++) {
    const p = players[i], col = P_COLS[i];
    if (!p.alive) {
      if (lives > 0) { gPlayer.fillStyle(BAN_BODY, 0.25 + 0.2 * Math.sin(t * 9)); gPlayer.fillEllipse(i === 0 ? WALL_L + 90 : WALL_R - 90, FLOOR_Y - P_HH, 20, 32); }
      continue;
    }
    if (p.invTimer > 0 && Math.floor(t * 10) % 2 === 0) continue;
    const x = p.x, y = p.y;
    // Ground shadow
    gPlayer.fillStyle(0x000000, 0.2); gPlayer.fillEllipse(x, FLOOR_Y + 3, 20, 6);
    // Shield ring (permanent until broken)
    if (p.shielded) {
      const sa = 0.55 + 0.25 * Math.sin(t * 4);
      gPlayer.lineStyle(3, 0xaaffaa, sa); gPlayer.strokeCircle(x, y, P_HW + 18);
      gPlayer.lineStyle(1, 0xaaffaa, sa * 0.4); gPlayer.strokeCircle(x, y, P_HW + 24);
      gPlayer.fillStyle(0xaaffaa, 0.06 + 0.04 * Math.sin(t * 4)); gPlayer.fillCircle(x, y, P_HW + 18);
    }
    drawBanana(gPlayer, x, y, col, i === 0 ? 1 : -1);
    // Machine gun timer bar above player
    if (p.harpType === 'machine' && p.machineTimer > 0) {
      const bw = 34, bh = 4, bx = x - bw / 2, by = y - P_HH - 24, pct = p.machineTimer / MACHINE_DUR;
      gPlayer.fillStyle(0x222222, 0.85); gPlayer.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      gPlayer.fillStyle(0xff2244, 0.95); gPlayer.fillRect(bx, by, bw * pct, bh);
      gPlayer.lineStyle(1, 0xff6688, 0.8); gPlayer.strokeRect(bx - 1, by - 1, bw + 2, bh + 2);
    }
  }
}

// ── Render: FX & Items ────────────────────────────────────────────────────────
function renderFx() {
  gFx.clear();
  if (freezeTimer > 0) {
    gFx.fillStyle(0x00eeff, Math.min(0.12, freezeTimer * 0.03));
    gFx.fillRect(WALL_L, TOP_Y, WALL_R - WALL_L, FLOOR_Y - TOP_Y);
  }
  for (const p of parts) {
    if (p.life <= 0) continue;
    const a = (p.life / p.maxLife) * 0.9;
    gFx.fillStyle(p.col, a); gFx.fillCircle(p.x, p.y, p.r * (p.life / p.maxLife));
  }
  if (flashTimer > 0) { gFx.fillStyle(0xff6600, (flashTimer / 600) * 0.3); gFx.fillRect(0, 0, W, H); }
}

function renderItems() {
  for (const it of items) {
    if (!it.active) continue;
    const pulse = 0.7 + 0.3 * Math.sin(sc.time.now / 300);
    gFx.fillStyle(it.glow, 0.18 * pulse); gFx.fillCircle(it.x, it.y, 20);
    gFx.fillStyle(it.col, 1); gFx.fillCircle(it.x, it.y, 14);
    gFx.fillStyle(0xffffff, 0.35); gFx.fillCircle(it.x - 4, it.y - 4, 4);
    if (it.life < 3 && Math.floor(sc.time.now / 200) % 2 === 0) it.txt && it.txt.setAlpha(0);
    else it.txt && it.txt.setAlpha(1);
  }
}

// ── Particles ─────────────────────────────────────────────────────────────────
function spawnParts(x, y, col, n) {
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i / n) + Math.random() * 0.6, spd = 70 + Math.random() * 170, life = 0.5 + Math.random() * 0.55;
    parts.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 50, r: 2.5 + Math.random() * 3.5, col, life, maxLife: life });
  }
  if (parts.length > 240) parts.splice(0, parts.length - 240);
}
function updateParts(dt) {
  for (const p of parts) { if (p.life <= 0) continue; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 210 * dt; p.life -= dt; }
}

// ── Score Popups ──────────────────────────────────────────────────────────────
function spawnPopup(x, y, txt) {
  const t = sc.add.text(x, y, txt, { fontFamily: 'monospace', fontSize: '20px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(30);
  popups.push({ t, life: 1.1, vy: -75 });
}
function updatePopups(dt) {
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i]; p.t.y += p.vy * dt; p.vy *= 0.95; p.life -= dt; p.t.setAlpha(Math.max(0, p.life));
    if (p.life <= 0) { p.t.destroy(); popups.splice(i, 1); }
  }
}

// ── Screens ───────────────────────────────────────────────────────────────────
function buildGO() {
  const c = sc.add.container(0, 0).setDepth(20); goCtn = c;
  c.add(sc.add.rectangle(W / 2, H / 2, W, H, 0x050810, 0.95));
  c.add(sc.add.text(W / 2, 110, 'FIN DEL JUEGO', { fontFamily: 'monospace', fontSize: '52px', color: '#ff4040', fontStyle: 'bold' }).setOrigin(0.5));
  goScoreTxt = sc.add.text(W / 2, 182, '', { fontFamily: 'monospace', fontSize: '26px', color: '#e1ff00' }).setOrigin(0.5);
  goLvlTxt = sc.add.text(W / 2, 218, '', { fontFamily: 'monospace', fontSize: '18px', color: '#4a9eff' }).setOrigin(0.5);
  c.add(goScoreTxt); c.add(goLvlTxt); c.setVisible(false);
}

// ── Controls / Cómo Jugar ─────────────────────────────────────────────────────
function buildControls() {
  const c = sc.add.container(0, 0).setDepth(25); ctrlsCtn = c;
  c.add(sc.add.rectangle(W / 2, H / 2, W, H, 0x020610, 0.98));
  c.add(sc.add.text(W / 2, 32, 'CÓMO JUGAR', { fontFamily: 'monospace', fontSize: '28px', color: '#e1ff00', fontStyle: 'bold' }).setOrigin(0.5));
  const csty = { fontFamily: 'monospace', fontSize: '13px', color: '#4a9eff', fontStyle: 'bold' };
  const vsty = { fontFamily: 'monospace', fontSize: '12px', color: '#c8d8f0' };
  c.add(sc.add.text(78, 72, 'CONTROLES', csty).setOrigin(0));
  c.add(sc.add.rectangle(W / 2, 87, 700, 1, 0x1a3560, 0.7));
  const ctrlRows = [
    ['P1 MOVER', 'A / D  (joystick)'],
    ['P1 DISPARAR', 'U / I / O  (botón 1-2-3)'],
    ['P2 MOVER', '← / →  (joystick)'],
    ['P2 DISPARAR', 'R / T / Y  (botón 1-2-3)'],
    ['INICIO', 'Enter / 2'],
  ];
  ctrlRows.forEach(([lbl, val], i) => {
    c.add(sc.add.text(100, 100 + i * 20, lbl, { fontFamily: 'monospace', fontSize: '12px', color: '#6a9adf' }).setOrigin(0));
    c.add(sc.add.text(320, 100 + i * 20, val, vsty).setOrigin(0));
  });
  c.add(sc.add.text(78, 210, 'POWER-UPS', csty).setOrigin(0));
  c.add(sc.add.rectangle(W / 2, 225, 700, 1, 0x1a3560, 0.7));
  const pwItems = [
    ['2x', 0x44aaff, 'ARPÓN DOBLE', 'Dispara dos arpones a la vez'],
    ['||', 0xffaa00, 'ARPÓN ANCHO', 'Dispara un rayo extra ancho'],
    ['@', 0xff8844, 'ARPÓN PEGAJOSO', 'Se pega al techo/plataforma como pared'],
    ['MG', 0xff2244, 'AMETRALLADORA', 'Ráfaga diagonal de balas por 12 seg'],
    ['*', 0x00eeff, 'CONGELAR', 'Congela todas las burbujas 4.5 seg'],
    ['SH', 0xaaffaa, 'ESCUDO', 'Absorbe un golpe y se rompe'],
    ['TNT', 0xff6600, 'DINAMITA', '¡Divide TODAS las burbujas grandes!'],
    ['+1', 0xff4488, 'VIDA EXTRA', 'Gana una vida extra (¡es rara!)'],
  ];
  const halfLen = Math.ceil(pwItems.length / 2);
  pwItems.forEach(([label, col, name, desc], i) => {
    const col2 = i < halfLen ? 0 : 1;
    const row2 = i < halfLen ? i : i - halfLen;
    const bx = col2 === 0 ? 78 : 415;
    const by = 240 + row2 * 38;
    const bg2 = sc.add.graphics();
    bg2.fillStyle(col, 0.18); bg2.fillRoundedRect(bx, by - 4, 30, 26, 4);
    bg2.lineStyle(1.5, col, 0.8); bg2.strokeRoundedRect(bx, by - 4, 30, 26, 4);
    c.add(bg2);
    c.add(sc.add.text(bx + 15, by + 9, label, { fontFamily: 'monospace', fontSize: label.length > 2 ? '10px' : '13px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5));
    c.add(sc.add.text(bx + 38, by, name, { fontFamily: 'monospace', fontSize: '12px', color: '#' + col.toString(16).padStart(6, '0') }).setOrigin(0, 0));
    c.add(sc.add.text(bx + 38, by + 14, desc, { fontFamily: 'monospace', fontSize: '10px', color: '#8898b0' }).setOrigin(0, 0));
  });
  c.add(sc.add.rectangle(W / 2, H - 78, 700, 1, 0x1a3560, 0.5));
  c.add(sc.add.text(W / 2, H - 66, 'OBJETIVO: ¡Explota todas las burbujas para superar el nivel! Más niveles = más puntos.', { fontFamily: 'monospace', fontSize: '11px', color: '#6a9adf', wordWrap: { width: 680 }, align: 'center' }).setOrigin(0.5, 0));
  const startPrompt = sc.add.text(W / 2, H - 28, 'PRESIONA BOTÓN / START PARA COMENZAR', { fontFamily: 'monospace', fontSize: '13px', color: '#e1ff00', fontStyle: 'bold' }).setOrigin(0.5);
  c.add(startPrompt);
  sc.tweens.add({ targets: startPrompt, alpha: 0.3, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  c.setVisible(false);
}

function showControls(tp) {
  pendingTwoPlayer = tp;
  phase = 'controls';
  menuCtn.setVisible(false);
  ctrlsCtn.setVisible(true);
  gMenuBubbles.clear();
  Object.keys(pressed).forEach(k => { pressed[k] = false; });
}

function updateControls(dt) {
  if (cpAny(['P1_1', 'P2_1', 'P1_2', 'P2_2', 'START1', 'START2'])) {
    ctrlsCtn.setVisible(false);
    startGame(pendingTwoPlayer);
  }
}

function buildLvlClear() {
  const c = sc.add.container(0, 0).setDepth(20); lvlCtn = c;
  c.add(sc.add.rectangle(W / 2, H / 2, W, H, 0x050810, 0.72));
  lvlTxt = sc.add.text(W / 2, H / 2 - 20, '', { fontFamily: 'monospace', fontSize: '38px', color: '#e1ff00', fontStyle: 'bold', align: 'center' }).setOrigin(0.5);
  c.add(lvlTxt); c.setVisible(false);
}

function buildNameEntry() {
  const c = sc.add.container(0, 0).setDepth(22); nameCtn = c;
  c.add(sc.add.rectangle(W / 2, H / 2, W, H, 0x050810, 0.97));
  c.add(sc.add.text(W / 2, 38, 'INGRESA TU NOMBRE', { fontFamily: 'monospace', fontSize: '26px', color: '#e1ff00', fontStyle: 'bold' }).setOrigin(0.5));
  nameScoreTxt = sc.add.text(W / 2, 72, '', { fontFamily: 'monospace', fontSize: '16px', color: '#c8d8f0' }).setOrigin(0.5); c.add(nameScoreTxt);
  nameDisplayTxt2 = sc.add.text(W / 2, 114, '___', { fontFamily: 'monospace', fontSize: '42px', color: '#ff6ec7', fontStyle: 'bold', letterSpacing: 14 }).setOrigin(0.5); c.add(nameDisplayTxt2);
  for (let row = 0; row < NAME_GRID.length; row++) {
    const ri = NAME_GRID[row], rw = ri.length * 62;
    for (let col = 0; col < ri.length; col++) {
      const val = ri[col], cx = W / 2 - rw / 2 + 31 + col * 62, cy = 194 + row * 38;
      const bg = sc.add.rectangle(cx, cy, val.length > 1 ? 70 : 50, 30, 0x0d1a30, 0.95).setStrokeStyle(2, 0x1a3560, 0.7);
      const lbl = sc.add.text(cx, cy, val, { fontFamily: 'monospace', fontSize: val.length > 1 ? '13px' : '19px', color: '#c8d8f0', fontStyle: 'bold' }).setOrigin(0.5);
      c.add(bg); c.add(lbl); nameGrid.push({ bg, lbl, row, col, val });
    }
  }
  c.add(sc.add.text(W / 2, H - 18, 'JOYSTICK MOVER   BOTÓN SELECCIONAR', { fontFamily: 'monospace', fontSize: '11px', color: '#1e3050' }).setOrigin(0.5));
  c.setVisible(false);
}

function buildSaved() {
  const c = sc.add.container(0, 0).setDepth(23); savedCtn = c;
  c.add(sc.add.rectangle(W / 2, H / 2, W, H, 0x050810, 0.97));
  c.add(sc.add.text(W / 2, 60, '🏆  ¡PUNTAJE GUARDADO!', { fontFamily: 'monospace', fontSize: '30px', color: '#e1ff00', fontStyle: 'bold' }).setOrigin(0.5));
  c.add(sc.add.text(W / 2, 108, '#    NOM   PUNTOS    NV', { fontFamily: 'monospace', fontSize: '13px', color: '#4a9eff', fontStyle: 'bold' }).setOrigin(0.5));
  c.add(sc.add.rectangle(W / 2, 120, 400, 1, 0x1a3560, 0.9));
  savedBodyTxt = sc.add.text(W / 2, 132, '', { fontFamily: 'monospace', fontSize: '13px', color: '#a8b8d0', align: 'left', lineSpacing: 6 }).setOrigin(0.5, 0);
  c.add(savedBodyTxt);
  c.add(sc.add.text(W / 2, H - 24, 'PRESIONA START PARA CONTINUAR', { fontFamily: 'monospace', fontSize: '12px', color: '#1e3050' }).setOrigin(0.5));
  c.setVisible(false);
}

function showNameEntry() {
  phase = 'nameentry'; nameLetters = []; nameRow = 0; nameCol = 0; nameCd = 0;
  nameCtn && nameCtn.setVisible(true);
  nameScoreTxt && nameScoreTxt.setText('PUNTOS: ' + score + '   NIVEL: ' + level);
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
    const up = held.P1_U || held.P2_U, dn = held.P1_D || held.P2_D;
    const lt = held.P1_L || held.P2_L, rt = held.P1_R || held.P2_R;
    let mv = false;
    if (up && nameRow > 0) { nameRow--; mv = true; }
    else if (dn && nameRow < NAME_GRID.length - 1) { nameRow++; mv = true; }
    else if (lt && nameCol > 0) { nameCol--; mv = true; }
    else if (rt && nameCol < NAME_GRID[nameRow].length - 1) { nameCol++; mv = true; }
    if (mv) { nameCol = Math.min(nameCol, NAME_GRID[nameRow].length - 1); nameCd = 0.16; refreshNameGrid(); }
  }
  if (cpAny(['P1_1', 'P2_1', 'P1_2', 'P2_2', 'START1', 'START2'])) {
    const val = NAME_GRID[nameRow][nameCol];
    if (val === 'DEL') { if (nameLetters.length > 0) nameLetters.pop(); }
    else if (val === 'OK') { doSubmit(); return; }
    else if (nameLetters.length < 3) { nameLetters.push(val); if (nameLetters.length === 3) { doSubmit(); return; } }
    refreshNameDisplay();
  }
}

async function doSubmit() {
  const name = (nameLetters.join('') || 'AAA').padEnd(3, 'A').slice(0, 3);
  nameCtn.setVisible(false);
  const updated = await saveScore(name, score, level);
  highScores = updated; refreshMenuScores();
  phase = 'saved'; savedCtn.setVisible(true);
  if (savedBodyTxt) {
    savedBodyTxt.setText(
      highScores.slice(0, 10).map((e, i) =>
        `${String(i + 1).padStart(2, '0')}  ${(e.name || '???').padEnd(3, ' ')}  ${String(e.score || 0).padStart(7, ' ')}  LV${String(e.level || 1).padStart(2, ' ')}`
      ).join('\n')
    );
  }
}

// ── Audio (Web Audio API) ─────────────────────────────────────────────────────
function getLevelMusic(lvl) {
  const BLOCKS = {
    // ── CDMX (Mambo) ─────────────────────────────────────────────────────────
    // Do mayor · gancho sincopado, bajo con contratiempo mambo
    c1: {
      t: [76, 2, 74, 2, 72, 2, 74, 2, 76, 2, 79, 2, 76, 2, 74, 2,
        72, 2, 76, 2, 79, 2, 81, 2, 79, 4, 0, 4],
      b: [48, 3, 0, 1, 55, 2, 0, 2, 50, 3, 0, 1, 55, 2, 0, 2]
    },
    c2: {
      t: [79, 2, 81, 2, 79, 2, 76, 2, 74, 2, 76, 2, 74, 2, 72, 2,
        71, 2, 72, 2, 74, 2, 76, 2, 79, 4, 0, 4],
      b: [48, 3, 0, 1, 55, 2, 0, 2, 50, 3, 0, 1, 55, 2, 0, 2]
    },
    c3: {
      t: [72, 1, 74, 1, 76, 1, 79, 1, 81, 2, 79, 2, 76, 2, 74, 2,
        72, 1, 74, 1, 76, 1, 79, 1, 83, 2, 81, 2, 79, 4, 72, 8],
      b: [48, 3, 0, 1, 55, 2, 0, 2, 50, 3, 0, 1, 55, 2, 0, 2]
    },

    // ── Guadalajara (Mariachi) ────────────────────────────────────────────────
    // Sol mayor · fanfarria de trompeta, bajo de guitarra bajo
    g1: {
      t: [79, 2, 79, 2, 79, 2, 76, 2, 74, 2, 79, 2, 76, 2, 74, 2,
        72, 2, 74, 2, 76, 2, 78, 2, 79, 4, 0, 4],
      b: [43, 2, 55, 2, 43, 2, 55, 2, 43, 2, 55, 2, 43, 2, 55, 2]
    },
    g2: {
      t: [83, 2, 81, 2, 79, 2, 78, 2, 79, 2, 76, 2, 74, 2, 72, 2,
        83, 2, 81, 2, 79, 2, 78, 2, 79, 4, 0, 4],
      b: [43, 2, 55, 2, 43, 2, 55, 2, 43, 2, 55, 2, 43, 2, 55, 2]
    },
    g3: {
      t: [67, 1, 69, 1, 71, 1, 72, 1, 74, 1, 76, 1, 78, 1, 79, 1,
        81, 2, 79, 2, 78, 2, 76, 2, 74, 4, 71, 4, 79, 8],
      b: [43, 2, 55, 2, 43, 2, 55, 2, 43, 2, 55, 2, 43, 2, 55, 2]
    },

    // ── Monterrey (Polka Norteña) ─────────────────────────────────────────────
    // La menor/dórico · oom-pah saltarín, acelerado
    m1: {
      t: [81, 2, 79, 2, 76, 2, 74, 2, 76, 4, 74, 4, 69, 4,
        71, 2, 74, 2, 76, 4, 81, 4],
      b: [45, 4, 52, 4, 45, 4, 52, 4]
    },
    m2: {
      t: [83, 2, 81, 2, 79, 2, 76, 2, 76, 4, 81, 2, 79, 2,
        76, 2, 74, 2, 71, 4, 69, 8],
      b: [45, 4, 52, 4, 45, 4, 52, 4]
    },
    m3: {
      t: [69, 1, 71, 1, 72, 1, 74, 1, 76, 1, 79, 1, 81, 1, 83, 1,
        83, 2, 81, 2, 79, 2, 76, 2, 79, 4, 76, 4, 81, 8],
      b: [45, 4, 52, 4, 45, 4, 52, 4]
    },

    // ── Cancún (Cumbia Caribeña) ──────────────────────────────────────────────
    // Do/Fa mayor · clave cumbia, tropical y bailable
    k1: {
      t: [72, 3, 74, 1, 77, 4, 76, 2, 74, 2, 72, 4, 69, 4, 72, 4, 77, 8],
      b: [48, 3, 0, 1, 48, 2, 43, 2, 48, 3, 0, 1, 48, 2, 43, 2]
    },
    k2: {
      t: [77, 4, 79, 4, 81, 4, 79, 2, 77, 2, 76, 4, 74, 4, 72, 8],
      b: [48, 3, 0, 1, 48, 2, 43, 2, 48, 3, 0, 1, 48, 2, 43, 2]
    },
    k3: {
      t: [84, 2, 83, 2, 81, 2, 79, 2, 77, 2, 0, 2, 76, 2, 74, 2,
        72, 2, 74, 2, 76, 2, 77, 2, 79, 4, 72, 4],
      b: [48, 3, 0, 1, 48, 2, 43, 2, 48, 3, 0, 1, 48, 2, 43, 2]
    },

    // ── Mulegé (Surf Corrido) ─────────────────────────────────────────────────
    // Mi menor · ritmo surfer con garra, bajo de twang
    s1: {
      t: [76, 2, 74, 2, 72, 2, 71, 2, 72, 4, 76, 4,
        79, 4, 76, 4, 74, 4, 72, 4],
      b: [40, 4, 0, 4, 40, 4, 0, 4, 45, 4, 0, 4, 40, 4, 0, 4]
    },
    s2: {
      t: [83, 2, 81, 2, 79, 2, 76, 2, 79, 4, 76, 4,
        74, 4, 72, 4, 71, 4, 72, 4],
      b: [40, 4, 0, 4, 40, 4, 0, 4, 45, 4, 0, 4, 40, 4, 0, 4]
    },
    s3: {
      t: [64, 1, 66, 1, 67, 1, 69, 1, 71, 1, 72, 1, 74, 1, 76, 1,
        79, 4, 76, 4, 74, 4, 72, 4, 64, 8],
      b: [40, 4, 0, 4, 40, 4, 0, 4, 45, 4, 0, 4, 40, 4, 0, 4]
    },

    // ── Veracruz (Son Jarocho) ────────────────────────────────────────────────
    // Do mayor · velocísimo estilo La Bamba, tresillo jarocho en bajo
    v1: {
      t: [72, 2, 74, 2, 76, 2, 79, 2, 77, 2, 76, 2, 74, 4,
        72, 2, 74, 2, 76, 2, 79, 2, 77, 2, 76, 2, 72, 4],
      b: [48, 3, 48, 3, 48, 2, 43, 3, 43, 3, 43, 2]
    },
    v2: {
      t: [84, 2, 83, 2, 81, 2, 79, 2, 77, 2, 79, 2, 81, 4,
        84, 2, 83, 2, 81, 2, 79, 2, 77, 2, 79, 2, 81, 4],
      b: [48, 3, 48, 3, 48, 2, 43, 3, 43, 3, 43, 2]
    },
    v3: {
      t: [72, 1, 74, 1, 76, 1, 77, 1, 79, 1, 81, 1, 83, 1, 84, 1,
        84, 2, 83, 2, 81, 2, 79, 2, 77, 4, 76, 4, 72, 8],
      b: [48, 3, 48, 3, 48, 2, 43, 3, 43, 3, 43, 2]
    }
  };

  const TRACKS = [
    { spd: 0.09, seq: ['c1', 'c2', 'c1', 'c3', 'c2', 'c1', 'c3', 'c1'] },          // CDMX      ~167 BPM
    { spd: 0.09, seq: ['g1', 'g2', 'g1', 'g3', 'g1', 'g3', 'g2', 'g1', 'g3'] },      // GDL       ~167 BPM
    { spd: 0.08, seq: ['m1', 'm1', 'm2', 'm3', 'm1', 'm2', 'm3', 'm1', 'm3'] },      // MTY       ~188 BPM
    { spd: 0.10, seq: ['k1', 'k1', 'k2', 'k1', 'k3', 'k2', 'k1', 'k3', 'k1'] },      // Cancún    ~150 BPM
    { spd: 0.11, seq: ['s1', 's1', 's2', 's3', 's1', 's2', 's3', 's1'] },           // Mulegé    ~136 BPM
    { spd: 0.08, seq: ['v1', 'v2', 'v1', 'v3', 'v1', 'v2', 'v3', 'v2', 'v1', 'v3'] }  // Veracruz  ~188 BPM
  ];

  const trk = TRACKS[(lvl - 1) % 6];
  let tune = [], bass = [];

  for (let bName of trk.seq) {
    let blk = BLOCKS[bName];
    let tSum = 0; for (let i = 1; i < blk.t.length; i += 2) tSum += blk.t[i];
    let bSum = 0; for (let i = 1; i < blk.b.length; i += 2) bSum += blk.b[i];

    for (let i = 0; i < blk.t.length; i += 2)
      tune.push([blk.t[i] === 0 ? 0 : 440 * Math.pow(2, (blk.t[i] - 69) / 12), blk.t[i + 1] * trk.spd]);

    let loops = Math.round(tSum / bSum);
    for (let l = 0; l < loops; l++)
      for (let i = 0; i < blk.b.length; i += 2)
        bass.push([blk.b[i] === 0 ? 0 : 440 * Math.pow(2, (blk.b[i] - 69) / 12), blk.b[i + 1] * trk.spd]);
  }
  return { tune, bass };
}

function tone(freq, type, dur, vol = 0.28, delay = 0) {
  try {
    const ctx = sc.sound.context;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime + delay);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(ctx.currentTime + delay); osc.stop(ctx.currentTime + delay + dur);
  } catch (e) { }
}

function sfxShoot() { tone(920, 'square', 0.055, 0.12); tone(460, 'square', 0.04, 0.06, 0.04); }

function sfxPop(size) {
  const f = [0, 400, 270, 185, 115][size] || 200;
  tone(f, 'sine', 0.2, 0.28); tone(f * 1.6, 'sine', 0.12, 0.14, 0.07);
}

function sfxDeath() {
  tone(220, 'sawtooth', 0.25, 0.4); tone(140, 'sawtooth', 0.28, 0.35, 0.14); tone(85, 'sawtooth', 0.35, 0.3, 0.32);
}

// Super Pang-inspired: pun-pun-pun-pun  pun  pun-pun-pun-pun-pun-pun
function sfxGameOver() {
  const ph1 = [392, 330, 262, 220];
  ph1.forEach((f, i) => { tone(f, 'square', 0.10, 0.30, i * 0.14); tone(f * 0.5, 'triangle', 0.10, 0.14, i * 0.14); });
  const p1 = ph1.length * 0.14 + 0.18;
  tone(175, 'square', 0.22, 0.35, p1); tone(87.5, 'sawtooth', 0.22, 0.28, p1);
  const ph2 = [220, 196, 175, 165, 147, 131], p2 = p1 + 0.30;
  ph2.forEach((f, i) => { tone(f, 'square', 0.09, 0.28, p2 + i * 0.09); tone(f * 0.5, 'sine', 0.09, 0.12, p2 + i * 0.09); });
  tone(65, 'sawtooth', 0.5, 0.45, p2 + ph2.length * 0.09 + 0.05);
}

// Extra life: bright ascending 1-up arpeggio
function sfxLifeUp() {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, 'sine', 0.12, 0.30, i * 0.09));
  tone(1319, 'sine', 0.18, 0.35, 0.36);
}

// Generic item pickup: clean two-tone chime
function sfxItemPickup() {
  tone(880, 'sine', 0.10, 0.22); tone(1108, 'sine', 0.10, 0.22, 0.09);
}

// Shield break: descending glass like crash
function sfxShieldBreak() {
  [1400, 1050, 700, 400, 200].forEach((f, i) => tone(f, 'sawtooth', 0.06, 0.18, i * 0.05));
  tone(180, 'triangle', 0.15, 0.30, 0.28);
}

// Dynamite: big explosion boom + rumble
function sfxDynamite() {
  tone(80, 'sawtooth', 0.50, 0.60);
  tone(120, 'sawtooth', 0.35, 0.45, 0.05);
  tone(55, 'sawtooth', 0.60, 0.50, 0.12);
  tone(240, 'square', 0.15, 0.25, 0.02);
  tone(320, 'square', 0.10, 0.20, 0.06);
  tone(45, 'sawtooth', 0.40, 0.55, 0.25);
}

function sfxLevelClear() {
  [440, 554, 659, 880, 1108].forEach((f, i) => tone(f, 'sine', 0.28, 0.32, i * 0.1));
}

// ── Background Music ──────────────────────────────────────────────────────────
let musicPlaying = false, musicTm = null, musicGain = null;
let currentLevelMusic = null;

function playNotes(notes, type, vol, startT, masterGain) {
  try {
    const ctx = sc.sound.context; let t = startT;
    for (const [f, d] of notes) {
      if (f > 0) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.value = f;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + d * 0.82);
        o.connect(g); g.connect(masterGain);
        o.start(t); o.stop(t + d);
      }
      t += d;
    }
    return t - startT;
  } catch (e) { return 0; }
}

function startMusic() {
  if (musicPlaying) return;
  musicPlaying = true;
  currentLevelMusic = getLevelMusic(level);
  try {
    const ctx = sc.sound.context;
    if (musicGain) { try { musicGain.disconnect(); } catch (e) { } }
    musicGain = ctx.createGain();
    musicGain.gain.setValueAtTime(1, ctx.currentTime);
    musicGain.connect(ctx.destination);
  } catch (e) { }
  function loop() {
    if (!musicPlaying || !currentLevelMusic) return;
    try {
      const ctx = sc.sound.context, t = ctx.currentTime;
      const dur = playNotes(currentLevelMusic.tune, 'square', 0.055, t, musicGain);
      playNotes(currentLevelMusic.bass, 'triangle', 0.045, t, musicGain);
      musicTm = setTimeout(loop, (dur - 0.15) * 1000);
    } catch (e) { }
  }
  loop();
}

function stopMusic() {
  musicPlaying = false;
  clearTimeout(musicTm);
  // Cut audio immediately by disconnecting the master gain node
  try {
    if (musicGain) {
      musicGain.gain.setValueAtTime(0, sc.sound.context.currentTime);
      musicGain.disconnect();
      musicGain = null;
    }
  } catch (e) { }
}

// ── Level Backgrounds (Mexican Cities) ───────────────────────────────────────
const CITIES = ['CDMX', 'Guadalajara', 'Monterrey', 'Cancún', 'Mulegé', 'Veracruz'];

function drawLevelBg(lvl) {
  gLvlBg.clear();
  const scenes = [bgCDMX, bgGuadalajara, bgMonterrey, bgCancun, bgMulege, bgVeracruz];
  scenes[(lvl - 1) % scenes.length]();
  drawPlatforms();
}

function bgSky(t, b) { gLvlBg.fillGradientStyle(t, t, b, b, 1); gLvlBg.fillRect(0, 0, W, FLOOR_Y); }

function bgCDMX() {
  bgSky(0x334466, 0x5f88aa);
  // Snow-capped Popocatépetl (left)
  gLvlBg.fillStyle(0x4a5e6e, 0.88);
  gLvlBg.fillTriangle(60, FLOOR_Y, 268, 212, 476, FLOOR_Y);
  gLvlBg.fillStyle(0xddeeff, 0.78);
  gLvlBg.fillTriangle(243, 234, 268, 212, 294, 236); // snow cap
  // Iztaccíhuatl (right, lower)
  gLvlBg.fillStyle(0x556070, 0.78);
  gLvlBg.fillTriangle(380, FLOOR_Y, 546, 252, 712, FLOOR_Y);
  gLvlBg.fillStyle(0xddeeff, 0.62);
  gLvlBg.fillTriangle(522, 268, 546, 252, 570, 268); // snow cap
  // Background skyscrapers with lit windows
  [[72, 242, 44, 258], [130, 270, 36, 230], [620, 256, 46, 254], [672, 278, 36, 222]].forEach(([x, y, w, h]) => {
    gLvlBg.fillStyle(0x223344, 0.84); gLvlBg.fillRect(x, y, w, h);
    gLvlBg.fillStyle(0xffee88, 0.30);
    for (let wy = y + 10; wy < y + h - 10; wy += 20)for (let wx = x + 5; wx < x + w - 5; wx += 12)gLvlBg.fillRect(wx, wy, 7, 10);
    gLvlBg.fillStyle(0x4a6a8a, 0.55); gLvlBg.fillRect(x, y, w, 5);
  });
  // Palacio Nacional facade
  gLvlBg.fillStyle(0x3d5068, 0.96); gLvlBg.fillRect(82, 394, 636, FLOOR_Y - 394);
  gLvlBg.fillStyle(0x2e3f52, 0.96); gLvlBg.fillRect(82, 374, 636, 22);
  gLvlBg.fillStyle(0x5577aa, 0.58); gLvlBg.fillRect(82, 370, 636, 5);
  // Palace archway windows
  gLvlBg.fillStyle(0xffdd88, 0.36);
  for (let wx = 106; wx < 700; wx += 38)gLvlBg.fillRect(wx, 400, 16, 26);
  gLvlBg.fillStyle(0x2e3f52, 0.92);
  for (let ax = 106; ax < 700; ax += 38)gLvlBg.fillRect(ax + 3, 422, 10, 12);
  // Flag pole
  gLvlBg.fillStyle(0x889988, 1); gLvlBg.fillRect(393, 294, 4, 82);
  // 🇲🇽 Mexican flag: GREEN | WHITE | RED (left to right)
  gLvlBg.fillStyle(0x006847, 1); gLvlBg.fillRect(397, 296, 18, 52);
  gLvlBg.fillStyle(0xffffff, 1); gLvlBg.fillRect(415, 296, 18, 52);
  gLvlBg.fillStyle(0xce1126, 1); gLvlBg.fillRect(433, 296, 18, 52);
  gLvlBg.fillStyle(0x8B6914, 0.80); gLvlBg.fillCircle(424, 315, 5); // eagle hint
  // Cathedral towers (Gothic spires)
  gLvlBg.fillStyle(0x3d5068, 1);
  gLvlBg.fillTriangle(184, 176, 208, 370, 232, 370);
  gLvlBg.fillTriangle(548, 190, 572, 370, 596, 370);
  gLvlBg.fillRect(184, 370, 70, 28); gLvlBg.fillRect(548, 370, 70, 28);
  // Cathedral body
  gLvlBg.fillStyle(0x445568, 0.96); gLvlBg.fillRect(232, 332, 316, 62);
  // Rose window (three-ring)
  gLvlBg.fillStyle(0xffcc44, 0.44); gLvlBg.fillCircle(390, 358, 22);
  gLvlBg.fillStyle(0x3d5068, 1); gLvlBg.fillCircle(390, 358, 14);
  gLvlBg.fillStyle(0xffcc44, 0.34); gLvlBg.fillCircle(390, 358, 7);
  // Street lamps
  [154, 302, 490, 630].forEach(x => {
    gLvlBg.fillStyle(0x778899, 0.92); gLvlBg.fillRect(x - 2, 450, 4, 46);
    gLvlBg.fillStyle(0xffee88, 0.72); gLvlBg.fillCircle(x, 450, 5);
  });
  // Ángel de la Independencia column (right background)
  gLvlBg.fillStyle(0x556070, 0.94);
  gLvlBg.fillRect(688, 322, 10, 74); gLvlBg.fillRect(682, 396, 22, 10);
  gLvlBg.fillStyle(0xddcc88, 0.84); gLvlBg.fillCircle(693, 316, 8); // angel silhouette
  // Zócalo flagstone plaza hint
  gLvlBg.fillStyle(0x667788, 0.44); gLvlBg.fillRect(232, 482, 316, FLOOR_Y - 482);
}

function bgGuadalajara() {
  bgSky(0xcc5522, 0xffaa44); // atardecer cálido con cielo naranja
  // Nubes teñidas de naranja
  gLvlBg.fillStyle(0xff9966, 0.22);
  [[130, 100, 70], [350, 80, 55], [580, 110, 65], [700, 90, 48]].forEach(([x, y, r]) => gLvlBg.fillCircle(x, y, r));
  // Suelo tierra roja
  gLvlBg.fillStyle(0x7a4830, 1); gLvlBg.fillRect(0, 440, W, FLOOR_Y - 440);
  gLvlBg.fillStyle(0x5c3320, 0.7); gLvlBg.fillRect(0, 470, W, FLOOR_Y - 470);
  // Catedral de Guadalajara (2 torres ornamentadas + cuerpo)
  // Cuerpo principal
  gLvlBg.fillStyle(0x8a6040, 0.95); gLvlBg.fillRect(246, 290, 308, 162);
  gLvlBg.fillStyle(0x6e4c30, 0.95); gLvlBg.fillRect(246, 285, 308, 8); // cornisa
  // Torres
  gLvlBg.fillStyle(0x7a5538, 1);
  gLvlBg.fillRect(258, 210, 72, 82); gLvlBg.fillRect(470, 220, 72, 72);
  // Pináculos
  gLvlBg.fillTriangle(258, 210, 294, 155, 330, 210);
  gLvlBg.fillTriangle(470, 220, 506, 168, 542, 220);
  // Cruz en pináculo
  gLvlBg.fillStyle(0xddbb88, 1); gLvlBg.fillRect(291, 148, 6, 20); gLvlBg.fillRect(285, 153, 18, 5);
  gLvlBg.fillRect(503, 161, 6, 20); gLvlBg.fillRect(497, 166, 18, 5);
  // Ventana rosetón
  gLvlBg.fillStyle(0xffcc66, 0.6); gLvlBg.fillCircle(400, 330, 28);
  gLvlBg.fillStyle(0x7a5538, 1); gLvlBg.fillCircle(400, 330, 18);
  gLvlBg.fillStyle(0xffcc66, 0.4); gLvlBg.fillCircle(400, 330, 10);
  // Arco de entrada
  gLvlBg.fillStyle(0x5a3a1e, 1); gLvlBg.fillRect(380, 380, 40, 72);
  gLvlBg.fillCircle(400, 380, 20);
  // Lámparas de calle
  gLvlBg.fillStyle(0x886644, 1);
  [[158, 440], [640, 440]].forEach(([x, y]) => { gLvlBg.fillRect(x - 2, y - 80, 4, 80); gLvlBg.fillStyle(0xffee88, 0.8); gLvlBg.fillCircle(x, y - 80, 7); gLvlBg.fillStyle(0x886644, 1); });
  // Plantas de agave (en silueta)
  gLvlBg.fillStyle(0x2a5a22, 0.95);
  [[90, 440], [680, 440], [720, 450], [60, 450], [360, 442]].forEach(([x, y]) => {
    for (let a = -0.9; a <= 0.9; a += 0.3) { gLvlBg.fillTriangle(x, y, x + Math.sin(a) * 55, y - 55 + Math.cos(a) * 8, x + Math.sin(a) * 62, y - 50 + Math.cos(a) * 8); }
  });
}

function bgMonterrey() {
  bgSky(0x2255aa, 0x6699cc);
  // Cerro de la Silla — silueta de montaña con silla de montar
  gLvlBg.fillStyle(0x3a4e62, 0.92);
  gLvlBg.fillTriangle(30, FLOOR_Y, 240, 178, 460, FLOOR_Y);
  gLvlBg.fillTriangle(340, FLOOR_Y, 560, 205, 770, FLOOR_Y);
  // Dip de la silla
  gLvlBg.fillStyle(0x2255aa, 1);
  gLvlBg.fillTriangle(330, FLOOR_Y, 455, 270, 580, FLOOR_Y);
  // Nieve en las cimas
  gLvlBg.fillStyle(0xddeeee, 0.6);
  gLvlBg.fillTriangle(224, 192, 240, 178, 256, 192);
  gLvlBg.fillTriangle(544, 218, 560, 205, 576, 218);
  // Skyline moderno de Monterrey
  const bldgs = [[130, 370, 32, 100], [172, 345, 44, 125], [226, 318, 36, 142], [286, 356, 30, 114], [480, 325, 44, 145], [534, 348, 36, 122], [580, 372, 30, 108], [624, 358, 34, 120]];
  bldgs.forEach(([x, y, w, h]) => {
    gLvlBg.fillStyle(0x223344, 0.92); gLvlBg.fillRect(x, y, w, h);
    // Ventanas iluminadas
    gLvlBg.fillStyle(0xffee88, 0.28);
    for (let wy = y + 10; wy < y + h - 10; wy += 18)for (let wx = x + 5; wx < x + w - 5; wx += 10)gLvlBg.fillRect(wx, wy, 6, 9);
    gLvlBg.fillStyle(0x4a7aaa, 0.55); gLvlBg.fillRect(x, y, w, 4);
  });
  // Macroplaza (plaza grande)
  gLvlBg.fillStyle(0x887766, 0.7); gLvlBg.fillRect(310, 448, 180, FLOOR_Y - 448);
  // Faro del Comercio (obelisco)
  gLvlBg.fillStyle(0xcc4422, 0.9); gLvlBg.fillRect(393, 360, 14, 92);
  gLvlBg.fillTriangle(388, 360, 400, 335, 412, 360);
  // Faros de calle
  gLvlBg.fillStyle(0x778899, 1);
  [[108, 440], [690, 440]].forEach(([x, y]) => {
    gLvlBg.fillRect(x - 2, y - 70, 4, 70);
    gLvlBg.fillStyle(0xffee88, 0.75); gLvlBg.fillCircle(x, y - 70, 6);
    gLvlBg.fillStyle(0x778899, 1);
  });
}

function bgCancun() {
  bgSky(0x0088cc, 0x22ccff); // caribe brillante
  // Sol tropical
  gLvlBg.fillStyle(0xffee44, 0.8); gLvlBg.fillCircle(680, 90, 42);
  gLvlBg.fillStyle(0xffdd00, 0.18); gLvlBg.fillCircle(680, 90, 62);
  // Mar turquesa con capas de color
  gLvlBg.fillStyle(0x007aaa, 0.95); gLvlBg.fillRect(0, 270, W, 200);
  gLvlBg.fillStyle(0x00aacc, 0.7); gLvlBg.fillRect(0, 270, W, 50);
  gLvlBg.fillStyle(0x00ccee, 0.4); gLvlBg.fillRect(0, 270, W, 18);
  // Olas
  gLvlBg.lineStyle(2, 0xaaeeff, 0.55);
  for (let x = 55; x < WALL_R; x += 56) { gLvlBg.beginPath(); gLvlBg.arc(x, 296, 13, Math.PI, 0, false); gLvlBg.strokePath(); }
  gLvlBg.lineStyle(1, 0xccffff, 0.3);
  for (let x = 80; x < WALL_R; x += 60) { gLvlBg.beginPath(); gLvlBg.arc(x, 316, 10, Math.PI, 0, false); gLvlBg.strokePath(); }
  // Arena (gradiente)
  gLvlBg.fillStyle(0xf8e8a0, 1); gLvlBg.fillRect(0, 450, W, FLOOR_Y - 450);
  gLvlBg.fillStyle(0xe8d080, 0.6); gLvlBg.fillRect(0, 475, W, FLOOR_Y - 475);
  // Sombrilla de playa
  gLvlBg.fillStyle(0xff5533, 0.9); gLvlBg.fillTriangle(200, 340, 140, 450, 260, 450);
  gLvlBg.fillStyle(0xffee22, 0.9); gLvlBg.fillTriangle(200, 340, 200, 450, 260, 450);
  gLvlBg.fillStyle(0x7a5c2e, 1); gLvlBg.fillRect(199, 340, 2, 115);
  // Palmeras
  [[110, 450], [660, 450], [320, 455], [540, 452]].forEach(([tx, ty]) => {
    // Tronco ligeramente curvado
    gLvlBg.fillStyle(0x8a6535, 1);
    gLvlBg.fillRect(tx - 5, ty - 130, 9, 130);
    // Hojas
    gLvlBg.fillStyle(0x2a8030, 0.95);
    for (let a = -1.1; a <= 1.1; a += 0.37) { gLvlBg.fillTriangle(tx, ty - 130, tx + Math.sin(a) * 75, ty - 130 + Math.cos(a) * 55, tx + Math.sin(a) * 85, ty - 125 + Math.cos(a) * 55); }
    gLvlBg.fillStyle(0x44aa44, 0.5);
    for (let a = -0.8; a <= 0.8; a += 0.5) { gLvlBg.fillTriangle(tx, ty - 130, tx + Math.sin(a) * 55, ty - 130 + Math.cos(a) * 38, tx + Math.sin(a) * 62, ty - 127 + Math.cos(a) * 38); }
  });
  // Gaviota
  gLvlBg.lineStyle(2, 0xffffff, 0.7);
  [[480, 130], [520, 115], [560, 128]].forEach(([x, y]) => {
    gLvlBg.beginPath(); gLvlBg.moveTo(x - 10, y); gLvlBg.lineTo(x, y - 7); gLvlBg.lineTo(x + 10, y); gLvlBg.strokePath();
  });
}

function bgMulege() {
  bgSky(0x6688bb, 0xddbb88); // bruma desértica de Baja California
  // Sol del desierto
  gLvlBg.fillStyle(0xffcc22, 0.9); gLvlBg.fillCircle(120, 100, 38);
  gLvlBg.fillStyle(0xffdd55, 0.2); gLvlBg.fillCircle(120, 100, 58);
  // Golfo de California (a lo lejos)
  gLvlBg.fillStyle(0x3388aa, 0.75); gLvlBg.fillRect(0, 175, W, 110);
  gLvlBg.fillStyle(0x55aacc, 0.45); gLvlBg.fillRect(0, 175, W, 30);
  // Montañas del desierto al fondo
  gLvlBg.fillStyle(0x8a6644, 0.7);
  gLvlBg.fillTriangle(0, FLOOR_Y, 150, 290, 300, FLOOR_Y);
  gLvlBg.fillTriangle(500, FLOOR_Y, 650, 310, 800, FLOOR_Y);
  // Suelo desértico con capas
  gLvlBg.fillStyle(0xcc8833, 1); gLvlBg.fillRect(0, 375, W, FLOOR_Y - 375);
  gLvlBg.fillStyle(0xaa6622, 0.6); gLvlBg.fillRect(0, 428, W, FLOOR_Y - 428);
  gLvlBg.fillStyle(0xbb7733, 0.3); gLvlBg.fillRect(0, 415, W, 15);
  // Cactus cardón de Baja California (alturas fijas)
  [[110, 170], [240, 155], [490, 162], [648, 168], [718, 158]].forEach(([cx, hy]) => {
    gLvlBg.fillStyle(0x3a6e30, 1);
    gLvlBg.fillRect(cx - 9, hy, 18, 375 - hy); // tronco
    gLvlBg.fillRect(cx - 24, hy + 38, 13, 52); // brazo izq
    gLvlBg.fillRect(cx - 24, hy + 14, 13, 28); // base brazo izq
    gLvlBg.fillRect(cx + 11, hy + 50, 13, 50);  // brazo der
    gLvlBg.fillRect(cx + 11, hy + 22, 13, 32);  // base brazo der
    // Espinas
    gLvlBg.fillStyle(0xaacc88, 0.5);
    gLvlBg.fillRect(cx - 10, hy + 70, 2, 4); gLvlBg.fillRect(cx + 8, hy + 90, 2, 4);
  });
  // Rocas y boulder
  gLvlBg.fillStyle(0x997766, 0.85);
  [[80, 385, 28], [390, 405, 20], [590, 392, 26], [450, 395, 14]].forEach(([x, y, r]) => gLvlBg.fillCircle(x, y, r));
  gLvlBg.fillStyle(0x776655, 0.5);
  [[82, 393, 14], [392, 411, 10], [592, 400, 12]].forEach(([x, y, r]) => gLvlBg.fillCircle(x, y, r));
}

function bgVeracruz() {
  bgSky(0xee5522, 0xffcc55); // atardecer del Golfo
  // Sol poniéndose
  gLvlBg.fillStyle(0xffbb22, 0.85); gLvlBg.fillCircle(700, 155, 45);
  gLvlBg.fillStyle(0xff8833, 0.25); gLvlBg.fillCircle(700, 155, 70);
  // Reflejo del sol en el agua
  gLvlBg.fillStyle(0xffaa44, 0.25); gLvlBg.fillRect(640, 230, 120, 200);
  // Golfo de México (capas de color)
  gLvlBg.fillStyle(0x1a5572, 0.95); gLvlBg.fillRect(0, 225, W, 215);
  gLvlBg.fillStyle(0x2277aa, 0.55); gLvlBg.fillRect(0, 225, W, 55);
  gLvlBg.fillStyle(0x44aacc, 0.3); gLvlBg.fillRect(0, 225, W, 20);
  // Olas
  gLvlBg.lineStyle(2, 0x88ccdd, 0.45);
  for (let x = 55; x < WALL_R; x += 75) { gLvlBg.beginPath(); gLvlBg.arc(x, 262, 17, Math.PI, 0, false); gLvlBg.strokePath(); }
  gLvlBg.lineStyle(1, 0xaaddee, 0.25);
  for (let x = 80; x < WALL_R; x += 65) { gLvlBg.beginPath(); gLvlBg.arc(x, 285, 11, Math.PI, 0, false); gLvlBg.strokePath(); }
  // Fuerte de San Juan de Ulúa
  gLvlBg.fillStyle(0x2e4020, 0.95);
  gLvlBg.fillRect(60, 160, 310, 80); // cuerpo del fuerte
  // Almenas
  gLvlBg.fillStyle(0x2e4020, 1);
  for (let bx = 62; bx < 368; bx += 36) { gLvlBg.fillRect(bx, 138, 24, 26); }
  // Torre redonda
  gLvlBg.fillStyle(0x243318, 1); gLvlBg.fillCircle(62, 200, 42);
  // Puerta del fuerte
  gLvlBg.fillStyle(0x101a08, 1); gLvlBg.fillRect(190, 196, 30, 44);
  gLvlBg.fillCircle(205, 196, 15);
  // Bandera
  gLvlBg.fillStyle(0x889988, 1); gLvlBg.fillRect(335, 100, 3, 62);
  gLvlBg.fillStyle(0x006847, 1); gLvlBg.fillRect(338, 102, 14, 40);
  gLvlBg.fillStyle(0xffffff, 1); gLvlBg.fillRect(352, 102, 14, 40);
  gLvlBg.fillStyle(0xce1126, 1); gLvlBg.fillRect(366, 102, 14, 40);
  // Playa de arena (Veracruz)
  gLvlBg.fillStyle(0xdec070, 1); gLvlBg.fillRect(0, 430, W, FLOOR_Y - 430);
  gLvlBg.fillStyle(0xcaae5a, 0.5); gLvlBg.fillRect(0, 460, W, FLOOR_Y - 460);
  // Gaviotas
  gLvlBg.lineStyle(2, 0xffffff, 0.65);
  [[180, 165], [295, 148], [410, 175], [500, 140]].forEach(([x, y]) => {
    gLvlBg.beginPath(); gLvlBg.moveTo(x - 11, y); gLvlBg.lineTo(x, y - 7); gLvlBg.lineTo(x + 11, y); gLvlBg.strokePath();
  });
  // Barco en el horizonte
  gLvlBg.fillStyle(0x1a2a18, 0.7);
  gLvlBg.fillRect(530, 238, 55, 18);
  gLvlBg.fillRect(549, 218, 4, 22);
  gLvlBg.fillTriangle(545, 218, 553, 195, 561, 218);
}

// ── Storage ───────────────────────────────────────────────────────────────────
function getStorage() {
  if (window.platanusArcadeStorage) return window.platanusArcadeStorage;
  return {
    async get(k) {
      try { const r = localStorage.getItem(k); return r ? { found: true, value: JSON.parse(r) } : { found: false, value: null }; }
      catch { return { found: false, value: null }; }
    },
    async set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
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
