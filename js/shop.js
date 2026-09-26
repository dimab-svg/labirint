'use strict';

// ============================================================
// МАГАЗИН: витрина в комнате, отрисовка, боковая панель, покупки
// ============================================================

// Витрина: товары стоят вдоль «прилавка» в комнате магазина.
// Иконки — в ряд у нижней стены; клик по товару (или клавиши 1–6) — покупка.
const SHOW_XS=[-105,-63,-21,21,63,105];   // смещение иконки от центра комнаты, по X
const SHOW_Y =92;                         // по Y (вниз)
const SHOW_HIT=28;                        // радиус «кликабельности» товара

function shopGoods(){
  return [
    {id:'star',     name:'Звезда защиты',      price:PRICES.star,     sold:false},
    {id:'grenade',  name:'Граната',            price:PRICES.grenade,  sold:false},
    {id:'apple',    name:'Яблоко-приманка',    price:PRICES.apple,    sold:false},
    {id:'teleport', name:'Свиток телепорта (T)',price:PRICES.teleport, sold:false},
    {id:'hintExit', name:'Подсказка: выход',   price:PRICES.hintExit, sold:hintExit},
    {id:'hintPath', name:'Подсказка: путь',    price:PRICES.hintPath, sold:hintPath},
  ];
}

function drawScrollIcon(cx,cy,R,alpha,time){
  const bob=Math.sin(time*2)*1.2;
  ctx.save(); ctx.globalAlpha=alpha;
  ctx.translate(cx,cy+bob);
  ctx.fillStyle='rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0,R*0.95,R*1.05,R*0.35,0,0,TAU); ctx.fill();
  // бумага
  ctx.fillStyle='#e8d9a8';
  ctx.beginPath();
  ctx.moveTo(-R,-R*0.8);
  ctx.quadraticCurveTo(R*0.1,-R*1.25,R,-R*0.8);
  ctx.lineTo(R*0.85,R*0.2);
  ctx.quadraticCurveTo(0,R*0.85,-R*0.85,R*0.2);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#a98e4e'; ctx.lineWidth=1.2;
  ctx.stroke();
  // валики
  ctx.fillStyle='#c9ac66';
  ctx.fillRect(-R*1.25,-R*0.95,R*0.45,R*1.15);
  ctx.fillRect(R*0.8,-R*0.95,R*0.45,R*1.15);
  ctx.fillStyle='#7ac4f5'; ctx.font='bold 11px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('⌖',0,R*0.1);
  ctx.restore();
}

function drawShowcaseIcon(id,X,Y,alpha,time){
  if (id==='star')     drawStar(X,Y,17,alpha,time);
  else if (id==='grenade') drawGrenadeIcon(X,Y,alpha,time);
  else if (id==='apple')   drawAppleItem(X,Y-2,alpha,time);
  else if (id==='teleport') drawScrollIcon(X,Y,17,alpha,time);
  else if (id==='hintExit'||id==='hintPath'){
    ctx.save(); ctx.globalAlpha=alpha;
    ctx.fillStyle=id==='hintExit'?'#ffb454':'#8ef08e';
    ctx.font='bold 26px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(id==='hintExit'?'⚑':'⇢',X,Y);
    ctx.restore();
  }
}

function drawShopFloor(r,time){
  const cx=r.l+ROOM_SIZE/2, cy=r.t+ROOM_SIZE/2;
  const pulse=0.6+0.4*Math.sin(time*2);
  const inMyShop=(r.rx===player.x&&r.ry===player.y);
  ctx.save(); ctx.globalAlpha=r.alpha;
  ctx.strokeStyle=`rgba(223,230,238,${0.28*pulse})`;
  ctx.lineWidth=2; ctx.setLineDash([9,7]);
  ctx.beginPath(); ctx.arc(cx,cy,ROOM_SIZE*0.34,0,TAU); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle=`rgba(223,230,238,${0.75})`;
  ctx.font='bold 13px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  ctx.fillText('МАГАЗИН', cx, cy-ROOM_SIZE*0.26);
  // навес
  ctx.translate(cx,cy+ROOM_SIZE*0.02);
  for (let i=-2;i<=2;i++){
    ctx.fillStyle = (i%2===0)?'#c8ccd4':'#8d3a3a';
    ctx.fillRect(i*13-6.5,-8,13,16);
  }
  ctx.strokeStyle='#5b6069'; ctx.lineWidth=1.5;
  ctx.strokeRect(-32.5,-8,65,16);
  ctx.restore();

  // --- витрина (рисуется, когда игрок ВНУТРИ этого магазина) ---
  if (inMyShop){
    const goods=shopGoods();
    ctx.save(); ctx.globalAlpha=r.alpha;
    // деревянный прилавок (полка вдоль нижней стены)
    ctx.fillStyle='rgba(116,80,44,0.95)';
    ctx.fillRect(cx-122, cy+112, 244, 6);
    ctx.fillStyle='rgba(80,52,26,0.95)';
    ctx.fillRect(cx-122, cy+118, 244, 3);
    ctx.restore();

    // подсказка
    ctx.save(); ctx.globalAlpha=r.alpha*(0.55+0.25*Math.sin(time*2));
    ctx.fillStyle='#c8d6e2';
    ctx.font='10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('Витрина — клик по товару или клавиши 1–6', cx, cy-ROOM_SIZE*0.15);
    ctx.restore();

    for (let i=0;i<goods.length;i++){
      const X=cx+SHOW_XS[i], Y=cy+SHOW_Y;
      const g=goods[i];
      const affordable=inv.coins>=g.price;
      const hovered=(shopHover===i&&!g.sold);
      const dim=(g.sold||!affordable)&&!hovered;
      const eff=r.alpha*(dim?0.45:1);
      ctx.save();
      ctx.globalAlpha=eff;

      // плинт-подставка
      ctx.fillStyle='rgba(40,44,52,0.9)';
      ctx.beginPath(); ctx.ellipse(X,Y+18,20,7,0,0,TAU); ctx.fill();
      ctx.fillStyle='rgba(90,72,48,1)';
      ctx.beginPath(); ctx.ellipse(X,Y+16,16,5,0,0,TAU); ctx.fill();

      if (hovered){   // подсветка выбранного товара
        const gg=ctx.createRadialGradient(X,Y,4,X,Y,42);
        gg.addColorStop(0,'rgba(255,255,255,0.28)');
        gg.addColorStop(1,'rgba(255,255,255,0)');
        ctx.fillStyle=gg; ctx.beginPath(); ctx.arc(X,Y,42,0,TAU); ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,0.8)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(X,Y,21,0,TAU); ctx.stroke();
      }

      drawShowcaseIcon(g.id,X,Y-6,eff,time);
      ctx.restore();

      // номер клавиши и ценник
      ctx.save(); ctx.globalAlpha=r.alpha*(g.sold?0.5:1);
      ctx.fillStyle='rgba(10,12,16,0.78)';
      const pw=g.sold?58:46, ph=15;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(X-pw/2,Y+18,pw,ph,4);
      else ctx.rect(X-pw/2,Y+18,pw,ph);
      ctx.fill();
      ctx.font='bold 10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle=g.sold?'#9aa1ab':'#5fc98a';
      ctx.fillText(g.sold?'продано':(affordable?`${i+1} · ${g.price}₥`:`${i+1} · —`),X,Y+25.5);
      ctx.restore();
    }
  }
}

