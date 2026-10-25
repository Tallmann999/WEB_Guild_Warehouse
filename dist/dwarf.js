'use strict';

// This module is loaded before game.js. All state access stays inside its API.
const Dwarf = (()=>{
  const VERSION=1,HIRE_COST=120,BATCH_FEE=2,ITEM_SECONDS=2.5;
  let needsRefresh=false;
  const number=(value,fallback=0)=>Number.isFinite(Number(value))?Math.max(0,Number(value)):fallback;
  const active=()=>!!state.story;
  function ensure(){
    if(!active())return null;
    state.unknownTray??=[];
    const d=state.dwarf??={};
    d.version=VERSION;d.hired=!!d.hired;d.enabled=d.enabled!==false;
    d.sorted=number(d.sorted);d.routedUnknown=number(d.routedUnknown);d.completedBatches=number(d.completedBatches);
    d.feesPaid=number(d.feesPaid);d.spent=number(d.spent);d.batchSerial=number(d.batchSerial);
    if(!Array.isArray(d.batches))d.batches=[];
    const ids=new Set();
    d.batches=d.batches.filter(b=>b&&typeof b.id==='string'&&!ids.has(b.id)&&ids.add(b.id));
    for(const b of d.batches){
      b.uids=[...new Set(Array.isArray(b.uids)?b.uids:[])];b.feePaid=!!b.feePaid;b.completed=!!b.completed;
      b.worked=number(b.worked);b.sorted=number(b.sorted);b.unknown=number(b.unknown);
    }
    if(d.job){
      const x=state.bag.find(x=>x.uid===d.job.uid),b=d.batches.find(b=>b.id===d.job.batchId);
      if(!x||!b||!b.feePaid||b.completed||!b.uids.includes(x.uid))d.job=null;
      else{d.job.elapsed=number(d.job.elapsed);d.job.duration=ITEM_SECONDS;}
    }
    return d;
  }
  function register(list){
    const d=ensure();if(!d)return null;
    const pending=list.filter(x=>x&&state.bag.some(y=>y.uid===x.uid)&&!d.batches.some(b=>b.uids.includes(x.uid)));
    if(!pending.length)return null;
    let id;do{id='dwarf-batch-'+(++d.batchSerial);}while(d.batches.some(b=>b.id===id));
    const b={id,uids:pending.map(x=>x.uid),feePaid:false,completed:false,worked:0,sorted:0,unknown:0};
    d.batches.push(b);for(const x of pending)x.dwarfBatchId=id;
    return b;
  }
  function onBagPurchased(loot){
    if(!active()||!Array.isArray(loot))return null;
    const b=register(loot);if(b)save();return b?.id||null;
  }
  function unlocked(){
    const s=state.story;
    return !!s?.restored&&(!!s.dwarfEncounterSeen||!!s.dwarfEncounterPending||state.day>2||s.secondDaySorted>=2&&s.secondDayDeliveries>=1||!s.secondDayActive&&state.totalOrders>=3);
  }
  function canHire(){return unlocked()&&!state.dwarf?.hired&&state.gold>=HIRE_COST;}
  function hire(){
    const d=ensure();if(!d||!canHire())return false;
    state.gold-=HIRE_COST;state.daySpent=(state.daySpent||0)+HIRE_COST;
    d.hired=true;d.enabled=true;d.hiredAt=state.story.elapsed||0;d.spent+=HIRE_COST;d.job=null;
    if(typeof showGoldSpend==='function')showGoldSpend(HIRE_COST);
    // Only the loose workbench is adopted; stock, offers and partial parcels stay intact.
    register(state.bag);updateHud();save();return true;
  }
  function setEnabled(value){const d=ensure();if(!d||!d.hired)return false;d.enabled=!!value;updateVisual();save();return true;}
  function release(uid){
    const d=ensure();if(!d?.job||uid!==undefined&&uid!==null&&d.job.uid!==uid)return false;
    d.job=null;updateVisual();save();return true;
  }
  function isClaimed(uid){const d=ensure();return !!(d?.hired&&d.enabled&&d.job?.uid===uid);}
  function busy(x){return state.selected===x.uid||drag?.uid===x.uid;}
  function blocked(){return !state.started||state.paused||state.ended||state.autoSorting||state.tutorial?.active||document.hidden||typeof BagPour!=='undefined'&&BagPour.active();}
  function settle(d){
    let changed=false;
    for(const b of d.batches){
      if(b.completed||b.uids.some(uid=>state.bag.some(x=>x.uid===uid)))continue;
      b.completed=true;if(b.worked>0)d.completedBatches++;changed=true;
    }
    return changed;
  }
  function nextJob(d){
    // Known components go first. A mystery never stalls a batch of known goods.
    const candidates=state.bag.filter(x=>!busy(x));
    candidates.sort((a,b)=>Number(isUnknown(a))-Number(isUnknown(b)));
    for(const x of candidates){
      const b=d.batches.find(b=>!b.completed&&b.uids.includes(x.uid));
      if(!b||!b.feePaid&&state.gold<BATCH_FEE)continue;
      if(!b.feePaid){
        // Pay exactly once before starting actual work; the flag survives save/load.
        state.gold-=BATCH_FEE;state.daySpent=(state.daySpent||0)+BATCH_FEE;
        b.feePaid=true;d.feesPaid++;d.spent+=BATCH_FEE;
      }
      d.job={uid:x.uid,batchId:b.id,elapsed:0,duration:ITEM_SECONDS};save();updateHud();return true;
    }
    return false;
  }
  function finishJob(d){
    const job=d.job,b=d.batches.find(b=>b.id===job?.batchId);
    const index=state.bag.findIndex(x=>x.uid===job?.uid),x=state.bag[index];
    if(!x||!b||busy(x)){d.job=null;return false;}
    const unknown=isUnknown(x);
    // Move the original instance atomically. No async callback owns inventory.
    state.bag.splice(index,1);delete x.tablePos;delete x.boxPos;
    if(unknown){state.unknownTray.push(x);d.routedUnknown++;b.unknown++;}
    else{
      const cat=items[x.type].cat,count=stockFor(cat).length;
      x.boxPos={x:(count%5)*.18,y:8+Math.floor(count/5)*68};x.boxAngle=0;
      state.stock.push(x);state.daySorted=(state.daySorted||0)+1;d.sorted++;b.sorted++;
    }
    b.worked++;d.job=null;
    // The story has no legacy +10 sorting reward; close its bookkeeping quietly.
    for(const batch of state.sortingBatches||[])batch.pending=batch.pending.filter(uid=>uid!==x.uid);
    state.sortingBatches=(state.sortingBatches||[]).filter(batch=>batch.pending.length);
    settle(d);needsRefresh=true;save();return true;
  }
  function refresh(){
    if(!needsRefresh||drag)return;
    needsRefresh=false;
    if(state.screen==='work'){
      const source=document.getElementById('sourceScroll'),inspect=document.getElementById('inspectScroll'),target=document.getElementById('targetScroll');
      const sourceTop=source?.scrollTop||0,inspectTop=inspect?.scrollTop||0,targetTop=target?.scrollTop||0;
      renderWork();
      if(state.inspectCat!==null&&typeof renderInspection==='function')renderInspection();
      if(state.inspectCat==='junk'&&typeof renderTarget==='function')renderTarget();
      const nextSource=document.getElementById('sourceScroll'),nextInspect=document.getElementById('inspectScroll'),nextTarget=document.getElementById('targetScroll');
      if(nextSource)nextSource.scrollTop=sourceTop;if(nextInspect)nextInspect.scrollTop=inspectTop;if(nextTarget)nextTarget.scrollTop=targetTop;
      if(typeof revealSourceContents==='function')revealSourceContents();
    }
    updateHud();
  }
  function advance(dt){
    const d=ensure();if(!d?.hired||!state.story.restored)return;
    if(blocked()){updateVisual();return;}
    if(!d.enabled){refresh();updateVisual();return;}
    register(state.bag);
    let changed=settle(d),remaining=Math.max(0,Math.min(10,Number(dt)||0));
    // Bounded loop also supports a larger playtest step without an unbounded catch-up.
    for(let steps=0;steps<8&&remaining>0;steps++){
      if(d.job){const x=state.bag.find(x=>x.uid===d.job.uid);if(!x||busy(x)){d.job=null;changed=true;}}
      if(!d.job&&!nextJob(d))break;
      const used=Math.min(remaining,Math.max(0,ITEM_SECONDS-d.job.elapsed));
      d.job.elapsed+=used;remaining-=used;
      if(d.job.elapsed>=ITEM_SECONDS){finishJob(d);changed=true;}else break;
    }
    if(changed)save();refresh();updateVisual();
  }
  function status(){
    const d=ensure();
    const base={hired:!!d?.hired,enabled:!!d?.enabled,cost:HIRE_COST,fee:BATCH_FEE,secondsPerItem:ITEM_SECONDS,sorted:d?.sorted||0,routedUnknown:d?.routedUnknown||0,completedBatches:d?.completedBatches||0,feesPaid:d?.feesPaid||0,spent:d?.spent||0,progress:0,currentUid:null};
    if(!d)return {...base,state:'inactive',label:'Помощник недоступен в старой версии'};
    if(!d.hired){
      const ready=canHire();
      const label=!state.story.restored?'Сначала восстановите лавку':!unlocked()?'Борин придёт после первой посылки второго дня':state.gold<HIRE_COST?'Накопите 120 монет':'Борин готов к найму';
      return {...base,state:ready?'ready_to_hire':'locked',canHire:ready,label};
    }
    const pending=state.bag.length,unknown=state.unknownTray.length;
    const common={...base,pending,unknown,commission:'2 монеты за партию, авансом один раз'};
    if(!d.enabled)return {...common,state:'disabled',label:'Работа приостановлена'};
    if(blocked())return {...common,state:'paused',label:'Борин ждёт, пока вы вернётесь',progress:d.job?Math.min(1,d.job.elapsed/ITEM_SECONDS):0};
    if(d.job){const x=state.bag.find(x=>x.uid===d.job.uid);return {...common,state:'sorting',currentUid:d.job.uid,progress:Math.min(1,d.job.elapsed/ITEM_SECONDS),batchId:d.job.batchId,label:x&&isUnknown(x)?'Откладывает неизвестную находку':'Раскладывает: '+(items[x?.type]?.name||'компонент')};}
    if(pending&&state.gold<BATCH_FEE&&!d.batches.some(b=>!b.completed&&b.feePaid&&b.uids.some(uid=>state.bag.some(x=>x.uid===uid))))return {...common,state:'waiting_for_gold',label:'Нужно 2 монеты за новую партию'};
    if(pending)return {...common,state:'waiting_for_hands',label:'Ждёт свободные компоненты'};
    return {...common,state:'idle',label:unknown?'Партия разобрана · неизвестные на подносе':'Партия разобрана · ждёт поставку'};
  }
  function clearVisual(){
    document.querySelectorAll('.dwarf-carried').forEach(e=>e.classList.remove('dwarf-carried'));
    document.getElementById('dwarfCarrier')?.classList.add('hidden');
    document.getElementById('dwarfPickupSpot')?.classList.add('hidden');
  }
  function updateVisual(){
    const work=document.getElementById('work');if(!work)return;
    const d=ensure(),x=d?.job&&state.bag.find(x=>x.uid===d.job.uid);
    if(!state.started||!d?.hired||!d.enabled||!x||busy(x)||state.screen!=='work'||state.mode!=='sort'||typeof City!=='undefined'&&City.isOpen()||BagPour.active()){clearVisual();return;}
    let carrier=document.getElementById('dwarfCarrier'),spot=document.getElementById('dwarfPickupSpot');
    if(!carrier){
      carrier=document.createElement('div');carrier.id='dwarfCarrier';carrier.setAttribute('aria-hidden','true');
      carrier.innerHTML='<img class="dwarf-carrier-body" src="assets/dwarf-borin-carry.png" alt=""><span class="dwarf-carrier-item"><img alt=""><i>?</i></span>';
      work.append(carrier);
      spot=document.createElement('div');spot.id='dwarfPickupSpot';spot.setAttribute('aria-hidden','true');spot.innerHTML='<img alt=""><small>Разбор поставки</small>';work.append(spot);
    }
    const source=state.mode==='sort'?document.querySelector('#pile [data-uid="'+x.uid+'"]'):null;
    const target=isUnknown(x)?document.getElementById('unknownTrayButton'):document.querySelector('#shelves [data-cat="'+items[x.type].cat+'"] .boxart');
    const bounds=work.getBoundingClientRect();if(!target||!bounds.width||!target.getClientRects().length){clearVisual();return;}
    const unit=bounds.width/work.clientWidth,to=target.getBoundingClientRect(),from=source?.getBoundingClientRect();
    const size=from?.width?from.width/unit:88,height=size*2,width=height*.75;
    const sx=from?.width?(from.left+from.width/2-bounds.left)/unit:work.clientWidth-138;
    const sy=from?.height?(from.top+from.height/2-bounds.top)/unit:work.clientHeight-95;
    const tx=(to.left+to.width/2-bounds.left)/unit,ty=(to.top+to.height/2-bounds.top)/unit;
    const p=Math.max(0,Math.min(1,d.job.elapsed/ITEM_SECONDS)),carry=Math.max(0,Math.min(1,(p-.28)/.62)),face=tx>=sx?1:-1;
    const px=sx+(tx-sx)*carry,py=sy+(ty-sy)*carry-Math.sin(carry*Math.PI)*16;
    const bob=Math.sin(p*Math.PI*14)*2;
    carrier.classList.remove('hidden');carrier.dataset.uid=String(x.uid);carrier.dataset.phase=p<.18?'approach':p<.28?'grab':p<.9?'carry':'deposit';
    Object.assign(carrier.style,{left:(px-width*(face>0?.81:.19))+'px',top:(py-height*.51+bob)+'px',width:width+'px',height:height+'px'});
    carrier.style.setProperty('--carrier-face',face);carrier.style.setProperty('--carrier-hand',face>0?'81%':'19%');
    const art=asset(items[x.type].sprite),item=carrier.querySelector('.dwarf-carrier-item');
    if(item.querySelector('img').getAttribute('src')!==art)item.querySelector('img').src=art;
    item.style.width=size+'px';item.style.height=size+'px';item.style.opacity=p>=.18&&p<.98?'1':'0';item.style.setProperty('--drop-scale',p>.9?Math.max(.25,1-(p-.9)*7):1);
    carrier.classList.toggle('unknown',isUnknown(x));
    document.querySelectorAll('.dwarf-carried').forEach(e=>{if(e!==source||p<.18)e.classList.remove('dwarf-carried');});
    if(source)source.classList.toggle('dwarf-carried',p>=.18);
    spot.classList.toggle('hidden',!!source||p>=.18);spot.style.left=(sx-size/2)+'px';spot.style.top=(sy-size/2)+'px';spot.style.width=size+'px';spot.style.height=size+'px';
    if(spot.querySelector('img').getAttribute('src')!==art)spot.querySelector('img').src=art;
    spot.classList.toggle('unknown',isUnknown(x));
  }
  return {ensure,unlocked,canHire,hire,setEnabled,advance,onBagPurchased,release,isClaimed,status,updateVisual};
})();
