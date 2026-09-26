'use strict';

// ============================================================
// ОТРИСОВКА КОМНАТ (новый дизайн):
//   выход, геометрия стен/дверей, кладка, колонны,
//   створки дверей с цветными замками, факелы, туман, зерно
// ============================================================

function drawExitGate(r,time){
  const d=MAP.exitDir, pulse=0.55+0.45*Math.sin(time*3);
  const cx=r.l+ROOM_SIZE/2, cy=r.t+ROOM_SIZE/2;
  let gx=cx,gy=cy;
  if (d==='N') gy=r.t; else if (d==='S') gy=r.t+ROOM_SIZE;
  else if (d==='W') gx=r.l; else gx=r.l+ROOM_SIZE;
  ctx.save();
  const g=ctx.createRadialGradient(gx,gy,4,gx,gy,ROOM_SIZE*0.7);
  g.addColorStop(0,`rgba(140,255,140,${0.55*pulse})`);
  g.addColorStop(0.5,`rgba(90,220,110,${0.18*pulse})`);
  g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(gx,gy,ROOM_SIZE*0.7,0,TAU); ctx.fill();
  ctx.strokeStyle=`rgba(170,255,170,${0.8*pulse})`; ctx.lineWidth=7; ctx.lineCap='round';
  ctx.beginPath();
  if (d==='N'||d==='S'){ ctx.moveTo(gx-DOOR_WIDTH/2,gy); ctx.lineTo(gx+DOOR_WIDTH/2,gy); }
  else { ctx.moveTo(gx,gy-DOOR_WIDTH/2); ctx.lineTo(gx,gy+DOOR_WIDTH/2); }
  ctx.stroke();
  ctx.fillStyle='rgba(190,255,190,0.9)'; ctx.font='bold 15px sans-serif'; ctx.textAlign='center';
  ctx.fillText('ВЫХОД',cx,cy+5);
  ctx.restore();
}

// ============================================================
// ГЕОМЕТРИЯ: стены и двери, общие для двух комнат, собираются
// в Map и рисуются ОДИН раз — иначе двойные тени и наложения.
// ============================================================
function sideSegment(x0,y0,side){
  switch(side){
    case 'N': return [x0,y0,x0+ROOM_SIZE,y0];
    case 'S': return [x0,y0+ROOM_SIZE,x0+ROOM_SIZE,y0+ROOM_SIZE];
    case 'E': return [x0+ROOM_SIZE,y0,x0+ROOM_SIZE,y0+ROOM_SIZE];
    case 'W': return [x0,y0,x0,y0+ROOM_SIZE];
  }
}
function openingPoints(ax,ay,bx,by){
  const mx=(ax+bx)/2,my=(ay+by)/2,len=Math.hypot(bx-ax,by-ay),ux=(bx-ax)/len,uy=(by-ay)/len;
  return {p1x:mx-ux*DOOR_WIDTH/2, p1y:my-uy*DOOR_WIDTH/2, p2x:mx+ux*DOOR_WIDTH/2, p2y:my+uy*DOOR_WIDTH/2};
}
function addWallSeg(map,ax,ay,bx,by,alpha,theme){
  const key=[ax,ay,bx,by].map(Math.round).join(',');
  const ex=map.get(key);
  if(!ex) map.set(key,{ax,ay,bx,by,alpha,theme});
  else if(alpha>ex.alpha){ ex.alpha=alpha; ex.theme=theme; }   // из двух комнат берём более светлую
}
function collectRoomGeometry(r,walls,doors,corners){
  const x0=r.l, y0=r.t, alpha=r.alpha, theme=r.theme;
  for (const side of DIRS){
    const dt=sideType(r.rx,r.ry,side);
    const [ax,ay,bx,by]=sideSegment(x0,y0,side);
    if (dt==='wall'){ addWallSeg(walls,ax,ay,bx,by,alpha,theme); continue; }
    const op=openingPoints(ax,ay,bx,by);
    addWallSeg(walls,ax,ay,op.p1x,op.p1y,alpha,theme);
    addWallSeg(walls,op.p2x,op.p2y,bx,by,alpha,theme);
    const key=doorKey(r.rx,r.ry,side);
    if(!doors.has(key)) doors.set(key,{key,doorType:dt,alpha,theme,...op});
    else if(alpha>doors.get(key).alpha){ const d=doors.get(key); d.alpha=alpha; d.theme=theme; }
  }
  for (const [x,y] of [[x0,y0],[x0+ROOM_SIZE,y0],[x0,y0+ROOM_SIZE],[x0+ROOM_SIZE,y0+ROOM_SIZE]]){
    const key=Math.round(x)+','+Math.round(y);
    const ex=corners.get(key);
    if(!ex) corners.set(key,{x,y,alpha,theme});
    else if(alpha>ex.alpha){ ex.alpha=alpha; ex.theme=theme; }
  }
}