// 14. МАГАЗИН
// ============================================================
const shopPanel=document.getElementById('shopPanel');
const shopBody=document.getElementById('shopBody');

function inShop(){ return MAP && MAP.shops.has(`${player.x},${player.y}`) && !move; }

let shopHover=-1;               // индекс товара под курсором (для подсветки), -1 = нет

// Товар под точкой экрана (для клика/наведения). Работает, когда игрок в магазине:
// тогда центр комнаты совпадает с центром экрана.
function shopSlotAt(mx,my){
  const c=CANVAS_SIZE/2;
  for (let i=0;i<SHOW_XS.length;i++){
    if (Math.hypot(mx-(c+SHOW_XS[i]), my-(c+SHOW_Y)) <= SHOW_HIT) return i;
  }
  return -1;
}

function buyShopSlot(i){
  const g=shopGoods()[i];
  if (!g) return;
  if (g.sold){ flashMessage('Этот товар уже куплен'); return; }
  if (inv.coins<g.price){
    flashMessage(`Не хватает ${g.price-inv.coins} ₥`);
    return;
  }
  buy(g.id,g.price);
}

function refreshShop(){
  if (!MAP) return;
  const open=inShop();
  shopPanel.classList.toggle('dim',!open);
  if (!open){
    shopBody.innerHTML='<div style="font-size:12px;color:#6f7887;line-height:1.5">Витрина работает, когда вы в комнате-магазине.<br>Найдите её (на карте — белый квадрат).</div>';
    return;
  }
  const goods=shopGoods();
  let html=
    '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">'+
    '<span style="color:#c8cfd8">Вы в магазине</span><b style="color:#5fc98a">₥ '+inv.coins+'</b></div>'+
    '<div style="font-size:11px;color:#6f7887;line-height:1.5">Купить: клик по товару на витрине (в комнате) или клавиша 1–6.</div>'+
    '<div style="margin-top:6px">';
  for (let i=0;i<goods.length;i++){
    const g=goods[i];
    const pr=g.sold
      ?'<span style="color:#6f7887">куплено</span>'
      :'<span style="color:'+(inv.coins>=g.price?'#5fc98a':'#b06a6a')+'">'+g.price+' ₥</span>';
    html+='<div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;padding:2.5px 0;border-bottom:1px solid #22262d">'+
      '<span><b style="color:#8a94a3">'+(i+1)+'</b> '+g.name+'</span>'+pr+'</div>';
  }
  html+='</div>';
  shopBody.innerHTML=html;
}

function buy(id,price){
  if (inv.coins<price) return;
  inv.coins-=price;
  if (id==='star'){ inv.stars++; flashMessage('Куплена звезда защиты'); }
  else if (id==='grenade'){ inv.grenades++; flashMessage('Куплена граната'); maybeGrenadeInfo(); }
  else if (id==='teleport'){ inv.teleports++; flashMessage('Куплен свиток телепорта'); maybeTeleportInfo(); }
  else if (id==='apple'){ inv.apples++; flashMessage('Куплено яблоко (E — оставить приманку в комнате)'); }
  else if (id==='hintExit'){
    hintExit=true; mapDirty=true;
    flashMessage(`Выход в комнате ${MAP.exit.x},${MAP.exit.y}`);
  }
  else if (id==='hintPath'){
    hintPath=true; mapDirty=true;
    flashMessage('Путь к выходу отмечен на карте');
  }
  updateHud();
}
