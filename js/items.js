'use strict';

// ============================================================
// ИГРОВЫЕ ПРЕДМЕТЫ: яблоко-приманка, гранаты, свиток телепорта
// ============================================================

// --- ЯБЛОКО-ПРИМАНКА ---
// Яблоко лежит в центре комнаты. Монстр должен ПОДОЙТИ и взять его —
// только тогда оно подействует (уснёт, как после съеденной звезды).
// Ползун — на TUNE.sateTime (30с), Охотник — на свои 10с, Босс игнорирует.
function appleInRoom(rx,ry){
  const it=MAP.items.get(`${rx},${ry}`);
  return (it&&it.type==='apple')?it:null;
}
function eatApple(m){
  if (m.dead||m.cfg.boss) return false;
  if (!appleInRoom(m.room.x,m.room.y)) return false;
  const cx=roomCX(m.room.x), cy=roomCY(m.room.y);
  MAP.items.delete(`${m.room.x},${m.room.y}`);
  Snd.at('munch',m.x,m.y);
  mapDirty=true;
  // монстр засыпает В КОМНАТЕ — недалеко от середины (не в дверях),
  // там же, где уснул бы после укуса игрока
  m.x=cx+(Math.random()*2-1)*10;
  m.y=cy+(Math.random()*2-1)*10;
  m.facing=Math.random()*TAU;
  m.state='idle'; m.reason='спит'; m.targetRoom=null; m.patrolRoom=null;
  m.wanderTarget=null; m.ignoreDoorKey=null; m.alert=0; m.moving=0;
  m.sated=(m.cfg.sateTime||TUNE.sateTime);
  return true;
}

// E / клик по чипу: положить яблоко в комнату, где стоите.
function dropApple(){
  if (gameOver||gameWon) return;
  if (move||unlocking){ flashMessage('Нельзя оставить яблоко на ходу'); return; }
  if (inv.apples<=0){ flashMessage('Нет яблок — они лежат на карте (метка ◉)'); return; }
  const k=`${player.x},${player.y}`;
  if (MAP.items.has(k)){ flashMessage('Здесь уже что-то лежит'); return; }
  if (MAP.traps.has(k)){ flashMessage('В аномалии яблоко сгорит — не оставлять'); return; }
  inv.apples--;
  // бросок не в самую середину (там стоит игрок), а чуть в сторону — как граната
  const ox=(Math.random()*2-1)*26, oy=(Math.random()*2-1)*26;
  MAP.items.set(k,{type:'apple', dropped:true, ox, oy});
  mapDirty=true;
  updateHud();
  flashMessage('Яблоко оставлено — монстр подойдёт и съест его, когда войдёт');
  Snd.play('ui');
}

// ============================================================
// 9. ГРАНАТЫ
// ============================================================
let grenades=[];    // {room, x, y, t}
let explosions=[];  // {x, y, t}

function dropGrenade(){
  if (inv.grenades<=0||gameWon||gameOver) return;
  doDropGrenade();   // без подтверждения — инструктаж был при получении
}
function doDropGrenade(){
  inv.grenades--;
  updateHud();
  const a=Math.random()*TAU;
  grenades.push({
    room:{x:player.x,y:player.y},
    x:roomCX(player.x)+Math.cos(a)*30,
    y:roomCY(player.y)+Math.sin(a)*30,
    t:GRENADE_FUSE,
  });
  flashMessage('Граната брошена!'); Snd.play('throw');
}

function updateGrenades(dt){
  for (let i=grenades.length-1;i>=0;i--){
    const g=grenades[i];
    g.t-=dt;
    if (g.t>0) continue;
    grenades.splice(i,1);
    explosions.push({x:g.x, y:g.y, t:0});
    Snd.at('explosion',g.x,g.y,{v:1.1});
    let killed=0, wounded=0;
    for (const m of monsters){
      if (Math.hypot(m.x-g.x, m.y-g.y) > GRENADE_RADIUS) continue;
      damageMonster(m,TUNE.grenadeDamage,'grenade');
      if (m.dead) killed++; else wounded++;
    }
    purgeDead();
    // взрыв задевает игрока: −1 звезда, без звёзд — гибель
    if (TUNE.grenadeFriendlyFire && !gameOver && !gameWon){
      const p=playerWorld();
      if (Math.hypot(p.x-g.x, p.y-g.y) <= GRENADE_RADIUS){
        if (inv.stars>0){
          inv.stars--; updateHud();
          flashMessage(inv.stars>0
            ? `Взрыв зацепил вас! Звезда разбита, осталось ${inv.stars}`
            : 'Взрыв зацепил вас! Последняя звезда разбита!');
        } else {
          gameOver=true; gameOverText='ПОДРЫВ НА ГРАНАТЕ'; updateHud();
          flashMessage('Вы подорвались на собственной гранате!');
        }
        continue;
      }
    }
    flashMessage(killed||wounded
      ? `Взрыв! Уничтожено: ${killed}${wounded?`, ранено: ${wounded}`:''}`
      : 'Взрыв... никого не задело');
  }
  for (let i=explosions.length-1;i>=0;i--){
    explosions[i].t+=dt;
    if (explosions[i].t>0.85) explosions.splice(i,1);
  }
}

