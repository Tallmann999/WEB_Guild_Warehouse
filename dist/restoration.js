'use strict';

// This scene changes the existing shop. Its saved clock owns no inventory and
// never awards income; the single charge is committed before its first frame.
const Restoration=(()=>{
  const COST=30,REPAIR_SECONDS=2,DAWN_SECONDS=2;
  const active=()=>!!state.story?.restoration;
  function ensure(){
    const s=state.story;if(!s)return null;
    const r=s.restoration;
    if(r){
      r.phase=r.phase==='dawn'?'dawn':'repair';
      r.elapsed=Math.max(0,Math.min(r.phase==='dawn'?DAWN_SECONDS:REPAIR_SECONDS,Number(r.elapsed)||0));
      r.startDay=Math.max(1,Number(r.startDay)||state.day||1);
      // A saved in-progress scene already committed its cost. Loading it must
      // never invent another payment, including saves from an earlier revision.
      r.charged=true;
      if(r.phase==='dawn')s.restored=true;
    }
    return s;
  }
  function ready(){return !!state.story?.firstDayComplete&&!!state.story.firstPaid&&!state.story.restored&&!active();}
  function clearRewardVisuals(){
    // Sale income is already committed. Only its short-lived presentation may
    // overlap this scene; removing it must not undo or repeat the transaction.
    $('orderReward')?.remove();$('sortingReward')?.remove();
    document.querySelectorAll('.reward-coin').forEach(coin=>coin.remove());
  }
  function prompt({automatic=false}={}){
    const s=ensure();
    if(!s||!state.started||!ready()||state.paused||state.autoSorting||state.tutorial?.active||drag||document.hidden||!$('modal').classList.contains('hidden')||automatic&&s.repairPromptSeen&&!s.repairOfferPending)return false;
    s.repairPromptSeen=true;s.repairOfferPending=true;
    clearRewardVisuals();
    modal('<div id="restorationOffer"><span class="restoration-offer-mark" aria-hidden="true">✦</span><span class="brief-eyebrow">ПЕРВЫЙ РАБОЧИЙ ДЕНЬ ПОЗАДИ</span><h2>У лавки снова есть будущее</h2><p class="restoration-offer-intro">Вы приняли добычу, нашли покупателей и вернули дедову делу первую выручку. Теперь можно привести старую лавку в порядок.</p><div class="restoration-day-results"><span><b>'+state.dayBought+'</b>поставок принято</span><span><b>'+state.dayOrders+'</b>посылок выдано</span><span><b>'+state.dayIncome+'</b>монет получено</span></div><div class="restoration-preview"><span><i aria-hidden="true">☀</i><b>Открытое окно</b><small>Свет вместо пыли</small></span><span><img src="assets/storage/crate.png" alt=""><b>Крепкие ящики</b><small>Ровные полки и стойки</small></span><span><img src="assets/storage/sign.png" alt=""><b>Ухоженный прилавок</b><small>Лавка готова к новому дню</small></span></div><button id="restoreShop" class="primary" '+(state.gold<COST?'disabled':'')+'>Восстановить лавку · 30 монет</button><p class="restoration-offer-cost">'+(state.gold>=COST?'После восстановления в кассе останется '+(state.gold-COST)+' монет.':'В кассе '+state.gold+' монет. Можно продолжить торговлю и вернуться к восстановлению позже.')+'</p><button id="restoreLater">Пока продолжить торговлю</button></div>',{wide:true});
    $('restoreShop').onclick=()=>{closeModal();begin();};
    $('restoreLater').onclick=closeModal;
    modalCleanup=()=>{s.repairOfferPending=false;save();};
    save();return true;
  }
  function begin(){
    if(!state.story||!state.started||state.ended||state.paused||state.autoSorting||document.hidden||!ready()||state.gold<COST)return false;
    cancelDrag();clearRewardVisuals();
    state.gold-=COST;state.daySpent=(state.daySpent||0)+COST;
    state.story.repairPromptSeen=true;state.story.repairOfferPending=false;
    state.story.restoration={phase:'repair',elapsed:0,startDay:state.day,charged:true};
    state.screen='reception';state.mode='sort';state.activeCat=null;state.inspectCat=null;
    hidden('inspector',true);hidden('targetPreview',true);
    clearTutorialHighlight();$('tutorialGuide')?.remove();
    render();update();save();return true;
  }
  function lockScene(locked){
    const game=$('game');if(!game)return;
    for(const child of game.children){
      if(['modal','effects','toast','tooltip','restorationScene'].includes(child.id)||child.tagName==='HEADER')continue;
      child.inert=locked;
    }
    // Header pause/settings remain available. Modal pause owns its own inert
    // state until closeModal resets it and update() reapplies the scene lock.
    if(!state.paused)game.querySelector('header').inert=false;
  }
  function finish(){
    const s=state.story,r=s.restoration;
    state.day=Math.max(state.day,r.startDay+1);state.seconds=CONFIG.daySeconds;
    state.dayIncome=state.daySpent=state.dayOrders=state.dayBought=0;
    state.dayCollectionStart=state.collection.length;
    s.restored=true;s.restorationCompletedAt=s.elapsed;s.nextVisit=0;s.forceSupplier=true;state.visitorCooldown=0;
    delete s.restoration;
    state.screen='reception';state.mode='sort';
    lockScene(false);update();render();save();
    toast('Новый день в восстановленной лавке. Авантюристы снова несут добычу.');
  }
  function advance(dt){
    if(!state.story||!state.started||state.paused||state.autoSorting||document.hidden)return;
    if(!active()){prompt({automatic:true});return;}
    const s=ensure();let remaining=Math.max(0,Math.min(10,Number(dt)||0));
    // A bounded loop preserves a larger deterministic test step across both
    // phases without relying on wall-clock callbacks or an offline catch-up.
    for(let step=0;step<2&&remaining>0&&active();step++){
      const r=s.restoration,limit=r.phase==='repair'?REPAIR_SECONDS:DAWN_SECONDS;
      const used=Math.min(remaining,Math.max(0,limit-r.elapsed));
      r.elapsed+=used;remaining-=used;
      if(r.elapsed+1e-9<limit)break;
      if(r.phase==='repair'){
        s.restored=true;s.restoredAt=s.elapsed;
        r.phase='dawn';r.elapsed=0;save();
      }else finish();
    }
    update();
  }
  function setup(){
    if($('restorationScene'))return;
    const fixtures=document.createElement('div');fixtures.id='restorationFixtures';fixtures.setAttribute('aria-hidden','true');
    fixtures.innerHTML='<img class="restoration-crate crate-left" src="assets/storage/crate.png" alt=""><img class="restoration-crate crate-right" src="assets/storage/crate.png" alt=""><span class="restoration-shop-sign">ДЕДОВА ЛАВКА</span>';
    $('reception').append(fixtures);
    const scene=document.createElement('section');scene.id='restorationScene';scene.className='hidden';scene.setAttribute('role','status');scene.setAttribute('aria-live','polite');
    scene.innerHTML='<div class="restoration-dawn"></div><div class="restoration-focus"></div><div class="restoration-caption"><span class="brief-eyebrow"></span><h2></h2><p></p><div class="restoration-timeline"><i></i></div><div class="restoration-steps"><span>Свет и чистота</span><span>Ящики и стойки</span><span>Прилавок и вывеска</span></div></div>';
    $('game').append(scene);
  }
  function update(){
    const game=$('game'),scene=$('restorationScene');if(!scene)return;
    const s=state.story,r=s?.restoration,playing=!!r;
    scene.classList.toggle('hidden',!playing);game.classList.toggle('restoration-active',playing);
    game.classList.toggle('repair-window-ready',!!s?.restored||playing);
    game.classList.toggle('repair-shelves-ready',!!s?.restored||r?.phase==='repair'&&r.elapsed>=.6);
    game.classList.toggle('repair-counter-ready',!!s?.restored||r?.phase==='repair'&&r.elapsed>=1.3);
    if(!playing){delete game.dataset.repairStage;return;}
    lockScene(true);
    const dawn=r.phase==='dawn',stage=dawn?'dawn':r.elapsed<.6?'window':r.elapsed<1.3?'shelves':'counter';
    game.dataset.repairStage=stage;
    const text=dawn?['НАЧИНАЕТСЯ НОВЫЙ ДЕНЬ','День '+(r.startDay+1)+' · рассвет','Светлая лавка ждёт новые поставки.']:stage==='window'?['ВОССТАНОВЛЕНИЕ ЛАВКИ','Впустим свет','Открываем ставни, убираем пыль и паутину.']:stage==='shelves'?['ВОССТАНОВЛЕНИЕ ЛАВКИ','Всё встаёт на свои места','Выравниваем ящики, укрепляем полки и стойки.']:['ВОССТАНОВЛЕНИЕ ЛАВКИ','Дело дедушки продолжается','Приводим в порядок прилавок и вывеску.'];
    const selectors=['.brief-eyebrow','h2','p'];selectors.forEach((selector,i)=>{const el=scene.querySelector(selector);if(el.textContent!==text[i])el.textContent=text[i];});
    scene.querySelector('.restoration-timeline i').style.width=(dawn?r.elapsed/DAWN_SECONDS:r.elapsed/REPAIR_SECONDS)*100+'%';
    scene.style.setProperty('--dawn-progress',dawn?Math.min(1,r.elapsed/DAWN_SECONDS):0);
    scene.dataset.phase=r.phase;
    scene.querySelectorAll('.restoration-steps span').forEach((el,i)=>el.classList.toggle('done',dawn||r.elapsed>=[0,.6,1.3][i]));
    if(dawn){
      const light=Math.min(1,r.elapsed/DAWN_SECONDS);
      game.style.setProperty('--light-night',1-light);game.style.setProperty('--light-morning',light);
      game.style.setProperty('--light-evening',0);game.style.setProperty('--light-day',0);
      const sky=$('daylight');if(sky)[...sky.children].forEach((el,i)=>el.style.opacity=i===0?light:i===3?1-light:0);
      $('dayLabel').textContent='День '+(r.startDay+1);$('clock').textContent='Рассвет';
    }
  }
  function afterLoad(){const s=ensure();update();if(s?.repairOfferPending&&!active())prompt();}
  return {setup,ensure,active,advance,prompt,begin,update,afterLoad,ready,REPAIR_SECONDS,DAWN_SECONDS};
})();
