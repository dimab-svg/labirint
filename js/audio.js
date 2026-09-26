'use strict';

// ============================================================
// ЗВУК — полностью процедурный, на Web Audio API.
// Ни одного mp3: все звуки синтезируются в браузере из осцилляторов
// и шума. Поэтому игра остаётся одним файлом и ничего не грузит.
//
// Как пользоваться из кода игры:
//   Snd.play('step')            — разовый звук
//   Snd.play('pickup',{v:0.8})  — с громкостью
//   Snd.at('claw', wx, wy)      — звук в точке мира (громкость+панорама от игрока)
//   Snd.setTension(0..1)        — напряжённость музыки (0 покой, 1 погоня)
//   Snd.setMusic(true/false)    — фоновая музыка вкл/выкл
//
// Громкости и тембры правятся в SND_CFG ниже.
// ============================================================

const SND_CFG = {
  master: 0.7,          // общая громкость
  music:  0.45,         // громкость музыки
  sfx:    0.8,          // громкость эффектов
  maxDistance: 620,     // дальше этого мировые звуки не слышны
  panWidth: 420,        // на этом удалении по X панорама уже крайняя
};

const Snd = (() => {
  let ac=null, master=null, musicBus=null, sfxBus=null, comp=null;
  let ready=false, enabled=true, musicOn=true;
  let noiseBuf=null;
  let music=null;                 // объект живой музыки
  let tension=0, tensionTarget=0;

  // ---------- инициализация (только после жеста пользователя) ----------
  function init(){
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ac = new AC(); } catch(e){ return false; }

    comp = ac.createDynamicsCompressor();      // чтобы взрывы не перегружали
    comp.threshold.value=-14; comp.knee.value=18;
    comp.ratio.value=6; comp.attack.value=0.004; comp.release.value=0.22;

    master = ac.createGain();  master.gain.value = enabled?SND_CFG.master:0;
    musicBus = ac.createGain(); musicBus.gain.value = SND_CFG.music;
    sfxBus = ac.createGain();   sfxBus.gain.value = SND_CFG.sfx;

    musicBus.connect(master); sfxBus.connect(master);
    master.connect(comp); comp.connect(ac.destination);

    // общий буфер розоватого шума — основа для шагов, взрывов, ветра
    const len = ac.sampleRate*2;
    noiseBuf = ac.createBuffer(1,len,ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let b0=0,b1=0,b2=0;
    for (let i=0;i<len;i++){
      const w=Math.random()*2-1;
      b0=0.99765*b0+w*0.0990460; b1=0.96300*b1+w*0.2965164; b2=0.57000*b2+w*1.0526913;
      d[i]=(b0+b1+b2+w*0.1848)*0.22;
    }
    ready=true;
    if (musicOn) startMusic();
    return true;
  }

  function resume(){
    if (!ac && !init()) return;
    if (ac.state==='suspended') ac.resume();
  }

  const now = ()=>ac.currentTime;

  // ---------- кирпичики синтеза ----------
  // Огибающая: быстрая атака, экспоненциальный спад
  function env(g,t0,peak,attack,dur,sustain=0){
    g.gain.cancelScheduledValues(t0);
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001,peak),t0+attack);
    if (sustain>0) g.gain.setValueAtTime(Math.max(0.0001,peak),t0+attack+sustain);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+attack+sustain+dur);
  }

  // Тон: осциллятор с опциональным глиссандо и фильтром
  function tone(o={}){
    if (!ready) return;
    const t0 = (o.t||now())+(o.delay||0);
    const osc = ac.createOscillator();
    osc.type = o.type||'sine';
    osc.frequency.setValueAtTime(o.f||220,t0);
    if (o.f2) osc.frequency[o.exp===false?'linearRampToValueAtTime':'exponentialRampToValueAtTime'](o.f2,t0+(o.dur||0.2));
    if (o.detune) osc.detune.value=o.detune;
    const g = ac.createGain();
    env(g,t0,o.v??0.2,o.a??0.005,o.dur??0.2,o.s||0);
    let node=osc;
    if (o.filter){
      const f=ac.createBiquadFilter();
      f.type=o.filter; f.frequency.value=o.ff||1200; f.Q.value=o.q||1;
      if (o.ff2) f.frequency.exponentialRampToValueAtTime(o.ff2,t0+(o.dur||0.2));
      node.connect(f); node=f;
    }
    node.connect(g);
    g.connect(o.out||sfxBus);
    osc.start(t0);
    osc.stop(t0+(o.a??0.005)+(o.s||0)+(o.dur??0.2)+0.05);
  }

  // Шумовой всплеск — шаги, взрывы, искры
  function noise(o={}){
    if (!ready) return;
    const t0=(o.t||now())+(o.delay||0);
    const src=ac.createBufferSource();
    src.buffer=noiseBuf; src.loop=true;
    src.playbackRate.value=o.rate||1;
    const f=ac.createBiquadFilter();
    f.type=o.filter||'bandpass';
    f.frequency.setValueAtTime(o.ff||900,t0);
    if (o.ff2) f.frequency.exponentialRampToValueAtTime(o.ff2,t0+(o.dur||0.2));
    f.Q.value=o.q||1;
    const g=ac.createGain();
    env(g,t0,o.v??0.2,o.a??0.004,o.dur??0.2,o.s||0);
    src.connect(f); f.connect(g); g.connect(o.out||sfxBus);
    src.start(t0); src.stop(t0+(o.a??0.004)+(o.s||0)+(o.dur??0.2)+0.05);
  }

  // ---------- библиотека эффектов ----------
  // Каждый эффект — функция (opts) => void. v: множитель громкости, out: узел.
  const FX = {
    // шаг игрока по камню: глухой удар + шорох крошки
    step(o={}){
      const v=o.v??1, out=o.out;
      noise({v:0.16*v, ff:420, ff2:180, q:1.2, dur:0.09, filter:'lowpass', out});
      noise({v:0.05*v, ff:2600, q:0.7, dur:0.05, delay:0.012, out});
      tone({f:92, f2:58, type:'sine', v:0.1*v, dur:0.08, out});
    },
    // цокот когтей монстра — сухой щелчок
    claw(o={}){
      const v=o.v??1, out=o.out;
      noise({v:0.4*v, ff:2400+Math.random()*900, q:5, dur:0.035, filter:'bandpass', out});
      tone({f:1500+Math.random()*400, f2:700, type:'triangle', v:0.1*v, dur:0.03, out});
    },
    // тяжёлое копыто босса
    hoof(o={}){
      const v=o.v??1, out=o.out;
      noise({v:0.3*v, ff:240, ff2:90, q:1, dur:0.16, filter:'lowpass', out});
      tone({f:64, f2:38, type:'sine', v:0.28*v, dur:0.2, out});
      noise({v:0.06*v, ff:1800, q:2, dur:0.05, delay:0.01, out});
    },
    // шаг ящера — мягче когтей, с подскрёбом
    scrape(o={}){
      const v=o.v??1, out=o.out;
      noise({v:0.24*v, ff:1100, ff2:2200, q:2.5, dur:0.08, out});
      tone({f:170, f2:110, type:'triangle', v:0.11*v, dur:0.07, out});
    },

    // подбор предмета — светлое арпеджио вверх
    pickup(o={}){
      const v=o.v??1, t=now();
      [660,880,1320].forEach((f,i)=>tone({f,type:'triangle',v:0.12*v,dur:0.13,a:0.004,t,delay:i*0.045}));
    },
    star(o={}){                  // звезда — ярче и с блеском
      const v=o.v??1, t=now();
      [784,1046,1568,2093].forEach((f,i)=>tone({f,type:'sine',v:0.11*v,dur:0.22,t,delay:i*0.05}));
      noise({v:0.04*v, ff:6000, q:1.5, dur:0.3, delay:0.05});
    },
    coin(o={}){                  // деньги — звон монет
      const v=o.v??1, t=now();
      for (let i=0;i<3;i++)
        tone({f:1750+Math.random()*700, f2:1200, type:'square', v:0.09*v, dur:0.1, t, delay:i*0.035});
    },
    key(o={}){                   // ключ — металлический призвук
      const v=o.v??1, t=now();
      tone({f:520,f2:780,type:'triangle',v:0.13*v,dur:0.3,t});
      tone({f:1560,type:'sine',v:0.05*v,dur:0.4,t,delay:0.06});
      noise({v:0.05*v, ff:3400, q:6, dur:0.25, delay:0.02});
    },
    // замок открылся — щелчок механизма и лязг
    unlock(o={}){
      const v=o.v??1;
      noise({v:0.16*v, ff:1600, q:8, dur:0.05});
      tone({f:300,f2:180,type:'square',v:0.08*v,dur:0.1,delay:0.05});
      tone({f:880,f2:1320,type:'triangle',v:0.1*v,dur:0.35,delay:0.12});
    },
    // дверь: скрип петель + удар створки
    doorOpen(o={}){
      const v=o.v??1;
      noise({v:0.13*v, ff:700, ff2:1500, q:7, dur:0.34, filter:'bandpass'});
      tone({f:120, f2:190, type:'sawtooth', v:0.06*v, dur:0.32, filter:'lowpass', ff:900});
    },
    doorClose(o={}){
      const v=o.v??1;
      noise({v:0.2*v, ff:300, ff2:120, q:1, dur:0.18, filter:'lowpass'});
      tone({f:96, f2:52, type:'sine', v:0.16*v, dur:0.22});
    },
    // телепортация — восходящий свист и вспышка
    teleport(o={}){
      const v=o.v??1, t=now();
      tone({f:180,f2:2400,type:'sine',v:0.14*v,dur:0.45,t});
      tone({f:270,f2:3200,type:'triangle',v:0.07*v,dur:0.45,t,delay:0.03});
      noise({v:0.1*v, ff:600, ff2:7000, q:1.5, dur:0.5, t});
      noise({v:0.12*v, ff:4000, ff2:400, q:1, dur:0.5, t, delay:0.42});
    },
    // взрыв гранаты — щелчок, низкий бум, долгий хвост
    explosion(o={}){
      const v=o.v??1, t=now();
      noise({v:0.5*v, ff:1800, ff2:120, q:0.6, dur:0.55, filter:'lowpass', t});
      tone({f:150, f2:34, type:'sine', v:0.5*v, dur:0.6, t});
      tone({f:80, f2:28, type:'square', v:0.16*v, dur:0.45, filter:'lowpass', ff:400, t});
      noise({v:0.13*v, ff:2600, ff2:700, q:0.8, dur:1.1, t, delay:0.07});
    },
    // бросок гранаты
    throw_(o={}){
      const v=o.v??1;
      noise({v:0.2*v, ff:1200, ff2:2600, q:2, dur:0.14});
    },
    // разряд аномалии — электрический треск
    zap(o={}){
      const v=o.v??1, t=now(), out=o.out;
      for (let i=0;i<5;i++)
        noise({v:0.13*v, ff:2000+Math.random()*4000, q:9, dur:0.04, t, delay:i*0.022, out});
      tone({f:3000,f2:400,type:'sawtooth',v:0.07*v,dur:0.2,filter:'highpass',ff:900,t,out});
      tone({f:60,type:'sine',v:0.1*v,dur:0.25,t,delay:0.03,out});
    },
    // монстр заметил игрока — рык
    alert(o={}){
      const v=o.v??1, out=o.out;
      tone({f:220,f2:130,type:'sawtooth',v:0.14*v,dur:0.4,filter:'lowpass',ff:1400,ff2:500,out});
      noise({v:0.08*v, ff:500, ff2:200, q:2, dur:0.4, out});
    },
    // рык босса — ниже и длиннее
    roar(o={}){
      const v=o.v??1, out=o.out, t=now();
      tone({f:110,f2:62,type:'sawtooth',v:0.26*v,dur:0.9,s:0.15,filter:'lowpass',ff:900,ff2:300,t,out});
      tone({f:74,f2:44,type:'square',v:0.14*v,dur:0.9,s:0.15,filter:'lowpass',ff:500,t,out});
      noise({v:0.1*v, ff:380, ff2:140, q:1.5, dur:1.0, t, out});
    },
    // монстр ранен
    hurt(o={}){
      const v=o.v??1, out=o.out;
      tone({f:400,f2:120,type:'sawtooth',v:0.14*v,dur:0.22,filter:'lowpass',ff:1600,out});
      noise({v:0.1*v, ff:900, ff2:300, q:2, dur:0.2, out});
    },
    // монстр погиб
    kill(o={}){
      const v=o.v??1, out=o.out, t=now();
      tone({f:300,f2:60,type:'sawtooth',v:0.16*v,dur:0.5,filter:'lowpass',ff:1200,ff2:200,t,out});
      noise({v:0.14*v, ff:1200, ff2:150, q:1, dur:0.6, t, out});
    },
    // монстр съел приманку
    munch(o={}){
      const v=o.v??1, out=o.out, t=now();
      for (let i=0;i<3;i++)
        noise({v:0.22*v, ff:500+i*200, ff2:200, q:3, dur:0.09, t, delay:i*0.11, out});
    },
    // игрока поймали — проигрыш
    death(o={}){
      const v=o.v??1, t=now();
      tone({f:330,f2:55,type:'sawtooth',v:0.3*v,dur:1.4,filter:'lowpass',ff:1800,ff2:220,t});
      tone({f:110,f2:41,type:'sine',v:0.26*v,dur:1.6,t,delay:0.05});
      noise({v:0.12*v, ff:800, ff2:120, q:1, dur:1.5, t});
    },
    // победа
    win(o={}){
      const v=o.v??1, t=now();
      [523,659,784,1046,1319].forEach((f,i)=>{
        tone({f,type:'triangle',v:0.14*v,dur:0.5,s:0.1,t,delay:i*0.13});
        tone({f:f*2,type:'sine',v:0.05*v,dur:0.5,t,delay:i*0.13+0.02});
      });
    },
    // звезда защиты израсходована
    shield(o={}){
      const v=o.v??1, t=now();
      tone({f:1200,f2:400,type:'sine',v:0.18*v,dur:0.5,t});
      noise({v:0.1*v, ff:5000, ff2:800, q:1, dur:0.5, t});
    },
    // клик по интерфейсу
    ui(o={}){
      tone({f:660,f2:880,type:'triangle',v:0.06*(o.v??1),dur:0.06});
    },
    // отказ / нельзя
    deny(o={}){
      const v=o.v??1;
      tone({f:200,f2:150,type:'square',v:0.1*v,dur:0.12,filter:'lowpass',ff:900});
    },
  };

  // ---------- фоновая музыка ----------
  // Два слоя: спокойный гул подземелья и тревожный слой погони.
  // Между ними плавный кроссфейд по Snd.setTension().
  function startMusic(){
    if (!ready || music) return;
    const t=now();

    // --- слой 1: спокойный гул ---
    const calm=ac.createGain(); calm.gain.value=1; calm.connect(musicBus);
    const drone=[]; 
    [55,82.5,110].forEach((f,i)=>{                 // ля: основа + квинта + октава
      const o=ac.createOscillator(); o.type=i===2?'triangle':'sawtooth';
      o.frequency.value=f; o.detune.value=(i-1)*6;
      const g=ac.createGain(); g.gain.value=i===0?0.1:0.045;
      const lp=ac.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=320; lp.Q.value=2;
      o.connect(lp); lp.connect(g); g.connect(calm); o.start(t);
      // медленное «дыхание» фильтра
      const lfo=ac.createOscillator(); lfo.frequency.value=0.05+i*0.017;
      const la=ac.createGain(); la.gain.value=120;
      lfo.connect(la); la.connect(lp.frequency); lfo.start(t);
      drone.push(o,lfo);
    });
    // шум ветра в коридорах
    const wind=ac.createBufferSource(); wind.buffer=noiseBuf; wind.loop=true;
    const wf=ac.createBiquadFilter(); wf.type='bandpass'; wf.frequency.value=380; wf.Q.value=0.8;
    const wg=ac.createGain(); wg.gain.value=0.05;
    wind.connect(wf); wf.connect(wg); wg.connect(calm); wind.start(t);
    const wlfo=ac.createOscillator(); wlfo.frequency.value=0.037;
    const wla=ac.createGain(); wla.gain.value=180;
    wlfo.connect(wla); wla.connect(wf.frequency); wlfo.start(t);

    // --- слой 2: тревога (молчит, пока tension=0) ---
    const alarm=ac.createGain(); alarm.gain.value=0; alarm.connect(musicBus);
    const pulse=ac.createOscillator(); pulse.type='sawtooth'; pulse.frequency.value=41.2;
    const pf=ac.createBiquadFilter(); pf.type='lowpass'; pf.frequency.value=260; pf.Q.value=6;
    const pg=ac.createGain(); pg.gain.value=0.22;
    pulse.connect(pf); pf.connect(pg); pg.connect(alarm); pulse.start(t);
    // тритон — характерная «тревожная» краска
    const trit=ac.createOscillator(); trit.type='triangle'; trit.frequency.value=58.3;
    const tg=ac.createGain(); tg.gain.value=0.07;
    trit.connect(tg); tg.connect(alarm); trit.start(t);
    // биение сердца: LFO по громкости
    const hb=ac.createOscillator(); hb.type='sine'; hb.frequency.value=1.6;
    const hba=ac.createGain(); hba.gain.value=0.5;
    const hbOff=ac.createConstantSource(); hbOff.offset.value=0.5; hbOff.start(t);
    hb.connect(hba); hba.connect(pg.gain); hbOff.connect(pg.gain); hb.start(t);

    music={calm,alarm,pulse,pf,hb,nodes:[...drone,wind,wlfo,pulse,trit,hb,hbOff]};
  }

  function stopMusic(){
    if (!music) return;
    try { music.nodes.forEach(n=>{ try{n.stop();}catch(e){} }); } catch(e){}
    try { music.calm.disconnect(); music.alarm.disconnect(); } catch(e){}
    music=null;
  }

  // Плавное ведение напряжённости — вызывается каждый кадр
  function update(dt){
    if (!ready||!music) return;
    const sp = tensionTarget>tension ? 2.2 : 0.55;    // нарастает быстро, спадает медленно
    tension += clampN(tensionTarget-tension, -sp*dt, sp*dt);
    const t=now();
    music.calm.gain.setTargetAtTime(1-0.65*tension, t, 0.25);
    music.alarm.gain.setTargetAtTime(tension*0.9, t, 0.25);
    music.hb.frequency.setTargetAtTime(1.5+tension*1.4, t, 0.4);   // пульс учащается
    music.pf.frequency.setTargetAtTime(240+tension*680, t, 0.3);
  }
  const clampN=(v,a,b)=>v<a?a:v>b?b:v;

  // ---------- пространственный звук ----------
  // Громкость и панорама считаются от положения игрока (центр экрана).
  function spatial(wx,wy){
    if (typeof camX!=='number') return {v:1,pan:0};
    const dx=wx-camX, dy=wy-camY;
    const d=Math.hypot(dx,dy);
    if (d>SND_CFG.maxDistance) return null;
    const v=Math.pow(1-d/SND_CFG.maxDistance,1.8);
    const pan=clampN(dx/SND_CFG.panWidth,-1,1);
    return {v,pan};
  }

  // ---------- публичный интерфейс ----------
  function play(name,o={}){
    if (!enabled||!ready) return;
    const fx=FX[name]||FX[name+'_'];
    if (!fx) return;
    try { fx(o); } catch(e){}
  }

  function at(name,wx,wy,o={}){
    if (!enabled||!ready) return;
    const s=spatial(wx,wy);
    if (!s) return;
    let out=sfxBus;
    if (ac.createStereoPanner){          // панорама, если браузер умеет
      const p=ac.createStereoPanner();
      p.pan.value=s.pan; p.connect(sfxBus); out=p;
    }
    play(name,{...o, v:(o.v??1)*s.v, out});
  }

  return {
    init, resume, play, at, update,
    get ready(){ return ready; },
    get enabled(){ return enabled; },
    setEnabled(on){
      enabled=!!on;
      if (ready) master.gain.setTargetAtTime(enabled?SND_CFG.master:0, now(), 0.05);
    },
    setMusic(on){
      musicOn=!!on;
      if (!ready) return;
      if (musicOn) { startMusic(); musicBus.gain.setTargetAtTime(SND_CFG.music,now(),0.3); }
      else musicBus.gain.setTargetAtTime(0,now(),0.3);
    },
    get musicOn(){ return musicOn; },
    setVolume(v){ SND_CFG.master=v; if (ready&&enabled) master.gain.setTargetAtTime(v,now(),0.05); },
    getVolume(){ return SND_CFG.master; },
    setTension(v){ tensionTarget=clampN(v,0,1); },
    getTension(){ return tension; },
    reset(){ tension=0; tensionTarget=0; },
  };
})();
