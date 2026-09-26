'use strict';

// ============================================================
// 10. МОНСТРЫ
// ============================================================
const MONSTER_TYPES={
  // Ползун — сидит в своей комнате, чует игрока только рядом
  monster1:{
    id:'monster1', title:'Ползун',
    maxHp:1,                       // стойкость: гибнет от 1 взрыва/аномалии
    starDamage:1,                  // сколько звёзд сбивает за укус
    sateTime:null,                 // null → берётся TUNE.sateTime (30 с)
    chaseSpeed:85, wanderSpeed:32, size:13,
    gait:0.16,            // скорость перебора ног на единицу пути
    turnRate:9,           // рад/с: мелкий и юркий — вертится быстро
    bodyColor:'#5a1f1f', shellColor:'#8e2b2b', legColor:'#3a1414',
    eyeColor:'#ffd24a', eyeHotColor:'#ff3a2a', auraColor:'rgba(200,40,40,',
    eyes:{x:1.02,y:0.24,r:0.18},
    sightAdjacent:true, sightNeedsPassage:true, noticeDoors:true,
    canOpenDoors:true, canOpenLocked:false,
    catchRadius:CATCH_R,
    // ленивая ссылка: функция объявлена в draw-monsters.js, который
    // подключается позже — резолвим её в момент вызова, а не сейчас
    draw:(...a)=>drawMonster1(...a),
  },
  // Охотник — редкий бродячий хищник:
  //   · сам ходит между комнатами (патруль в радиусе patrolRadius от точки спавна),
  //     в аномалии и магазины по своей воле не заходит;
  //   · видит как Ползун (соседняя комната, дверь проходима), но погнавшись
  //     преследует далеко — пока не отстанет на pursueGiveUp комнат по пути;
  //   · один укус = −3 звезды; поев, засыпает лишь на sateTime секунд.
  //   ХП 8 = ровно 3 удара аномалии/гранаты (их урон 3).
  monster2:{
    id:'monster2', title:'Ящер',
    maxHp:8, starDamage:3, sateTime:10,
    patrol:true, patrolRadius:10, pursueGiveUp:5,
    chaseSpeed:92, patrolSpeed:46, wanderSpeed:34, size:16,
    gait:0.14,            // шаг ящера — от пройденного пути
    turnRate:2.6,         // рад/с: крупное тело разворачивается неспешно
    bodyColor:'#3f5a2e', backColor:'#2d4321', bellyColor:'#6d7a4a', legColor:'#33482a',
    eyeColor:'#e8d45a', eyeHotColor:'#ff3a2a', auraColor:'rgba(120,180,60,',
    eyes:{x:1.2,y:0.36,r:0.13},
    sightAdjacent:true, sightNeedsPassage:true, noticeDoors:true,
    canOpenDoors:true, canOpenLocked:false,
    catchRadius:CATCH_R,
    // ленивая ссылка: функция объявлена в draw-monsters.js, который
    // подключается позже — резолвим её в момент вызова, а не сейчас
    draw:(...a)=>drawMonster2(...a),
  },
  // Босс «Надзиратель» — колосс-страж у выхода:
  //   · видит СКВОЗЬ стены и по диагонали (радиус bossReact), пока игрок не уйдёт;
  //   · заметив — преследует бесконечно: двери открывает сам, по пути ОБХОДИТ
  //     аномалии (никогда в них не заходит), яблоки игнорирует;
  //   · телепорт игрока в магазин сбрасывает погоню — Босс идёт обратно к своему
  //     спавну и стоит на страже, пока игрок снова не попадёт в поле зрения;
  //   · ХП 30 = ровно ~10 попаданий гранатой/аномалией (урон 3).
  //     Поимка: при TUNE.bossLethal=true — мгновенная гибель.
  monster3:{
    id:'monster3', title:'Хозяин лабиринта', boss:true,
    maxHp:30, starDamage:3, sateTime:null,
    chaseSpeed:88, wanderSpeed:40, patrolSpeed:40, size:24,
    gait:0.11,            // тяжёлая поступь
    turnRate:1.5,         // рад/с: бык почти неповоротлив — разворот заметно долгий
    bodyColor:'#3b2418', shellColor:'#2e1a10', armorColor:'#1a100a',
    plateColor:'#5a3a26', runeColor:'#c9a24e', eyeColor:'#ff3a2a',
    eyeHotColor:'#ff3a2a', eyesAlwaysHot:true,
    beltColor:'#8a9496', auraColor:'rgba(160,20,20,',
    eyes:{x:1.55,y:0.3,r:0.11},
    sightAdjacent:false, sightNeedsPassage:false, noticeDoors:false,
    canOpenDoors:true, canOpenLocked:false,
    catchRadius:CATCH_R,
    // ленивая ссылка: функция объявлена в draw-monsters.js, который
    // подключается позже — резолвим её в момент вызова, а не сейчас
    draw:(...a)=>drawMonster3(...a),
  }
};

let monsters=[];
let zaps=[];   // визуальные разряды аномалии {x,y,t}

function damageMonster(m,dmg,cause){
  if (m.dead) return;
  m.hp-=dmg;
  if (cause==='trap') zaps.push({x:m.x, y:m.y, t:0});
  if (m.hp<=0){
    m.dead=true;
    if (m.cross){ releaseDoor(m.cross.key,m); m.cross=null; }
    if (cause==='trap') flashMessage('Аномалия уничтожила монстра!');
  } else {
    m.stun=Math.max(m.stun,1.2);   // выживший — оглушён
    if (cause==='trap') flashMessage('Аномалия ранила монстра!');
  }
}
function purgeDead(){
  if (monsters.some(m=>m.dead)) monsters=monsters.filter(m=>!m.dead);
}

function spawnMonster(typeId,rx,ry){
  const cfg=MONSTER_TYPES[typeId];
  // ХП и урон звёздами можно переопределить по сложности (см. DIFFICULTY):
  // Охотник на лёгком — 4 ХП (2 попадания) и −2 звезды за укус.
  const maxHp = typeId==='monster2' ? (MAP.cfg.monster2Hp||cfg.maxHp) : cfg.maxHp;
  const starDamage = typeId==='monster2' ? (MAP.cfg.monster2Stars||cfg.starDamage) : cfg.starDamage;
  const ang=Math.random()*TAU, rad=CENTER_R+18+Math.random()*40;
  monsters.push({
    cfg, maxHp, starDamage,
    hp:maxHp, dead:false, home:{x:rx,y:ry}, room:{x:rx,y:ry},
    x:roomCX(rx)+Math.cos(ang)*rad, y:roomCY(ry)+Math.sin(ang)*rad,
    facing:ang, state:'idle', reason:'', targetRoom:null, cross:null,
    ignoreDoorKey:null, wanderTarget:null, wanderWait:0,
    patrolRoom:null, chkT:0,
    alert:0, alertMark:'!', stun:0, sated:0, moving:0, blockedWait:0,
    legPhase:0,          // фаза шага ног — растёт от пройденного пути
  });
}

function roomLoad(rx,ry,except){
  let n=0;
  for (const m of monsters){
    if (m===except) continue;
    if (m.cross && !m.cross.entered){
      if (m.cross.from.x===rx&&m.cross.from.y===ry) n++;
      if (m.cross.to.x===rx  &&m.cross.to.y===ry)   n++;
    } else if (m.room.x===rx&&m.room.y===ry) n++;
  }
  return n;
}

