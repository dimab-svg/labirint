'use strict';

// 16. UI И ВВОД
// ============================================================
const diffSel=document.getElementById('diffSel');
const seedOut=document.getElementById('seedOut');

function newGame(diffKey,seed){
  const cfg=DIFFICULTY[diffKey];
  if (diffSel && diffSel.value!==diffKey) diffSel.value=diffKey;   // синхронизировать выбор
  WORLD_SEED=(seed===undefined)?(Math.random()*0x7fffffff)|0:seed;
  MAP=generateMaze(cfg,WORLD_SEED);

  patternCache.clear(); doorAnims.clear();
  visited.clear(); seen.clear();
  grenades=[]; explosions=[]; teleFx=null; zaps=[];
  queuedMove=null; heldDirs.length=0;
  gameWon=false; gameOver=false; gameOverText='ВАС СЪЕЛИ'; move=null; unlocking=null;
  visual.offsetX=0; visual.offsetY=0;
  hintExit=false; hintPath=false;
  caughtCount=0; caughtEl.textContent='0';
  inv.stars=START_STARS; inv.coins=0; inv.grenades=0; inv.teleports=0; inv.apples=0;
  inv.keys=[false,false,false];

  player.x=MAP.start.x; player.y=MAP.start.y;
  camX=roomCX(player.x); camY=roomCY(player.y);

  placeMonsters(mulberry32(WORLD_SEED^0x9e3779b9));
  updateHud();
  enterRoom(player.x,player.y);

  seedOut.textContent=String(WORLD_SEED);
  mapDirty=true;
  flashMessage(`${MAP.w}×${MAP.h} · монстров ${monsters.length} · замков ${MAP.locks.size} · путь ${MAP.pathLen}`);
}

function onWin(){ if (!gameWon){ gameWon=true; flashMessage('Вы нашли выход!'); } }

const canvasPoint=e=>{
  const rect=canvas.getBoundingClientRect();
  return {
    x:(e.clientX-rect.left)*(canvas.width/rect.width),
    y:(e.clientY-rect.top)*(canvas.height/rect.height),
  };
};

canvas.addEventListener('click',(e)=>{
  const {x:mx,y:my}=canvasPoint(e);
  // в магазине клик по витрине — покупка, а не ходьба
  if (inShop()){
    const si=shopSlotAt(mx,my);
    if (si>=0){ buyShopSlot(si); return; }
  }
  const dx=Math.round((mx-CANVAS_SIZE/2)/ROOM_SIZE);
  const dy=Math.round((my-CANVAS_SIZE/2)/ROOM_SIZE);
  if (Math.abs(dx)+Math.abs(dy)!==1) return;
  const dir=DIRS.find(d=>DIR[d].dx===dx&&DIR[d].dy===dy);
  if (dir) tryMove(dir);
});

canvas.addEventListener('mousemove',(e)=>{
  const {x:mx,y:my}=canvasPoint(e);
  if (!inShop()){ shopHover=-1; canvas.style.cursor=''; return; }
  const si=shopSlotAt(mx,my);
  shopHover=si;
  const g=si>=0?shopGoods()[si]:null;
  canvas.style.cursor=(si>=0&&!g.sold)?'pointer':'default';
});
canvas.addEventListener('mouseleave',()=>{ shopHover=-1; canvas.style.cursor=''; });

chipGren.onclick=()=>{ if (inv.grenades>0) dropGrenade(); };
chipTele.onclick=()=>{ useTeleport(); };
chipApple.onclick=()=>{ if (inv.apples>0) dropApple(); };

const dbgBtn=document.getElementById('dbgBtn');
const solBtn=document.getElementById('solBtn');
const mLocal=document.getElementById('modeLocal');
const mFull=document.getElementById('modeFull');

function setMapMode(mode){
  mapMode=mode; mapDirty=true;
  mLocal.classList.toggle('on',mode==='local');
  mFull.classList.toggle('on',mode==='full');
}
mLocal.onclick=()=>{setMapMode('local');mLocal.blur();};
mFull.onclick =()=>{setMapMode('full'); mFull.blur();};
dbgBtn.onclick=()=>{ DEBUG=!DEBUG; dbgBtn.classList.toggle('on',DEBUG); dbgBtn.blur(); };
solBtn.onclick=()=>{
  SHOW_SOLUTION=!SHOW_SOLUTION;
  solBtn.classList.toggle('on',SHOW_SOLUTION);
  mapDirty=true; solBtn.blur();
};
document.getElementById('newBtn').onclick=()=>newGame(diffSel.value);
document.getElementById('copySeed').onclick=()=>{
  navigator.clipboard?.writeText(String(WORLD_SEED));
  flashMessage('Сид скопирован');
};

