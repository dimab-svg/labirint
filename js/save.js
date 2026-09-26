'use strict';

// ============================================================
// 14а. ПАУЗА, СОХРАНЕНИЕ, ЗАГРУЗКА
// ============================================================
const pauseOverlay=document.getElementById('pauseOverlay');
const pauseInfo=document.getElementById('pauseInfo');
const SAVE_KEY='labirint_v14_save';
let paused=false;

function serializeMonster(m){
  return {
    id:m.cfg.id, hp:m.hp, maxHp:m.maxHp,
    starDamage:m.starDamage!==undefined?m.starDamage:m.cfg.starDamage,
    room:{x:m.room.x,y:m.room.y}, home:{x:m.home.x,y:m.home.y},
    x:m.x, y:m.y, facing:m.facing,
    state:m.state, reason:m.reason||'',
    targetRoom:m.targetRoom?{x:m.targetRoom.x,y:m.targetRoom.y}:null,
    patrolRoom:m.patrolRoom?{x:m.patrolRoom.x,y:m.patrolRoom.y}:null,
    alert:m.alert, stun:m.stun, sated:m.sated,
    wanderWait:m.wanderWait, blockedWait:m.blockedWait,
  };
}

function makeSave(){
  if (!MAP) return null;
  return JSON.stringify({
    v:1,
    diff:diffSel.value, seed:WORLD_SEED,
    player:{x:player.x,y:player.y},
    visited:[...visited], seen:[...seen],
    inv:{stars:inv.stars, coins:inv.coins, grenades:inv.grenades, teleports:inv.teleports,
         apples:inv.apples, keys:inv.keys.slice()},
    caughtCount, hintExit, hintPath,
    gameWon, gameOver, gameOverText,
    monsters:monsters.map(serializeMonster),
    shopSold:{hintExit,hintPath},
    savedAt:new Date().toISOString(),
  });
}

function resumeFromData(d){
  if (!d||!DIFFICULTY[d.diff]) return false;
  const cfg=DIFFICULTY[d.diff];
  WORLD_SEED=d.seed;
  MAP=generateMaze(cfg,WORLD_SEED);
  patternCache.clear(); doorAnims.clear();
  grenades=[]; explosions=[]; teleFx=null; zaps=[];
  move=null; unlocking=null; queuedMove=null; heldDirs.length=0;
  visual.offsetX=0; visual.offsetY=0;
  visited=new Set(d.visited||[]);
  seen=new Set(d.seen||[]);
  const iv=d.inv||{};
  inv.stars=iv.stars!==undefined?iv.stars:START_STARS;
  inv.coins=iv.coins||0; inv.grenades=iv.grenades||0;
  inv.teleports=iv.teleports||0; inv.apples=iv.apples||0;
  inv.keys=(iv.keys&&iv.keys.slice())||[false,false,false];
  caughtCount=d.caughtCount||0;
  hintExit=!!d.hintExit; hintPath=!!d.hintPath;
  gameWon=!!d.gameWon; gameOver=!!d.gameOver;
  gameOverText=d.gameOverText||'ВАС СЪЕЛИ';
  caughtEl.textContent=caughtCount;

  const p=d.player||{x:MAP.start.x,y:MAP.start.y};
  player.x=clamp(p.x,0,MAP.w-1); player.y=clamp(p.y,0,MAP.h-1);
  camX=roomCX(player.x); camY=roomCY(player.y);

  monsters=[];
  for (const md of d.monsters||[]){
    const base=MONSTER_TYPES[md.id]; if (!base) continue;
    const m={
      cfg:base, maxHp:md.maxHp||base.maxHp,
      starDamage:md.starDamage!==undefined?md.starDamage:base.starDamage,
      hp:Math.max(1,md.hp||1), dead:false,
      home:{x:md.home.x,y:md.home.y}, room:{x:md.room.x,y:md.room.y},
      x:md.x, y:md.y, facing:md.facing||0,
      state:md.state||'idle', reason:md.reason||'',
      targetRoom:md.targetRoom?{x:md.targetRoom.x,y:md.targetRoom.y}:null,
      cross:null, ignoreDoorKey:null,
      wanderTarget:null, wanderWait:md.wanderWait||0,
      patrolRoom:md.patrolRoom?{x:md.patrolRoom.x,y:md.patrolRoom.y}:null,
      chkT:0, alert:md.alert||0, alertMark:'!',
      stun:md.stun||0, sated:md.sated||0,
      moving:0, blockedWait:0,
      legPhase:0,          // фаза шага — начинаем с нуля после загрузки
    };
    monsters.push(m);
  }

  diffSel.value=d.diff;
  seedOut.textContent=String(WORLD_SEED);
  updateHud();
  enterRoom(player.x,player.y,true);
  mapDirty=true;
  return true;
}

