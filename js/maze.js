'use strict';

// 4. ГЕНЕРАТОР
// ============================================================
function generateMaze(cfg, seed){
  const rnd = mulberry32(seed);
  const W=cfg.size, H=cfg.size;
  const cx=(W-1)>>1, cy=(H-1)>>1;
  const maxRing=Math.max(cx,cy);
  const NZ=cfg.zoneFrac.length;

  const rooms=[];
  for (let y=0;y<H;y++){
    const row=[];
    for (let x=0;x<W;x++) row.push({N:'wall',S:'wall',E:'wall',W:'wall'});
    rooms.push(row);
  }
  const idx=(x,y)=>y*W+x;
  const inB=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
  const ring=(x,y)=>Math.max(Math.abs(x-cx),Math.abs(y-cy));

  function openEdge(x,y,d,type){
    const nx=x+DIR[d].dx, ny=y+DIR[d].dy;
    if (!inB(nx,ny)) return;
    rooms[y][x][d]=type||'closed';
    rooms[ny][nx][DIR[d].opp]=type||'closed';
  }

  // --- зоны ---
  const bounds=[];
  for (let i=0;i<NZ;i++){
    let b=Math.round(cfg.zoneFrac[i]*maxRing);
    if (i>0) b=Math.max(b,bounds[i-1]+1);
    bounds.push(Math.min(b,maxRing));
  }
  bounds[NZ-1]=maxRing;

  const zone=new Int8Array(W*H);
  for (let y=0;y<H;y++) for (let x=0;x<W;x++){
    const r=ring(x,y); let z=NZ-1;
    for (let i=0;i<NZ;i++) if (r<=bounds[i]){ z=i; break; }
    zone[idx(x,y)]=z;
  }
  const zoneOf=(x,y)=>zone[idx(x,y)];

  // --- секторы ---
  const rot=[]; for (let k=0;k<NZ;k++) rot.push(rnd());
  function sectorOf(x,y,k){
    const S=cfg.sectors[k];
    if (S<=1) return 0;
    let t=(Math.atan2(y-cy,x-cx)+Math.PI)/TAU;
    t=(t+rot[k])%1;
    return Math.floor(t*S)%S;
  }

  const zoneCells=Array.from({length:NZ},()=>[]);
  for (let y=0;y<H;y++) for (let x=0;x<W;x++) zoneCells[zoneOf(x,y)].push({x,y});

  const parent=new Int32Array(W*H);
  for (let i=0;i<W*H;i++) parent[i]=i;
  function find(a){ while(parent[a]!==a){ parent[a]=parent[parent[a]]; a=parent[a]; } return a; }
  function unite(a,b){ const ra=find(a),rb=find(b); if(ra===rb) return false; parent[ra]=rb; return true; }

  const zoneComponents=Array.from({length:NZ},()=>[]);

  for (let k=0;k<NZ;k++){
    const groups=new Map();
    for (const c of zoneCells[k]){
      const s=sectorOf(c.x,c.y,k);
      if (!groups.has(s)) groups.set(s,[]);
      groups.get(s).push(c);
    }
    for (const cells of groups.values()){
      const inG=new Set(cells.map(c=>idx(c.x,c.y)));
      const edges=[];
      for (const c of cells) for (const d of ['E','S']){
        const nx=c.x+DIR[d].dx, ny=c.y+DIR[d].dy;
        if (!inB(nx,ny) || !inG.has(idx(nx,ny))) continue;
        edges.push({x:c.x,y:c.y,d});
      }
      shuffle(edges,rnd);
      const rest=[];
      for (const e of edges){
        const a=idx(e.x,e.y), b=idx(e.x+DIR[e.d].dx,e.y+DIR[e.d].dy);
        if (unite(a,b)) openEdge(e.x,e.y,e.d); else rest.push(e);
      }
      const p=cfg.loops[k];
      for (const e of rest) if (rnd()<p) openEdge(e.x,e.y,e.d);

      const byRoot=new Map();
      for (const c of cells){
        const r=find(idx(c.x,c.y));
        if (!byRoot.has(r)) byRoot.set(r,[]);
        byRoot.get(r).push(c);
      }
      for (const comp of byRoot.values()) zoneComponents[k].push(comp);
    }
  }

  function connectComponent(comp,k){
    const want=Math.max(1,cfg.throats[k]);
    let cands=[];
    for (const c of comp) for (const d of DIRS){
      const nx=c.x+DIR[d].dx, ny=c.y+DIR[d].dy;
      if (!inB(nx,ny) || zoneOf(nx,ny)!==k-1) continue;
      cands.push({x:c.x,y:c.y,d,ang:Math.atan2(c.y-cy,c.x-cx)});
    }
    if (!cands.length){
      for (const c of comp) for (const d of DIRS){
        const nx=c.x+DIR[d].dx, ny=c.y+DIR[d].dy;
        if (!inB(nx,ny) || zoneOf(nx,ny)>k) continue;
        if (find(idx(nx,ny))===find(idx(c.x,c.y))) continue;
        cands.push({x:c.x,y:c.y,d,ang:Math.atan2(c.y-cy,c.x-cx)});
      }
    }
    if (!cands.length) return;
    cands.sort((a,b)=>a.ang-b.ang);
    const n=Math.min(want,cands.length), off=rnd(), picked=new Set();
    for (let i=0;i<n;i++){
      let j=Math.floor(((i+off)/n)*cands.length)%cands.length, g=0;
      while (picked.has(j) && g++<cands.length) j=(j+1)%cands.length;
      picked.add(j);
      const e=cands[j];
      openEdge(e.x,e.y,e.d);
      unite(idx(e.x,e.y), idx(e.x+DIR[e.d].dx,e.y+DIR[e.d].dy));
    }
  }
  for (let k=1;k<NZ;k++) for (const comp of zoneComponents[k]) connectComponent(comp,k);

  // --- BFS ---
  const startX=cx, startY=cy;
  function bfsFrom(sx0,sy0){
    const dist=new Int32Array(W*H).fill(-1);
    const from=new Int32Array(W*H).fill(-1);
    const q=[idx(sx0,sy0)]; dist[q[0]]=0;
    for (let h=0;h<q.length;h++){
      const cur=q[h], x=cur%W, y=(cur/W)|0;
      for (const d of DIRS){
        if (rooms[y][x][d]==='wall') continue;
        const nx=x+DIR[d].dx, ny=y+DIR[d].dy;
        if (!inB(nx,ny)) continue;
        const ni=idx(nx,ny);
        if (dist[ni]!==-1) continue;
        dist[ni]=dist[cur]+1; from[ni]=cur; q.push(ni);
      }
    }
    return {dist,from};
  }

  let {dist,from}=bfsFrom(startX,startY);
  for (let pass=0;pass<6;pass++){
    let fixed=false;
    for (let y=0;y<H;y++) for (let x=0;x<W;x++){
      if (dist[idx(x,y)]!==-1) continue;
      let best=null;
      for (const d of DIRS){
        const nx=x+DIR[d].dx, ny=y+DIR[d].dy;
        if (!inB(nx,ny) || dist[idx(nx,ny)]===-1) continue;
        const sc=zoneOf(nx,ny)*10+rnd();
        if (!best||sc<best.sc) best={d,sc};
      }
      if (best){ openEdge(x,y,best.d); fixed=true; }
    }
    if (!fixed) break;
    ({dist,from}=bfsFrom(startX,startY));
  }

  // --- выход ---
  const rim=[];
  for (let y=0;y<H;y++) for (let x=0;x<W;x++){
    if (ring(x,y)!==maxRing) continue;
    const dd=dist[idx(x,y)];
    if (dd>0) rim.push({x,y,d:dd});
  }
  rim.sort((a,b)=>b.d-a.d);
  const pool=rim.slice(0,Math.max(1,Math.floor(rim.length*0.25)));
  const ex=pool[Math.floor(rnd()*pool.length)];

  let exitDir='N';
  if (ex.y===0) exitDir='N';
  else if (ex.y===H-1) exitDir='S';
  else if (ex.x===0) exitDir='W';
  else exitDir='E';

  // ============================================================
  // ЗАПЕРТЫЕ ДВЕРИ — СОКРАЩЕНИЯ
  // Ищем стену, снос которой сильнее всего укорачивает путь к выходу.
  // Это НОВЫЕ рёбра поверх связного лабиринта → тупиков не создаёт.
  // ============================================================
  const locks = new Map();   // doorKey → colorId
  {
    const nLocks = Math.min(cfg.locks, KEY_DEFS.length);
    const placed = [];
    const minSep = Math.max(4, Math.floor(maxRing*0.5));

    for (let li=0; li<nLocks; li++){
      const dExit = bfsFrom(ex.x, ex.y).dist;
      const dStart = bfsFrom(startX, startY).dist;
      const baseLen = dStart[idx(ex.x,ex.y)];
      let best=null;

      for (let y=0;y<H;y++) for (let x=0;x<W;x++){
        for (const d of ['E','S']){
          if (rooms[y][x][d]!=='wall') continue;
          const nx=x+DIR[d].dx, ny=y+DIR[d].dy;
          if (!inB(nx,ny)) continue;
          const a=idx(x,y), b=idx(nx,ny);
          if (dStart[a]<0||dStart[b]<0||dExit[a]<0||dExit[b]<0) continue;

          const viaAB = dStart[a]+1+dExit[b];
          const viaBA = dStart[b]+1+dExit[a];
          const gain = baseLen - Math.min(viaAB, viaBA);
          if (gain < 12) continue;

          // разнос по карте
          let tooClose=false;
          for (const p of placed)
            if (Math.abs(p.x-x)+Math.abs(p.y-y) < minSep){ tooClose=true; break; }
          if (tooClose) continue;

          const score = gain + rnd()*3;
          if (!best || score>best.score) best={x,y,d,gain,score};
        }
      }

      if (!best) break;
      openEdge(best.x,best.y,best.d,'locked');
      const kx=best.x, ky=best.y, kd=best.d;
      const dk = (ky < ky+DIR[kd].dy || (ky===ky+DIR[kd].dy && kx<kx+DIR[kd].dx))
        ? `${kx},${ky},${kd}`
        : `${kx+DIR[kd].dx},${ky+DIR[kd].dy},${DIR[kd].opp}`;
      locks.set(dk, li);
      placed.push({x:best.x, y:best.y, gain:best.gain});
    }
  }

  // финальные дистанции (замки считаем проходимыми — это верхняя оценка)
  ({dist,from}=bfsFrom(startX,startY));

  const solution=[];
  { let cur=idx(ex.x,ex.y);
    while(cur!==-1){ solution.push({x:cur%W,y:(cur/W)|0}); cur=from[cur]; }
    solution.reverse(); }
  const solutionSet=new Set(solution.map(p=>`${p.x},${p.y}`));

  // ============================================================
  // ПРЕДМЕТЫ
  // ============================================================
  const items = new Map();   // "x,y" → {type, ...}
  const shops = new Set();
  const traps = new Set();   // аномалии — бьют монстров при проходе

  {
    const deadByZone = Array.from({length:NZ},()=>[]);
    const midByZone  = Array.from({length:NZ},()=>[]);
    const busy = new Set([`${startX},${startY}`, `${ex.x},${ex.y}`]);

    for (let y=0;y<H;y++) for (let x=0;x<W;x++){
      const k=`${x},${y}`;
      if (busy.has(k)) continue;
      const dd=dist[idx(x,y)];
      if (dd<3) continue;
      let deg=0; for (const d of DIRS) if (rooms[y][x][d]!=='wall') deg++;
      if (deg===0) continue;
      const z=zoneOf(x,y);
      (deg===1 ? deadByZone[z] : midByZone[z]).push({x,y,d:dd});
    }
    for (const a of deadByZone) shuffle(a,rnd);
    for (const a of midByZone)  shuffle(a,rnd);

    const put=(cell,obj)=>{
      const k=`${cell.x},${cell.y}`;
      if (items.has(k)||shops.has(k)) return false;
      items.set(k,obj); return true;
    };
    const takeDead=(z)=>deadByZone[z] && deadByZone[z].length ? deadByZone[z].pop() : null;
    const takeMid =(z)=>midByZone[z]  && midByZone[z].length  ? midByZone[z].pop()  : null;
    const anyDead=()=>{
      for (let z=NZ-1;z>=0;z--) if (deadByZone[z].length) return deadByZone[z].pop();
      return null;
    };

    // 1) ключи — в тупиках, ПОДАЛЬШЕ ОТ СВОЕЙ ЗАПЕРТОЙ ДВЕРИ
    //    (по проходимому пути), а не в соседней с ней комнате.
    //    bfsDistFrom считает дистанцию по клеткам от двери.
    const bfsDistFrom=(sx0,sy0)=>{
      const dd=new Int32Array(W*H).fill(-1);
      const q=[idx(sx0,sy0)]; dd[q[0]]=0;
      for (let h=0;h<q.length;h++){
        const cur=q[h], x=cur%W, y=(cur/W)|0;
        for (const d of DIRS){
          if (rooms[y][x][d]==='wall') continue;
          const nx=x+DIR[d].dx, ny=y+DIR[d].dy;
          if (!inB(nx,ny)) continue;
          const ni=idx(nx,ny);
          if (dd[ni]!==-1) continue;
          dd[ni]=dd[cur]+1; q.push(ni);
        }
      }
      return dd;
    };
    // Ключ должен лежать ПОДАЛЬШЕ от своей двери — минимум 4 комнаты по пути,
    // а предпочтительно намного дальше (см. KEY_MIN_FROM_DOOR). Так ключ не
    // окажется в комнате рядом с дверью даже на Easy.
    const KEY_MIN_FROM_DOOR=Math.max(4,Math.round(maxRing*0.8)); // желаемая дистанция
    for (const [dk, colorId] of locks){
      const p0=dk.split(',');
      const lx=+p0[0], ly=+p0[1];
      const pd=bfsDistFrom(lx,ly);
      const byDist=(deadFlag)=>{
        const out=[];
        for (let z=NZ-1;z>=0;z--){
          const arr=deadFlag?deadByZone[z]:midByZone[z];
          if (!arr) continue;
          for (const c of arr){
            const d=pd[idx(c.x,c.y)];
            if (d>=0) out.push({c,z,d});
          }
        }
        out.sort((a,b)=>b.d-a.d);
        return out;
      };
      let pick=null;
      // 1) дальние тупики (желаемая дистанция и больше)
      { const arr=byDist(true).filter(o=>o.d>=KEY_MIN_FROM_DOOR);
        if (arr.length) pick=arr[Math.floor(rnd()*Math.min(5,arr.length))]; }
      // 2) любые тупики, но не ближе 3 комнат от двери
      if (!pick){ const arr=byDist(true).filter(o=>o.d>=3);
        if (arr.length) pick=arr[Math.floor(rnd()*Math.min(5,arr.length))]; }
      // 3) проходные комнаты, не ближе 3 комнат
      if (!pick){ const arr=byDist(false).filter(o=>o.d>=3);
        if (arr.length) pick=arr[Math.floor(rnd()*Math.min(5,arr.length))]; }
      if (pick){
        const z=pick.z;
        const pool=(deadByZone[z]||[]).indexOf(pick.c)>=0?deadByZone[z]:midByZone[z];
        const j=pool.indexOf(pick.c);
        if (j>=0) pool.splice(j,1);
        put(pick.c,{type:'key', color:colorId});
      } else {
        const c=anyDead();                       // на крайний случай
        if (c) put(c,{type:'key', color:colorId});
      }
    }

    // 2) магазины — в проходных комнатах, разнесены
    {
      const spots=[];
      for (let z=1;z<NZ;z++) for (const c of midByZone[z]) spots.push(c);
      shuffle(spots,rnd);
      const chosen=[];
      for (const c of spots){
        if (chosen.length>=cfg.shops) break;
        if (items.has(`${c.x},${c.y}`)) continue;
        let ok=true;
        for (const p of chosen)
          if (Math.abs(p.x-c.x)+Math.abs(p.y-c.y) < Math.floor(maxRing*0.6)){ ok=false; break; }
        if (!ok) continue;
        chosen.push(c);
        shops.add(`${c.x},${c.y}`);
      }
    }

    // 2а) яблоки — МНОГО, больше чем денег; кладём рано, пока тупики свободны.
    //      (съедобны Ползунами и Охотниками; Боссу безразличны)
    for (let i=0;i<(cfg.apples||0);i++){
      const z=Math.floor(rnd()*NZ);
      const cell=anyDead()||takeMid(z)||takeMid(NZ-1);
      if (!cell) break;
      put(cell,{type:'apple'});
    }

    // 3) звёзды — глубже = чаще (×TUNE.starsMult)
    {
      const wsum=[]; let tot=0;
      for (let z=0;z<NZ;z++){ const w=(z+1)*(z+1); wsum.push(w); tot+=w; }
      for (let z=0;z<NZ;z++){
        let n=Math.round(cfg.stars*TUNE.starsMult*wsum[z]/tot);
        while (n-- > 0){
          const cell = (rnd()<0.75 ? takeDead(z) : takeMid(z)) || takeDead(z) || takeMid(z);
          if (!cell) break;
          put(cell,{type:'star'});
        }
      }
    }

    // 4) деньги — по всей карте, номинал растёт к краю
    for (let i=0;i<cfg.coins;i++){
      const z=Math.min(NZ-1, Math.floor(Math.pow(rnd(),0.7)*NZ));
      const cell=(rnd()<0.55?takeDead(z):takeMid(z)) || takeMid(z) || takeDead(z);
      if (!cell) continue;
      const val = 1 + Math.floor(rnd()*(2+z*1.5));
      put(cell,{type:'coin', value:val});
    }

    // 5) гранаты — в тупиках
    for (let i=0;i<cfg.grenadesOnMap;i++){
      const z=1+Math.floor(rnd()*(NZ-1));
      const cell=takeDead(z)||anyDead()||takeMid(z);
      if (!cell) continue;
      put(cell,{type:'grenade'});
    }

    // 6) АНОМАЛИИ — проходные комнаты «на дороге», рядом нет тупиков,
    //    и между соседями есть обходные петли (можно водить монстра кругами)
    {
      const degOf=(x,y)=>{ let n=0; for (const d of DIRS) if (rooms[y][x][d]!=='wall') n++; return n; };
      // есть ли путь A→B, минуя комнату F, не длиннее maxLen (это и есть «петля»)
      const altPath=(ax,ay,bx,by,fx,fy,maxLen)=>{
        const q=[[ax,ay,0]], seenA=new Set([`${ax},${ay}`,`${fx},${fy}`]);
        while (q.length){
          const [x,y,dd]=q.shift();
          if (x===bx&&y===by) return true;
          if (dd>=maxLen) continue;
          for (const d of DIRS){
            if (rooms[y][x][d]==='wall') continue;
            const nx=x+DIR[d].dx, ny=y+DIR[d].dy, k=`${nx},${ny}`;
            if (seenA.has(k)) continue;
            seenA.add(k); q.push([nx,ny,dd+1]);
          }
        }
        return false;
      };

      const cands=[];
      for (let y=0;y<H;y++) for (let x=0;x<W;x++){
        const k=`${x},${y}`;
        if (items.has(k)||shops.has(k)) continue;
        if (x===startX&&y===startY) continue;
        if (x===ex.x&&y===ex.y) continue;
        if (dist[idx(x,y)]<6) continue;
        if (degOf(x,y)<2) continue;                    // только проходные
        let ok=true; const nbs=[];
        for (const d of DIRS){
          if (rooms[y][x][d]==='wall') continue;
          const nx=x+DIR[d].dx, ny=y+DIR[d].dy;
          if (degOf(nx,ny)<2){ ok=false; break; }      // рядом нет тупиков
          nbs.push([nx,ny]);
        }
        if (!ok) continue;
        let nLoops=0;                                   // сколько пар соседей связаны петлёй
        for (let i=0;i<nbs.length;i++)
          for (let j=i+1;j<nbs.length;j++)
            if (altPath(nbs[i][0],nbs[i][1],nbs[j][0],nbs[j][1],x,y,9)) nLoops++;
        if (nLoops>=1) cands.push({x,y,nLoops});
      }
      shuffle(cands,rnd);
      cands.sort((a,b)=>b.nLoops-a.nLoops);            // лучшие — с петлями с обеих сторон
      const minGap=Math.max(4,Math.floor(maxRing*0.4));
      const chosen=[];
      for (const c of cands){
        if (chosen.length>=(cfg.traps||0)) break;
        let far=true;
        for (const p of chosen)
          if (Math.abs(p.x-c.x)+Math.abs(p.y-c.y)<minGap){ far=false; break; }
        if (!far) continue;
        chosen.push(c);
        traps.add(`${c.x},${c.y}`);
      }
    }
  }

  return {
    w:W,h:H,rooms,cfg,seed,cx,cy,maxRing,NZ,bounds,zone,
    start:{x:startX,y:startY}, exit:{x:ex.x,y:ex.y}, exitDir,
    dist, solution, solutionSet, items, shops, traps, locks,
    pathLen:solution.length-1,
  };
}