// --- настройки ввода ---
const bufSel=document.getElementById('bufSel');
const holdBtn=document.getElementById('holdBtn');
bufSel.value=String(TUNE.inputBuffer);
bufSel.onchange=()=>{
  TUNE.inputBuffer=parseFloat(bufSel.value);
  flashMessage(TUNE.inputBuffer>0
    ? `Буфер хода: ${TUNE.inputBuffer>=99?'весь ход':Math.round(TUNE.inputBuffer*1000)+' мс'}`
    : 'Буфер хода выключен');
  bufSel.blur();
};
holdBtn.onclick=()=>{
  TUNE.holdToMove=!TUNE.holdToMove;
  holdBtn.textContent='Удержание: '+(TUNE.holdToMove?'вкл':'выкл');
  holdBtn.classList.toggle('on',TUNE.holdToMove);
  flashMessage(TUNE.holdToMove?'Держите клавишу — персонаж идёт непрерывно':'Удержание клавиши отключено');
  holdBtn.blur();
};

// --- чит-панель для тестов ---
{
  const cp=document.getElementById('cheatPanel');
  if (!TUNE.cheats) cp.style.display='none';
  document.getElementById('cheatAll').onclick=(e)=>{
    inv.stars+=10; inv.coins+=500; inv.grenades+=10; inv.teleports+=5; inv.apples+=10;
    inv.keys=[true,true,true];
    updateHud(); flashMessage('ЧИТ: +10★ +500₥ +10✹ +5⌖ +10◉ + все ключи');
    e.target.blur();
  };
  document.getElementById('cheatKeys').onclick=(e)=>{
    inv.keys=[true,true,true]; updateHud();
    flashMessage('ЧИТ: все ключи'); e.target.blur();
  };
  document.getElementById('cheatHints').onclick=(e)=>{
    hintExit=true; hintPath=true; mapDirty=true;
    flashMessage(`ЧИТ: подсказки куплены, выход в ${MAP.exit.x},${MAP.exit.y}`);
    e.target.blur();
  };
  document.getElementById('cheatToExit').onclick=(e)=>{
    if (gameWon||gameOver) return;
    const c=MAP.solution[Math.max(0,MAP.solution.length-2)];
    move=null; unlocking=null; queuedMove=null;
    visual.offsetX=0; visual.offsetY=0;
    player.x=c.x; player.y=c.y;
    camX=roomCX(c.x); camY=roomCY(c.y);
    enterRoom(c.x,c.y);
    flashMessage('ЧИТ: телепорт к предпоследней комнате пути');
    e.target.blur();
  };
  document.getElementById('cheatKill').onclick=(e)=>{
    let n=0;
    for (let i=monsters.length-1;i>=0;i--){
      const m=monsters[i];
      if (Math.max(Math.abs(m.room.x-player.x),Math.abs(m.room.y-player.y))>2) continue;
      if (m.cross) releaseDoor(m.cross.key,m);
      monsters.splice(i,1); n++;
    }
    flashMessage(`ЧИТ: убрано монстров: ${n}`);
    e.target.blur();
  };
  document.getElementById('cheatHunter').onclick=(e)=>{
    // спавн Охотника в 2..3 комнатах от игрока (по пути)
    const W=MAP.w, kk=(x,y)=>y*W+x;
    const vis=new Set([kk(player.x,player.y)]);
    const q=[{x:player.x,y:player.y,d:0}], opts=[];
    for (let h=0;h<q.length;h++){
      const c=q[h];
      if (c.d>=2&&c.d<=3){
        const k=`${c.x},${c.y}`;
        if (!MAP.shops.has(k)&&!MAP.traps.has(k)) opts.push(c);
      }
      if (c.d>=3) continue;
      for (const d of DIRS){
        const t=sideType(c.x,c.y,d);
        if (t==='wall'||t==='locked') continue;
        const nx=c.x+DIR[d].dx, ny=c.y+DIR[d].dy;
        if (!inBounds(nx,ny)) continue;
        const k=kk(nx,ny);
        if (vis.has(k)) continue;
        vis.add(k); q.push({x:nx,y:ny,d:c.d+1});
      }
    }
    if (opts.length){
      const c=opts[Math.floor(Math.random()*opts.length)];
      spawnMonster('monster2',c.x,c.y);
      flashMessage('ЧИТ: Охотник появился неподалёку');
    } else flashMessage('ЧИТ: рядом нет подходящей комнаты');
    e.target.blur();
  };
  document.getElementById('cheatTrap').onclick=(e)=>{
    // телепорт в ближайшую аномалию — проверить, что вам она не вредит
    if (gameOver||gameWon) return;
    const W=MAP.w, kk=(x,y)=>y*W+x;
    const vis=new Set([kk(player.x,player.y)]);
    const q=[{x:player.x,y:player.y,d:0}]; let found=null;
    for (let h=0;h<q.length&&!found;h++){
      const c=q[h];
      if (c.d>0&&MAP.traps.has(`${c.x},${c.y}`)){ found=c; break; }
      if (c.d>=40) continue;
      for (const d of DIRS){
        const t=sideType(c.x,c.y,d);
        if (t==='wall') continue;
        if (t==='locked'&&!inv.keys[MAP.locks.get(doorKey(c.x,c.y,d))]) continue;
        const nx=c.x+DIR[d].dx, ny=c.y+DIR[d].dy;
        if (!inBounds(nx,ny)) continue;
        const k=kk(nx,ny);
        if (vis.has(k)) continue;
        vis.add(k); q.push({x:nx,y:ny,d:c.d+1});
      }
    }
    if (found){
      move=null; unlocking=null; queuedMove=null;
      visual.offsetX=0; visual.offsetY=0;
      player.x=found.x; player.y=found.y;
      camX=roomCX(player.x); camY=roomCY(player.y);
      teleFx={t:0};
      enterRoom(found.x,found.y);
      flashMessage('ЧИТ: вы в аномалии (вам безопасно)');
    } else flashMessage('ЧИТ: аномалии не достичь');
    e.target.blur();
  };
}

