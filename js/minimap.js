'use strict';

// ============================================================
// 13. КАРТА
// ============================================================
const mapCanvas=document.getElementById('mapCanvas');
const mapCtx=mapCanvas.getContext('2d');
const MAP_PX=384;
let mapMode='local', mapDirty=true, mapTimer=0;

function cellState(x,y){
  if (!inBounds(x,y)) return 'out';
  const k=`${x},${y}`;
  if (visited.has(k)) return 'visited';
  if (seen.has(k))    return 'seen';
  return 'fog';
}
const showSolution=()=>SHOW_SOLUTION||hintPath;

function drawMap(){
  mapCtx.fillStyle='#0b0d10';
  mapCtx.fillRect(0,0,MAP_PX,MAP_PX);
  if (mapMode==='local') drawLocalMap(); else drawFullMap();
}

function mapStar(g,X,Y,R,color){
  g.beginPath();
  for (let i=0;i<10;i++){
    const a=(i/10)*TAU-Math.PI/2, rr=(i%2===0)?R:R*0.45;
    const x=X+Math.cos(a)*rr, y=Y+Math.sin(a)*rr;
    if (i===0) g.moveTo(x,y); else g.lineTo(x,y);
  }
  g.closePath(); g.fillStyle=color; g.fill();
}

function drawLocalMap(){
  const R=8, n=2*R+1;
  const cs=Math.floor(MAP_PX/n);
  const ox=Math.floor((MAP_PX-cs*n)/2), oy=ox;
  const pad=Math.max(2,Math.round(cs*0.17));
  const body=cs-2*pad;

  const COL_VIS='#61707f', COL_SEEN='#2b3542', COL_SOL='#4e7a48',
        COL_STUB='#3b4654', COL_HERE='#8ea4b8';

  const px=dx=>ox+(dx+R)*cs, py=dy=>oy+(dy+R)*cs;

  for (let dy=-R;dy<=R;dy++) for (let dx=-R;dx<=R;dx++){
    const rx=player.x+dx, ry=player.y+dy;
    const st=cellState(rx,ry);
    if (st==='out'||st==='fog') continue;
    const X=px(dx), Y=py(dy);
    const here=(dx===0&&dy===0);
    const onSol=showSolution()&&MAP.solutionSet.has(`${rx},${ry}`);

    let col = st==='visited' ? (onSol?COL_SOL:COL_VIS) : COL_SEEN;
    if (here) col=COL_HERE;
    mapCtx.fillStyle=col;
    mapCtx.fillRect(X+pad,Y+pad,body,body);

    for (const d of ['E','S']){
      const t=MAP.rooms[ry][rx][d];
      if (t==='wall') continue;
      const nx=rx+DIR[d].dx, ny=ry+DIR[d].dy;
      const nst=cellState(nx,ny);
      if (nst==='fog'||nst==='out') continue;
      const nHere=(nx===player.x&&ny===player.y);
      const nSol=showSolution()&&MAP.solutionSet.has(`${nx},${ny}`);
      const nCol=nHere?COL_HERE:(nst==='visited'?(nSol?COL_SOL:COL_VIS):COL_SEEN);
      let link=(col===COL_SEEN||nCol===COL_SEEN)?COL_SEEN:(here||nHere?COL_HERE:col);
      if (t==='locked'){
        const lk=MAP.locks.get(doorKey(rx,ry,d));
        if (lk!==undefined) link=KEY_DEFS[lk].color;
      }
      mapCtx.fillStyle=link;
      if (d==='E') mapCtx.fillRect(X+cs-pad,Y+pad,2*pad,body);
      else         mapCtx.fillRect(X+pad,Y+cs-pad,body,2*pad);
    }

    for (const d of DIRS){
      const t=MAP.rooms[ry][rx][d];
      if (t==='wall') continue;
      const nx=rx+DIR[d].dx, ny=ry+DIR[d].dy;
      if (cellState(nx,ny)!=='fog') continue;
      let stub=COL_STUB;
      if (t==='locked'){
        const lk=MAP.locks.get(doorKey(rx,ry,d));
        if (lk!==undefined) stub=KEY_DEFS[lk].color;
      }
      mapCtx.fillStyle=stub;
      if (d==='E') mapCtx.fillRect(X+cs-pad,Y+pad,pad,body);
      if (d==='W') mapCtx.fillRect(X,Y+pad,pad,body);
      if (d==='S') mapCtx.fillRect(X+pad,Y+cs-pad,body,pad);
      if (d==='N') mapCtx.fillRect(X+pad,Y,body,pad);
    }

    const CX=X+cs/2, CY=Y+cs/2;
    if (MAP.shops.has(`${rx},${ry}`)){
      mapCtx.save();
      mapCtx.translate(CX,CY); mapCtx.rotate(Math.PI/4);
      mapCtx.fillStyle='#dfe6ee';
      mapCtx.fillRect(-cs*0.19,-cs*0.19,cs*0.38,cs*0.38);
      mapCtx.restore();
    }
    if (MAP.traps.has(`${rx},${ry}`)){
      mapCtx.strokeStyle='#7ce0ff'; mapCtx.lineWidth=Math.max(1.5,cs*0.09);
      mapCtx.beginPath(); mapCtx.arc(CX,CY,cs*0.2,0,TAU); mapCtx.stroke();
      mapCtx.fillStyle='#7ce0ff';
      mapCtx.beginPath(); mapCtx.arc(CX,CY,cs*0.07,0,TAU); mapCtx.fill();
    }
    const it=MAP.items.get(`${rx},${ry}`);
    if (it){
      if (it.type==='star') mapStar(mapCtx,CX,CY,cs*0.24,'#ffd451');
      else if (it.type==='coin'){
        mapCtx.fillStyle='#5fc98a';
        mapCtx.beginPath(); mapCtx.arc(CX,CY,cs*0.19,0,TAU); mapCtx.fill();
      } else if (it.type==='grenade'){
        mapCtx.fillStyle='#2f3338';
        mapCtx.beginPath(); mapCtx.arc(CX,CY,cs*0.19,0,TAU); mapCtx.fill();
        mapCtx.strokeStyle='#9aa1ab'; mapCtx.lineWidth=1.5; mapCtx.stroke();
      } else if (it.type==='apple'){
        mapCtx.fillStyle='#ff8b77';
        mapCtx.beginPath(); mapCtx.arc(CX,CY,cs*0.2,0,TAU); mapCtx.fill();
      } else if (it.type==='key'){
        mapCtx.fillStyle=KEY_DEFS[it.color].color;
        mapCtx.fillRect(CX-cs*0.2,CY-cs*0.2,cs*0.4,cs*0.4);
      }
    }
    if (rx===MAP.exit.x&&ry===MAP.exit.y){
      mapCtx.fillStyle='#7ee06a';
      mapCtx.fillRect(X+cs*0.28,Y+cs*0.28,cs*0.44,cs*0.44);
    }
  }

  // монстры: обычные — если рядом (как на экране) и комната видна;
  // Босса отмечаем всегда в пределах карты, чтобы не «терять» его.
  for (const m of monsters){
    const dx=m.room.x-player.x, dy=m.room.y-player.y;
    const cheb=Math.max(Math.abs(dx),Math.abs(dy));
    if (m.cfg.boss){
      if (cheb>3) continue;   // как и на экране: за 3 комнатами Босс не виден
      const X=px(dx)+cs/2, Y=py(dy)+cs/2;
      mapCtx.save();
      mapCtx.fillStyle='#b0172f';
      mapCtx.beginPath();
      mapCtx.arc(X,Y,cs*0.42,0,TAU); mapCtx.fill();
      mapCtx.fillStyle='#ff9fb0';
      mapCtx.beginPath();
      mapCtx.arc(X,Y,cs*0.2,0,TAU); mapCtx.fill();
      mapCtx.fillStyle='#3a0a12'; mapCtx.font='bold '+(cs*0.4)+'px sans-serif';
      mapCtx.textAlign='center'; mapCtx.textBaseline='middle';
      mapCtx.fillText('Б',X,Y+cs*0.05);
      mapCtx.restore();
      continue;
    }
    if (cheb>3) continue;   // та же зона, что рисуется на игровом экране
    mapCtx.fillStyle='#d84a4a';
    mapCtx.beginPath();
    mapCtx.arc(px(dx)+cs/2,py(dy)+cs/2,cs*0.2,0,TAU);
    mapCtx.fill();
  }

  mapCtx.fillStyle='#fff';
  mapCtx.beginPath();
  mapCtx.arc(px(0)+cs/2,py(0)+cs/2,cs*0.24,0,TAU);
  mapCtx.fill();
}