function placeMonsters(rnd){
  monsters=[];
  const cfg=MAP.cfg;
  const frac=(cfg.hunterFrac!==undefined)?cfg.hunterFrac:TUNE.hunterFrac;

  // комнаты магазинов и их СОСЕДИ — монстры здесь не спавнятся (безопасность телепорта)
  const nearShop=new Set();
  for (const k of MAP.shops){
    const [x,y]=k.split(',').map(Number);
    nearShop.add(k);
    for (const d of DIRS){
      if (MAP.rooms[y][x][d]==='wall') continue;
      const nx=x+DIR[d].dx, ny=y+DIR[d].dy;
      if (inBounds(nx,ny)) nearShop.add(`${nx},${ny}`);
    }
  }

  const pathByZone=Array.from({length:MAP.NZ},()=>[]);
  for (const p of MAP.solution)
    if (MAP.dist[p.y*MAP.w+p.x]>8) pathByZone[zoneAt(p.x,p.y)].push(p);

  const freeByZone=Array.from({length:MAP.NZ},()=>[]);
  const zoneRooms=new Array(MAP.NZ).fill(0);
  for (let y=0;y<MAP.h;y++) for (let x=0;x<MAP.w;x++){
    const z=zoneAt(x,y);
    zoneRooms[z]++;
    if (MAP.dist[y*MAP.w+x]<7) continue;              // не у самого старта
    if (nearShop.has(`${x},${y}`)) continue;
    if (MAP.traps.has(`${x},${y}`)) continue;
    let deg=0; for (const d of DIRS) if (MAP.rooms[y][x][d]!=='wall') deg++;
    if (deg===0) continue;
    freeByZone[z].push({x,y});
  }
  for (const a of freeByZone) shuffle(a,rnd);
  for (const a of pathByZone) shuffle(a,rnd);

  const used=new Map();
  const take=c=>{
    const k=`${c.x},${c.y}`, n=used.get(k)||0;
    if (MAP.traps.has(k)||nearShop.has(k)) return false;
    if (n>=ROOM_CAP) return false;
    used.set(k,n+1); return true;
  };
  const BFS=(sx,sy)=>{
    const W=MAP.w, H=MAP.h, im=(x,y)=>y*W+x;
    const dd=new Int32Array(W*H).fill(-1);
    if (!inBounds(sx,sy)) return dd;
    dd[im(sx,sy)]=0; const q=[im(sx,sy)];
    for (let h=0;h<q.length;h++){
      const cur=q[h], x=cur%W, y=(cur/W)|0;
      for (const d of DIRS){
        if (MAP.rooms[y][x][d]==='wall') continue;
        const nx=x+DIR[d].dx, ny=y+DIR[d].dy;
        if (!inBounds(nx,ny)) continue;
        const ni=im(nx,ny);
        if (dd[ni]!==-1) continue;
        dd[ni]=dd[cur]+1; q.push(ni);
      }
    }
    return dd;
  };

  // ================== 1) места БОССОВ выбираем ЗАРАНЕЕ и бронируем ==================
  // (чтобы охотники не патрулировали в районе их «обитания»)
  const bossSpots=[];      // {x,y}
  {
    const nBoss=cfg.bosses||0;
    const isShop=(x,y)=>MAP.shops.has(`${x},${y}`);
    const degOf=(x,y)=>{ let n=0; for (const d of DIRS) if (MAP.rooms[y][x][d]!=='wall') n++; return n; };
    const canBoss=(x,y)=>{
      if (isShop(x,y)||MAP.traps.has(`${x},${y}`)) return false;
      if (x===MAP.exit.x&&y===MAP.exit.y) return false;
      if (degOf(x,y)<1) return false;
      return true;
    };
    const tryPick=(cells,minD)=>{
      for (const c of cells){
        if (!canBoss(c.x,c.y)) continue;
        if (MAP.dist[c.y*MAP.w+c.x]<minD) continue;
        if (take(c)){ bossSpots.push({x:c.x,y:c.y}); return true; }
      }
      return false;
    };
    const tryFar=(minD)=>{
      for (let g=0;g<200;g++){
        const z=MAP.NZ-1, pool=freeByZone[z];
        if (!pool||!pool.length) continue;
        const c=pool[Math.floor(rnd()*pool.length)];
        if (!canBoss(c.x,c.y)) continue;
        if (MAP.dist[c.y*MAP.w+c.x]<minD) continue;
        if (take(c)){ bossSpots.push({x:c.x,y:c.y}); return true; }
      }
      return false;
    };
    if (nBoss>=1){
      const nearExit=MAP.solution.slice(-Math.max(8,Math.min(18,MAP.solution.length-1)));
      const cells=nearExit.slice(0,-1).reverse().map(c=>({x:c.x,y:c.y}));
      if (!tryPick(cells,0)) tryFar(14);
    }
    if (nBoss>=2){
      const W=MAP.w, im=(x,y)=>y*W+x;
      const dExit=BFS(MAP.exit.x,MAP.exit.y);
      const ringOf=(x,y)=>Math.max(Math.abs(x-MAP.cx),Math.abs(y-MAP.cy));
      const minFar=Math.floor(MAP.pathLen*0.42);
      let cands=[];
      for (let y=0;y<MAP.h;y++) for (let x=0;x<MAP.w;x++){
        if (!canBoss(x,y)) continue;
        if (dExit[im(x,y)]<minFar) continue;
        if (ringOf(x,y)<MAP.maxRing-1) continue;
        cands.push({x,y,df:dExit[im(x,y)]});
      }
      cands.sort((p,q)=>q.df-p.df);
      const pool=cands.slice(0,Math.min(14,cands.length));
      shuffle(pool,rnd);
      if (!tryPick(pool,0)) tryFar(16);
    }
  }

  // ================== 2) ОХОТНИКИ — у краёв, на пути к выходу, но НЕ у боссов ==================
  // Сначала карта лёгкая (у старта охотников нет); они встречаются во внешних
  // зонах — там, где можно ждать выход. Патруль (10 комнат) не достаёт до старта
  // и до «обитания» боссов.
  const hunterPatrolR=10;                    // как MONSTER_TYPES.monster2.patrolRadius
  const minStartDist=Math.max(hunterPatrolR+1,Math.floor(MAP.pathLen*0.40));
  const dExitMap=BFS(MAP.exit.x,MAP.exit.y);
  const W=MAP.w, im2=(x,y)=>y*W+x;

  const sumZone=zoneRooms.map((r,z)=>Math.round(r*(cfg.density[z]||0)));
  const sumN=sumZone.reduce((a,b)=>a+b,0);
  let huntersLeft=Math.round(sumN*frac);
  const huntersByZone=new Array(MAP.NZ).fill(0);

  const eligibleHunter=(x,y)=>{
    if (x===MAP.start.x&&y===MAP.start.y) return false;
    if (MAP.dist[y*W+x]<minStartDist) return false;         // далеко от старта
    const de=dExitMap[im2(x,y)];
    if (de>=0&&de<6) return false;                           // не у самого выхода (там стража)
    for (const bp of bossSpots){                             // патруль не пересекает боссов
      if (Math.max(Math.abs(x-bp.x),Math.abs(y-bp.y))<=hunterPatrolR) return false;
    }
    return true;
  };

  // идём от самой внешней зоны внутрь; в ядре (z=0) охотников не бывает
  for (let z=MAP.NZ-1;z>=1&&huntersLeft>0;z--){
    if (sumZone[z]<=0) continue;
    const cands=[];
    for (const c of pathByZone[z]) if (eligibleHunter(c.x,c.y)) cands.push(c);
    for (const c of freeByZone[z]) if (eligibleHunter(c.x,c.y)) cands.push(c);
    shuffle(cands,rnd);
    // не больше, чем квота зоны (чтобы не раздувать население)
    const cap=Math.min(huntersLeft,sumZone[z],Math.max(0,sumZone[z]-huntersByZone[z]));
    let got=0;
    for (const c of cands){
      if (got>=cap||huntersLeft<=0) break;
      if (!take(c)) continue;
      huntersByZone[z]++; got++; huntersLeft--;
      spawnMonster('monster2',c.x,c.y);
    }
  }

  // ================== 3) остальные монстры (Ползуны) по зонам ==================
  for (let z=0;z<MAP.NZ;z++){
    const n=Math.max(0,sumZone[z]-huntersByZone[z]);
    const bias=cfg.onPath[z]||0;
    for (let i=0;i<n;i++){
      let cell=null, guard=0;
      while (guard++<40){
        const src=(rnd()<bias&&pathByZone[z].length)?pathByZone[z]:freeByZone[z];
        if (!src.length) break;
        const c=src.pop();
        if (take(c)){ cell=c; break; }
      }
      if (cell) spawnMonster('monster1',cell.x,cell.y);
    }
  }

  // ================== 4) стража у выхода — только Ползуны ==================
  {
    const tail=MAP.solution.slice(-Math.min(10,MAP.solution.length-1));
    shuffle(tail,rnd);
    for (let i=0;i<cfg.exitGuards;i++){
      const c=tail[i%tail.length];
      if (!c) break;
      if (c.x===MAP.exit.x&&c.y===MAP.exit.y) continue;
      if (take(c)) spawnMonster('monster1',c.x,c.y);
    }
  }

  // ================== 5) сами Боссы ==================
  for (const bp of bossSpots) spawnMonster('monster3',bp.x,bp.y);
}
function monsterCanPass(m,rx,ry,dir){
  const t=sideType(rx,ry,dir);
  if (t==='wall') return false;
  if (t==='locked'&&!m.cfg.canOpenLocked) return false;
  return true;
}
const isOrthAdjacent=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1;
function dirBetween(f,t){
  for (const d of DIRS) if (f.x+DIR[d].dx===t.x&&f.y+DIR[d].dy===t.y) return d;
  return null;
}