function inputFocused(){
  const t=e=>e&&(e.tagName==='INPUT'||e.tagName==='SELECT'||e.tagName==='TEXTAREA'||e.isContentEditable);
  return t(document.activeElement);
}
document.addEventListener('keydown',(e)=>{
  if (inputFocused()) return;             // не мешать вводу в полях (сид и пр.)
  if (e.code==='KeyP'&&!e.repeat){ e.preventDefault(); togglePause(); return; }
  if (paused) return;                     // на паузе клавиши игрока глухи
  if (modal.classList.contains('show')) return;
  if (e.code==='F2'&&!e.repeat){ e.preventDefault(); dbgBtn.click(); return; }
  if (e.code==='KeyM'&&!e.repeat){ e.preventDefault(); setMapMode(mapMode==='local'?'full':'local'); return; }
  if (e.code==='KeyL'&&!e.repeat){ e.preventDefault(); cycleLight(); return; }
  if (e.code==='KeyG'&&!e.repeat){ e.preventDefault(); dropGrenade(); return; }
  if (e.code==='KeyT'&&!e.repeat){ e.preventDefault(); useTeleport(); return; }
  if (e.code===TUNE.appleKey&&!e.repeat){ e.preventDefault(); dropApple(); return; }
  // покупка на витрине клавишами 1..5 (только находясь в магазине)
  if (inShop()&&/^Digit[1-6]$/.test(e.code)&&!e.repeat){
    e.preventDefault();
    buyShopSlot(parseInt(e.code.slice(5),10)-1);
    return;
  }
  let dir=null;
  if (e.key==='ArrowUp'||e.code==='KeyW') dir='N';
  else if (e.key==='ArrowDown'||e.code==='KeyS') dir='S';
  else if (e.key==='ArrowLeft'||e.code==='KeyA') dir='W';
  else if (e.key==='ArrowRight'||e.code==='KeyD') dir='E';
  if (!dir) return;
  e.preventDefault();
  if (e.repeat) return;                       // автоповтор ОС игнорируем
  if (!heldDirs.includes(dir)) heldDirs.push(dir);
  tryMove(dir);
});

document.addEventListener('keyup',(e)=>{
  let dir=null;
  if (e.key==='ArrowUp'||e.code==='KeyW') dir='N';
  else if (e.key==='ArrowDown'||e.code==='KeyS') dir='S';
  else if (e.key==='ArrowLeft'||e.code==='KeyA') dir='W';
  else if (e.key==='ArrowRight'||e.code==='KeyD') dir='E';
  if (!dir) return;
  const i=heldDirs.indexOf(dir);
  if (i>=0) heldDirs.splice(i,1);
});
window.addEventListener('blur',()=>{ heldDirs.length=0; queuedMove=null; });

let messageTimer=null;
function flashMessage(text){
  msgEl.textContent=' · '+text;
  clearTimeout(messageTimer);
  messageTimer=setTimeout(()=>{msgEl.textContent='';},2400);
}

// ============================================================
// 17. ЦИКЛ
// ============================================================
newGame('normal');

let lastTime=performance.now();
function loop(now){
  const dt=Math.min((now-lastTime)/1000,0.05);
  lastTime=now;
  if (paused){ requestAnimationFrame(loop); return; }   // ПАУЗА: мир замер

  updateUnlock(dt);
  updatePlayer(dt);
  camX=roomCX(player.x)+visual.offsetX;
  camY=roomCY(player.y)+visual.offsetY;

  for (const m of monsters) updateMonster(m,dt);
  purgeDead();
  resolveOverlaps();
  updateDoors(dt);
  updateGrenades(dt);

  render(now/1000);

  mapTimer+=dt;
  if (mapDirty||mapTimer>0.1){ drawMap(); mapDirty=false; mapTimer=0; }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
