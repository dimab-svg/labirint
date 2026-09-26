'use strict';

// ============================================================
// ОТРИСОВКА МОНСТРОВ (Ползун, Охотник, Босс «Надзиратель»)
// ============================================================

function drawMonster(m,time){
  const px=sx(m.x),py=sy(m.y);
  if (px<-60||py<-60||px>CANVAS_SIZE+60||py>CANVAS_SIZE+60) return;
  const alpha=alphaForWorld(m.x,m.y);
  m.cfg.draw(m,px,py,alpha,time);
  const maxHp=m.maxHp||m.cfg.maxHp;
  if (m.hp>0&&m.hp<maxHp){   // полоска здоровья у раненых (у Босса — крупная)
    const w=m.cfg.boss?m.cfg.size*3.2:m.cfg.size*2.4, y=py-m.cfg.size*2.9;
    ctx.save(); ctx.globalAlpha=alpha*0.95;
    ctx.fillStyle='rgba(0,0,0,0.62)';
    ctx.fillRect(px-w/2-1,y-1,w+2,7);
    ctx.fillStyle='#5c1010'; ctx.fillRect(px-w/2,y,w,5);
    ctx.fillStyle=m.cfg.boss?'#ff5a7a':'#e04848';
    ctx.fillRect(px-w/2,y,w*(m.hp/maxHp),5);
    ctx.restore();
  }
  if (m.cfg.boss){   // имя Босса над головой
    ctx.save(); ctx.globalAlpha=alpha*(0.75+0.25*Math.sin(time*2));
    ctx.fillStyle='#ffb0c0'; ctx.font='bold 13px sans-serif'; ctx.textAlign='center';
    ctx.fillText(m.cfg.title, px, py-m.cfg.size*3.1);
    ctx.restore();
  }
  if (m.stun>0){                   // оглушён (пережил аномалию/взрыв)
    ctx.save();
    ctx.globalAlpha=alpha*(0.5+0.4*Math.sin(time*18));
    ctx.fillStyle='#ffe98a';
    ctx.font='bold 15px sans-serif'; ctx.textAlign='center';
    ctx.translate(px,py-m.cfg.size*2.3);
    ctx.rotate(Math.floor(time*6)%2?0.5:-0.5);
    ctx.fillText('✱',0,0);
    ctx.restore();
  }
  if (m.sated>0){
    ctx.save();
    ctx.globalAlpha=alpha*(0.55+0.3*Math.sin(time*2));
    ctx.fillStyle='#9fd0ff';
    ctx.font='bold 15px sans-serif'; ctx.textAlign='center';
    const ph=Math.floor(time*1.4)%2;
    ctx.fillText(ph?'z Z':'Z z', px+m.cfg.size*1.5, py-m.cfg.size*1.9);
    ctx.restore();
  }
  if (m.alert>0){
    ctx.save();
    ctx.globalAlpha=alpha*Math.min(1,m.alert*2);
    ctx.fillStyle=m.alertMark==='!'?'#ff5555':'#ffcc55';
    ctx.font='bold 20px sans-serif'; ctx.textAlign='center';
    ctx.fillText(m.alertMark,px,py-m.cfg.size*2.2);
    ctx.restore();
  }
}

