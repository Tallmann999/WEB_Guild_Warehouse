'use strict';

// Agreements create demand, never stock or money. Procurement stays manual.
const Contracts=(()=>{
  const DEFINITIONS={
    chef:{name:'Повар',title:'Снабжение городской кухни',customer:4,recipe:[{type:38,count:2},{type:31,count:2},{type:32,count:2}],description:'Кухне нужны постоянные поставки. Каждый раз — шесть продуктов по этому списку, за готовую посылку заплачу 120 монет. Договоримся?'},
    alchemy:{name:'Алхимик',title:'Компоненты для мастерской',customer:0,recipe:[{type:0,count:2},{type:1,count:2},{type:6,count:2}],description:'Я регулярно готовлю зелья и ищу надёжного поставщика. Шесть компонентов по постоянному списку, 120 монет за каждую посылку. Возьмётесь?'}
  };
  let boardSignature='';
  function ensure(){
    if(!state.story)return null;
    const s=state.story;s.regularContracts??={};
    s.manualAfterDwarf??=state.dwarf?.hired?Math.max(0,state.totalOrders-(s.hireOrders??state.totalOrders)-(state.goblin?.deliveries||0)):0;
    for(const key of Object.keys(DEFINITIONS)){
      const c=s.regularContracts[key]??={signed:false,delegated:false,deliveries:0,nextAt:0};
      c.signed=!!c.signed;c.delegated=!!c.delegated;c.deliveries??=0;c.nextAt??=0;
      if(c.signed){c.offerState='signed';c.offerSeen=true;c.offeredAt??=s.elapsed||0;}
      else if(!['visiting','later'].includes(c.offerState))c.offerState='unseen';
    }
    const selected=s.regularContracts[s.contractOfferKey];
    if(s.contractOfferKey&&(!selected||selected.signed||selected.offerState!=='visiting'))delete s.contractOfferKey;
    return s.regularContracts;
  }
  // The kitchen is the first standing promise, introduced with Borin. Other
  // clients still wait for the real tower transaction. Old signatures remain
  // valid independently of these rules for newly offered agreements.
  function ready(key){
    if(!state.story)return false;
    const tower=!!state.city?.towerOwned,kitchen=tower||state.day>=2&&!!state.dwarf?.hired;
    return key===undefined?kitchen||tower:key==='chef'?kitchen:key==='alchemy'?tower:false;
  }
  function current(key){return (state.orders||[]).find(o=>o.regularKey===key);}
  function signedCount(){const contracts=ensure();return contracts?Object.keys(DEFINITIONS).filter(key=>contracts[key].signed).length:0;}
  function activeOffer(){
    const contracts=ensure(),key=state.story?.contractOfferKey,c=contracts?.[key];
    return ready(key)&&c&&!c.signed&&c.offerState==='visiting'?{key,...DEFINITIONS[key]}:null;
  }
  function maybeOffer(){
    const contracts=ensure();
    if(!contracts||!ready()||!state.started||state.paused||state.ended||state.autoSorting||state.tutorial?.active||document.hidden||drag||state.bag.length||state.story.sortingGate||state.visitorCooldown>0||state.story.nextVisit>0||visitorQueue().length||!$('modal').classList.contains('hidden')||typeof BagPour!=='undefined'&&BagPour.active())return false;
    if(activeOffer())return true;
    const key=Object.keys(DEFINITIONS).find(key=>ready(key)&&!contracts[key].signed&&!contracts[key].offerSeen&&contracts[key].offerState==='unseen');
    if(!key)return false;
    const c=contracts[key];c.offerSeen=true;c.offerState='visiting';c.offeredAt=state.story.elapsed||0;state.story.contractOfferKey=key;
    save();return true;
  }
  function leaveCounter(key){
    if(state.story?.contractOfferKey!==key)return;
    delete state.story.contractOfferKey;
    state.story.nextVisit=2;state.visitorCooldown=2;state.visitorGapPending=true;state.visitorIdleReady=true;
  }
  function postpone(key){
    const c=ensure()?.[key];if(!c||c.signed)return false;
    c.offerSeen=true;c.offerState='later';c.offeredAt??=state.story.elapsed||0;leaveCounter(key);save();return true;
  }
  function sync(){
    const contracts=ensure();if(!contracts)return false;
    // Once day two has its two real sales, carry existing partial promises
    // forward without spawning another repeat before the explicit next day.
    if(state.day===2&&state.story.secondDayActive&&state.story.secondDayDeliveries>=2)return false;
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
    const contracts=ensure(),c=contracts?.[key];if(!c||!ready(key)||c.signed)return false;
    c.signed=true;c.delegated=false;c.nextAt=state.story.elapsed;c.offerSeen=true;c.offerState='signed';c.offeredAt??=state.story.elapsed||0;
    if(key==='chef'&&state.day===2&&state.story.secondDayActive)state.story.secondDayChefFlow=true;
    leaveCounter(key);sync();save();return true;
  }
  function onDelivery(order){
    if(!order?.regularKey)return;
    const c=ensure()?.[order.regularKey];if(!c)return;
    c.deliveries++;c.nextAt=state.story.elapsed+12;
  }
  function setDelegated(key,value){
    const c=ensure()?.[key],o=current(key);if(!c?.signed||!state.goblin?.hired)return false;
    const toGoblin=!!value;
    // Repeating the same policy never restarts a job or repeats a transaction.
    if(o&&Goblin.isAssigned(o)!==toGoblin&&!Goblin.assign(o,toGoblin))return false;
    c.delegated=toGoblin;
    if(toGoblin&&o&&state.order===o&&state.screen==='work'&&state.mode==='order'){
      cancelDrag();state.mode='sort';state.activeCat=null;state.inspectCat=null;
    }
    save();return true;
  }
  function delegate(order){return !!order&&setDelegated(order.regularKey,!Goblin.isAssigned(order));}
  function hire(){
    if(!Goblin.hire())return false;
    render();save();toast('Грик нанят. Включите его работу и выберите договорённость в улучшениях.');return true;
  }
  function recipeHtml(def,compact=false){
    return '<div class="'+(compact?'counter-contract-recipe':'contract-recipe')+'">'+def.recipe.map(r=>'<span title="'+items[r.type].name+'"><img src="'+asset(items[r.type].sprite)+'" alt="'+items[r.type].name+'"><b>'+r.count+(compact?'':' × '+items[r.type].name)+'</b></span>').join('')+'</div>';
  }
  function signAndAssemble(key){
    if(!signRegular(key))return false;
    render();const order=current(key);if(order)openOrder(order);else toast('Договорённость подписана. Посылка появится, когда освободится место в списке.');return true;
  }
  function openOffer(key){
    const def=DEFINITIONS[key],c=ensure()?.[key];if(!def||!c||!state.started||state.paused||state.autoSorting||!c.signed&&!ready(key))return;
    if(c.signed){const o=current(key);if(o&&!Goblin.isAssigned(o)){openOrder(o);return;}openBook();return;}
    modal('<div id="contractOfferSheet"><span class="agreement-urgent">СРОЧНО</span><span class="brief-eyebrow">ПОСТОЯННАЯ ДОГОВОРЁННОСТЬ</span><h2>'+def.title+'</h2><p>'+def.description+'</p>'+recipeHtml(def)+'<p>Шесть настоящих вещей · 120 монет за посылку · без срока и штрафа</p><button id="signOfferSheet" class="primary" '+(!ready(key)?'disabled':'')+'>Договориться и собирать вручную</button><button id="laterOfferSheet">Решить позже</button></div>');
    $('signOfferSheet').onclick=()=>{closeModal();signAndAssemble(key);};
    $('laterOfferSheet').onclick=()=>{closeModal();postpone(key);render();};
  }
  function renderReception(){
    const offer=activeOffer(),show=!!offer&&state.screen==='reception'&&!visitorQueue().length&&state.visitorCooldown<=0&&!state.bag.length;
    $('reception').classList.toggle('contract-guest',show);
    if(!show){$('receptionAction').classList.remove('contract-counter-actions');delete $('receptionAction').dataset.contractOffer;return false;}
    Story.render();
    const guest=customers[offer.customer];$('visitor').src=asset(guest[2]);$('visitor').alt=guest[0]+', предложение постоянной договорённости';
    hidden('visitor',false);hidden('speech',false);hidden('bag',true);hidden('parcel',true);
    $('speech').innerHTML='<span class="eyebrow">СРОЧНО · ПОСТОЯННЫЕ ПОСТАВКИ</span><h2>'+guest[0]+'</h2><p>'+offer.description+'</p>';
    const action=$('receptionAction');action.innerHTML='';action.classList.add('contract-counter-actions');action.dataset.contractOffer=offer.key;
    button(action,'Договориться · собирать вручную',()=>signAndAssemble(offer.key),'signContractOffer').className='primary';
    button(action,'Решить позже',()=>{postpone(offer.key);render();},'laterContractOffer');
    button(action,'К столу и коробкам',()=>setScreen('work','sort'),'goWork');
    $('notice').innerHTML='<span class="agreement-urgent">СРОЧНО</span><b>'+offer.title+'</b>'+recipeHtml(offer,true)+'<span class="counter-contract-payment">6 вещей · 120 монет за каждую посылку</span>';
    $('stepHint').textContent='';return true;
  }
  function openBook(){
    if(!state.started||state.paused||state.autoSorting||!state.story)return;
    const contracts=ensure(),g=Goblin.ensure();
    modal('<span class="brief-eyebrow">ПОСТОЯННЫЕ ПОСТАВКИ</span><h2>Договорённости с клиентами</h2><p>Шесть настоящих вещей за 120 монет. После выдачи клиент повторит тот же список. Закупки выбираете вы.</p>'+(!ready('alchemy')?'<p class="contract-lock">Кухня предлагает постоянное снабжение после найма Борина. Другие новые договорённости появятся после покупки старой башни. Действующие договорённости остаются в силе.</p>':'')+'<div class="regular-contracts">'+Object.entries(DEFINITIONS).filter(([key])=>ready(key)||contracts[key].signed).map(([key,def])=>{
      const c=contracts[key],o=current(key);
      return '<article><span class="agreement-urgent">СРОЧНО</span><span class="brief-eyebrow">'+def.name+'</span><h3>'+def.title+'</h3>'+recipeHtml(def)+'<p>'+(o?(Goblin.isAssigned(o)?'Грик собирает и выдаёт':'Вы собираете вручную')+' · '+o.packed.length+'/6 в посылке':c.signed?'Следующая посылка через '+Math.max(0,Math.ceil(c.nextAt-state.story.elapsed))+' сек.':'Постоянный спрос, без срока и штрафа')+'</p>'+(c.signed?(o?'<button data-manual-order="'+o.id+'" '+(Goblin.isAssigned(o)?'disabled':'')+'>Собрать вручную</button>'+(g.hired?'<button class="primary" data-delegate-order="'+o.id+'">'+(Goblin.isAssigned(o)?'Вернуть мне · следующие тоже':'Передать гоблину · повторять')+'</button>':''):'<button data-policy="'+key+'" '+(!g.hired?'disabled':'')+'>'+(c.delegated?'Вернуть следующие мне':'Передать следующие гоблину')+'</button>'):'<button class="primary" id="signRegular'+(key==='chef'?'Chef':'Alchemy')+'" '+(!ready(key)?'disabled':'')+'>Договориться · собирать вручную</button>')+'<small>Выдано: '+c.deliveries+' · '+(c.delegated?'Повторять поручение Грику':'Новые посылки остаются за вами')+'</small></article>';
    }).join('')+'</div>',{wide:true});
    for(const key of Object.keys(DEFINITIONS)){
      const b=$('signRegular'+(key==='chef'?'Chef':'Alchemy'));if(b)b.onclick=()=>{closeModal();signRegular(key);render();openBook();};
    }
    document.querySelectorAll('[data-delegate-order]').forEach(b=>b.onclick=()=>{const o=(state.orders||[]).find(o=>o.id===Number(b.dataset.delegateOrder));closeModal();delegate(o);render();openBook();});
    document.querySelectorAll('[data-manual-order]').forEach(b=>b.onclick=()=>{const o=(state.orders||[]).find(o=>o.id===Number(b.dataset.manualOrder));closeModal();if(o)openOrder(o);});
    document.querySelectorAll('[data-policy]').forEach(b=>b.onclick=()=>{const key=b.dataset.policy,c=contracts[key];closeModal();setDelegated(key,!c.delegated);render();openBook();});
  }
  function updateBoard(){
    const board=$('contractOfferBoard');if(!board)return;
    const contracts=ensure(),active=!!contracts&&state.started,entries=active?Object.entries(DEFINITIONS).filter(([key])=>contracts[key].signed||ready(key)&&contracts[key].offerState!=='unseen'):[];
    hidden('contractOfferBoard',!active||!entries.length);
    board.classList.toggle('work-agreements',state.screen==='work');
    $('game').classList.toggle('has-agreement-board',active&&entries.length>0);
    const signature=JSON.stringify(entries.map(([key])=>{const c=contracts[key],o=current(key);return [key,c.signed,c.offerState,c.delegated,o?.id,o?.packed.length,o?.assignedTo];}));
    if(signature===boardSignature)return;boardSignature=signature;board.innerHTML='';
    for(const [key,def]of entries){
      const c=contracts[key],o=current(key),leaf=button(board,'',()=>openOffer(key));
      leaf.className='contract-offer-leaf';leaf.dataset.contractKey=key;leaf.dataset.contractState=c.offerState;
      leaf.innerHTML='<span class="agreement-leaf-kind">ДОГОВОРЁННОСТЬ</span><span class="agreement-urgent">СРОЧНО</span><strong>'+def.name+'</strong><span class="agreement-leaf-items">'+def.recipe.map(r=>'<img src="'+asset(items[r.type].sprite)+'" alt="'+items[r.type].name+'">').join('')+'</span><small class="agreement-leaf-info">'+(!c.signed?'Предложение · 120 монет':o?o.packed.length+'/6 · 120 монет':'Повтор · 120 монет')+'</small><small class="agreement-leaf-compact">'+(!c.signed?'6 вещей · 120':o?o.packed.length+'/6 · 120':'Повтор · 120')+'</small><b>'+(!c.signed?'Посмотреть и договориться':o?(Goblin.isAssigned(o)?'Собирает Грик':'Собрать посылку'):'Договорённость действует')+'</b>';
    }
  }
  function setup(){
    button(document.querySelector('footer nav'),'Договорённости',openBook,'contractsNav').className='hidden';
    const board=document.createElement('aside');board.id='contractOfferBoard';board.className='hidden';board.setAttribute('aria-label','Постоянные договорённости');$('game').append(board);
    const station=button($('reception'),'',()=>Story.showBusiness(),'goblinStation');station.className='hidden';station.innerHTML='<img class="goblin-portrait" src="assets/goblin-grik-packer.png" alt="Грик, гоблин-комплектовщик"><strong>Грик</strong><span class="goblin-label"></span><span class="goblin-progress"><i></i></span>';
    const work=button($('work'),'',()=>Story.showBusiness(),'goblinWorkStatus');work.className='hidden';work.innerHTML='<span></span><i></i>';
  }
  function update(){
    const active=!!state.story&&state.started;hidden('contractsNav',!active||!ready()&&!signedCount());hidden('goblinStation',!active||!state.goblin?.hired||state.screen!=='reception');hidden('goblinWorkStatus',!active||!state.goblin?.hired);
    updateBoard();if(!active)return;ensure();$('game').dataset.goblin=state.goblin?.hired?'hired':'none';
    const status=Goblin.status();$('goblinStation').querySelector('.goblin-label').textContent=status.label;$('goblinStation').querySelector('i').style.width=(status.progress||0)*100+'%';
    $('goblinWorkStatus').querySelector('span').textContent='Грик · '+status.label;$('goblinWorkStatus').querySelector('i').style.width=(status.progress||0)*100+'%';
    $('contractsNav').classList.toggle('upgrade-prompt',ready()&&!state.story.completedB3);
    if(!activeOffer()){$('receptionAction')?.classList.remove('contract-counter-actions');if($('receptionAction'))delete $('receptionAction').dataset.contractOffer;}
  }
  return {ensure,ready,current,signedCount,activeOffer,maybeOffer,renderReception,postpone,openOffer,sync,signRegular,onDelivery,delegate,setDelegated,hire,openBook,setup,update};
})();
