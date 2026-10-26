'use strict';

// A signed agreement creates three real shipments, never stock or money.
const Contracts=(()=>{
  const SERIES_DELIVERIES=3;
  const royalCustomer=customers.findIndex(c=>c[0]==='Интендант короля');
  const royalCustomerIndex=royalCustomer>=0?royalCustomer:customers.push(['Интендант короля','королевская оружейная','s4_1'])-1;
  const DEFINITIONS={
    chef:{name:'Повар',title:'Снабжение городской кухни',customer:4,reward:200,recipe:[{type:38,count:2},{type:31,count:2},{type:32,count:2}],description:'Кухне нужны три поставки. Каждый раз — шесть продуктов по этому списку, за готовую посылку заплачу 200 монет. Можно заняться ими в любое время, параллельно с обычной торговлей. Договоримся?'},
    alchemy:{name:'Алхимик',title:'Компоненты для мастерской',customer:0,reward:200,recipe:[{type:0,count:2},{type:1,count:2},{type:6,count:2}],description:'Я готовлю зелья и ищу поставщика на три посылки. Шесть компонентов по одному списку, 200 монет за каждую посылку. Возьмётесь?'},
    royal:{name:'Оружейная короля',title:'Поставки королевской оружейной',customer:royalCustomerIndex,reward:360,recipe:[{type:18,count:5},{type:19,count:5},{type:24,count:5}],description:'Королевской оружейной нужны три поставки снаряжения. В каждой — пять железных мечей, пять кинжалов и пять шлемов. За посылку из 15 вещей заплачу 360 монет.'}
  };
  const total=def=>def.recipe.reduce((n,line)=>n+line.count,0);
  const signId=key=>'signRegular'+({chef:'Chef',alchemy:'Alchemy',royal:'Royal'}[key]||key);
  let boardSignature='',bookSignature='';
  function ensure(){
    if(!state.story)return null;
    const s=state.story;s.regularContracts??={};
    s.manualAfterDwarf??=state.dwarf?.hired?Math.max(0,state.totalOrders-(s.hireOrders??state.totalOrders)-(state.goblin?.deliveries||0)):0;
    for(const key of Object.keys(DEFINITIONS)){
      const c=s.regularContracts[key]??={signed:false,delegated:false,deliveries:0,nextAt:0};
      c.signed=!!c.signed;c.delegated=!!c.delegated;c.deliveries=Math.max(0,Math.floor(Number(c.deliveries)||0));c.nextAt??=0;
      c.seriesLimit=SERIES_DELIVERIES;c.completed=c.deliveries>=SERIES_DELIVERIES;
      if(!Array.isArray(c.deliveryOrderIds))c.deliveryOrderIds=[];
      if(c.signed||c.completed){c.offerState=c.completed?'completed':'signed';c.offerSeen=true;c.offeredAt??=s.elapsed||0;}
      else if(!['visiting','later'].includes(c.offerState))c.offerState='unseen';
    }
    // Raise only unpaid kitchen/alchemy promises. Their original items,
    // reservations, clocks and historical sales/commissions stay untouched.
    for(const o of new Set([...(state.orders||[]),state.order].filter(Boolean))){
      if(!['chef','alchemy'].includes(o.regularKey)||o.delivered||o.contractRewardVersion===2||s.regularContracts[o.regularKey].deliveryOrderIds.includes(o.id)||state.goblin?.receipts?.some(r=>r.orderId===o.id))continue;
      o.reward=DEFINITIONS[o.regularKey].reward;o.originalReward=o.reward;o.contractRewardVersion=2;
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
    const tower=!!state.city?.towerOwned,kitchen=tower||state.day>=2&&!!state.dwarf?.hired,royal=state.day>=5;
    return key===undefined?kitchen||tower||royal:key==='chef'?kitchen:key==='alchemy'?tower:key==='royal'?royal:false;
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
    let changed=false;
    for(const [key,def] of Object.entries(DEFINITIONS)){
      const c=contracts[key];
      if(!c.signed||c.completed||current(key)||state.story.elapsed<c.nextAt||(state.orders||[]).length>=4)continue;
      const o={id:state.orderUid=(state.orderUid||0)+1,recipe:def.recipe.map(r=>({...r})),packed:[],reservedUids:[],accepted:true,customer:def.customer,reward:def.reward,originalReward:def.reward,contractRewardVersion:2,createdDay:state.day,title:def.title,description:'Поставка '+(c.deliveries+1)+' из '+SERIES_DELIVERIES+': '+total(def)+' вещей по списку.',storyOrder:true,regularKey:key,assignedTo:c.delegated&&state.goblin?.hired?'goblin':'manual'};
      state.orders.push(o);if(!state.order)state.order=o;changed=true;
    }
    if(changed){Goblin.reconcile();save();}
    return changed;
  }
  function signRegular(key){
    const contracts=ensure(),c=contracts?.[key];if(!c||!ready(key)||c.signed||c.completed)return false;
    c.signed=true;c.delegated=false;c.nextAt=state.story.elapsed;c.offerSeen=true;c.offerState='signed';c.offeredAt??=state.story.elapsed||0;
    leaveCounter(key);sync();save();return true;
  }
  function onDelivery(order){
    if(!order?.regularKey)return;
    const c=ensure()?.[order.regularKey];if(!c)return;
    if(c.deliveryOrderIds.includes(order.id))return;
    c.deliveryOrderIds.push(order.id);
    c.deliveries++;c.nextAt=state.story.elapsed+12;
    if(c.deliveries>=SERIES_DELIVERIES){c.completed=true;c.offerState='completed';c.completedAt??=state.story.elapsed;}
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
    render();save();toast('Грик нанят. Выберите посылку и нажмите «Доверить помощнику».');return true;
  }
  function recipeHtml(def,compact=false){
    return '<div class="'+(compact?'counter-contract-recipe':'contract-recipe')+'">'+def.recipe.map(r=>'<span data-count="'+r.count+'" title="'+items[r.type].name+'"><img src="'+asset(items[r.type].sprite)+'" alt="'+items[r.type].name+'"><b>'+r.count+(compact?'':' × '+items[r.type].name)+'</b></span>').join('')+'</div>';
  }
  function progressHtml(c){
    const count=Math.min(SERIES_DELIVERIES,c.deliveries);
    return '<span class="agreement-deliveries" role="img" aria-label="Выдано '+count+' из '+SERIES_DELIVERIES+' посылок">'+Array.from({length:SERIES_DELIVERIES},(_,i)=>'<span class="agreement-delivery'+(i<count?' checked':'')+'" aria-hidden="true">'+(i<count?'✓':'')+'</span>').join('')+'</span>';
  }
  function visibleEntries(contracts,offersOnly=false){
    return Object.entries(DEFINITIONS).filter(([key])=>{
      const c=contracts[key];
      if(c.signed)return !c.completed||!!current(key);
      return ready(key)&&(!offersOnly||c.offerState!=='unseen');
    });
  }
  function addParcelActions(container,o){
    if(typeof renderParcelActions==='function')renderParcelActions(container,o);
  }
  function signAndAssemble(key){
    if(!signRegular(key))return false;
    render();const order=current(key);if(order)openOrder(order);else toast('Договорённость подписана. Посылка появится, когда освободится место в списке.');return true;
  }
  function openOffer(key){
    const def=DEFINITIONS[key],c=ensure()?.[key];if(!def||!c||!state.started||state.paused||state.autoSorting||!c.signed&&!ready(key))return;
    if(c.signed){openBook();return;}
    modal('<div id="contractOfferSheet"><span class="brief-eyebrow">ДОГОВОРЁННОСТЬ · 3 ПОСЫЛКИ</span><h2>'+def.title+'</h2><p>'+def.description+'</p>'+recipeHtml(def)+progressHtml(c)+'<p>'+total(def)+' настоящих вещей · '+def.reward+' монет за посылку · без срока и штрафа</p><button id="signOfferSheet" class="primary" '+(!ready(key)?'disabled':'')+'>Договориться и собрать самому</button><button id="laterOfferSheet">Решить позже</button></div>');
    $('contractOfferSheet').dataset.questRarity='unique';
    $('signOfferSheet').onclick=()=>{closeModal();signAndAssemble(key);};
    $('laterOfferSheet').onclick=()=>{closeModal();postpone(key);render();};
  }
  function renderReception(){
    const offer=activeOffer(),show=!!offer&&state.screen==='reception'&&!visitorQueue().length&&state.visitorCooldown<=0&&!state.bag.length;
    $('reception').classList.toggle('contract-guest',show);
    if(!show){$('receptionAction').classList.remove('contract-counter-actions');delete $('receptionAction').dataset.contractOffer;return false;}
    Story.render();
    const guest=customers[offer.customer];$('visitor').src=asset(guest[2]);$('visitor').alt=guest[0]+', предложение трёх поставок';
    hidden('visitor',false);hidden('speech',false);hidden('bag',true);hidden('parcel',true);
    $('speech').innerHTML='<span class="eyebrow">ДОГОВОРЁННОСТЬ · 3 ПОСЫЛКИ</span><h2>'+guest[0]+'</h2><p>'+offer.description+'</p>';
    const action=$('receptionAction');action.innerHTML='';action.classList.add('contract-counter-actions');action.dataset.contractOffer=offer.key;
    button(action,'Договориться · собрать самому',()=>signAndAssemble(offer.key),'signContractOffer').className='primary';
    button(action,'Решить позже',()=>{postpone(offer.key);render();},'laterContractOffer');
    button(action,'К столу и коробкам',()=>setScreen('work','sort'),'goWork');
    $('notice').innerHTML='<b>'+offer.title+'</b>'+recipeHtml(offer,true)+progressHtml(ensure()[offer.key])+'<span class="counter-contract-payment">3 посылки · по '+total(offer)+' вещей · по '+offer.reward+' монет</span>';
    $('stepHint').textContent='';return true;
  }
  function bookEntries(contracts){
    return visibleEntries(contracts).map(([key,def])=>{
      const c=contracts[key],o=current(key);
      return '<article class="quest-sheet" data-book-contract-key="'+key+'"><span class="brief-eyebrow">'+def.name+'</span><h3>'+def.title+'</h3>'+progressHtml(c)+recipeHtml(def)+'<p>'+(o?(Goblin.readyToClaim?.(o)?'Выполнено':Goblin.isAssigned(o)?'Посылку собирает Грик':'Посылку можно собрать самому')+' · '+o.packed.length+'/'+total(o)+' в посылке':c.signed?'Следующая посылка через '+Math.max(0,Math.ceil(c.nextAt-state.story.elapsed))+' сек.':'Три посылки, без срока и штрафа')+'</p>'+(!c.signed?'<button class="primary" id="'+signId(key)+'" '+(!ready(key)?'disabled':'')+'>Договориться · собрать самому</button>':!o?'<div class="agreement-wait-actions"><button disabled>Собрать самому</button><button disabled>Доверить помощнику</button></div>':'')+'<small>Выдано: '+Math.min(c.deliveries,SERIES_DELIVERIES)+'/'+SERIES_DELIVERIES+' · по '+def.reward+' монет · '+total(def)+' вещей</small></article>';
    }).join('');
  }
  function bindBookActions(){
    for(const key of Object.keys(DEFINITIONS)){
      const b=$(signId(key));if(b)b.onclick=()=>{closeModal();signRegular(key);render();openBook();};
    }
    document.querySelectorAll('[data-book-contract-key]').forEach(article=>{article.dataset.questRarity='unique';const o=current(article.dataset.bookContractKey);if(o)addParcelActions(article,o);});
  }
  function refreshOpenBook(){
    const book=$('regularContractsBook');if(!book||$('modal').classList.contains('hidden')){bookSignature='';return;}
    const contracts=ensure(),signature=JSON.stringify({contracts,waiting:Object.entries(contracts).map(([key,c])=>!current(key)&&Math.max(0,Math.ceil(c.nextAt-state.story.elapsed))),day:state.day,tower:state.city?.towerOwned,orders:(state.orders||[]).map(o=>[o.id,o.reward,o.packed.map(x=>x.uid),o.assignedTo,o.fulfillmentReady,o.delivered]),goblin:[state.goblin?.hired,state.goblin?.enabled,Automation.enabled()]});
    if(signature===bookSignature)return;bookSignature=signature;
    const active=document.activeElement,key=active?.closest('[data-book-contract-key]')?.dataset.bookContractKey,action=active?.dataset.parcelAction,id=active?.id;
    const scrolls=[...document.querySelectorAll('#modal .modal-card,#modalContent,#regularContractsBook')].map(node=>[node,node.scrollTop,node.scrollLeft]);
    book.innerHTML=bookEntries(contracts);bindBookActions();
    const focus=key&&action?book.querySelector('[data-book-contract-key="'+key+'"] [data-parcel-action="'+action+'"]'):id?document.getElementById(id):null;
    if(focus&&book.contains(focus))focus.focus({preventScroll:true});
    for(const [node,top,left]of scrolls){node.scrollTop=top;node.scrollLeft=left;}
  }
  function openBook(){
    if(!state.started||state.paused||state.autoSorting||!state.story)return;
    ensure();Goblin.ensure();bookSignature='';
    modal('<span class="brief-eyebrow">ДОГОВОРЁННОСТИ</span><h2>Договорённости с клиентами</h2><p>Каждый договор — три посылки по своему списку, без срока. Кухня и другие договорённости идут параллельно с обычной торговлей и не задерживают следующий день. Галочка появляется после фактической выдачи.</p>'+(!ready('alchemy')?'<p class="contract-lock">Кухня предлагает снабжение после найма Борина. Алхимик — после покупки старой башни, королевская оружейная — с пятого дня. Принятые посылки остаются в силе.</p>':'')+'<div id="regularContractsBook" class="regular-contracts"></div>',{wide:true,activity:'background',kind:'book'});
    refreshOpenBook();
  }
  function updateBoard(){
    const board=$('contractOfferBoard');if(!board)return;
    const contracts=ensure(),active=!!contracts&&state.started,entries=active?visibleEntries(contracts,true):[];
    hidden('contractOfferBoard',!active||!entries.length);
    board.classList.toggle('work-agreements',state.screen==='work');
    $('game').classList.toggle('has-agreement-board',active&&entries.length>0);
    const signature=JSON.stringify(entries.map(([key])=>{const c=contracts[key],o=current(key);return [key,c.signed,c.offerState,c.delegated,c.deliveries,o?.id,o?.reward,o?.packed.length,o?.assignedTo,!!Goblin.readyToClaim?.(o),!!state.goblin?.hired,!!state.goblin?.enabled,Automation.enabled(),!o&&Math.max(0,Math.ceil(c.nextAt-state.story.elapsed))];}));
    if(signature===boardSignature)return;boardSignature=signature;board.innerHTML='';
    for(const [key,def]of entries){
      const c=contracts[key],o=current(key),leaf=document.createElement('article');board.append(leaf);
      leaf.className='contract-offer-leaf quest-sheet';leaf.dataset.contractKey=key;leaf.dataset.contractState=c.offerState;
      leaf.dataset.questRarity='unique';
      leaf.innerHTML='<span class="agreement-leaf-kind">ДОГОВОРЁННОСТЬ · 3 ПОСЫЛКИ</span>'+progressHtml(c)+(o&&typeof parcelContents==='function'?parcelContents(o):'<h3>'+def.title+'</h3><p class="quest-recipient">Кому: <b>'+customers[def.customer][0]+'</b></p>'+recipeHtml(def)+'<strong class="quest-price">Оплата: '+def.reward+' монет</strong>')+'<small class="agreement-leaf-info">'+(!c.signed?'Предложение · '+total(def)+' вещей':o?o.packed.length+'/'+total(o)+' в посылке':'Следующая через '+Math.max(0,Math.ceil(c.nextAt-state.story.elapsed))+' с')+'</small><small class="agreement-leaf-compact">'+(!c.signed?total(def)+' вещей · '+def.reward:o?o.packed.length+'/'+total(o)+' · '+o.reward:'Повтор через '+Math.max(0,Math.ceil(c.nextAt-state.story.elapsed))+' с')+'</small>';
      if(o)addParcelActions(leaf,o);
      else if(!c.signed)button(leaf,'Посмотреть и договориться',()=>openOffer(key)).className='agreement-open-offer';
      else{
        const waiting=document.createElement('div');waiting.className='agreement-wait-actions';leaf.append(waiting);
        button(waiting,'Собрать самому',()=>{}).disabled=true;
        button(waiting,'Доверить помощнику',()=>{}).disabled=true;
      }
    }
  }
  function setup(){
    button(document.querySelector('footer nav'),'Договорённости',openBook,'contractsNav').className='hidden';
    const board=document.createElement('aside');board.id='contractOfferBoard';board.className='hidden';board.setAttribute('aria-label','Договорённости на три поставки');$('game').append(board);
    const station=button($('reception'),'',()=>openGoblinParcel(),'goblinStation');station.className='hidden';station.innerHTML='<img class="goblin-portrait" src="assets/goblin-grik-packer.png" alt="Грик, гоблин-комплектовщик"><strong>Грик</strong><span class="goblin-label"></span><span class="goblin-progress"><i></i></span>';
    const work=button($('work'),'',()=>openGoblinParcel(),'goblinWorkStatus');work.className='hidden';work.innerHTML='<span></span><i></i>';
  }
  function update(){
    const active=!!state.story&&state.started;hidden('contractsNav',!active||!ready()&&!signedCount());hidden('goblinStation',!active||!state.goblin?.hired||state.screen!=='reception');hidden('goblinWorkStatus',!active||!state.goblin?.hired);
    updateBoard();if(!active)return;ensure();refreshOpenBook();$('game').dataset.goblin=state.goblin?.hired?'hired':'none';
    const status=Goblin.status();$('goblinStation').querySelector('.goblin-label').textContent=status.label;$('goblinStation').querySelector('i').style.width=(status.progress||0)*100+'%';
    $('goblinWorkStatus').querySelector('span').textContent='Грик · '+status.label;$('goblinWorkStatus').querySelector('i').style.width=(status.progress||0)*100+'%';
    $('contractsNav').classList.toggle('upgrade-prompt',ready()&&!state.story.completedB3);
    if(!activeOffer()){$('receptionAction')?.classList.remove('contract-counter-actions');if($('receptionAction'))delete $('receptionAction').dataset.contractOffer;}
  }
  return {ensure,ready,current,signedCount,activeOffer,maybeOffer,renderReception,postpone,openOffer,sync,signRegular,onDelivery,delegate,setDelegated,hire,openBook,setup,update};
})();
