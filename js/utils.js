'use strict';

// 3. УТИЛИТЫ
// ============================================================
function mulberry32(seed){
  return function(){
    seed|=0; seed=seed+0x6D2B79F5|0;
    let t=Math.imul(seed^seed>>>15,1|seed);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return((t^t>>>14)>>>0)/4294967296;
  };
}
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function easeInOut(t){ return t<0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }
function approach(c,t,s){ const d=t-c; return Math.abs(d)<=s?t:c+Math.sign(d)*s; }
function shuffle(a,rnd){
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
