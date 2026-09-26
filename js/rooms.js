'use strict';

// ============================================================
// 11. КОМНАТЫ: палитры зон, пол, узоры, декор, факелы, свет
//     (новый дизайн — перенесён из index1.html и связан с зонами игры)
// ============================================================

// ---------- НАСТРОЙКИ ДИЗАЙНА (крутить здесь) ----------
const RS      = ROOM_SIZE;      // размер комнаты (250)
const WALL_T  = 22;             // толщина стены, px
const PILLAR  = WALL_T * 1.6;   // размер угловой колонны
const DECO_R  = 80;             // радиус «сцены» в центре: декор сюда не кладём (место для предметов)
const PAT_M   = RS * 0.5;       // запас за границами комнаты для повёрнутых узоров
const FLOOR_CACHE_MAX = 96;     // сколько готовых полов держим в памяти (LRU)

const DECOR = {
  rug:   0.12,                  // вероятность ковра в комнате (0 = ковров нет)
  props: 2.6,                   // среднее число мелкого декора (0 = выкл.)
};

// ---------- СВЕТ ПО ЗОНАМ ----------
// Зона 0 («Ядро», старт) — светло и спокойно.
// Последняя зона («Горло») — максимально мрачно.
// Игрок отходит от центра → темнеет; возвращается → снова светлеет (передышка).
//   falloff/minA — как быстро гаснут соседние комнаты
//   inner/mid/midA/outerA — форма тумана вокруг игрока
//   playerA — яркость факела игрока
//   torchA  — яркость настенных факелов
//   floorLift — сдвиг яркости пола (+ светлее / − темнее)
//   grain   — плёночное зерно
const LIGHT_BRIGHT = { falloff:0.13, minA:0.70, inner:0.60, mid:0.62, midA:0.16, outerA:0.82, playerA:0.10, torchA:1.00, floorLift:  8, grain:0.035 };
const LIGHT_DARK   = { falloff:0.26, minA:0.38, inner:0.34, mid:0.50, midA:0.60, outerA:0.97, playerA:0.34, torchA:0.60, floorLift:-10, grain:0.085 };

const LIGHT_KEYS = ['falloff','minA','inner','mid','midA','outerA','playerA','torchA','floorLift','grain'];
const lerp = (a,b,t) => a + (b-a)*t;

// Текущий свет: пересчитывается каждый кадр, плавно догоняет зону игрока.
let LIGHT = Object.assign({}, LIGHT_BRIGHT);
let lightT = 0;                 // текущая «мрачность» 0..1
let lightMode = 'auto';         // 'auto' | 'soft' | 'moody' | 'dark'
const LIGHT_MODES = { auto:null, soft:0, moody:0.55, dark:1 };

// Насколько мрачна зона z (0 = ядро, 1 = самая дальняя)
function zoneDarkness(z){
  const nz = (MAP && MAP.NZ) ? MAP.NZ : 5;
  if (nz <= 1) return 0;
  return clamp(z/(nz-1), 0, 1);
}

// Целевая мрачность: по зоне игрока либо принудительно (режим L)
function targetDarkness(){
  const forced = LIGHT_MODES[lightMode];
  if (forced !== null && forced !== undefined) return forced;
  if (!MAP) return 0;
  return zoneDarkness(zoneAt(player.x, player.y));
}

// Плавный переход между зонами (вызывается из render каждый кадр)
function updateLight(dt){
  lightT = approach(lightT, targetDarkness(), dt*0.7);   // ~1.4 с на полный переход
  for (const k of LIGHT_KEYS) LIGHT[k] = lerp(LIGHT_BRIGHT[k], LIGHT_DARK[k], lightT);
}

function cycleLight(){
  const names = Object.keys(LIGHT_MODES);
  lightMode = names[(names.indexOf(lightMode)+1) % names.length];
  const label = lightMode==='auto' ? 'по зонам (авто)' : lightMode;
  if (typeof flashMessage === 'function') flashMessage('Освещение: ' + label);
}