// Дверь «занята», если ДРУГОЙ монстр уже переходит через неё. Так два монстра не
// встают друг напротив друга в одном проёме и не блокируют друг друга навсегда.
function doorBusy(key,me){
  for (const o of monsters){
    if (o===me||o.dead) continue;
    if (o.cross&&o.cross.key===key) return true;
  }
  return false;
}
// Дистанция, ближе которой монстры расталкиваются (босс — крупный, ему дают дорогу).
function pairSep(a,b){
  if (a.cfg.boss||b.cfg.boss) return MONSTER_SEP+22;
  if (a.cfg.id==='monster2'||b.cfg.id==='monster2') return MONSTER_SEP+5;
  return MONSTER_SEP;
}

// «Ранг» монстра: Ползун=1, Охотник=2, Босс=3.
// Младшие расступаются и уступают дорогу старшим.
function monRank(m){ return m.cfg.boss?3:(m.cfg.id==='monster2'?2:1); }

// Монстры, находящиеся в комнате или только входящие в неё.
function roomOccupants(rx,ry,except){
  const out=[];
  for (const o of monsters){
    if (o===except||o.dead) continue;
    if (o.room.x===rx&&o.room.y===ry) out.push(o);
    else if (o.cross&&!o.cross.entered&&o.cross.to.x===rx&&o.cross.to.y===ry) out.push(o);
  }
  return out;
}

// Заставить монстра уступить дорогу — выйти из комнаты через другую дверь
// (не ту, в которую входит старший; по возможности не в аномалию).
function makeWay(mon,blockedKey){
  if (mon.cross||mon.dead) return false;
  const dirs=DIRS.slice(); shuffle(dirs,Math.random);
  let fallback=null;
  for (const d of dirs){
    const key=doorKey(mon.room.x,mon.room.y,d);
    if (key===blockedKey) continue;
    const t=sideType(mon.room.x,mon.room.y,d);
    if (t==='wall'||t==='locked') continue;
    const nx=mon.room.x+DIR[d].dx, ny=mon.room.y+DIR[d].dy;
    if (!inBounds(nx,ny)) continue;
    if (MAP.traps.has(`${nx},${ny}`)){ if(!fallback) fallback={key,d,nx,ny}; continue; }
    if (roomLoad(nx,ny,mon)>=ROOM_CAP) continue;
    // приоритетная дверь найдена — уходим
    mon.targetRoom=null; mon.patrolRoom=null; mon.ignoreDoorKey=null;
    mon.wanderTarget=null; mon.wanderWait=0; mon.alert=0;
    mon.reason='уступает дорогу';
    mon.cross={key,dir:d, from:{x:mon.room.x,y:mon.room.y}, to:{x:nx,y:ny},
      stage:'approach', requested:false, entered:false};
    return true;
  }
  if (fallback){
    const {key,d,nx,ny}=fallback;
    mon.targetRoom=null; mon.patrolRoom=null; mon.ignoreDoorKey=null;
    mon.wanderTarget=null; mon.wanderWait=0; mon.alert=0;
    mon.reason='уступает дорогу';
    mon.cross={key,dir:d, from:{x:mon.room.x,y:mon.room.y}, to:{x:nx,y:ny},
      stage:'approach', requested:false, entered:false};
    return true;
  }
  return false;
}

// Освободить место в комнате для монстра старшего ранга: выселить младшего.
function evictFor(actor,tx,ty,blockedKey){
  const ar=monRank(actor);
  if (ar<=1) return false;
  const occ=roomOccupants(tx,ty,actor)
    .filter(o=>monRank(o)<ar && !(o.cfg.boss));
  if (!occ.length) return false;
  occ.sort((p,q)=> (monRank(p)-monRank(q)) ||
                   (Number(p.state==='chase')-Number(q.state==='chase')) ||
                   (Number(p.cross?1:0)-Number(q.cross?1:0)));
  for (const o of occ){ if (makeWay(o,blockedKey)) return true; }
  return false;
}

function bfsNextDir(m,from,to){
  if (from.x===to.x&&from.y===to.y) return null;
  const W=MAP.w, idx=(x,y)=>y*W+x;
  const prev=new Map(), vis=new Set([idx(from.x,from.y)]);
  const q=[{x:from.x,y:from.y}];
  for (let h=0;h<q.length;h++){
    const cur=q[h];
    for (const d of DIRS){
      if (!monsterCanPass(m,cur.x,cur.y,d)) continue;
      const nx=cur.x+DIR[d].dx, ny=cur.y+DIR[d].dy;
      if (!inBounds(nx,ny)) continue;
      const k=idx(nx,ny);
      if (vis.has(k)) continue;
      vis.add(k); prev.set(k,{x:cur.x,y:cur.y,d});
      if (nx===to.x&&ny===to.y){
        let cx=nx,cy=ny;
        for(;;){
          const p=prev.get(idx(cx,cy));
          if (p.x===from.x&&p.y===from.y) return p.d;
          cx=p.x; cy=p.y;
        }
      }
      q.push({x:nx,y:ny});
    }
  }
  return null;
}

