'use strict';

// ============================================================
// 15. МОДАЛЬНОЕ ОКНО
// ============================================================
const modal=document.getElementById('modal');
let modalCb=null;
function showModal(title,text,onYes,okOnly){
  document.getElementById('modalTitle').textContent=title;
  document.getElementById('modalText').textContent=text;
  document.getElementById('modalNo').style.display = okOnly ? 'none' : '';
  modalCb=onYes;
  modal.classList.add('show');
}
document.getElementById('modalYes').onclick=()=>{
  modal.classList.remove('show');
  const cb=modalCb; modalCb=null;
  if (cb) cb();
};
document.getElementById('modalNo').onclick=()=>{ modal.classList.remove('show'); modalCb=null; };