// ============================================================
// МЕЛКИЕ УТИЛИТЫ
// ============================================================
function hsl(h,s,l,a=1){ return `hsla(${h},${s}%,${l}%,${a})`; }
function line(c,x1,y1,x2,y2){ c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke(); }
// tone(P,d) — цвет пола, сдвинутый по яркости на d
function tone(P,d,a=1){ return hsl(P.fh, P.fs, Math.max(4,Math.min(92,P.fl+d)), a); }
function roomSeed(x,y){ return ((x*374761393 + y*668265263 + (WORLD_SEED|0)) ^ 0x5bd1e995) | 0; }

// ============================================================
// ПАЛИТРЫ: каждая ЗОНА игры получает свою палитру
//   floor=[hue,sat,light], wall=[hue,sat,light]
// ============================================================
const THEMES = [
  {floor:[215,8,36], wall:[215,10,26]},  // серый камень
  {floor:[100,16,30],wall:[105,14,22]},  // мох / сырость
  {floor:[35,32,42], wall:[30,26,30]},   // песчаник
  {floor:[222,22,32],wall:[225,22,22]},  // холодный склеп
  {floor:[12,28,28], wall:[10,22,18]},   // тёмный кирпич
  {floor:[250,10,20],wall:[250,12,14]},  // базальт
  {floor:[40,10,56], wall:[40,8,40]},    // светлый мрамор
  {floor:[22,40,32], wall:[20,30,22]},   // ржавый / медный
  {floor:[150,14,26],wall:[150,12,18]},  // болото
  {floor:[0,22,24],  wall:[0,26,16]},    // вулканический камень
  {floor:[200,30,48],wall:[205,25,34]},  // лёд
  {floor:[60,20,38], wall:[55,18,26]},   // охра
];
const RUG_HUES = [0,14,28,345,215,265,40];

// Кэши. Сбрасываются автоматически при смене сида мира.
let   cacheSeed  = null;
const themeCache = new Map();
const floorCache = new Map();
const torchCache = new Map();
const patternCache = new Map();   // оставлен для совместимости (его чистят newGame/resumeFromData)

function checkCacheSeed(){
  if (cacheSeed === WORLD_SEED) return;
  cacheSeed = WORLD_SEED;
  themeCache.clear(); floorCache.clear(); torchCache.clear(); patternCache.clear();
}

// Палитра зоны: чем дальше зона, тем холоднее и темнее
function zoneTheme(z){
  const rr = mulberry32(((WORLD_SEED ^ 0x51ed270b) + z*7919) | 0);
  const base = THEMES[Math.floor(rr()*THEMES.length)];
  const d = zoneDarkness(z);
  const drop = d*16;                      // дальние зоны заметно темнее
  const desat = d*5;
  return {
    floor:[ base.floor[0], Math.max(0, base.floor[1]-desat), Math.max(6, base.floor[2]-drop) ],
    wall: [ base.wall[0],  Math.max(0, base.wall[1]-desat),  Math.max(4, base.wall[2]-drop*0.8) ],
  };
}

function roomTheme(x,y){
  checkCacheSeed();
  const key = x+','+y;
  const hit = themeCache.get(key);
  if (hit) return hit;

  const base = zoneTheme(zoneAt(x,y));
  const rr = mulberry32(roomSeed(x,y) ^ 0x1234567);
  const j = (a,d)=>a+(rr()-0.5)*2*d;
  const t = {
    floor:[ (j(base.floor[0],6)+360)%360, Math.max(0,j(base.floor[1],4)), base.floor[2] ],
    wall:  base.wall,                      // стены НЕ джиттерим — общая стена двух комнат одного цвета
    floorL:j(base.floor[2],5),
    rugHue:RUG_HUES[Math.floor(rr()*RUG_HUES.length)],
  };
  themeCache.set(key,t);
  if (themeCache.size > 4000) themeCache.clear();
  return t;
}

// ============================================================
// ПОЛ КОМНАТЫ (offscreen-canvas + LRU-кэш)
// ============================================================
function getRoomFloor(rx,ry){
  checkCacheSeed();
  const key = rx+','+ry;
  if (floorCache.has(key)){                       // «освежить» в LRU
    const v = floorCache.get(key);
    floorCache.delete(key); floorCache.set(key,v);
    return v;
  }
  const off = buildFloor(rx,ry);
  floorCache.set(key,off);
  if (floorCache.size > FLOOR_CACHE_MAX) floorCache.delete(floorCache.keys().next().value);
  return off;
}

