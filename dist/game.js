'use strict';

// A small local playtest, using the original v5 art and scenes.
const CONFIG = {days:5, daySeconds:180, workTimeRate:0.5, visitorGap:[5,10], idleVisitorGap:[5,7], orderVisitorGap:3, startingGold:80, bagPrice:10, upgradePrice:20};
// Seconds on the day clock (workbench time advances at half speed).
const INTRO_TIMING={
  1:{adventurers:[2,22,43,64,85,108,132],orders:[14,76,150]},
  2:{adventurers:[2,20,39,58,78,99,122],orders:[12,52,94]}
};
const SAVE_KEY = 'guild-warehouse-playtest-1';
const rankNames = ['Малая лавка','Надёжный поставщик','Гильдейский торговец','Купеческий дом','Известная фактория','Королевский поставщик','Легенда гильдии'];
let state = freshState();
let scale=1, drag=null, depth=100, suppressDropClick=false, toastTimer, modalCleanup=null, previousFocus=null, modalLocked=false;
let audioContext=null, last=performance.now(), saveClock=0, recognitionFeedback=null;
let modalResumePaused=false, recognitionSubjectUid=null, backgroundDialogSignature='', parcelAutomationView=null;

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
  animateGold(amount,origin);
}
function animateGold(amount,origin){
  const from=origin?.getBoundingClientRect?.()||{left:innerWidth/2,top:innerHeight/2,width:0,height:0};
  const target=($('walletIcon')||$('gold')).getBoundingClientRect();
  for(let i=0;i<Math.min(9,amount);i++){
    const coin=document.createElement('span');coin.className='reward-coin';coin.textContent='●';document.body.append(coin);
    const x=from.left+from.width/2,y=from.top+from.height/2,dx=target.left+target.width/2-x,dy=target.top+target.height/2-y;
    coin.style.left=x+'px';coin.style.top=y+'px';
    const motion=coin.animate([{transform:'translate(-50%,-50%) scale(.6)',opacity:0},{transform:`translate(${rand(-65,65)}px,${rand(-55,15)}px) scale(1)`,opacity:1,offset:.25},{transform:`translate(${dx}px,${dy}px) scale(.45)`,opacity:1}],{duration:850,delay:i*65,easing:'ease-in-out'});
    motion.finished.catch(()=>{}).finally(()=>coin.remove());
  }
}
function showGoldSpend(amount){
  if(!(amount>0))return;
  const wallet=$('goldWallet');if(!wallet)return;
  wallet.querySelectorAll('.wallet-change').forEach(node=>node.remove());
  const change=document.createElement('span');change.className='wallet-change spending';change.textContent='−'+amount;
  change.setAttribute('role','status');change.setAttribute('aria-label','Потрачено '+amount+' монет');wallet.append(change);
  const motion=change.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)',offset:.12},{opacity:1,transform:'translateY(-4px)',offset:.72},{opacity:0,transform:'translateY(-15px)'}],{duration:1700,easing:'ease-out'});
  motion.finished.catch(()=>{}).finally(()=>change.remove());
}
function advanceRecognitionFeedback(dt){
  if(!recognitionFeedback||document.hidden)return;
  if(!recognitionFeedback.title.isConnected||$('modal').classList.contains('hidden')){recognitionFeedback=null;return;}
  recognitionFeedback.elapsed+=Math.max(0,Number(dt)||0);
  if(recognitionFeedback.elapsed>=1.5){recognitionFeedback=null;closeModal();render();}
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
  return waiting.sort((a,b)=>Number(b.kind==='bag'&&!!b.value.openingDay)-Number(a.kind==='bag'&&!!a.value.openingDay)||a.value.arrivalSerial-b.value.arrivalSerial);
}
function counterGuest(){return state.visitorCooldown>0&&!state.tutorial?.active?null:visitorQueue()[0];}
function startVisitorGap(kind='bag'){
  state.visitorCooldown=kind==='order'?CONFIG.orderVisitorGap:rand(...(kind==='idle'?CONFIG.idleVisitorGap:CONFIG.visitorGap));
  state.visitorGapPending=true;state.visitorIdleReady=kind==='idle';state.arrivalPacingVersion=3;
}
function advanceVisitorGap(dt){
  const idle=!state.bag.length||state.screen==='reception';
  if(idle&&!state.visitorIdleReady&&state.visitorCooldown>0)state.visitorCooldown=Math.min(state.visitorCooldown,rand(...CONFIG.idleVisitorGap));
  state.visitorIdleReady=idle;
  const before=state.visitorCooldown||0;state.visitorCooldown=Math.max(0,before-dt);
  if(before>0&&!state.visitorCooldown&&state.screen==='reception')renderReception();
}
function normalizeAdventurerVisitors(){
  // Retired portraits keep their saved guest, original loot and queue position.
  for(const queue of [state.offers,state.schedule,state.story?.deferredSupplierOffers]){
    for(const offer of queue||[])if(offer?.visitor===5||offer?.visitor===6)offer.visitor-=5;
  }
}
function restoreOrders(){
  normalizeAdventurerVisitors();
  state.orders??=[];
  if(state.order){const saved=state.orders.find(o=>o.id&&o.id===state.order.id);if(saved)state.order=saved;else state.orders.push(state.order);}
  state.orderUid=Math.max(state.orderUid||0,...state.orders.map(o=>o.id||0));
  for(const o of state.orders)if(!o.id)o.id=++state.orderUid;
  state.order??=state.orders[0]||null;
  if(Story.enabled()){Story.ensure();Dwarf.ensure();Goblin.ensure();Goblin.reconcile();return;}
  migrateIntroTiming();
  migrateLoot();
  if(!state.sortingBatches){state.sortingBatches=[];trackSortingBag(state.bag);}
  if(state.queueVersion!==1){
    if(INTRO_TIMING[state.day])state.orderSchedule=INTRO_TIMING[state.day].orders.slice(state.dayOrdersCreated||0);
    state.queueVersion=1;visitorQueue();
  }
  if(state.arrivalPacingVersion!==3){
    if(state.visitorCooldown>0){state.visitorCooldown=Math.min(state.visitorCooldown,rand(...CONFIG.visitorGap));state.visitorGapPending=true;}
    state.visitorIdleReady=false;state.arrivalPacingVersion=3;
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
function owned(){return [...state.stock,...state.junk,...state.bag,...(state.unknownTray||[]),...allOrders().flatMap(o=>o.packed)];}
function countType(type){return owned().filter(x=>x.type===type).length;}
function remaining(r){return r.count-(state.order?.packed.filter(x=>x.type===r.type).length||0);}
function orderComplete(){return !!state.order&&state.order.recipe.every(r=>remaining(r)===0);}
function orderAccepted(){return !!state.order&&state.order.accepted!==false;}
function save(){if(!state.started)return;try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));}catch{}}
let layoutTimer;
function scheduleLayout(){clearTimeout(layoutTimer);layoutTimer=setTimeout(resize,0);}
function resize(){
  const game=$('game'),viewportWidth=Math.max(1,document.documentElement.clientWidth||innerWidth),viewportHeight=Math.max(1,innerHeight);
  const previousScale=scale;
  scale=Math.min(1,viewportWidth/1280,viewportHeight/800);
  const width=Math.floor(viewportWidth/scale),height=Math.floor(viewportHeight/scale);
  game.dataset.viewportFit='true';game.dataset.layout='desktop';
  game.style.setProperty('--game-scale',String(scale));
  game.style.setProperty('--frame-width',width+'px');game.style.setProperty('--task-width',Math.min(360,Math.max(280,width*.2))+'px');
  game.style.width=width+'px';game.style.height=height+'px';
  game.style.left=Math.max(0,(viewportWidth-width*scale)/2)+'px';game.style.top=Math.max(0,(viewportHeight-height*scale)/2)+'px';
  game.style.transform='scale('+scale+')';
  const hud=game.querySelector(':scope > header')?.offsetHeight||77,footer=game.querySelector(':scope > footer')?.offsetHeight||70;
  const tasks=0; // Floating letters reserve neither the scene's width nor its height.
  game.style.setProperty('--hud-height',hud+'px');game.style.setProperty('--tasks-height',tasks+'px');game.style.setProperty('--footer-height',footer+'px');
  game.style.setProperty('--work-heading-height',($('work')?.querySelector('.work-heading')?.offsetHeight||68)+'px');game.style.setProperty('--shelves-height',($('shelves')?.offsetHeight||228)+'px');
  game.style.setProperty('--scene-height',Math.max(1,height-hud-tasks-footer)+'px');
  game.style.setProperty('--worker-height',Math.min(160,Math.max(120,(height-hud-tasks-footer)*.29))+'px');
  reflowItemNodes(previousScale);
  window.LootkeeperEngine?.resize?.(width,height);updateTaskPager();
}
function updateTaskPager(){
  const rail=$('taskRail'),letters=rail?.querySelector('.task-letters');if(!letters)return;
  const cards=[...letters.querySelectorAll('.order-card,.contract-offer-leaf')].filter(el=>el.getClientRects().length);
  const room=letters.getBoundingClientRect(),visible=cards.filter(el=>{const r=el.getBoundingClientRect();return r.top>=room.top-2&&r.bottom<=room.bottom+2;});
  const first=visible.length?cards.indexOf(visible[0])+1:0,last=visible.length?cards.indexOf(visible.at(-1))+1:0;
  const pages=letters.scrollHeight>letters.clientHeight+2;
  $('taskPageStatus').textContent=pages?first+'–'+last+' из '+cards.length:'';
  $('taskPrev').disabled=letters.scrollTop<=1;$('taskNext').disabled=letters.scrollTop+letters.clientHeight>=letters.scrollHeight-2;
  rail.classList.toggle('has-pages',pages);
}
function pageTasks(direction){
  const letters=$('taskRail').querySelector('.task-letters'),cards=[...letters.querySelectorAll('.order-card,.contract-offer-leaf')];
  const top=letters.scrollTop,targets=cards.map(card=>card.offsetTop);
  const next=direction>0?targets.find(y=>y>top+2):targets.filter(y=>y<top-2).at(-1);
  letters.scrollTo({top:next??(direction>0?letters.scrollHeight:0),behavior:'instant'});updateTaskPager();
}
function taskRailEmpty(){return !$('orderBoard')||$('orderBoard').classList.contains('hidden')&&$('contractOfferBoard').classList.contains('hidden');}
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
  tip.style.left=Math.max(8,Math.min($('game').clientWidth-tip.offsetWidth-10,(e.clientX-rect.left)/scale+16))+'px';
  tip.style.top=Math.max(8,Math.min($('game').clientHeight-tip.offsetHeight-10,(e.clientY-rect.top)/scale+18))+'px';
}
function button(parent,label,action,id,disabled=false){const b=document.createElement('button');b.textContent=label;if(id)b.id=id;b.disabled=disabled;b.onclick=action;parent.append(b);return b;}
function modalIsOpen(){return !$('modal').classList.contains('hidden');}
function isModalBlockingWork(){return modalIsOpen()&&$('modal').dataset.activity!=='background';}
function isItemBeingExamined(uid){return uid!==null&&uid!==undefined&&recognitionSubjectUid===uid;}
function lockBackground(value){for(const child of $('game').children)if(!['modal','effects','toast','tooltip'].includes(child.id))child.inert=value;}
function modal(html,{locked=false,wide=false,brief=false,activity='pause',kind='information'}={}){
  if(state.autoSorting)return false;
  if(!modalIsOpen())modalResumePaused=!!state.paused;
  modalCleanup?.();modalCleanup=null;cancelDrag();previousFocus=document.activeElement;
  state.paused=modalResumePaused||activity!=='background';modalLocked=locked;$('modalContent').innerHTML=html;
  $('modal').className='modal '+kind+'-dialog'+(brief?' order-brief':'');$('modal').dataset.activity=activity;$('modal').setAttribute('role','dialog');$('modal').setAttribute('aria-modal','true');
  backgroundDialogSignature='';
  $('modal').querySelector('.modal-card').classList.toggle('wide',wide);hidden('closeModal',locked);lockBackground(true);
  const focus=$('modal').querySelector('button:not(.hidden):not(:disabled)');focus?.focus();updateHud();return true;
}
function closeModal(){if(modalLocked)return;const wasOpen=modalIsOpen();modalCleanup?.();modalCleanup=null;hidden('modal',true);delete $('modal').dataset.activity;lockBackground(false);state.paused=wasOpen?modalResumePaused:state.paused;modalResumePaused=false;backgroundDialogSignature='';last=performance.now();previousFocus?.isConnected&&previousFocus.focus();updateHud();save();}
function forceCloseModal(){modalLocked=false;closeModal();}
function updateDaylight(){
  const progress=Math.max(0,Math.min(1,1-state.seconds/CONFIG.daySeconds));
  const periods=['morning','day','evening','night'],labels=['Утро','День','Вечер','Ночь'],stops=[0,.4,.76,1];
  const phase=progress<.25?0:progress<.65?1:progress<.88?2:3;
  const sky=$('daylight');
  if(sky){
    let segment=0;while(segment<2&&progress>stops[segment+1])segment++;
    const blend=(progress-stops[segment])/(stops[segment+1]-stops[segment]);
    periods.forEach((period,i)=>{const weight=i===segment?1-blend:i===segment+1?blend:0;sky.children[i].style.opacity=weight;$('game').style.setProperty('--light-'+period,weight);});
  }
  $('clock').textContent=labels[phase];
  // Future ambient sound can subscribe to a single event per period change.
  if($('game').dataset.period!==periods[phase]){
    $('game').dataset.period=periods[phase];
    $('game').dispatchEvent(new CustomEvent('dayperiodchange',{detail:{period:periods[phase]}}));
  }
}
function updateHud(){
  $('upgradesNav')?.classList.toggle('upgrade-prompt',state.started&&!state.upgradeHintSeen&&(state.day>1||(state.day===1&&state.ended)));
  $('dayLabel').textContent=`День ${state.day} / 5`;
  updateDaylight();
  $('sunbar').style.width=state.seconds/CONFIG.daySeconds*100+'%';$('gold').textContent=state.gold;
  $('rep').textContent=`${rank()+1}/7 · ${state.rep} реп.`;$('orderBadge').textContent=allOrders().filter(o=>o.accepted!==false).length;
  $('sound').textContent=state.muted?'♫̸':'♫';$('sound').setAttribute('aria-label',state.muted?'Включить звук':'Выключить звук');
  const signal=$('arrivalSignal'),head=counterGuest(),waiting=head?1:0;
  const visitor=head?(head.kind==='bag'?adventurers[head.value.visitor]:customers[head.value.customer]):null;
  const showArrival=!!waiting&&state.started&&!state.ended&&state.screen==='work';
  const arrivalKey=showArrival?`${state.day}:${head.value.arrivalSerial}:${waiting}`:'';
  if(signal.dataset.arrival!==arrivalKey){
    signal.dataset.arrival=arrivalKey;
    clearTimeout(signal.collapseTimer);signal.classList.remove('compact');
    signal.innerHTML=waiting?`<span class="arrival-mark" aria-hidden="true">!</span><span class="arrival-copy"><strong>Гость у стойки!</strong><span>${visitor[0]} · ${visitor[1]}</span><small>Ждут: ${waiting} · Перейти к стойке →</small></span>`:'';
    signal.setAttribute('aria-label',waiting?`Гость у стойки: ${visitor[0]}. Перейти к стойке`:'Гость у стойки');
    if(showArrival)signal.collapseTimer=setTimeout(()=>signal.classList.add('compact'),10000);
  }
  signal.classList.toggle('waiting',showArrival);hidden('arrivalSignal',!showArrival);
  if($('goldAdButton')&&$('receptionGoldAd'))updateGoldAd();
  Story.update();City.update();if(typeof Guild!=='undefined')Guild.update();
  if(typeof Tower!=='undefined')Tower.update();
  if($('taskRail'))hidden('taskRail',!state.started||state.screen==='tower'||City.isOpen()||taskRailEmpty());
  const parcelAutomation=typeof Automation!=='undefined'&&Automation.enabled();
  if(parcelAutomationView!==parcelAutomation){parcelAutomationView=parcelAutomation;renderOrderBoard();if(state.screen==='work')renderChecklist();}
  refreshBackgroundDialog();
  if(modalIsOpen())lockBackground(true);
}
function setScreen(screen,mode=state.mode){if(screen==='work'&&mode==='order'&&!orderAccepted()){openOrder();return;}cancelDrag();state.screen=screen;state.mode=mode;state.activeCat=null;state.inspectCat=null;state.selected=null;hidden('inspector',true);hidden('targetPreview',true);hidden('tooltip',true);render();save();}
function render(){
  const starting=!state.started;
  $('game').classList.toggle('starting',starting);hidden('startScreen',!starting);
  hidden('loadGame',!starting||!hasSave());
  hidden('reception',starting||state.screen!=='reception');hidden('work',starting||state.screen!=='work');
  if($('taskRail'))hidden('taskRail',starting||state.screen==='tower'||typeof City!=='undefined'&&City.isOpen()||taskRailEmpty());
  if(typeof Tower!=='undefined'){Tower.update();hidden('reception',starting||state.screen!=='reception'||Tower.isOpen());hidden('work',starting||state.screen!=='work'||Tower.isOpen());}
  updateHud();if(!starting){if(state.screen==='reception')renderReception();else if(state.screen==='work')renderWork();}
  scheduleLayout();
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
  if(Story.enabled()&&Contracts.renderReception())return;
  // Leave the counter empty until the first visitor's scheduled arrival.
  if(state.day===1&&!state.dayBought&&!state.offers.length&&state.schedule[0]?.at===2){
    hidden('speech',true);hidden('visitor',true);$('stepHint').textContent='';return;
  }
  {
    const offer=head?.kind==='bag'?head.value:null;
    if(offer){
      prepareOffer(offer);const price=offer.price;const v=adventurers[offer.visitor];$('visitor').src=asset(v[2]);hidden('bag',false);$('bag').querySelector('img').src=asset(offer.big?'storage/bag-premium':'storage/bag');$('bag').classList.toggle('premium',!!offer.big);
      $('speech').innerHTML=`<span class="eyebrow">${v[1]}</span><h2>${v[0]}</h2><p>${offer.theme||'Добыча из похода'}. ${offer.big?'Большой мешок':'Мешок'} за <b>${price} монет</b>${offer.theme?' — трофеи и полезные припасы.':' — внутри кое-что интересное!'}</p>`;
      button(action,`Купить ${offer.big?'большой мешок':'мешок'} · ${price} монет`,buyBag,'buyBag',state.gold<price).className='primary';
      if(state.bag.length)button(action,'Продолжить разбор на столе',()=>setScreen('work','sort'),'resumeBag');
      $('notice').innerHTML=`<b>Гость у стойки</b><br>Новый мешок добавится к находкам на столе.<br>На столе: ${state.bag.length} предметов.`;
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
    if(!state.schedule.length&&!state.offers.length&&!state.orderSchedule?.length&&!state.nextBagOrder)button(action,'Закончить день',requestEndDay,'closeDay',!!state.bag.length);
  }
  $('stepHint').textContent='';
  Story.render();
}
function planDay(firstArrival=0){
  state.dayCollectionStart=state.collection.length;
  state.seconds=CONFIG.daySeconds;state.dayIncome=state.daySpent=state.daySorted=state.dayErrors=state.dayOrders=state.dayBought=0;
  state.schedule=[];state.offers=[];state.visitorCooldown=0;state.visitorGapPending=false;state.visitorIdleReady=false;state.arrivalPacingVersion=3;state.nextBagOrder=false;
  const timing=INTRO_TIMING[state.day],n=timing?timing.adventurers.length:rand(3,4),types=pool();
  state.orderSchedule=timing?[...timing.orders]:[];
  state.dayOrdersCreated=0;state.timingVersion=2;state.lootVersion=1;state.queueVersion=1;state.arrivalIdle=0;
  for(let i=0;i<n;i++){const big=state.day===2&&i===2;state.schedule.push({at:timing?timing.adventurers[i]:i===0?firstArrival:Math.round(i*140/(n-1)),visitor:(state.day+i-1)%adventurers.length,big,loot:makeLoot(big)});}
  guaranteeOrder();tickArrivals();
}
function startGame(){Story.start();}
function restartWithTutorial(){
  if(state.autoSorting)return;
  BagPour.clear();
  try{localStorage.removeItem(TUTORIAL_KEY);}catch{}
  cancelDrag();forceCloseModal();clearTimeout(toastTimer);$('toast').classList.remove('show');$('effects').replaceChildren();document.querySelectorAll('.reward-coin').forEach(coin=>coin.remove());startGame();
}
function openSettings(){
  if(!state.started||state.autoSorting)return;
  modal('<h2>Настройки</h2><p>Сброс вернёт игру к первому дню: монеты, предметы и поручения начнутся заново. Обучение пройдёт повторно.</p><div class="modal-actions"><button id="resetLevel" class="primary">Сбросить уровень и пройти обучение</button><button id="resumeSettings">Продолжить игру</button></div>');
  $('resumeSettings').onclick=closeModal;
  $('resetLevel').onclick=restartWithTutorial;
}
function tickArrivals(){
  if(Story.enabled()){Story.arrivals();return;}
  if(state.visitorCooldown>0)return;
  if(counterGuest()){state.visitorGapPending=false;return;}
  let changed=false;
  const now=CONFIG.daySeconds-state.seconds,serviceReady=state.visitorGapPending;let orderDeferred=false;
  // The timetable keeps the guest sequence; service gaps determine the actual arrival.
  if(state.visitorGapPending){
    const bagAt=state.schedule[0]?.at??Infinity,orderAt=state.orderSchedule?.[0]??Infinity;
    if(Number.isFinite(Math.min(bagAt,orderAt))){
      if(orderAt<bagAt)state.orderSchedule[0]=Math.min(orderAt,now);
      else state.schedule[0].at=Math.min(bagAt,now);
    }
    state.visitorGapPending=false;
  }
  if(state.nextBagOrder&&createOrder(true)){state.nextBagOrder=false;changed=true;}
  while(!changed){
    const bagAt=state.schedule[0]?.at??Infinity,orderAt=orderDeferred?Infinity:state.orderSchedule?.[0]??Infinity;
    if(Math.min(bagAt,orderAt)>now)break;
    if(bagAt<=orderAt){const offer=state.schedule.shift();prepareOffer(offer);offer.arrivalSerial=state.arrivalSerial=(state.arrivalSerial||0)+1;state.offers.push(offer);changed=true;}
    else if(createOrder(true)){state.orderSchedule.shift();changed=true;}
    else{orderDeferred=true;if(serviceReady&&state.schedule.length)state.schedule[0].at=Math.min(state.schedule[0].at,now);}
  }
  if(changed){if(state.screen==='work')updateHud();else renderReception();save();}
}
function waitAtWindow(){if(state.paused)return;const next=state.schedule[0];if(next){state.seconds=Math.max(0,CONFIG.daySeconds-next.at);tickArrivals();render();}}
function tutorialTablePosition(index,count){
  return BagPour.position(index,count,0);
}
function repairTableLayout(list){
  const invalid=list.some(x=>x.tablePos&&(!Number.isFinite(x.tablePos.x)||!Number.isFinite(x.tablePos.y)||x.tablePos.x<0||x.tablePos.x>1||x.tablePos.y<0||x.tablePos.y>1));
  if(invalid)list.forEach((x,i)=>{x.tablePos=tutorialTablePosition(i,list.length);});
  return invalid;
}
function buyBag(options={}){
  if(state.paused||BagPour.active()||!state.offers.length||counterGuest()?.kind!=='bag')return;
  prepareOffer(state.offers[0]);if(state.gold<state.offers[0].price)return;
  const offer=state.offers.shift();state.gold-=offer.price;state.daySpent+=offer.price;state.dayBought++;
  startVisitorGap();
  state.bag.push(...offer.loot);state.combo=0;trackSortingBag(offer.loot);
  if(Story.enabled())Story.onBagPurchased(offer);
  BagPour.layout(offer.loot,{existing:state.bag.filter(x=>!offer.loot.includes(x))});
  for(const x of offer.loot)x.depth=++depth;
  if(!INTRO_TIMING[state.day]&&!allOrders().some(o=>o.accepted===false)&&(!allOrders().length||state.offers.length||state.schedule.length))state.nextBagOrder=true;
  if(!options.background){setScreen('work','sort');BagPour.start(offer.loot.map(x=>x.uid));}
  else render();
  showGoldSpend(offer.price);save();beep();return true;
}
function advanceReadyVisitor(dt){
  if(Story.enabled())return;
  if(state.visitorGapPending||counterGuest()||(state.bag.length&&state.screen!=='reception'))return;
  if(state.schedule.length||state.orderSchedule?.length||state.nextBagOrder)startVisitorGap('idle');
}
function createOrder(keepSelection=false){
  if(Story.enabled())return Story.createOrder(keepSelection);
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
  if(state.mode==='order'&&orderComplete())state.activeCat=null;
  updateGoldAd();
  const sort=state.mode==='sort';$('work').classList.toggle('sorting',sort);$('work').classList.toggle('fulfillment',!sort);$('work').classList.toggle('has-note',sort&&allOrders().some(o=>o.accepted!==false));
  $('workMode').textContent=sort?'ВАША ЛАВКА · СОРТИРОВКА':'ЗАКАЗ · СБОРКА ПОСЫЛКИ';$('workTitle').textContent=sort?'У каждой находки — своё место':'Найдите вещи в своём складе';
  $('workProgress').textContent=sort?`${state.bag.length} на столе`:`${state.order?.packed.length||0} в посылке`;
  $('autoSortButton').textContent=Story.enabled()&&state.dwarf?.hired?'Поручить Борину':'Автосортировка';
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
    if(state.activeCat===null){$('sourceBox').className='source-placeholder';$('sourceBox').textContent=orderComplete()?'Посылка готова! Можно выдать заказ.':'Откройте нужную коробку на полке';}
    else{$('sourceBox').className='source-open';$('sourceBox').innerHTML=`<div class="source-heading"><div><b>${categories[state.activeCat].name}</b></div><button id="tidySource" class="tidy-box">Сортировать ящик</button><button id="closeSource" class="red-close" aria-label="Закрыть коробку">×</button></div><div id="sourceScroll"><div id="sourceItems"></div></div>`;$('closeSource').onclick=()=>{state.activeCat=null;renderWork();};$('tidySource').onclick=()=>arrangeBox($('sourceItems'),stockFor(state.activeCat),'source');renderItems($('sourceItems'),stockFor(state.activeCat),'source');}
  }
  renderChecklist();hidden('autoSortButton',!sort);$('autoSortButton').disabled=!state.bag.length||state.autoSorting;
  hidden('sweepButton',!sort||!state.upgrade);$('sweepButton').disabled=!state.bag.length;
  hidden('sortingDone',true);renderOrderBoard();updateHud();Story.render();BagPour.render();scheduleLayout();
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
  if(state.paused||state.autoSorting||BagPour.active())return;
  if(state.inspectCat==='junk'){state.targetCat=cat;renderTarget();return;}
  if(state.selected!==null){sortItem(state.selected,cat);return;}
  if(state.mode==='order'){state.activeCat=cat;renderWork();}else openInspection(cat);
}
function renderChecklist(){
  const el=$('checklist');hidden('checklist',!orderAccepted()||state.mode==='sort');el.innerHTML='';if(!orderAccepted()||state.mode==='sort')return;
  const o=state.order;styleQuestSheet(el,o);el.innerHTML=`<span class="quest-eyebrow">СПИСОК ПОСЫЛКИ</span><h3>${escapeQuestText(o.title||'Поручение')}</h3><p class="quest-recipient">Кому: <b>${escapeQuestText(customers[o.customer]?.[0]||'Заказчик')}</b><small>${escapeQuestText(customers[o.customer]?.[1]||'')}</small></p>`+o.recipe.map(r=>`<div class="check-row ${remaining(r)===0?'done':''}"><span class="checkmark">${remaining(r)===0?'✓':'○'}</span><img src="${asset(items[r.type].sprite)}" alt=""><span class="check-name">${items[r.type].name}</span><b>${r.count-remaining(r)}/${r.count}</b></div>`).join('')+`<div class="dispatch-status"><strong>Оплата: ${o.reward} монет</strong>${o.carried?' · перенесён':''}</div><div class="note-actions"></div>`;
  const actions=el.querySelector('.note-actions');
  if(Story.enabled()&&Goblin.isAssigned(o)){renderParcelActions(actions,o);return;}
  if(state.mode==='sort')button(actions,'Собрать поручение',()=>setScreen('work','order'),'assembleNote').className='primary';
  else if(orderComplete())button(actions,'Выдать посылку',finishOrder,'ship').className='primary dispatch-ready';
  else button(actions,'Вернуться к сортировке',()=>setScreen('work','sort'),'backSort');
}
function itemPositionKey(kind){return kind==='table'?'tablePos':kind==='packed'?'parcelPos':kind==='source'?'sourcePos':'boxPos';}
function positionItemNode(node,x,area,kind){
  const table=kind==='table',pos=x[itemPositionKey(kind)];if(!pos)return;
  const width=node.offsetWidth||(table?79:60),height=node.offsetHeight||width;
  node.style.left=(10+Math.max(0,Math.min(1,pos.x))*Math.max(1,area.clientWidth-width-20))+'px';
  node.style.top=(table?10+pos.y*Math.max(1,area.clientHeight-height-20):pos.y)+'px';
}
function reflowItemNodes(previousScale){
  // Reposition the existing instances rather than rebuilding a crate: a held
  // item, its DOM node, reservations and each pane's scroll position survive.
  const byUid=new Map([...state.bag,...state.stock,...state.junk,...allOrders().flatMap(o=>o.packed||[])].map(x=>[x.uid,x]));
  for(const id of ['pile','packedItems','sourceItems','inspectItems','targetItems']){
    const area=$(id);if(!area||!area.clientWidth)continue;
    const nodes=[...area.querySelectorAll('.item')];let bottom=area.parentElement.clientHeight;
    for(const node of nodes){const x=byUid.get(Number(node.dataset.uid));if(!x)continue;positionItemNode(node,x,area,node.dataset.kind);bottom=Math.max(bottom,node.offsetTop+node.offsetHeight+12);}
    if(id!=='pile'&&nodes.length)area.style.height=bottom+'px';
  }
  if(drag?.ghost?.isConnected){
    const pointerX=parseFloat(drag.ghost.style.left)+drag.grabX*previousScale,pointerY=parseFloat(drag.ghost.style.top)+drag.grabY*previousScale;
    const r=drag.node.getBoundingClientRect();drag.ghost.style.width=r.width+'px';drag.ghost.style.height=r.height+'px';
    moveHeld(pointerX,pointerY);
  }
}
function repairBoxLayout(list,area,kind){
  if(kind==='table')return false;
  const key=itemPositionKey(kind),width=Math.max(100,area.clientWidth||450),columns=Math.max(1,Math.floor((width-20)/68));
  const maxY=Math.max(area.parentElement.clientHeight*2,Math.ceil(list.length/columns)*90+100);
  let repaired=false;
  list.forEach((x,i)=>{
    const pos=x[key];
    if(!pos||!Number.isFinite(pos.x)||!Number.isFinite(pos.y)||pos.x<0||pos.x>1||pos.y<0||pos.y>maxY){
      x[key]={x:(i%columns)*68/Math.max(1,width-80),y:8+Math.floor(i/columns)*68};repaired=true;
    }
  });
  return repaired;
}
function revealSourceContents(){
  const area=$('sourceItems'),pane=$('sourceScroll');if(!area||!pane)return;
  const nodes=[...area.querySelectorAll('.item')];if(!nodes.length)return;
  const visible=nodes.some(node=>node.offsetTop+node.offsetHeight>pane.scrollTop&&node.offsetTop<pane.scrollTop+pane.clientHeight);
  if(!visible)pane.scrollTop=Math.max(0,Math.min(...nodes.map(node=>node.offsetTop))-8);
}
function arrangeBox(area,list,kind){
  if(state.paused||state.autoSorting)return;
  const width=area.clientWidth,size=60,columns=Math.max(1,Math.floor((width-20)/68)),key=itemPositionKey(kind);
  const ordered=[...list].sort((a,b)=>(isUnknown(a)?'Неизвестная находка':items[a.type].name).localeCompare(isUnknown(b)?'Неизвестная находка':items[b.type].name,'ru')||a.uid-b.uid);
  ordered.forEach((x,i)=>{x[key]={x:(i%columns)*68/Math.max(1,width-size-20),y:8+Math.floor(i/columns)*68};x.boxAngle=0;});
  area.innerHTML='';renderItems(area,list,kind);area.parentElement.scrollTop=0;save();
}
function renderItems(area,list,kind){
  hidden('tooltip',true);
  area.classList.remove('crowded-pile');
  if(kind==='table'){area.style.height='';repairTableLayout(list);}
  if(!list.length){if(kind!=='table')area.style.height='100%';area.innerHTML='<div class="empty-pile">Здесь пока пусто</div>';return;}
  const table=kind==='table',size=table?79:60,width=area.clientWidth||450,columns=Math.max(1,Math.floor((width-20)/68));
  const key=itemPositionKey(kind);
  if(!table&&repairBoxLayout(list,area,kind))save();
  list.forEach((x,i)=>{
    if(!table&&!x[key])x[key]={x:(i%columns)*68/Math.max(1,width-size-20),y:8+Math.floor(i/columns)*68};
    const pos=table?(x.tablePos||{x:Math.random()*.8,y:Math.random()*.7}):x[key];
    if(!table){pos.x=Math.max(0,Math.min(1,pos.x));pos.y=Math.max(8,pos.y);}
    if(table)x.tablePos=pos;
    const b=button(area,'',e=>clickItem(x,kind,e));b.className='item'+(state.selected===x.uid?' chosen':'');b.dataset.uid=x.uid;b.dataset.kind=kind;
    const unknown=isUnknown(x);b.classList.toggle('mystery-item',unknown);
    b.setAttribute('aria-label',unknown?'Неизвестная находка':items[x.type].name);
    if(Story.enabled()){
      const owner=allOrders().find(o=>o.reservedUids?.includes(x.uid));
      if(owner){b.title='Резерв: '+owner.title+(Goblin.isAssigned(owner)?' · собирает Грик':' · ручная посылка');b.dataset.reservedFor=owner.id;}
    }
    b.innerHTML=`<img src="${asset(items[x.type].sprite)}" alt="${unknown?'Неизвестная находка':items[x.type].name}" draggable="false">${unknown?'<span class="mystery-question">?</span>':''}`;
    positionItemNode(b,x,area,kind);
    b.style.transform=`rotate(${table&&x.tableAngle!==undefined?x.tableAngle:!table&&x.boxAngle!==undefined?x.boxAngle:x.uid%21-10}deg)`;b.style.zIndex=x.depth||i+1;
    b.onpointerdown=e=>pointerDown(e,x,b,kind);
  });
  if(!table)area.style.height=Math.max(area.parentElement.clientHeight,...list.map(x=>x[key].y+size+12))+'px';
  if(kind==='source')revealSourceContents();
}
function clickItem(x,kind,e){
  if(state.paused||state.autoSorting||BagPour.active())return;
  if(state.inspectCat!==null&&!['inspect','junk','target'].includes(kind))return;
  if(isUnknown(x)){cancelDrag();openUnknown(x);return;}
  if(Story.enabled())Dwarf.release(x.uid);
  const node=e?.currentTarget||document.querySelector(`.item[data-uid="${x.uid}"][data-kind="${kind}"]`);if(!node)return;
  const r=node.getBoundingClientRect();cancelDrag();state.selected=x.uid;
  drag={uid:x.uid,item:x,node,kind,x:r.left+r.width/2,y:r.top+r.height/2,grabX:r.width/scale/2,grabY:r.height/scale/2,active:false,clickHeld:true};
  liftItem();moveHeld(e?.clientX||drag.x,e?.clientY||drag.y);
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
  if(Story.enabled()){Story.checkCompletion();return;}
  $('sortingReward')?.remove();
  const panel=document.createElement('div');panel.id='sortingReward';panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');
  panel.innerHTML='<strong>Поздравляем, вы правильно отсортировали!</strong><b>+10 монет</b>';
  $('effects').append(panel);gainGold(10,panel.querySelector('b'));setTimeout(()=>panel.remove(),1500);updateHud();
}
function wrong(message,el){state.dayErrors++;state.combo=0;toast(message);beep(true);el?.classList.add('shake');setTimeout(()=>el?.classList.remove('shake'),280);save();}
function sortItem(uid,cat){
  if(state.paused||state.autoSorting||BagPour.active())return;
  const list=state.inspectCat==='junk'?state.junk:state.bag;const i=list.findIndex(x=>x.uid===uid);if(i<0)return;
  if(isUnknown(list[i])){openUnknown(list[i]);return;}
  const x=list[i],it=items[x.type];if(it.cat!==cat){wrong(`«${it.name}» — ${categories[it.cat].name.toLowerCase()}. Попробуйте другую коробку.`,document.querySelector(`[data-cat="${cat}"]`));return;}
  list.splice(i,1);x.boxPos={x:Math.random()*.8,y:Math.floor(stockFor(cat).length/5)*76};state.stock.push(x);state.daySorted++;state.combo++;state.selected=null;beep();
  rewardSortedItem(x.uid);
  if(state.inspectCat==='junk'){renderInspection();renderShelves();renderTarget();}else renderWork();save();
}
function packItem(uid){
  if(state.paused||!orderAccepted())return;const i=state.stock.findIndex(x=>x.uid===uid);if(i<0)return;const x=state.stock[i];
  if(Story.enabled()&&!Goblin.canUse(uid,state.order.id)){toast('Этот экземпляр зарезервирован другой посылке. Договорённость можно вернуть себе в книге.');return;}
  if(isUnknown(x)){openUnknown(x);return;}
  const line=state.order.recipe.find(r=>r.type===x.type&&remaining(r)>0);if(!line){wrong('Эта вещь сейчас не нужна. Она остаётся в коробке.',$('parcelDrop'));return;}
  state.stock.splice(i,1);state.order.packed.push(x);if(Story.enabled())Goblin.reconcile();if(orderComplete()){state.activeCat=null;state.inspectCat=null;hidden('inspector',true);hidden('targetPreview',true);}const scroll=$('sourceScroll')?.scrollTop||0;renderWork();if($('sourceScroll'))$('sourceScroll').scrollTop=scroll;revealSourceContents();beep();save();
}
function renderOrderBoard(){
  const board=$('orderBoard');if(!board)return;
  const list=allOrders().filter(o=>o.accepted!==false&&(!Story.enabled()||!o.regularKey));board.innerHTML='';
  board.classList.toggle('work-orders',state.screen==='work');
  hidden('orderBoard',!list.length||!state.started);
  for(const o of list.slice(0,4)){
    const total=o.recipe.reduce((n,r)=>n+r.count,0),card=document.createElement('article');board.append(card);card.className='order-card';card.dataset.orderId=o.id;
    card.tabIndex=0;card.setAttribute('aria-label',(o.title||'Посылка')+' · '+customers[o.customer][0]);card.onclick=()=>openOrder(o);card.onkeydown=e=>{if(e.target===card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openOrder(o);}};
    const automated=Story.enabled()&&Goblin.isAssigned(o);card.classList.toggle('goblin-order',automated);
    card.innerHTML=parcelContents(o);
    renderParcelActions(card,o);
  }
}
function showOrders(){
  if(!state.started||state.paused||state.autoSorting)return;
  modal('',{wide:true,activity:'background',kind:'orders'});
}
function renderOrdersBook(){
  const list=allOrders().filter(o=>o.accepted!==false);
  $('modalContent').innerHTML='<h2>Мои поручения · '+list.length+'</h2><div class="quest-book">'+(!list.length?'<p>Примите поручение у посетителя, когда подойдёт его очередь.</p>':'')+'</div>';
  for(const o of list){const article=document.createElement('article');article.className='quest-sheet';article.dataset.acceptedOrder=o.id;article.innerHTML=parcelContents(o);$('modalContent').querySelector('.quest-book').append(article);renderParcelActions(article,o);}
}
function openOrder(candidate){if(!state.started||state.paused||state.autoSorting)return;
  const head=counterGuest();
  const o=candidate?.recipe?candidate:(head?.kind==='order'?head.value:allOrders().find(o=>o.accepted!==false));
  if(!o){toast('Новый заказ появится после покупки следующего мешка.');return;}
  if(o.accepted===false&&(head?.kind!=='order'||head.value!==o)){toast('Этот посетитель ждёт своей очереди.');return;}
  if(o.accepted!==false){state.order=o;if(Story.enabled())Goblin.reconcile();setScreen('work','order');save();return;}
  setScreen('reception','sort');
  const c=customers[o.customer],accepted=o.accepted!==false;
  modal(`<div class="brief-eyebrow">ПОРУЧЕНИЕ</div><h2>${c[0]}</h2><p>${c[1]}</p>${o.title?`<h3>${o.title}</h3>`:""}${o.description?`<p>${o.description}</p>`:""}<div class="brief-list">${o.recipe.map(r=>{const packed=o.packed.filter(x=>x.type===r.type).length;return `<div><img src="${asset(items[r.type].sprite)}" alt="${items[r.type].name}"><span>${items[r.type].name}<small>На складе: ${state.stock.filter(x=>x.type===r.type).length}</small></span><b>${packed}/${r.count}</b></div>`;}).join('')}</div><p>Оплата: <b>${o.reward} монет</b></p><button id="${accepted?'beginAssembly':'acceptOrder'}" class="primary">${accepted?'Начать собирать':'Принять поручение'}</button>`,{brief:true});
  if(accepted)$('beginAssembly').onclick=()=>{state.order=o;closeModal();setScreen('work','order');};
  else $('acceptOrder').onclick=()=>{if(counterGuest()?.value!==o)return;if(allOrders().filter(x=>x.accepted!==false).length>=4){toast('Уже приняты 4 поручения. Сначала выдайте одну посылку.');return;}o.accepted=true;state.order=o;startVisitorGap('order');if(Story.enabled())Story.onOrderAccepted();closeModal();render();save();$('orderBoard').querySelector('button')?.focus();};
}
function finishOrder(){
  if(state.paused||!orderAccepted()||!orderComplete()||state.activeCat!==null)return;
  if(Story.enabled()&&Goblin.isAssigned(state.order))return;
  const delivered=state.order,amount=delivered.reward,oldRank=rank(),receipt=parcelReceipt(document.querySelector('[data-order-id="'+delivered.id+'"]'));state.rep+=4;state.totalOrders++;state.dayOrders++;
  state.orders=allOrders().filter(o=>o!==state.order);state.order=state.orders[0]||null;
  state.gold+=amount;state.dayIncome+=amount;
  if(Story.enabled())Story.onOrderDelivered(delivered,'manual');
  updateParcelReceipt(receipt,delivered);
  setScreen('reception');beep();
  showOrderReward(amount,rank()>oldRank);
  animateGold(amount,$('orderReward').querySelector('strong'));
  save();
}
function requestEndDay(){
  if(state.ended){showSummary();return;}
  if(state.paused||state.bag.length||state.schedule.length||state.offers.length||state.orderSchedule?.length||state.nextBagOrder)return;
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
  if(e.button!==0||state.paused||state.autoSorting||BagPour.active())return;
  if(state.inspectCat!==null&&!['inspect','junk','target'].includes(kind))return;
  if(Story.enabled())Dwarf.release(x.uid);
  const r=node.getBoundingClientRect();drag={uid:x.uid,item:x,node,kind,x:e.clientX,y:e.clientY,grabX:(e.clientX-r.left)/scale,grabY:(e.clientY-r.top)/scale,active:false};node.setPointerCapture(e.pointerId);
}
function cancelDrag(){if(drag){drag.ghost?.remove();drag.node.style.opacity='';drag=null;state.selected=null;}$('heldRecognize')?.remove();}
function showHeldRecognition(item,node){
  $('heldRecognize')?.remove();
  const action=button(document.body,'Распознать предмет в руках',()=>openUnknown(item),'heldRecognize');action.className='primary';action.sourceNode=node;
  positionRecognition(node);
}
function positionRecognition(node){
  const action=$('heldRecognize');if(!action||!node?.isConnected)return;
  const r=node.getBoundingClientRect();
  action.style.left=Math.max(8,Math.min(innerWidth-action.offsetWidth-8,r.left+r.width/2-action.offsetWidth/2))+'px';
  action.style.top=Math.min(innerHeight-action.offsetHeight-8,r.bottom+6)+'px';
}
function liftItem(){drag.active=true;drag.ghost=drag.node.cloneNode(true);drag.ghost.removeAttribute('id');drag.ghost.classList.add('dragging');drag.ghost.classList.remove('chosen');drag.ghost.style.opacity='1';drag.ghost.style.transform='none';drag.ghost.style.width=drag.node.getBoundingClientRect().width+'px';drag.ghost.style.height=drag.node.getBoundingClientRect().height+'px';document.body.append(drag.ghost);drag.node.style.opacity='0';hidden('tooltip',true);}
function moveHeld(x,y){
  const action=$('heldRecognize');
  if(action&&drag.clickHeld){const a=action.getBoundingClientRect(),g=drag.ghost.getBoundingClientRect();if(x>=a.left-8&&x<=a.right+8&&y>=g.top+g.height/2+6&&y<=a.bottom+8)return;}
  drag.ghost.style.left=x-drag.grabX*scale+'px';drag.ghost.style.top=y-drag.grabY*scale+'px';positionRecognition(drag.ghost);
}
function inside(el,x,y){if(!el)return false;const r=el.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;}
addEventListener('pointermove',e=>{
  if(!drag)return;if(!drag.active&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6)return;
  if(!drag.active)liftItem();
  moveHeld(e.clientX,e.clientY);
  const scroll=drag.kind==='table'?null:drag.node.parentElement.parentElement;
  if(scroll&&inside(scroll,e.clientX,e.clientY)){const r=scroll.getBoundingClientRect();if(e.clientY>r.bottom-20*scale)scroll.scrollTop+=10;if(e.clientY<r.top+20*scale)scroll.scrollTop-=10;}
});
function dropHeld(e){
  if(!drag)return;const d=drag;drag=null;if(!d.active)return;d.ghost.remove();d.node.style.opacity='';$('heldRecognize')?.remove();state.selected=null;suppressDropClick=true;if(state.paused)return;
  if(d.kind==='table'||d.kind==='junk'){
    if(d.kind==='table'&&state.upgrade&&inside($('junkShelf'),e.clientX,e.clientY)){state.bag=state.bag.filter(x=>x.uid!==d.uid);state.junk.push(d.item);state.selected=null;renderWork();save();return;}
    for(const box of $('shelves').querySelectorAll('[data-cat]'))if(inside(box,e.clientX,e.clientY)){sortItem(d.uid,Number(box.dataset.cat));return;}
    if(d.kind==='junk'&&inside($('targetPreview'),e.clientX,e.clientY)){sortItem(d.uid,state.targetCat);return;}
  }
  if(d.kind==='source'&&inside($('parcelDrop'),e.clientX,e.clientY)){packItem(d.uid);return;}
  const area=d.node.parentElement,pane=d.kind==='table'?area:area.parentElement;
  if(inside(pane,e.clientX,e.clientY)){
    const r=area.getBoundingClientRect(),size=d.node.offsetWidth||(d.kind==='table'?79:60);
    const pos={x:Math.max(0,Math.min(1,((e.clientX-r.left)/scale-d.grabX-10)/Math.max(1,area.clientWidth-size-20))),y:0};
    if(d.kind==='table')pos.y=Math.max(0,Math.min(1,((e.clientY-r.top)/scale-d.grabY-10)/Math.max(1,area.clientHeight-size-20)));
    else pos.y=Math.max(8,Math.min(area.clientHeight-size-12,(e.clientY-r.top)/scale-d.grabY));
    d.item[itemPositionKey(d.kind)]=pos;d.item.depth=++depth;state.selected=null;
    const scrollTop=pane.scrollTop,paneId=pane.id;
    if(state.inspectCat!==null){renderInspection();renderTarget();}else renderWork();
    if($(paneId))$(paneId).scrollTop=scrollTop;save();
    if(isUnknown(d.item))showHeldRecognition(d.item,document.querySelector(`.item[data-uid="${d.uid}"][data-kind="${d.kind}"]`));
  }else toast('Вещь осталась на прежнем месте.');
}
addEventListener('pointerup',e=>{if(!drag?.clickHeld||drag.dropOnRelease)dropHeld(e);});
addEventListener('pointerdown',e=>{
  suppressDropClick=false;
  if(!e.target.closest('#heldRecognize')&&!drag?.clickHeld)$('heldRecognize')?.remove();
  if(!drag?.clickHeld||e.button!==0)return;
  if(e.target.closest('#heldRecognize'))return;
  if(e.target.closest('#pile,#shelves,#inspectItems,#sourceItems,#targetItems,#parcelDrop,#targetPreview')){e.preventDefault();e.stopImmediatePropagation();drag.dropOnRelease=true;}
  else cancelDrag();
},true);
addEventListener('pointercancel',cancelDrag);
addEventListener('click',e=>{if(suppressDropClick&&e.detail!==0){suppressDropClick=false;e.preventDefault();e.stopImmediatePropagation();}},true);

