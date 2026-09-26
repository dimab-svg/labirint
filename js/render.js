'use strict';

// 12. РЕНДЕР ПОЛЯ
// ============================================================
const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d');
const posEl=document.getElementById('pos');
const zoneEl=document.getElementById('zone');
const exploredEl=document.getElementById('explored');
const caughtEl=document.getElementById('caught');
const msgEl=document.getElementById('msg');
const chipStars=document.getElementById('chipStars');
const chipCoins=document.getElementById('chipCoins');
const chipGren=document.getElementById('chipGren');
const chipTele=document.getElementById('chipTele');
const chipApple=document.getElementById('chipApple');

function updateHud(){
  chipStars.innerHTML = inv.stars>0 ? `★ <b>${inv.stars}</b>` : `✕ <b>0</b>`;
  chipStars.classList.toggle('empty', inv.stars===0);
  chipCoins.innerHTML = `₥ <b>${inv.coins}</b>`;
  chipGren.innerHTML  = `✹ <b>${inv.grenades}</b>`;
  chipGren.classList.toggle('off', inv.grenades===0);
  chipTele.innerHTML  = `⌖ <b>${inv.teleports}</b>`;
  chipTele.classList.toggle('off', inv.teleports===0);
  chipApple.innerHTML = `◉ <b>${inv.apples}</b>`;
  chipApple.classList.toggle('off', inv.apples===0);
  chipApple.title = inv.apples>0
    ? 'Яблоко-приманка: E или клик — оставить в этой комнате'
    : 'Яблоки лежат на карте (◉) и продаются не везде: подберите и оставляйте (E)';
  for (let i=0;i<3;i++){
    const el=document.getElementById('k'+i);
    const has=inv.keys[i];
    el.classList.toggle('has',has);
    el.style.background = has ? KEY_DEFS[i].color : '#1a1d23';
    el.style.color = KEY_DEFS[i].color;
    el.title = KEY_DEFS[i].name + ' ключ';
  }
  refreshShop();
}

function alphaForWorld(wx,wy){
  const d=Math.hypot((wx-camX)/ROOM_SIZE,(wy-camY)/ROOM_SIZE);
  return clamp(1-LIGHT.falloff*d, LIGHT.minA, 1);
}

// Геометрия дверей текущего кадра: заполняется в render(), читается в drawDoorLeaf()
const doorMeta=new Map();