function buildFloor(rx,ry){
  const off = document.createElement('canvas');
  off.width = off.height = RS;
  const c = off.getContext('2d');
  const th = roomTheme(rx,ry);
  const rng = mulberry32(roomSeed(rx,ry));
  const r = ()=>rng();
  const P = {c,r,th,fh:th.floor[0],fs:th.floor[1],fl:th.floorL};

  // 1) базовая заливка
  c.fillStyle = tone(P,0); c.fillRect(0,0,RS,RS);

  // 2) узор, возможно повёрнутый
  const pat = PATTERNS[Math.floor(r()*PATTERNS.length)];
  c.save();
  if (pat.rot){
    const m=r(), a = m<0.5?0 : m<0.7?Math.PI/4 : m<0.85?Math.PI/2 : (r()-0.5)*0.5;
    c.translate(RS/2,RS/2); c.rotate(a); c.translate(-RS/2,-RS/2);
  }
  c.strokeStyle = tone(P,-22,0.6); c.lineWidth=1.2; c.lineJoin='round';
  pat.draw(P);
  c.restore();

  // 3) износ
  addWear(P);

  // 4) крапинки
  const n = 180 + Math.floor(r()*300);
  for (let i=0;i<n;i++){
    c.fillStyle = r()<0.55 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.09)';
    c.beginPath(); c.arc(r()*RS, r()*RS, 0.6+r()*1.8, 0, Math.PI*2); c.fill();
  }

  // 5) трещины
  const cracks = Math.floor(r()*3.5);
  for (let i=0;i<cracks;i++) drawCrack(P);

  // 6) декор (вне центра)
  addDecor(P);

  // 7) виньетка
  const g = c.createRadialGradient(RS/2,RS/2,30,RS/2,RS/2,RS*0.72);
  g.addColorStop(0,'rgba(255,235,190,0.10)'); g.addColorStop(1,'rgba(0,0,0,0.22)');
  c.fillStyle=g; c.fillRect(0,0,RS,RS);
  edgeShadow(c);
  return off;
}

