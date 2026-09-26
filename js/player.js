'use strict';

// 8. ИГРОК
// ============================================================
const player={x:0,y:0};
const visual={offsetX:0,offsetY:0};
let move=null;
let unlocking=null;   // {key,color,dir,t}

function markSeen(rx,ry){
  for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++){
    const nx=rx+dx, ny=ry+dy;
    if (inBounds(nx,ny)) seen.add(`${nx},${ny}`);
  }
}

function pickUp(rx,ry){
  const k=`${rx},${ry}`;
  const it=MAP.items.get(k);
  if (!it) return;
  // своё оставленное яблоко игрок не подбирает и не уничтожает: оно лежит,
  // пока его не съест монстр
  if (it.type==='apple'&&it.dropped){ return; }
  MAP.items.delete(k);
  if (it.type==='star'){
    inv.stars++; flashMessage('Звезда защиты +1');
  } else if (it.type==='coin'){
    inv.coins+=it.value; flashMessage(`Деньги +${it.value}`);
  } else if (it.type==='grenade'){
    inv.grenades++; flashMessage('Граната +1');
    maybeGrenadeInfo();
  } else if (it.type==='apple'){
    inv.apples++;
    flashMessage('Яблоко +1 (E — оставить в комнате как приманку)');
  } else if (it.type==='key'){
    inv.keys[it.color]=true;
    flashMessage(`Найден ${KEY_DEFS[it.color].name} ключ`);
  }
  updateHud();
}

function enterRoom(rx,ry,noPick){
  visited.add(`${rx},${ry}`);
  markSeen(rx,ry);
  mapDirty=true;
  posEl.textContent=`${rx},${ry}`;
  zoneEl.textContent=MAP.cfg.zoneNames[zoneAt(rx,ry)];
  exploredEl.textContent=visited.size;
  if (!noPick) pickUp(rx,ry);   // при загрузке предметы не подбираем повторно
  refreshShop();
  if (rx===MAP.exit.x && ry===MAP.exit.y) onWin();
}

// ============================================================
// 8а. ВВОД ДВИЖЕНИЯ: БУФЕР НАЖАТИЙ
//   Нажатие во время хода не пропадает, а запоминается и
//   срабатывает сразу по завершении хода — если с момента
//   нажатия прошло не больше TUNE.inputBuffer секунд.
//   (защита от «протухших» нажатий и двойных ходов: хранится
//   только ПОСЛЕДНЕЕ нажатие, и только свежее)
// ============================================================
let queuedMove=null;          // {dir, at}
const heldDirs=[];            // зажатые клавиши направления (для holdToMove)

function tryMove(dir){
  if (gameWon||gameOver) return;
  if (move||unlocking){
    if (TUNE.inputBuffer>0) queuedMove={dir, at:performance.now()};
    return;
  }
  startMove(dir);
}

function consumeQueued(){
  if (gameWon||gameOver){ queuedMove=null; return; }
  if (queuedMove){
    const age=(performance.now()-queuedMove.at)/1000;
    const dir=queuedMove.dir;
    queuedMove=null;
    if (age<=TUNE.inputBuffer){ startMove(dir); return; }
  }
  if (TUNE.holdToMove && heldDirs.length){
    startMove(heldDirs[heldDirs.length-1]);
  }
}

function startMove(dir){
  if (move||unlocking||gameWon||gameOver) return;
  facing=dir;                     // фигурка разворачивается по ходу движения
  const t=sideType(player.x,player.y,dir);
  if (t==='wall'){ flashMessage('Там стена'); return; }

  const key=doorKey(player.x,player.y,dir);

  if (t==='locked'){
    const lc=MAP.locks.get(key);
    if (lc===undefined){ flashMessage('Заперто наглухо'); return; }
    if (!inv.keys[lc]){
      flashMessage(`Заперто. Нужен ${KEY_DEFS[lc].name} ключ`);
      return;
    }
    unlocking={key, color:lc, dir, t:0};
    return;
  }

  requestDoorOpen(key,SWING_BY_DIR[dir],'player');
  move={dir,key,phase:'opening',progress:0};
}

function updateUnlock(dt){
  if (!unlocking) return;
  unlocking.t+=dt;
  if (unlocking.t>=T_UNLOCK){
    const p=parseDoorKey(unlocking.key);
    MAP.rooms[p.y][p.x][p.dir]='closed';
    const nx=p.x+DIR[p.dir].dx, ny=p.y+DIR[p.dir].dy;
    MAP.rooms[ny][nx][DIR[p.dir].opp]='closed';
    MAP.locks.delete(unlocking.key);
    const dir=unlocking.dir;
    flashMessage('Замок открыт');
    unlocking=null;
    mapDirty=true;
    startMove(dir);
  }
}

function updatePlayer(dt){
  if (!move) return;
  if (move.phase==='opening'){
    if (doorPassable(move.key)){ move.phase='moving'; move.progress=0; }
    return;
  }
  move.progress+=dt;
  const t=Math.min(move.progress/T_MOVE,1), e=easeInOut(t);
  visual.offsetX=DIR[move.dir].dx*ROOM_SIZE*e;
  visual.offsetY=DIR[move.dir].dy*ROOM_SIZE*e;
  if (t>=1){
    player.x+=DIR[move.dir].dx; player.y+=DIR[move.dir].dy;
    visual.offsetX=0; visual.offsetY=0;
    releaseDoor(move.key,'player');
    move=null;
    enterRoom(player.x,player.y);
    consumeQueued();          // отработать нажатие, сделанное во время хода
  }
}
const playerWorld=()=>({x:camX,y:camY});
const playerRoomForAI=()=>({
  x:clamp(Math.round(camX/ROOM_SIZE),0,MAP.w-1),
  y:clamp(Math.round(camY/ROOM_SIZE),0,MAP.h-1),
});