function setChase(m,room,reason,mark){
  if (m.state!=='chase'){ m.alert=1.4; m.alertMark=mark; }
  m.state='chase'; m.reason=reason;
  m.targetRoom={x:room.x,y:room.y};
  m.wanderTarget=null; m.wanderWait=0;
}

function updateMonsterSenses(m){
  if (m.stun>0) return false;
  const cfg=m.cfg, pr=playerRoomForAI();
  if (pr.x===m.room.x&&pr.y===m.room.y){ setChase(m,pr,'sight','!'); return true; }
  if (cfg.sightAdjacent&&isOrthAdjacent(m.room,pr)){
    const d=dirBetween(m.room,pr);
    if (!cfg.sightNeedsPassage||monsterCanPass(m,m.room.x,m.room.y,d)){
      setChase(m,pr,'sight','!'); return true;
    }
  }
  return false;
}

function onMonsterEnterRoom(m){
  if (!m.cfg.noticeDoors) return;
  let best=null,bestA=0;
  for (const d of DIRS){
    if (!monsterCanPass(m,m.room.x,m.room.y,d)) continue;
    const key=doorKey(m.room.x,m.room.y,d);
    if (key===m.ignoreDoorKey) continue;
    const a=doorAnims.get(key);
    if (!a||a.users.has(m)) continue;
    if (Math.abs(a.angle)>bestA){ bestA=Math.abs(a.angle); best=d; }
  }
  if (best) setChase(m,{x:m.room.x+DIR[best].dx,y:m.room.y+DIR[best].dy},'trail','?');
}

function centerObstacle(m){
  const pr=playerRoomForAI();
  if (pr.x===m.room.x&&pr.y===m.room.y) return null;
  // центр комнаты монстры обходят (там могут лежать предметы/звезды);
  // крупный Охотник обходит чуть шире. Босс obstacle не использует вовсе.
  let r=CENTER_R;
  if (m.cfg.id==='monster2') r+=8;
  return {x:roomCX(m.room.x), y:roomCY(m.room.y), r};
}

function steerMove(m,tx,ty,speed,dt,useObstacle){
  const dx=tx-m.x, dy=ty-m.y, dist=Math.hypot(dx,dy);
  if (dist<1){ m.moving=0; return true; }
  let ux=dx/dist, uy=dy/dist;

  const obs=useObstacle?centerObstacle(m):null;
  if (obs){
    const rx=m.x-obs.x, ry=m.y-obs.y, rd=Math.hypot(rx,ry)||0.001;
    const field=obs.r+28;
    if (rd<field){
      const nx=rx/rd, ny=ry/rd;
      const t1x=-ny,t1y=nx, t2x=ny,t2y=-nx;
      const use1=(t1x*ux+t1y*uy)>(t2x*ux+t2y*uy);
      const tgx=use1?t1x:t2x, tgy=use1?t1y:t2y;
      const w=clamp((field-rd)/field,0,1);
      ux=ux*(1-w)+(tgx*0.9+nx*0.5)*w;
      uy=uy*(1-w)+(tgy*0.9+ny*0.5)*w;
      const l=Math.hypot(ux,uy)||1; ux/=l; uy/=l;
    }
  }

  let px=0,py=0;
  for (const o of monsters){
    if (o===m) continue;
    if (Math.abs(o.room.x-m.room.x)>1||Math.abs(o.room.y-m.room.y)>1) continue;
    const ddx=m.x-o.x, ddy=m.y-o.y, d2=ddx*ddx+ddy*ddy;
    const sep=pairSep(m,o);
    if (d2>0&&d2<sep*sep){
      const d=Math.sqrt(d2), w=(sep-d)/sep;
      // младший ранг отходит от старшего сильнее — дорогу уступает
      const rm=monRank(m), ro=monRank(o);
      const ww = ro>rm ? w*2.2 : (rm>ro ? w*0.3 : w);
      px+=ddx/d*ww; py+=ddy/d*ww;
    }
  }
  if (px||py){
    ux+=px*1.3; uy+=py*1.3;
    const l=Math.hypot(ux,uy)||1; ux/=l; uy/=l;
  }

  const step=Math.min(speed*dt,dist);
  m.x+=ux*step; m.y+=uy*step;

  if (obs){
    const rx=m.x-obs.x, ry=m.y-obs.y, rd=Math.hypot(rx,ry);
    if (rd<obs.r&&rd>0.001){ m.x=obs.x+rx/rd*obs.r; m.y=obs.y+ry/rd*obs.r; }
  }

  m.moving=speed;
  // ФАЗА ШАГА — от реально пройденного пути, а не от времени:
  // монстр «перебирает ногами» ровно настолько, насколько сдвинулся.
  m.legPhase=(m.legPhase||0)+step*(m.cfg.gait||0.16);

  // ПОВОРОТ ТЕЛА с ограничением скорости: крупные монстры (Ящер, Бык)
  // не могут развернуться мгновенно — turnRate задан в MONSTER_TYPES (рад/с).
  let diff=Math.atan2(uy,ux)-m.facing;
  diff=Math.atan2(Math.sin(diff),Math.cos(diff));      // нормализация в [-PI,PI] без циклов
  const rate=m.cfg.turnRate||Infinity;
  const maxStep=rate*dt;
  const want=diff*Math.min(1,dt*8);                    // прежнее плавное доворачивание
  m.facing+=clamp(want,-maxStep,maxStep);              // но не быстрее turnRate
  m.facing=Math.atan2(Math.sin(m.facing),Math.cos(m.facing));
  return step>=dist;
}

function resolveOverlaps(){
  // активные монстры всегда в пределах MONSTER_ACTIVE_RANGE от игрока —
  // поэтому чиним перекрытия во всей «живой» зоне, а не только у игрока
  const near=monsters.filter(m=>
    Math.max(Math.abs(m.room.x-player.x),Math.abs(m.room.y-player.y))<=MONSTER_ACTIVE_RANGE);
  for (let i=0;i<near.length;i++){
    const a=near[i];
    for (let j=i+1;j<near.length;j++){
      const b=near[j];
      const sep=pairSep(a,b);
      const dx=b.x-a.x, dy=b.y-a.y, d2=dx*dx+dy*dy;
      if (d2>=sep*sep||d2<0.0001) continue;
      const d=Math.sqrt(d2), push=sep-d;
      const nx=dx/d, ny=dy/d;
      // распределение: младший ранг отходит почти весь, старший — чуть-чуть
      const ra=monRank(a), rb=monRank(b);
      let fa,fb;
      if (ra===rb){ fa=0.5; fb=0.5; }
      else if (ra>rb){ fa=0.12; fb=0.88; }
      else { fa=0.88; fb=0.12; }
      a.x-=nx*push*fa; a.y-=ny*push*fa;
      b.x+=nx*push*fb; b.y+=ny*push*fb;
    }
  }
}