// ---------- УЗОРЫ ПОЛА ----------
function drawParallels(c,angle,step){
  const cos=Math.cos(angle),sin=Math.sin(angle),nx=-sin,ny=cos,len=RS*1.5;
  for (let d=-RS*1.2; d<RS*1.2; d+=step){
    const px=RS/2+nx*d, py=RS/2+ny*d;
    line(c,px-cos*len,py-sin*len,px+cos*len,py+sin*len);
  }
}
function hexPath(c,cx,cy,r){
  c.beginPath();
  for (let i=0;i<6;i++){ const a=i/6*Math.PI*2, x=cx+Math.cos(a)*r, y=cy+Math.sin(a)*r; i?c.lineTo(x,y):c.moveTo(x,y); }
  c.closePath();
}
const PATTERNS = [
  {rot:true,draw:P=>{ // 0. плитка
    const{c,r}=P, st=26+Math.floor(r()*44), mode=Math.floor(r()*3);
    for(let x=-PAT_M;x<RS+PAT_M;x+=st)for(let y=-PAT_M;y<RS+PAT_M;y+=st){
      const i=Math.round(x/st),k=Math.round(y/st);
      const d = mode===1 ? (((i+k)&1)?-4:3) : mode===2 ? (r()-0.5)*9 : 0;
      if(d){c.fillStyle=tone(P,d);c.fillRect(x,y,st,st);}
      c.strokeRect(x,y,st,st);
    }}},
  {rot:false,draw:P=>drawParallels(P.c,0.3+P.r(),26+Math.floor(P.r()*40))},
  {rot:false,draw:P=>{const a=0.3+P.r()*0.6,st=26+Math.floor(P.r()*40);drawParallels(P.c,a,st);drawParallels(P.c,a+Math.PI/2,st);}},
  {rot:false,draw:P=>{const st=30+Math.floor(P.r()*30),a=P.r()*Math.PI;for(let i=0;i<3;i++)drawParallels(P.c,a+i*Math.PI/3,st);}},
  {rot:false,draw:P=>{const a=0.4+P.r()*0.4;drawParallels(P.c,a,30+Math.floor(P.r()*30));drawParallels(P.c,-a,30+Math.floor(P.r()*30));}},
  {rot:true,draw:P=>{ // 5. кирпич
    const{c,r}=P, bh=16+Math.floor(r()*22), bw=bh*2+Math.floor(r()*30), mottled=r()<0.6;
    for(let row=Math.floor(-PAT_M/bh);row*bh<RS+PAT_M;row++){const y=row*bh,off=(row&1)*bw/2;
      for(let x=-PAT_M+off-bw;x<RS+PAT_M;x+=bw){if(mottled){c.fillStyle=tone(P,(r()-0.5)*10);c.fillRect(x,y,bw,bh);}c.strokeRect(x,y,bw,bh);}}}},
  {rot:false,draw:P=>{ // 6. концентрические круги
    const{c,r}=P, rs=22+Math.floor(r()*30), rays=r()<0.4?Math.floor(8+r()*16):0;
    for(let rad=rs;rad<RS*0.75;rad+=rs){c.beginPath();c.arc(RS/2,RS/2,rad,0,Math.PI*2);c.stroke();}
    for(let i=0;i<rays;i++){const a=i/rays*Math.PI*2;line(c,RS/2+Math.cos(a)*rs,RS/2+Math.sin(a)*rs,RS/2+Math.cos(a)*RS,RS/2+Math.sin(a)*RS);}}},
  {rot:false,draw:P=>{ // 7. неровные плиты
    const{c,r}=P, st=40+Math.floor(r()*40), n=Math.max(4,Math.round(RS/st)), cs=RS/n, jt=cs*0.22, G=[];
    for(let i=0;i<=n;i++){G.push([]);for(let k=0;k<=n;k++){const e=(i===0||i===n||k===0||k===n);
      G[i].push([i*cs+(e?0:(r()-0.5)*2*jt),k*cs+(e?0:(r()-0.5)*2*jt)]);}}
    for(let i=0;i<n;i++)for(let k=0;k<n;k++){
      c.fillStyle=tone(P,(r()-0.5)*8);c.beginPath();
      for(const[a,b]of[[i,k],[i+1,k],[i+1,k+1],[i,k+1]]){const p=G[a][b];(a===i&&b===k)?c.moveTo(p[0],p[1]):c.lineTo(p[0],p[1]);}
      c.closePath();c.fill();c.stroke();}}},
  {rot:false,draw:P=>{ // 8. соты
    const{c,r}=P, R=15+Math.floor(r()*17), w=1.5*R, h=Math.sqrt(3)*R, mode=r()<0.5;
    for(let col=-1;col*w<RS+w;col++)for(let row=-1;row*h<RS+h;row++){
      hexPath(c,col*w,row*h+((col&1)?h/2:0),R);
      if(mode){c.fillStyle=tone(P,(r()-0.5)*9);c.fill();}c.stroke();}}},
  {rot:false,draw:P=>{ // 9. волны
    const{c,r}=P, amp=5+r()*12, fr=0.01+r()*0.03, ph=r()*6.28, ws=25+Math.floor(r()*35);
    for(let y=ws;y<RS;y+=ws){c.beginPath();for(let x=0;x<=RS;x+=4){const wy=y+Math.sin(x*fr+ph)*amp;x?c.lineTo(x,wy):c.moveTo(x,wy);}c.stroke();}}},
  {rot:true,draw:P=>{ // 10. чешуя
    const{c,r}=P, tw=30+Math.floor(r()*26), tH=tw*0.8;
    for(let row=Math.floor(-PAT_M/tH);row*tH<RS+PAT_M;row++){const off=(row&1)*(tw/2);
      for(let x=-PAT_M-tw;x<RS+PAT_M;x+=tw){c.beginPath();c.arc(x+off+tw/2,row*tH+tH,tw/2,Math.PI,Math.PI*2);c.stroke();}}}},
  {rot:true,draw:P=>{ // 11. доски
    const{c,r}=P, bw=20+Math.floor(r()*18);
    for(let y=-PAT_M;y<RS+PAT_M;y+=bw){let x=-PAT_M-r()*200;
      while(x<RS+PAT_M){const len=110+r()*160;
        c.fillStyle=tone(P,(r()-0.5)*8);c.fillRect(x,y,len,bw);c.strokeRect(x,y,len,bw);
        c.save();c.strokeStyle=tone(P,-10,0.35);c.lineWidth=1;const n=1+Math.floor(r()*3);
        for(let g=1;g<=n;g++){const gy=y+bw*g/(n+1)+(r()-0.5)*3;line(c,x+4,gy,x+len-4,gy+(r()-0.5)*4);}
        c.restore();x+=len;}}}},
  {rot:false,draw:P=>{ // 12. булыжник
    const{c,r}=P, st=18+Math.floor(r()*18);
    c.fillStyle=tone(P,-12);c.fillRect(0,0,RS,RS);
    for(let x=-st;x<RS+st;x+=st)for(let y=-st;y<RS+st;y+=st){
      const cx=x+st/2+(r()-0.5)*st*0.4,cy=y+st/2+(r()-0.5)*st*0.4,rx=st*(0.36+r()*0.14),ry=st*(0.36+r()*0.14),a=r()*Math.PI;
      c.fillStyle=tone(P,(r()-0.5)*12+2);c.beginPath();c.ellipse(cx,cy,rx,ry,a,0,Math.PI*2);c.fill();c.stroke();
      c.fillStyle='rgba(255,255,255,0.07)';c.beginPath();c.ellipse(cx-rx*0.25,cy-ry*0.25,rx*0.4,ry*0.3,a,0,Math.PI*2);c.fill();}}},
  {rot:true,draw:P=>{ // 13. плетёнка
    const{c,r}=P, b=36+Math.floor(r()*28), n=2+Math.floor(r()*2);
    for(let x=-PAT_M;x<RS+PAT_M;x+=b)for(let y=-PAT_M;y<RS+PAT_M;y+=b){
      const i=Math.round(x/b),k=Math.round(y/b),h=((i+k)&1)===0;
      c.fillStyle=tone(P,h?2:-3);c.fillRect(x,y,b,b);c.strokeRect(x,y,b,b);
      for(let s=1;s<n;s++){h?line(c,x,y+b*s/n,x+b,y+b*s/n):line(c,x+b*s/n,y,x+b*s/n,y+b);}}}},
  {rot:false,draw:P=>{ // 14. ёлочка
    const{c,r}=P, w=14+Math.floor(r()*12);
    c.save();c.translate(RS/2,RS/2);c.rotate(Math.PI/4+(r()<0.5?0:Math.PI/2));c.translate(-RS/2,-RS/2);
    const n0=Math.floor(-PAT_M/w),n1=Math.ceil((RS+PAT_M)/w);
    for(let i=n0;i<n1;i++)for(let k=n0;k<n1;k++){
      const res=((i-k)%4+4)%4;if(res!==0&&res!==2)continue;
      c.fillStyle=tone(P,(r()-0.5)*9);
      if(res===0){c.fillRect(i*w,k*w,2*w,w);c.strokeRect(i*w,k*w,2*w,w);}
      else{c.fillRect(i*w,(k-1)*w,w,2*w);c.strokeRect(i*w,(k-1)*w,w,2*w);}}
    c.restore();}},
  {rot:true,draw:P=>{ // 15. октагоны
    const{c,r}=P, st=40+Math.floor(r()*36), ct=st*0.29;
    for(let x=-PAT_M;x<RS+PAT_M;x+=st)for(let y=-PAT_M;y<RS+PAT_M;y+=st){
      c.beginPath();c.moveTo(x+ct,y);c.lineTo(x+st-ct,y);c.lineTo(x+st,y+ct);c.lineTo(x+st,y+st-ct);
      c.lineTo(x+st-ct,y+st);c.lineTo(x+ct,y+st);c.lineTo(x,y+st-ct);c.lineTo(x,y+ct);c.closePath();c.stroke();
      c.fillStyle=tone(P,-7);c.beginPath();c.moveTo(x,y-ct);c.lineTo(x+ct,y);c.lineTo(x,y+ct);c.lineTo(x-ct,y);c.closePath();c.fill();c.stroke();}}},
  {rot:false,draw:P=>{ // 16. крупные плиты
    const{c,r}=P, min=50+r()*40;
    const split=(x,y,w,h,d)=>{
      if(d>5||(w<min*2&&h<min*2)||(d>1&&r()<0.25)){c.fillStyle=tone(P,(r()-0.5)*7);c.fillRect(x,y,w,h);c.strokeRect(x,y,w,h);return;}
      const t=0.35+r()*0.3;
      if(w>=h){split(x,y,w*t,h,d+1);split(x+w*t,y,w*(1-t),h,d+1);}else{split(x,y,w,h*t,d+1);split(x,y+h*t,w,h*(1-t),d+1);}
    };
    split(0,0,RS,RS,0);}},
  {rot:false,draw:P=>{ // 17. мозаика
    const{c,r}=P, st=9+Math.floor(r()*6), ring=r()<0.5;
    c.fillStyle=tone(P,-14);c.fillRect(0,0,RS,RS);
    for(let x=0;x<RS;x+=st)for(let y=0;y<RS;y+=st){
      const dist=Math.hypot(x+st/2-RS/2,y+st/2-RS/2),onRing=ring&&Math.abs(dist-150)<st*0.7;
      c.fillStyle=onRing?hsl(P.th.rugHue,35,40+(r()-0.5)*10):tone(P,(r()-0.5)*12);
      c.fillRect(x+1,y+1,st-2,st-2);}}},
];