// ============================================================
// СТЕНЫ, КОЛОННЫ, ПОРОГИ, КОСЯКИ
// ============================================================
function drawWallBand({ax,ay,bx,by,alpha,theme}){
  const horiz=Math.abs(ay-by)<0.5, half=WALL_T/2;
  const x=Math.min(ax,bx)-(horiz?0:half), y=Math.min(ay,by)-(horiz?half:0);
  const w=horiz?Math.abs(bx-ax):WALL_T, h=horiz?WALL_T:Math.abs(by-ay);
  if(w<1||h<1)return;
  const [wh,ws,wl]=theme.wall;
  ctx.save(); ctx.globalAlpha=alpha;
  ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(x+4,y+4,w,h);            // тень на пол
  ctx.fillStyle=hsl(wh,ws,wl); ctx.fillRect(x,y,w,h);                      // тело стены
  ctx.strokeStyle=hsl(wh,ws,Math.max(4,wl-13)); ctx.lineWidth=1;           // швы кладки
  const block=36, len=horiz?w:h;
  if(horiz)line(ctx,x,y+half,x+w,y+half); else line(ctx,x+half,y,x+half,y+h);
  for(let d=block/2;d<len;d+=block/2){
    const row=Math.round(d/(block/2))%2;
    if(horiz){ row?line(ctx,x+d,y,x+d,y+half):line(ctx,x+d,y+half,x+d,y+h); }
    else{ row?line(ctx,x,y+d,x+half,y+d):line(ctx,x+half,y+d,x+w,y+d); }
  }
  ctx.lineWidth=2;
  ctx.strokeStyle=hsl(wh,ws,Math.min(90,wl+16),0.9);                       // блик
  if(horiz)line(ctx,x,y+1,x+w,y+1); else line(ctx,x+1,y,x+1,y+h);
  ctx.strokeStyle='rgba(0,0,0,0.55)';                                      // тёмная грань
  if(horiz)line(ctx,x,y+h-1,x+w,y+h-1); else line(ctx,x+w-1,y,x+w-1,y+h);
  ctx.restore();
}
function drawPillar({x,y,alpha,theme}){
  const p=PILLAR, hp=p/2, [wh,ws,wl]=theme.wall;
  ctx.save(); ctx.globalAlpha=alpha;
  ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(x-hp+5,y-hp+5,p,p);
  ctx.fillStyle=hsl(wh,ws,wl+6); ctx.fillRect(x-hp,y-hp,p,p);
  ctx.fillStyle=hsl(wh,ws,wl+14); ctx.fillRect(x-hp+5,y-hp+5,p-10,p-10);
  ctx.strokeStyle='rgba(0,0,0,0.6)'; ctx.lineWidth=1.5; ctx.strokeRect(x-hp,y-hp,p,p);
  ctx.restore();
}
function drawThreshold(d){
  const horiz=Math.abs(d.p1y-d.p2y)<0.5, mx=(d.p1x+d.p2x)/2, my=(d.p1y+d.p2y)/2;
  const w=horiz?DOOR_WIDTH:WALL_T+2, h=horiz?WALL_T+2:DOOR_WIDTH, [fh,fs]=d.theme.floor;
  ctx.save(); ctx.globalAlpha=d.alpha;
  ctx.fillStyle=hsl(fh,fs,Math.max(6,d.theme.floorL-14)); ctx.fillRect(mx-w/2,my-h/2,w,h);
  ctx.restore();
}
function drawJamb(x,y,theme){
  const p=WALL_T+8, hp=p/2, [wh,ws,wl]=theme.wall;
  ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(x-hp+4,y-hp+4,p,p);
  ctx.fillStyle=hsl(wh,ws,wl+10); ctx.fillRect(x-hp,y-hp,p,p);
  ctx.strokeStyle='rgba(0,0,0,0.6)'; ctx.lineWidth=1.5; ctx.strokeRect(x-hp,y-hp,p,p);
}

