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
  function hire(){
    const d=ensure();if(!d||d.hired||!state.story.restored||state.totalOrders<3||state.gold<HIRE_COST)return false;
    state.gold-=HIRE_COST;state.daySpent=(state.daySpent||0)+HIRE_COST;
    d.hired=true;d.enabled=true;d.hiredAt=state.story.elapsed||0;d.spent+=HIRE_COST;d.job=null;
    // Only the loose workbench is adopted; stock, offers and partial parcels stay intact.
    register(state.bag);updateHud();save();return true;
  }
  function setEnabled(value){const d=ensure();if(!d||!d.hired)return false;d.enabled=!!value;save();return true;}
  function release(uid){
    const d=ensure();if(!d?.job||uid!==undefined&&uid!==null&&d.job.uid!==uid)return false;
    d.job=null;save();return true;
  }
  function isClaimed(uid){const d=ensure();return !!(d?.hired&&d.enabled&&d.job?.uid===uid);}
  function busy(x){return state.selected===x.uid||drag?.uid===x.uid;}
  function blocked(){return !state.started||state.paused||state.ended||state.autoSorting||state.tutorial?.active||document.hidden;}
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
    const unknown=isUnknown(x),flight=flightFor(x,unknown);
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
    settle(d);needsRefresh=true;save();if(flight)flight();return true;
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
    }
    updateHud();
  }
  function advance(dt){
    const d=ensure();if(!d?.hired||!state.story.restored)return;
    if(blocked())return;
    if(!d.enabled){refresh();return;}
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
    if(changed)save();refresh();
  }
  function status(){
    const d=ensure();
    const base={hired:!!d?.hired,enabled:!!d?.enabled,cost:HIRE_COST,fee:BATCH_FEE,secondsPerItem:ITEM_SECONDS,sorted:d?.sorted||0,routedUnknown:d?.routedUnknown||0,completedBatches:d?.completedBatches||0,feesPaid:d?.feesPaid||0,spent:d?.spent||0,progress:0,currentUid:null};
    if(!d)return {...base,state:'inactive',label:'Помощник недоступен в старой версии'};
    if(!d.hired){
      const ready=state.story.restored&&state.totalOrders>=3&&state.gold>=HIRE_COST;
      const label=!state.story.restored?'Сначала восстановите лавку':state.totalOrders<3?'Нужно выдать 3 поручения':state.gold<HIRE_COST?'Накопите 120 монет':'Борин готов к найму';
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
  function flightFor(x,unknown){
    if(state.screen!=='work'||state.mode!=='sort'||state.inspectCat!==null||drag)return null;
    const source=document.querySelector('#pile [data-uid="'+x.uid+'"]');
    const target=unknown?document.getElementById('unknownTrayButton'):document.querySelector('#shelves [data-cat="'+items[x.type].cat+'"] .boxart');
    if(!source||!target||!source.getClientRects().length||!target.getClientRects().length)return null;
    const from=source.getBoundingClientRect(),to=target.getBoundingClientRect();
    if(!from.width||!to.width)return null;
    return ()=>{
      const ghost=document.createElement('div');ghost.className='dwarf-flight';ghost.setAttribute('aria-hidden','true');
      Object.assign(ghost.style,{position:'fixed',left:from.left+'px',top:from.top+'px',width:from.width+'px',height:from.height+'px',pointerEvents:'none',zIndex:'9000'});
      const image=document.createElement('img');image.src=asset(items[x.type].sprite);Object.assign(image.style,{width:'100%',height:'100%',objectFit:'contain',filter:unknown?'brightness(0)':'drop-shadow(0 3px 4px #0007)'});ghost.append(image);
      if(unknown){const mark=document.createElement('span');mark.textContent='?';Object.assign(mark.style,{position:'absolute',inset:'0',display:'grid',placeItems:'center',color:'white',font:'bold 30px Arial'});ghost.append(mark);}
      document.body.append(ghost);
      if(typeof ghost.animate!=='function'){ghost.remove();return;}
      const dx=to.left+to.width/2-from.left-from.width/2,dy=to.top+to.height/2-from.top-from.height/2;
      const motion=ghost.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:'translate('+dx*.55+'px,'+(dy*.55-35)+'px) scale(.8)',opacity:1,offset:.55},{transform:'translate('+dx+'px,'+dy+'px) scale(.25)',opacity:0}],{duration:380,easing:'ease-in-out'});
      motion.finished.catch(()=>{}).finally(()=>ghost.remove());
    };
  }
  return {ensure,hire,setEnabled,advance,onBagPurchased,release,isClaimed,status};
})();