// ============================================================
// ОБЩЕЕ: аура погони, тень, глаза
// ============================================================
function drawAura(m,px,py,time){
  const cfg=m.cfg,R=cfg.size,pulse=0.35+0.15*Math.sin(time*6);
  const g=ctx.createRadialGradient(px,py,R*0.5,px,py,R*3.4);
  g.addColorStop(0,cfg.auraColor+(0.30*pulse)+')');
  g.addColorStop(1,cfg.auraColor+'0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(px,py,R*3.4,0,TAU); ctx.fill();
}

// Тень плоского монстра: в повёрнутых координатах, со сдвигом вправо-вниз
function flatShadow(px,py,facing,rx,ry,ox=0){
  ctx.save(); ctx.translate(px+3,py+4); ctx.rotate(facing);
  ctx.fillStyle='rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(ox,0,rx,ry,0,0,TAU); ctx.fill();
  ctx.restore();
}

// Позиции двух глаз с учётом поворота тела
function eyeGeometry(m){
  const cfg=m.cfg,R=cfg.size,E=cfg.eyes||{x:1,y:0.25,r:0.15};
  const c=Math.cos(m.facing),s=Math.sin(m.facing),pts=[];
  for (const sg of [-1,1]){
    const lx=R*E.x, ly=sg*R*E.y;
    pts.push({x:lx*c-ly*s, y:lx*s+ly*c});
  }
  return {pts,lid:{x:c,y:s}};
}

// Глаза: в покое — свой цвет со зрачком; в погоне — горят красным.
// Спящий (сытый) и оглушённый — закрытые.
function drawMonsterEyes(m,px,py,alpha,time){
  const cfg=m.cfg,R=cfg.size,E=cfg.eyes||{x:1,y:0.25,r:0.15};
  const hot=((m.state==='chase')||cfg.eyesAlwaysHot)&&m.stun<=0&&m.sated<=0;
  const g=eyeGeometry(m);
  const er=R*E.r*(hot?1.15:1);
  const blink=!hot&&m.stun<=0&&((time+m.home.x*0.7+m.home.y*1.3)%4.2)<0.12;
  ctx.save(); ctx.globalAlpha=alpha; ctx.translate(px,py);
  if (m.stun>0||m.sated>0||blink){                      // закрытые глаза
    ctx.strokeStyle='#111'; ctx.lineWidth=1.5;
    for (const p of g.pts){
      ctx.beginPath();
      ctx.moveTo(p.x-g.lid.x*er*1.3,p.y-g.lid.y*er*1.3);
      ctx.lineTo(p.x+g.lid.x*er*1.3,p.y+g.lid.y*er*1.3);
      ctx.stroke();
    }
    ctx.restore(); return;
  }
  for (const p of g.pts){
    if (hot){                                            // горят — без ореола, чтобы читались в тумане
      ctx.fillStyle=cfg.eyeHotColor||'#ff3a2a';
      ctx.beginPath(); ctx.arc(p.x,p.y,er,0,TAU); ctx.fill();
      ctx.fillStyle='rgba(255,210,190,0.7)';
      ctx.beginPath(); ctx.arc(p.x,p.y,er*0.4,0,TAU); ctx.fill();
    } else {
      ctx.globalAlpha=alpha*0.85;
      ctx.fillStyle=cfg.eyeColor;
      ctx.beginPath(); ctx.arc(p.x,p.y,er,0,TAU); ctx.fill();
      ctx.fillStyle='#1a0a00';
      ctx.beginPath(); ctx.arc(p.x+g.lid.x*0.6,p.y+g.lid.y*0.6,er*0.45,0,TAU); ctx.fill();
    }
  }
  ctx.restore();
}

// Светящиеся глаза поверх тумана — видно в тёмных комнатах
function drawMonsterEyesOverlay(time){
  for (const m of monsters){
    if (m.stun>0||m.sated>0) continue;
    const hot=(m.state==='chase')||m.cfg.eyesAlwaysHot;
    if (!hot) continue;
    if (Math.max(Math.abs(m.room.x-player.x),Math.abs(m.room.y-player.y))>3) continue;
    const px=sx(m.x),py=sy(m.y);
    if (px<-60||py<-60||px>CANVAS_SIZE+60||py>CANVAS_SIZE+60) continue;
    drawMonsterEyes(m,px,py,1,time);
  }
}

// ============================================================
// ПОЛЗУН — паук: ноги шагают от пройденного пути, глаза горят в погоне
// ============================================================
function drawMonster1(m,px,py,alpha,time){
  const cfg=m.cfg,R=cfg.size,chasing=(m.state==='chase')&&m.stun<=0;
  if (m.sated>0) alpha*=0.55;
  ctx.save(); ctx.globalAlpha=alpha;
  if (chasing) drawAura(m,px,py,time);
  // тень — до поворота, чтобы лежала в одну сторону
  ctx.fillStyle='rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(px+2,py+4,R*1.35,R*1.1,0,0,TAU); ctx.fill();

  ctx.translate(px,py); ctx.rotate(m.facing);
  // шаг от пути; стоя на месте — чуть переминается
  const gait=m.legPhase+(m.moving>1?0:time*1.5);
  ctx.lineCap='round'; ctx.lineJoin='round';
  for (const pass of [0,1]){                 // 0 — тёмная подложка, 1 — сами ноги
    ctx.strokeStyle=pass?cfg.legColor:'rgba(0,0,0,0.45)';
    ctx.lineWidth=pass?2.6:4.6;
    for (const sgn of [-1,1]) for (let i=0;i<3;i++){
      const base=sgn*(0.75+i*0.72);
      const ph=Math.sin(gait+i*1.25+(sgn>0?Math.PI:0))*0.26;
      const a=base+ph;
      const kx=Math.cos(a)*R*1.2, ky=Math.sin(a)*R*1.2;
      const fx=Math.cos(a+sgn*0.45)*R*2.1, fy=Math.sin(a+sgn*0.45)*R*2.1;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(kx,ky); ctx.lineTo(fx,fy); ctx.stroke();
    }
  }
  // тело с контуром
  ctx.strokeStyle='#120606'; ctx.lineWidth=2; ctx.fillStyle=cfg.bodyColor;
  ctx.beginPath(); ctx.ellipse(-R*0.25,0,R*1.05,R*0.85,0,0,TAU); ctx.fill(); ctx.stroke();
  // панцирь с бликом
  ctx.fillStyle=cfg.shellColor;
  ctx.beginPath(); ctx.ellipse(-R*0.15,0,R*0.72,R*0.58,0,0,TAU); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.12)';
  ctx.beginPath(); ctx.ellipse(-R*0.3,-R*0.2,R*0.35,R*0.18,0,0,TAU); ctx.fill();
  // голова
  ctx.fillStyle=cfg.bodyColor;
  ctx.beginPath(); ctx.arc(R*0.85,0,R*0.52,0,TAU); ctx.fill(); ctx.stroke();
  // жвалы
  ctx.strokeStyle=cfg.legColor; ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(R*1.15,-R*0.28); ctx.lineTo(R*1.6,-R*0.12);
  ctx.moveTo(R*1.15, R*0.28); ctx.lineTo(R*1.6, R*0.12);
  ctx.stroke();
  ctx.restore();
  drawMonsterEyes(m,px,py,alpha,time);
}