const UPGRADE_DEFS=[
 {key:'upgrade',name:'Сундук диковинок',art:'chest',price:20,description:'Одной кнопкой убрать весь хлам со стола в сундук. Разобрать можно позже.'},
 {key:'bigBagChance',name:'Большие поставки',art:'bag-premium',price:30,description:'С дня 2: +5% к шансу большого мешка за 20 монет. Одна покупка.'},
 {key:'bagCapacity',name:'Вместительные мешки',art:'bag',price:25,description:'+2 предмета в будущих мешках, включая ещё не пришедших посетителей.'},
 {key:'orderBonus',name:'Доброе имя',art:'ledger',price:30,description:'+5 монет за каждое новое поручение после покупки.'}
];
function openUpgrade(){
 if(Story.enabled()){Story.showBusiness();return;}
 if(!state.started||state.paused)return;
 if(state.day>1||state.ended){state.upgradeHintSeen=true;updateHud();save();}
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
  if(state.paused||state.autoSorting||BagPour.active()||!isUnknown(x))return;
  openCleaning(x.type,x);
}
function recognizeItem(type,instance){
  const newlyKnown=!state.collection.includes(type),wasUnknown=instance&&isUnknown(instance);
  if(!newlyKnown&&!wasUnknown)return;
  if(wasUnknown)instance.unknown=false;
  if(newlyKnown){state.collection.push(type);state.rep+=1;}
  const reward=(newlyKnown?5:0)+(wasUnknown?7:0);
  const status=$('cleanStatus');if(status){status.classList.add('recognition-result');status.innerHTML=`<strong>Вы распознали: ${items[type].name}</strong><span id="recognitionGold">+${reward} монет</span><span>+${newlyKnown?1:0} репутация</span>`;}
  if(reward)gainGold(reward,$('recognitionGold')||status);
  if(Story.enabled())Story.afterRecognition(instance);
  save();return {newlyKnown,wasUnknown,reward};
}
function openCollection(){
  if(!state.started||state.paused)return;
  modal('',{wide:true,activity:'background',kind:'collection'});
}
function renderCollection(){
  const available=new Set(owned().map(x=>x.type));
  $('modalContent').innerHTML=`<img class="collection-ledger" src="assets/storage/ledger.png" alt=""><h2>Атлас находок</h2><p>Распознано ${state.collection.length} / ${items.length}. Изучение: +1 репутация и +5 монет.<br>Раскрытие неизвестной находки: ещё +7 монет. Товар остаётся у вас.</p><div class="collection-grid">${items.map(it=>{const known=state.collection.includes(it.id),secret=mysteryType(it.id)&&!known;return `<button class="collection-item ${known?'known':''} ${secret?'mystery-item':''}" data-type="${it.id}" ${available.has(it.id)?'':'disabled'}><img src="${asset(it.sprite)}" alt="${known?it.name:'Неизученная находка'}">${secret?'<i class="mystery-question">?</i>':''}<span>${known?it.name:'Название неизвестно'}</span><small>${known?'✓ Распознано':available.has(it.id)?'Изучить':'Нет в запасах'}</small></button>`;}).join('')}</div>`;
  $('modalContent').querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>openCleaning(Number(b.dataset.type)));
}
function refreshBackgroundDialog(){
  if(!modalIsOpen()||$('modal').dataset.activity!=='background')return;
  const collection=$('modal').classList.contains('collection-dialog'),orders=$('modal').classList.contains('orders-dialog');
  if(!collection&&!orders)return;
  const signature=collection?JSON.stringify([state.collection,[...new Set(owned().map(x=>x.type))].sort((a,b)=>a-b)]):JSON.stringify(allOrders().filter(o=>o.accepted!==false).map(o=>[o.id,o.reward,o.packed.map(x=>x.uid),o.assignedTo,o.fulfillmentReady,state.goblin?.enabled,state.goblin?.hired,Automation.enabled()]));
  if(backgroundDialogSignature===signature)return;
  backgroundDialogSignature=signature;
  const content=$('modalContent'),scroll=content.scrollTop,focus=document.activeElement;
  const orderId=focus.closest?.('[data-accepted-order]')?.dataset.acceptedOrder;
  const selector=focus.id?'#'+CSS.escape(focus.id):focus.dataset.type?'[data-type="'+focus.dataset.type+'"]':orderId&&focus.dataset.parcelAction?'[data-accepted-order="'+orderId+'"] [data-parcel-action="'+focus.dataset.parcelAction+'"]':null;
  if(collection)renderCollection();else renderOrdersBook();
  content.scrollTop=scroll;
  if(!focus.isConnected){const next=selector&&content.querySelector(selector);(next||$('closeModal')).focus({preventScroll:true});}
}
function openCleaning(type,instance=owned().find(x=>x.type===type&&isUnknown(x))||owned().find(x=>x.type===type)){
  if(!instance||!owned().some(x=>x.uid===instance.uid)){toast('Этой находки уже нет в запасах лавки.');return;}
  const it=items[type],done=state.collection.includes(type);
  modal(`<h2 id="recognitionTitle">${done?it.name:'Изучение находки'}</h2><p>${done?'Вы распознали эту находку и записали её название в атлас.':'Зажмите левую кнопку мыши и водите по предмету, чтобы стереть налёт. Или нажимайте «Распознать».'}</p><div class="clean-stage"><img src="${asset(it.sprite)}" alt="${done?it.name:'Неизученная находка'}"><canvas id="dirt" width="360" height="270" aria-label="Стирайте налёт с находки"></canvas></div><div class="clean-meter"><i id="cleanBar" style="width:${done?100:0}%"></i></div><p id="cleanStatus">${done?'✓ Распознано: '+it.name:'Очищено 0%'}</p><div class="modal-actions recognition-actions"><button id="cleanKey" class="primary" title="Очистить следующий участок предмета">Распознать</button><button id="stashUnknown" ${!instance||!isUnknown(instance)||!state.upgrade||state.junk.includes(instance)?'disabled':''}>Отложить в Диковинки</button><button id="backCollection">К коллекции</button></div>`,{activity:'background',kind:'recognition'});
  recognitionSubjectUid=instance.uid;
  const canvas=$('dirt'),ctx=canvas.getContext('2d',{willReadFrequently:true});let down=false,complete=done,strokes=0;
  modalCleanup=()=>{recognitionFeedback=null;recognitionSubjectUid=null;};
  if(!done){ctx.fillStyle='#736650';ctx.fillRect(0,0,360,270);for(let i=0;i<150;i++){ctx.fillStyle=i%2?'#8f7d60':'#5d513f';ctx.beginPath();ctx.arc(Math.random()*360,Math.random()*270,rand(1,5),0,7);ctx.fill();}}
  function check(){if(complete)return;const data=ctx.getImageData(0,0,360,270).data;let clear=0;for(let i=3;i<data.length;i+=16)if(data[i]<50)clear++;const pct=Math.round(clear/(data.length/16)*100);$('cleanBar').style.width=pct+'%';$('cleanStatus').textContent=`Очищено ${pct}%`;if(pct>=85){complete=true;ctx.clearRect(0,0,360,270);recognizeItem(type,instance);$('cleanBar').style.width='100%';$('recognitionTitle').textContent=it.name;$('cleanKey').disabled=true;$('cleanKey').textContent='Распознано';$('stashUnknown').disabled=true;$('backCollection').classList.add('hidden');recognitionFeedback={elapsed:0,title:$('recognitionTitle')};render();if(state.inspectCat!==null)renderInspection();save();beep();}}
  function erase(x,y){if(complete)return;ctx.globalCompositeOperation='destination-out';ctx.beginPath();ctx.arc(x,y,33,0,Math.PI*2);ctx.fill();check();}
  function point(e){const r=canvas.getBoundingClientRect();erase((e.clientX-r.left)/r.width*360,(e.clientY-r.top)/r.height*270);}
  canvas.onpointerdown=e=>{down=true;canvas.setPointerCapture(e.pointerId);point(e);};canvas.onpointermove=e=>{if(down)point(e);};canvas.onpointerup=canvas.onpointercancel=()=>down=false;
  $('cleanKey').disabled=done;if(done)$('cleanKey').textContent='Распознано';$('cleanKey').onclick=()=>{erase(20+(strokes%8)*45,20+Math.floor(strokes/8)*45);strokes++;};
  $('stashUnknown').onclick=()=>{if(!instance||!isUnknown(instance)||!state.upgrade||state.junk.includes(instance))return;state.bag=state.bag.filter(x=>x!==instance);state.stock=state.stock.filter(x=>x!==instance);if(state.unknownTray)state.unknownTray=state.unknownTray.filter(x=>x!==instance);delete instance.boxPos;state.junk.push(instance);closeModal();render();if(state.inspectCat!==null)renderInspection();save();};
  $('backCollection').onclick=()=>{closeModal();openCollection();};
}
function openRanks(){if(state.paused)return;modal(`<h2>Имя вашей лавки</h2><p>Репутация: ${state.rep}. За выданный заказ +4.<br>В этой истории доступны первые три ранга.</p><div class="rank-list">${rankNames.map((name,i)=>`<div class="rank-row ${i===rank()?'current':''} ${i>2?'locked':''}"><span>${i+1}. ${name}</span><span>${i>2?'🔒 позже':i===rank()?'Ваш ранг':i<rank()?'✓':i*12+' реп.'}</span></div>`).join('')}</div>`,{activity:'background',kind:'book'});}
function showGoldAd(){
  if(!state.started||state.paused||state.autoSorting||state.ended||!state.goldAdUnlocked)return;
  modal('<h2>Пополнить казну · +15 монет</h2><p>Тестовый просмотр рекламы · 2 секунды.<br>Настоящая реклама пока не подключена.</p><button id="claimAdGold" class="primary" disabled>Просмотр…</button>');
  let ready=false,claimed=false;
  const timer=setTimeout(()=>{ready=true;if($('claimAdGold')){$('claimAdGold').disabled=false;$('claimAdGold').textContent='Получить 15 монет';}},2000);
  modalCleanup=()=>clearTimeout(timer);
  $('claimAdGold').onclick=()=>{if(!ready||claimed)return;claimed=true;gainGold(15,$('claimAdGold'));closeModal();render();save();toast('За просмотр рекламы: +15 монет');};
}
async function autoSort(){
  if(Story.enabled()&&state.dwarf?.hired){if(state.paused||state.autoSorting||BagPour.active())return;Dwarf.setEnabled(true);setScreen('work','sort');toast('Борин разбирает по одной вещи за 2,5 секунды.');save();return;}
  if(!state.started||state.paused||state.ended||state.autoSorting||BagPour.active()||state.tutorial?.active||state.screen!=='work'||state.mode!=='sort'||!state.bag.length)return;
  cancelDrag();state.autoSorting=true;renderWork();lockBackground(true);
  try{
    const queue=state.bag.filter(x=>!isUnknown(x));
    for(let i=queue.length-1;i>0;i--){const j=rand(0,i);[queue[i],queue[j]]=[queue[j],queue[i]];}
    for(const x of queue){
      if(Story.enabled())Dwarf.release(x.uid);
      const cat=items[x.type].cat;
      await flyToShelf(x,cat);
      const index=state.bag.findIndex(item=>item.uid===x.uid);if(index<0)continue;
      state.bag.splice(index,1);x.boxPos={x:Math.random()*.8,y:Math.floor(stockFor(cat).length/5)*76};
      state.stock.push(x);state.daySorted++;rewardSortedItem(x.uid);renderWork();save();
      const shelf=$('shelves').querySelector(`[data-cat="${cat}"]`);shelf?.classList.add('sort-received');
      setTimeout(()=>shelf?.classList.remove('sort-received'),250);
      await new Promise(resolve=>setTimeout(resolve,rand(35,80)/2));
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
    ],{duration:reduced?20:rand(325,425)/2,easing:'cubic-bezier(.3,0,.25,1)',fill:'forwards'});
    await animation.finished;
  }finally{ghost.remove();source.style.opacity='';}
}
function hasSave(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY));return s?.version===1&&s.started;}catch{return false;}}
function loadGame(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY));if(s?.version!==1||!Array.isArray(s.stock)||!Array.isArray(s.bag))return;BagPour.afterLoad();City.close();state={...freshState(),...s,paused:false,autoSorting:false,selected:null,inspectCat:null,activeCat:null};const repaired=repairTableLayout(state.bag);restoreOrders();depth=Math.max(100,...owned().map(x=>x.depth||0));render();if(Story.enabled())Story.afterLoad();else if(state.ended)showSummary();if(repaired)save();}catch{toast('Не удалось прочитать сохранение. Можно начать заново.');}}
function help(){if(state.paused)return;modal('<h2>Как работает лавка</h2><div class="rules"><b>Закупка.</b> Купите мешок за 10 монет. Содержимое заранее неизвестно.<br><b>Порядок.</b> Перетаскивайте вещи на полки. Или нажмите вещь, затем коробку. Ошибка подскажет категорию.<br><b>Заказ.</b> Листок справа. Недостающее появится в новых мешках. Откройте коробку и отправляйте нужное в посылку.<br><b>Диковинки.</b> За 20 монет купите временную коробку и убирайте остаток мешка одним действием.<br><b>Атлас.</b> Очистите находку и сохраните её изображение. Товар остаётся для продажи.<br><b>Вечер.</b> Новые приходы прекращаются; закончите дела и нажмите «Закончить день».<br><b>Фоновая работа.</b> Распознавание, коллекция, книги и карта не останавливают включённых помощников. Пауза, настройки, скрытая вкладка, сюжетный выбор и утренний ремонт останавливают торговлю. Автоприёмка покупает мешки и принимает обычные посылки после основания гильдии и её включения.</div>',{activity:'background',kind:'book'});}