// 9а. ТЕЛЕПОРТ В БЛИЖАЙШИЙ МАГАЗИН
// ============================================================
let teleFx=null; // {t} — визуальный эффект после прыжка

function nearestShopByPath(){
  // BFS по реально проходимым дверям (запертые — только если есть ключ)
  const W=MAP.w, H=MAP.h, im=(x,y)=>y*W+x;
  const seenB=new Uint8Array(W*H);
  const q=[{x:player.x,y:player.y}];
  seenB[im(player.x,player.y)]=1;
  while (q.length){
    const c=q.shift();
    if (MAP.shops.has(`${c.x},${c.y}`) && !(c.x===player.x&&c.y===player.y)) return c;
    for (const d of DIRS){
      const t=sideType(c.x,c.y,d);
      if (t==='wall') continue;
      if (t==='locked'){
        const lc=MAP.locks.get(doorKey(c.x,c.y,d));
        if (lc===undefined || !inv.keys[lc]) continue;
      }
      const nx=c.x+DIR[d].dx, ny=c.y+DIR[d].dy;
      if (!inBounds(nx,ny)||seenB[im(nx,ny)]) continue;
      seenB[im(nx,ny)]=1; q.push({x:nx,y:ny});
    }
  }
  return null;
}

function useTeleport(){
  if (gameWon||gameOver) return;
  if (inv.teleports<=0){ flashMessage('Нет телепорта — купите в магазине'); return; }
  if (move||unlocking){ flashMessage('Нельзя телепортироваться на ходу'); return; }
  if (inShop()){ flashMessage('Вы уже в магазине'); return; }
  const c=nearestShopByPath();
  if (!c){ flashMessage('Ни один магазин отсюда недостижим'); return; }
  inv.teleports--;
  queuedMove=null;
  player.x=c.x; player.y=c.y;
  visual.offsetX=0; visual.offsetY=0;
  camX=roomCX(player.x); camY=roomCY(player.y);
  teleFx={t:0}; Snd.play('teleport');
  // Телепорт полностью сбрасывает агрессию ВСЕХ монстров: они бросают погоню.
  // Босс идёт к своему спавну пешком; остальных возвращаем к их месту сразу —
  // вся «работа» по отвлечению монстров теряется.
  for (const m of monsters){
    if (m.dead) continue;
    if (m.cross&&!m.cross.entered){ releaseDoor(m.cross.key,m); m.cross=null; }
    if (m.cfg.boss){
      if (m.state==='chase'||m.state==='guard'){
        m.state='return'; m.reason='потерял игрока'; m.targetRoom=null;
        m.alert=0; m.wanderTarget=null; m.chkT=0; m.guardCell=null;
        m.patrolRoom=null; m.blockedWait=0; m.wanderWait=0;
      }
    } else {
      // охотники и ползуны — телепорт домой
      m.state='idle'; m.reason=''; m.targetRoom=null; m.patrolRoom=null;
      m.alert=0; m.wanderTarget=null; m.ignoreDoorKey=null; m.chkT=0;
      m.blockedWait=0; m.wanderWait=0; m.sated=0; m.moving=0;
      m.room={x:m.home.x,y:m.home.y};
      m.x=roomCX(m.home.x)+(Math.random()*2-1)*40;
      m.y=roomCY(m.home.y)+(Math.random()*2-1)*40;
      m.facing=Math.random()*TAU;
    }
  }
  updateHud();
  enterRoom(player.x,player.y);
  flashMessage('Телепортация в магазин!');
}
