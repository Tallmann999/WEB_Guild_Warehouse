'use strict';

// Earned notices have saved pending/acknowledged state. They never own payments.
const RoyalProgress=(()=>{
  const upgrades={
    clean:{level:2,name:'Ухоженная лавка',items:['Найм Борина за 120 монет — после первой посылки второго дня.','Автоматическая сортировка: 2 монеты за партию, 2,5 секунды на вещь.','После первой работы Борина — снабжение городской кухни: две посылки по 200 монет.']},
    furnish:{level:3,name:'Обустроенная лавка',items:['Грик предложит помощь после совместной работы с Борином при кассе 600 монет. Найм — 240.','После первой выдачи Грика — основание гильдии и включение автоторговли.','В городе станет доступна башня за 1000 монет. После двух поставок кухни — королевская оружейная.']}
  };
  function ensure(){
    if(!state.story)return null;
    const r=state.story.royalProgress??={version:2,notified:false};
    r.version=2;r.notified=!!r.notified;r.upgrades??={};
    return r;
  }
  function onUpgrade(kind){
    const r=ensure();if(!r||!upgrades[kind]||r.upgrades[kind])return false;
    r.upgrades[kind]={pending:true,earnedAt:state.story.elapsed||0};return true;
  }
  function safe(){return state.started&&!state.paused&&!state.ended&&!state.autoSorting&&!state.tutorial?.active&&!document.hidden&&!drag&&state.selected===null&&!BagPour.active()&&!Restoration.active()&&!modalIsOpen();}
  function showUpgrade(kind,r){
    const def=upgrades[kind],notice=r.upgrades[kind];
    modal('<section id="shopUpgradeNotice" class="rating-notice"><span class="rating-crown" aria-hidden="true">♛</span><span class="brief-eyebrow">УЛУЧШЕНИЕ ЛАВКИ ЗАВЕРШЕНО</span><h2>Поздравляем! Рейтинг заведения вырос</h2><p>Лавка стала лучше и привлекает новые возможности.</p><div class="shop-rating-label"><b>'+def.name+'</b><span>Уровень обустройства '+def.level+' / 3</span></div><div class="shop-rating-bar" role="progressbar" aria-label="Уровень обустройства заведения" aria-valuemin="0" aria-valuemax="3" aria-valuenow="'+def.level+'"><i style="width:'+def.level/3*100+'%"></i></div><h3>Доступные улучшения и следующие шаги</h3><ul>'+def.items.map(text=>'<li>'+text+'</li>').join('')+'</ul><button id="shopUpgradeContinue" class="primary">Продолжить торговлю</button></section>',{wide:true});
    notice.presentedAt??=state.story.elapsed||0;
    modalCleanup=()=>{notice.pending=false;notice.acknowledgedAt=state.story.elapsed||0;save();};
    $('shopUpgradeContinue').onclick=()=>{closeModal();render();save();};
    playUpgradeFanfare();save();return true;
  }
  function advance(){
    const r=ensure();
    if(!r||!safe())return false;
    const kind=Object.keys(upgrades).find(key=>r.upgrades[key]?.pending);
    if(kind)return showUpgrade(kind,r);
    if(r.notified||!state.story.regularContracts?.chef?.completed)return false;
    r.notified=true;r.unlockedAt??=state.story.elapsed||0;r.notifiedAt=state.story.elapsed||0;save();
    modal('<section id="royalRankNotice" class="rating-notice"><span class="brief-eyebrow">КУХНЯ СНАБЖЕНА · НОВЫЙ КЛИЕНТ</span><h2>Королевская оружейная ждёт поставщика</h2><p>Все поставки городской кухне выполнены. Повар порекомендовал вашу лавку королевской оружейной.</p><p>Новый договор: три поставки по 5 мечей, 5 кинжалов и 5 шлемов. За каждую посылку из 15 вещей — 360 монет.</p><button id="royalRankContinue" class="primary">Посмотреть предложение</button></section>',{wide:true});
    $('royalRankContinue').onclick=()=>{r.acknowledgedAt=state.story.elapsed||0;closeModal();Contracts.openOffer('royal');render();save();};
    return true;
  }
  function afterLoad(){ensure();advance();}
  return {ensure,advance,afterLoad,onUpgrade};
})();
