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
  4:{r:50,col:0xdc3030,glow:0xff7070,bvy:-465,spd:82, pts:10},
  3:{r:34,col:0xe07820,glow:0xffaa55,bvy:-415,spd:112,pts:20},
  2:{r:20,col:0xcca800,glow:0xffdd30,bvy:-365,spd:155,pts:40},
  1:{r:11,col:0x18a850,glow:0x40e880,bvy:-305,spd:205,pts:80},
};

const LEVELS = [
  [[4,280,1],[4,520,-1]],
  [[4,250,1],[4,550,-1],[3,400,1]],
  [[4,210,1],[4,590,-1],[3,340,1],[2,460,-1]],
  [[4,180,1],[4,400,-1],[4,620,1],[3,290,-1]],
  [[4,160,1],[4,390,-1],[4,630,1],[3,275,1],[3,525,-1]],
  [[4,150,1],[4,350,-1],[4,550,1],[4,700,-1],[3,250,1],[2,430,-1]],
];

// Items: prob sums to 1.0 (life excluded from random pool, handled separately)
const ITEM_TYPES = [
  {type:'life',    col:0xff4488,glow:0xff88bb,label:'+1', prob:0},
  {type:'double',  col:0x44aaff,glow:0x88ccff,label:'2x', prob:0.20},
  {type:'wide',    col:0xffaa00,glow:0xffdd80,label:'||', prob:0.18},
  {type:'sticky',  col:0xff8844,glow:0xffcc88,label:'@',  prob:0.18},
  {type:'machine', col:0xff2244,glow:0xff6688,label:'MG', prob:0.16},
  {type:'freeze',  col:0x00eeff,glow:0x80f8ff,label:'*',  prob:0.16},
  {type:'shield',  col:0xaaffaa,glow:0xccffcc,label:'SH', prob:0.12},
  {type:'dynamite',col:0xff6600,glow:0xff9944,label:'TNT',prob:0.07},
  // sum of non-life = 1.07 → slight over, JS picks first match so last item effectively gets less
];

const NAME_GRID = [
  ['A','B','C','D','E','F','G'],
  ['H','I','J','K','L','M','N'],
  ['O','P','Q','R','S','T','U'],
  ['V','W','X','Y','Z','.','_'],
  ['DEL','OK'],
];

// DO NOT remove or replace existing keys — they map to physical cabinet
const CABINET_KEYS = {
  P1_U:['w'], P1_D:['s'], P1_L:['a'], P1_R:['d'],
  P1_1:['u'], P1_2:['i'], P1_3:['o'],
  P1_4:['j'], P1_5:['k'], P1_6:['l'],
  P2_U:['ArrowUp'], P2_D:['ArrowDown'], P2_L:['ArrowLeft'], P2_R:['ArrowRight'],
  P2_1:['r'], P2_2:['t'], P2_3:['y'],
  P2_4:['f'], P2_5:['g'], P2_6:['h'],
  START1:['Enter'], START2:['2'],
};

const K2A = {};
for (const [c,ks] of Object.entries(CABINET_KEYS))
  for (const k of ks) K2A[k.length===1?k.toLowerCase():k]=c;

const held=Object.create(null), pressed=Object.create(null);
window.addEventListener('keydown', e => {
  const k=e.key.length===1?e.key.toLowerCase():e.key, c=K2A[k];
  if (c) { if (!held[c]) pressed[c]=true; held[c]=true; }
});
window.addEventListener('keyup', e => {
  const k=e.key.length===1?e.key.toLowerCase():e.key, c=K2A[k];
  if (c) held[c]=false;
});
const cp = c => { const v=pressed[c]; pressed[c]=false; return !!v; };
const cpAny = cs => cs.some(c => cp(c));

// ── Phaser Game ───────────────────────────────────────────────────────────────
new Phaser.Game({
  type:Phaser.AUTO, width:W, height:H, parent:'game-root',
  backgroundColor:'#050810',
  scale:{mode:Phaser.Scale.FIT, autoCenter:Phaser.Scale.CENTER_BOTH, width:W, height:H},
  scene:{preload,create,update},
});

function preload() {}

// ── State ─────────────────────────────────────────────────────────────────────
let sc;
let gBg, gLvlBg, gWall, gBall, gHarp, gPlayer, gFx;
let phase = 'menu';
let level=1, score=0, lives=3, twoPlayer=false;
let balls=[], players=[], harpoons=[], harpoons2=[], bullets=[], parts=[], popups=[], items=[];
let highScores=[];
let nameLetters=[], nameRow=0, nameCol=0, nameCd=0;
let menuCursor=0, menuCd=0;
let lvlTimer=0, flashTimer=0;
let freezeTimer=0;
let lifeDroppedThisLevel=false;

let hudScoreTxt, hudLevelTxt, hudLivesTxt;
let menuCtn, goCtn, lvlCtn, nameCtn, savedCtn;
let menuBgs, menuLbls, menuScoresTxt;
let lvlTxt, goScoreTxt, goLvlTxt;
let nameScoreTxt, nameDisplayTxt2, nameGrid=[];
let savedBodyTxt, freezeTxt;

function create() {
  sc = this;
  gBg=sc.add.graphics();
  gLvlBg=sc.add.graphics(); // level-specific city background
  gWall=sc.add.graphics(); gBall=sc.add.graphics();
  gHarp=sc.add.graphics(); gPlayer=sc.add.graphics(); gFx=sc.add.graphics();
  drawBg(); drawArena();
  buildHUD(); buildMenu(); buildGO(); buildLvlClear(); buildNameEntry(); buildSaved();
  // Freeze countdown display (center screen, big)
  freezeTxt=sc.add.text(W/2,H/2-70,'',{
    fontFamily:'monospace',fontSize:'90px',color:'#00eeff',fontStyle:'bold',
    stroke:'#004466',strokeThickness:8,shadow:{blur:20,color:'#00eeff',fill:true}
  }).setOrigin(0.5).setDepth(50).setVisible(false);
  loadScores().then(s => { highScores=s; refreshMenuScores(); });
  showMenu();
}

function update(_,raw) {
  const dt = Math.min(raw/1000, 0.05);
  if (flashTimer>0) flashTimer-=raw;
  if (phase==='menu')      { updateMenu(dt); return; }
  if (phase==='playing')   { updateGame(dt); return; }
  if (phase==='lvlclear')  { updateLvlClear(dt); return; }
  if (phase==='nameentry') { updateNameEntry(dt); return; }
  if (phase==='gameover')  return;
  if (phase==='saved' && cpAny(['START1','START2','P1_1','P2_1'])) showMenu();
}

// ── Background & Arena ────────────────────────────────────────────────────────
function drawBg() {
  const g=gBg;
  g.fillGradientStyle(0x050810,0x050810,0x0a1025,0x0a1025,1); g.fillRect(0,0,W,H);
  g.lineStyle(1,0x162040,0.5);
  for (let x=0;x<=W;x+=48) { g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.strokePath(); }
  for (let y=0;y<=H;y+=48) { g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.strokePath(); }
  g.lineStyle(1,0x000000,0.12);
  for (let y=0;y<H;y+=3) { g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.strokePath(); }
}

function drawArena() {
  const g=gWall, FILL=0x0e2040, BORD=0x2a6fff;
  g.fillStyle(FILL);
  g.fillRect(0,0,WALL_L,H); g.fillRect(WALL_R,0,W-WALL_R,H);
  g.fillRect(0,0,W,TOP_Y);  g.fillRect(0,FLOOR_Y,W,H-FLOOR_Y);
  g.lineStyle(3,BORD,1); g.strokeRect(WALL_L,TOP_Y,WALL_R-WALL_L,FLOOR_Y-TOP_Y);
  g.fillStyle(BORD);
  [[WALL_L,TOP_Y],[WALL_R,TOP_Y],[WALL_L,FLOOR_Y],[WALL_R,FLOOR_Y]].forEach(([cx,cy])=>g.fillCircle(cx,cy,5));
  g.lineStyle(1,BORD,0.25);
  for (let y=TOP_Y+20;y<FLOOR_Y;y+=32) {
    g.beginPath();g.moveTo(WALL_L-8,y);g.lineTo(WALL_L-2,y+8);g.lineTo(WALL_L-8,y+16);g.strokePath();
    g.beginPath();g.moveTo(WALL_R+8,y);g.lineTo(WALL_R+2,y+8);g.lineTo(WALL_R+8,y+16);g.strokePath();
  }
}