function wanderPoint(m){
  const mg=ROOM_SIZE*0.5-38;
  for (let i=0;i<12;i++){
    const x=roomCX(m.room.x)+(Math.random()*2-1)*mg;
    const y=roomCY(m.room.y)+(Math.random()*2-1)*mg;
    if (Math.hypot(x-roomCX(m.room.x), y-roomCY(m.room.y))>CENTER_R+26) return {x,y};
  }
  const a=Math.random()*TAU, r=CENTER_R+40;
  return {x:roomCX(m.room.x)+Math.cos(a)*r, y:roomCY(m.room.y)+Math.sin(a)*r};
}

// Длина пути (по проходимым для монстра дверям) от from до to, если <= maxLen.
function bfsRoomDist(m,fr,to,maxLen){
  if (fr.x===to.x&&fr.y===to.y) return 0;
  const W=MAP.w, kk=(x,y)=>y*W+x;
  const seen=new Set([kk(fr.x,fr.y)]);
  const q=[{x:fr.x,y:fr.y,d:0}];
  for (let h=0;h<q.length;h++){
    const c=q[h];
    if (c.d>=maxLen) continue;
    for (const d of DIRS){
      if (!monsterCanPass(m,c.x,c.y,d)) continue;
      const nx=c.x+DIR[d].dx, ny=c.y+DIR[d].dy;
      if (!inBounds(nx,ny)) continue;
      const k=kk(nx,ny);
      if (seen.has(k)) continue;
      if (nx===to.x&&ny===to.y) return c.d+1;
      seen.add(k); q.push({x:nx,y:ny,d:c.d+1});
    }
  }
  return -1;
}

// Охотник выбирает пункт патруля: комната в радиусе patrolRadius от точки спавна,
// достижимая отсюда, без аномалий и магазинов. Любит дальние уголки «своей зоны».
function choosePatrolRoom(m){
  const R=m.cfg.patrolRadius||8;
  const W=MAP.w, kk=(x,y)=>y*W+x;
  const okRoom=(x,y)=>{
    const k=`${x},${y}`;
    return !(MAP.traps.has(k)||MAP.shops.has(k));
  };
  const homeDist=new Map();   // "x,y" → дистанция от дома
  {
    const q=[{x:m.home.x,y:m.home.y,d:0}];
    const seen=new Set([kk(m.home.x,m.home.y)]);
    homeDist.set(`${m.home.x},${m.home.y}`,0);
    for (let h=0;h<q.length;h++){
      const c=q[h];
      if (c.d>=R) continue;
      for (const d of DIRS){
        if (!monsterCanPass(m,c.x,c.y,d)) continue;
        const nx=c.x+DIR[d].dx, ny=c.y+DIR[d].dy;
        if (!inBounds(nx,ny)) continue;
        const k=kk(nx,ny);
        if (seen.has(k)) continue;
        seen.add(k);
        if (okRoom(nx,ny)){
          q.push({x:nx,y:ny,d:c.d+1});
          if (!homeDist.has(`${nx},${ny}`)) homeDist.set(`${nx},${ny}`,c.d+1);
        }
      }
    }
  }
  const opts=[];
  {
    const q=[{x:m.room.x,y:m.room.y,d:0}];
    const seen=new Set([kk(m.room.x,m.room.y)]);
    for (let h=0;h<q.length;h++){
      const c=q[h];
      if (c.d>0&&c.d<=R*2){
        const hd=homeDist.get(`${c.x},${c.y}`);
        if (hd!==undefined) opts.push({x:c.x,y:c.y,d:c.d,home:hd});
      }
      if (c.d>=R*2) continue;
      for (const d of DIRS){
        if (!monsterCanPass(m,c.x,c.y,d)) continue;
        const nx=c.x+DIR[d].dx, ny=c.y+DIR[d].dy;
        if (!inBounds(nx,ny)) continue;
        const k=kk(nx,ny);
        if (seen.has(k)) continue;
        seen.add(k);
        if (okRoom(nx,ny)) q.push({x:nx,y:ny,d:c.d+1});
      }
    }
  }
  if (!opts.length) return null;
  const far=opts.filter(o=>o.home>=Math.max(2,Math.floor(R*0.6)));
  const pool=far.length?far:opts;
  return pool[Math.floor(Math.random()*pool.length)];
}