function render(time){
  updateLight(1/60);                       // плавно подстроить свет под зону игрока

  ctx.fillStyle='#050507';
  ctx.fillRect(0,0,CANVAS_SIZE,CANVAS_SIZE);

  const visible=[], half=ROOM_SIZE/2;
  for (let ry=player.y-3;ry<=player.y+3;ry++)
    for (let rx=player.x-3;rx<=player.x+3;rx++){
      if (!inBounds(rx,ry)) continue;
      const cx=roomCX(rx),cy=roomCY(ry);
      const l=sx(cx-half),t=sy(cy-half);
      if (l>CANVAS_SIZE||t>CANVAS_SIZE||l+ROOM_SIZE<0||t+ROOM_SIZE<0) continue;
      visible.push({rx,ry,cx,cy,l,t,alpha:alphaForWorld(cx,cy),theme:roomTheme(rx,ry)});
    }

  for (const r of visible){
    ctx.save(); ctx.globalAlpha=r.alpha;
    ctx.drawImage(getRoomFloor(r.rx,r.ry),r.l,r.t);
    ctx.restore();
    if (MAP.shops.has(`${r.rx},${r.ry}`)) drawShopFloor(r,time);
    if (MAP.traps.has(`${r.rx},${r.ry}`)) drawTrapFloor(r,time);
    if (r.rx===MAP.exit.x&&r.ry===MAP.exit.y) drawExitGate(r,time);
  }

  // предметы
  for (const r of visible){
    const it=MAP.items.get(`${r.rx},${r.ry}`);
    if (!it) continue;
    const X=sx(r.cx), Y=sy(r.cy);
    if      (it.type==='star')    drawStar(X,Y,ITEM_R,r.alpha,time);
    else if (it.type==='coin')    drawMoney(X,Y,r.alpha,time,it.value);
    else if (it.type==='grenade') drawGrenadeIcon(X,Y,r.alpha,time);
    else if (it.type==='apple')   drawAppleItem(X+(it.ox||0),Y+(it.oy||0),r.alpha,time);
    else if (it.type==='key')     drawKeyItem(X,Y,r.alpha,time,it.color);
  }

  // стены, колонны, двери, факелы (общие для двух комнат — рисуются один раз)
  const walls=new Map(), corners=new Map();
  doorMeta.clear();
  for (const r of visible) collectRoomGeometry(r,walls,doorMeta,corners);
  for (const d of doorMeta.values()) drawThreshold(d);
  for (const w of walls.values())    drawWallBand(w);
  for (const p of corners.values())  drawPillar(p);
  for (const k of doorMeta.keys())   drawDoorLeaf(k,time);
  for (const r of visible)           drawTorches(r,time);

  // брошенные гранаты
  for (const g of grenades){
    const X=sx(g.x), Y=sy(g.y);
    const blink=Math.sin((GRENADE_FUSE-g.t)*22)>0;
    ctx.save();
    ctx.globalAlpha=alphaForWorld(g.x,g.y);
    ctx.fillStyle='#2b2f36';
    ctx.beginPath(); ctx.arc(X,Y,10,0,TAU); ctx.fill();
    ctx.strokeStyle='#585f6a'; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle=blink?'#ff5a3c':'#7a4a30';
    ctx.beginPath(); ctx.arc(X+6,Y-8,3.5,0,TAU); ctx.fill();
    ctx.restore();
  }

  for (const m of monsters){
    if (Math.max(Math.abs(m.room.x-player.x),Math.abs(m.room.y-player.y))>3) continue;
    drawMonster(m,time);
  }

  // разряды аномалии
  for (let i=zaps.length-1;i>=0;i--){
    const z=zaps[i]; z.t+=1/60;
    if (z.t>0.6){ zaps.splice(i,1); continue; }
    const p=z.t/0.6, X=sx(z.x), Y=sy(z.y);
    ctx.save();
    ctx.globalAlpha=(1-p);
    ctx.strokeStyle='#aee9ff'; ctx.lineWidth=2.5*(1-p)+0.5;
    ctx.beginPath(); ctx.arc(X,Y,10+p*70,0,TAU); ctx.stroke();
    ctx.strokeStyle='#5ab8ff';
    ctx.beginPath(); ctx.arc(X,Y,4+p*40,0,TAU); ctx.stroke();
    const rr=mulberry32((Math.floor(z.t*30)+1)*7919);
    ctx.strokeStyle=`rgba(200,240,255,${1-p})`; ctx.lineWidth=1.5;
    for (let k=0;k<3;k++){
      const a=rr()*TAU, l1=8+rr()*20, l2=l1+10+rr()*25;
      ctx.beginPath();
      ctx.moveTo(X+Math.cos(a)*l1, Y+Math.sin(a)*l1);
      ctx.lineTo(X+Math.cos(a+0.3)*l2, Y+Math.sin(a+0.3)*l2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // взрывы
  for (const e of explosions){
    const p=e.t/0.85, X=sx(e.x), Y=sy(e.y);
    const R=GRENADE_RADIUS*(0.25+0.75*p);
    ctx.save();
    ctx.globalAlpha=(1-p)*0.9;
    const g=ctx.createRadialGradient(X,Y,R*0.1,X,Y,R);
    g.addColorStop(0,'rgba(255,255,220,0.95)');
    g.addColorStop(0.35,'rgba(255,170,40,0.75)');
    g.addColorStop(0.7,'rgba(220,70,25,0.4)');
    g.addColorStop(1,'rgba(70,20,10,0)');
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.arc(X,Y,R,0,TAU); ctx.fill();
    ctx.strokeStyle=`rgba(255,230,160,${(1-p)*0.8})`;
    ctx.lineWidth=3*(1-p)+1;
    ctx.beginPath(); ctx.arc(X,Y,R*0.95,0,TAU); ctx.stroke();
    ctx.restore();
  }

  drawPlayerLight(time);
  drawFog();
  drawMonsterEyesOverlay(time);   // горящие глаза видно сквозь темноту
  for (const r of visible)                       // молнии аномалии — видно издалека
    if (MAP.traps.has(`${r.rx},${r.ry}`)) drawAnomalyArcs(r,time);

  // вспышка телепорта
  if (teleFx){
    teleFx.t+=1/60;
    const p=teleFx.t/0.7;
    if (p>=1) teleFx=null;
    else {
      ctx.save();
      ctx.globalAlpha=1-p;
      ctx.strokeStyle='#7ac4f5'; ctx.lineWidth=3*(1-p)+1;
      ctx.beginPath(); ctx.arc(CANVAS_SIZE/2,CANVAS_SIZE/2,14+p*120,0,TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(CANVAS_SIZE/2,CANVAS_SIZE/2,8+p*70,0,TAU); ctx.stroke();
      ctx.restore();
    }
  }

  // игрок — путник в плаще с факелом
  drawPlayerFigure(time);

  drawGrain();

  if (unlocking) drawUnlockAnim(time);
  if (DEBUG) drawDebug();
  if (gameWon)  drawOverlay('ВЫХОД НАЙДЕН','#8ef08e');
  if (gameOver) drawOverlay(gameOverText,'#ff7a7a');
}