// ── HUD ───────────────────────────────────────────────────────────────────────
function buildHUD() {
  const ts={fontFamily:'monospace',fontSize:'18px',fontStyle:'bold'};
  hudScoreTxt=sc.add.text(W/2,14,'SCORE 0',{...ts,color:'#e1ff00'}).setOrigin(0.5,0).setDepth(5);
  hudLevelTxt=sc.add.text(WALL_R-8,14,'LV 1',{...ts,color:'#4a9eff'}).setOrigin(1,0).setDepth(5);
  hudLivesTxt=sc.add.text(WALL_L+8,14,'♥ 3',{...ts,color:'#ff6ec7'}).setOrigin(0,0).setDepth(5);
}
function refreshHUD() {
  hudScoreTxt&&hudScoreTxt.setText('SCORE '+score);
  hudLevelTxt&&hudLevelTxt.setText('LV '+level);
  hudLivesTxt&&hudLivesTxt.setText('♥ '+Math.max(0,lives));
}

// ── Menu ──────────────────────────────────────────────────────────────────────
function buildMenu() {
  const c=sc.add.container(0,0).setDepth(10); menuCtn=c;
  c.add(sc.add.rectangle(W/2,H/2,W,H,0x050810,0.97));
  const tg=sc.add.graphics();
  tg.fillStyle(0x1a4020,0.5); tg.fillRect(W-80,H-120,14,90);
  tg.fillStyle(0x1e5a28,0.4);
  tg.fillCircle(W-73,H-130,40); tg.fillCircle(W-50,H-150,30); tg.fillCircle(W-100,H-145,28);
  tg.fillStyle(0x22702e,0.3); tg.fillCircle(W-73,H-155,25);
  c.add(tg);
  const title=sc.add.text(W/2,105,'SUPER PLATANUS',{fontFamily:'monospace',fontSize:'50px',color:'#e1ff00',fontStyle:'bold'}).setOrigin(0.5);
  c.add(title);
  sc.tweens.add({targets:title,scaleX:1.02,scaleY:1.02,alpha:0.88,duration:1300,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
  c.add(sc.add.text(W/2,164,'🌿  POP ALL THE BUBBLES  🌿',{fontFamily:'monospace',fontSize:'15px',color:'#4a9eff'}).setOrigin(0.5));
  menuBgs=[]; menuLbls=[];
  ['1 PLAYER','2 PLAYERS CO-OP'].forEach((opt,i)=>{
    const y=236+i*58;
    const bg=sc.add.rectangle(W/2,y,320,46,0x0d1a30,0.95).setStrokeStyle(2,0x1a3560,0.8);
    const lbl=sc.add.text(W/2,y,opt,{fontFamily:'monospace',fontSize:'24px',color:'#c8d8f0',fontStyle:'bold'}).setOrigin(0.5);
    c.add(bg); c.add(lbl); menuBgs.push(bg); menuLbls.push(lbl);
  });
  c.add(sc.add.text(W/2,374,'TOP SCORES',{fontFamily:'monospace',fontSize:'13px',color:'#e1ff00',fontStyle:'bold'}).setOrigin(0.5));
  menuScoresTxt=sc.add.text(W/2,394,'NO SCORES YET',{fontFamily:'monospace',fontSize:'12px',color:'#a8b8d0',align:'center',lineSpacing:3}).setOrigin(0.5,0);
  c.add(menuScoresTxt);
  c.add(sc.add.text(W/2,H-20,'MOVE ↕   CONFIRM B1 / START',{fontFamily:'monospace',fontSize:'11px',color:'#1e3050'}).setOrigin(0.5));
  c.setVisible(false); refreshMenuHighlight();
}

function refreshMenuHighlight() {
  if (!menuBgs) return;
  menuBgs.forEach((bg,i)=>{
    const act=i===menuCursor;
    bg.setFillStyle(act?0xe1ff00:0x0d1a30, act?1:0.95);
    bg.setStrokeStyle(2, act?0xffffff:0x1a3560, act?1:0.8);
    menuLbls[i].setColor(act?'#050810':'#c8d8f0');
  });
}

function refreshMenuScores() {
  if (!menuScoresTxt) return;
  if (!highScores.length) { menuScoresTxt.setText('NO SCORES YET'); return; }
  menuScoresTxt.setText(
    highScores.slice(0,5).map((e,i)=>
      `${String(i+1).padStart(2,'0')}  ${(e.name||'???').padEnd(3,' ')}  ${String(e.score||0).padStart(7,' ')}  LV${e.level||1}`
    ).join('\n')
  );
}

function showMenu() {
  phase='menu'; menuCursor=0; menuCd=0;
  menuCtn.setVisible(true);
  goCtn&&goCtn.setVisible(false); nameCtn&&nameCtn.setVisible(false);
  savedCtn&&savedCtn.setVisible(false); lvlCtn&&lvlCtn.setVisible(false);
  refreshMenuHighlight(); refreshMenuScores();
  gBall.clear(); gPlayer.clear(); gHarp.clear(); gFx.clear();
}

function updateMenu(dt) {
  menuCd-=dt;
  if (menuCd<=0) {
    const up=held.P1_U||held.P2_U, dn=held.P1_D||held.P2_D;
    if (up||dn) { menuCursor=up?Math.max(0,menuCursor-1):Math.min(1,menuCursor+1); menuCd=0.18; refreshMenuHighlight(); }
  }
  if (cpAny(['P1_1','P2_1','P1_2','P2_2','START1','START2'])) startGame(menuCursor===1);
}

// ── Game Start / Level ────────────────────────────────────────────────────────
function startGame(tp) {
  twoPlayer=tp; level=1; score=0; lives=3;
  menuCtn.setVisible(false); goCtn&&goCtn.setVisible(false); savedCtn&&savedCtn.setVisible(false);
  startLevel();
}

function startLevel() {
  balls=[]; players=[]; harpoons=[]; harpoons2=[]; bullets=[]; parts=[];
  popups.forEach(p=>p.t&&p.t.destroy()); popups=[];
  items.forEach(it=>it.txt&&it.txt.destroy()); items=[];
  freezeTimer=0; lifeDroppedThisLevel=false;
  phase='playing';
  const def=LEVELS[Math.min(level-1,LEVELS.length-1)], sc2=1+(level-1)*0.07;
  // Spawn players first (so we know their positions)
  spawnPlayer(0, WALL_L+90);
  if (twoPlayer) spawnPlayer(1, WALL_R-90);
  // Give all players 3s starting invincibility so they can't spawn inside a ball
  players.forEach(p => { p.invTimer=3.0; });
  // Spawn balls, shifting any that start on top of a player
  const pxs=players.map(p=>p.x);
  for (const [sz,bx,dir] of def) {
    const d=BDATA[sz];
    let sx=bx;
    // If ball start X is within radius+50 of any player, push it away
    for (const px of pxs) { if (Math.abs(sx-px)<d.r+60) sx=px+Math.sign(sx-px||1)*(d.r+70); }
    sx=Math.max(WALL_L+d.r+4,Math.min(WALL_R-d.r-4,sx));
    spawnBall(sx, FLOOR_Y-d.r-2, sz, d.spd*dir*sc2, d.bvy*(1+(level-1)*0.035));
  }
  lvlCtn&&lvlCtn.setVisible(false);
  drawLevelBg(level); // draw city background for this level
  startMusic();       // ensure music is playing
  refreshHUD();
}

// ── Ball ──────────────────────────────────────────────────────────────────────
function spawnBall(x,y,size,vx,vy) {
  balls.push({x,y,vx,vy,size,r:BDATA[size].r,active:true});
}

function updateBalls(dt) {
  if (freezeTimer>0) { freezeTimer-=dt; return; }
  for (const b of balls) {
    if (!b.active) continue;
    b.vy+=GRAVITY*dt; b.x+=b.vx*dt; b.y+=b.vy*dt;
    if (b.x-b.r<WALL_L) { b.x=WALL_L+b.r; b.vx=Math.abs(b.vx); }
    if (b.x+b.r>WALL_R) { b.x=WALL_R-b.r; b.vx=-Math.abs(b.vx); }
    if (b.y-b.r<TOP_Y)  { b.y=TOP_Y+b.r;  b.vy=Math.abs(b.vy)*0.6; }
    if (b.y+b.r>FLOOR_Y){ b.y=FLOOR_Y-b.r; b.vy=BDATA[b.size].bvy*(1+(level-1)*0.035); }
  }
}

function popBall(b) {
  b.active=false;
  const d=BDATA[b.size], pts=d.pts*(1+Math.floor((level-1)/2));
  score+=pts;
  spawnParts(b.x,b.y,d.glow,b.size*6+4);
  spawnPopup(b.x,b.y-b.r,'+'+pts);
  sfxPop(b.size);
  if (b.size>1) {
    const ns=b.size-1, nd=BDATA[ns], spd=nd.spd*(1+(level-1)*0.07);
    spawnBall(b.x-8,b.y,ns,-spd,nd.bvy*(1+(level-1)*0.035));
    spawnBall(b.x+8,b.y,ns, spd,nd.bvy*(1+(level-1)*0.035));
  }
  // Item drops — life: at most 1 per level, 7% chance; others: 14% chance
  const roll=Math.random();
  if (!lifeDroppedThisLevel && roll<0.07) {
    lifeDroppedThisLevel=true; spawnItem(b.x,b.y,'life');
  } else if (roll<0.07+0.14) {
    spawnItem(b.x,b.y,null);
  }
}

// ── Items ─────────────────────────────────────────────────────────────────────
function spawnItem(x,y,forceType) {
  let chosen;
  if (forceType) {
    chosen=ITEM_TYPES.find(t=>t.type===forceType)||ITEM_TYPES[1];
  } else {
    const pool=ITEM_TYPES.filter(t=>t.type!=='life');
    const total=pool.reduce((s,t)=>s+t.prob,0);
    let roll=Math.random()*total, acc=0;
    chosen=pool[pool.length-1];
    for (const t of pool) { acc+=t.prob; if (roll<acc){chosen=t;break;} }
  }
  const txt=sc.add.text(x,y,chosen.label,{fontFamily:'monospace',fontSize:'13px',color:'#ffffff',fontStyle:'bold'}).setOrigin(0.5).setDepth(15);
  items.push({x,y,vy:140,type:chosen.type,col:chosen.col,glow:chosen.glow,label:chosen.label,txt,life:10,active:true});
}

function updateItems(dt) {
  for (let i=items.length-1;i>=0;i--) {
    const it=items[i];
    if (!it.active) { it.txt&&it.txt.destroy(); items.splice(i,1); continue; }
    it.y+=it.vy*dt;
    it.txt&&it.txt.setPosition(it.x,it.y);
    it.life-=dt;
    if (it.y>FLOOR_Y+20||it.life<=0) { it.txt&&it.txt.destroy(); items.splice(i,1); continue; }
    for (const p of players) {
      if (!p.alive) continue;
      const dx=p.x-it.x, dy=p.y-it.y;
      if (dx*dx+dy*dy<(14+P_HW+8)**2) { applyItem(p,it); it.txt&&it.txt.destroy(); it.active=false; break; }
    }
  }
}

function applyItem(player,item) {
  spawnPopup(player.x, player.y-44, item.label);
  switch(item.type) {
    case 'life':
      sfxLifeUp(); lives=Math.min(lives+1,9); refreshHUD(); break;
    case 'freeze':
      sfxItemPickup(); freezeTimer=4.5; break;
    case 'shield':
      sfxItemPickup(); player.shielded=true; break;
    case 'dynamite':
      sfxDynamite(); dynamiteBlast(); break;
    case 'machine':
      sfxItemPickup(); player.harpType='machine'; player.machineTimer=MACHINE_DUR; break;
    default: // double, wide, sticky — harpoon upgrade
      sfxItemPickup(); player.harpType=item.type; break;
  }
}

function dynamiteBlast() {
  // Split every non-size-1 ball recursively down to size 1 — creates beautiful chaos!
  flashTimer=600;
  function splitDown(x,y,size,dir) {
    // No cap — let the chaos unfold!
    if (size<=1) {
      const d=BDATA[1], spd=d.spd*(1+(level-1)*0.07)*(0.7+Math.random()*0.6);
      spawnBall(x,y,1,spd*dir,d.bvy*(1+(level-1)*0.035));
      return;
    }
    const ns=size-1, nd=BDATA[ns], spd=nd.spd*(1+(level-1)*0.07);
    spawnParts(x,y,BDATA[size].glow,6);
    splitDown(x-10,y,ns,-1);
    splitDown(x+10,y,ns,+1);
  }
  const snapshot=balls.filter(b=>b.active&&b.size>1);
  snapshot.forEach(b=>{ b.active=false; });
  snapshot.forEach(b=>splitDown(b.x,b.y,b.size,b.vx>=0?1:-1));
  // Size-1 balls that were already there: keep them alive (they don't split)
  refreshHUD();
}

// ── Player ────────────────────────────────────────────────────────────────────
function spawnPlayer(id,x) {
  players.push({id,x,y:FLOOR_Y-P_HH,alive:true,invTimer:0,respTimer:0,
    shootCd:0, harpType:'normal', machineTimer:0, shielded:false});
  harpoons.push(null); harpoons2.push(null);
}

function updatePlayers(dt) {
  for (let i=0;i<players.length;i++) {
    const p=players[i];
    if (!p.alive) {
      p.respTimer-=dt;
      if (p.respTimer<=0&&lives>0) { p.alive=true; p.invTimer=2.8; p.x=i===0?WALL_L+90:WALL_R-90; }
      continue;
    }
    if (p.invTimer>0) p.invTimer-=dt;
    if (p.shootCd>0) p.shootCd-=dt;
    if (p.harpType==='machine'&&p.machineTimer>0) {
      p.machineTimer-=dt;
      if (p.machineTimer<=0) { p.harpType='normal'; p.machineTimer=0; }
    }

    const lKey=i===0?'P1_L':'P2_L', rKey=i===0?'P1_R':'P2_R';
    const shK=i===0?['P1_1','P1_2','P1_3']:['P2_1','P2_2','P2_3'];
    if (held[lKey]) p.x-=P_SPEED*dt;
    if (held[rKey]) p.x+=P_SPEED*dt;
    p.x=Math.max(WALL_L+P_HW+2,Math.min(WALL_R-P_HW-2,p.x));
    p.y=FLOOR_Y-P_HH;

    const wantShoot=shK.some(k=>held[k]);
    // canShoot: double needs both slots free; machine uses bullets (always can stack); others need slot1
    const s1=!harpoons[i], s2=!harpoons2[i];
    const isMG=p.harpType==='machine'&&p.machineTimer>0;
    const canShoot=p.shootCd<=0&&(isMG||(s1&&(p.harpType!=='double'||s2)));

    if (canShoot&&wantShoot) {
      if (isMG) {
        // Machine gun: fan of MACHINE_N diagonal bullets per burst — no harpoon slot used
        const angles=[];
        for(let k=0;k<MACHINE_N;k++) angles.push(-Math.PI/2+(k-(MACHINE_N-1)/2)*0.22);
        angles.forEach(a=>{
          bullets.push({x:p.x,y:p.y-P_HH-4,vx:Math.cos(a)*BULLET_SPEED,vy:Math.sin(a)*BULLET_SPEED,owner:i,active:true});
        });
        p.shootCd=MACHINE_BURST_CD; sfxShoot();
      } else {
        const hw=p.harpType==='wide'?14:5;
        const sticky=p.harpType==='sticky';
        const base={top:p.y-P_HH-2,bot:p.y-P_HH-2,ext:true,owner:i,halfW:hw,alpha:1.0,sticky};
        if (p.harpType==='double') {
          harpoons[i]={...base,x:p.x-12};
          harpoons2[i]={...base,x:p.x+12};
        } else {
          harpoons[i]={...base,x:p.x};
        }
        p.shootCd=0.12; sfxShoot();
      }
    }
  }
}

function killPlayer(p) {
  lives--; p.alive=false; p.respTimer=2.2;
  const idx=players.indexOf(p);
  if (idx>=0) { harpoons[idx]=null; harpoons2[idx]=null; }
  spawnParts(p.x,p.y,p.id===0?0xe1ff00:0xff6ec7,14);
  sfxDeath(); flashTimer=350; refreshHUD();
  if (lives<=0) { phase='gameover'; sc.time.delayedCall(1400,triggerGameOver,[],sc); }
}

// ── Harpoon ───────────────────────────────────────────────────────────────────
function updateHarpArray(harps,dt) {
  for (let i=0;i<harps.length;i++) {
    const h=harps[i]; if (!h) continue;
    if (h.stuck) {
      h.stuckTimer-=dt;
      checkHarpBalls(h,i,harps);
      if (h.stuckTimer<=0) harps[i]=null;
    } else if (h.ext) {
      h.top-=HARP_SPEED*dt;
      if (h.top<=TOP_Y+4) {
        h.top=TOP_Y+4;
        if (h.sticky) { h.ext=false; h.stuck=true; h.stuckTimer=3.5; h.bot=FLOOR_Y; h.halfW=3; }
        else { h.ext=false; }
      }
      if (!h.stuck&&checkHarpBalls(h,i,harps)) continue;
    } else {
      // Retract with fadeout — still collides while visible
      h.top+=HARP_SPEED*1.6*dt;
      h.alpha=Math.max(0,(h.bot-h.top)/Math.max(1,h.bot-TOP_Y));
      if (h.alpha>0.05) checkHarpBalls(h,i,harps);
      if (h.top>=h.bot) harps[i]=null;
    }
  }
}

function updateHarpoons(dt) { updateHarpArray(harpoons,dt); updateHarpArray(harpoons2,dt); }

function checkHarpBalls(h,hi,harps) {
  const hw=h.halfW||5;
  for (const b of balls) {
    if (!b.active) continue;
    if (Math.abs(h.x-b.x)>b.r+hw) continue;
    if (h.top>b.y+b.r||h.bot<b.y-b.r) continue;
    popBall(b); harps[hi]=null; return true;
  }
  return false;
}

// ── Bullets (machine gun fan projectiles) ────────────────────────────────────
function updateBullets(dt) {
  for (let i=bullets.length-1;i>=0;i--) {
    const bu=bullets[i];
    if (!bu.active){bullets.splice(i,1);continue;}
    bu.x+=bu.vx*dt; bu.y+=bu.vy*dt;
    // Remove if out of arena
    if (bu.x<WALL_L||bu.x>WALL_R||bu.y<TOP_Y||bu.y>FLOOR_Y){bullets.splice(i,1);continue;}
    // Bounce off side walls (horizontal component flips)
    // (already removed above — bullets disappear at walls)
    // Check ball collision
    let hit=false;
    for (const b of balls) {
      if (!b.active) continue;
      const dx=bu.x-b.x, dy=bu.y-b.y;
      if (dx*dx+dy*dy<(b.r+4)**2) { popBall(b); hit=true; break; }
    }
    if (hit){bullets.splice(i,1);}
  }
}

function renderBullets() {
  for (const bu of bullets) {
    const col=bu.owner===0?0xe1ff00:0xff6ec7;
    // Glowing flame trail shape
    gHarp.fillStyle(col,0.25); gHarp.fillCircle(bu.x,bu.y,7);
    gHarp.fillStyle(0xffffff,0.95); gHarp.fillCircle(bu.x,bu.y,3);
    gHarp.fillStyle(col,0.7); gHarp.fillCircle(bu.x,bu.y,5);
  }
}

// ── Ball–Player Collision ─────────────────────────────────────────────────────
function checkBallPlayer() {
  if (freezeTimer>0) return; // freeze = full invincibility for players
  for (const p of players) {
    if (!p.alive) continue;
    const px1=p.x-P_HW, px2=p.x+P_HW, py1=p.y-P_HH, py2=p.y+P_HH;
    let hit=false;
    for (const b of balls) {
      if (!b.active) continue;
      const cx=Math.max(px1,Math.min(px2,b.x)), cy=Math.max(py1,Math.min(py2,b.y));
      const dx=b.x-cx, dy=b.y-cy;
      if (dx*dx+dy*dy<b.r*b.r) { hit=true; break; }
    }
    if (!hit) continue;
    if (p.shielded) {
      p.shielded=false; p.invTimer=0.8;
      spawnParts(p.x,p.y,0xaaffaa,12); sfxShieldBreak();
    } else if (p.invTimer<=0) {
      killPlayer(p);
    }
  }
}

// ── Level Clear ───────────────────────────────────────────────────────────────
function checkLevelClear() {
  if (balls.length>0&&balls.every(b=>!b.active)) {
    phase='lvlclear'; lvlTimer=2.8;
    const bonus=level*500; score+=bonus; refreshHUD(); sfxLevelClear();
    lvlCtn&&lvlCtn.setVisible(true);
    lvlTxt&&lvlTxt.setText(`LEVEL ${level} CLEAR!\n+${bonus} BONUS`);
    level++;
  }
}

function updateLvlClear(dt) {
  lvlTimer-=dt; if (lvlTimer<=0) { lvlCtn&&lvlCtn.setVisible(false); startLevel(); }
}

function triggerGameOver() {
  goCtn&&goCtn.setVisible(true); sfxGameOver();
  goScoreTxt&&goScoreTxt.setText('SCORE: '+score);
  goLvlTxt&&goLvlTxt.setText('REACHED LEVEL '+level);
  sc.time.delayedCall(2000,()=>{ goCtn&&goCtn.setVisible(false); showNameEntry(); },[],sc);
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
  if (freezeTimer>0) {
    const secs=Math.ceil(freezeTimer);
    freezeTxt.setText(secs.toString());
    // Pulse alpha for urgency as time runs out
    const pulse=freezeTimer<2?0.6+0.4*Math.sin(sc.time.now/120):1;
    freezeTxt.setAlpha(pulse);
    freezeTxt.setScale(freezeTimer<2?1+0.1*Math.sin(sc.time.now/120):1);
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
    const d=BDATA[b.size];
    gBall.fillStyle(d.glow,0.10); gBall.fillCircle(b.x,b.y,b.r+14);
    gBall.fillStyle(d.glow,0.16); gBall.fillCircle(b.x,b.y,b.r+7);
    gBall.fillStyle(d.col,1);     gBall.fillCircle(b.x,b.y,b.r);
    gBall.fillStyle(0xffffff,0.22); gBall.fillCircle(b.x-b.r*0.32,b.y-b.r*0.32,b.r*0.38);
    gBall.fillStyle(0xffffff,0.10); gBall.fillCircle(b.x-b.r*0.22,b.y-b.r*0.22,b.r*0.18);
    if (b.size>=2) {
      const ew=b.r*0.19;
      gBall.fillStyle(0x000000,0.75);
      gBall.fillEllipse(b.x-b.r*0.28,b.y-b.r*0.08,ew*1.2,ew*1.5);
      gBall.fillEllipse(b.x+b.r*0.28,b.y-b.r*0.08,ew*1.2,ew*1.5);
      gBall.fillStyle(0xffffff,0.9);
      gBall.fillCircle(b.x-b.r*0.22,b.y-b.r*0.14,ew*0.38);
      gBall.fillCircle(b.x+b.r*0.32,b.y-b.r*0.14,ew*0.38);
      gBall.lineStyle(Math.max(1.5,b.r*0.07),0x000000,0.7);
      gBall.beginPath();gBall.moveTo(b.x-b.r*0.42,b.y-b.r*0.3);gBall.lineTo(b.x-b.r*0.12,b.y-b.r*0.22);gBall.strokePath();
      gBall.beginPath();gBall.moveTo(b.x+b.r*0.42,b.y-b.r*0.3);gBall.lineTo(b.x+b.r*0.12,b.y-b.r*0.22);gBall.strokePath();
      gBall.lineStyle(Math.max(1.5,b.r*0.055),0x000000,0.7);
      gBall.beginPath();gBall.arc(b.x,b.y+b.r*0.18,b.r*0.24,0.25,Math.PI-0.25,false);gBall.strokePath();
    }
  }
}

// ── Render: Harpoons ──────────────────────────────────────────────────────────
function renderHarpArray(harps) {
  for (let i=0;i<harps.length;i++) {
    const h=harps[i]; if (!h) continue;
    const pCol=i===0?0xe1ff00:0xff6ec7;
    const a=h.stuck?0.85:(h.alpha!==undefined?h.alpha:1.0);
    const hw=h.halfW||5;
    if (a<=0.01) continue;
    if (h.stuck) {
      // Sticky harpoon: glowing vertical wall
      gHarp.lineStyle(hw*2+8,0x00ffaa,0.14); gHarp.beginPath();gHarp.moveTo(h.x,h.top);gHarp.lineTo(h.x,h.bot);gHarp.strokePath();
      gHarp.lineStyle(2,0x00ffaa,0.85);       gHarp.beginPath();gHarp.moveTo(h.x,h.top);gHarp.lineTo(h.x,h.bot);gHarp.strokePath();
      // Anchor circle at top
      gHarp.fillStyle(0x00ffaa,0.9); gHarp.fillCircle(h.x,h.top+6,6);
      gHarp.fillStyle(0x050810,1);   gHarp.fillCircle(h.x,h.top+6,3);
      // Duration bar alongside wire
      const barPct=h.stuckTimer/3.5;
      gHarp.fillStyle(0x00ffaa,0.35); gHarp.fillRect(h.x+4,h.top,4,(h.bot-h.top)*barPct);
    } else {
      gHarp.lineStyle(hw*2+4,pCol,0.18*a); gHarp.beginPath();gHarp.moveTo(h.x,h.bot);gHarp.lineTo(h.x,h.top);gHarp.strokePath();
      gHarp.lineStyle(hw>5?hw:2,0xffffff,0.92*a); gHarp.beginPath();gHarp.moveTo(h.x,h.bot);gHarp.lineTo(h.x,h.top);gHarp.strokePath();
      if (h.ext||a>0.3) {
        gHarp.fillStyle(pCol,a);
        gHarp.fillTriangle(h.x-hw,h.top+hw*2,h.x+hw,h.top+hw*2,h.x,h.top);
      }
    }
  }
}

function renderHarpoons() { gHarp.clear(); renderHarpArray(harpoons); renderHarpArray(harpoons2); }

// ── Render: Players (Banana) ──────────────────────────────────────────────────
const P_COLS=[0xe1ff00,0xff6ec7];
const BAN_BODY=0xf5d020, BAN_TIP=0x8b6914, BAN_DARK=0xe0a800;

function drawBanana(g,cx,cy,col,tilt) {
  const lean=tilt*4;
  // Glow
  g.fillStyle(col,0.10); g.fillEllipse(cx+lean,cy,30,60);
  // Main banana body
  g.fillStyle(BAN_BODY,1); g.fillEllipse(cx+lean*0.5,cy,18,46); g.fillEllipse(cx+lean*0.3,cy-4,14,38);
  // Darker stripe
  g.fillStyle(BAN_DARK,0.5); g.fillEllipse(cx+lean*0.2+2,cy,6,36);
  // Brown tips
  g.fillStyle(BAN_TIP,1); g.fillEllipse(cx+lean*0.8,cy-22,7,7); g.fillEllipse(cx+lean*0.1,cy+22,7,7);
  // Eyes
  g.fillStyle(0x1a0a00,0.85); g.fillCircle(cx-3+lean*0.2,cy-5,2.5); g.fillCircle(cx+3+lean*0.2,cy-5,2.5);
  // Smile
  g.lineStyle(1.5,0x1a0a00,0.7); g.beginPath(); g.arc(cx+lean*0.2,cy+2,4,0.2,Math.PI-0.2,false); g.strokePath();
  // Cannon nozzle
  const nx=cx+lean*0.8, ny=cy-24;
  g.fillStyle(col,0.9); g.fillRect(nx-2,ny-10,4,12);
  g.fillStyle(0xffffff,0.3); g.fillRect(nx-1,ny-10,1,12);
  g.fillStyle(col,0.7); g.fillEllipse(nx,ny-10,10,5);
}

function renderPlayers() {
  gPlayer.clear();
  const t=sc.time.now/1000;
  for (let i=0;i<players.length;i++) {
    const p=players[i], col=P_COLS[i];
    if (!p.alive) {
      if (lives>0) { gPlayer.fillStyle(BAN_BODY,0.25+0.2*Math.sin(t*9)); gPlayer.fillEllipse(i===0?WALL_L+90:WALL_R-90,FLOOR_Y-P_HH,20,32); }
      continue;
    }
    if (p.invTimer>0&&Math.floor(t*10)%2===0) continue;
    const x=p.x, y=p.y;
    // Ground shadow
    gPlayer.fillStyle(0x000000,0.2); gPlayer.fillEllipse(x,FLOOR_Y+3,20,6);
    // Shield ring (permanent until broken)
    if (p.shielded) {
      const sa=0.55+0.25*Math.sin(t*4);
      gPlayer.lineStyle(3,0xaaffaa,sa); gPlayer.strokeCircle(x,y,P_HW+18);
      gPlayer.lineStyle(1,0xaaffaa,sa*0.4); gPlayer.strokeCircle(x,y,P_HW+24);
      gPlayer.fillStyle(0xaaffaa,0.06+0.04*Math.sin(t*4)); gPlayer.fillCircle(x,y,P_HW+18);
    }
    drawBanana(gPlayer,x,y,col,i===0?1:-1);
    // Machine gun timer bar above player
    if (p.harpType==='machine'&&p.machineTimer>0) {
      const bw=34, bh=4, bx=x-bw/2, by=y-P_HH-24, pct=p.machineTimer/MACHINE_DUR;
      gPlayer.fillStyle(0x222222,0.85); gPlayer.fillRect(bx-1,by-1,bw+2,bh+2);
      gPlayer.fillStyle(0xff2244,0.95); gPlayer.fillRect(bx,by,bw*pct,bh);
      gPlayer.lineStyle(1,0xff6688,0.8); gPlayer.strokeRect(bx-1,by-1,bw+2,bh+2);
    }
  }
}

// ── Render: FX & Items ────────────────────────────────────────────────────────
function renderFx() {
  gFx.clear();
  if (freezeTimer>0) {
    gFx.fillStyle(0x00eeff,Math.min(0.12,freezeTimer*0.03));
    gFx.fillRect(WALL_L,TOP_Y,WALL_R-WALL_L,FLOOR_Y-TOP_Y);
  }
  for (const p of parts) {
    if (p.life<=0) continue;
    const a=(p.life/p.maxLife)*0.9;
    gFx.fillStyle(p.col,a); gFx.fillCircle(p.x,p.y,p.r*(p.life/p.maxLife));
  }
  if (flashTimer>0) { gFx.fillStyle(0xff6600,(flashTimer/600)*0.3); gFx.fillRect(0,0,W,H); }
}

function renderItems() {
  for (const it of items) {
    if (!it.active) continue;
    const pulse=0.7+0.3*Math.sin(sc.time.now/300);
    gFx.fillStyle(it.glow,0.18*pulse); gFx.fillCircle(it.x,it.y,20);
    gFx.fillStyle(it.col,1);           gFx.fillCircle(it.x,it.y,14);
    gFx.fillStyle(0xffffff,0.35);      gFx.fillCircle(it.x-4,it.y-4,4);
    if (it.life<3&&Math.floor(sc.time.now/200)%2===0) it.txt&&it.txt.setAlpha(0);
    else it.txt&&it.txt.setAlpha(1);
  }
}

// ── Particles ─────────────────────────────────────────────────────────────────
function spawnParts(x,y,col,n) {
  for (let i=0;i<n;i++) {
    const a=(Math.PI*2*i/n)+Math.random()*0.6, spd=70+Math.random()*170, life=0.5+Math.random()*0.55;
    parts.push({x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd-50,r:2.5+Math.random()*3.5,col,life,maxLife:life});
  }
  if (parts.length>240) parts.splice(0,parts.length-240);
}
function updateParts(dt) {
  for (const p of parts) { if(p.life<=0)continue; p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=210*dt;p.life-=dt; }
}

// ── Score Popups ──────────────────────────────────────────────────────────────
function spawnPopup(x,y,txt) {
  const t=sc.add.text(x,y,txt,{fontFamily:'monospace',fontSize:'20px',color:'#ffffff',fontStyle:'bold'}).setOrigin(0.5).setDepth(30);
  popups.push({t,life:1.1,vy:-75});
}
function updatePopups(dt) {
  for (let i=popups.length-1;i>=0;i--) {
    const p=popups[i]; p.t.y+=p.vy*dt; p.vy*=0.95; p.life-=dt; p.t.setAlpha(Math.max(0,p.life));
    if (p.life<=0) { p.t.destroy(); popups.splice(i,1); }
  }
}

// ── Screens ───────────────────────────────────────────────────────────────────
function buildGO() {
  const c=sc.add.container(0,0).setDepth(20); goCtn=c;
  c.add(sc.add.rectangle(W/2,H/2,W,H,0x050810,0.95));
  c.add(sc.add.text(W/2,110,'GAME OVER',{fontFamily:'monospace',fontSize:'52px',color:'#ff4040',fontStyle:'bold'}).setOrigin(0.5));
  goScoreTxt=sc.add.text(W/2,182,'',{fontFamily:'monospace',fontSize:'26px',color:'#e1ff00'}).setOrigin(0.5);
  goLvlTxt  =sc.add.text(W/2,218,'',{fontFamily:'monospace',fontSize:'18px',color:'#4a9eff'}).setOrigin(0.5);
  c.add(goScoreTxt); c.add(goLvlTxt); c.setVisible(false);
}

function buildLvlClear() {
  const c=sc.add.container(0,0).setDepth(20); lvlCtn=c;
  c.add(sc.add.rectangle(W/2,H/2,W,H,0x050810,0.72));
  lvlTxt=sc.add.text(W/2,H/2-20,'',{fontFamily:'monospace',fontSize:'40px',color:'#e1ff00',fontStyle:'bold',align:'center'}).setOrigin(0.5);
  c.add(lvlTxt); c.setVisible(false);
}

function buildNameEntry() {
  const c=sc.add.container(0,0).setDepth(22); nameCtn=c;
  c.add(sc.add.rectangle(W/2,H/2,W,H,0x050810,0.97));
  c.add(sc.add.text(W/2,38,'ENTER YOUR NAME',{fontFamily:'monospace',fontSize:'26px',color:'#e1ff00',fontStyle:'bold'}).setOrigin(0.5));
  nameScoreTxt=sc.add.text(W/2,72,'',{fontFamily:'monospace',fontSize:'16px',color:'#c8d8f0'}).setOrigin(0.5); c.add(nameScoreTxt);
  nameDisplayTxt2=sc.add.text(W/2,114,'___',{fontFamily:'monospace',fontSize:'42px',color:'#ff6ec7',fontStyle:'bold',letterSpacing:14}).setOrigin(0.5); c.add(nameDisplayTxt2);
  for (let row=0;row<NAME_GRID.length;row++) {
    const ri=NAME_GRID[row], rw=ri.length*62;
    for (let col=0;col<ri.length;col++) {
      const val=ri[col], cx=W/2-rw/2+31+col*62, cy=194+row*38;
      const bg=sc.add.rectangle(cx,cy,val.length>1?70:50,30,0x0d1a30,0.95).setStrokeStyle(2,0x1a3560,0.7);
      const lbl=sc.add.text(cx,cy,val,{fontFamily:'monospace',fontSize:val.length>1?'13px':'19px',color:'#c8d8f0',fontStyle:'bold'}).setOrigin(0.5);
      c.add(bg); c.add(lbl); nameGrid.push({bg,lbl,row,col,val});
    }
  }
  c.add(sc.add.text(W/2,H-18,'JOYSTICK MOVE   BUTTON SELECT',{fontFamily:'monospace',fontSize:'11px',color:'#1e3050'}).setOrigin(0.5));
  c.setVisible(false);
}

function buildSaved() {
  const c=sc.add.container(0,0).setDepth(23); savedCtn=c;
  c.add(sc.add.rectangle(W/2,H/2,W,H,0x050810,0.97));
  c.add(sc.add.text(W/2,60,'🏆  SCORE SAVED!',{fontFamily:'monospace',fontSize:'30px',color:'#e1ff00',fontStyle:'bold'}).setOrigin(0.5));
  c.add(sc.add.text(W/2,108,'#    NAME   SCORE    LV',{fontFamily:'monospace',fontSize:'13px',color:'#4a9eff',fontStyle:'bold'}).setOrigin(0.5));
  c.add(sc.add.rectangle(W/2,120,400,1,0x1a3560,0.9));
  savedBodyTxt=sc.add.text(W/2,132,'',{fontFamily:'monospace',fontSize:'13px',color:'#a8b8d0',align:'left',lineSpacing:6}).setOrigin(0.5,0);
  c.add(savedBodyTxt);
  c.add(sc.add.text(W/2,H-24,'PRESS START TO CONTINUE',{fontFamily:'monospace',fontSize:'12px',color:'#1e3050'}).setOrigin(0.5));
  c.setVisible(false);
}

function showNameEntry() {
  phase='nameentry'; nameLetters=[]; nameRow=0; nameCol=0; nameCd=0;
  nameCtn.setVisible(true);
  nameScoreTxt&&nameScoreTxt.setText('SCORE: '+score+'   LEVEL: '+level);
  refreshNameDisplay(); refreshNameGrid();
}

function refreshNameDisplay() {
  const s=nameLetters.join('').padEnd(3,'_').slice(0,3);
  nameDisplayTxt2&&nameDisplayTxt2.setText(s);
}

function refreshNameGrid() {
  for (const obj of nameGrid) {
    const act=obj.row===nameRow&&obj.col===nameCol;
    obj.bg.setFillStyle(act?0xe1ff00:0x0d1a30,act?1:0.95);
    obj.bg.setStrokeStyle(2,act?0xffffff:0x1a3560,act?1:0.7);
    obj.lbl.setColor(act?'#050810':'#c8d8f0');
  }
}

function updateNameEntry(dt) {
  nameCd-=dt;
  if (nameCd<=0) {
    const up=held.P1_U||held.P2_U, dn=held.P1_D||held.P2_D;
    const lt=held.P1_L||held.P2_L, rt=held.P1_R||held.P2_R;
    let mv=false;
    if      (up&&nameRow>0)                            { nameRow--;  mv=true; }
    else if (dn&&nameRow<NAME_GRID.length-1)           { nameRow++;  mv=true; }
    else if (lt&&nameCol>0)                            { nameCol--;  mv=true; }
    else if (rt&&nameCol<NAME_GRID[nameRow].length-1)  { nameCol++;  mv=true; }
    if (mv) { nameCol=Math.min(nameCol,NAME_GRID[nameRow].length-1); nameCd=0.16; refreshNameGrid(); }
  }
  if (cpAny(['P1_1','P2_1','P1_2','P2_2','START1','START2'])) {
    const val=NAME_GRID[nameRow][nameCol];
    if (val==='DEL') { if(nameLetters.length>0)nameLetters.pop(); }
    else if (val==='OK') { doSubmit(); return; }
    else if (nameLetters.length<3) { nameLetters.push(val); if(nameLetters.length===3){doSubmit();return;} }
    refreshNameDisplay();
  }
}

async function doSubmit() {
  const name=(nameLetters.join('')||'AAA').padEnd(3,'A').slice(0,3);
  nameCtn.setVisible(false);
  const updated=await saveScore(name,score,level);
  highScores=updated; refreshMenuScores();
  phase='saved'; savedCtn.setVisible(true);
  if (savedBodyTxt) {
    savedBodyTxt.setText(
      highScores.slice(0,10).map((e,i)=>
        `${String(i+1).padStart(2,'0')}  ${(e.name||'???').padEnd(3,' ')}  ${String(e.score||0).padStart(7,' ')}  LV${String(e.level||1).padStart(2,' ')}`
      ).join('\n')
    );
  }
}

// ── Audio (Web Audio API) ─────────────────────────────────────────────────────
function tone(freq,type,dur,vol=0.28,delay=0) {
  try {
    const ctx=sc.sound.context;
    const osc=ctx.createOscillator(), g=ctx.createGain();
    osc.type=type; osc.frequency.value=freq;
    g.gain.setValueAtTime(vol,ctx.currentTime+delay);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+delay+dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(ctx.currentTime+delay); osc.stop(ctx.currentTime+delay+dur);
  } catch(e) {}
}

function sfxShoot() { tone(920,'square',0.055,0.12); tone(460,'square',0.04,0.06,0.04); }

function sfxPop(size) {
  const f=[0,400,270,185,115][size]||200;
  tone(f,'sine',0.2,0.28); tone(f*1.6,'sine',0.12,0.14,0.07);
}

function sfxDeath() {
  tone(220,'sawtooth',0.25,0.4); tone(140,'sawtooth',0.28,0.35,0.14); tone(85,'sawtooth',0.35,0.3,0.32);
}

// Super Pang-inspired: pun-pun-pun-pun  pun  pun-pun-pun-pun-pun-pun
function sfxGameOver() {
  const ph1=[392,330,262,220];
  ph1.forEach((f,i)=>{ tone(f,'square',0.10,0.30,i*0.14); tone(f*0.5,'triangle',0.10,0.14,i*0.14); });
  const p1=ph1.length*0.14+0.18;
  tone(175,'square',0.22,0.35,p1); tone(87.5,'sawtooth',0.22,0.28,p1);
  const ph2=[220,196,175,165,147,131], p2=p1+0.30;
  ph2.forEach((f,i)=>{ tone(f,'square',0.09,0.28,p2+i*0.09); tone(f*0.5,'sine',0.09,0.12,p2+i*0.09); });
  tone(65,'sawtooth',0.5,0.45,p2+ph2.length*0.09+0.05);
}

// Extra life: bright ascending 1-up arpeggio
function sfxLifeUp() {
  [523,659,784,1047].forEach((f,i)=>tone(f,'sine',0.12,0.30,i*0.09));
  tone(1319,'sine',0.18,0.35,0.36);
}

// Generic item pickup: clean two-tone chime
function sfxItemPickup() {
  tone(880,'sine',0.10,0.22); tone(1108,'sine',0.10,0.22,0.09);
}

// Shield break: descending glass-like crash
function sfxShieldBreak() {
  [1400,1050,700,400,200].forEach((f,i)=>tone(f,'sawtooth',0.06,0.18,i*0.05));
  tone(180,'triangle',0.15,0.30,0.28);
}

// Dynamite: big explosion boom + rumble
function sfxDynamite() {
  tone(80,'sawtooth',0.50,0.60);
  tone(120,'sawtooth',0.35,0.45,0.05);
  tone(55,'sawtooth',0.60,0.50,0.12);
  tone(240,'square',0.15,0.25,0.02);
  tone(320,'square',0.10,0.20,0.06);
  tone(45,'sawtooth',0.40,0.55,0.25);
}

function sfxLevelClear() {
  [440,554,659,880,1108].forEach((f,i)=>tone(f,'sine',0.28,0.32,i*0.1));
}

// ── Background Music ──────────────────────────────────────────────────────────
// Catchy 8-bit mariachi-inspired loop in G pentatonic
const TUNE=[
  [392,0.15],[440,0.12],[494,0.12],[587,0.18],[659,0.12],[587,0.12],[494,0.12],[392,0.24],[0,0.08],
  [440,0.12],[494,0.12],[587,0.15],[659,0.18],[784,0.12],[659,0.12],[587,0.12],[440,0.24],[0,0.08],
  [294,0.15],[330,0.12],[392,0.12],[440,0.18],[392,0.12],[330,0.12],[294,0.30],[0,0.10],
  [392,0.12],[440,0.12],[494,0.15],[587,0.12],[659,0.18],[784,0.12],[659,0.12],[587,0.12],[494,0.12],[440,0.12],[392,0.50],[0,0.18],
];
const BASS=[
  [196,0.50],[0,0.06],[196,0.50],[0,0.06],[196,0.50],[0,0.06],[196,0.50],[0,0.06],
  [220,0.50],[0,0.06],[220,0.50],[0,0.06],[196,0.50],[0,0.06],[196,0.50],[0,0.06],
  [147,0.50],[0,0.06],[147,0.50],[0,0.06],[196,0.50],[0,0.06],[196,0.50],[0,0.06],
  [196,0.50],[0,0.06],[196,0.50],[0,0.06],[196,0.50],[0,0.06],[196,1.00],[0,0.18],
];
let musicPlaying=false, musicTm=null;

function playNotes(notes,type,vol,startT) {
  try {
    const ctx=sc.sound.context; let t=startT;
    for(const[f,d] of notes){
      if(f>0){
        const o=ctx.createOscillator(),g=ctx.createGain();
        o.type=type;o.frequency.value=f;
        g.gain.setValueAtTime(vol,t);
        g.gain.exponentialRampToValueAtTime(0.001,t+d*0.82);
        o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+d);
      }
      t+=d;
    }
    return t-startT;
  }catch(e){return 0;}
}

function startMusic() {
  if (musicPlaying) return;
  musicPlaying=true;
  function loop(){
    if(!musicPlaying)return;
    try{
      const ctx=sc.sound.context,t=ctx.currentTime;
      const dur=playNotes(TUNE,'square',0.055,t);
      playNotes(BASS,'triangle',0.045,t);
      musicTm=setTimeout(loop,(dur-0.15)*1000);
    }catch(e){}
  }
  loop();
}

function stopMusic(){musicPlaying=false;clearTimeout(musicTm);}

// ── Level Backgrounds (Mexican Cities) ───────────────────────────────────────
const CITIES=['CDMX','Guadalajara','Monterrey','Cancún','Mulegé','Veracruz'];

function drawLevelBg(lvl) {
  gLvlBg.clear();
  const scenes=[bgCDMX,bgGuadalajara,bgMonterrey,bgCancun,bgMulege,bgVeracruz];
  scenes[(lvl-1)%scenes.length]();
}

function bgSky(t,b){gLvlBg.fillGradientStyle(t,t,b,b,1);gLvlBg.fillRect(0,0,W,FLOOR_Y);}

function bgCDMX(){
  bgSky(0x5577aa,0x8899bb);
  // Distant mountains (Popocatepetl silhouette)
  gLvlBg.fillStyle(0x667788,0.7);
  gLvlBg.fillTriangle(120,FLOOR_Y,310,260,500,FLOOR_Y);
  gLvlBg.fillTriangle(400,FLOOR_Y,590,230,780,FLOOR_Y);
  // Palacio Nacional base
  gLvlBg.fillStyle(0x445566,0.9);
  gLvlBg.fillRect(60,380,680,FLOOR_Y-380);
  gLvlBg.fillStyle(0x3a4f60,0.9);
  gLvlBg.fillRect(60,360,680,24);
  // Center flag
  gLvlBg.fillStyle(0x006847,1);gLvlBg.fillRect(370,300,20,62);
  gLvlBg.fillStyle(0xce1126,1);gLvlBg.fillRect(390,300,20,62);
  gLvlBg.fillStyle(0xffffff,1);gLvlBg.fillRect(350,300,20,62);
  // Cathedral spires
  gLvlBg.fillStyle(0x3a4f60,1);
  gLvlBg.fillTriangle(200,200,220,360,240,360);
  gLvlBg.fillTriangle(540,215,560,360,580,360);
  gLvlBg.fillRect(200,360,80,100);gLvlBg.fillRect(540,360,80,100);
  // City name tag
  gLvlBg.fillStyle(0x000000,0.35);gLvlBg.fillRect(WALL_L+8,TOP_Y+8,130,22);
}

function bgGuadalajara(){
  bgSky(0xff8844,0xffcc66); // warm sunset
  // Ground
  gLvlBg.fillStyle(0x8b5e3c,1);gLvlBg.fillRect(0,440,W,FLOOR_Y-440);
  // Cathedral (2 ornate spires + body)
  gLvlBg.fillStyle(0x664422,0.9);
  gLvlBg.fillRect(260,300,280,160);
  gLvlBg.fillStyle(0x5a3a1e,1);
  gLvlBg.fillRect(280,240,60,62);gLvlBg.fillRect(460,240,60,62);
  gLvlBg.fillTriangle(270,200,310,250,350,250);
  gLvlBg.fillTriangle(450,215,490,250,530,250);
  // Agave plants
  gLvlBg.fillStyle(0x2d6e2d,1);
  [[100,440],[620,440],[680,450],[80,450]].forEach(([x,y])=>{
    for(let a=-0.8;a<=0.8;a+=0.4){gLvlBg.fillTriangle(x,y,x+Math.sin(a)*50,y-50+Math.cos(a)*10,x+Math.sin(a)*56,y-46+Math.cos(a)*10);}
  });
}

function bgMonterrey(){
  bgSky(0x4488cc,0x88bbee);
  // Cerro de la Silla — saddle mountain silhouette
  gLvlBg.fillStyle(0x556677,0.85);
  gLvlBg.fillTriangle(50,FLOOR_Y,250,190,450,FLOOR_Y);
  gLvlBg.fillTriangle(350,FLOOR_Y,550,220,750,FLOOR_Y);
  // Saddle dip
  gLvlBg.fillStyle(0x4488cc,1);
  gLvlBg.fillTriangle(340,FLOOR_Y,450,280,560,FLOOR_Y);
  // City skyline (FEMSA, Alfa, modern)
  gLvlBg.fillStyle(0x334455,0.9);
  [[140,340,40,120],[200,310,50,150],[270,290,40,170],[480,300,50,160],[550,320,40,140],[630,350,35,110]]
    .forEach(([x,y,w,h])=>gLvlBg.fillRect(x,y,w,h));
  // MACROPLAZA hint — flat plaza
  gLvlBg.fillStyle(0x998877,0.7);
  gLvlBg.fillRect(300,450,200,FLOOR_Y-450);
}

function bgCancun(){
  bgSky(0x11aaee,0x44ddff); // caribbean bright
  // Sea
  gLvlBg.fillStyle(0x0099cc,0.9);gLvlBg.fillRect(0,280,W,180);
  gLvlBg.fillStyle(0x00bbdd,0.6);gLvlBg.fillRect(0,280,W,40);
  // Waves
  gLvlBg.lineStyle(2,0xaaeeff,0.5);
  for(let x=60;x<WALL_R;x+=60){gLvlBg.beginPath();gLvlBg.arc(x,300,14,Math.PI,0,false);gLvlBg.strokePath();}
  // Sand beach
  gLvlBg.fillStyle(0xf5e4a0,1);gLvlBg.fillRect(0,455,W,FLOOR_Y-455);
  // Palm trees
  [[130,455],[650,455],[340,460],[560,455]].forEach(([tx,ty])=>{
    gLvlBg.fillStyle(0x7a5c2e,1);gLvlBg.fillRect(tx-5,ty-120,10,120);
    // Fronds
    gLvlBg.fillStyle(0x2d8a2d,0.9);
    for(let a=-1.0;a<=1.0;a+=0.4){gLvlBg.fillTriangle(tx,ty-120,tx+Math.sin(a)*70,ty-120+Math.cos(a)*50,tx+Math.sin(a)*80,ty-115+Math.cos(a)*50);}
  });
}

function bgMulege(){
  bgSky(0x5599cc,0xddcc99); // desert heat haze
  // Distant Gulf of California
  gLvlBg.fillStyle(0x4499aa,0.7);gLvlBg.fillRect(0,200,W,100);
  // Desert floor
  gLvlBg.fillStyle(0xc9943a,1);gLvlBg.fillRect(0,380,W,FLOOR_Y-380);
  gLvlBg.fillStyle(0xb07d2a,0.6);gLvlBg.fillRect(0,430,W,FLOOR_Y-430);
  // Cardon cacti
  [[120,380],[240,370],[500,375],[650,380],[720,370]].forEach(([cx,cy])=>{
    const h=cy-200+Math.random()*20;
    gLvlBg.fillStyle(0x3a6e38,1);
    gLvlBg.fillRect(cx-9,h,18,cy-h); // trunk
    gLvlBg.fillRect(cx-22,h+40,14,50); // left arm
    gLvlBg.fillRect(cx-22,h+15,14,28); // left arm base
    gLvlBg.fillRect(cx+8,h+50,14,50);  // right arm
    gLvlBg.fillRect(cx+8,h+22,14,32);  // right arm base
  });
  // Rocks/boulders
  gLvlBg.fillStyle(0x887766,0.8);
  [[90,390,30],[400,410,22],[600,395,28]].forEach(([x,y,r])=>gLvlBg.fillCircle(x,y,r));
}

function bgVeracruz(){
  bgSky(0xff6633,0xffaa55); // sunset
  // Gulf of Mexico
  gLvlBg.fillStyle(0x226688,0.9);gLvlBg.fillRect(0,220,W,220);
  gLvlBg.fillStyle(0x3388aa,0.5);gLvlBg.fillRect(0,220,W,50);
  // Waves
  gLvlBg.lineStyle(2,0x88ccdd,0.4);
  for(let x=60;x<WALL_R;x+=80){gLvlBg.beginPath();gLvlBg.arc(x,260,18,Math.PI,0,false);gLvlBg.strokePath();}
  // San Juan de Ulua fort silhouette
  gLvlBg.fillStyle(0x334422,0.9);
  gLvlBg.fillRect(480,170,240,70); // fort body
  gLvlBg.fillRect(480,150,36,24); // battlement L
  gLvlBg.fillRect(532,150,36,24);
  gLvlBg.fillRect(584,150,36,24);
  gLvlBg.fillRect(636,150,36,24);
  gLvlBg.fillRect(688,150,32,24);
  // Round tower
  gLvlBg.fillCircle(480,185,44);
  // Beach
  gLvlBg.fillStyle(0xe8c87a,1);gLvlBg.fillRect(0,430,W,FLOOR_Y-430);
  // Seagull hints
  gLvlBg.lineStyle(2,0xffffff,0.6);
  [[200,180],[300,160],[420,190]].forEach(([x,y])=>{
    gLvlBg.beginPath();gLvlBg.moveTo(x-12,y);gLvlBg.lineTo(x,y-8);gLvlBg.lineTo(x+12,y);gLvlBg.strokePath();
  });
}

// ── Storage ───────────────────────────────────────────────────────────────────
function getStorage() {
  if (window.platanusArcadeStorage) return window.platanusArcadeStorage;
  return {
    async get(k) {
      try { const r=localStorage.getItem(k); return r?{found:true,value:JSON.parse(r)}:{found:false,value:null}; }
      catch { return {found:false,value:null}; }
    },
    async set(k,v) { try { localStorage.setItem(k,JSON.stringify(v)); } catch {} },
  };
}

async function loadScores() {
  const r=await getStorage().get('super-platanus-v1');
  return r.found&&Array.isArray(r.value)?r.value:[];
}

async function saveScore(name,sc_score,sc_level) {
  let s=await loadScores();
  s.push({name,score:sc_score,level:sc_level});
  s.sort((a,b)=>b.score-a.score);
  s=s.slice(0,12);
  await getStorage().set('super-platanus-v1',s);
  return s;
}