// ============================================================
// ЯЩЕР (Охотник) — крокодилоподобный, бронированная спина, зубастая морда
// ============================================================
function drawMonster2(m,px,py,alpha,time){
  const cfg=m.cfg,R=cfg.size,chasing=(m.state==='chase')&&m.stun<=0,walking=m.moving>1;
  if (m.sated>0) alpha*=0.55;
  const ph=m.legPhase;
  const tph=walking?ph*1.1:time*1.6;          // виляние хвоста
  const tamp=walking?R*0.32:R*0.12;
  ctx.save(); ctx.globalAlpha=alpha;
  if (chasing) drawAura(m,px,py,time);
  flatShadow(px,py,m.facing,R*2.4,R*0.9,-R*0.3);
  ctx.translate(px,py); ctx.rotate(m.facing);
  ctx.lineCap='round'; ctx.lineJoin='round';

  // хвост: 7 сужающихся сегментов, волна бежит от тела к кончику
  const T=[];
  for (let i=0;i<=7;i++) T.push({x:-R*0.9-i*R*0.36, y:Math.sin(tph-i*0.55)*tamp*(i/7+0.1)});
  for (const pass of [0,1]){
    for (let i=0;i<7;i++){
      const w=R*0.62*(1-i/8);
      ctx.strokeStyle=pass?cfg.bodyColor:'#101a0c';
      ctx.lineWidth=pass?w:w+3;
      line(ctx,T[i].x,T[i].y,T[i+1].x,T[i+1].y);
    }
  }
  ctx.strokeStyle=cfg.backColor; ctx.lineWidth=2;          // гребень на хвосте
  for (let i=0;i<6;i++){
    const a=T[i],b=T[i+1];
    line(ctx,(a.x+b.x)/2,(a.y+b.y)/2-1.5,(a.x+b.x)/2,(a.y+b.y)/2+1.5);
  }

  // лапы: 4, враскоряку, диагональная походка
  for (const pass of [0,1]){
    ctx.strokeStyle=pass?cfg.legColor:'#101a0c';
    ctx.lineWidth=pass?4:7;
    for (const bx of [R*0.6,-R*0.55]) for (const s of [-1,1]){
      const p=ph+((bx>0)===(s>0)?0:Math.PI);
      const sw=Math.sin(p)*R*0.42, lift=Math.max(0,Math.cos(p))*R*0.08;
      const kx=bx+sw*0.4, ky=s*(R*1.0-lift), fx=bx+sw, fy=s*R*1.35;
      ctx.beginPath(); ctx.moveTo(bx*0.8,s*R*0.5); ctx.lineTo(kx,ky); ctx.lineTo(fx,fy); ctx.stroke();
      if (pass) for (const t of [-1,0,1]){    // когти
        ctx.lineWidth=2;
        line(ctx,fx,fy,fx+R*0.16+t*R*0.06,fy+s*R*0.2+t*R*0.14);
        ctx.lineWidth=4;
      }
    }
  }

  // туловище
  ctx.fillStyle=cfg.bodyColor; ctx.strokeStyle='#101a0c'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.ellipse(0,0,R*1.2,R*0.66,0,0,TAU); ctx.fill(); ctx.stroke();
  // щитки
  ctx.fillStyle=cfg.backColor;
  for (const row of [-1,0,1]) for (let i=-3;i<=3;i++){
    const x=i*R*0.3+(row?R*0.15:0), y=row*R*0.32;
    if (Math.abs(x)>R*1.05) continue;
    ctx.beginPath(); ctx.ellipse(x,y,R*0.11,R*0.08,0,0,TAU); ctx.fill();
  }
  ctx.fillStyle='rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.ellipse(-R*0.2,-R*0.22,R*0.7,R*0.16,0,0,TAU); ctx.fill();

  // голова: расширяется от шеи, широкая морда
  ctx.fillStyle=cfg.bodyColor; ctx.strokeStyle='#101a0c'; ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(R*0.85,-R*0.55); ctx.lineTo(R*1.5,-R*0.5);
  ctx.quadraticCurveTo(R*2.2,-R*0.42,R*2.3,-R*0.15);
  ctx.lineTo(R*2.3,R*0.15);
  ctx.quadraticCurveTo(R*2.2,R*0.42,R*1.5,R*0.5);
  ctx.lineTo(R*0.85,R*0.55); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // линия пасти и мелкие зубы по её краю
  ctx.strokeStyle='#101a0c'; ctx.lineWidth=1.5;
  for (const s of [-1,1]){
    ctx.beginPath(); ctx.moveTo(R*1.5,s*R*0.47); ctx.quadraticCurveTo(R*2.1,s*R*0.38,R*2.28,s*R*0.14); ctx.stroke();
  }
  ctx.fillStyle='#e9e3c8';
  for (let i=0;i<4;i++){
    const t=i/3.4, x=R*(1.62+t*0.55);
    for (const s of [-1,1]){
      const yy=s*(R*0.45-t*R*0.22);
      ctx.beginPath(); ctx.moveTo(x,yy); ctx.lineTo(x+R*0.05,yy+s*R*0.07); ctx.lineTo(x+R*0.1,yy); ctx.closePath(); ctx.fill();
    }
  }
  // ноздри и глазные бугорки
  ctx.fillStyle='#101a0c';
  for (const s of [-1,1]){ ctx.beginPath(); ctx.ellipse(R*2.15,s*R*0.12,R*0.045,R*0.07,0,0,TAU); ctx.fill(); }
  ctx.fillStyle=cfg.backColor; ctx.strokeStyle='#101a0c'; ctx.lineWidth=1.5;
  for (const s of [-1,1]){ ctx.beginPath(); ctx.arc(R*1.2,s*R*0.36,R*0.2,0,TAU); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  drawMonsterEyes(m,px,py,alpha,time);
}

// ============================================================
// ХОЗЯИН ЛАБИРИНТА (Босс) — бык, вид строго сверху
// ============================================================
function drawGlyph(cx,cy,r){        // квадратная спираль — клеймо
  ctx.beginPath();
  let x=cx-r,y=cy-r,len=2*r,dir=0;
  ctx.moveTo(x,y);
  for (let i=0;i<7;i++){
    const d=[[1,0],[0,1],[-1,0],[0,-1]][dir];
    x+=d[0]*len; y+=d[1]*len; ctx.lineTo(x,y);
    if (i%2===1) len-=r*0.5;
    dir=(dir+1)%4;
  }
  ctx.stroke();
}
function drawMonster3(m,px,py,alpha,time){
  const cfg=m.cfg,R=cfg.size,chasing=(m.state==='chase')&&m.stun<=0,walking=m.moving>1;
  const ph=m.legPhase*0.8;
  ctx.save(); ctx.globalAlpha=alpha;
  if (chasing) drawAura(m,px,py,time);
  flatShadow(px,py,m.facing,R*2.0,R*1.15,R*0.2);
  ctx.translate(px,py); ctx.rotate(m.facing);
  ctx.lineCap='round'; ctx.lineJoin='round';

  // пыль из-под копыт
  if (walking){
    ctx.fillStyle='rgba(150,130,100,0.22)';
    for (const s of [-1,1]){
      const k=(Math.sin(ph+(s>0?0:Math.PI))+1)/2;
      ctx.beginPath(); ctx.arc(-R*1.0-k*R*0.5,s*R*0.85,R*0.12+k*R*0.28,0,TAU); ctx.fill();
    }
  }
  // хвост с кисточкой
  const tw=Math.sin(time*2.2+m.home.x)*R*0.25;
  ctx.strokeStyle='#1a100a'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(-R*1.3,0); ctx.quadraticCurveTo(-R*1.9,tw*0.5,-R*2.2,tw); ctx.stroke();
  ctx.fillStyle='#1a100a';
  ctx.beginPath(); ctx.ellipse(-R*2.25,tw,R*0.18,R*0.12,0,0,TAU); ctx.fill();
  // копыта, шаг по диагонали
  ctx.fillStyle='#120c08'; ctx.strokeStyle='#050302'; ctx.lineWidth=1.5;
  for (const bx of [R*0.75,-R*0.85]) for (const s of [-1,1]){
    const p=ph+((bx>0)===(s>0)?0:Math.PI);
    const sw=walking?Math.sin(p)*R*0.3:0;
    ctx.beginPath(); ctx.ellipse(bx+sw,s*R*0.98,R*0.22,R*0.16,0,0,TAU); ctx.fill(); ctx.stroke();
  }
  // туша
  ctx.fillStyle=cfg.bodyColor; ctx.strokeStyle='#0d0806'; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.ellipse(-R*0.15,0,R*1.35,R*0.95,0,0,TAU); ctx.fill(); ctx.stroke();
  // горб на плечах
  ctx.fillStyle=cfg.shellColor;
  ctx.beginPath(); ctx.ellipse(R*0.45,0,R*0.6,R*0.85,0,0,TAU); ctx.fill();
  // шерсть
  ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=1.5;
  for (let i=0;i<9;i++) for (const s of [-1,1]){
    const x=-R*1.2+i*R*0.28;
    line(ctx,x,s*R*0.25,x-R*0.12,s*R*0.7);
  }
  ctx.strokeStyle='rgba(255,255,255,0.07)'; ctx.lineWidth=R*0.25;
  line(ctx,-R*1.1,-R*0.1,R*0.3,-R*0.1);
  // клеймо на спине
  ctx.strokeStyle=cfg.runeColor; ctx.lineWidth=1.6;
  drawGlyph(-R*0.5,0,R*0.28);
  // рога — широкие, растут из-за головы вперёд
  ctx.strokeStyle='#0d0806'; ctx.lineWidth=2;
  for (const s of [-1,1]){
    ctx.fillStyle='#e6d8b8';
    ctx.beginPath();
    ctx.moveTo(R*1.25,s*R*0.5);
    ctx.quadraticCurveTo(R*1.4,s*R*1.5,R*2.35,s*R*1.5);
    ctx.quadraticCurveTo(R*1.75,s*R*1.15,R*1.55,s*R*0.62);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#2e2418';
    ctx.beginPath(); ctx.arc(R*2.33,s*R*1.5,R*0.12,0,TAU); ctx.fill();
  }
  // уши
  ctx.fillStyle=cfg.shellColor; ctx.strokeStyle='#0d0806'; ctx.lineWidth=2;
  for (const s of [-1,1]){
    ctx.beginPath(); ctx.ellipse(R*1.15,s*R*0.78,R*0.3,R*0.16,s*0.6,0,TAU); ctx.fill(); ctx.stroke();
  }
  // голова — крупная, чтобы читалась сверху
  ctx.beginPath(); ctx.ellipse(R*1.55,0,R*0.8,R*0.62,0,0,TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.ellipse(R*1.45,-R*0.22,R*0.5,R*0.14,0,0,TAU); ctx.fill();
  // морда
  ctx.fillStyle=cfg.plateColor; ctx.strokeStyle='#0d0806';
  ctx.beginPath(); ctx.ellipse(R*2.15,0,R*0.42,R*0.36,0,0,TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#1a0e08';
  for (const s of [-1,1]){ ctx.beginPath(); ctx.ellipse(R*2.3,s*R*0.15,R*0.07,R*0.11,0,0,TAU); ctx.fill(); }
  ctx.strokeStyle='#0d0806'; ctx.lineWidth=1.5;            // линия рта
  ctx.beginPath(); ctx.arc(R*2.2,0,R*0.26,-0.8,0.8); ctx.stroke();
  ctx.strokeStyle=cfg.runeColor; ctx.lineWidth=2.2;        // кольцо в носу
  ctx.beginPath(); ctx.arc(R*2.5,0,R*0.17,-1.3,1.3); ctx.stroke();
  // пар из ноздрей при погоне
  if (chasing){
    const k=(time*1.5+m.home.x)%1;
    ctx.fillStyle=`rgba(225,225,235,${0.35*(1-k)})`;
    for (const s of [-1,1]){
      ctx.beginPath(); ctx.arc(R*(2.3+k*0.8),s*R*(0.15+k*0.35),R*(0.08+k*0.28),0,TAU); ctx.fill();
    }
  }
  ctx.restore();
  drawMonsterEyes(m,px,py,alpha,time);
}