function updateMonster(m,dt){
  const cfg=m.cfg;
  if (cfg.boss){ updateBossMonster(m,dt); return; }   // Босс — своя логика
  if (m.dead) return;
  if (m.alert>0) m.alert-=dt;
  if (m.blockedWait>0) m.blockedWait-=dt;
  if (m.stun>0){ m.stun-=dt; m.moving=0; return; }
  if (m.sated>0){ m.sated-=dt; m.moving=0; m.state='idle'; m.reason='сыт'; return; }
  if (gameOver||gameWon){ m.moving=0; return; }

  const far=Math.max(Math.abs(m.room.x-player.x),Math.abs(m.room.y-player.y))>MONSTER_ACTIVE_RANGE;
  if (far&&!m.cross){ m.moving=0; return; }

  // скорость: бег за игроком — chaseSpeed; свой патруль — patrolSpeed
  const run=(cfg.patrol&&m.state!=='chase') ? (cfg.patrolSpeed||cfg.wanderSpeed) : cfg.chaseSpeed;

  updateMonsterSenses(m);

  // Преследователь (Охотник): не бросает погоню, когда игрок скрылся из виду,
  // а держится за ним, пока тот не оторвётся на pursueGiveUp комнат (по пути).
  if (cfg.pursueGiveUp>0&&m.state==='chase'){
    const pr=playerRoomForAI();
    if (pr.x===m.room.x&&pr.y===m.room.y){
      m.targetRoom={x:pr.x,y:pr.y};
    } else {
      m.chkT-=dt;
      if (m.chkT<=0){
        m.chkT=0.4;
        const len=bfsRoomDist(m,m.room,pr,m.cfg.pursueGiveUp);
        if (len<0){
          m.state='idle'; m.reason='потерял'; m.alert=0;
          m.targetRoom=null; m.patrolRoom=null; m.ignoreDoorKey=null;
          m.wanderTarget=null; m.wanderWait=1.0; m.moving=0;
          return;
        }
        m.targetRoom={x:pr.x,y:pr.y};
      }
    }
  }

  if (m.cross){
    const cr=m.cross, dc=doorCenter(cr.from.x,cr.from.y,cr.dir);
    if (!cr.entered&&m.targetRoom&&m.targetRoom.x===cr.from.x&&m.targetRoom.y===cr.from.y){
      releaseDoor(cr.key,m); m.cross=null; return;
    }
    if (cr.stage==='approach'){
      if (cfg.canOpenDoors&&Math.hypot(dc.x-m.x,dc.y-m.y)<ROOM_SIZE*0.45&&!cr.requested){
        requestDoorOpen(cr.key,SWING_BY_DIR[cr.dir],m); cr.requested=true;
      }
      if (steerMove(m,dc.x,dc.y,run,dt,true)){
        if (doorPassable(cr.key)) cr.stage='pass'; else m.moving=0;
      }
      return;
    }
    const ex=dc.x+DIR[cr.dir].dx*ROOM_SIZE*0.38;
    const ey=dc.y+DIR[cr.dir].dy*ROOM_SIZE*0.38;
    const done=steerMove(m,ex,ey,run,dt,false);
    if (!cr.entered){
      const axis=DIR[cr.dir].dx+DIR[cr.dir].dy;
      const along=(DIR[cr.dir].dx!==0)?(m.x-dc.x):(m.y-dc.y);
      if (along*axis>0){
        cr.entered=true;
        m.room={x:cr.to.x,y:cr.to.y};
        m.ignoreDoorKey=cr.key;
        if (MAP.traps.has(`${cr.to.x},${cr.to.y}`)){
          damageMonster(m,TUNE.trapDamage,'trap');
          if (m.dead) return;
        }
        if (!updateMonsterSenses(m)) onMonsterEnterRoom(m);
      }
    }
    if (done){ releaseDoor(cr.key,m); m.cross=null; }
    return;
  }

  // --- ЯБЛОКО-ПРИМАНКА в комнате ---
  // Ползун и Охотник идут к яблоку (оно в центре комнаты), берут его и засыпают
  // здесь же. Погоня и патруль прерываются — яблоко отвлекает. Босс не реагирует.
  const ap=appleInRoom(m.room.x,m.room.y);
  if (ap){
    const cx=roomCX(m.room.x)+(ap.ox||0), cy=roomCY(m.room.y)+(ap.oy||0);
    // отменить неоконченный переход (яблоко в ЭТОЙ комнате — не уходим)
    if (m.cross&&!m.cross.entered){ releaseDoor(m.cross.key,m); m.cross=null; }
    m.targetRoom=null; m.patrolRoom=null; m.ignoreDoorKey=null; m.alert=0;
    // к яблоку идём напрямую (цель — само яблоко, чуть от центра)
    const sp=Math.max((cfg.patrol?cfg.chaseSpeed:cfg.wanderSpeed)*1.2,40);
    const close=steerMove(m,cx,cy,sp,dt,false);
    if (close||Math.hypot(m.x-cx,m.y-cy)<34){
      if (eatApple(m)){
        updateHud();
        flashMessage(`${m.cfg.title} съел яблоко и заснул в комнате`);
      }
    }
    return;
  }

  const pr=playerRoomForAI();
  if (pr.x===m.room.x&&pr.y===m.room.y){
    const p=playerWorld(), t=clampToRoom(p,m.room,14);
    steerMove(m,t.x,t.y,cfg.chaseSpeed,dt,false);
    if (!gameWon&&!gameOver&&Math.hypot(p.x-m.x,p.y-m.y)<cfg.catchRadius) onCatch(m);
    return;
  }

  // движение к цели (преследование или пункт патруля) через двери
  if (m.targetRoom&&(m.targetRoom.x!==m.room.x||m.targetRoom.y!==m.room.y)&&m.blockedWait<=0){
    const d=bfsNextDir(m,m.room,m.targetRoom);
    if (d){
      const nx=m.room.x+DIR[d].dx, ny=m.room.y+DIR[d].dy;
      const playerThere=(pr.x===nx&&pr.y===ny);
      // Охотник выше рангом Ползуна: из забитой комнаты выселяем младших
      for (let e=0;e<3&&roomLoad(nx,ny,m)>=ROOM_CAP;e++){
        if (!evictFor(m,nx,ny,doorKey(m.room.x,m.room.y,d))) break;
      }
      if (!playerThere&&roomLoad(nx,ny,m)>=ROOM_CAP){
        m.blockedWait=0.5+Math.random()*0.6;
      } else {
        const dkey=doorKey(m.room.x,m.room.y,d);
        if (doorBusy(dkey,m)){
          // кто-то уже идёт через эту дверь — подождём в комнате, а не в проёме
          m.blockedWait=0.5+Math.random()*0.7; m.wanderTarget=null;
        } else {
          m.cross={key:dkey, dir:d,
            from:{x:m.room.x,y:m.room.y}, to:{x:nx,y:ny},
            stage:'approach', requested:false, entered:false};
          return;
        }
      }
    } else m.targetRoom=null;
  }

  if (m.blockedWait>0){
    if (!m.wanderTarget) m.wanderTarget=wanderPoint(m);
    if (steerMove(m,m.wanderTarget.x,m.wanderTarget.y,cfg.wanderSpeed,dt,true)) m.wanderTarget=null;
    return;
  }

  // --- бродячий монстр (Охотник): ходит между комнатами ---
  if (cfg.patrol){
    m.state='patrol';
    if (m.patrolRoom&&m.patrolRoom.x===m.room.x&&m.patrolRoom.y===m.room.y){
      // дошёл до пункта — передохнёт и выберет следующий
      m.patrolRoom=null; m.targetRoom=null; m.ignoreDoorKey=null;
      m.wanderTarget=null; m.wanderWait=0.6+Math.random()*1.8;
    }
    if (m.wanderWait>0){ m.wanderWait-=dt; m.moving=0; return; }
    if (!m.patrolRoom&&!m.targetRoom){
      const c=choosePatrolRoom(m);
      if (c){ m.patrolRoom={x:c.x,y:c.y}; m.targetRoom={x:c.x,y:c.y}; m.wanderTarget=null; return; }
      // некуда идти — просто шатается по комнате
      if (!m.wanderTarget) m.wanderTarget=wanderPoint(m);
      if (steerMove(m,m.wanderTarget.x,m.wanderTarget.y,cfg.wanderSpeed,dt,true)){
        m.wanderTarget=null; m.wanderWait=0.5+Math.random()*1.5;
      }
      return;
    }
    return; // в пути — движение продолжит блок выше в следующем кадре
  }

  // --- сидячий монстр (Ползун): шатается в своей комнате ---
  m.state='idle'; m.reason=''; m.targetRoom=null; m.ignoreDoorKey=null;
  if (m.wanderWait>0){ m.wanderWait-=dt; m.moving=0; return; }
  if (!m.wanderTarget) m.wanderTarget=wanderPoint(m);
  if (steerMove(m,m.wanderTarget.x,m.wanderTarget.y,cfg.wanderSpeed,dt,true)){
    m.wanderTarget=null; m.wanderWait=0.4+Math.random()*1.6;
  }
}

// ============================================================
// 10а. БОСС «НАДЗИРАТЕЛЬ» — отдельная логика
// ============================================================
function bossSenseRange(){ return 1; }   // видит ТОЛЬКО соседнюю клетку (и по диагонали, и сквозь стену)

// Первый шаг пути к цели в ОБХОД аномалий (Босс в аномалию никогда не входит).
function bossNextDir(m,to){
  if (m.room.x===to.x&&m.room.y===to.y) return null;
  const W=MAP.w, idx=(x,y)=>y*W+x, from=m.room;
  const q=[{x:from.x,y:from.y}], vis=new Set([idx(from.x,from.y)]), prev=new Map();
  for (let h=0;h<q.length;h++){
    const cur=q[h];
    for (const d of DIRS){
      if (!monsterCanPass(m,cur.x,cur.y,d)) continue;
      const nx=cur.x+DIR[d].dx, ny=cur.y+DIR[d].dy;
      if (!inBounds(nx,ny)) continue;
      if (MAP.traps.has(`${nx},${ny}`)) continue;   // аномалии обходит всегда
      const k=idx(nx,ny);
      if (vis.has(k)) continue;
      vis.add(k); prev.set(k,{x:cur.x,y:cur.y,d});
      if (nx===to.x&&ny===to.y){
        let cx=nx, cy=ny;
        for(;;){
          const p=prev.get(idx(cx,cy));
          if (p.x===from.x&&p.y===from.y) return p.d;
          cx=p.x; cy=p.y;
        }
      }
      q.push({x:nx,y:ny});
    }
  }
  return null;
}

