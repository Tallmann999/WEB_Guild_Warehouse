'use strict';

// A small local playtest, using the original v5 art and scenes.
const CONFIG = {days:5, daySeconds:180, workTimeRate:0.5, startingGold:80, bagPrice:10, upgradePrice:20};
// Seconds on the day clock (workbench time advances at half speed).
const INTRO_TIMING={
  1:{adventurers:[2,22,43,64,85,108,132],orders:[14,76,150]},
  2:{adventurers:[2,20,39,58,78,99,122],orders:[12,52,94]}
};
const SAVE_KEY = 'guild-warehouse-playtest-1';
const rankNames = ['Малая лавка','Надёжный поставщик','Гильдейский торговец','Купеческий дом','Известная фактория','Королевский поставщик','Легенда гильдии'];
let state = freshState();
let scale=1, drag=null, depth=100, suppressUntil=0, toastTimer, modalCleanup=null, previousFocus=null, modalLocked=false;
let audioContext=null, last=performance.now(), saveClock=0;

function freshState(){return {version:1,day:1,seconds:CONFIG.daySeconds,started:false,ended:false,screen:'reception',mode:'sort',gold:CONFIG.startingGold,rep:0,stock:[],junk:[],bag:[],offers:[],schedule:[],order:null,collection:[],upgrade:false,uid:0,selected:null,activeCat:null,inspectCat:null,targetCat:0,paused:false,autoSorting:false,muted:true,dayIncome:0,daySpent:0,daySorted:0,dayErrors:0,dayOrders:0,totalOrders:0,dayBought:0,combo:0};}
function rand(a,b){return Math.floor(a+Math.random()*(b-a+1));}
function choose(list){return list[rand(0,list.length-1)];}
function rank(){return Math.min(2,Math.floor(state.rep/12));}
function makeItem(type){return {uid:++state.uid,type,depth:++depth};}
function pool(){return [0,1,6,7,12,16,18,24,...(rank()>0?[2,3,8,9,13,14,19,20,25,26]:[]),...(rank()>1?[4,5,10,11,15,17,21,22,23,27,28,29]:[])];}
function organicTypes(){return items.filter(x=>x.organic).map(x=>x.id);}
function mysteryType(type){return type%5===4;}
function isUnknown(x){return !!x.unknown&&!state.collection.includes(x.type);}
function gainGold(amount,origin){
  state.gold+=amount;state.dayIncome+=amount;updateHud();
  const from=origin?.getBoundingClientRect?.()||{left:innerWidth/2,top:innerHeight/2,width:0,height:0};
  const target=$('gold').getBoundingClientRect();
  for(let i=0;i<Math.min(9,amount);i++){
    const coin=document.createElement('span');coin.className='reward-coin';coin.textContent='●';document.body.append(coin);
    const x=from.left+from.width/2,y=from.top+from.height/2,dx=target.left+target.width/2-x,dy=target.top+target.height/2-y;
    coin.style.left=x+'px';coin.style.top=y+'px';
    const motion=coin.animate([{transform:'translate(-50%,-50%) scale(.6)',opacity:0},{transform:`translate(${rand(-65,65)}px,${rand(-55,15)}px) scale(1)`,opacity:1,offset:.25},{transform:`translate(${dx}px,${dy}px) scale(.45)`,opacity:1}],{duration:850,delay:i*65,easing:'ease-in-out'});
    motion.finished.catch(()=>{}).finally(()=>coin.remove());
  }
}
function makeLoot(big=false){
  const count=(big?24:state.day===1?12:14)+(state.bagCapacity?2:0),organic=organicTypes(),other=pool().filter(t=>!items[t].organic);
  const slots=Array.from({length:count},(_,i)=>i);for(let i=slots.length-1;i>0;i--){const j=rand(0,i);[slots[i],slots[j]]=[slots[j],slots[i]];}const hiddenSlots=new Set(slots.slice(0,Math.round(count*.2)));
  const loot=Array.from({length:count},(_,i)=>{const source=i<Math.round(count*.6)?organic:other,secret=hiddenSlots.has(i);const candidates=source.filter(t=>secret?mysteryType(t)&&!state.collection.includes(t):!mysteryType(t)||state.collection.includes(t));const x=makeItem(choose(candidates.length?candidates:source));x.unknown=mysteryType(x.type)&&!state.collection.includes(x.type);return x;});
  for(let i=loot.length-1;i>0;i--){const j=rand(0,i);[loot[i],loot[j]]=[loot[j],loot[i]];}return loot;
}
function prepareOffer(offer){
  for(const x of offer.loot)if(x.unknown===undefined)x.unknown=mysteryType(x.type)&&!state.collection.includes(x.type);
  if(offer.qualityRolled)return;
  offer.big=!!offer.big||(state.day>=2&&Math.random()<(state.bigBagChance||0));
  if(offer.big){const target=24+(state.bagCapacity?2:0);while(offer.loot.length<target){const organicCount=offer.loot.filter(x=>items[x.type].organic).length;offer.loot.push(makeItem(choose(organicCount<Math.round(target*.6)?organicTypes():pool().filter(t=>!items[t].organic))));}}
  for(const x of offer.loot)if(x.unknown===undefined)x.unknown=mysteryType(x.type)&&!state.collection.includes(x.type);
  offer.price=offer.big?20:CONFIG.bagPrice;offer.qualityRolled=true;
}
function stockFor(cat){return state.stock.filter(x=>items[x.type].cat===cat);}
function allOrders(){state.orders??=[];if(state.order&&!state.orders.includes(state.order))state.orders.push(state.order);return state.orders;}
function visitorQueue(){
  const waiting=[...state.offers.map(value=>({kind:'bag',value})),...allOrders().filter(o=>o.accepted===false).map(value=>({kind:'order',value}))];
  state.arrivalSerial=Math.max(state.arrivalSerial||0,...waiting.map(x=>x.value.arrivalSerial||0));
  for(const x of waiting)if(!x.value.arrivalSerial)x.value.arrivalSerial=++state.arrivalSerial;
  return waiting.sort((a,b)=>a.value.arrivalSerial-b.value.arrivalSerial);
}
function counterGuest(){return visitorQueue()[0];}
function restoreOrders(){
  state.orders??=[];
  if(state.order){const saved=state.orders.find(o=>o.id&&o.id===state.order.id);if(saved)state.order=saved;else state.orders.push(state.order);}
  state.orderUid=Math.max(state.orderUid||0,...state.orders.map(o=>o.id||0));
  for(const o of state.orders)if(!o.id)o.id=++state.orderUid;
  state.order??=state.orders[0]||null;
  migrateIntroTiming();
  migrateLoot();
  if(!state.sortingBatches){state.sortingBatches=[];trackSortingBag(state.bag);}
  if(state.queueVersion!==1){
    if(INTRO_TIMING[state.day])state.orderSchedule=INTRO_TIMING[state.day].orders.slice(state.dayOrdersCreated||0);
    state.queueVersion=1;visitorQueue();
  }
}
function migrateLoot(){
  if(state.lootVersion===1)return;
  for(const [i,offer] of state.schedule.entries()){
    offer.big=!!offer.big||(state.day===2&&(state.dayBought||0)+state.offers.length+i===2);
    offer.loot=makeLoot(offer.big);delete offer.qualityRolled;
  }
  if(state.day===1&&state.orderSchedule?.length)state.orderSchedule=INTRO_TIMING[1].orders.slice(Math.min(3,state.dayOrdersCreated||0));
  state.lootVersion=1;guaranteeOrder();
}
function migrateIntroTiming(){
  const timing=INTRO_TIMING[state.day];if(!timing||state.timingVersion===2)return;
  const served=state.dayBought||0,arrived=state.offers.length;
  const left=Math.max(0,timing.adventurers.length-served-arrived),types=pool();
  state.schedule=Array.from({length:left},(_,i)=>{
    const position=served+arrived+i,existing=state.schedule[i];
    return {...(existing||{visitor:(state.day+position-1)%adventurers.length,loot:Array.from({length:state.day===1?12:14},()=>makeItem(choose(types)))}),at:timing.adventurers[position]};
  });
  state.dayOrdersCreated=(state.dayOrders||0)+allOrders().filter(o=>o.createdDay===state.day).length;
  state.orderSchedule=timing.orders.slice(Math.min(timing.orders.length,state.dayOrdersCreated));state.timingVersion=2;state.arrivalIdle=0;
  guaranteeOrder();
}
function owned(){return [...state.stock,...state.junk,...state.bag,...allOrders().flatMap(o=>o.packed)];}
function countType(type){return owned().filter(x=>x.type===type).length;}
function remaining(r){return r.count-(state.order?.packed.filter(x=>x.type===r.type).length||0);}
function orderComplete(){return !!state.order&&state.order.recipe.every(r=>remaining(r)===0);}
function orderAccepted(){return !!state.order&&state.order.accepted!==false;}
function save(){if(!state.started)return;try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));}catch{}}
function resize(){scale=Math.min(innerWidth/1280,innerHeight/800);$('game').style.transform=`translate(-50%,-50%) scale(${scale})`;}
function beep(bad=false){if(state.muted)return;try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();audioContext.resume();const o=audioContext.createOscillator(),g=audioContext.createGain();o.connect(g);g.connect(audioContext.destination);o.frequency.value=bad?150:560;g.gain.setValueAtTime(.035,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.12);o.start();o.stop(audioContext.currentTime+.13);}catch{}}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2500);}
function showOrderReward(amount,promoted){
  $('orderReward')?.remove();
  const panel=document.createElement('div');panel.id='orderReward';panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');
  panel.innerHTML=`<span>Заказ выполнен</span><strong>Золото получено: +${amount}</strong><strong>Репутация повышена: +4</strong>${promoted?`<b>Новый ранг: ${rankNames[rank()]}</b>`:''}`;
  $('effects').append(panel);setTimeout(()=>panel.remove(),2000);
}
function hidden(id,value){$(id).classList.toggle('hidden',value);}
function positionItemTooltip(e){
  const tip=$('tooltip');if(tip.classList.contains('hidden'))return;
  const rect=$('game').getBoundingClientRect();
  tip.style.left=Math.max(8,Math.min(1280-tip.offsetWidth-10,(e.clientX-rect.left)/scale+16))+'px';
  tip.style.top=Math.max(8,Math.min(800-tip.offsetHeight-10,(e.clientY-rect.top)/scale+18))+'px';
}
function button(parent,label,action,id,disabled=false){const b=document.createElement('button');b.textContent=label;if(id)b.id=id;b.disabled=disabled;b.onclick=action;parent.append(b);return b;}
function lockBackground(value){for(const child of $('game').children)if(!['modal','effects','toast','tooltip'].includes(child.id))child.inert=value;}
function modal(html,{locked=false,wide=false,brief=false}={}){
  if(state.autoSorting)return false;
  modalCleanup?.();modalCleanup=null;cancelDrag();previousFocus=document.activeElement;
  state.paused=true;modalLocked=locked;$('modalContent').innerHTML=html;
  $('modal').className='modal'+(brief?' order-brief':'');$('modal').setAttribute('role','dialog');$('modal').setAttribute('aria-modal','true');
  $('modal').querySelector('.modal-card').classList.toggle('wide',wide);hidden('closeModal',locked);lockBackground(true);
  const focus=$('modal').querySelector('button:not(.hidden):not(:disabled)');focus?.focus();updateHud();return true;
}
function closeModal(){if(modalLocked)return;modalCleanup?.();modalCleanup=null;hidden('modal',true);lockBackground(false);state.paused=false;last=performance.now();previousFocus?.isConnected&&previousFocus.focus();updateHud();save();}
function forceCloseModal(){modalLocked=false;closeModal();}
function updateHud(){
  const minutes=Math.floor((1-state.seconds/CONFIG.daySeconds)*720)+480;
  $('dayLabel').textContent=`День ${state.day} / 5`;
  $('clock').textContent=`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')} · ${state.paused?'пауза':state.seconds===0?'вечер':minutes<720?'утро':minutes<1020?'день':'вечер'}`;
  $('sunbar').style.width=state.seconds/CONFIG.daySeconds*100+'%';$('gold').textContent=state.gold;
  $('rep').textContent=`${rank()+1}/7 · ${state.rep} реп.`;$('orderBadge').textContent=allOrders().filter(o=>o.accepted!==false).length;
  $('sound').textContent=state.muted?'♫̸':'♫';$('sound').setAttribute('aria-label',state.muted?'Включить звук':'Выключить звук');
  const pendingOrders=allOrders().filter(o=>o.accepted===false);
  const signal=$('arrivalSignal'),waiting=state.offers.length+pendingOrders.length;
  const head=counterGuest();const visitor=head?(head.kind==='bag'?adventurers[head.value.visitor]:customers[head.value.customer]):null;
  const arrivalKey=waiting?`${waiting}:${visitor[0]}`:'';
  if(signal.dataset.arrival!==arrivalKey){
    signal.dataset.arrival=arrivalKey;
    signal.innerHTML=waiting?`<span class="arrival-mark" aria-hidden="true">!</span><span class="arrival-copy"><strong>Гость у стойки!</strong><span>${visitor[0]} · ${visitor[1]}</span><small>Ждут: ${waiting} · Перейти к стойке →</small></span>`:'';
  }
  signal.classList.toggle('waiting',!!waiting);hidden('arrivalSignal',!waiting);
  if($('goldAdButton')&&$('receptionGoldAd'))updateGoldAd();
}
function setScreen(screen,mode=state.mode){if(screen==='work'&&mode==='order'&&!orderAccepted()){openOrder();return;}cancelDrag();state.screen=screen;state.mode=mode;state.activeCat=null;state.inspectCat=null;state.selected=null;hidden('inspector',true);hidden('targetPreview',true);hidden('tooltip',true);render();save();}
function render(){
  const starting=!state.started;
  $('game').classList.toggle('starting',starting);hidden('startScreen',!starting);
  hidden('loadGame',!starting||!hasSave());
  hidden('reception',starting||state.screen!=='reception');hidden('work',starting||state.screen!=='work');
  updateHud();if(!starting)state.screen==='reception'?renderReception():renderWork();
}
function updateGoldAd(){
  const head=counterGuest();
  if(head?.kind==='bag'&&state.gold<(head.value.price||(head.value.big?20:CONFIG.bagPrice)))state.goldAdUnlocked=true;
  hidden('goldAdButton',!state.goldAdUnlocked||state.mode!=='sort');
  hidden('receptionGoldAd',!state.goldAdUnlocked);
}
function renderReception(){
  updateGoldAd();
  renderOrderBoard();
  const head=counterGuest(),pending=head?.kind==='order'?head.value:null;
  const action=$('receptionAction');action.innerHTML='';hidden('speech',false);hidden('bag',true);hidden('parcel',true);hidden('visitor',false);
  if(!state.started)return;
  // Leave the counter empty until the first visitor's scheduled arrival.
  if(state.day===1&&!state.dayBought&&!state.offers.length&&state.schedule[0]?.at===2){
    hidden('speech',true);hidden('visitor',true);$('stepHint').textContent='';return;
  }
  {
    const offer=head?.kind==='bag'?head.value:null;
    if(offer){
      prepareOffer(offer);const price=offer.price;const v=adventurers[offer.visitor];$('visitor').src=asset(v[2]);hidden('bag',false);$('bag').querySelector('img').src=asset(offer.big?'storage/bag-premium':'storage/bag');$('bag').classList.toggle('premium',!!offer.big);
      $('speech').innerHTML=`<span class="eyebrow">${v[1]}</span><h2>${v[0]}</h2><p>Добыча из похода. ${offer.big?'Большой мешок':'Мешок'} за <b>${price} монет</b> — внутри кое-что интересное!</p>`;
      button(action,`Купить ${offer.big?'большой мешок':'мешок'} · ${price} монет`,buyBag,'buyBag',state.gold<price).className='primary';
      if(state.bag.length)button(action,'Продолжить разбор на столе',()=>setScreen('work','sort'),'resumeBag');
      $('notice').innerHTML=`<b>Ждут у стойки: ${state.offers.length}</b><br>Новый мешок добавится к находкам на столе.<br>На столе: ${state.bag.length} предметов.`;
    }else if(pending){
      const c=customers[pending.customer];$('visitor').src=asset(c[2]);hidden('parcel',false);
      $('speech').innerHTML=`<span class="eyebrow">${c[1]}</span><h2>${c[0]}</h2><p>${pending.description||'У меня есть поручение. Посмотрите список и примите его у стойки.'}</p>`;
      $('notice').textContent='';
    }else{
      hidden('visitor',true);$('speech').innerHTML=`<span class="eyebrow">${state.seconds?'ТИХАЯ МИНУТА':'ЛАВКА ЗАКРЫВАЕТСЯ'}</span><h2>${state.seconds?'Всё на своих местах':'Хороший день'}</h2><p>Можно разобрать запасы, очистить находку или посмотреть коллекцию.</p>`;
      $('notice').innerHTML=`<b>На складе: ${state.stock.length+state.junk.length} вещей</b><br>Куплено мешков: ${state.dayBought} · выдано заказов: ${state.dayOrders}`;
    }
    if(pending)button(action,'Принять поручение',()=>openOrder(pending),'receptionOrder').className='primary';
    if(!state.bag.length||!offer)button(action,'К столу и коробкам',()=>setScreen('work','sort'),'goWork');
    if(!state.schedule.length&&!state.offers.length&&!state.orderSchedule?.length)button(action,'Закончить день',requestEndDay,'closeDay',!!state.bag.length);
  }
  $('stepHint').textContent='';
}
function planDay(firstArrival=0){
  state.dayCollectionStart=state.collection.length;
  state.seconds=CONFIG.daySeconds;state.dayIncome=state.daySpent=state.daySorted=state.dayErrors=state.dayOrders=state.dayBought=0;
  state.schedule=[];state.offers=[];
  const timing=INTRO_TIMING[state.day],n=timing?timing.adventurers.length:rand(3,4),types=pool();
  state.orderSchedule=timing?[...timing.orders]:[];
  state.dayOrdersCreated=0;state.timingVersion=2;state.lootVersion=1;state.queueVersion=1;state.arrivalIdle=0;
  for(let i=0;i<n;i++){const big=state.day===2&&i===2;state.schedule.push({at:timing?timing.adventurers[i]:i===0?firstArrival:Math.round(i*140/(n-1)),visitor:(state.day+i-1)%adventurers.length,big,loot:makeLoot(big)});}
  guaranteeOrder();tickArrivals();
}
function startGame(){state=freshState();state.started=true;last=performance.now();planDay();startTutorial();if(!state.offers.length&&state.schedule.length){state.schedule[0].at=0;tickArrivals();}render();save();}
function openSettings(){
  if(!state.started||state.autoSorting)return;
  modal('<h2>Настройки</h2><p>Сброс вернёт игру к первому дню: монеты, предметы и поручения начнутся заново. Обучение пройдёт повторно.</p><div class="modal-actions"><button id="resetLevel" class="primary">Сбросить уровень и пройти обучение</button><button id="resumeSettings">Продолжить игру</button></div>');
  $('resumeSettings').onclick=closeModal;
  $('resetLevel').onclick=()=>{try{localStorage.removeItem(TUTORIAL_KEY);}catch{}forceCloseModal();clearTimeout(toastTimer);$('toast').classList.remove('show');$('effects').replaceChildren();document.querySelectorAll('.reward-coin').forEach(coin=>coin.remove());startGame();};
}
function tickArrivals(){
  let changed=false;
  const now=CONFIG.daySeconds-state.seconds;let orderDeferred=false;
  while(true){
    const bagAt=state.schedule[0]?.at??Infinity,orderAt=orderDeferred?Infinity:state.orderSchedule?.[0]??Infinity;
    if(Math.min(bagAt,orderAt)>now)break;
    if(bagAt<=orderAt){const offer=state.schedule.shift();prepareOffer(offer);offer.arrivalSerial=state.arrivalSerial=(state.arrivalSerial||0)+1;state.offers.push(offer);changed=true;}
    else if(createOrder(true)){state.orderSchedule.shift();changed=true;}
    else orderDeferred=true;
  }
  if(changed){if(state.screen==='work')updateHud();else renderReception();save();}
}
function waitAtWindow(){if(state.paused)return;const next=state.schedule[0];if(next){state.seconds=Math.max(0,CONFIG.daySeconds-next.at);tickArrivals();render();}}
function buyBag(){
  if(state.paused||!state.offers.length||counterGuest()?.kind!=='bag')return;
  prepareOffer(state.offers[0]);if(state.gold<state.offers[0].price)return;
  const offer=state.offers.shift();state.gold-=offer.price;state.daySpent+=offer.price;state.dayBought++;
  state.bag.push(...offer.loot);state.combo=0;trackSortingBag(offer.loot);
  for(const [i,x] of offer.loot.entries())x.tablePos=offer.tutorial?{x:.12+i*.22,y:.35}:{x:Math.random()*.88,y:Math.random()*.74};
  if(!INTRO_TIMING[state.day]&&!allOrders().some(o=>o.accepted===false)&&(!allOrders().length||state.offers.length||state.schedule.length))createOrder();setScreen('work','sort');beep();
}
function advanceReadyVisitor(dt){
  if(!INTRO_TIMING[state.day]||!state.dayBought||(state.bag.length&&state.screen!=='reception')||state.offers.length||allOrders().some(o=>o.accepted===false)){
    state.arrivalIdle=0;return;
  }
  const nextBag=state.schedule[0]?.at??Infinity,nextOrder=state.orderSchedule?.[0]??Infinity;
  if(!Number.isFinite(Math.min(nextBag,nextOrder))){state.arrivalIdle=0;return;}
  state.arrivalIdle=(state.arrivalIdle||0)+dt;
  if(state.arrivalIdle<3)return;
  state.arrivalIdle=0;
  // Bring only the next guest forward. Never skip the player's remaining day time.
  const now=CONFIG.daySeconds-state.seconds;
  if(nextOrder<=nextBag)state.orderSchedule[0]=Math.min(nextOrder,now);
  else state.schedule[0].at=Math.min(nextBag,now);
  tickArrivals();
}
function createOrder(keepSelection=false){
  if(INTRO_TIMING[state.day]&&(state.dayOrdersCreated||0)>=INTRO_TIMING[state.day].orders.length)return;
  const active=state.order;
  const types=[...new Set([...owned(),...[...state.offers,...state.schedule].flatMap(s=>s.loot)].map(x=>x.type))];if(!types.length)return;
  for(let i=types.length-1;i>0;i--){const j=rand(0,i);[types[i],types[j]]=[types[j],types[i]];}
  let recipe=types.slice(0,3).map(type=>({type,count:Math.max(1,Math.min(2,countType(type)))}));
  // Include one coming find while there are supplies still to arrive.
  const future=[...state.offers,...state.schedule];
  if(state.day!==1&&future.length){const candidates=pool().filter(t=>!recipe.some(r=>r.type===t));const missing=candidates.filter(t=>countType(t)===0);const type=choose(missing.length?missing:candidates);if(type!==undefined)recipe[recipe.length-1]={type,count:Math.min(4,countType(type)+1)};}
  const chef=state.day===1&&(state.dayOrdersCreated||0)===2;
  if(state.day===1){
    const reserved=new Map();for(const o of allOrders())for(const r of o.recipe)reserved.set(r.type,(reserved.get(r.type)||0)+r.count);
    const available=items.filter(x=>!chef||x.food).map(x=>({type:x.id,count:owned().filter(y=>y.type===x.id&&!isUnknown(y)).length-(reserved.get(x.id)||0)})).filter(x=>x.count>0).sort((a,b)=>Number(items[b.type].organic)-Number(items[a.type].organic)||b.count-a.count);
    recipe=available.slice(0,3).map(x=>({type:x.type,count:Math.min(2,x.count)}));
    if(!recipe.length)return false;
  }
  const reward=(chef?35:20+rank()*4)+(state.orderBonus?5:0);
  state.order={recipe,packed:[],accepted:false,customer:chef?4:0,reward,originalReward:reward,createdDay:state.day,carried:false,title:chef?'Меню для короля':'Припасы для алхимика',description:chef?'Готовлю королевский ужин. Нужны лучшие продукты из сегодняшних поставок.':''};
  state.order.arrivalSerial=state.arrivalSerial=(state.arrivalSerial||0)+1;
  state.order.id=state.orderUid=(state.orderUid||0)+1;state.dayOrdersCreated=(state.dayOrdersCreated||0)+1;allOrders();guaranteeOrder();
  if(keepSelection&&active)state.order=active;
  return true;
}
function guaranteeOrder(){
  const supplies=[...state.offers,...state.schedule];if(!supplies.length)return;
  const demand=new Map();for(const o of allOrders())for(const r of o.recipe)demand.set(r.type,(demand.get(r.type)||0)+r.count);
  for(const [type,count] of demand){let missing=count-countType(type)-supplies.reduce((n,s)=>n+s.loot.filter(x=>x.type===type).length,0);while(missing-->0)supplies[0].loot.push(makeItem(type));}
}
function renderWork(){
  updateGoldAd();
  const sort=state.mode==='sort';$('work').classList.toggle('sorting',sort);$('work').classList.toggle('fulfillment',!sort);$('work').classList.toggle('has-note',sort&&orderAccepted());
  $('workMode').textContent=sort?'ВАША ЛАВКА · СОРТИРОВКА':'ЗАКАЗ · СБОРКА ПОСЫЛКИ';$('workTitle').textContent=sort?'У каждой находки — своё место':'Найдите вещи в своём складе';
  $('workProgress').textContent=sort?`${state.bag.length} на столе`:`${state.order?.packed.length||0} в посылке`;
  $('pileCaption').textContent=sort?'':'ПОСЫЛКА И ВАШИ ЗАПАСЫ';$('combo').textContent=state.combo>=3?`${state.combo} подряд`:'';
  $('workHint').textContent=sort?'Перетащите в коробку · или выберите вещь, затем коробку':'Нажмите нужную вещь или перетащите в коробку слева';
  $('stepHint').textContent=sort?'Коробка → осмотр. В коллекции можно очистить находки.':'Список остаётся с вами, пока не соберёте всё необходимое.';
  renderShelves();$('pile').innerHTML='';if(sort)renderItems($('pile'),state.bag,'table');
  $('boxZone').innerHTML='';$('sourceBox').innerHTML='';hidden('sourceBox',true);
  if(!sort){
    $('boxZone').innerHTML='<div id="parcelDrop" aria-label="Открытая коробка для заказа"><span class="box-title">Поручение</span><button id="tidyParcel" class="tidy-box">Сортировать</button><button id="closeParcel" class="red-close" aria-label="Закрыть посылку">×</button><div id="packedScroll"><div id="packedItems"></div></div></div>';
    renderItems($('packedItems'),state.order?.packed||[],'packed');
    $('tidyParcel').onclick=()=>arrangeBox($('packedItems'),state.order.packed,'packed');$('closeParcel').onclick=()=>setScreen('work','sort');
    hidden('sourceBox',false);
    if(state.activeCat===null){$('sourceBox').className='source-placeholder';$('sourceBox').textContent='Откройте нужную коробку на полке';}
    else{$('sourceBox').className='source-open';$('sourceBox').innerHTML=`<div class="source-heading"><div><b>${categories[state.activeCat].name}</b></div><button id="tidySource" class="tidy-box">Сортировать ящик</button><button id="closeSource" class="red-close" aria-label="Закрыть коробку">×</button></div><div id="sourceScroll"><div id="sourceItems"></div></div>`;$('closeSource').onclick=()=>{state.activeCat=null;renderWork();};$('tidySource').onclick=()=>arrangeBox($('sourceItems'),stockFor(state.activeCat),'source');renderItems($('sourceItems'),stockFor(state.activeCat),'source');}
  }
  renderChecklist();hidden('autoSortButton',!sort);$('autoSortButton').disabled=!state.bag.length||state.autoSorting;
  hidden('sweepButton',!sort||!state.upgrade);$('sweepButton').disabled=!state.bag.length;
  hidden('sortingDone',true);updateHud();
}
function renderShelves(){
  $('shelves').innerHTML='';
  const upper=document.createElement('div'),lower=document.createElement('div');
  upper.className='shelf-row upper-shelf';lower.className='shelf-row lower-shelf';$('shelves').append(upper,lower);
  categories.forEach((cat,i)=>{
    const b=button(i===4?upper:lower,'',()=>selectBox(i));b.className='shelf-box';b.dataset.cat=i;b.setAttribute('aria-label',`${cat.name}: ${stockFor(i).length}`);
    const box=['crate','basket','barrel','weapons','crate'][i];
    b.innerHTML=`<img class="boxart" src="${asset('storage/'+box)}" alt=""><span class="tag">${cat.name} <span class="shelf-count">${stockFor(i).length}</span></span>`;
  });
  const junk=button(lower,'',()=>state.upgrade?openInspection('junk'):openUpgrade());junk.className='shelf-box'+(state.upgrade?'':' locked');junk.id='junkShelf';junk.innerHTML=`<img class="boxart" src="${asset('storage/chest')}" alt=""><span class="tag">Диковинки <span class="shelf-count">${state.upgrade?state.junk.length:'🔒'}</span></span>`;
  const rare=button(lower,'',openRanks);rare.className='shelf-box locked';rare.innerHTML=`<img class="boxart" src="${asset('storage/cage')}" alt=""><span class="tag">Будущее гильдии 🔒</span>`;
  for(let i=0;i<5;i++){const ghost=document.createElement('div');ghost.className='shelf-box shelf-placeholder';ghost.setAttribute('aria-hidden','true');ghost.innerHTML=`<img class="boxart" src="${asset('storage/crate')}" alt="">`;upper.append(ghost);}
}
function selectBox(cat){
  if(state.paused||state.autoSorting)return;
  if(state.inspectCat==='junk'){state.targetCat=cat;renderTarget();return;}
  if(state.selected!==null){sortItem(state.selected,cat);return;}
  if(state.mode==='order'){state.activeCat=cat;renderWork();}else openInspection(cat);
}
function renderChecklist(){
  const el=$('checklist');hidden('checklist',!orderAccepted());el.innerHTML='';if(!orderAccepted())return;
  const o=state.order;el.innerHTML=`<h3>${state.mode==='sort'?'Заказ на сегодня':'Положить в коробку'}</h3>`+o.recipe.map(r=>`<div class="check-row ${remaining(r)===0?'done':''}"><span class="checkmark">${remaining(r)===0?'✓':'○'}</span><img src="${asset(items[r.type].sprite)}" alt=""><span class="check-name">${items[r.type].name}</span><b>${r.count-remaining(r)}/${r.count}</b></div>`).join('')+`<div class="dispatch-status">${o.reward} монет${o.carried?' · перенесён':''}</div><div class="note-actions"></div>`;
  const actions=el.querySelector('.note-actions');
  if(state.mode==='sort')button(actions,'Собрать поручение',()=>setScreen('work','order'),'assembleNote').className='primary';
  else if(orderComplete())button(actions,state.activeCat===null?'Выдать посылку':'Сначала закройте коробку',finishOrder,'ship',state.activeCat!==null).className='primary';
  else button(actions,'Вернуться к сортировке',()=>setScreen('work','sort'),'backSort');
}
function itemPositionKey(kind){return kind==='table'?'tablePos':kind==='packed'?'parcelPos':'boxPos';}
function arrangeBox(area,list,kind){
  if(state.paused||state.autoSorting)return;
  const width=area.clientWidth,size=60,columns=Math.max(1,Math.floor((width-20)/68)),key=itemPositionKey(kind);
  const ordered=[...list].sort((a,b)=>(isUnknown(a)?'Неизвестная находка':items[a.type].name).localeCompare(isUnknown(b)?'Неизвестная находка':items[b.type].name,'ru')||a.uid-b.uid);
  ordered.forEach((x,i)=>{x[key]={x:(i%columns)*68/Math.max(1,width-size-20),y:8+Math.floor(i/columns)*68};x.boxAngle=0;});
  area.innerHTML='';renderItems(area,list,kind);area.parentElement.scrollTop=0;save();
}
function renderItems(area,list,kind){
  hidden('tooltip',true);
  area.classList.toggle('crowded-pile',kind==='table'&&list.length>20);
  if(!list.length){area.style.height='100%';area.innerHTML='<div class="empty-pile">Здесь пока пусто</div>';return;}
  const table=kind==='table',size=table?79:60,width=area.clientWidth||450,columns=Math.max(1,Math.floor((width-20)/68));
  const key=itemPositionKey(kind);
  list.forEach((x,i)=>{
    if(!table&&!x[key])x[key]={x:(i%columns)*68/Math.max(1,width-size-20),y:8+Math.floor(i/columns)*68};
    const pos=table?(x.tablePos||{x:Math.random()*.8,y:Math.random()*.7}):x[key];
    if(!table){pos.x=Math.max(0,Math.min(1,pos.x));pos.y=Math.max(8,pos.y);}
    if(table)x.tablePos=pos;
    const b=button(area,'',e=>clickItem(x,kind,e));b.className='item'+(state.selected===x.uid?' chosen':'');b.dataset.uid=x.uid;b.dataset.kind=kind;
    const unknown=isUnknown(x);b.classList.toggle('mystery-item',unknown);
    b.setAttribute('aria-label',unknown?'Неизвестная находка':items[x.type].name);
    b.innerHTML=`<img src="${asset(items[x.type].sprite)}" alt="${unknown?'Неизвестная находка':items[x.type].name}" draggable="false">${unknown?'<span class="mystery-question">?</span>':''}`;
    b.style.left=(10+pos.x*Math.max(1,width-size-20))+'px';b.style.top=(table?10+pos.y*Math.max(1,area.clientHeight-size-20):pos.y)+'px';
    b.style.transform=`rotate(${!table&&x.boxAngle!==undefined?x.boxAngle:x.uid%21-10}deg)`;b.style.zIndex=x.depth||i+1;
    b.onpointerdown=e=>pointerDown(e,x,b,kind);
  });
  if(!table)area.style.height=Math.max(area.parentElement.clientHeight,...list.map(x=>x[key].y+size+12))+'px';
}
function clickItem(x,kind,e){
  if(performance.now()<suppressUntil||state.paused||state.autoSorting)return;
  if(state.inspectCat!==null&&!['inspect','junk','target'].includes(kind))return;
  const node=e?.currentTarget||document.querySelector(`.item[data-uid="${x.uid}"][data-kind="${kind}"]`);if(!node)return;
  const r=node.getBoundingClientRect();cancelDrag();state.selected=x.uid;
  drag={uid:x.uid,item:x,node,kind,x:r.left+r.width/2,y:r.top+r.height/2,grabX:r.width/scale/2,grabY:r.height/scale/2,active:false,clickHeld:true};
  liftItem();moveHeld(e?.clientX||drag.x,e?.clientY||drag.y);
  if(isUnknown(x)){const inspect=button($('effects'),'Распознать предмет в руках',()=>openUnknown(x),'heldRecognize');inspect.className='primary';}
}
function trackSortingBag(loot){
  state.sortingBatches??=[];
  if(loot.length)state.sortingBatches.push({pending:loot.map(x=>x.uid)});
}
function rewardSortedItem(uid){
  const batches=state.sortingBatches||[];
  const batch=batches.find(b=>b.pending.includes(uid));if(!batch)return;
  batch.pending=batch.pending.filter(id=>id!==uid);if(batch.pending.length)return;
  state.sortingBatches=batches.filter(b=>b!==batch);
  $('sortingReward')?.remove();
  const panel=document.createElement('div');panel.id='sortingReward';panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');
  panel.innerHTML='<strong>Поздравляем, вы правильно отсортировали!</strong><b>+10 монет</b>';
  $('effects').append(panel);gainGold(10,panel.querySelector('b'));setTimeout(()=>panel.remove(),1500);updateHud();
}
function wrong(message,el){state.dayErrors++;state.combo=0;toast(message);beep(true);el?.classList.add('shake');setTimeout(()=>el?.classList.remove('shake'),280);save();}
function sortItem(uid,cat){
  if(state.paused||state.autoSorting)return;
  const list=state.inspectCat==='junk'?state.junk:state.bag;const i=list.findIndex(x=>x.uid===uid);if(i<0)return;
  if(isUnknown(list[i])){openUnknown(list[i]);return;}
  const x=list[i],it=items[x.type];if(it.cat!==cat){wrong(`«${it.name}» — ${categories[it.cat].name.toLowerCase()}. Попробуйте другую коробку.`,document.querySelector(`[data-cat="${cat}"]`));return;}
  list.splice(i,1);x.boxPos={x:Math.random()*.8,y:Math.floor(stockFor(cat).length/5)*76};state.stock.push(x);state.daySorted++;state.combo++;state.selected=null;beep();
  rewardSortedItem(x.uid);
  if(state.inspectCat==='junk'){renderInspection();renderShelves();renderTarget();}else renderWork();save();
}
function packItem(uid){
  if(state.paused||!orderAccepted())return;const i=state.stock.findIndex(x=>x.uid===uid);if(i<0)return;const x=state.stock[i];
  if(isUnknown(x)){openUnknown(x);return;}
  const line=state.order.recipe.find(r=>r.type===x.type&&remaining(r)>0);if(!line){wrong('Эта вещь сейчас не нужна. Она остаётся в коробке.',$('parcelDrop'));return;}
  state.stock.splice(i,1);state.order.packed.push(x);const scroll=$('sourceScroll')?.scrollTop||0;renderWork();if($('sourceScroll'))$('sourceScroll').scrollTop=scroll;beep();save();
}
function renderOrderBoard(){
  const board=$('orderBoard');if(!board)return;
  const list=allOrders().filter(o=>o.accepted!==false);board.innerHTML='<h3>Поручения <span>'+list.length+'</span></h3>';
  hidden('orderBoard',!list.length);
  for(const o of list){
    const total=o.recipe.reduce((n,r)=>n+r.count,0),card=button(board,'',()=>openOrder(o));card.className='order-card';card.dataset.orderId=o.id;
    card.innerHTML=`<strong>${customers[o.customer][0]}</strong><span>${o.recipe.map(r=>`<img src="${asset(items[r.type].sprite)}" alt="${items[r.type].name}">`).join('')}</span><small>Собрано ${o.packed.length}/${total} · ${o.reward} монет</small>`;
  }
}
function showOrders(){
  if(!state.started||state.paused||state.autoSorting)return;
  const list=allOrders().filter(o=>o.accepted!==false);
  modal('<h2>Мои поручения · '+list.length+'</h2><div class="accepted-order-list">'+(list.length?list.map(o=>`<button data-accepted-order="${o.id}"><strong>${o.title||'Поручение'} · №${o.id}</strong><span>${customers[o.customer][0]} · ${o.packed.length}/${o.recipe.reduce((n,r)=>n+r.count,0)} предметов · ${o.reward} монет</span></button>`).join(''):'<p>Примите поручение у посетителя, когда подойдёт его очередь.</p>')+'</div>');
  for(const b of document.querySelectorAll('[data-accepted-order]'))b.onclick=()=>{const o=list.find(o=>o.id===Number(b.dataset.acceptedOrder));closeModal();openOrder(o);};
}
function openOrder(candidate){if(!state.started||state.paused||state.autoSorting)return;
  const head=counterGuest();
  const o=candidate?.recipe?candidate:(head?.kind==='order'?head.value:allOrders().find(o=>o.accepted!==false));
  if(!o){toast('Новый заказ появится после покупки следующего мешка.');return;}
  if(o.accepted===false&&(head?.kind!=='order'||head.value!==o)){toast('Этот посетитель ждёт своей очереди.');return;}
  setScreen('reception','sort');
  const c=customers[o.customer],accepted=o.accepted!==false;
  modal(`<div class="brief-eyebrow">ПОРУЧЕНИЕ</div><h2>${c[0]}</h2><p>${c[1]}</p>${o.title?`<h3>${o.title}</h3>`:""}${o.description?`<p>${o.description}</p>`:""}<div class="brief-list">${o.recipe.map(r=>{const packed=o.packed.filter(x=>x.type===r.type).length;return `<div><img src="${asset(items[r.type].sprite)}" alt="${items[r.type].name}"><span>${items[r.type].name}<small>На складе: ${state.stock.filter(x=>x.type===r.type).length}</small></span><b>${packed}/${r.count}</b></div>`;}).join('')}</div><p>Оплата: <b>${o.reward} монет</b></p><button id="${accepted?'beginAssembly':'acceptOrder'}" class="primary">${accepted?'Начать собирать':'Принять поручение'}</button>`,{brief:true});
  if(accepted)$('beginAssembly').onclick=()=>{state.order=o;closeModal();setScreen('work','order');};
  else $('acceptOrder').onclick=()=>{if(counterGuest()?.value!==o)return;o.accepted=true;state.order=o;closeModal();render();save();$('orderBoard').querySelector('button')?.focus();};
}
function finishOrder(){
  if(state.paused||!orderAccepted()||!orderComplete()||state.activeCat!==null)return;
  const amount=state.order.reward,oldRank=rank();state.rep+=4;state.totalOrders++;state.dayOrders++;
  state.orders=allOrders().filter(o=>o!==state.order);state.order=state.orders[0]||null;
  setScreen('reception');beep();save();
  showOrderReward(amount,rank()>oldRank);
  gainGold(amount,$('orderReward').querySelector('strong'));save();
}
function requestEndDay(){
  if(state.ended){showSummary();return;}
  if(state.paused||state.bag.length||state.schedule.length||state.offers.length||state.orderSchedule?.length)return;
  const line=state.order?'Незавершённый заказ можно оставить до завтра. Условия переноса выберите ниже.':'Все заказы выданы. Можно отдохнуть.';
  modal(`<h2>Лавка закрывается</h2><p>${line}</p><div class="modal-actions">${state.order?'<button id="finishLater">Вернуться к заказу</button><button id="carryBase">Перенести · 80% оплаты</button><button id="carryBonus">Перенести · без бонуса</button>':'<button id="finishDay" class="primary">Подвести итоги дня</button>'}</div>${state.order?'<p class="rule-note">Для теста: выберите правило переноса.<br>80% оплаты: 20 → 16. Без бонуса: база 20 остаётся 20.<br>Повторный перенос не уменьшает сумму снова.</p>':''}`);
  if(state.order){$('finishLater').onclick=closeModal;$('carryBase').onclick=()=>endDay('discount');$('carryBonus').onclick=()=>endDay('base');}
  else $('finishDay').onclick=()=>endDay('none');
}
function endDay(carryMode){
  if(!state.started||state.ended||state.bag.length)return;
  for(const o of allOrders())if(!o.carried){if(carryMode==='discount')o.reward=Math.floor(o.originalReward*.8);o.carried=true;}
  forceCloseModal();state.seconds=0;state.ended=true;state.screen='reception';render();showSummary();save();
}
function showSummary(){
  const final=state.day===CONFIG.days;
  modal(`<div class="brief-eyebrow">☾ НОЧЬ В ГИЛЬДИИ</div><h2>${final?'Пять дней в вашей лавке':`День ${state.day} завершён`}</h2><p>${final?'Спасибо за игру. Как ощущались сортировка, заказы и новые находки?':'Окно закрыто, находки на полках. Завтра начнётся новая история.'}</p><div class="summary-grid"><div>Выручка<b>${state.dayIncome}</b>монет за день</div><div>Закупки и улучшения<b>${state.daySpent}</b>монет за день</div><div>Заказов за день<b>${state.dayOrders}</b>всего ${state.totalOrders}</div><div>Атлас находок<b>${state.collection.length} / ${items.length}</b>${rankNames[rank()]}</div></div><p>В казне ${state.gold} · на складе ${state.stock.length+state.junk.length} вещей${state.order?'<br>Заказ сохранён: '+state.order.reward+' монет':''}</p><button id="nextDay" class="primary">${final?'Сыграть заново':`Открыть лавку · день ${state.day+1}`}</button>${final?'<button id="reviewStock">Посмотреть свой склад</button>':''}`,{locked:true});
  $('nextDay').onclick=()=>{forceCloseModal();if(final){startGame();return;}state.ended=false;state.day++;state.mode='sort';state.screen='reception';state.activeCat=null;state.inspectCat=null;planDay();render();save();};
  document.querySelectorAll('.summary-grid>div').forEach((card,i)=>{if(i<3||state.collection.length>(state.dayCollectionStart||0))card.classList.add('summary-highlight');});
  if(final)$('reviewStock').onclick=()=>{forceCloseModal();setScreen('work','sort');toast('Пять дней завершены. Можно рассмотреть запасы и коллекцию.');};
}
function openInspection(cat){if(state.paused||state.autoSorting||!state.started)return;state.inspectCat=cat;state.selected=null;hidden('inspector',false);$('inspector').classList.toggle('junk-open',cat==='junk');renderInspection();renderTarget();$('closeInspector').focus();}
function renderInspection(){const cat=state.inspectCat;if(cat===null)return;const list=cat==='junk'?state.junk:stockFor(cat);$('inspectTitle').textContent=`${cat==='junk'?'Диковинки':categories[cat].name}`;$('inspectItems').innerHTML='';renderItems($('inspectItems'),list,cat==='junk'?'junk':'inspect');$('inspector').querySelector('.inspection-note').textContent=cat==='junk'?'Выберите вещь и перенесите в коробку справа.':'Двигайте вещи · для очистки откройте коллекцию.';}
function renderTarget(){
  const show=state.inspectCat==='junk';hidden('targetPreview',!show);if(!show)return;
  const cat=state.targetCat,area=$('targetPreview');area.innerHTML=`<header><span>${categories[cat].name}</span><button id="moveSelected">Переложить →</button><button id="tidyTarget" class="tidy-box">Сортировать ящик</button><button id="closeTarget" class="red-close" aria-label="Закрыть коробки">×</button></header><div id="targetScroll"><div id="targetItems"></div></div>`;
  renderItems($('targetItems'),stockFor(cat),'target');$('tidyTarget').onclick=()=>arrangeBox($('targetItems'),stockFor(cat),'target');$('closeTarget').onclick=closeInspection;
  $('moveSelected').disabled=state.selected===null;$('moveSelected').onclick=()=>sortItem(state.selected,state.targetCat);
}
function closeInspection(){cancelDrag();state.inspectCat=null;state.selected=null;hidden('inspector',true);hidden('targetPreview',true);renderWork();}
function pointerDown(e,x,node,kind){
  if(e.button!==0||state.paused||state.autoSorting)return;
  if(state.inspectCat!==null&&!['inspect','junk','target'].includes(kind))return;
  const r=node.getBoundingClientRect();drag={uid:x.uid,item:x,node,kind,x:e.clientX,y:e.clientY,grabX:(e.clientX-r.left)/scale,grabY:(e.clientY-r.top)/scale,active:false};node.setPointerCapture(e.pointerId);
}
function cancelDrag(){if(drag){drag.ghost?.remove();drag.node.style.opacity='';drag=null;state.selected=null;}$('heldRecognize')?.remove();}
function liftItem(){drag.active=true;drag.ghost=drag.node.cloneNode(true);drag.ghost.removeAttribute('id');drag.ghost.classList.add('dragging');drag.ghost.classList.remove('chosen');drag.ghost.style.opacity='1';drag.ghost.style.transform='none';drag.ghost.style.width=drag.node.getBoundingClientRect().width+'px';drag.ghost.style.height=drag.node.getBoundingClientRect().height+'px';document.body.append(drag.ghost);drag.node.style.opacity='0';hidden('tooltip',true);}
function moveHeld(x,y){drag.ghost.style.left=x-drag.grabX*scale+'px';drag.ghost.style.top=y-drag.grabY*scale+'px';}
function inside(el,x,y){if(!el)return false;const r=el.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;}
addEventListener('pointermove',e=>{
  if(!drag)return;if(!drag.active&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6)return;
  if(!drag.active)liftItem();
  moveHeld(e.clientX,e.clientY);
  const scroll=drag.kind==='table'?$('pile'):drag.node.parentElement.parentElement;
  if(scroll&&inside(scroll,e.clientX,e.clientY)){const r=scroll.getBoundingClientRect();if(e.clientY>r.bottom-20*scale)scroll.scrollTop+=10;if(e.clientY<r.top+20*scale)scroll.scrollTop-=10;}
});
function dropHeld(e){
  if(!drag)return;const d=drag;drag=null;if(!d.active)return;d.ghost.remove();d.node.style.opacity='';$('heldRecognize')?.remove();state.selected=null;suppressUntil=performance.now()+150;if(state.paused)return;
  if(d.kind==='table'||d.kind==='junk'){
    if(d.kind==='table'&&state.upgrade&&inside($('junkShelf'),e.clientX,e.clientY)){state.bag=state.bag.filter(x=>x.uid!==d.uid);state.junk.push(d.item);state.selected=null;renderWork();save();return;}
    for(const box of $('shelves').querySelectorAll('[data-cat]'))if(inside(box,e.clientX,e.clientY)){sortItem(d.uid,Number(box.dataset.cat));return;}
    if(d.kind==='junk'&&inside($('targetPreview'),e.clientX,e.clientY)){sortItem(d.uid,state.targetCat);return;}
  }
  if(d.kind==='source'&&inside($('parcelDrop'),e.clientX,e.clientY)){packItem(d.uid);return;}
  const area=d.node.parentElement,pane=d.kind==='table'?area:area.parentElement;
  if(inside(pane,e.clientX,e.clientY)){
    const r=area.getBoundingClientRect(),size=d.kind==='table'?79:60;
    const pos={x:Math.max(0,Math.min(1,((e.clientX-r.left)/scale-d.grabX-10)/Math.max(1,area.clientWidth-size-20))),y:0};
    if(d.kind==='table')pos.y=Math.max(0,Math.min(1,((e.clientY-r.top)/scale-d.grabY-10)/Math.max(1,area.clientHeight-size-20)));
    else pos.y=Math.max(8,Math.min(area.clientHeight-size-12,(e.clientY-r.top)/scale-d.grabY));
    d.item[itemPositionKey(d.kind)]=pos;d.item.depth=++depth;state.selected=null;
    const scrollTop=pane.scrollTop,paneId=pane.id;
    if(state.inspectCat!==null){renderInspection();renderTarget();}else renderWork();
    if($(paneId))$(paneId).scrollTop=scrollTop;save();
  }else toast('Вещь осталась на прежнем месте.');
}
addEventListener('pointerup',e=>{if(!drag?.clickHeld)dropHeld(e);});
addEventListener('pointerdown',e=>{
  if(!drag?.clickHeld||e.button!==0)return;
  if(e.target.closest('#heldRecognize'))return;
  if(e.target.closest('#pile,#shelves,#inspectItems,#sourceItems,#targetItems,#parcelDrop,#targetPreview')){e.preventDefault();e.stopImmediatePropagation();dropHeld(e);}
  else cancelDrag();
},true);
addEventListener('pointercancel',cancelDrag);
addEventListener('click',e=>{if(performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}},true);

