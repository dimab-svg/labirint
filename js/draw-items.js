'use strict';

// ============================================================
// ОТРИСОВКА ПРЕДМЕТОВ И ОСОБЫХ ПОЛОВ (звезда, деньги, яблоко, граната, ключ, аномалия)
// ============================================================

function drawStar(cx,cy,R,alpha,time){
  const rot=time*0.5, pulse=0.85+0.15*Math.sin(time*3);
  ctx.save(); ctx.globalAlpha=alpha;
  const g=ctx.createRadialGradient(cx,cy,2,cx,cy,R*2.6);
  g.addColorStop(0,`rgba(255,220,110,${0.45*pulse})`);
  g.addColorStop(1,'rgba(255,200,60,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,R*2.6,0,TAU); ctx.fill();
  ctx.translate(cx,cy); ctx.rotate(rot);
  ctx.beginPath();
  for (let i=0;i<10;i++){
    const a=(i/10)*TAU-Math.PI/2, rr=(i%2===0)?R:R*0.44;
    const x=Math.cos(a)*rr, y=Math.sin(a)*rr;
    if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.closePath();
  ctx.fillStyle='#ffd451'; ctx.fill();
  ctx.strokeStyle='#a8761a'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.restore();
}

function drawMoney(cx,cy,alpha,time,value){
  const bob=Math.sin(time*2.2)*1.5;
  ctx.save(); ctx.globalAlpha=alpha;
  ctx.translate(cx,cy+bob);
  const g=ctx.createRadialGradient(0,0,2,0,0,30);
  g.addColorStop(0,'rgba(95,201,138,0.35)');
  g.addColorStop(1,'rgba(95,201,138,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,30,0,TAU); ctx.fill();
  // пачка купюр
  for (let i=2;i>=0;i--){
    ctx.save();
    ctx.translate(i*1.6-1.6, i*1.6-1.6);
    ctx.rotate((i-1)*0.06);
    ctx.fillStyle= i===0 ? '#57b57c' : '#3f8e60';
    ctx.fillRect(-15,-9,30,18);
    ctx.strokeStyle='#28603f'; ctx.lineWidth=1; ctx.strokeRect(-15,-9,30,18);
    ctx.restore();
  }
  ctx.fillStyle='#d8f5e4'; ctx.font='bold 12px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('₥', 0, 0);
  if (value>=4){
    ctx.fillStyle='#bfe9cf'; ctx.font='bold 9px sans-serif';
    ctx.fillText('×'+value, 0, 15);
  }
  ctx.restore();
}

function drawAppleItem(cx,cy,alpha,time){
  const bob=Math.sin(time*2.6)*1.5;
  ctx.save(); ctx.globalAlpha=alpha;
  ctx.translate(cx,cy+bob);
  const g=ctx.createRadialGradient(0,0,2,0,0,26);
  g.addColorStop(0,'rgba(255,120,95,0.3)');
  g.addColorStop(1,'rgba(255,120,95,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,26,0,TAU); ctx.fill();
  // яблоко
  ctx.fillStyle='rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(1,6,10,3,0,0,TAU); ctx.fill();
  ctx.fillStyle='#ff5a42';
  ctx.beginPath(); ctx.ellipse(-2,1,8.5,10,0.4,0,TAU); ctx.fill();
  ctx.fillStyle='#ff8570';
  ctx.beginPath(); ctx.ellipse(2,-2,4,3.2,0.3,0,TAU); ctx.fill();
  // хвостик и лист
  ctx.strokeStyle='#6b4423'; ctx.lineWidth=2; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-1,-8); ctx.quadraticCurveTo(1,-12,5,-11); ctx.stroke();
  ctx.fillStyle='#6fbf4d';
  ctx.beginPath(); ctx.ellipse(6,-10,5,2.4,-0.5,0,TAU); ctx.fill();
  ctx.restore();
}

function drawGrenadeIcon(cx,cy,alpha,time){
  ctx.save(); ctx.globalAlpha=alpha;
  ctx.translate(cx,cy+Math.sin(time*2)*1.2);
  ctx.fillStyle='rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(2,10,11,4,0,0,TAU); ctx.fill();
  ctx.fillStyle='#33383f';
  ctx.beginPath(); ctx.arc(0,0,11,0,TAU); ctx.fill();
  ctx.strokeStyle='#5c636d'; ctx.lineWidth=1.5;
  for (let i=-1;i<=1;i++){
    ctx.beginPath(); ctx.moveTo(-9,i*6); ctx.lineTo(9,i*6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i*6,-9); ctx.lineTo(i*6,9); ctx.stroke();
  }
  ctx.fillStyle='#6b6f78'; ctx.fillRect(-3,-15,6,5);
  ctx.strokeStyle='#8a909a'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(6,-14,4,Math.PI*0.6,Math.PI*2); ctx.stroke();
  ctx.restore();
}

function drawKeyItem(cx,cy,alpha,time,colorId){
  const kd=KEY_DEFS[colorId];
  const rot=Math.sin(time*1.5)*0.25;
  ctx.save(); ctx.globalAlpha=alpha;
  const g=ctx.createRadialGradient(cx,cy,2,cx,cy,34);
  g.addColorStop(0,kd.color+'66');
  g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,34,0,TAU); ctx.fill();
  ctx.translate(cx,cy); ctx.rotate(rot);
  ctx.strokeStyle=kd.color; ctx.fillStyle=kd.color;
  ctx.lineWidth=3.5; ctx.lineCap='round';
  ctx.beginPath(); ctx.arc(-6,0,6,0,TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(14,0); ctx.stroke();
  ctx.fillRect(9,-1,2.5,7);
  ctx.fillRect(13,-1,2.5,5);
  ctx.restore();
}

// ------------------------------------------------------------
// АНОМАЛИЯ — «электрощитовая»: 4 громоотвода по углам + центральный диск.
// ВАЖНО: в исходном демо координаты были рассчитаны на комнату 400px,
// поэтому всё съезжало вниз-вправо. Здесь все точки заданы ДОЛЯМИ
// от ROOM_SIZE, поэтому раскладка центрируется при любом размере комнаты.
// ------------------------------------------------------------
const ANOM_K=ROOM_SIZE/400;                     // коэффициент пересчёта из демо-масштаба
const ANOM_NODES=[[110,110],[290,110],[110,290],[290,290],[200,200]]
  .map(([x,y])=>[x*ANOM_K,y*ANOM_K]);           // 4 громоотвода + центр
const ANOM_C=200*ANOM_K;                        // центр комнаты
let anomalyOverlay=null;

function getAnomalyOverlay(){
  if (anomalyOverlay) return anomalyOverlay;
  const S=ROOM_SIZE;
  const off=document.createElement('canvas'); off.width=off.height=S;
  const c=off.getContext('2d');
  const rng=mulberry32(0x0A0BADF0);
  for (let i=0;i<16;i++){                       // выжженные пятна на полу
    const x=rng()*S, y=rng()*S, rad=(25+rng()*60)*ANOM_K;
    const g=c.createRadialGradient(x,y,0,x,y,rad);
    g.addColorStop(0,'rgba(0,0,0,0.5)'); g.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=g; c.fillRect(x-rad,y-rad,rad*2,rad*2);
  }
  c.strokeStyle='rgba(0,0,0,0.5)'; c.lineWidth=6*ANOM_K; c.lineCap='round';
  for (const [x,y] of ANOM_NODES.slice(0,4)) line(c,ANOM_C,ANOM_C,x,y);   // канавки
  // центральный диск
  c.fillStyle='#2a2d33'; c.strokeStyle='#0d0f12'; c.lineWidth=2;
  c.beginPath(); c.arc(ANOM_C,ANOM_C,44*ANOM_K,0,TAU); c.fill(); c.stroke();
  c.strokeStyle='#4a5058'; c.lineWidth=1.5;
  c.beginPath(); c.arc(ANOM_C,ANOM_C,32*ANOM_K,0,TAU); c.stroke();
  for (let i=0;i<8;i++){
    const a=i/8*TAU;
    line(c,ANOM_C+Math.cos(a)*12*ANOM_K,ANOM_C+Math.sin(a)*12*ANOM_K,
           ANOM_C+Math.cos(a)*42*ANOM_K,ANOM_C+Math.sin(a)*42*ANOM_K);
  }
  c.fillStyle='#0a0c10'; c.beginPath(); c.arc(ANOM_C,ANOM_C,8*ANOM_K,0,TAU); c.fill();
  c.fillStyle='#c47a3a'; c.beginPath(); c.arc(ANOM_C,ANOM_C,4*ANOM_K,0,TAU); c.fill();
  // громоотводы
  const hw=13*ANOM_K;
  for (const [x,y] of ANOM_NODES.slice(0,4)){
    c.fillStyle='rgba(0,0,0,0.4)'; c.fillRect(x-hw+3,y-hw+4,hw*2,hw*2);
    c.fillStyle='#33373d'; c.strokeStyle='#0d0f12'; c.lineWidth=1.5;
    c.fillRect(x-hw,y-hw,hw*2,hw*2); c.strokeRect(x-hw,y-hw,hw*2,hw*2);
    c.fillStyle='#5a6068';
    c.beginPath(); c.arc(x,y,7*ANOM_K,0,TAU); c.fill(); c.stroke();
    c.fillStyle='#c47a3a';
    c.beginPath(); c.arc(x,y,3.5*ANOM_K,0,TAU); c.fill();
  }
  anomalyOverlay=off; return off;
}

// Пол аномалии — рисуется вместе с остальными полами
function drawTrapFloor(r,time){
  const now=time*1000;
  ctx.save(); ctx.globalAlpha=r.alpha;
  ctx.drawImage(getAnomalyOverlay(),r.l,r.t);
  ctx.fillStyle=`rgba(110,160,255,${0.05+0.03*Math.sin(now*0.004)})`;   // холодная подсветка
  ctx.fillRect(r.l,r.t,ROOM_SIZE,ROOM_SIZE);
  // подпись — чтобы игрок помнил, что аномалия ему не вредит
  ctx.fillStyle='rgba(150,200,255,0.5)';
  ctx.font='bold 11px sans-serif'; ctx.textAlign='center';
  ctx.fillText('АНОМАЛИЯ', r.l+ROOM_SIZE/2, r.t+ROOM_SIZE*0.19);
  ctx.font='9px sans-serif'; ctx.fillStyle='rgba(150,200,255,0.38)';
  ctx.fillText('безопасно для вас · бьёт монстров', r.l+ROOM_SIZE/2, r.t+ROOM_SIZE*0.855);
  ctx.restore();
}

// Молнии — поверх тумана, чтобы аномалию было видно издалека
function drawAnomalyArcs(r,time){
  const now=time*1000;
  const bucket=Math.floor(now/80);
  const rng=mulberry32((bucket*7919+r.rx*131+r.ry*17)|0);
  const n=rng()<0.35?0:1+Math.floor(rng()*2);
  ctx.save();
  ctx.globalAlpha=Math.min(1,r.alpha+0.25);
  ctx.globalCompositeOperation='lighter';
  ctx.lineCap='round'; ctx.lineJoin='round';
  for (let k=0;k<n;k++){
    const a=ANOM_NODES[Math.floor(rng()*5)];
    let b=ANOM_NODES[Math.floor(rng()*5)];
    if (b===a) b=(a===ANOM_NODES[4])?ANOM_NODES[0]:ANOM_NODES[4];
    const dx=-(b[1]-a[1]), dy=b[0]-a[0], L=Math.hypot(dx,dy)||1;
    const pts=[], segs=10;
    for (let i=0;i<=segs;i++){
      const t=i/segs;
      const j=(i===0||i===segs)?0:(rng()-0.5)*40*ANOM_K;
      pts.push([r.l+a[0]+(b[0]-a[0])*t+dx/L*j, r.t+a[1]+(b[1]-a[1])*t+dy/L*j]);
    }
    for (const [col,w] of [['rgba(100,160,255,0.25)',7],['rgba(170,210,255,0.6)',2.5],['rgba(255,255,255,0.95)',1]]){
      ctx.strokeStyle=col; ctx.lineWidth=w;
      ctx.beginPath();
      pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
      ctx.stroke();
    }
    ctx.fillStyle='rgba(200,225,255,0.9)';        // искры на концах
    for (const e of [a,b]) for (let i=0;i<4;i++){
      const ang=rng()*TAU, d=(4+rng()*14)*ANOM_K;
      ctx.fillRect(r.l+e[0]+Math.cos(ang)*d, r.t+e[1]+Math.sin(ang)*d, 1.5,1.5);
    }
    ctx.fillStyle='rgba(120,170,255,0.06)';       // вспышка на всю комнату
    ctx.fillRect(r.l,r.t,ROOM_SIZE,ROOM_SIZE);
  }
  for (const [x,y] of ANOM_NODES){                // постоянное тление на кончиках
    const f=0.6+0.4*Math.sin(now*0.02+x*0.1+y*0.07), X=r.l+x, Y=r.t+y;
    const g=ctx.createRadialGradient(X,Y,0,X,Y,10*f*ANOM_K);
    g.addColorStop(0,'rgba(150,200,255,0.5)'); g.addColorStop(1,'rgba(150,200,255,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(X,Y,10*f*ANOM_K,0,TAU); ctx.fill();
  }
  ctx.restore();
}