// Босс НЕ обходит центр комнаты: идёт сквозь него. Все движения — без обхода.
function bossPace(m,dt,speed){
  if (m.wanderWait>0){ m.wanderWait-=dt; m.moving=0; return; }
  if (!m.wanderTarget){
    const a=Math.random()*TAU, rr=26+Math.random()*55;
    m.wanderTarget={x:roomCX(m.room.x)+Math.cos(a)*rr, y:roomCY(m.room.y)+Math.sin(a)*rr};
  }
  if (steerMove(m,m.wanderTarget.x,m.wanderTarget.y,speed,dt,false)){
    m.wanderTarget=null; m.wanderWait=0.5+Math.random()*1.4;
  }
}

// Комната для «прогулки» Босса в покое: в радиусе 3 комнат от спавна.
// Он не сидит на месте, но и не уходит далеко от своего поста.
function bossPatrolSpot(m){
  const home=m.home, W=MAP.w, kk=(x,y)=>y*W+x, R=3;
  const cands=[];
  const seen=new Set([kk(home.x,home.y)]);
  const q=[{x:home.x,y:home.y}];
  for (let h=0;h<q.length;h++){
    const c=q[h];
    cands.push(c);
    for (const d of DIRS){
      if (!monsterCanPass(m,c.x,c.y,d)) continue;
      const nx=c.x+DIR[d].dx, ny=c.y+DIR[d].dy;
      if (!inBounds(nx,ny)) continue;
      const k=kk(nx,ny);
      if (seen.has(k)) continue;
      if (MAP.traps.has(`${nx},${ny}`)||MAP.shops.has(`${nx},${ny}`)) continue;
      seen.add(k);
      if (Math.abs(nx-home.x)+Math.abs(ny-home.y)<=R) q.push({x:nx,y:ny});
    }
  }
  const others=cands.filter(c=>!(c.x===m.room.x&&c.y===m.room.y));
  const pool=others.length?others:cands;
  return pool[Math.floor(Math.random()*pool.length)];
}

// Начать переход через дверь. Босс выше рангом: из полной комнаты младшие уходят.
function bossStartCross(m,dir){
  const dkey=doorKey(m.room.x,m.room.y,dir);
  if (doorBusy(dkey,m)){ m.blockedWait=0.5+Math.random()*0.6; return false; }
  const nx=m.room.x+DIR[dir].dx, ny=m.room.y+DIR[dir].dy;
  // Босс — высший ранг: из набитой комнаты младших «просим» расступиться
  // (они начинают уходить сами) и проходим, не дожидаясь полного освобождения.
  for (let e=0;e<4&&roomLoad(nx,ny,m)>=ROOM_CAP;e++){
    if (!evictFor(m,nx,ny,dkey)) break;
  }
  m.cross={key:dkey, dir,
    from:{x:m.room.x,y:m.room.y}, to:{x:nx,y:ny},
    stage:'approach', requested:false, entered:false};
  return true;
}

function bossStepCross(m,dt){
  const cfg=m.cfg, cr=m.cross, dc=doorCenter(cr.from.x,cr.from.y,cr.dir);
  const speed=(m.state==='chase')?cfg.chaseSpeed:cfg.patrolSpeed;
  if (cr.stage==='approach'){
    if (cfg.canOpenDoors&&Math.hypot(dc.x-m.x,dc.y-m.y)<ROOM_SIZE*0.45&&!cr.requested){
      requestDoorOpen(cr.key,SWING_BY_DIR[cr.dir],m); cr.requested=true;
    }
    if (steerMove(m,dc.x,dc.y,speed,dt,false)){
      if (doorPassable(cr.key)) cr.stage='pass'; else m.moving=0;
    }
    return;
  }
  const ex=dc.x+DIR[cr.dir].dx*ROOM_SIZE*0.38;
  const ey=dc.y+DIR[cr.dir].dy*ROOM_SIZE*0.38;
  const done=steerMove(m,ex,ey,speed,dt,false);
  if (!cr.entered){
    const axis=DIR[cr.dir].dx+DIR[cr.dir].dy;
    const along=(DIR[cr.dir].dx!==0)?(m.x-dc.x):(m.y-dc.y);
    if (along*axis>0){
      cr.entered=true;
      m.room={x:cr.to.x,y:cr.to.y};
      m.ignoreDoorKey=cr.key;
      if (MAP.traps.has(`${cr.to.x},${cr.to.y}`)){
        damageMonster(m,TUNE.trapDamage,'trap');   // страховка
        if (m.dead) return;
      }
      m.chkT=0;
    }
  }
  if (done){ releaseDoor(cr.key,m); m.cross=null; }
}

// Соседние проходимые комнаты вокруг укрытия игрока (сама аномалия исключена).
function bossGuardCells(pr){
  const out=[];
  for (const d of DIRS){
    const nx=pr.x+DIR[d].dx, ny=pr.y+DIR[d].dy;
    if (!inBounds(nx,ny)) continue;
    if (MAP.rooms[pr.y][pr.x][d]==='wall') continue;
    const k=`${nx},${ny}`;
    if (MAP.traps.has(k)||MAP.shops.has(k)) continue;
    out.push({x:nx,y:ny});
  }
  return out;
}

// «Караул» вокруг аномалии: Босс не входит в неё, но кружит рядом, меняя позиции.
function bossGuardStep(m,dt){
  const cfg=m.cfg, pr=playerRoomForAI();
  if (m.guardCell&&m.room.x===m.guardCell.x&&m.room.y===m.guardCell.y){
    m.guardCell=null;                       // дошёл — сменить позицию
    m.wanderWait=0.7+Math.random()*1.3;
  }
  if (!m.guardCell){
    const cells=bossGuardCells(pr), reach=[];
    for (const c of cells){
      if (m.room.x===c.x&&m.room.y===c.y){ reach.push(c); continue; }
      if (bossNextDir(m,c)!==null) reach.push(c);
    }
    if (reach.length){
      const alt=reach.filter(c=>!(c.x===m.room.x&&c.y===m.room.y));
      const pool=alt.length?alt:reach;
      const pick=pool[Math.floor(Math.random()*pool.length)];
      m.guardCell={x:pick.x,y:pick.y};
    } else {
      bossPace(m,dt,cfg.patrolSpeed);       // встать негде — топчется рядом
      return;
    }
  }
  const gc=m.guardCell;
  if (m.room.x===gc.x&&m.room.y===gc.y){ bossPace(m,dt,cfg.patrolSpeed); return; }
  const d=bossNextDir(m,gc);
  if (!d){ m.guardCell=null; return; }
  if (!bossStartCross(m,d)) bossPace(m,dt,cfg.patrolSpeed);
}

