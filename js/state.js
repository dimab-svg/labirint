'use strict';

// 5. СОСТОЯНИЕ
// ============================================================
let MAP=null, WORLD_SEED=0;
let visited=new Set(), seen=new Set();
let gameWon=false, gameOver=false, gameOverText='ВАС СЪЕЛИ';
let caughtCount=0;
let hintExit=false, hintPath=false;
let grenadeWarned=false;
let teleportWarned=false;

function maybeGrenadeInfo(){
  if (grenadeWarned) return;
  grenadeWarned=true;
  showModal('У вас появилась граната ✹',
    `Бросок — клавиша G (или клик по ✹ в панели). Взрыв через ${GRENADE_FUSE} сек ` +
    `уничтожает всех в комнате — включая вас: если есть звезда защиты, она разобьётся, ` +
    `без звёзд — гибель. Бросили — сразу уходите из комнаты!`,
    null, true);
}
function maybeTeleportInfo(){
  if (teleportWarned) return;
  teleportWarned=true;
  showModal('Куплен свиток телепорта ⌖',
    'Свиток срабатывает в любом месте лабиринта: клавиша T (или клик по ⌖ в панели) ' +
    'мгновенно переносит вас в ближайший магазин — ближайший по проходимому пути, ' +
    'а не по прямой. Свиток одноразовый.',
    null, true);
}

const inv = { stars:START_STARS, coins:0, grenades:0, teleports:0, apples:0, keys:[false,false,false] };

const inBounds=(x,y)=>x>=0&&y>=0&&x<MAP.w&&y<MAP.h;
const sideType=(x,y,d)=>MAP.rooms[y][x][d];
const zoneAt=(x,y)=>MAP.zone[y*MAP.w+x];

function doorKey(x,y,dir){
  const nx=x+DIR[dir].dx, ny=y+DIR[dir].dy;
  if (y<ny||(y===ny&&x<nx)) return `${x},${y},${dir}`;
  return `${nx},${ny},${DIR[dir].opp}`;
}
function parseDoorKey(k){ const p=k.split(','); return {x:+p[0],y:+p[1],dir:p[2]}; }
function doorTypeByKey(k){ const p=parseDoorKey(k); return MAP.rooms[p.y][p.x][p.dir]; }
function lockColorOf(k){ const c=MAP.locks.get(k); return c===undefined?null:KEY_DEFS[c]; }

// ============================================================
// 6. КАМЕРА
// ============================================================
let camX=0, camY=0;
let facing='S';          // куда смотрит фигурка игрока: 'N','E','S','W'
const roomCX=rx=>rx*ROOM_SIZE;
const roomCY=ry=>ry*ROOM_SIZE;
const sx=wx=>wx-camX+CANVAS_SIZE/2;
const sy=wy=>wy-camY+CANVAS_SIZE/2;

function doorGeom(key){
  const k=parseDoorKey(key), cx=roomCX(k.x), cy=roomCY(k.y);
  if (k.dir==='E'){
    const wx=cx+ROOM_SIZE/2;
    return {p1x:wx,p1y:cy-DOOR_WIDTH/2,p2x:wx,p2y:cy+DOOR_WIDTH/2,mx:wx,my:cy};
  }
  const wy=cy+ROOM_SIZE/2;
  return {p1x:cx-DOOR_WIDTH/2,p1y:wy,p2x:cx+DOOR_WIDTH/2,p2y:wy,mx:cx,my:wy};
}
const doorCenter=(rx,ry,d)=>({x:roomCX(rx)+DIR[d].dx*ROOM_SIZE/2, y:roomCY(ry)+DIR[d].dy*ROOM_SIZE/2});
function clampToRoom(p,room,mg){
  const cx=roomCX(room.x), cy=roomCY(room.y), h=ROOM_SIZE/2-mg;
  return {x:clamp(p.x,cx-h,cx+h), y:clamp(p.y,cy-h,cy+h)};
}

// ============================================================
// 7. ДВЕРИ
// ============================================================
const doorAnims=new Map();
function requestDoorOpen(key,sign,user){
  let a=doorAnims.get(key);
  if (!a){ a={key,angle:0,target:sign*90,users:new Set()}; doorAnims.set(key,a); }
  else if (Math.abs(a.angle)>1) a.target=Math.sign(a.angle)*90;
  else a.target=sign*90;
  a.users.add(user);
  return a;
}
function releaseDoor(key,user){
  const a=doorAnims.get(key); if(!a) return;
  a.users.delete(user);
  if (a.users.size===0) a.target=0;
}
const doorPassable=key=>{ const a=doorAnims.get(key); return !!a&&Math.abs(a.angle)>=88; };
function updateDoors(dt){
  for (const a of [...doorAnims.values()]){
    a.angle=approach(a.angle,a.target,(a.target===0?90/T_CLOSE:90/T_OPEN)*dt);
    if (a.angle===0&&a.target===0&&a.users.size===0) doorAnims.delete(a.key);
  }
}
