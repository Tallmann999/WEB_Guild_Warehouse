'use strict';

// The guild's shop still buys original offers and sells original parcels. This
// controller only accepts/assigns work; inventory and payment stay in their
// existing transaction functions. Its clock has no offline catch-up.
const Automation=(()=>{
  const STOCK_LIMIT=72,ACTION_SECONDS=.5,UNKNOWN_LIMIT=16;
  const RECEPTION_VISIT_SECONDS=1.5;
  let presentedGuest='',presentationElapsed=0;
  const receptionVisible=()=>state.screen==='reception'&&!modalIsOpen()&&!(typeof City!=='undefined'&&City.isOpen());
  function visitorPresented(key,dt){
    if(!receptionVisible()){presentedGuest='';presentationElapsed=0;return true;}
    if(presentedGuest!==key){presentedGuest=key;presentationElapsed=0;}
    presentationElapsed+=Math.max(0,Math.min(10,Number(dt)||0));
    return presentationElapsed>=RECEPTION_VISIT_SECONDS;
  }
  function ensure(){
    if(!state.story)return null;
    const a=state.story.automation??={};
    a.version=1;a.enabled=a.enabled===true;a.activated=a.activated===true;
    for(const key of ['cooldown','purchases','purchaseSpent','accepted','skipped'])a[key]=Number.isFinite(Number(a[key]))?Math.max(0,Number(a[key])):0;
    a.stockLimit=STOCK_LIMIT;a.lastReason??='Автоторговля ещё не включена';
    return a;
  }
  function enable(){
    const a=ensure();
    if(!a||!state.started||!(state.story.completedB3||(state.goblin?.deliveries||0)>0)||!state.dwarf?.hired||!state.goblin?.hired)return false;
    if(!a.activated){
      a.activated=true;a.startedAt=state.story.elapsed||0;
      // This one-time action is the explicit charter confirmation. Loading or
      // resuming later must never undo an intentional employee switch.
      // Commit both switches with consent below, rather than persisting a
      // half-enabled shop through the workers' individually saving setters.
      state.dwarf.enabled=true;state.goblin.enabled=true;
    }
    a.enabled=true;a.cooldown=0;a.lastReason='Лавка принимает обычные поставки и посылки';save();return true;
  }
  function setEnabled(value){
    const a=ensure();if(!a?.activated)return false;
    a.enabled=!!value;a.cooldown=0;
    a.lastReason=a.enabled?'Автоторговля возобновлена':'Автоторговля приостановлена';save();return true;
  }
  const enabled=()=>!!state.story?.automation?.enabled;
  const blocked=()=>!state.started||state.paused||state.ended||state.autoSorting||state.tutorial?.active||document.hidden||drag||state.selected!==null||BagPour.active()||isModalBlockingWork();
  const processingReserve=()=>state.dwarf?.hired&&state.dwarf.enabled?2:0;
  function freeStock(){
    Goblin.reconcile();
    const reserved=new Set(allOrders().flatMap(o=>o.reservedUids||[])),seen=new Set();
    return state.stock.filter(x=>!isUnknown(x)&&!reserved.has(x.uid)&&state.selected!==x.uid&&drag?.uid!==x.uid&&!isItemBeingExamined(x.uid)&&!seen.has(x.uid)&&seen.add(x.uid));
  }
  function payableParcel(){
    Goblin.reconcile();
    return allOrders().some(o=>o.accepted!==false&&!o.delivered&&o.recipe.every(line=>{
      const packed=o.packed.filter(x=>x.type===line.type).length;
      const stock=state.stock.filter(x=>x.type===line.type&&!isUnknown(x)&&!allOrders().some(other=>other.id!==o.id&&other.reservedUids?.includes(x.uid))).length;
      return packed+stock>=line.count;
    }));
  }
  function canUseSupplierCredit(){
    if(!state.story||state.story.supplierDebt>0)return false;
    // Debt is a real supplier's deferred price, used only when existing goods
    // cannot fund the next purchase. No cash, item or reward is granted here.
    if(state.day<3)return !payableParcel();
    return freeStock().length===0&&!payableParcel();
  }
  function deferSupplier(offer){
    const s=state.story;s.deferredSupplierOffers??=[];
    if(!s.deferredSupplierOffers.includes(offer))s.deferredSupplierOffers.push(offer);
    state.offers=state.offers.filter(value=>value!==offer);
  }
  function recoverBeforeSupplier(){
    const s=state.story;
    if(!s||state.day<3||!s.restored||!state.started||state.paused||state.ended||state.autoSorting||state.tutorial?.active||document.hidden||drag||state.selected!==null||state.bag.length||s.sortingGate||BagPour.active())return false;
    if(allOrders().some(o=>o.recoveryOrder&&!o.delivered))return false;
    const guest=counterGuest();if(guest&&guest.kind!=='bag'||Contracts.activeOffer?.())return false;
    const price=guest?Number(guest.value.price)||0:10,reserve=processingReserve();
    if(state.gold>=price+reserve&&!guest?.value.credit&&state.gold>=10+reserve)return false;
    const free=freeStock();
    if(!free.length){
      if(!guest||guest.value.credit||!canUseSupplierCredit())return false;
      deferSupplier(guest.value);s.forceSupplier=false;s.lastVisitKind='supplier';s.nextVisit=2;
      ensure().lastReason='Нет свободного товара для продажи: следующая поставка будет оплачена из реальной выручки';save();return true;
    }
    if(allOrders().filter(o=>o.accepted!==false).length>=4)return false;
    const byType=new Map();for(const x of free)byType.set(x.type,(byType.get(x.type)||0)+1);
    const selected=[...byType].sort((a,b)=>b[1]-a[1]||a[0]-b[0]);let remaining=Math.min(4,free.length);const count=remaining,recipe=[];
    for(const [type,available]of selected){const take=Math.min(remaining,available);if(take)recipe.push({type,count:take});remaining-=take;if(!remaining)break;}
    if(guest)deferSupplier(guest.value);
    const customer=recipe.every(line=>items[line.type].food)?4:recipe.every(line=>items[line.type].cat===3)?1:recipe.every(line=>[0,1,2].includes(items[line.type].cat)||items[line.type].cat===4&&!items[line.type].food)?0:3;
    const reward=Math.floor(90*count/4),order={id:state.orderUid=(state.orderUid||0)+1,recipe,packed:[],reservedUids:[],accepted:false,customer,reward,originalReward:reward,createdDay:state.day,carried:false,title:'Покупка из запасов лавки',description:'Возьму '+count+' '+(count===1?'вещь':count<5?'вещи':'вещей')+' из ваших запасов за '+reward+' монет. Новая закупка для этой посылки не нужна.',storyOrder:true,recoveryOrder:true,arrivalSerial:state.arrivalSerial=(state.arrivalSerial||0)+1};
    state.orders.push(order);if(!state.order)state.order=order;
    s.ordersCreated=(s.ordersCreated||0)+1;state.dayOrdersCreated=(state.dayOrdersCreated||0)+1;
    s.forceSupplier=false;s.lastVisitKind='customer';s.earlySupplyRun=0;s.nextVisit=2;
    const a=ensure();a.lastReason='Покупатель готов оплатить настоящий запас: '+count+' '+(count===1?'вещь':'вещи')+' за '+reward+' монет';
    Goblin.reconcile();save();return true;
  }
  function resumeDeferredSupplier(){
    const queue=state.story?.deferredSupplierOffers,offer=queue?.[0];
    if(!offer||state.offers.length||state.bag.length)return false;
    const listedPrice=offer.price===undefined?(offer.big?20:10):Math.max(0,Number(offer.price)||0);
    const price=listedPrice+Math.max(0,Number(offer.credit)||0);
    if(state.gold<price+processingReserve())return false;
    // An unbought credit proposal can be paid in full once stock sales have
    // restored cash. Its original goods survive; unnecessary debt does not.
    if(offer.credit){offer.price=price;offer.credit=0;}
    queue.shift();state.offers.push(offer);save();return true;
  }
  function deficitTypes(){
    const missing=new Set();
    for(const o of allOrders().filter(o=>o.accepted!==false&&!o.delivered))for(const line of o.recipe){
      const packed=o.packed.filter(x=>x.type===line.type).length;
      const available=[...state.stock,...state.bag].filter(x=>x.type===line.type&&!isUnknown(x)&&!allOrders().some(other=>other.id!==o.id&&other.reservedUids?.includes(x.uid))).length;
      if(available+packed<line.count)missing.add(line.type);
    }
    return missing;
  }
  function skipOffer(offer,reason){
    if(state.offers[0]!==offer||counterGuest()?.value!==offer)return false;
    state.offers.shift();
    if(state.day>=2&&!state.city?.towerOwned)state.story.earlySupplyRun=(state.story.earlySupplyRun||0)+1;
    state.story.lastVisitKind='supplier';state.story.nextVisit=2;
    startVisitorGap('bag');state.visitorCooldown=2;
    const a=ensure();a.skipped++;a.lastReason=reason;save();return true;
  }
  function acceptOrdinary(o){
    if(o.regularKey||o.accepted!==false||counterGuest()?.value!==o)return false;
    if(allOrders().filter(x=>x.accepted!==false).length>=4)return false;
    // Existing accepted and partly packed manual promises are never adopted.
    o.accepted=true;o.automationOwned=true;
    if(!state.order)state.order=o;
    startVisitorGap('order');Story.onOrderAccepted();
    Goblin.assign(o,true);
    const a=ensure();a.accepted++;a.lastReason='Грик принял обычную посылку';save();return true;
  }
  function advance(dt){
    const a=ensure();if(!a?.enabled||blocked())return false;
    if(!state.dwarf?.enabled||!state.goblin?.enabled){a.lastReason=!state.dwarf?.enabled?'Борин приостановлен: автоторговля ждёт':'Грик приостановлен: автоторговля ждёт';return false;}
    a.cooldown=Math.max(0,a.cooldown-Math.max(0,Math.min(10,Number(dt)||0)));
    if(a.cooldown>0)return false;
    const invitation=Contracts.activeOffer?.();
    if(invitation){
      if(!visitorPresented('contract:'+invitation.key,dt))return false;
      // Agreements are the owner's decision. Leave their persistent sheet for
      // later so an unanswered invitation cannot stop ordinary guild trade.
      Contracts.postpone(invitation.key);a.cooldown=ACTION_SECONDS;
      a.lastReason='Договорённость оставлена хозяину: обычная торговля продолжается';
      render();save();return true;
    }
    const guest=counterGuest();if(!guest){presentedGuest='';presentationElapsed=0;return false;}
    // Let the owner see a visitor arrive at the open counter. The city and
    // workbench retain the normal unattended transaction cadence. This clock
    // is active only: modal, hidden-tab and pause checks have already returned.
    const visitKey=guest.kind+':'+(guest.value.arrivalSerial??guest.value.id??guest.value.loot?.[0]?.uid??'guest');
    if(!visitorPresented(visitKey,dt))return false;
    let changed=false;
    if(guest.kind==='order')changed=acceptOrdinary(guest.value);
    else{
      const offer=guest.value;prepareOffer(offer);
      const missing=deficitTypes();
      const needed=offer.loot.some(x=>missing.has(x.type)&&!isUnknown(x));
      const stock=state.stock.length+state.bag.length;
      const freeKnown=state.stock.filter(x=>!isUnknown(x)&&!allOrders().some(o=>o.reservedUids?.includes(x.uid))).length;
      // Credit is repaid from a real sale, not reserved a second time before
      // purchase. The next operation still keeps Borin's actual batch fee.
      const price=Number(offer.price)||0,required=price+processingReserve();
      if(state.bag.length)return false;
      if(state.gold<required&&recoverBeforeSupplier()){a.lastReason='Продаём готовый запас, затем вернёмся к отложенной поставке';changed=true;}
      else if(state.gold<required)changed=skipOffer(offer,'Поставка пропущена: сохраняем деньги на покупку и работу Борина');
      else if((state.unknownTray||[]).length>=UNKNOWN_LIMIT&&offer.loot.some(isUnknown)&&!needed&&freeKnown>=4)changed=skipOffer(offer,'Поставка пропущена: используем известный запас, неизвестное ждёт хозяина');
      else if(stock+offer.loot.length>STOCK_LIMIT&&!needed)changed=skipOffer(offer,'Поставка пропущена: на складе достаточно товара');
      else{
        const before=state.gold,offerId=offer.arrivalSerial;
        if(buyBag({background:true})){
          a.purchases++;a.purchaseSpent+=before-state.gold;a.lastOffer=offerId;
          a.lastReason='Куплен мешок: Борин разбирает настоящую поставку';changed=true;
        }
      }
    }
    if(changed){
      a.cooldown=ACTION_SECONDS;a.lastActionAt=state.story.elapsed||0;
      // render() preserves the player's screen/mode and never opens a modal.
      render();save();
    }
    return changed;
  }
  function status(){
    const a=ensure();
    if(!a?.activated)return {enabled:false,activated:false,label:'Автоторговля ещё не открыта',stockLimit:STOCK_LIMIT};
    const label=!a.enabled?'Автоторговля приостановлена':!state.dwarf?.enabled?'Борин приостановлен':!state.goblin?.enabled?'Грик приостановлен':a.lastReason;
    return {enabled:a.enabled,activated:true,label,stockLimit:STOCK_LIMIT,purchases:a.purchases,spent:a.purchaseSpent,accepted:a.accepted,skipped:a.skipped};
  }
  function afterLoad(){ensure();presentedGuest='';presentationElapsed=0;}
  return {ensure,enable,setEnabled,enabled,advance,status,afterLoad,STOCK_LIMIT,processingReserve,recoverBeforeSupplier,resumeDeferredSupplier,canUseSupplierCredit};
})();
