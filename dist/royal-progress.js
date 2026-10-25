'use strict';

// Day-five information records an earned milestone. Its dialog grants neither
// money nor items; the armoury's three shipments use the normal contract ledger.
const RoyalProgress=(()=>{
  function ensure(){
    if(!state.story)return null;
    const r=state.story.royalProgress??={version:1,notified:false};
    r.version=1;r.notified=!!r.notified;
    if(state.day>=5)r.unlockedAt??=state.story.elapsed||0;
    return r;
  }
  function advance(){
    const r=ensure();
    if(!r||r.notified||state.day<5||!state.started||state.paused||state.ended||state.autoSorting||state.tutorial?.active||document.hidden||drag||state.selected!==null||BagPour.active()||Restoration.active()||!$('modal').classList.contains('hidden'))return false;
    r.notified=true;r.notifiedAt=state.story.elapsed||0;save();
    modal('<section id="royalRankNotice"><span class="brief-eyebrow">ПЯТЫЙ ДЕНЬ · НОВЫЙ КЛИЕНТ</span><h2>Рейтинг лавки вырос</h2><p>Появились новые покупатели с элитными товарами.</p><p>Королевская оружейная предлагает договор на три поставки: по 5 мечей, 5 кинжалов и 5 шлемов. За каждую настоящую посылку из 15 вещей — 360 монет.</p><button id="royalRankContinue" class="primary">Продолжить</button></section>',{wide:true});
    $('royalRankContinue').onclick=()=>{r.acknowledgedAt=state.story.elapsed||0;closeModal();render();save();};
    return true;
  }
  function afterLoad(){ensure();}
  return {ensure,advance,afterLoad};
})();
