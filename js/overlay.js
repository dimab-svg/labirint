'use strict';

// ============================================================
// ЭКРАННЫЕ НАДПИСИ: финальный оверлей и отладочная панель
// ============================================================

function drawOverlay(title,color){
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,0.74)';
  ctx.fillRect(0,0,CANVAS_SIZE,CANVAS_SIZE);
  ctx.textAlign='center';
  ctx.fillStyle=color; ctx.font='bold 46px sans-serif';
  ctx.fillText(title,CANVAS_SIZE/2,CANVAS_SIZE/2-24);
  ctx.fillStyle='#cfd8e2'; ctx.font='17px sans-serif';
  ctx.fillText(`Комнат пройдено: ${visited.size} из ${MAP.w*MAP.h}`,CANVAS_SIZE/2,CANVAS_SIZE/2+18);
  ctx.fillText(`Звёзд потеряно ${caughtCount} · денег ${inv.coins} · кратчайший путь ${MAP.pathLen}`,
               CANVAS_SIZE/2,CANVAS_SIZE/2+44);
  ctx.fillStyle='#8a94a3'; ctx.font='14px sans-serif';
  ctx.fillText('«Новый» — сгенерировать другой лабиринт',CANVAS_SIZE/2,CANVAS_SIZE/2+82);
  ctx.restore();
}

function drawDebug(){
  const pr=playerRoomForAI();
  const near=monsters.filter(m=>Math.max(Math.abs(m.room.x-player.x),Math.abs(m.room.y-player.y))<=MONSTER_ACTIVE_RANGE);
  const lines=[
    `сид ${MAP.seed} · ${MAP.cfg.label} · ${MAP.w}×${MAP.h}`,
    `игрок(${player.x},${player.y}) зона ${zoneAt(player.x,player.y)} · до выхода ${MAP.dist[player.y*MAP.w+player.x]}`,
    `монстров ${monsters.length}`+
      ` (Ползунов ${monsters.filter(m=>m.cfg.id==='monster1').length}`+
      `, Охотников ${monsters.filter(m=>m.cfg.id==='monster2').length}`+
      `, Боссов ${monsters.filter(m=>m.cfg.boss).length}),`+
      ` активных ${near.length} · дверей ${doorAnims.size}`,
    `предметов ${MAP.items.size} · магазинов ${MAP.shops.size} · замков ${MAP.locks.size}`,
  ];
  near.slice(0,5).forEach((m,i)=>{
    lines.push(`M${i} ${m.state.padEnd(5)} r(${m.room.x},${m.room.y})`+
      (m.cross?` ×${m.cross.dir}`:'')+(m.blockedWait>0?' WAIT':''));
  });
  const w=390,h=12+lines.length*15;
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,0.85)'; ctx.fillRect(8,8,w,h);
  ctx.strokeStyle='#4a4'; ctx.lineWidth=1; ctx.strokeRect(8.5,8.5,w,h);
  ctx.font='12px monospace'; ctx.textAlign='left'; ctx.fillStyle='#9f9';
  lines.forEach((s,i)=>ctx.fillText(s,16,26+i*15));
  ctx.restore();
}