// ============================================================
// СТВОРКА ДВЕРИ
//   Угол берётся из doorAnims (механика открывания НЕ тронута).
//   Запертая дверь красится в цвет своего ключа (KEY_DEFS).
// ============================================================
function drawDoorLeaf(key,time){
  const d=doorMeta.get(key);
  if(!d) return;
  const a=doorAnims.get(key);
  const angle=a?Math.abs(a.angle):0;
  const swing=a?(Math.sign(a.angle)||1):1;

  const {p1x:px,p1y:py,p2x,p2y,theme,alpha}=d;
  const base=Math.atan2(p2y-py,p2x-px), rad=angle*Math.PI/180*swing;
  const lock=lockColorOf(key);                 // {color,dark} или null
  const locked=!!lock;

  ctx.save(); ctx.globalAlpha=alpha;
  drawJamb(px,py,theme); drawJamb(p2x,p2y,theme);

  if(angle>0){                                  // пунктирная дуга открывания
    ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=2; ctx.setLineDash([4,6]);
    ctx.beginPath(); ctx.arc(px,py,DOOR_WIDTH-14,base,base+rad,swing<0); ctx.stroke(); ctx.setLineDash([]);
  }

  ctx.translate(px,py); ctx.rotate(base+rad);
  const x1=6, L=DOOR_WIDTH-14, T=10;
  ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(x1+2,-T/2+3,L,T);                   // тень
  ctx.fillStyle= locked ? lock.dark : '#8b5a2b';                                     // доски
  ctx.fillRect(x1,-T/2,L,T);
  ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=1;
  for(let i=1;i<4;i++)line(ctx,x1+i*L/4,-T/2,x1+i*L/4,T/2);
  ctx.strokeStyle='rgba(255,220,160,0.25)'; line(ctx,x1,-T/2+1,x1+L,-T/2+1);         // блик
  ctx.fillStyle= locked ? lock.color : '#3a3a3a';                                    // оковка цветом ключа
  ctx.fillRect(x1+L*0.12,-T/2-1,6,T+2); ctx.fillRect(x1+L*0.8,-T/2-1,6,T+2);
  ctx.fillStyle='#d9b05a'; ctx.beginPath(); ctx.arc(x1+L-12,0,3,0,TAU); ctx.fill();   // ручка
  ctx.strokeStyle='rgba(0,0,0,0.7)'; ctx.lineWidth=1.5; ctx.strokeRect(x1,-T/2,L,T);
  ctx.restore();

  ctx.save(); ctx.globalAlpha=alpha;
  ctx.fillStyle='#1a1a1a'; ctx.beginPath(); ctx.arc(px,py,3.5,0,TAU); ctx.fill();     // петля
  if(locked&&angle===0) drawPadlock((px+p2x)/2,(py+p2y)/2,lock,time);
  ctx.restore();
}

// Замок в цвет ключа: сиреневый / бирюзовый / малиновый
function drawPadlock(x,y,lock,time){
  const pulse=0.5+0.5*Math.sin((time||0)*2.4);
  ctx.save(); ctx.translate(x,y);
  ctx.shadowColor=lock.color; ctx.shadowBlur=6+5*pulse;
  ctx.strokeStyle=lock.color; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.arc(0,-3,4.5,Math.PI,0); ctx.stroke();       // дужка
  ctx.shadowBlur=0;
  ctx.fillStyle=lock.dark; ctx.fillRect(-6,-3,12,10);               // корпус
  ctx.strokeStyle=lock.color; ctx.lineWidth=1; ctx.strokeRect(-6,-3,12,10);
  ctx.fillStyle=lock.color; ctx.beginPath(); ctx.arc(0,1.5,1.6,0,TAU); ctx.fill();
  ctx.restore();
}