function setup(){
  const sky=document.createElement('div');sky.id='daylight';sky.setAttribute('aria-hidden','true');sky.innerHTML='<i class="sky-morning"></i><i class="sky-day"></i><i class="sky-evening"></i><i class="sky-night"></i>';$('game').querySelector(':scope > header').prepend(sky);
  hidden('tooltip',true);$('tooltip').setAttribute('role','tooltip');
  const board=document.createElement('aside');board.id='orderBoard';board.className='hidden';board.setAttribute('aria-label','Принятые поручения');$('game').append(board);
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
  button(startActions,'Начать сначала с обучением',restartWithTutorial,'restartStartTutorial');
  button($('reception'),'Начать сначала с обучением',restartWithTutorial,'restartTutorial');
  const arrival=document.createElement('button');arrival.id='arrivalSignal';arrival.onclick=()=>{if(state.autoSorting)return;forceCloseModal();setScreen('reception');};$('game').append(arrival);
  const sweepButton=document.createElement('button');sweepButton.id='sweepButton';sweepButton.textContent='Убрать всё в Диковинки';sweepButton.onclick=sweep;$('work').append(sweepButton);
  const goldAd=button($('work'),'▶ Посмотреть рекламу · +15 монет',showGoldAd,'goldAdButton');goldAd.className='gold';
  $('autoSortButton').parentElement.insertBefore(goldAd,$('autoSortButton'));
  const receptionGoldAd=button($('reception'),'▶ Посмотреть рекламу · +15 монет',showGoldAd,'receptionGoldAd');receptionGoldAd.className='gold hidden';
  const target=document.createElement('section');target.id='targetPreview';target.className='hidden';$('work').append(target);
  const tidyInspector=button($('closeInspector').parentElement,'Сортировать ящик',()=>arrangeBox($('inspectItems'),state.inspectCat==='junk'?state.junk:stockFor(state.inspectCat),state.inspectCat==='junk'?'junk':'inspect'),'tidyInspector');tidyInspector.className='tidy-box';
  const note=document.createElement('div');note.className='portrait-note';note.textContent='Поверните телефон горизонтально — так удобнее раскладывать находки.';document.body.append(note);
  $('back').onclick=()=>setScreen('reception');$('bag').onclick=buyBag;$('parcel').onclick=openOrder;$('closeInspector').onclick=closeInspection;
  $('closeModal').onclick=closeModal;$('autoSortButton').onclick=autoSort;$('ordersNav').onclick=showOrders;$('help').onclick=help;
  const upgrades=document.querySelector('[data-lock="Расширение склада"]');upgrades.id='upgradesNav';upgrades.textContent='Улучшения';upgrades.onclick=openUpgrade;
  const collection=document.querySelector('[data-lock="Магический сканер"]');collection.textContent='Коллекция';collection.onclick=openCollection;
  const r=document.querySelector('.rep');r.tabIndex=0;r.setAttribute('role','button');r.setAttribute('aria-label','Посмотреть ранги репутации');r.onclick=openRanks;r.onkeydown=e=>{if(e.key==='Enter')openRanks();};
  $('sound').onclick=()=>{state.muted=!state.muted;beep();updateHud();save();};
  $('settings').onclick=openSettings;
  $('pause').onclick=()=>{if(state.paused||!state.started)return;modal('<h2>Лавка на паузе</h2><p>Часы остановлены. Все находки на своих местах.</p><button id="resume" class="primary">Продолжить</button>');$('resume').onclick=closeModal;};
  Story.setup();City.setup();if(typeof Guild!=='undefined')Guild.setup();if(typeof Tower!=='undefined')Tower.setup();
  const rail=document.createElement('section');rail.id='taskRail';rail.className='hidden';rail.setAttribute('aria-label','Поручения и договорённости');
  const heading=document.createElement('div');heading.className='task-rail-heading';heading.append($('ordersNav'));rail.append(heading);
  const letters=document.createElement('div');letters.className='task-letters';letters.append($('orderBoard'),$('contractOfferBoard'));rail.append(letters);$('game').append(rail);
  $('game').querySelector(':scope > header').insertBefore($('ordersNav'),$('game').querySelector(':scope > header .day'));
  const prev=button(rail,'⌃',()=>pageTasks(-1),'taskPrev');prev.setAttribute('aria-label','Предыдущие поручения');
  const next=button(rail,'⌄',()=>pageTasks(1),'taskNext');next.setAttribute('aria-label','Следующие поручения');
  const page=document.createElement('span');page.id='taskPageStatus';rail.append(page);letters.addEventListener('scroll',updateTaskPager);
  const layoutObserver=new ResizeObserver(scheduleLayout);[rail,$('game').querySelector(':scope > header'),$('game').querySelector(':scope > footer'),$('work').querySelector('.work-heading'),$('shelves'),$('table')].forEach(el=>layoutObserver.observe(el));
}
addEventListener('keydown',e=>{
  if(!$('modal').classList.contains('hidden')){
    if(e.key==='Escape'){e.preventDefault();closeModal();}
    if(e.key==='Tab'){const buttons=[...$('modal').querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter(b=>!b.hidden&&!b.classList.contains('hidden')&&b.getClientRects().length);const first=buttons[0],end=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();end?.focus();}else if(!e.shiftKey&&document.activeElement===end){e.preventDefault();first?.focus();}}
    return;
  }
  if(state.autoSorting)return;
  if(e.key==='Escape'){if(drag){cancelDrag();return;}if(state.inspectCat!==null)closeInspection();else if(state.selected!==null){state.selected=null;renderWork();}else if(state.activeCat!==null){state.activeCat=null;renderWork();}else if(state.screen==='work')setScreen('reception');}
});
document.addEventListener('visibilitychange',()=>{last=performance.now();save();});addEventListener('pagehide',save);addEventListener('resize',()=>{resize();positionRecognition(drag?.ghost||$('heldRecognize')?.sourceNode);});
function tick(now){
  const dt=Math.min(1,Math.max(0,(now-last)/1000));last=now;advanceRecognitionFeedback(dt);
  if(state.started&&!state.paused&&!state.ended&&!state.autoSorting&&!document.hidden){
    if(BagPour.active())BagPour.advance(dt);
    else if(Story.enabled())Story.advance(dt);
    else if(!state.tutorial?.active){state.seconds=Math.max(0,state.seconds-dt*(state.screen==='work'?CONFIG.workTimeRate:1));advanceVisitorGap(dt);tickArrivals();advanceReadyVisitor(dt);}
    updateHud();saveClock+=dt;if(saveClock>=5){saveClock=0;save();}
  }
  tutorialFrame();
}

setup();resize();render();
// Phaser is the sole frame owner. Save data contains plain simulation values,
// never sprites, textures or scenes. The renderer sees one explicit bridge.
window.LootkeeperBridge={step:tick,read:()=>state,actions:{
  openOrder,openGoblinParcel,setScreen,buyBag,selectBox,packItem,sortItem,
  openCity:()=>City.open(),openReception:()=>{City.close();setScreen('reception');},
  openBorin:()=>{City.close();setScreen('work','sort');},claimParcel,
  counterGuest:()=>counterGuest(),cancelDrag,
  beginItemPointer:(event,node,uid,kind)=>{const x=owned().find(x=>x.uid===uid);if(x)pointerDown(event,x,node,kind);},
  activateWorldControl:(id,event)=>document.getElementById(id)?.onclick?.(event)
}};