/** Полная карта — прежний серый вариант. */
function drawFullMap(){
  const cs=Math.max(2,Math.floor(MAP_PX/MAP.w));
  const ox=Math.floor((MAP_PX-cs*MAP.w)/2), oy=Math.floor((MAP_PX-cs*MAP.h)/2);
  const inset=cs>=6?1:0;

  mapCtx.globalAlpha=0.35;
  for (let z=0;z<MAP.NZ;z++){
    const b=MAP.bounds[z];
    mapCtx.strokeStyle='#1c2430'; mapCtx.lineWidth=1;
    mapCtx.strokeRect(ox+(MAP.cx-b)*cs, oy+(MAP.cy-b)*cs, (2*b+1)*cs, (2*b+1)*cs);
  }
  mapCtx.globalAlpha=1;

  for (let y=0;y<MAP.h;y++) for (let x=0;x<MAP.w;x++){
    const st=cellState(x,y);
    if (st==='fog') continue;
    const px=ox+x*cs, py=oy+y*cs;
    if (st==='visited'){
      const onSol=showSolution()&&MAP.solutionSet.has(`${x},${y}`);
      mapCtx.fillStyle=onSol?'#5b8a52':'#4d5b6e';
    } else mapCtx.fillStyle='#242c37';
    mapCtx.fillRect(px+inset,py+inset,cs-inset*2,cs-inset*2);

    if (inset && st==='visited'){
      mapCtx.fillStyle='#4d5b6e';
      for (const d of ['E','S']){
        if (MAP.rooms[y][x][d]==='wall') continue;
        const nx=x+DIR[d].dx, ny=y+DIR[d].dy;
        if (!inBounds(nx,ny)||cellState(nx,ny)==='fog') continue;
        if (d==='E') mapCtx.fillRect(px+cs-inset,py+inset,inset*2,cs-inset*2);
        else         mapCtx.fillRect(px+inset,py+cs-inset,cs-inset*2,inset*2);
      }
    }
  }

  // ориентиры
  if (cs>=5){
    for (const k of MAP.shops){
      const [x,y]=k.split(',').map(Number);
      if (cellState(x,y)==='fog') continue;
      mapCtx.fillStyle='#dfe6ee';
      mapCtx.fillRect(ox+x*cs+inset,oy+y*cs+inset,cs-inset*2,cs-inset*2);
    }
    for (const k of MAP.traps){
      const [x,y]=k.split(',').map(Number);
      if (cellState(x,y)==='fog') continue;
      mapCtx.fillStyle='#7ce0ff';
      mapCtx.fillRect(ox+x*cs+inset,oy+y*cs+inset,cs-inset*2,cs-inset*2);
    }
    for (const [k,it] of MAP.items){
      const [x,y]=k.split(',').map(Number);
      if (cellState(x,y)==='fog') continue;
      const CX=ox+x*cs+cs/2, CY=oy+y*cs+cs/2;
      if (it.type==='key'){
        mapCtx.fillStyle=KEY_DEFS[it.color].color;
        mapCtx.fillRect(ox+x*cs+inset,oy+y*cs+inset,cs-inset*2,cs-inset*2);
      } else if (it.type==='star'){
        mapCtx.fillStyle='#ffd451';
        mapCtx.beginPath(); mapCtx.arc(CX,CY,Math.max(1.4,cs*0.26),0,TAU); mapCtx.fill();
      } else if (it.type==='coin'){
        mapCtx.fillStyle='#5fc98a';
        mapCtx.beginPath(); mapCtx.arc(CX,CY,Math.max(1.2,cs*0.22),0,TAU); mapCtx.fill();
      } else if (it.type==='apple'){
        mapCtx.fillStyle='#ff8b77';
        mapCtx.beginPath(); mapCtx.arc(CX,CY,Math.max(1.2,cs*0.2),0,TAU); mapCtx.fill();
      }
    }
    for (const [dk,ci] of MAP.locks){
      const p=parseDoorKey(dk);
      if (cellState(p.x,p.y)==='fog') continue;
      mapCtx.fillStyle=KEY_DEFS[ci].color;
      const px=ox+p.x*cs, py=oy+p.y*cs;
      if (p.dir==='E') mapCtx.fillRect(px+cs-inset,py+inset,inset*2+1,cs-inset*2);
      else             mapCtx.fillRect(px+inset,py+cs-inset,cs-inset*2,inset*2+1);
    }
  }

  if (showSolution()||hintExit||cellState(MAP.exit.x,MAP.exit.y)!=='fog'){
    mapCtx.fillStyle='#7ee06a';
    mapCtx.fillRect(ox+MAP.exit.x*cs-1,oy+MAP.exit.y*cs-1,cs+2,cs+2);
  }

  for (const m of monsters){
    if (!m.cfg.boss) continue;
    const cx=ox+m.room.x*cs+cs/2, cy=oy+m.room.y*cs+cs/2;
    const r=Math.max(4,cs*0.8);
    mapCtx.save();
    mapCtx.globalAlpha=0.9;
    mapCtx.fillStyle='#8e0e24';
    mapCtx.beginPath();
    mapCtx.moveTo(cx,cy-r);
    mapCtx.lineTo(cx+r*0.7,cy-r*0.2);
    mapCtx.lineTo(cx+r*0.45,cy+r);
    mapCtx.lineTo(cx-r*0.45,cy+r);
    mapCtx.lineTo(cx-r*0.7,cy-r*0.2);
    mapCtx.closePath(); mapCtx.fill();
    mapCtx.fillStyle='#ffd7de';
    mapCtx.font='bold '+(cs*0.8)+'px sans-serif';
    mapCtx.textAlign='center'; mapCtx.textBaseline='middle';
    mapCtx.fillText('Б',cx,cy+cs*0.1);
    mapCtx.restore();
  }

  mapCtx.strokeStyle='rgba(255,255,255,0.22)'; mapCtx.lineWidth=1;
  mapCtx.strokeRect(ox+(player.x-8)*cs,oy+(player.y-8)*cs,17*cs,17*cs);

  mapCtx.fillStyle='#fff';
  mapCtx.beginPath();
  mapCtx.arc(ox+player.x*cs+cs/2,oy+player.y*cs+cs/2,Math.max(2,cs*0.55),0,TAU);
  mapCtx.fill();
}