// ---------- ИЗНОС, ТРЕЩИНЫ, ТЕНЬ У СТЕН ----------
function addWear(P){
  const{c,r}=P;
  const n=Math.floor(r()*4);
  for(let i=0;i<n;i++){const x=r()*RS,y=r()*RS,rad=40+r()*100;
    const g=c.createRadialGradient(x,y,0,x,y,rad);g.addColorStop(0,'rgba(0,0,0,0.2)');g.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=g;c.fillRect(x-rad,y-rad,rad*2,rad*2);}
  if(r()<0.35){const m=1+Math.floor(r()*4);
    for(let i=0;i<m;i++){const side=Math.floor(r()*4),t=r()*RS,rad=40+r()*70;
      const x=side<2?t:(side===2?0:RS),y=side===0?0:(side===1?RS:t),h=95+r()*30;
      const g=c.createRadialGradient(x,y,0,x,y,rad);g.addColorStop(0,hsl(h,35,28,0.45));g.addColorStop(1,hsl(h,35,28,0));
      c.fillStyle=g;c.fillRect(x-rad,y-rad,rad*2,rad*2);}}
  if(r()<0.5){const a=r()*Math.PI*2,gx=Math.cos(a)*RS/2,gy=Math.sin(a)*RS/2;
    const g=c.createLinearGradient(RS/2-gx,RS/2-gy,RS/2+gx,RS/2+gy);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,0.18)');
    c.fillStyle=g;c.fillRect(0,0,RS,RS);}
}
function drawCrack(P){
  const{c,r}=P;let x,y;
  do{x=r()*RS;y=r()*RS;}while(Math.hypot(x-RS/2,y-RS/2)<DECO_R+20);
  let a=r()*Math.PI*2;
  c.save();c.strokeStyle='rgba(0,0,0,0.35)';c.lineWidth=1.5;c.lineCap='round';
  c.beginPath();c.moveTo(x,y);
  const n=4+Math.floor(r()*6);
  for(let i=0;i<n;i++){a+=(r()-0.5)*1.4;const l=8+r()*22;x+=Math.cos(a)*l;y+=Math.sin(a)*l;c.lineTo(x,y);}
  c.stroke();c.restore();
}
function edgeShadow(c){
  const d=46;
  for(const[x1,y1,x2,y2]of[[0,0,0,d],[0,RS,0,RS-d],[0,0,d,0],[RS,0,RS-d,0]]){
    const g=c.createLinearGradient(x1,y1,x2,y2);g.addColorStop(0,'rgba(0,0,0,0.45)');g.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=g;c.fillRect(0,0,RS,RS);}
}