function drawUnlockAnim(time){
  const p=clamp(unlocking.t/T_UNLOCK,0,1);
  const kd=KEY_DEFS[unlocking.color];
  const g=doorGeom(unlocking.key);
  const X=sx(g.mx), Y=sy(g.my);
  ctx.save();
  ctx.globalAlpha=1-p*0.25;
  ctx.strokeStyle=kd.color; ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(X,Y,16+p*26,0,TAU*p); ctx.stroke();
  ctx.fillStyle=kd.color;
  ctx.beginPath(); ctx.arc(X,Y,5,0,TAU); ctx.fill();
  ctx.restore();
}

// ============================================================
// ФАКЕЛЫ НА СТЕНАХ
// ============================================================
function drawTorches(r,time){
  const now=time*1000;
  for (const t of getTorches(r.rx,r.ry)){
    const [ax,ay,bx,by]=sideSegment(r.l,r.t,t.side);
    const x=ax+(bx-ax)*t.t, y=ay+(by-ay)*t.t;
    const fl=0.85+0.15*Math.sin(now*0.012+t.ph)+0.07*Math.sin(now*0.031+t.ph*3);
    const near=(r.rx===player.x&&r.ry===player.y);
    ctx.save();
    ctx.globalAlpha=r.alpha*(near?1:LIGHT.torchA);
    ctx.fillStyle='#2a2a2a'; ctx.fillRect(x-3,y-3,6,6);               // кронштейн
    ctx.globalCompositeOperation='lighter';
    const g=ctx.createRadialGradient(x,y,2,x,y,110*fl);
    g.addColorStop(0,'rgba(255,170,60,0.55)');
    g.addColorStop(0.4,'rgba(255,120,30,0.18)');
    g.addColorStop(1,'rgba(255,100,0,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,110*fl,0,TAU); ctx.fill();
    ctx.globalCompositeOperation='source-over';
    ctx.fillStyle='#ffd070'; ctx.beginPath(); ctx.arc(x,y,4*fl,0,TAU); ctx.fill();
    ctx.fillStyle='#fff6d0'; ctx.beginPath(); ctx.arc(x,y,1.8,0,TAU); ctx.fill();
    ctx.restore();
  }
}

// Откуда исходит свет игрока — из факела в руке, а не из центра фигурки
const PLAYER_SCALE=1.25;                 // масштаб фигурки путника
function torchPos(time){
  const now=time*1000, cx=CANVAS_SIZE/2, cy=CANVAS_SIZE/2;
  let fl=0.9+0.1*Math.sin(now*0.02)+0.06*Math.sin(now*0.047);
  if (inv.stars<=0) fl*=0.55+0.1*Math.sin(now*0.05);   // без звёзд факел тлеет
  const hand=facing==='W'?-1:1;
  return {x:cx+hand*13*PLAYER_SCALE, y:cy-6*PLAYER_SCALE, fl, hand};
}

// Тёплое пятно вокруг игрока
function drawPlayerLight(time){
  const {x,y,fl}=torchPos(time);
  const alive=!gameOver;
  ctx.save(); ctx.globalCompositeOperation='lighter';
  const R=230*fl*(alive?1:0.55);
  const g=ctx.createRadialGradient(x,y,10,x,y,R);
  g.addColorStop(0,`rgba(255,220,160,${LIGHT.playerA*(alive?1:0.3)})`);
  g.addColorStop(1,'rgba(255,200,120,0)');
  ctx.fillStyle=g; ctx.fillRect(x-R,y-R,R*2,R*2);
  ctx.restore();
}

// Путник в плаще с факелом — фигурка игрока
function drawPlayerFigure(time){
  const now=time*1000, cx=CANVAS_SIZE/2, cy=CANVAS_SIZE/2, k=PLAYER_SCALE;
  const {fl,hand}=torchPos(time);
  const bob=Math.sin(now*0.004)*0.6;                   // лёгкое «дыхание»
  const CLOAK=inv.stars>0?'#4a5d7a':'#6b3a3a', OUT='#0e1218';
  ctx.save();
  ctx.translate(cx,cy); ctx.scale(k,k);
  ctx.fillStyle='rgba(0,0,0,0.45)';                    // тень
  ctx.beginPath(); ctx.ellipse(2,14,13,5,0,0,TAU); ctx.fill();
  ctx.fillStyle=CLOAK; ctx.strokeStyle=OUT; ctx.lineWidth=2; ctx.lineJoin='round';
  ctx.beginPath();                                     // плащ
  ctx.moveTo(-8,-2+bob); ctx.quadraticCurveTo(-13,12,-11,13);
  ctx.lineTo(11,13); ctx.quadraticCurveTo(13,12,8,-2+bob);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=1.5; line(ctx,0,2,0,12);
  ctx.strokeStyle='#5a3a1e'; ctx.lineWidth=3; ctx.lineCap='round';   // рукоять факела
  line(ctx,hand*7,4,hand*13,-3);
  ctx.fillStyle=CLOAK; ctx.strokeStyle=OUT; ctx.lineWidth=2;         // капюшон
  ctx.beginPath(); ctx.arc(0,-8+bob,8,0,TAU); ctx.fill(); ctx.stroke();
  if (facing!=='N'){                                   // лицо (на север виден затылок)
    const fx=facing==='E'?2:facing==='W'?-2:0;
    ctx.fillStyle='#e8cfa8';
    ctx.beginPath(); ctx.ellipse(fx,-6+bob,4.5,4,0,0,TAU); ctx.fill();
    ctx.fillStyle='#1a1a1a';
    if (facing==='S'){ ctx.fillRect(fx-2.5,-7+bob,1.5,2); ctx.fillRect(fx+1,-7+bob,1.5,2); }
    else ctx.fillRect(fx+hand*1.5-0.75,-7+bob,1.5,2);
  }
  const tx=hand*13, ty=-6;                             // пламя факела
  ctx.globalCompositeOperation='lighter';
  const g=ctx.createRadialGradient(tx,ty,1,tx,ty,14*fl);
  g.addColorStop(0,'rgba(255,190,90,0.7)'); g.addColorStop(1,'rgba(255,120,30,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(tx,ty,14*fl,0,TAU); ctx.fill();
  ctx.globalCompositeOperation='source-over';
  ctx.fillStyle='#ff9a2e'; ctx.beginPath(); ctx.ellipse(tx,ty-1,3.2,4.5*fl,0,0,TAU); ctx.fill();
  ctx.fillStyle='#fff1b0'; ctx.beginPath(); ctx.ellipse(tx,ty,1.6,2.6*fl,0,0,TAU); ctx.fill();
  ctx.restore();
  if (inv.stars>0){                                    // кольцо-оберег от звёзд
    ctx.save();
    ctx.strokeStyle=`rgba(255,212,81,${0.28+0.15*Math.sin(time*2.5)})`;
    ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(cx,cy,17,0,TAU); ctx.stroke();
    ctx.restore();
  }
}

// Радиальный туман — параметры из LIGHT (зависят от зоны)
function drawFog(){
  const c=CANVAS_SIZE/2;
  const g=ctx.createRadialGradient(c,c,ROOM_SIZE*LIGHT.inner,c,c,CANVAS_SIZE*0.7);
  g.addColorStop(0,'rgba(4,4,12,0)');
  g.addColorStop(clamp(LIGHT.mid,0.01,0.99),`rgba(4,4,12,${LIGHT.midA})`);
  g.addColorStop(1,`rgba(4,4,12,${LIGHT.outerA})`);
  ctx.fillStyle=g; ctx.fillRect(0,0,CANVAS_SIZE,CANVAS_SIZE);
}

// Плёночное зерно
let grainPattern=null;
function drawGrain(){
  if(!grainPattern){
    const g=document.createElement('canvas'); g.width=g.height=256;
    const c=g.getContext('2d');
    const img=c.createImageData(256,256);
    for(let i=0;i<img.data.length;i+=4){
      const v=Math.random()*255|0;
      img.data[i]=img.data[i+1]=img.data[i+2]=v; img.data[i+3]=255;
    }
    c.putImageData(img,0,0);
    grainPattern=ctx.createPattern(g,'repeat');
    if(!grainPattern) return;
  }
  ctx.save();
  ctx.globalAlpha=LIGHT.grain; ctx.globalCompositeOperation='overlay';
  ctx.fillStyle=grainPattern; ctx.fillRect(0,0,CANVAS_SIZE,CANVAS_SIZE);
  ctx.restore();
}

// Оставлено для совместимости
function strokeLine(ax,ay,bx,by,color,w,alpha){
  ctx.save(); ctx.globalAlpha=alpha;
  ctx.strokeStyle=color; ctx.lineWidth=w; ctx.lineCap='butt';
  ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
  ctx.restore();
}
