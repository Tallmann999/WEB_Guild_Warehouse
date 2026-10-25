'use strict';

// Reservations and movements refer to the original inventory instances. A parcel
// changes hands in one synchronous transaction; animation never owns its stock.
const Goblin = (()=>{
  const VERSION=2,HIRE_COST=240,DELIVERY_FEE=3,ITEM_SECONDS=2,DISPATCH_SECONDS=3;
  let needsRefresh=false;
  const number=(value,fallback=0)=>Number.isFinite(Number(value))?Math.max(0,Number(value)):fallback;
  const orders=()=>state.orders||[];
  const busy=uid=>state.selected===uid||drag?.uid===uid;
  const isAssigned=o=>!!o&&o.assignedTo==='goblin';
  const automationPaused=o=>!!o?.automationOwned&&typeof Automation!=='undefined'&&!Automation.enabled();
  const complete=o=>!!o&&o.recipe.every(r=>o.packed.filter(x=>x.type===r.type).length===r.count);
  const receptionVisible=()=>state.screen==='reception'&&!(typeof City!=='undefined'&&City.isOpen());
  const readyToClaim=o=>!!o&&isAssigned(o)&&o.accepted!==false&&!o.delivered&&!!o.fulfillmentReady&&complete(o);
  const blocked=()=>!state.started||state.paused||state.ended||state.autoSorting||state.tutorial?.active||document.hidden||typeof BagPour!=='undefined'&&BagPour.active();
  function ensure(){
    if(!state.story)return null;
    const g=state.goblin??={};
    g.version=VERSION;g.hired=!!g.hired;g.enabled=g.enabled!==false;
    for(const key of ['packed','deliveries','gross','feesPaid','spent'])g[key]=number(g[key]);
    if(!Array.isArray(g.receipts))g.receipts=[];
    for(const o of orders()){
      o.packed??=[];
      if(!Array.isArray(o.reservedUids))o.reservedUids=[];
      if(!g.hired&&isAssigned(o))o.assignedTo='manual';
      // Readiness belongs to the real packed parcel, not to its leaflet DOM.
      if(o.fulfillmentReady&&(!isAssigned(o)||!complete(o)))delete o.fulfillmentReady;
    }
    for(const field of ['job','suspendedAutomationJob'])if(g[field]){
      const job=g[field],o=orders().find(o=>o.id===job.orderId);
      if(!o||!isAssigned(o)||o.accepted===false||o.delivered||g.receipts.some(r=>r.orderId===o.id))g[field]=null;
      else{
        job.kind=job.kind==='dispatch'?'dispatch':'pack';
        job.elapsed=number(job.elapsed);
        job.duration=job.kind==='dispatch'?DISPATCH_SECONDS:ITEM_SECONDS;
      }
    }
    return g;
  }
  function eligible(){
    const s=state.story;
    return !!s?.completedB2&&state.day>=3;
  }
  function unlocked(){return eligible()&&!!(state.goblin?.hired||state.story.goblinEncounterSeen||state.story.goblinEncounterPending);}
  function canHire(){return unlocked()&&!state.goblin?.hired&&state.gold>=HIRE_COST;}
  function hire(){
    const g=ensure();
    if(!g||state.paused||!canHire())return false;
    state.gold-=HIRE_COST;state.daySpent=(state.daySpent||0)+HIRE_COST;
    g.hired=true;g.enabled=true;g.pendingFirstParcel=true;g.hiredAt=state.story.elapsed||0;g.spent+=HIRE_COST;
    state.story.goblinEncounterSeen=true;state.story.goblinEncounterPending=false;
    if(typeof showGoldSpend==='function')showGoldSpend(HIRE_COST);
    adoptFirstParcel(g);reconcile();needsRefresh=true;save();return true;
  }
  function setEnabled(value){
    const g=ensure();if(!g?.hired)return false;
    g.enabled=!!value;save();return true;
  }
  function assign(o,value=true){
    const g=ensure();
    if(!g?.hired||!o||!orders().includes(o)||o.accepted===false||o.delivered)return false;
    g.pendingFirstParcel=false;
    // Returning an automatic parcel to the owner ends that ownership policy.
    // A later explicit assignment follows the employee switch, not autotrade.
    if(!value){delete o.automationOwned;delete o.fulfillmentReady;}
    if(isAssigned(o)===!!value){reconcile();needsRefresh=true;save();return true;}
    o.assignedTo=value?'goblin':'manual';
    if(g.job?.orderId===o.id)g.job=null;
    if(g.suspendedAutomationJob?.orderId===o.id)g.suspendedAutomationJob=null;
    if(value&&state.order===o&&state.screen==='work'&&state.mode==='order'){
      cancelDrag();state.mode='sort';state.activeCat=null;state.inspectCat=null;
    }
    reconcile();needsRefresh=true;save();return true;
  }
  function adoptFirstParcel(g){
    if(!g.pendingFirstParcel||!g.hired||!g.enabled||drag||state.selected!==null&&state.selected!==undefined)return false;
    // Hiring grants one initial assignment. Later manual parcels still need
    // their own explicit button or the shop's ordinary autotrade policy.
    const o=orders().find(o=>o.accepted!==false&&!o.delivered&&!isAssigned(o));
    if(!o)return false;
    g.pendingFirstParcel=false;
    return assign(o,true);
  }
  function reconcile(){
    const g=ensure();if(!g)return false;
    const free=[...(state.stock||[]),...(state.bag||[])].filter(x=>!isUnknown(x));
    const byUid=new Map(free.map(x=>[x.uid,x])),used=new Set();let changed=false;
    // Preserve all existing claims within one priority group before filling any
    // gaps. Returning an early worker order to the player must not take another
    // manual parcel's valid uid merely because it appears later in the list.
    const reserveGroup=group=>{
      const plans=group.map(o=>({o,need:new Map(o.recipe.map(r=>[r.type,Math.max(0,r.count-o.packed.filter(x=>x.type===r.type).length)])),next:[]}));
      const take=(plan,uid)=>{
        const x=byUid.get(uid);
        if(!x||used.has(uid)||!(plan.need.get(x.type)>0))return;
        plan.next.push(uid);used.add(uid);plan.need.set(x.type,plan.need.get(x.type)-1);
      };
      for(const plan of plans)for(const uid of plan.o.reservedUids)take(plan,uid);
      for(const plan of plans)for(const x of free)take(plan,x.uid);
      for(const {o,next} of plans)if(next.length!==o.reservedUids.length||next.some((uid,i)=>uid!==o.reservedUids[i])){o.reservedUids=next;changed=true;}
    };
    // Manual promises, including an offered visitor order, outrank automation.
    reserveGroup(orders().filter(o=>!isAssigned(o)));
    reserveGroup(orders().filter(isAssigned));
    if(g.job&&!validJob(g.job)){g.job=null;changed=true;}
    return changed;
  }
  function canUse(uid,orderId){
    if(!state.story)return true;
    reconcile();
    const current=orders().find(o=>o.id===orderId);
    if(!current||isAssigned(current))return false;
    const owner=orders().find(o=>o.reservedUids.includes(uid));
    return !owner||owner.id===orderId;
  }
  function validJob(job){
    const o=orders().find(o=>o.id===job.orderId);
    if(!o||!isAssigned(o)||o.accepted===false||o.delivered)return false;
    if(job.kind==='dispatch')return complete(o)&&!o.packed.some(x=>busy(x.uid));
    const x=state.stock.find(x=>x.uid===job.uid);
    return !!x&&!isUnknown(x)&&!busy(x.uid)&&o.reservedUids.includes(x.uid)&&o.recipe.some(r=>r.type===x.type&&o.packed.filter(y=>y.type===r.type).length<r.count);
  }
  function nextJob(g){
    if(g.suspendedAutomationJob&&!automationPaused(orders().find(o=>o.id===g.suspendedAutomationJob.orderId))){
      const saved=g.suspendedAutomationJob;g.suspendedAutomationJob=null;
      if(validJob(saved)){g.job=saved;return true;}
    }
    for(const o of orders().filter(o=>isAssigned(o)&&o.accepted!==false&&!o.delivered&&!automationPaused(o))){
      if(g.receipts.some(r=>r.orderId===o.id))continue;
      if(complete(o)&&!o.packed.some(x=>busy(x.uid))){
        if(!o.fulfillmentReady){o.fulfillmentReady=true;needsRefresh=true;save();}
        if(receptionVisible())continue;
        g.job={kind:'dispatch',orderId:o.id,elapsed:0,duration:DISPATCH_SECONDS};return true;
      }
      const x=state.stock.find(x=>o.reservedUids.includes(x.uid)&&!isUnknown(x)&&!busy(x.uid));
      if(x){g.job={kind:'pack',orderId:o.id,uid:x.uid,elapsed:0,duration:ITEM_SECONDS};return true;}
    }
    return false;
  }
  function finishJob(g){
    const job=g.job;if(!job||!validJob(job)){g.job=null;return false;}
    const o=orders().find(o=>o.id===job.orderId);
    if(job.kind==='pack'){
      const index=state.stock.findIndex(x=>x.uid===job.uid),x=state.stock[index];
      state.stock.splice(index,1);delete x.boxPos;delete x.tablePos;delete x.parcelPos;
      o.packed.push(x);g.packed++;g.job=null;
      if(complete(o))o.fulfillmentReady=true;
      reconcile();needsRefresh=true;save();return true;
    }
    o.fulfillmentReady=true;
    return deliver(o,g);
  }
  function deliver(o,g){
    if(!o||!orders().includes(o)||!readyToClaim(o)||g.receipts.some(r=>r.orderId===o.id))return false;
    if(g.job?.orderId===o.id)g.job=null;
    if(g.suspendedAutomationJob?.orderId===o.id)g.suspendedAutomationJob=null;
    const gross=number(o.reward),fee=Math.min(DELIVERY_FEE,gross);
    // Mark and remove before recording the credit: a reload can only observe
    // either the unfinished parcel or the completed transaction, never both.
    const receipt={orderId:o.id,regularKey:o.regularKey,uids:o.packed.map(x=>x.uid),gross,fee,at:state.story.elapsed||0};
    o.delivered=true;g.receipts.push(receipt);
    state.orders=orders().filter(x=>x!==o&&x.id!==o.id);
    if(state.order?.id===o.id){
      state.order=state.orders.find(x=>!isAssigned(x)&&x.accepted!==false)||state.orders[0]||null;
      if(state.screen==='work'&&state.mode==='order'){
        state.mode='sort';state.activeCat=null;state.inspectCat=null;
      }
    }
    state.gold+=gross-fee;state.dayIncome=(state.dayIncome||0)+gross;state.daySpent=(state.daySpent||0)+fee;
    state.rep=(state.rep||0)+4;state.totalOrders=(state.totalOrders||0)+1;state.dayOrders=(state.dayOrders||0)+1;
    g.deliveries++;g.gross+=gross;g.feesPaid+=fee;g.spent+=fee;g.lastReceipt=receipt;
    needsRefresh=true;reconcile();
    Story.onOrderDelivered(o,'goblin');
    toast('Гоблин выдал посылку: +'+gross+' монет · комиссия '+fee+' · в кассу +'+(gross-fee)+'.');
    save();return true;
  }
  function claim(o){
    const g=ensure();
    if(!g?.hired||state.paused||document.hidden||!readyToClaim(o)||o.packed.some(x=>busy(x.uid)))return false;
    const delivered=deliver(o,g);if(delivered)refresh();return delivered;
  }
  function refresh(){
    if(!needsRefresh||drag)return;
    needsRefresh=false;
    if(state.screen==='work'){
      const ids=['sourceScroll','inspectScroll','targetScroll','packedScroll'];
      const scrolls=ids.map(id=>document.getElementById(id)?.scrollTop||0);
      renderWork();
      if(state.inspectCat!==null&&typeof renderInspection==='function')renderInspection();
      if(state.inspectCat==='junk'&&typeof renderTarget==='function')renderTarget();
      ids.forEach((id,i)=>{const el=document.getElementById(id);if(el)el.scrollTop=scrolls[i];});
      if(typeof revealSourceContents==='function')revealSourceContents();
    }else renderReception();
    updateHud();
  }
  function advance(dt){
    const g=ensure();if(!g||blocked())return;
    let changed=reconcile();
    if(!g.hired||!g.enabled){if(changed)save();refresh();return;}
    changed=adoptFirstParcel(g)||changed;
    // Save the paused automatic operation separately so an explicitly assigned
    // parcel can still use Grik. Its elapsed clock resumes without repacking.
    if(g.job&&automationPaused(orders().find(o=>o.id===g.job.orderId))){g.suspendedAutomationJob=g.job;g.job=null;changed=true;}
    // Returning to the counter changes only presentation: no sale happens
    // behind the owner's ready button, and packed instances remain intact.
    if(g.job?.kind==='dispatch'&&receptionVisible()){
      const o=orders().find(o=>o.id===g.job.orderId);
      if(o)o.fulfillmentReady=true;
      g.job=null;changed=true;needsRefresh=true;
    }
    let remaining=Math.max(0,Math.min(10,Number(dt)||0));
    for(let steps=0;steps<8&&remaining>0;steps++){
      if(!g.job){if(!nextJob(g))break;changed=true;}
      const used=Math.min(remaining,Math.max(0,g.job.duration-g.job.elapsed));
      g.job.elapsed+=used;remaining-=used;
      if(g.job.elapsed>=g.job.duration){finishJob(g);changed=true;}else break;
    }
    if(changed)save();refresh();
  }
  function status(){
    const g=ensure();
    const base={hired:!!g?.hired,enabled:!!g?.enabled,cost:HIRE_COST,fee:DELIVERY_FEE,secondsPerItem:ITEM_SECONDS,dispatchSeconds:DISPATCH_SECONDS,packed:g?.packed||0,deliveries:g?.deliveries||0,gross:g?.gross||0,feesPaid:g?.feesPaid||0,spent:g?.spent||0,lastReceipt:g?.lastReceipt||null,progress:0};
    if(!g)return {...base,state:'inactive',label:'Помощник недоступен в старой версии'};
    if(!g.hired){
      const ready=canHire();
      const label=!state.story.completedB2?'Сначала поработайте вместе с Борином':state.day<3?'Грик придёт с третьего дня':!unlocked()?'Грик скоро подойдёт к стойке':state.gold<HIRE_COST?'Накопите 240 монет':'Грик готов к найму';
      return {...base,state:ready?'ready_to_hire':'locked',canHire:ready,label};
    }
    const pending=orders().filter(o=>isAssigned(o)&&o.accepted!==false&&!o.delivered);
    const common={...base,pending:pending.length,progress:g.job?Math.min(1,g.job.elapsed/g.job.duration):0,orderId:g.job?.orderId||null,currentUid:g.job?.uid||null};
    if(!g.enabled)return {...common,state:'disabled',label:'Работа приостановлена'};
    if(blocked())return {...common,state:'paused',label:'Гоблин ждёт, пока вы вернётесь'};
    if(receptionVisible()&&pending.some(readyToClaim))return {...common,state:'ready',progress:1,orderId:pending.find(readyToClaim).id,label:'Посылка готова · нажмите «Выполнено» на листке'};
    if(g.job?.kind==='dispatch')return {...common,state:'dispatching',label:'Выдаёт готовую посылку · комиссия 3 монеты'};
    if(g.job){const x=state.stock.find(x=>x.uid===g.job.uid);return {...common,state:'packing',label:'Упаковывает: '+(items[x?.type]?.name||'компонент')};}
    if(!pending.length)return {...common,state:'idle',label:g.pendingFirstParcel?'Ждёт первую принятую посылку':typeof Automation!=='undefined'&&Automation.enabled()?'Ждёт обычную посылку — автоторговля включена':'Доверьте Грику посылку кнопкой на листке'};
    if(pending.some(o=>o.reservedUids.some(uid=>busy(uid))))return {...common,state:'waiting_for_hands',label:'Ждёт, пока вы отпустите нужную вещь'};
    if(pending.some(o=>o.reservedUids.some(uid=>state.bag.some(x=>x.uid===uid))))return {...common,state:'waiting_for_sorting',label:'Ждёт разбор купленной поставки'};
    const o=pending[0],line=o.recipe.find(r=>o.packed.filter(x=>x.type===r.type).length+o.reservedUids.filter(uid=>state.stock.some(x=>x.uid===uid&&x.type===r.type)).length<r.count);
    return {...common,state:'waiting_for_stock',label:line?'Нужны свободные товары: '+items[line.type].name:'Ждёт свободный товар · ручные резервы защищены'};
  }
  return {ensure,eligible,unlocked,canHire,hire,setEnabled,assign,reconcile,canUse,advance,status,isAssigned,refresh,readyToClaim,isReady:readyToClaim,claim};
})();
