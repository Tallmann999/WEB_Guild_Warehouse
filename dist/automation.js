'use strict';

// The guild's shop still buys original offers and sells original parcels. This
// controller only accepts/assigns work; inventory and payment stay in their
// existing transaction functions. Its clock has no offline catch-up.
const Automation=(()=>{
  const STOCK_LIMIT=72,ACTION_SECONDS=.5,UNKNOWN_LIMIT=16;
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
  const blocked=()=>!state.started||state.paused||state.ended||state.autoSorting||state.tutorial?.active||document.hidden||drag||state.selected!==null||BagPour.active()||!$('modal').classList.contains('hidden');
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
      // Agreements are the owner's decision. Leave their persistent sheet for
      // later so an unanswered invitation cannot stop ordinary guild trade.
      Contracts.postpone(invitation.key);a.cooldown=ACTION_SECONDS;
      a.lastReason='Договорённость оставлена хозяину: обычная торговля продолжается';
      render();save();return true;
    }
    const guest=counterGuest();if(!guest)return false;
    let changed=false;
    if(guest.kind==='order')changed=acceptOrdinary(guest.value);
    else{
      const offer=guest.value;prepareOffer(offer);
      const missing=deficitTypes();
      const needed=offer.loot.some(x=>missing.has(x.type)&&!isUnknown(x));
      const stock=state.stock.length+state.bag.length;
      const freeKnown=state.stock.filter(x=>!isUnknown(x)&&!allOrders().some(o=>o.reservedUids?.includes(x.uid))).length;
      const price=Number(offer.price)||0,required=price+2+Math.max(0,Number(offer.credit)||0);
      if(state.bag.length)return false;
      if(state.gold<required)changed=skipOffer(offer,'Поставка пропущена: сохраняем деньги на покупку и работу Борина');
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
  function afterLoad(){ensure();}
  return {ensure,enable,setEnabled,enabled,advance,status,afterLoad,STOCK_LIMIT};
})();
