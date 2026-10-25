'use strict';

// Founding is a saved, explicit consent to unattended ordinary trade. This
// module owns presentation and milestones, never inventory or currency.
const Guild=(()=>{
  const INTRO='Твоя репутация выросла, и теперь ты можешь включить автоматизацию работы лавки и начать свою гильдию. Введи название своей гильдии.';
  const CITY_INTRO='Для развития гильдии нам нужно расширить свои полномочия в городе. На примете есть заброшенное здание, которое надо восстановить.';
  const PHASES=['name','charter','city_intro','tower','complete'];
  let presenting=false;
  const unlocked=()=>!!state.story&&(!!state.story.completedB3||(state.goblin?.deliveries||0)>0);
  const cleanName=value=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,'').replace(/\s+/g,' ').trim();
  function ensure(){
    const s=state.story;if(!s)return null;
    if(!s.guild){
      if(!unlocked())return null;
      s.guild={version:1,phase:'name',founded:false,name:'',draftName:'',unlockedAt:s.elapsed||0};
      save();
    }
    const g=s.guild;g.version=1;g.name=cleanName(g.name);g.draftName=String(g.draftName??g.name??'');g.founded=!!g.founded&&!!g.name;
    if(!PHASES.includes(g.phase))g.phase=g.founded?'complete':'name';
    if(!g.founded)g.phase='name';
    return g;
  }
  function flag(){
    return '<div class="guild-flag" role="img" aria-label="Зелёный флаг гильдии с золотым гербом"><svg viewBox="0 0 180 210" aria-hidden="true"><defs><linearGradient id="guildCloth" x2="1" y2="1"><stop stop-color="#557d4a"/><stop offset=".55" stop-color="#274c38"/><stop offset="1" stop-color="#102e27"/></linearGradient></defs><path d="M18 8H162V162L90 200L18 162Z" fill="url(#guildCloth)" stroke="#d3b575" stroke-width="4"/><path d="M29 18H151V155L90 187L29 155Z" fill="none" stroke="#c5aa654f" stroke-width="2"/><path d="M90 45L128 58V100Q128 127 90 147Q52 127 52 100V58Z" fill="#213c30" stroke="#e3c887" stroke-width="3"/><path d="M90 64L98 84L120 86L103 101L108 123L90 112L72 123L77 101L60 86L82 84Z" fill="#ead494"/><path d="M12 7H168" stroke="#e5ca8e" stroke-width="7" stroke-linecap="round"/></svg></div>';
  }
  function fillName(root,g){root.querySelectorAll('[data-guild-name]').forEach(el=>el.textContent=g.name);}
  function safeToPresent(){return state.started&&!state.ended&&!state.paused&&!state.autoSorting&&!state.tutorial?.active&&!document.hidden&&!drag&&!state.selected&&!BagPour.active()&&!Restoration.active()&&$('modal').classList.contains('hidden');}
  function showName(){
    const g=ensure();if(!g||g.phase!=='name'||presenting)return false;
    presenting=true;
    modal('<section id="guildFounding" class="guild-panel"><span class="brief-eyebrow">НОВАЯ ГЛАВА</span><h2>Начало своей гильдии</h2><p>'+INTRO+'</p><form id="guildNameForm"><label for="guildNameInput">Название гильдии</label><input id="guildNameInput" name="guildName" type="text" maxlength="32" autocomplete="off" spellcheck="false" placeholder="Как назовём гильдию?" aria-describedby="guildNameHint guildNameError"><small id="guildNameHint">От 1 до 32 символов</small><p id="guildNameError" class="guild-form-error" role="alert"></p><button id="guildCreate" class="primary" type="submit">Основать гильдию</button></form></section>',{locked:true,wide:true});
    const input=$('guildNameInput');input.value=g.draftName;
    input.oninput=()=>{g.draftName=input.value;$('guildNameError').textContent='';save();};
    $('guildNameForm').onsubmit=e=>{
      e.preventDefault();const name=cleanName(input.value);
      if(!name||Array.from(name).length>32){$('guildNameError').textContent='Введите название от 1 до 32 символов.';input.focus();return;}
      g.name=name;g.draftName=name;g.founded=true;g.foundedAt??=state.story.elapsed||0;g.phase='charter';save();
      forceCloseModal();showCharter();
    };
    input.focus();presenting=false;return true;
  }
  function showCharter(){
    const g=ensure();if(!g?.founded)return false;
    modal('<section id="guildCharter" class="guild-panel">'+flag()+'<span class="brief-eyebrow">ГИЛЬДИЯ ОСНОВАНА</span><h2 data-guild-name></h2><p>У гильдии теперь есть имя и флаг. Борин и Грик готовы вести обычную торговлю, пока ты занимаешься её развитием.</p><div class="guild-charter-work"><span>Покупка мешков</span><span>Разбор находок</span><span>Приём и выдача посылок</span></div><p class="guild-note">Нажми «Далее», чтобы включить работу лавки и посмотреть город.</p><button id="guildCharterNext" class="primary">Далее</button></section>',{locked:true,wide:true});
    fillName($('guildCharter'),g);
    $('guildCharterNext').onclick=()=>{
      if(g.phase!=='charter')return;
      if(!Automation.enable())return;
      g.phase='city_intro';g.automationConsentAt??=state.story.elapsed||0;save();forceCloseModal();render();City.open('shop');
    };
    $('guildCharterNext').focus();return true;
  }
  function open(){
    const g=ensure();if(!g||!state.started||state.paused||state.autoSorting||document.hidden)return false;
    if(g.phase==='name')return showName();if(g.phase==='charter')return showCharter();
    modal('<section id="guildOverview" class="guild-panel">'+flag()+'<span class="brief-eyebrow">ТВОЯ ГИЛЬДИЯ</span><h2 data-guild-name></h2><p id="guildAutomationStatus"></p><div class="guild-overview-actions"><button id="guildToggleAutomation" class="primary"></button><button id="guildVisitCity">'+(['city_intro','tower'].includes(g.phase)?'Продолжить осмотр города':'Посмотреть город')+'</button></div><p class="guild-note">Ручная работа и настройки помощников доступны в лавке. Пауза останавливает всё дело.</p></section>',{wide:true});
    fillName($('guildOverview'),g);updateOverview();
    $('guildToggleAutomation').onclick=()=>{Automation.setEnabled(!Automation.ensure().enabled);updateOverview();update();save();};
    $('guildVisitCity').onclick=()=>{forceCloseModal();City.open(g.phase==='tower'?'tower':'shop');};return true;
  }
  function updateOverview(){
    if(!$('guildOverview'))return;
    const a=Automation.ensure(),status=Automation.status();
    $('guildAutomationStatus').textContent=typeof status==='string'?status:status.label||'Лавка ведёт обычную торговлю.';
    $('guildToggleAutomation').textContent=a?.enabled?'Приостановить автоторговлю':'Возобновить автоторговлю';
  }
  function setup(){
    if($('guildNav'))return;
    const nav=button(document.querySelector('footer nav'),'Гильдия',open,'guildNav');nav.className='hidden';
    const guide=document.createElement('aside');guide.id='guildCityGuide';guide.className='hidden';guide.setAttribute('aria-label','Развитие гильдии');
    guide.innerHTML='<div class="guild-city-caption"><span class="brief-eyebrow">РАЗВИТИЕ ГИЛЬДИИ</span><h2></h2><p id="guildCityText"></p><button id="guildCityNext" class="primary">Далее</button><button id="guildGuideReturn">Вернуться в лавку</button></div><div id="guildTowerArrow" aria-hidden="true"><span>Старая башня</span><b>↓</b></div>';
    $('cityMap').append(guide);
    $('guildCityNext').onclick=()=>{const g=ensure();if(!g||g.phase!=='city_intro')return;g.phase=state.city?.towerOwned?'complete':'tower';save();City.select('tower');cityUpdate();};
    $('guildGuideReturn').onclick=()=>{City.close();setScreen('reception','sort');};
  }
  function cityUpdate(context={}){
    const g=ensure(),guide=$('guildCityGuide');if(!guide)return;
    const visible=!!g?.founded&&City.isOpen()&&['city_intro','tower'].includes(g.phase);
    guide.classList.toggle('hidden',!visible);
    const tower=$('cityTower'),buy=$('cityBuyTower');
    tower?.classList.toggle('guild-target',visible&&g.phase==='tower');buy?.classList.toggle('guild-target',visible&&g.phase==='tower');
    if(!visible)return;
    const intro=g.phase==='city_intro';guide.dataset.phase=g.phase;
    guide.querySelector('h2').textContent=intro?'Гильдии нужен новый дом':'Заброшенное здание';
    $('guildCityText').textContent=intro?(state.city?.towerOwned?'Башня уже принадлежит тебе. Она станет следующим местом развития гильдии.':CITY_INTRO):'Эта старая башня ждёт восстановления. Купить её можно за 1000 золотых. '+(state.gold<1000?'Нужно ещё '+(1000-state.gold)+' монет — лавка продолжает зарабатывать.':'Лавка продолжит работать и после покупки.');
    hidden('guildCityNext',!intro);hidden('guildGuideReturn',intro);hidden('guildTowerArrow',intro);
    if(!intro&&tower){
      const map=$('cityMap').getBoundingClientRect(),r=tower.getBoundingClientRect(),unit=map.width/$('cityMap').clientWidth;
      $('guildTowerArrow').style.left=((r.left+r.width/2-map.left)/unit)+'px';
      $('guildTowerArrow').style.top=(Math.max(78,(r.top-map.top)/unit-87))+'px';
    }
  }
  function onTowerPurchased(){const g=ensure();if(g&&g.founded&&['city_intro','tower'].includes(g.phase)){g.phase='complete';g.towerGuideCompletedAt=state.story.elapsed||0;save();}cityUpdate();}
  function onCityClosed(){if($('guildCityGuide'))$('guildCityGuide').classList.add('hidden');}
  function update(){
    const g=ensure(),nav=$('guildNav');if(!nav)return;
    hidden('guildNav',!state.started||!g);nav.textContent=g?.founded?'Гильдия':'Основать гильдию';nav.title=g?.founded?g.name:'Основать свою гильдию';
    $('game').classList.toggle('has-guild',!!g?.founded&&state.started);
  }
  function advance(){
    const g=ensure();update();if(!g||!safeToPresent())return;
    if(g.phase==='name')showName();else if(g.phase==='charter')showCharter();
  }
  function afterLoad(){
    const g=ensure();update();if(!g)return;
    if(g.founded&&['city_intro','tower'].includes(g.phase))City.open(g.phase==='tower'?'tower':'shop');
    else advance();
  }
  return {ensure,setup,advance,afterLoad,update,open,cityUpdate,onTowerPurchased,onCityClosed,unlocked};
})();
