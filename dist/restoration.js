'use strict';

// Each transformation owns only its saved active clock. Goods and promises are
// untouched; cleaning pays once, the earned furnishing has no invented price.
const Restoration=(()=>{
  const COST=30,REPAIR_SECONDS=4,DAWN_SECONDS=0;
  const active=()=>!!state.story?.restoration;
  function ensure(){
    const s=state.story;if(!s)return null;
    const r=s.restoration;
    if(r){
      r.kind=r.kind==='furnish'?'furnish':'clean';
      // Old saves already in dawn have earned their whole repair. Finish them
      // without another night transition, payment or replayed four seconds.
      if(r.phase==='dawn')r.elapsed=REPAIR_SECONDS;
      r.phase='repair';r.timingVersion=2;
      r.elapsed=Math.max(0,Math.min(REPAIR_SECONDS,Number(r.elapsed)||0));
      r.startDay=Math.max(r.kind==='furnish'?2:1,Number(r.startDay)||state.day||1);
      r.charged=true;
    }
    if(!Number.isInteger(s.shopRestorationStage)||s.shopRestorationStage<0||s.shopRestorationStage>2){
      // Old completed shops keep their earned day and never replay a scene or
      // payment. An old in-progress first repair resumes as cleaning.
      s.shopRestorationStage=r?(r.kind==='furnish'?1:0):s.restored?(state.day>=3?2:1):0;
    }
    if(!r&&s.restored&&s.shopRestorationStage===0)s.shopRestorationStage=state.day>=3?2:1;
    if(s.shopRestorationStage>=1)s.restored=true;
    return s;
  }
  function ready(){const s=ensure();return !!s?.firstDayComplete&&!!s.firstPaid&&s.shopRestorationStage===0&&!active();}
  function readySecond(){const s=ensure();return !!s&&s.shopRestorationStage===1&&state.day>=2&&!!(s.secondDayComplete||s.secondDayEndPending)&&!active();}
  function clearRewardVisuals(){
    $('orderReward')?.remove();$('sortingReward')?.remove();
    document.querySelectorAll('.reward-coin').forEach(coin=>coin.remove());
  }
  function returnToReception(){
    if(typeof Tower!=='undefined'&&Tower.isOpen())Tower.close('none');
    if(typeof City!=='undefined')City.close();
    state.screen='reception';state.mode='sort';state.activeCat=null;state.inspectCat=null;
    hidden('inspector',true);hidden('targetPreview',true);
  }
  function presentMorning(kind='clean'){
    const s=ensure();if(!s)return false;
    s.restorationMorning={kind,targetDay:Math.max(state.day+1,kind==='furnish'?3:2)};
    returnToReception();render();update();focusScene();return true;
  }
  function focusScene(){if(typeof resize==='function')resize();if($('game')?.dataset.viewportFit!=='true')$('reception')?.scrollIntoView({block:'start',behavior:'instant'});}
  function prompt({automatic=false}={}){
    const s=ensure();
    if(!s||!state.started||!ready()||state.paused||state.autoSorting||state.tutorial?.active||drag||document.hidden||!$('modal').classList.contains('hidden')||automatic&&s.repairPromptSeen&&!s.repairOfferPending)return false;
    s.repairPromptSeen=true;s.repairOfferPending=true;clearRewardVisuals();presentMorning('clean');
    modal('<div id="restorationOffer"><span class="restoration-offer-mark" aria-hidden="true">✦</span><span class="brief-eyebrow">УТРО ВТОРОГО ДНЯ</span><h2>Приведём лавку в порядок</h2><p class="restoration-offer-intro">Сметём пыль и паутину и починим сломанную деталь окна. Обновление займёт 4 секунды. Сразу после него продолжим утреннюю торговлю.</p><div class="restoration-day-results"><span><b>'+state.dayBought+'</b>поставок принято</span><span><b>'+state.dayOrders+'</b>посылок выдано</span><span><b>'+state.dayIncome+'</b>монет получено</span></div><div class="restoration-preview"><span><i aria-hidden="true">✧</i><b>Чистые углы</b><small>Убираем паутину</small></span><span><i aria-hidden="true">▤</i><b>Крепкое окно</b><small>Чиним сломанную деталь</small></span><span><i aria-hidden="true">☀</i><b>Новое утро</b><small>Впереди второй день</small></span></div><button id="restoreShop" class="primary" '+(state.gold<COST?'disabled':'')+'>Убрать и починить лавку · 30 монет</button><p class="restoration-offer-cost">'+(state.gold>=COST?'После уборки в кассе останется '+(state.gold-COST)+' монет.':'В кассе '+state.gold+' монет. Можно продолжить торговлю и вернуться к уборке позже.')+'</p><button id="restoreLater">Пока продолжить торговлю</button></div>',{wide:true});
    $('restoreShop').onclick=()=>{closeModal();begin();};$('restoreLater').onclick=closeModal;
    modalCleanup=()=>{s.repairOfferPending=false;if(!active())delete s.restorationMorning;save();};save();return true;
  }
  function start(kind){
    const s=ensure();
    if(!s||!state.started||state.ended||state.paused||state.autoSorting||document.hidden||drag||active()||(kind==='clean'?!ready()||state.gold<COST:!readySecond()))return false;
    clearRewardVisuals();
    if(kind==='clean'){state.gold-=COST;state.daySpent=(state.daySpent||0)+COST;s.repairPromptSeen=true;s.repairOfferPending=false;}
    else{s.secondDayEndPending=false;s.secondDayActive=false;}
    s.restoration={kind,phase:'repair',elapsed:0,startDay:state.day,charged:true,timingVersion:2};
    delete s.restorationMorning;state.seconds=CONFIG.daySeconds;returnToReception();
    hidden('inspector',true);hidden('targetPreview',true);clearTutorialHighlight();$('tutorialGuide')?.remove();
    render();update();focusScene();save();return true;
  }
  const begin=()=>start('clean');
  const beginSecond=()=>start('furnish');
  function lockScene(locked){
    const game=$('game');if(!game)return;
    for(const child of game.children){
      if(['modal','effects','toast','tooltip','restorationScene'].includes(child.id)||child.tagName==='HEADER')continue;
      child.inert=locked;
    }
    if(!state.paused)game.querySelector('header').inert=false;
  }
  function finish(){
    const s=state.story,r=s.restoration,second=r.kind==='furnish';
    s.shopRestorationStage=Math.max(s.shopRestorationStage,second?2:1);s.restored=true;
    state.day=Math.max(state.day,r.startDay+1);state.seconds=CONFIG.daySeconds;
    state.dayIncome=state.daySpent=state.dayOrders=state.dayBought=0;state.dayCollectionStart=state.collection.length;
    s.restorationCompletedAt=s.elapsed;s[second?'furnishingCompletedAt':'cleaningCompletedAt']=s.elapsed;
    s.nextVisit=0;s.forceSupplier=true;state.visitorCooldown=0;
    if(second){s.secondDayActive=false;s.secondDayEndPending=false;s.secondDayComplete=true;}
    delete s.restoration;delete s.restorationMorning;returnToReception();
    if(typeof RoyalProgress!=='undefined')RoyalProgress.onUpgrade(second?'furnish':'clean');
    lockScene(false);update();render();save();
    toast(second?'Лавка обновлена: стеллажи, уютный уголок и вывеска гильдии. Начинается третий день.':'Пыль и паутина убраны, окно починено. Начинается второй день.');
  }
  function advance(dt){
    if(!state.story||!state.started||state.paused||state.autoSorting||document.hidden)return;
    if(!active()){prompt({automatic:true});return;}
    const s=ensure(),r=s.restoration;
    r.elapsed=Math.min(REPAIR_SECONDS,r.elapsed+Math.max(0,Math.min(10,Number(dt)||0)));
    if(r.elapsed+1e-9>=REPAIR_SECONDS){s.restoredAt=s.elapsed;finish();}
    update();
  }
  function setup(){
    if($('restorationScene'))return;
    const fixtures=document.createElement('div');fixtures.id='restorationFixtures';fixtures.setAttribute('aria-hidden','true');
    fixtures.innerHTML=['left','right'].map(side=>'<div class="restoration-cobweb cobweb-'+side+'"></div>').join('')+'<img class="restoration-broom" src="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%22%20height%3D%22220%22%20viewBox%3D%220%200%20100%20220%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22wood%22%3E%3Cstop%20stop-color%3D%22%23c6995d%22%2F%3E%3Cstop%20offset%3D%22.45%22%20stop-color%3D%22%2378502c%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23d4ae71%22%2F%3E%3C%2FlinearGradient%3E%3ClinearGradient%20id%3D%22straw%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23d7b873%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%238b632f%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%0A%3Cpath%20d%3D%22M48%2016Q44%206%2040%2013L37%20157H50Z%22%20fill%3D%22url(%23wood)%22%20stroke%3D%22%23392716%22%20stroke-width%3D%223%22%2F%3E%0A%3Cpath%20d%3D%22M30%20146L55%20146Q59%20174%2088%20199Q50%20216%208%20199Q31%20175%2030%20146Z%22%20fill%3D%22url(%23straw)%22%20stroke%3D%22%234a321e%22%20stroke-width%3D%223%22%2F%3E%0A%3Cpath%20d%3D%22M32%20157L12%20199M37%20158L25%20202M43%20158L41%20206M48%20157L56%20205M52%20157L72%20201%22%20stroke%3D%22%236e4b27%22%20stroke-width%3D%222%22%20fill%3D%22none%22%2F%3E%0A%3Cpath%20d%3D%22M28%20149L56%20149M28%20155L57%20155%22%20stroke%3D%22%2365543a%22%20stroke-width%3D%225%22%2F%3E%0A%3C%2Fsvg%3E%0A" alt=""><span class="restoration-broken-window"></span><div class="restoration-mist"></div><span class="restoration-shop-sign"></span>';
    $('reception').append(fixtures);
    const scene=document.createElement('section');scene.id='restorationScene';scene.className='hidden';scene.setAttribute('role','status');scene.setAttribute('aria-live','polite');
    scene.innerHTML='<div class="restoration-focus"></div><div class="restoration-change-marker marker-left"><span>Обновляем лавку</span></div><div class="restoration-change-marker marker-right"></div><div class="restoration-change-marker marker-window"><span>Чиним окно</span></div><div class="restoration-change-marker marker-furniture"><span>Обустраиваем уголок</span></div><div class="restoration-change-marker marker-sign"><span>Новая вывеска</span></div><div class="restoration-caption"><span class="brief-eyebrow"></span><h2></h2><p></p><div class="restoration-timeline"><i></i></div><div class="restoration-steps"><span></span><span></span><span></span></div></div>';
    $('game').append(scene);
  }
  function update(){
    const game=$('game'),scene=$('restorationScene');if(!scene)return;
    const s=ensure(),r=s?.restoration,playing=!!r,stage=s?.shopRestorationStage||0;
    scene.classList.toggle('hidden',!playing);game.classList.toggle('restoration-active',playing);game.dataset.shopStage=String(stage);
    const morning=playing||!!s?.restorationMorning;
    game.classList.toggle('restoration-morning',morning);
    if(morning){
      game.style.setProperty('--light-morning',1);for(const period of ['day','evening','night'])game.style.setProperty('--light-'+period,0);
      const sky=$('daylight');if(sky)[...sky.children].forEach((el,i)=>el.style.opacity=i===0?1:0);
      $('dayLabel').textContent='День '+(r?r.startDay+1:s.restorationMorning.targetDay);$('clock').textContent='Утро';$('sunbar').style.width='100%';
    }
    const clamp=n=>Math.max(0,Math.min(1,n));
    const cleanTime=stage>=1?4:r?.kind==='clean'?r.elapsed:0;
    const furnishTime=stage>=2?4:r?.kind==='furnish'?r.elapsed:0;
    const clean=clamp(cleanTime/1.4),window=clamp((cleanTime-1.4)/2.3),furnished=clamp((furnishTime-.35)/3.3),sign=clamp((furnishTime-2.7)/1.3);
    game.style.setProperty('--repair-clean',clean);game.style.setProperty('--repair-window',window);
    game.style.setProperty('--repair-furnished',furnished);game.style.setProperty('--repair-sign',sign);
    game.style.setProperty('--web-left',1-clamp(cleanTime/.7));game.style.setProperty('--web-right',1-clamp((cleanTime-.7)/.7));
    const sweep=cleanTime<.7?cleanTime/.7:(cleanTime-.7)/.7;
    game.style.setProperty('--broom-x',(cleanTime<.7?28+125*clamp(sweep):1170-125*clamp(sweep))+'px');
    game.style.setProperty('--broom-angle',(-28+Math.sin(clamp(sweep)*Math.PI*3)*25)+'deg');
    game.style.setProperty('--broom-visible',playing&&r.kind==='clean'&&r.phase==='repair'&&cleanTime<1.4?1:0);
    const t=r?.phase==='repair'?r.elapsed:4;
    game.style.setProperty('--repair-mist',playing&&r.phase==='repair'?Math.sin(Math.PI*clamp(t/4))*(r.kind==='furnish'?.55:.22):0);
    game.classList.toggle('repair-window-ready',stage>=1||playing&&r.kind==='clean');
    game.classList.toggle('repair-shelves-ready',stage>=2||playing&&r.kind==='furnish'&&r.elapsed>=1.4);
    game.classList.toggle('repair-counter-ready',stage>=1);
    const name=s?.guild?.founded&&s.guild.name?s.guild.name:'ГИЛЬДИЯ АВАНТЮРИСТОВ';
    const signNode=game.querySelector('.restoration-shop-sign');if(signNode.textContent!==name)signNode.textContent=name;
    signNode.title=name;signNode.style.fontSize=Array.from(name).length>24?'18px':'22px';
    if(!playing){delete game.dataset.repairStage;return;}
    lockScene(true);
    const part=r.elapsed<1.4?0:r.elapsed<2.9?1:2;
    game.dataset.repairStage=(r.kind==='clean'?['clean-sweep','clean-window','clean-done']:['furnish-shelves','furnish-furniture','furnish-sign'])[part];
    const captions=r.kind==='clean'?[
      ['ПЕРВАЯ УБОРКА','Сметём годы запустения','Веник убирает пыль и паутину из углов.'],
      ['ПЕРВАЯ УБОРКА','Починим окно','Сломанная деталь снова занимает своё место.'],
      ['ПЕРВАЯ УБОРКА','Чистая лавка готова к работе','Второй день начнётся в убранном помещении.']
    ]:[
      ['ОБНОВЛЕНИЕ ЛАВКИ','Место для новых находок','По краям появляются красивые стеллажи с книгами и ящиками.'],
      ['ОБНОВЛЕНИЕ ЛАВКИ','Уютный уголок у окна','Столик, два стула, часы и клетка с жёлтой канарейкой.'],
      ['ОБНОВЛЕНИЕ ЛАВКИ','Лавка готова к новой главе','Над окном появляется вывеска гильдии.']
    ];
    const text=captions[part];
    ['.brief-eyebrow','h2','p'].forEach((selector,i)=>{const node=scene.querySelector(selector);if(node.textContent!==text[i])node.textContent=text[i];});
    scene.querySelector('.restoration-timeline i').style.width=r.elapsed/REPAIR_SECONDS*100+'%';
    scene.dataset.phase='repair';scene.dataset.kind=r.kind;
    const labels=r.kind==='clean'?['Уборка','Ремонт окна','Чистая лавка']:['Стеллажи','Уют у окна','Вывеска гильдии'];
    scene.querySelectorAll('.restoration-steps span').forEach((el,i)=>{el.textContent=labels[i];el.classList.toggle('done',r.elapsed>=[0,1.4,2.9][i]);});
  }
  function afterLoad(){const s=ensure();if(s?.restoration?.elapsed>=REPAIR_SECONDS){finish();return;}update();if(s?.repairOfferPending&&!active())prompt();}
  return {setup,ensure,active,advance,prompt,begin,beginSecond,update,afterLoad,ready,readySecond,presentMorning,REPAIR_SECONDS,DAWN_SECONDS};
})();