function doSaveGame(){
  try{
    const t=makeSave();
    if (!t) return;
    localStorage.setItem(SAVE_KEY,t);
    const dt=new Date();
    flashMessage('Сохранено ('+dt.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})+'): сид '+WORLD_SEED);
  }catch(err){ flashMessage('Не удалось сохранить: '+err.message); }
}

function doLoadGame(fromPause){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if (!raw){ flashMessage('Нет сохранённой игры'); return; }
    const d=JSON.parse(raw);
    if (!resumeFromData(d)){ flashMessage('Сохранение не подходит к этой версии'); return; }
    if (fromPause) closePause();
    flashMessage('Игра загружена (сид '+WORLD_SEED+')');
  }catch(err){ flashMessage('Ошибка загрузки: '+err.message); }
}

function refreshPauseInfo(){
  pauseInfo.innerHTML =
    'Сложность: <b>'+MAP.cfg.label+'</b> · сид <b>'+WORLD_SEED+'</b><br>'+
    'Комната '+player.x+','+player.y+' · монстров '+monsters.length+
    ' · пройдено '+visited.size+' из '+MAP.w*MAP.h;
}
function openPause(){
  if (!MAP) return;
  paused=true;
  heldDirs.length=0; queuedMove=null;   // не «идти» после паузы от зажатой клавиши
  refreshPauseInfo();
  pauseOverlay.classList.add('show');
}
function closePause(){
  paused=false;
  pauseOverlay.classList.remove('show');
  lastTime=performance.now();   // чтобы при возобновлении не было скачка времени
}
function togglePause(){
  if (paused) closePause(); else openPause();
}

document.getElementById('pauseResume').onclick=()=>closePause();
document.getElementById('pauseSave').onclick=()=>{ doSaveGame(); refreshPauseInfo(); };
document.getElementById('pauseQuit').onclick=()=>{
  showModal('Выйти без сохранения?',
    'Текущая партия (сид '+WORLD_SEED+') будет потеряна, если вы не сохранили её заранее. '+
    'Сгенерировать новый лабиринт?',
    ()=>{ closePause(); newGame(diffSel.value); }, false);
};
document.getElementById('loadBtn').onclick=()=>doLoadGame(false);

// ============================================================
// 14б. ВСТАВКА СИДА
// ============================================================
const seedIn=document.getElementById('seedIn');
const seedApply=document.getElementById('applySeed');
function applyPastedSeed(){
  const txt=(seedIn.value||'').trim();
  if (!txt){ flashMessage('Пусто — вставьте сид'); return; }
  const n=parseInt(txt.replace(/[^0-9]/g,''),10);
  if (isNaN(n)||String(n).length<1){ flashMessage('Не похоже на сид (число)'); return; }
  newGame(diffSel.value,n);
  seedIn.value='';
  flashMessage('Сгенерирован лабиринт по сиду '+n);
}
seedApply.onclick=()=>applyPastedSeed();
seedIn.addEventListener('keydown',(e)=>{
  if (e.key==='Enter'){ e.preventDefault(); applyPastedSeed(); }
});
