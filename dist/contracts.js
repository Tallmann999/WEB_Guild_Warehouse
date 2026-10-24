'use strict';

// Standing agreements create demand, never stock or money. Procurement stays manual.
const Contracts=(()=>{
  const DEFINITIONS={
    chef:{name:'Повар',title:'Снабжение городской кухни',customer:4,recipe:[{type:38,count:2},{type:31,count:2},{type:32,count:2}]},
    alchemy:{name:'Алхимик',title:'Компоненты для мастерской',customer:0,recipe:[{type:0,count:2},{type:1,count:2},{type:6,count:2}]}
  };
  function ensure(){
    if(!state.story)return null;
    const s=state.story;s.regularContracts??={};
    // Existing B2 saves already know how many deliveries happened after hiring.
    s.manualAfterDwarf??=state.dwarf?.hired?Math.max(0,state.totalOrders-(s.hireOrders??state.totalOrders)-(state.goblin?.deliveries||0)):0;
    for(const key of Object.keys(DEFINITIONS)){
      const c=s.regularContracts[key]??={signed:false,delegated:false,deliveries:0,nextAt:0};
      c.signed=!!c.signed;c.delegated=!!c.delegated;c.deliveries??=0;c.nextAt??=0;
    }
    return s.regularContracts;
  }
  const ready=()=>!!state.story?.completedB2;
  function current(key){return (state.orders||[]).find(o=>o.regularKey===key);}
  function sync(){
    const contracts=ensure();if(!contracts||!ready())return false;
    let changed=false;
    for(const [key,def] of Object.entries(DEFINITIONS)){
      const c=contracts[key];
      if(!c.signed||current(key)||state.story.elapsed<c.nextAt||(state.orders||[]).length>=4)continue;
      const o={id:state.orderUid=(state.orderUid||0)+1,recipe:def.recipe.map(r=>({...r})),packed:[],reservedUids:[],accepted:true,customer:def.customer,reward:120,originalReward:120,createdDay:state.day,title:def.title,description:'Регулярная поставка: шесть компонентов по постоянному списку.',storyOrder:true,regularKey:key,assignedTo:c.delegated&&state.goblin?.hired?'goblin':'manual'};
      state.orders.push(o);if(!state.order)state.order=o;changed=true;
    }
    if(changed){Goblin.reconcile();save();}
    return changed;
  }
  function signRegular(key){
    const contracts=ensure(),c=contracts?.[key];if(!c||!ready()||c.signed)return false;
    c.signed=true;c.nextAt=state.story.elapsed;sync();save();return true;
  }
  function onDelivery(order){
    if(!order?.regularKey)return;
    const c=ensure()?.[order.regularKey];if(!c)return;
    c.deliveries++;c.nextAt=state.story.elapsed+12;
  }
  function delegate(order){
    if(!order||!state.goblin?.hired)return false;
    const toGoblin=!Goblin.isAssigned(order);
    if(!Goblin.assign(order,toGoblin))return false;
    if(toGoblin&&state.order===order&&state.screen==='work'&&state.mode==='order'){
      cancelDrag();state.mode='sort';state.activeCat=null;state.inspectCat=null;
    }
    const c=ensure()?.[order.regularKey];if(c)c.delegated=toGoblin;
    save();return true;
  }
  function hire(){
    if(!Goblin.hire())return false;
    render();save();toast('Грик навёл порядок в старом уголке выдачи. Выберите договорённость и передайте её ему.');return true;
  }
  function openBook(){
    if(!state.started||state.paused||state.autoSorting||!state.story)return;
    const contracts=ensure(),g=Goblin.ensure(),status=Goblin.status();
    modal('<span class="brief-eyebrow">КНИГА ПОСТОЯННЫХ ПОСТАВОК</span><h2>Договорённости и выдача</h2><p>Шесть настоящих вещей за 120 монет. После выдачи клиент повторит тот же список. Закупки выбираете вы.</p>'+(!ready()?'<p class="contract-lock">Сначала завершите совместную работу с Борином: он разбирает партию, вы выдаёте посылку.</p>':'')+'<div class="regular-contracts">'+Object.entries(DEFINITIONS).map(([key,def])=>{
      const c=contracts[key],o=current(key);
      return '<article><span class="brief-eyebrow">'+def.name+'</span><h3>'+def.title+'</h3><div class="contract-recipe">'+def.recipe.map(r=>'<span><img src="'+asset(items[r.type].sprite)+'" alt=""><b>'+r.count+' × '+items[r.type].name+'</b></span>').join('')+'</div><p>'+(o?(Goblin.isAssigned(o)?'Грик собирает и выдаёт':'Вы собираете вручную')+' · '+o.packed.length+'/6 в посылке':c.signed?'Следующая посылка через '+Math.max(0,Math.ceil(c.nextAt-state.story.elapsed))+' сек.':'Постоянный спрос, без срока и штрафа')+'</p>'+(c.signed?(o?'<button data-manual-order="'+o.id+'" '+(Goblin.isAssigned(o)?'disabled':'')+'>Собрать вручную</button>'+(g.hired?'<button class="primary" data-delegate-order="'+o.id+'">'+(Goblin.isAssigned(o)?'Вернуть мне · следующие тоже':'Передать гоблину · повторять')+'</button>':''):'<button data-policy="'+key+'" '+(!g.hired?'disabled':'')+'>'+(c.delegated?'Вернуть следующие мне':'Передать следующие гоблину')+'</button>'):'<button class="primary" id="signRegular'+(key==='chef'?'Chef':'Alchemy')+'" '+(!ready()?'disabled':'')+'>Договориться · собирать вручную</button>')+'<small>Выдано: '+c.deliveries+' · '+(c.delegated?'Повторять поручение Грику':'Новые посылки остаются за вами')+'</small></article>';
    }).join('')+'</div><div class="goblin-controls"><h3>Грик, гоблин-комплектовщик</h3><p>'+status.label+'</p>'+(!g.hired?'<button id="hireGoblin" class="primary" '+(!ready()||state.story.manualAfterDwarf<3||state.gold<240?'disabled':'')+'>Нанять · 240 монет</button><small>Совместная работа с Борином и 3 ручные выдачи после его найма: '+Math.min(3,state.story.manualAfterDwarf)+'/3. В кассе '+state.gold+'.</small>':'<button id="toggleGoblin">'+(g.enabled?'Приостановить Грика':'Продолжить работу Грика')+'</button><p>Выручка Грика: '+g.gross+' · комиссии: '+g.feesPaid+' · выдано: '+g.deliveries+'</p>')+'<small>2 секунды на предмет, затем выдача. Комиссия 3 монеты только за выданную посылку. Ручные резервы защищены. Книга и пауза останавливают обоих помощников.</small></div>',{wide:true});
    for(const key of Object.keys(DEFINITIONS)){
      const b=$('signRegular'+(key==='chef'?'Chef':'Alchemy'));if(b)b.onclick=()=>{closeModal();signRegular(key);render();openBook();};
    }
    document.querySelectorAll('[data-delegate-order]').forEach(b=>b.onclick=()=>{const o=(state.orders||[]).find(o=>o.id===Number(b.dataset.delegateOrder));closeModal();delegate(o);render();openBook();});
    document.querySelectorAll('[data-manual-order]').forEach(b=>b.onclick=()=>{const o=(state.orders||[]).find(o=>o.id===Number(b.dataset.manualOrder));closeModal();if(o)openOrder(o);});
    document.querySelectorAll('[data-policy]').forEach(b=>b.onclick=()=>{const c=contracts[b.dataset.policy];c.delegated=!c.delegated;save();closeModal();openBook();});
    if($('hireGoblin'))$('hireGoblin').onclick=()=>{closeModal();hire();openBook();};
    if($('toggleGoblin'))$('toggleGoblin').onclick=()=>{Goblin.setEnabled(!g.enabled);closeModal();render();};
  }
  function setup(){
    button(document.querySelector('footer nav'),'Договорённости',openBook,'contractsNav').className='hidden';
    const station=button($('reception'),'',openBook,'goblinStation');station.className='hidden';station.innerHTML='<img class="goblin-portrait" src="assets/s3_7.png" alt="Грик, гоблин-комплектовщик"><strong>Грик</strong><span class="goblin-label"></span><span class="goblin-progress"><i></i></span>';
    const work=button($('work'),'',openBook,'goblinWorkStatus');work.className='hidden';work.innerHTML='<span></span><i></i>';
  }
  function update(){
    const active=!!state.story&&state.started;hidden('contractsNav',!active||!state.dwarf?.hired);hidden('goblinStation',!active||!state.goblin?.hired||state.screen!=='reception');hidden('goblinWorkStatus',!active||!state.goblin?.hired);
    if(!active)return;ensure();$('game').dataset.goblin=state.goblin?.hired?'hired':'none';
    const status=Goblin.status();$('goblinStation').querySelector('.goblin-label').textContent=status.label;$('goblinStation').querySelector('i').style.width=(status.progress||0)*100+'%';
    $('goblinWorkStatus').querySelector('span').textContent='Грик · '+status.label;$('goblinWorkStatus').querySelector('i').style.width=(status.progress||0)*100+'%';
    $('contractsNav').classList.toggle('upgrade-prompt',ready()&&!state.story.completedB3);
  }
  return {ensure,ready,sync,signRegular,onDelivery,delegate,hire,openBook,setup,update};
})();