// ---------- ДЕКОР (всегда вне центральной зоны DECO_R) ----------
function pickSpot(r,w,h,tries=12){
  for(let i=0;i<tries;i++){
    const x=30+r()*(RS-60-w),y=30+r()*(RS-60-h);
    const cx=Math.max(x,Math.min(RS/2,x+w)),cy=Math.max(y,Math.min(RS/2,y+h));
    if(Math.hypot(cx-RS/2,cy-RS/2)>DECO_R)return{x,y};
  }
  return null;
}
function addDecor(P){
  const{r}=P;
  if(r()<DECOR.rug)drawRug(P);
  const n=Math.floor(r()*DECOR.props);
  for(let i=0;i<n;i++){const k=r();
    if(k<0.3)drawPuddle(P);else if(k<0.6)drawRubble(P);else if(k<0.8)drawGrate(P);else drawBones(P);}
}
function drawRug(P){
  const{c,r,th}=P;let x,y,w,h,horiz;
  const kind=Math.floor(r()*3),INSET=52,FR=8;
  if(kind===0){
    horiz=r()<0.5;
    const maxLen=RS-2*(INSET+FR);
    const len=Math.min(160+r()*120,maxLen),wid=48+r()*18;
    const start=INSET+FR+r()*(maxLen-len);
    if(horiz){w=len;h=wid;x=start;y=r()<0.5?INSET:RS-INSET-h;}
    else{w=wid;h=len;y=start;x=r()<0.5?INSET:RS-INSET-w;}
  }else if(kind===1){
    const side=Math.floor(r()*4),len=90,wid=46;horiz=side<2;
    if(side===0){w=len;h=wid;x=(RS-w)/2;y=WALL_T/2+6;}
    else if(side===1){w=len;h=wid;x=(RS-w)/2;y=RS-WALL_T/2-6-h;}
    else if(side===2){w=wid;h=len;y=(RS-h)/2;x=WALL_T/2+6;}
    else{w=wid;h=len;y=(RS-h)/2;x=RS-WALL_T/2-6-w;}
  }else{
    const sz=60+r()*40;w=sz;h=sz*(0.7+r()*0.4);horiz=w>=h;
    x=r()<0.5?INSET:RS-INSET-w;y=r()<0.5?INSET:RS-INSET-h;
  }
  const hue=th.rugHue,base=hsl(hue,42,30),light=hsl(hue,50,55),dark=hsl(hue,45,18);
  c.save();
  c.fillStyle='rgba(0,0,0,0.3)';c.fillRect(x+3,y+4,w,h);
  c.fillStyle=base;c.fillRect(x,y,w,h);
  c.strokeStyle=light;c.lineWidth=3;c.strokeRect(x+6,y+6,w-12,h-12);
  c.strokeStyle=dark;c.lineWidth=1.5;c.strokeRect(x+11,y+11,w-22,h-22);
  const ix=x+16,iy=y+16,iw=w-32,ih=h-32;
  c.save();c.beginPath();c.rect(ix,iy,iw,ih);c.clip();
  const orn=Math.floor(r()*3);
  if(orn===0){const d=Math.min(iw,ih)*0.5;
    for(let px=ix;px<ix+iw+d;px+=d)for(let py=iy;py<iy+ih+d;py+=d){
      c.fillStyle=light;c.beginPath();c.moveTo(px,py-d/2);c.lineTo(px+d/2,py);c.lineTo(px,py+d/2);c.lineTo(px-d/2,py);c.closePath();c.fill();
      c.fillStyle=dark;c.beginPath();c.moveTo(px,py-d/5);c.lineTo(px+d/5,py);c.lineTo(px,py+d/5);c.lineTo(px-d/5,py);c.closePath();c.fill();}
  }else if(orn===1){c.fillStyle=light;const st=12;
    if(horiz)for(let px=ix;px<ix+iw;px+=st*2)c.fillRect(px,iy,st,ih);else for(let py=iy;py<iy+ih;py+=st*2)c.fillRect(ix,py,iw,st);
  }else{c.fillStyle=light;for(let px=ix+8;px<ix+iw;px+=16)for(let py=iy+8;py<iy+ih;py+=16){c.fillRect(px-1,py-4,2,8);c.fillRect(px-4,py-1,8,2);}}
  c.restore();
  c.strokeStyle=light;c.lineWidth=1.5;
  if(horiz){for(let py=y+4;py<y+h-2;py+=5){line(c,x,py,x-FR,py);line(c,x+w,py,x+w+FR,py);}}
  else{for(let px=x+4;px<x+w-2;px+=5){line(c,px,y,px,y-FR);line(c,px,y+h,px,y+h+FR);}}
  c.restore();
}
function drawPuddle(P){
  const{c,r}=P,w=50+r()*70,h=w*(0.5+r()*0.4),s=pickSpot(r,w,h);if(!s)return;
  const cx=s.x+w/2,cy=s.y+h/2;c.save();
  c.fillStyle='rgba(15,30,50,0.35)';c.strokeStyle='rgba(0,0,0,0.25)';c.lineWidth=1.5;
  c.beginPath();c.ellipse(cx,cy,w/2,h/2,(r()-0.5)*0.6,0,Math.PI*2);c.fill();c.stroke();
  c.fillStyle='rgba(255,255,255,0.10)';c.beginPath();c.ellipse(cx-w*0.15,cy-h*0.15,w*0.22,h*0.14,0,0,Math.PI*2);c.fill();
  c.restore();
}
function drawRubble(P){
  const{c,r}=P,s=pickSpot(r,70,70);if(!s)return;const n=5+Math.floor(r()*8);
  c.save();c.strokeStyle='rgba(0,0,0,0.4)';c.lineWidth=1;
  for(let i=0;i<n;i++){const x=s.x+r()*70,y=s.y+r()*70,rad=2+r()*5;
    c.fillStyle=tone(P,r()>0.5?8:-10);c.beginPath();
    for(let k=0;k<6;k++){const a=k/6*Math.PI*2,rr=rad*(0.7+r()*0.5);k?c.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr):c.moveTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}
    c.closePath();c.fill();c.stroke();}
  c.restore();
}
function drawGrate(P){
  const{c,r}=P,d=36+r()*20,s=pickSpot(r,d,d);if(!s)return;const cx=s.x+d/2,cy=s.y+d/2;
  c.save();
  c.fillStyle='#0c0c0e';c.beginPath();c.arc(cx,cy,d/2,0,Math.PI*2);c.fill();
  c.strokeStyle='#3a3a3f';c.lineWidth=2;c.stroke();
  c.clip();c.lineWidth=3;
  for(let x=-d/2+5;x<d/2;x+=7)line(c,cx+x,cy-d/2,cx+x,cy+d/2);
  c.restore();
}
function drawBones(P){
  const{c,r}=P,s=pickSpot(r,60,60);if(!s)return;const n=2+Math.floor(r()*3);
  c.save();c.lineCap='round';
  for(let i=0;i<n;i++){const x=s.x+10+r()*40,y=s.y+10+r()*40,a=r()*Math.PI,l=12+r()*16,dx=Math.cos(a)*l/2,dy=Math.sin(a)*l/2;
    c.strokeStyle='rgba(0,0,0,0.35)';c.lineWidth=5;line(c,x-dx+1,y-dy+2,x+dx+1,y+dy+2);
    c.strokeStyle='#d9d2bd';c.lineWidth=3;line(c,x-dx,y-dy,x+dx,y+dy);
    c.fillStyle='#d9d2bd';for(const[ex,ey]of[[x-dx,y-dy],[x+dx,y+dy]]){c.beginPath();c.arc(ex,ey,2.5,0,Math.PI*2);c.fill();}}
  c.restore();
}

// ============================================================
// ФАКЕЛЫ: 0–2 на комнату, детерминированно
// ============================================================
function getTorches(rx,ry){
  checkCacheSeed();
  const key=rx+','+ry;
  if(torchCache.has(key))return torchCache.get(key);
  const rng=mulberry32(roomSeed(rx,ry)^0x9e3779b9),list=[];
  const count=rng()<0.35?0:(rng()<0.6?1:2);
  for(let i=0;i<count;i++)list.push({side:DIRS[Math.floor(rng()*4)],t:rng()<0.5?0.25:0.75,ph:rng()*10});
  torchCache.set(key,list);
  if(torchCache.size>4000)torchCache.clear();
  return list;
}

// Оставлено для совместимости со старым кодом (нигде больше не используется)
function roomColor(x,y){
  const th=roomTheme(x,y);
  return hsl(th.floor[0],th.floor[1],th.floorL);
}