const UPGRADE_DEFS=[
 {key:'upgrade',name:'Сундук диковинок',art:'chest',price:20,description:'Одной кнопкой убрать весь хлам со стола в сундук. Разобрать можно позже.'},
 {key:'bigBagChance',name:'Большие поставки',art:'bag-premium',price:30,description:'С дня 2: +5% к шансу большого мешка за 20 монет. Одна покупка.'},
 {key:'bagCapacity',name:'Вместительные мешки',art:'bag',price:25,description:'+2 предмета в будущих мешках, включая ещё не пришедших посетителей.'},
 {key:'orderBonus',name:'Доброе имя',art:'ledger',price:30,description:'+5 монет за каждое новое поручение после покупки.'}
];
function openUpgrade(){
 if(!state.started||state.paused)return;
 modal('<h2>Улучшения лавки</h2><p>В казне: '+state.gold+' монет</p><div class="upgrade-grid">'+UPGRADE_DEFS.map((u,i)=>`<article class="upgrade-card"><img src="${asset('storage/'+u.art)}" alt=""><h3>${u.name}</h3><p>${u.description}</p><button class="primary" id="${i===0?'buyUpgrade':'buyUpgrade'+i}" ${state[u.key]||state.gold<u.price?'disabled':''}>${state[u.key]?'Приобретено':'Купить · '+u.price+' монет'}</button></article>`).join('')+'</div>',{wide:true});
 UPGRADE_DEFS.forEach((u,i)=>$(i===0?'buyUpgrade':'buyUpgrade'+i).onclick=()=>{
  if(state[u.key]||state.gold<u.price)return;state.gold-=u.price;state.daySpent+=u.price;state[u.key]=u.key==='bigBagChance'?.05:true;
  if(u.key==='bagCapacity')for(const offer of state.schedule){const organic=organicTypes();offer.loot.push(makeItem(choose(organic)),makeItem(choose(pool().filter(t=>!items[t].organic))));}
  closeModal();render();save();toast('Улучшение приобретено: '+u.name);
 });
}
function sweep(){if(!state.upgrade||state.paused||!state.bag.length)return;state.bag.forEach(x=>{delete x.boxPos;state.junk.push(x);});state.bag=[];state.selected=null;render();save();beep();toast('Стол свободен. Несортированное ждёт в «Диковинках».');}
function rarity(type){return type===17||type===23?'Легендарная':type===15||type===28?'Эпическая':type%5===0?'Редкая':'Простая';}
function openUnknown(x){
  if(state.paused||state.autoSorting||!isUnknown(x))return;
  modal(`<h2>Неизвестная находка</h2><div class="unknown-preview mystery-item"><img src="${asset(items[x.type].sprite)}" alt="Неизвестная находка"><span class="mystery-question">?</span></div><p>Очистите предмет, чтобы распознать его.</p><button id="inspectUnknown" class="primary">Распознать</button><button id="stashUnknown" ${!state.upgrade||state.junk.includes(x)?'disabled':''}>${state.junk.includes(x)?'Уже в Диковинках':state.upgrade?'Отложить в Диковинки':'Диковинки — сначала откройте сундук'}</button>`);
  $('inspectUnknown').onclick=()=>openCleaning(x.type,x);
  $('stashUnknown').onclick=()=>{if(!state.upgrade||state.junk.includes(x))return;state.bag=state.bag.filter(y=>y!==x);state.stock=state.stock.filter(y=>y!==x);state.junk.push(x);closeModal();render();if(state.inspectCat!==null)renderInspection();save();};
}
function recognizeItem(type,instance){
  const newlyKnown=!state.collection.includes(type),wasUnknown=instance&&isUnknown(instance);
  if(!newlyKnown&&!wasUnknown)return;
  if(wasUnknown)instance.unknown=false;
  if(newlyKnown){state.collection.push(type);state.rep+=1;}
  const reward=(newlyKnown?5:0)+(wasUnknown?7:0);
  const status=$('cleanStatus');if(status){status.classList.add('recognition-result');status.innerHTML=`<strong>Вы распознали: ${items[type].name}</strong><span id="recognitionGold">+${reward} монет</span><span>+${newlyKnown?1:0} репутация</span>`;}
  if(reward)gainGold(reward,$('recognitionGold')||status);
  save();return {newlyKnown,wasUnknown,reward};
}
function openCollection(){
  if(!state.started||state.paused)return;const available=new Set(owned().map(x=>x.type));
  modal(`<img class="collection-ledger" src="assets/storage/ledger.png" alt=""><h2>Атлас находок</h2><p>Распознано ${state.collection.length} / ${items.length}. Изучение: +1 репутация и +5 монет.<br>Раскрытие неизвестной находки: ещё +7 монет. Товар остаётся у вас.</p><div class="collection-grid">${items.map(it=>{const known=state.collection.includes(it.id),secret=mysteryType(it.id)&&!known;return `<button class="collection-item ${known?'known':''} ${secret?'mystery-item':''}" data-type="${it.id}" ${available.has(it.id)?'':'disabled'}><img src="${asset(it.sprite)}" alt="${known?it.name:'Неизученная находка'}">${secret?'<i class="mystery-question">?</i>':''}<span>${known?it.name:'Название неизвестно'}</span><small>${known?'✓ Распознано':available.has(it.id)?'Изучить':'Нет в запасах'}</small></button>`;}).join('')}</div>`,{wide:true});
  $('modalContent').querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>openCleaning(Number(b.dataset.type)));
}
function openCleaning(type,instance=owned().find(x=>x.type===type&&isUnknown(x))){
  const it=items[type],done=state.collection.includes(type);
  modal(`<h2 id="recognitionTitle">${done?it.name:'Осмотр находки'}</h2><p>${done?'Вы распознали эту находку и записали её название в атлас.':'Проведите пальцем или мышью, чтобы стереть налёт.'}</p><div class="clean-stage"><img src="${asset(it.sprite)}" alt="${done?it.name:'Неизученная находка'}"><canvas id="dirt" width="360" height="270" aria-label="Стирайте налёт с находки"></canvas></div><div class="clean-meter"><i id="cleanBar" style="width:${done?100:0}%"></i></div><p id="cleanStatus">${done?'✓ Распознано: '+it.name:'Очищено 0%'}</p><div class="modal-actions"><button id="cleanKey">Очистить участок · клавиатура</button><button id="backCollection">К коллекции</button></div>`);
  const canvas=$('dirt'),ctx=canvas.getContext('2d',{willReadFrequently:true});let down=false,complete=done,strokes=0;
  if(!done){ctx.fillStyle='#736650';ctx.fillRect(0,0,360,270);for(let i=0;i<150;i++){ctx.fillStyle=i%2?'#8f7d60':'#5d513f';ctx.beginPath();ctx.arc(Math.random()*360,Math.random()*270,rand(1,5),0,7);ctx.fill();}}
  function check(){if(complete)return;const data=ctx.getImageData(0,0,360,270).data;let clear=0;for(let i=3;i<data.length;i+=16)if(data[i]<50)clear++;const pct=Math.round(clear/(data.length/16)*100);$('cleanBar').style.width=pct+'%';$('cleanStatus').textContent=`Очищено ${pct}%`;if(pct>=85){complete=true;ctx.clearRect(0,0,360,270);recognizeItem(type,instance);$('cleanBar').style.width='100%';$('recognitionTitle').textContent=it.name;$('cleanKey').disabled=true;render();if(state.inspectCat!==null)renderInspection();save();beep();}}
  function erase(x,y){if(complete)return;ctx.globalCompositeOperation='destination-out';ctx.beginPath();ctx.arc(x,y,33,0,Math.PI*2);ctx.fill();check();}
  function point(e){const r=canvas.getBoundingClientRect();erase((e.clientX-r.left)/r.width*360,(e.clientY-r.top)/r.height*270);}
  canvas.onpointerdown=e=>{down=true;canvas.setPointerCapture(e.pointerId);point(e);};canvas.onpointermove=e=>{if(down)point(e);};canvas.onpointerup=canvas.onpointercancel=()=>down=false;
  $('cleanKey').disabled=done;$('cleanKey').onclick=()=>{erase(20+(strokes%8)*45,20+Math.floor(strokes/8)*45);strokes++;};
  $('backCollection').onclick=()=>{closeModal();openCollection();};
}
function openRanks(){if(state.paused)return;modal(`<h2>Имя вашей лавки</h2><p>Репутация: ${state.rep}. За выданный заказ +4.<br>В этой истории доступны первые три ранга.</p><div class="rank-list">${rankNames.map((name,i)=>`<div class="rank-row ${i===rank()?'current':''} ${i>2?'locked':''}"><span>${i+1}. ${name}</span><span>${i>2?'🔒 позже':i===rank()?'Ваш ранг':i<rank()?'✓':i*12+' реп.'}</span></div>`).join('')}</div>`);}
function showAutoSortAd(){if(state.paused||!state.bag.length)return;modal('<h2>Помощь с сортировкой</h2><p>Тестовый просмотр · 2 секунды.<br>Настоящая реклама не подключена.</p><button id="confirmAuto" disabled>Подождите…</button>');const timer=setTimeout(()=>{if($('confirmAuto')){$('confirmAuto').disabled=false;$('confirmAuto').textContent='Разложить всё по категориям';}},2000);modalCleanup=()=>clearTimeout(timer);$('confirmAuto').onclick=autoSort;}
function showGoldAd(){
  if(!state.started||state.paused||state.autoSorting||state.ended||!state.goldAdUnlocked)return;
  modal('<h2>Пополнить казну · +15 монет</h2><p>Тестовый просмотр рекламы · 2 секунды.<br>Настоящая реклама пока не подключена.</p><button id="claimAdGold" class="primary" disabled>Просмотр…</button>');
  let ready=false,claimed=false;
  const timer=setTimeout(()=>{ready=true;if($('claimAdGold')){$('claimAdGold').disabled=false;$('claimAdGold').textContent='Получить 15 монет';}},2000);
  modalCleanup=()=>clearTimeout(timer);
  $('claimAdGold').onclick=()=>{if(!ready||claimed)return;claimed=true;gainGold(15,$('claimAdGold'));closeModal();render();save();toast('За просмотр рекламы: +15 монет');};
}
async function autoSort(){
  if(!$('confirmAuto')||$('confirmAuto').disabled)return;closeModal();state.autoSorting=true;renderWork();lockBackground(true);
  try{
    const queue=state.bag.filter(x=>!isUnknown(x));
    for(let i=queue.length-1;i>0;i--){const j=rand(0,i);[queue[i],queue[j]]=[queue[j],queue[i]];}
    for(const x of queue){
      const cat=items[x.type].cat;
      await flyToShelf(x,cat);
      const index=state.bag.findIndex(item=>item.uid===x.uid);if(index<0)continue;
      state.bag.splice(index,1);x.boxPos={x:Math.random()*.8,y:Math.floor(stockFor(cat).length/5)*76};
      state.stock.push(x);state.daySorted++;rewardSortedItem(x.uid);renderWork();save();
      const shelf=$('shelves').querySelector(`[data-cat="${cat}"]`);shelf?.classList.add('sort-received');
      setTimeout(()=>shelf?.classList.remove('sort-received'),500);
      await new Promise(resolve=>setTimeout(resolve,rand(35,80)));
    }
  }
  finally{state.autoSorting=false;lockBackground(false);renderWork();save();if(state.bag.some(isUnknown))toast('Неизвестные находки остались на столе. Осмотрите их или отложите в Диковинки.');}
}
async function flyToShelf(item,cat){
  const source=$('pile').querySelector(`[data-uid="${item.uid}"]`),target=$('shelves').querySelector(`[data-cat="${cat}"] .boxart`);
  if(!source||!target)return;
  const from=source.getBoundingClientRect(),to=target.getBoundingClientRect(),game=$('game').getBoundingClientRect();
  const ghost=document.createElement('img');ghost.className='flying-loot';ghost.src=asset(items[item.type].sprite);ghost.alt='';
  const size=78,x=(from.x+from.width/2-game.x)/scale-size/2,y=(from.y+from.height/2-game.y)/scale-size/2;
  const dx=(to.x+to.width/2-from.x-from.width/2)/scale,dy=(to.y+to.height/2-from.y-from.height/2)/scale;
  ghost.style.left=x+'px';ghost.style.top=y+'px';source.style.opacity='0';$('effects').append(ghost);
  try{
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animation=ghost.animate([
      {transform:'translate(0,0) scale(1)',opacity:1},
      {transform:`translate(${dx*.45+rand(-30,30)}px,${dy*.5-55}px) rotate(${rand(-16,16)}deg) scale(.95)`,opacity:1,offset:.5},
      {transform:`translate(${dx}px,${dy}px) rotate(0deg) scale(.35)`,opacity:0}
    ],{duration:reduced?40:rand(325,425),easing:'cubic-bezier(.3,0,.25,1)',fill:'forwards'});
    await animation.finished;
  }finally{ghost.remove();source.style.opacity='';}
}
function hasSave(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY));return s?.version===1&&s.started;}catch{return false;}}
function loadGame(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY));if(s?.version!==1||!Array.isArray(s.stock)||!Array.isArray(s.bag))return;state={...freshState(),...s,paused:false,autoSorting:false,selected:null,inspectCat:null,activeCat:null};restoreOrders();depth=Math.max(100,...owned().map(x=>x.depth||0));render();if(state.ended)showSummary();}catch{toast('Не удалось прочитать сохранение. Можно начать заново.');}}
function help(){if(state.paused)return;modal('<h2>Как работает лавка</h2><div class="rules"><b>Закупка.</b> Купите мешок за 10 монет. Содержимое заранее неизвестно.<br><b>Порядок.</b> Перетаскивайте вещи на полки. Или нажмите вещь, затем коробку. Ошибка подскажет категорию.<br><b>Заказ.</b> Листок справа. Недостающее появится в новых мешках. Откройте коробку и отправляйте нужное в посылку.<br><b>Диковинки.</b> За 20 монет купите временную коробку и убирайте остаток мешка одним действием.<br><b>Атлас.</b> Очистите находку и сохраните её изображение. Товар остаётся для продажи.<br><b>Вечер.</b> Новые приходы прекращаются; закончите дела и нажмите «Закончить день».</div>');}