function updateBossMonster(m,dt){
  const cfg=m.cfg;
  if (m.alert>0) m.alert-=dt;
  if (m.blockedWait>0) m.blockedWait-=dt;
  if (m.stun>0){ m.stun-=dt; m.moving=0; return; }
  if (gameOver||gameWon){ m.moving=0; return; }

  const pr=playerRoomForAI();
  const sees=(Math.max(Math.abs(m.room.x-pr.x),Math.abs(m.room.y-pr.y))<=bossSenseRange());
  const playerInTrap=MAP.traps.has(`${pr.x},${pr.y}`);
  const playerHere=(pr.x===m.room.x&&pr.y===m.room.y);
  const atHome=(m.room.x===m.home.x&&m.room.y===m.home.y);

  // ---------- аграция / состояния ----------
  if (m.state==='chase'){
    // Погоня БЕСКОНЕЧНА (сброс только телепортом игрока или смертью Босса).
    if (playerInTrap){ m.state='guard'; m.reason='караулит аномалию'; m.alert=0; m.guardCell=null; }
    else if (playerHere){ /* догнать ниже */ }
    else {
      m.chkT-=dt;                            // «нюх»: цель = текущая комната игрока
      if (m.chkT<=0){ m.chkT=0.7; m.targetRoom={x:pr.x,y:pr.y}; }
    }
  } else if (m.state==='guard'){
    if (!playerInTrap){
      if (sees||playerHere) setChase(m,{x:pr.x,y:pr.y},'вышел из укрытия','!');
      else { m.state='return'; m.reason='потерял след'; m.alert=0; m.guardCell=null; }
    } else if (!playerHere){
      const know=Math.max(Math.abs(m.room.x-pr.x),Math.abs(m.room.y-pr.y))<=MONSTER_ACTIVE_RANGE;
      if (!know){ m.state='return'; m.reason='домой'; m.alert=0; m.guardCell=null; }
    }
  } else {   // idle / return
    if (sees||playerHere){
      if (playerInTrap&&!playerHere){ m.state='guard'; m.reason='караулит аномалию'; m.alert=0; m.guardCell=null; }
      else setChase(m,{x:pr.x,y:pr.y},'заметил','!');
    } else if (!atHome){
      m.state='return'; m.reason='домой';
    }
  }
  if (m.state==='return'&&atHome){ m.state='idle'; m.reason='страж'; }

  // ---------- покой: прохаживается по 2–3 комнатам вокруг спавна ----------
  if (m.state==='idle'){
    if (m.wanderWait>0){ m.wanderWait-=dt; m.moving=0; return; }
    if (!m.patrolRoom){
      const c=bossPatrolSpot(m);
      if (!c){ bossPace(m,dt,cfg.patrolSpeed); return; }
      m.patrolRoom={x:c.x,y:c.y}; m.ignoreDoorKey=null;
    }
    if (m.room.x===m.patrolRoom.x&&m.room.y===m.patrolRoom.y){
      m.patrolRoom=null; m.wanderTarget=null;
      m.wanderWait=1.0+Math.random()*2.0;    // постоит-оглядится
      return;
    }
    const pd=bossNextDir(m,m.patrolRoom);
    if (!pd){ m.patrolRoom=null; return; }
    if (!bossStartCross(m,pd)) bossPace(m,dt,cfg.patrolSpeed);
    return;
  }

  // ---------- переход через дверь ----------
  if (m.cross){ bossStepCross(m,dt); return; }

  // ---------- игрок в одной комнате: хватать ----------
  if (playerHere&&!playerInTrap){
    if (m.state!=='chase') setChase(m,{x:pr.x,y:pr.y},'в комнате','!');
    const p=playerWorld(), t=clampToRoom(p,m.room,14);
    steerMove(m,t.x,t.y,cfg.chaseSpeed,dt,false);
    if (!gameWon&&!gameOver&&Math.hypot(p.x-m.x,p.y-m.y)<cfg.catchRadius) onBossCatch(m);
    return;
  }

  if (m.blockedWait>0){ bossPace(m,dt,cfg.patrolSpeed*0.6); return; }

  // ---------- выбор шага ----------
  if (m.state==='chase'){
    const dir=bossNextDir(m,pr);
    if (dir){ if (!bossStartCross(m,dir)) bossPace(m,dt,cfg.patrolSpeed); return; }
    bossGuardStep(m,dt);                     // путь к игроку упёрся (аномалия и т.п.)
    return;
  }
  if (m.state==='guard'){ bossGuardStep(m,dt); return; }
  // return: идти домой (после телепорта и т.п.)
  const dir=bossNextDir(m,m.home);
  if (dir){ if (!bossStartCross(m,dir)) bossPace(m,dt,cfg.patrolSpeed); return; }
  bossPace(m,dt,cfg.patrolSpeed);
}
function onBossCatch(m){
  if (gameOver||gameWon) return;
  if (m.cross) releaseDoor(m.cross.key,m);
  m.cross=null;
  m.state='idle'; m.reason=''; m.targetRoom=null;
  m.wanderTarget=null; m.ignoreDoorKey=null; m.alert=0; m.moving=0;
  if (TUNE.bossLethal){
    gameOver=true; gameOverText='ПОЙМАН БОССОМ'; updateHud();
    flashMessage('Надзиратель сомкнул хватку — это конец');
  } else {
    const loss=(m.starDamage!==undefined?m.starDamage:3);
    if (inv.stars>0){
      inv.stars=Math.max(0,inv.stars-loss); updateHud();
      flashMessage(inv.stars>0
        ? `Надзиратель смял вас: −${loss}. Осталось ${inv.stars}`
        : 'Надзиратель разбил последнюю звезду!');
    } else {
      gameOver=true; gameOverText='ПОЙМАН БОССОМ'; updateHud();
      flashMessage('У вас не осталось звёзд — Надзиратель добил вас');
    }
    m.stun=1.6;      // тяжело дышит после удара, но не уходит
    m.state='chase'; // и продолжает преследовать
  }
}

function onCatch(m){
  caughtCount++; caughtEl.textContent=caughtCount;
  if (m.cross) releaseDoor(m.cross.key,m);
  m.cross=null;
  m.state='idle'; m.reason=''; m.targetRoom=null;
  m.wanderTarget=null; m.ignoreDoorKey=null; m.alert=0; m.moving=0;

  const sate=(m.cfg.sateTime||TUNE.sateTime);
  if (TUNE.stayAfterCatch){
    // монстр насытился и засыпает на месте (Охотник — лишь на 10 с, Ползун — 30 с)
    m.sated=sate;
  } else {
    // старое поведение v10: телепорт домой
    m.room={x:m.home.x,y:m.home.y};
    m.x=roomCX(m.home.x)+40; m.y=roomCY(m.home.y);
    m.stun=2.0;
  }

  const starLoss=(m.starDamage!==undefined?m.starDamage:(m.cfg.starDamage||1));
  const who=m.cfg.title;
  if (inv.stars>0){
    const loss=Math.min(inv.stars,starLoss);
    inv.stars-=loss;
    updateHud();
    flashMessage(inv.stars>0
      ? `${who} сбил звёзды: −${loss}. Осталось ${inv.stars}`
      : `${who} разбил последнюю звезду (−${loss})!`);
  } else {
    gameOver=true; gameOverText='ВАС СЪЕЛИ'; updateHud();
    flashMessage(`Вас съел ${who.toLowerCase()}`);
  }
}