function setup(){
  hidden('tooltip',true);$('tooltip').setAttribute('role','tooltip');
  const board=document.createElement('aside');board.id='orderBoard';board.className='hidden';board.setAttribute('aria-label','Принятые поручения');$('reception').append(board);
  $('game').addEventListener('pointerover',e=>{
    const node=e.target.closest('.item,.collection-item,img');if(!node||state.autoSorting||drag)return;
    const img=node.matches('img')?node:node.querySelector('img');
    const item=items.find(it=>img?.getAttribute('src')===asset(it.sprite));if(!item)return;
    const concealed=e.target.closest('.mystery-item')||e.target.closest('.collection-item')&&!state.collection.includes(item.id);
    $('tooltip').textContent=concealed?'Неизвестная находка':item.name;hidden('tooltip',false);positionItemTooltip(e);
  });
  $('game').addEventListener('pointermove',positionItemTooltip);
  $('game').addEventListener('pointerout',()=>hidden('tooltip',true));
  $('game').addEventListener('pointerdown',()=>hidden('tooltip',true));
  const start=document.createElement('section');start.id='startScreen';start.setAttribute('aria-label','Начало игры');
  const startActions=document.createElement('div');startActions.className='start-actions';start.append(startActions);
  button(startActions,'Начать',startGame,'startGame').className='primary';
  button(startActions,'Продолжить',loadGame,'loadGame');$('game').prepend(start);
  const arrival=document.createElement('button');arrival.id='arrivalSignal';arrival.onclick=()=>setScreen('reception');$('work').append(arrival);
  const sweepButton=document.createElement('button');sweepButton.id='sweepButton';sweepButton.textContent='Убрать всё в Диковинки';sweepButton.onclick=sweep;$('work').append(sweepButton);
  const goldAd=button($('work'),'▶ Посмотреть рекламу · +15 монет',showGoldAd,'goldAdButton');goldAd.className='gold';
  $('autoSortButton').parentElement.insertBefore(goldAd,$('autoSortButton'));
  const receptionGoldAd=button($('reception'),'▶ Посмотреть рекламу · +15 монет',showGoldAd,'receptionGoldAd');receptionGoldAd.className='gold hidden';
  const target=document.createElement('section');target.id='targetPreview';target.className='hidden';$('work').append(target);
  const tidyInspector=button($('closeInspector').parentElement,'Сортировать ящик',()=>arrangeBox($('inspectItems'),state.inspectCat==='junk'?state.junk:stockFor(state.inspectCat),state.inspectCat==='junk'?'junk':'inspect'),'tidyInspector');tidyInspector.className='tidy-box';
  const note=document.createElement('div');note.className='portrait-note';note.textContent='Поверните телефон горизонтально — так удобнее раскладывать находки.';document.body.append(note);
  $('back').onclick=()=>setScreen('reception');$('bag').onclick=buyBag;$('parcel').onclick=openOrder;$('closeInspector').onclick=closeInspection;
  $('closeModal').onclick=closeModal;$('autoSortButton').onclick=showAutoSortAd;$('ordersNav').onclick=showOrders;$('help').onclick=help;
  const upgrades=document.querySelector('[data-lock="Расширение склада"]');upgrades.textContent='Улучшение';upgrades.onclick=openUpgrade;
  const collection=document.querySelector('[data-lock="Магический сканер"]');collection.textContent='Коллекция';collection.onclick=openCollection;
  const r=document.querySelector('.rep');r.tabIndex=0;r.setAttribute('role','button');r.setAttribute('aria-label','Посмотреть ранги репутации');r.onclick=openRanks;r.onkeydown=e=>{if(e.key==='Enter')openRanks();};
  $('sound').onclick=()=>{state.muted=!state.muted;beep();updateHud();save();};
  $('settings').onclick=openSettings;
  $('pause').onclick=()=>{if(state.paused||!state.started)return;modal('<h2>Лавка на паузе</h2><p>Часы остановлены. Все находки на своих местах.</p><button id="resume" class="primary">Продолжить</button>');$('resume').onclick=closeModal;};
}
addEventListener('keydown',e=>{
  if(!$('modal').classList.contains('hidden')){
    if(e.key==='Escape'){e.preventDefault();closeModal();}
    if(e.key==='Tab'){const buttons=[...$('modal').querySelectorAll('button:not(:disabled)')].filter(b=>!b.classList.contains('hidden'));const first=buttons[0],end=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();end?.focus();}else if(!e.shiftKey&&document.activeElement===end){e.preventDefault();first?.focus();}}
    return;
  }
  if(state.autoSorting)return;
  if(e.key==='Escape'){if(drag){cancelDrag();return;}if(state.inspectCat!==null)closeInspection();else if(state.selected!==null){state.selected=null;renderWork();}else if(state.activeCat!==null){state.activeCat=null;renderWork();}else if(state.screen==='work')setScreen('reception');}
});
document.addEventListener('visibilitychange',()=>{last=performance.now();save();});addEventListener('pagehide',save);addEventListener('resize',resize);
function tick(now){const dt=Math.min(1,(now-last)/1000);last=now;if(state.started&&!state.paused&&!state.ended&&!state.autoSorting&&!document.hidden){if(!state.tutorial?.active){state.seconds=Math.max(0,state.seconds-dt*(state.screen==='work'?CONFIG.workTimeRate:1));tickArrivals();advanceReadyVisitor(dt);}updateHud();saveClock+=dt;if(saveClock>=5){saveClock=0;save();}}tutorialFrame();requestAnimationFrame(tick);}

setup();resize();render();requestAnimationFrame(tick);
