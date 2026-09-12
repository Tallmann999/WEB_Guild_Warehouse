'use strict';

// A small local playtest, using the original v5 art and scenes.
const CONFIG = {days:5, daySeconds:180, workTimeRate:0.5, startingGold:80, bagPrice:10, upgradePrice:20};
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
function stockFor(cat){return state.stock.filter(x=>items[x.type].cat===cat);}
function owned(){return [...state.stock,...state.junk,...state.bag,...(state.order?.packed||[])];}
function countType(type){return owned().filter(x=>x.type===type).length;}
function remaining(r){return r.count-(state.order?.packed.filter(x=>x.type===r.type).length||0);}
function orderComplete(){return !!state.order&&state.order.recipe.every(r=>remaining(r)===0);}
function save(){if(!state.started)return;try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));}catch{}}
function resize(){scale=Math.min(innerWidth/1280,innerHeight/800);$('game').style.transform=`translate(-50%,-50%) scale(${scale})`;}
function beep(bad=false){if(state.muted)return;try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();audioContext.resume();const o=audioContext.createOscillator(),g=audioContext.createGain();o.connect(g);g.connect(audioContext.destination);o.frequency.value=bad?150:560;g.gain.setValueAtTime(.035,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.12);o.start();o.stop(audioContext.currentTime+.13);}catch{}}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2500);}
function showOrderReward(amount,promoted){
  $('orderReward')?.remove();
  const panel=document.createElement('div');panel.id='orderReward';panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');
  panel.innerHTML=`<span>Заказ выполнен</span><strong>Золото получено: +${amount}</strong><strong>Репутация повышена: +4</strong>${promoted?`<b>Новый ранг: ${rankNames[rank()]}</b>`:''}`;
  $('effects').append(panel);setTimeout(()=>panel.remove(),4500);
}
function hidden(id,value){$(id).classList.toggle('hidden',value);}
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
  $('rep').textContent=`${rank()+1}/7 · ${state.rep} реп.`;$('orderBadge').textContent=state.order?'1':'0';
  $('sound').textContent=state.muted?'♫̸':'♫';$('sound').setAttribute('aria-label',state.muted?'Включить звук':'Выключить звук');
  const signal=$('arrivalSignal');signal.textContent=state.offers.length?`♢ У стойки ждут · ${state.offers.length}`:state.seconds===0?'☾ Вечер — можно закончить дела':'К стойке';
  signal.classList.toggle('waiting',!!state.offers.length);
}
function setScreen(screen,mode=state.mode){cancelDrag();state.screen=screen;state.mode=mode;state.activeCat=null;state.inspectCat=null;state.selected=null;hidden('inspector',true);hidden('targetPreview',true);hidden('tooltip',true);render();save();}
function render(){
  const starting=!state.started;
  $('game').classList.toggle('starting',starting);hidden('startScreen',!starting);
  hidden('loadGame',!starting||!hasSave());
  hidden('reception',starting||state.screen!=='reception');hidden('work',starting||state.screen!=='work');
  updateHud();if(!starting)state.screen==='reception'?renderReception():renderWork();
}
function renderReception(){
  const action=$('receptionAction');action.innerHTML='';hidden('speech',false);hidden('bag',true);hidden('parcel',true);hidden('visitor',false);
  if(!state.started)return;
  // Leave the counter empty until the first visitor's scheduled arrival.
  if(state.day===1&&!state.dayBought&&!state.offers.length&&state.schedule[0]?.at===2){
    hidden('speech',true);hidden('visitor',true);$('stepHint').textContent='';return;
  }
  {
    const offer=state.offers[0];
    if(offer){
      const v=adventurers[offer.visitor];$('visitor').src=asset(v[2]);hidden('bag',false);
      $('speech').innerHTML=`<span class="eyebrow">${v[1]}</span><h2>${v[0]}</h2><p>Добыча из похода. Мешок за <b>${CONFIG.bagPrice} монет</b> — внутри кое-что интересное!</p>`;
      button(action,`Купить мешок · ${CONFIG.bagPrice} монет`,buyBag,'buyBag',!!state.bag.length||state.gold<CONFIG.bagPrice).className='primary';
      if(state.bag.length)button(action,'Продолжить разбор на столе',()=>setScreen('work','sort'),'resumeBag');
      $('notice').innerHTML=`<b>Ждут у стойки: ${state.offers.length}</b><br>${state.bag.length?'Сначала освободите стол от прошлого мешка.':'Содержимое узнаете после покупки.'}<br>На складе: ${state.stock.length+state.junk.length} вещей.`;
    }else if(state.order){
      const c=customers[state.order.customer];$('visitor').src=asset(c[2]);hidden('parcel',false);
      $('speech').innerHTML=`<span class="eyebrow">${c[1]}</span><h2>${c[0]}</h2><p>Мой список у вас. Загляните в запасы — или дождитесь следующих находок.</p>`;
      $('notice').innerHTML=`<b>Заказ · ${state.order.reward} монет</b><br>${state.order.recipe.map(r=>`${items[r.type].name} ×${r.count}`).join(' · ')}`;
    }else{
      hidden('visitor',true);$('speech').innerHTML=`<span class="eyebrow">${state.seconds?'ТИХАЯ МИНУТА':'ЛАВКА ЗАКРЫВАЕТСЯ'}</span><h2>${state.seconds?'Всё на своих местах':'Хороший день'}</h2><p>Можно разобрать запасы, очистить находку или посмотреть коллекцию.</p>`;
      $('notice').innerHTML=`<b>На складе: ${state.stock.length+state.junk.length} вещей</b><br>Куплено мешков: ${state.dayBought} · выдано заказов: ${state.dayOrders}`;
    }
    if(state.order)button(action,`Заказ · ${state.order.reward} монет`,openOrder,'receptionOrder');
    if(!state.bag.length||!offer)button(action,'К столу и коробкам',()=>setScreen('work','sort'),'goWork');
    if(state.schedule.length&&!offer)button(action,'Подождать следующего',waitAtWindow,'waitVisitor');
    if(!state.schedule.length&&!state.offers.length)button(action,'Закончить день',requestEndDay,'closeDay',!!state.bag.length);
  }
  $('stepHint').textContent=state.started?'Мешок → ваш порядок → заказы → развитие лавки':'Наведите порядок среди находок и познакомьтесь с гильдией.';
}
function planDay(firstArrival=0){
  state.seconds=CONFIG.daySeconds;state.dayIncome=state.daySpent=state.daySorted=state.dayErrors=state.dayOrders=state.dayBought=0;
  state.schedule=[];state.offers=[];
  const n=rand(3,4),types=pool();
  for(let i=0;i<n;i++)state.schedule.push({at:i===0?firstArrival:Math.round(i*140/(n-1)),visitor:(state.day+i-1)%adventurers.length,loot:Array.from({length:state.day===1?12:14},()=>makeItem(choose(types)))});
  guaranteeOrder();tickArrivals();
}
function startGame(){state=freshState();state.started=true;last=performance.now();planDay(2);render();save();}
function tickArrivals(){
  let changed=false;
  while(state.schedule.length&&state.schedule[0].at<=CONFIG.daySeconds-state.seconds){state.offers.push(state.schedule.shift());changed=true;}
  if(changed){beep();if(state.screen==='work')toast('Кто-то пришёл! Посетитель ждёт у стойки.');else renderReception();save();}
}
function waitAtWindow(){if(state.paused||state.bag.length&&state.offers.length)return;const next=state.schedule[0];if(next){state.seconds=Math.max(0,CONFIG.daySeconds-next.at);tickArrivals();render();}}
function buyBag(){
  if(state.paused||state.bag.length||!state.offers.length||state.gold<CONFIG.bagPrice)return;
  const offer=state.offers.shift();state.gold-=CONFIG.bagPrice;state.daySpent+=CONFIG.bagPrice;state.dayBought++;
  state.bag=offer.loot;state.combo=0;
  for(const x of state.bag)x.tablePos={x:Math.random()*.88,y:Math.random()*.74};
  if(!state.order)createOrder();setScreen('work','sort');beep();toast('Мешок ваш. Разложите находки по коробкам.');
}
function createOrder(){
  const types=[...new Set(owned().map(x=>x.type))];if(!types.length)return;
  for(let i=types.length-1;i>0;i--){const j=rand(0,i);[types[i],types[j]]=[types[j],types[i]];}
  const recipe=types.slice(0,3).map(type=>({type,count:Math.min(2,countType(type))}));
  // Include one coming find while there are supplies still to arrive.
  const future=[...state.offers,...state.schedule];
  if(future.length){const candidates=pool().filter(t=>!recipe.some(r=>r.type===t));const missing=candidates.filter(t=>countType(t)===0);const type=choose(missing.length?missing:candidates);if(type!==undefined)recipe[recipe.length-1]={type,count:Math.min(4,countType(type)+1)};}
  state.order={recipe,packed:[],customer:(state.totalOrders+state.day-1)%customers.length,reward:20+rank()*4,originalReward:20+rank()*4,createdDay:state.day,carried:false};
  guaranteeOrder();
}
function guaranteeOrder(){
  if(!state.order)return;const supplies=[...state.offers,...state.schedule];if(!supplies.length)return;
  for(const r of state.order.recipe){let missing=r.count-countType(r.type)-supplies.reduce((n,s)=>n+s.loot.filter(x=>x.type===r.type).length,0);while(missing-->0)supplies[0].loot.push(makeItem(r.type));}
}
function renderWork(){
  const sort=state.mode==='sort';$('work').classList.toggle('sorting',sort);$('work').classList.toggle('fulfillment',!sort);$('work').classList.toggle('has-note',sort&&!!state.order);
  $('workMode').textContent=sort?'ВАША ЛАВКА · СОРТИРОВКА':'ЗАКАЗ · СБОРКА ПОСЫЛКИ';$('workTitle').textContent=sort?'У каждой находки — своё место':'Найдите вещи в своём складе';
  $('workProgress').textContent=sort?`${state.bag.length} на столе`:`${state.order?.packed.length||0} в посылке`;
  $('pileCaption').textContent=sort?'ДОБЫЧА НА СТОЛЕ':'ПОСЫЛКА И ВАШИ ЗАПАСЫ';$('combo').textContent=state.combo>=3?`${state.combo} подряд`:'';
  $('workHint').textContent=sort?'Перетащите в коробку · или выберите вещь, затем коробку':'Нажмите нужную вещь или перетащите в коробку слева';
  $('stepHint').textContent=sort?'Коробка → осмотр. В коллекции можно очистить находки.':'Список остаётся с вами, пока не соберёте всё необходимое.';
  renderShelves();$('pile').innerHTML='';if(sort)renderItems($('pile'),state.bag,'table');
  $('boxZone').innerHTML='';$('sourceBox').innerHTML='';hidden('sourceBox',true);
  if(!sort){
    $('boxZone').innerHTML='<div class="parcel-title">КОРОБКА ДЛЯ ЗАКАЗА</div><div id="parcelDrop" aria-label="Открытая коробка для заказа"><div id="packedItems"></div></div><span class="parcel-count"></span>';
    for(const x of (state.order?.packed||[])){const im=document.createElement('img');im.src=asset(items[x.type].sprite);im.alt=items[x.type].name;$('packedItems').append(im);}
    $('boxZone').querySelector('.parcel-count').textContent=`${state.order?.packed.length||0} предметов`;
    hidden('sourceBox',false);
    if(state.activeCat===null){$('sourceBox').className='source-placeholder';$('sourceBox').textContent='Откройте нужную коробку на полке';}
    else{$('sourceBox').className='source-open';$('sourceBox').innerHTML=`<div class="source-heading"><div><b>${categories[state.activeCat].name}</b><span>${stockFor(state.activeCat).length} вещей</span></div><button id="closeSource" class="red-close" aria-label="Закрыть коробку">×</button></div><div id="sourceScroll"><div id="sourceItems"></div></div>`;$('closeSource').onclick=()=>{state.activeCat=null;renderWork();};renderItems($('sourceItems'),stockFor(state.activeCat),'source');}
  }
  renderChecklist();hidden('autoSortButton',!sort);$('autoSortButton').disabled=!state.bag.length||state.autoSorting;
  hidden('sweepButton',!sort||!state.upgrade);$('sweepButton').disabled=!state.bag.length;
  hidden('sortingDone',true);updateHud();
}
function renderShelves(){
  $('shelves').innerHTML='';
  categories.forEach((cat,i)=>{
    const b=button($('shelves'),'',()=>selectBox(i));b.className='shelf-box';b.dataset.cat=i;b.setAttribute('aria-label',`${cat.name}: ${stockFor(i).length}`);
    const box=['crate','basket','barrel','weapons'][i];
    b.innerHTML=`<img class="boxart" src="${asset('storage/'+box)}" alt=""><span class="quantity">${stockFor(i).length}</span><span class="tag">${cat.name}</span>`;
  });
  const junk=button($('shelves'),'',()=>state.upgrade?openInspection('junk'):openUpgrade());junk.className='shelf-box'+(state.upgrade?'':' locked');junk.id='junkShelf';junk.innerHTML=`<img class="boxart" src="${asset('storage/chest')}" alt=""><span class="quantity">${state.upgrade?state.junk.length:'🔒'}</span><span class="tag">Диковинки</span>`;
  const rare=button($('shelves'),'',openRanks);rare.className='shelf-box locked';rare.innerHTML=`<img class="boxart" src="${asset('storage/cage')}" alt=""><span class="quantity">🔒</span><span class="tag">Будущее гильдии</span>`;
}
function selectBox(cat){
  if(state.paused||state.autoSorting)return;
  if(state.inspectCat==='junk'){state.targetCat=cat;renderTarget();return;}
  if(state.selected!==null){sortItem(state.selected,cat);return;}
  if(state.mode==='order'){state.activeCat=cat;renderWork();}else openInspection(cat);
}
function renderChecklist(){
  const el=$('checklist');hidden('checklist',!state.order);el.innerHTML='';if(!state.order)return;
  const o=state.order;el.innerHTML=`<h3>${state.mode==='sort'?'Заказ на сегодня':'Положить в коробку'}</h3>`+o.recipe.map(r=>`<div class="check-row ${remaining(r)===0?'done':''}"><span class="checkmark">${remaining(r)===0?'✓':'○'}</span><img src="${asset(items[r.type].sprite)}" alt=""><span class="check-name">${items[r.type].name}</span><b>${r.count-remaining(r)}/${r.count}</b></div>`).join('')+`<div class="dispatch-status">${o.reward} монет${o.carried?' · перенесён':''}</div><div class="note-actions"></div>`;
  const actions=el.querySelector('.note-actions');
  if(state.mode==='sort')button(actions,'Собрать заказ',()=>setScreen('work','order'),'assembleNote');
  else if(orderComplete())button(actions,state.activeCat===null?'Выдать посылку':'Сначала закройте коробку',finishOrder,'ship',state.activeCat!==null).className='primary';
  else button(actions,'Вернуться к сортировке',()=>setScreen('work','sort'),'backSort');
}
function renderItems(area,list,kind){
  if(!list.length){area.innerHTML='<div class="empty-pile">Здесь пока пусто</div>';return;}
  const table=kind==='table',size=table?88:78,width=area.clientWidth||450;
  list.forEach((x,i)=>{
    if(!x.boxPos)x.boxPos={x:(i%5)*.21,y:Math.floor(i/5)*76};
    const pos=table?(x.tablePos||{x:Math.random()*.8,y:Math.random()*.7}):x.boxPos;
    if(table)x.tablePos=pos;
    const b=button(area,'',()=>clickItem(x,kind));b.className='item'+(state.selected===x.uid?' chosen':'');b.dataset.uid=x.uid;b.dataset.kind=kind;
    b.setAttribute('aria-label',items[x.type].name);b.title=items[x.type].name;
    b.innerHTML=`<img src="${asset(items[x.type].sprite)}" alt="${items[x.type].name}" draggable="false">`;
    b.style.left=(10+pos.x*Math.max(1,width-size-20))+'px';b.style.top=(table?10+pos.y*Math.max(1,area.clientHeight-size-20):pos.y)+'px';
    b.style.transform=`rotate(${x.uid%21-10}deg)`;b.style.zIndex=x.depth||i+1;
    b.onpointerdown=e=>pointerDown(e,x,b,kind);
  });
  if(!table)area.style.height=Math.max(280,...list.map(x=>x.boxPos.y+90))+'px';
}
function clickItem(x,kind){
  if(performance.now()<suppressUntil||state.paused||state.autoSorting)return;
  if(state.inspectCat!==null&&kind!=='inspect'&&kind!=='junk')return;
  if(kind==='source'){packItem(x.uid);return;}
  if(kind==='inspect'){toast(`${items[x.type].name} · передвигайте внутри коробки`);return;}
  state.selected=state.selected===x.uid?null:x.uid;
  if(kind==='junk'){renderInspection();toast('Выберите коробку на полке или нажмите «Переложить»');}else renderWork();
}
function wrong(message,el){state.dayErrors++;state.combo=0;toast(message);beep(true);el?.classList.add('shake');setTimeout(()=>el?.classList.remove('shake'),280);save();}
function sortItem(uid,cat){
  if(state.paused||state.autoSorting)return;
  const list=state.inspectCat==='junk'?state.junk:state.bag;const i=list.findIndex(x=>x.uid===uid);if(i<0)return;
  const x=list[i],it=items[x.type];if(it.cat!==cat){wrong(`«${it.name}» — ${categories[it.cat].name.toLowerCase()}. Попробуйте другую коробку.`,document.querySelector(`[data-cat="${cat}"]`));return;}
  list.splice(i,1);x.boxPos={x:Math.random()*.8,y:Math.floor(stockFor(cat).length/5)*76};state.stock.push(x);state.daySorted++;state.combo++;state.selected=null;beep();
  if(state.inspectCat==='junk'){renderInspection();renderShelves();renderTarget();}else renderWork();save();
  if(!state.bag.length&&state.inspectCat===null)toast('Мешок разобран. Можно собрать заказ или вернуться к стойке.');
}
function packItem(uid){
  if(state.paused||!state.order)return;const i=state.stock.findIndex(x=>x.uid===uid);if(i<0)return;const x=state.stock[i];
  const line=state.order.recipe.find(r=>r.type===x.type&&remaining(r)>0);if(!line){wrong('Эта вещь сейчас не нужна. Она остаётся в коробке.',$('parcelDrop'));return;}
  state.stock.splice(i,1);state.order.packed.push(x);const scroll=$('sourceScroll')?.scrollTop||0;renderWork();if($('sourceScroll'))$('sourceScroll').scrollTop=scroll;beep();save();
}
function openOrder(){if(!state.started||state.paused)return;if(!state.order){toast('Новый заказ появится после покупки следующего мешка.');return;}
  const o=state.order,c=customers[o.customer];
  modal(`<div class="brief-eyebrow">ЗАПРОС ГИЛЬДИИ</div><h2>${c[0]}</h2><p>${c[1]}</p><div class="brief-list">${o.recipe.map(r=>`<div><img src="${asset(items[r.type].sprite)}" alt=""><span>${items[r.type].name}</span><b>×${r.count}</b></div>`).join('')}</div><p>Оплата: <b>${o.reward} монет</b><br>Недостающее ищите в следующих мешках.</p><button id="acceptOrder" class="primary">Собрать посылку</button>`,{brief:true});
  $('acceptOrder').onclick=()=>{closeModal();setScreen('work','order');};
}
function finishOrder(){
  if(state.paused||!orderComplete()||state.activeCat!==null)return;
  const amount=state.order.reward,oldRank=rank();state.gold+=amount;state.dayIncome+=amount;state.rep+=4;state.totalOrders++;state.dayOrders++;state.order=null;
  setScreen('reception');beep();save();
  showOrderReward(amount,rank()>oldRank);
}
function requestEndDay(){
  if(state.ended){showSummary();return;}
  if(state.paused||state.bag.length||state.schedule.length||state.offers.length)return;
  const line=state.order?'Незавершённый заказ можно оставить до завтра. Условия переноса выберите ниже.':'Все заказы выданы. Можно отдохнуть.';
  modal(`<h2>Лавка закрывается</h2><p>${line}</p><div class="modal-actions">${state.order?'<button id="finishLater">Вернуться к заказу</button><button id="carryBase">Перенести · 80% оплаты</button><button id="carryBonus">Перенести · без бонуса</button>':'<button id="finishDay" class="primary">Подвести итоги дня</button>'}</div>${state.order?'<p class="rule-note">Для теста: выберите правило переноса.<br>80% оплаты: 20 → 16. Без бонуса: база 20 остаётся 20.<br>Повторный перенос не уменьшает сумму снова.</p>':''}`);
  if(state.order){$('finishLater').onclick=closeModal;$('carryBase').onclick=()=>endDay('discount');$('carryBonus').onclick=()=>endDay('base');}
  else $('finishDay').onclick=()=>endDay('none');
}
function endDay(carryMode){
  if(!state.started||state.ended||state.bag.length)return;
  if(state.order&&!state.order.carried){if(carryMode==='discount')state.order.reward=Math.floor(state.order.originalReward*.8);state.order.carried=true;}
  forceCloseModal();state.seconds=0;state.ended=true;state.screen='reception';render();showSummary();save();
}
function showSummary(){
  const final=state.day===CONFIG.days;
  modal(`<div class="brief-eyebrow">☾ НОЧЬ В ГИЛЬДИИ</div><h2>${final?'Пять дней в вашей лавке':`День ${state.day} завершён`}</h2><p>${final?'Спасибо за игру. Как ощущались сортировка, заказы и новые находки?':'Окно закрыто, находки на полках. Завтра начнётся новая история.'}</p><div class="summary-grid"><div>Выручка<b>${state.dayIncome}</b>монет за день</div><div>Закупки и улучшения<b>${state.daySpent}</b>монет за день</div><div>Заказов за день<b>${state.dayOrders}</b>всего ${state.totalOrders}</div><div>Атлас находок<b>${state.collection.length} / 30</b>${rankNames[rank()]}</div></div><p>В казне ${state.gold} · на складе ${state.stock.length+state.junk.length} вещей${state.order?'<br>Заказ сохранён: '+state.order.reward+' монет':''}</p><button id="nextDay" class="primary">${final?'Сыграть заново':`Открыть лавку · день ${state.day+1}`}</button>${final?'<button id="reviewStock">Посмотреть свой склад</button>':''}`,{locked:true});
  $('nextDay').onclick=()=>{forceCloseModal();if(final){startGame();return;}state.ended=false;state.day++;state.mode='sort';state.screen='reception';state.activeCat=null;state.inspectCat=null;planDay();render();save();};
  if(final)$('reviewStock').onclick=()=>{forceCloseModal();setScreen('work','sort');toast('Пять дней завершены. Можно рассмотреть запасы и коллекцию.');};
}
function openInspection(cat){if(state.paused||state.autoSorting||!state.started)return;state.inspectCat=cat;state.selected=null;hidden('inspector',false);$('inspector').classList.toggle('junk-open',cat==='junk');renderInspection();renderTarget();$('closeInspector').focus();}
function renderInspection(){const cat=state.inspectCat;if(cat===null)return;const list=cat==='junk'?state.junk:stockFor(cat);$('inspectTitle').textContent=`${cat==='junk'?'Диковинки':categories[cat].name} · ${list.length}`;$('inspectItems').innerHTML='';renderItems($('inspectItems'),list,cat==='junk'?'junk':'inspect');$('inspector').querySelector('.inspection-note').textContent=cat==='junk'?'Выберите вещь и перенесите в коробку справа.':'Двигайте вещи · для очистки откройте коллекцию.';}
function renderTarget(){
  const show=state.inspectCat==='junk';hidden('targetPreview',!show);if(!show)return;
  const cat=state.targetCat,area=$('targetPreview');area.innerHTML=`<header><span>${categories[cat].name}</span><button id="moveSelected" style="font-size:14px;padding:7px">Переложить →</button></header><div class="target-items">${stockFor(cat).map(x=>`<img src="${asset(items[x.type].sprite)}" alt="${items[x.type].name}">`).join('')||'<div class="target-empty">Перетащите сюда вещь из «Диковинок». Другую коробку выберите на полке.</div>'}</div>`;
  $('moveSelected').disabled=state.selected===null;$('moveSelected').onclick=()=>sortItem(state.selected,state.targetCat);
}
function closeInspection(){cancelDrag();state.inspectCat=null;state.selected=null;hidden('inspector',true);hidden('targetPreview',true);renderWork();}
function pointerDown(e,x,node,kind){
  if(e.button!==0||state.paused||state.autoSorting)return;
  if(state.inspectCat!==null&&kind!=='inspect'&&kind!=='junk')return;
  const r=node.getBoundingClientRect();drag={uid:x.uid,item:x,node,kind,x:e.clientX,y:e.clientY,grabX:(e.clientX-r.left)/scale,grabY:(e.clientY-r.top)/scale,active:false};node.setPointerCapture(e.pointerId);
}
function cancelDrag(){if(drag){drag.ghost?.remove();drag.node.style.opacity='';drag=null;}}
function inside(el,x,y){if(!el)return false;const r=el.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;}
addEventListener('pointermove',e=>{
  if(!drag)return;if(!drag.active&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6)return;
  if(!drag.active){drag.active=true;drag.ghost=drag.node.cloneNode(true);drag.ghost.className='item dragging';drag.ghost.style.transform='none';drag.ghost.style.width=78*scale+'px';drag.ghost.style.height=78*scale+'px';document.body.append(drag.ghost);drag.node.style.opacity='.2';}
  drag.ghost.style.left=e.clientX-drag.grabX*scale+'px';drag.ghost.style.top=e.clientY-drag.grabY*scale+'px';
  const scroll=drag.kind==='inspect'||drag.kind==='junk'?$('inspectScroll'):$('sourceScroll');
  if(scroll&&inside(scroll,e.clientX,e.clientY)){const r=scroll.getBoundingClientRect();if(e.clientY>r.bottom-20*scale)scroll.scrollTop+=10;if(e.clientY<r.top+20*scale)scroll.scrollTop-=10;}
});
addEventListener('pointerup',e=>{
  if(!drag)return;const d=drag;drag=null;if(!d.active)return;d.ghost.remove();d.node.style.opacity='';suppressUntil=performance.now()+150;if(state.paused)return;
  if(d.kind==='table'||d.kind==='junk'){
    for(const box of $('shelves').querySelectorAll('[data-cat]'))if(inside(box,e.clientX,e.clientY)){sortItem(d.uid,Number(box.dataset.cat));return;}
    if(d.kind==='junk'&&inside($('targetPreview'),e.clientX,e.clientY)){sortItem(d.uid,state.targetCat);return;}
  }
  if(d.kind==='source'&&inside($('parcelDrop'),e.clientX,e.clientY)){packItem(d.uid);return;}
  const area=d.node.parentElement,pane=d.kind==='table'?area:area.parentElement;
  if(inside(pane,e.clientX,e.clientY)){
    const r=area.getBoundingClientRect(),size=d.kind==='table'?88:78;
    const pos={x:Math.max(0,Math.min(1,((e.clientX-r.left)/scale-d.grabX-10)/Math.max(1,area.clientWidth-size-20))),y:0};
    if(d.kind==='table')pos.y=Math.max(0,Math.min(1,((e.clientY-r.top)/scale-d.grabY-10)/Math.max(1,area.clientHeight-size-20)));
    else pos.y=Math.max(0,Math.min(area.clientHeight-size,(e.clientY-r.top)/scale-d.grabY));
    d.item[d.kind==='table'?'tablePos':'boxPos']=pos;d.item.depth=++depth;state.selected=null;
    if(state.inspectCat!==null)renderInspection();else renderWork();save();
  }else toast('Вещь осталась на прежнем месте.');
});
addEventListener('pointercancel',cancelDrag);

function openUpgrade(){
  if(!state.started||state.paused)return;
  modal(`<h2>Диковинки</h2><img class="modal-art" src="${asset('storage/chest')}" alt="Коробка"><p>Уберите всё несортированное со стола одним действием. Позже откройте две коробки и разложите находки по категориям.</p><p>${state.upgrade?'Улучшение уже ваше.':`Стоимость: ${CONFIG.upgradePrice} монет · у вас ${state.gold}`}</p><button class="primary" id="buyUpgrade" ${state.upgrade||state.gold<CONFIG.upgradePrice?'disabled':''}>${state.upgrade?'Приобретено':'Купить коробку'}</button>`);
  $('buyUpgrade').onclick=()=>{if(state.upgrade||state.gold<CONFIG.upgradePrice)return;state.gold-=CONFIG.upgradePrice;state.daySpent+=CONFIG.upgradePrice;state.upgrade=true;closeModal();render();save();toast('Диковинки установлены. На столе появилась кнопка быстрой уборки.');};
}
function sweep(){if(!state.upgrade||state.paused||!state.bag.length)return;state.bag.forEach(x=>{delete x.boxPos;state.junk.push(x);});state.bag=[];state.selected=null;render();save();beep();toast('Стол свободен. Несортированное ждёт в «Диковинках».');}
function rarity(type){return type===17||type===23?'Легендарная':type===15||type===28?'Эпическая':type%5===0?'Редкая':'Простая';}
function openCollection(){
  if(!state.started||state.paused)return;const available=new Set(owned().map(x=>x.type));
  modal(`<img class="collection-ledger" src="assets/storage/ledger.png" alt=""><h2>Атлас находок</h2><p>Открыто ${state.collection.length} / ${items.length}. Нажмите находку из запасов, чтобы очистить её.<br>Товар останется у вас и будет доступен для заказа.</p><div class="collection-grid">${items.map(it=>`<button class="collection-item ${state.collection.includes(it.id)?'known':available.has(it.id)?'':'unknown'}" data-type="${it.id}" ${available.has(it.id)?'':'disabled'}><img src="${asset(it.sprite)}" alt=""><span>${state.collection.includes(it.id)||available.has(it.id)?it.name:'Не найдено'}</span><small>${state.collection.includes(it.id)?'✓ '+rarity(it.id):available.has(it.id)?'Очистить':'—'}</small></button>`).join('')}</div>`,{wide:true});
  $('modalContent').querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>openCleaning(Number(b.dataset.type)));
}
function openCleaning(type){
  const it=items[type],done=state.collection.includes(type);
  modal(`<h2>${it.name}</h2><p>${done?'Находка уже записана в атлас.':'Проведите пальцем или мышью, чтобы стереть налёт.'}</p><div class="clean-stage"><img src="${asset(it.sprite)}" alt="${it.name}"><canvas id="dirt" width="360" height="270" aria-label="Стирайте налёт с находки"></canvas></div><div class="clean-meter"><i id="cleanBar" style="width:${done?100:0}%"></i></div><p id="cleanStatus">${done?'✓ '+rarity(type):'Очищено 0%'}</p><div class="modal-actions"><button id="cleanKey">Очистить участок · клавиатура</button><button id="backCollection">К коллекции</button></div>`);
  const canvas=$('dirt'),ctx=canvas.getContext('2d',{willReadFrequently:true});let down=false,complete=done,strokes=0;
  if(!done){ctx.fillStyle='#736650';ctx.fillRect(0,0,360,270);for(let i=0;i<150;i++){ctx.fillStyle=i%2?'#8f7d60':'#5d513f';ctx.beginPath();ctx.arc(Math.random()*360,Math.random()*270,rand(1,5),0,7);ctx.fill();}}
  function check(){if(complete)return;const data=ctx.getImageData(0,0,360,270).data;let clear=0;for(let i=3;i<data.length;i+=16)if(data[i]<50)clear++;const pct=Math.round(clear/(data.length/16)*100);$('cleanBar').style.width=pct+'%';$('cleanStatus').textContent=`Очищено ${pct}%`;if(pct>=85){complete=true;ctx.clearRect(0,0,360,270);if(!state.collection.includes(type))state.collection.push(type);$('cleanBar').style.width='100%';$('cleanStatus').textContent=`✓ ${rarity(type)} · записано в атлас`;$('cleanKey').disabled=true;save();beep();}}
  function erase(x,y){if(complete)return;ctx.globalCompositeOperation='destination-out';ctx.beginPath();ctx.arc(x,y,33,0,Math.PI*2);ctx.fill();check();}
  function point(e){const r=canvas.getBoundingClientRect();erase((e.clientX-r.left)/r.width*360,(e.clientY-r.top)/r.height*270);}
  canvas.onpointerdown=e=>{down=true;canvas.setPointerCapture(e.pointerId);point(e);};canvas.onpointermove=e=>{if(down)point(e);};canvas.onpointerup=canvas.onpointercancel=()=>down=false;
  $('cleanKey').disabled=done;$('cleanKey').onclick=()=>{erase(20+(strokes%8)*45,20+Math.floor(strokes/8)*45);strokes++;};
  $('backCollection').onclick=()=>{closeModal();openCollection();};
}
function openRanks(){if(state.paused)return;modal(`<h2>Имя вашей лавки</h2><p>Репутация: ${state.rep}. За выданный заказ +4.<br>В этой истории доступны первые три ранга.</p><div class="rank-list">${rankNames.map((name,i)=>`<div class="rank-row ${i===rank()?'current':''} ${i>2?'locked':''}"><span>${i+1}. ${name}</span><span>${i>2?'🔒 позже':i===rank()?'Ваш ранг':i<rank()?'✓':i*12+' реп.'}</span></div>`).join('')}</div>`);}
function showAutoSortAd(){if(state.paused||!state.bag.length)return;modal('<h2>Помощь с сортировкой</h2><p>Тестовый просмотр · 2 секунды.<br>Настоящая реклама не подключена.</p><button id="confirmAuto" disabled>Подождите…</button>');const timer=setTimeout(()=>{if($('confirmAuto')){$('confirmAuto').disabled=false;$('confirmAuto').textContent='Разложить всё по категориям';}},2000);modalCleanup=()=>clearTimeout(timer);$('confirmAuto').onclick=autoSort;}
async function autoSort(){
  if(!$('confirmAuto')||$('confirmAuto').disabled)return;closeModal();state.autoSorting=true;renderWork();lockBackground(true);
  try{while(state.bag.length){const x=state.bag.shift();x.boxPos={x:Math.random()*.8,y:Math.floor(stockFor(items[x.type].cat).length/5)*76};state.stock.push(x);state.daySorted++;renderWork();await new Promise(r=>setTimeout(r,55));}}
  finally{state.autoSorting=false;lockBackground(false);renderWork();save();toast('Всё разложено. Доход получите за выданные заказы.');}
}
function hasSave(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY));return s?.version===1&&s.started;}catch{return false;}}
function loadGame(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY));if(s?.version!==1||!Array.isArray(s.stock)||!Array.isArray(s.bag))return;state={...freshState(),...s,paused:false,autoSorting:false,selected:null,inspectCat:null,activeCat:null};depth=Math.max(100,...owned().map(x=>x.depth||0));render();if(state.ended)showSummary();}catch{toast('Не удалось прочитать сохранение. Можно начать заново.');}}
function help(){if(state.paused)return;modal('<h2>Как работает лавка</h2><div class="rules"><b>Закупка.</b> Купите мешок за 10 монет. Содержимое заранее неизвестно.<br><b>Порядок.</b> Перетаскивайте вещи на полки. Или нажмите вещь, затем коробку. Ошибка подскажет категорию.<br><b>Заказ.</b> Листок справа. Недостающее появится в новых мешках. Откройте коробку и отправляйте нужное в посылку.<br><b>Диковинки.</b> За 20 монет купите временную коробку и убирайте остаток мешка одним действием.<br><b>Атлас.</b> Очистите находку и сохраните её изображение. Товар остаётся для продажи.<br><b>Вечер.</b> Новые приходы прекращаются; закончите дела и нажмите «Закончить день».</div>');}

function setup(){
  const start=document.createElement('section');start.id='startScreen';start.setAttribute('aria-label','Начало игры');
  const startActions=document.createElement('div');startActions.className='start-actions';start.append(startActions);
  button(startActions,'Начать',startGame,'startGame').className='primary';
  button(startActions,'Продолжить',loadGame,'loadGame');$('game').prepend(start);
  const arrival=document.createElement('button');arrival.id='arrivalSignal';arrival.onclick=()=>setScreen('reception');$('work').append(arrival);
  const sweepButton=document.createElement('button');sweepButton.id='sweepButton';sweepButton.textContent='Убрать всё в Диковинки';sweepButton.onclick=sweep;$('work').append(sweepButton);
  const target=document.createElement('section');target.id='targetPreview';target.className='hidden';$('work').append(target);
  const note=document.createElement('div');note.className='portrait-note';note.textContent='Поверните телефон горизонтально — так удобнее раскладывать находки.';document.body.append(note);
  $('back').onclick=()=>setScreen('reception');$('bag').onclick=buyBag;$('parcel').onclick=openOrder;$('closeInspector').onclick=closeInspection;
  $('closeModal').onclick=closeModal;$('autoSortButton').onclick=showAutoSortAd;$('ordersNav').onclick=openOrder;$('help').onclick=help;
  const upgrades=document.querySelector('[data-lock="Расширение склада"]');upgrades.textContent='Улучшение';upgrades.onclick=openUpgrade;
  const collection=document.querySelector('[data-lock="Магический сканер"]');collection.textContent='Коллекция';collection.onclick=openCollection;
  const r=document.querySelector('.rep');r.tabIndex=0;r.setAttribute('role','button');r.setAttribute('aria-label','Посмотреть ранги репутации');r.onclick=openRanks;r.onkeydown=e=>{if(e.key==='Enter')openRanks();};
  $('sound').onclick=()=>{state.muted=!state.muted;beep();updateHud();save();};
  $('pause').onclick=()=>{if(state.paused||!state.started)return;modal('<h2>Лавка на паузе</h2><p>Часы остановлены. Все находки на своих местах.</p><button id="resume" class="primary">Продолжить</button>');$('resume').onclick=closeModal;};
}
addEventListener('keydown',e=>{
  if(!$('modal').classList.contains('hidden')){
    if(e.key==='Escape'){e.preventDefault();closeModal();}
    if(e.key==='Tab'){const buttons=[...$('modal').querySelectorAll('button:not(:disabled)')].filter(b=>!b.classList.contains('hidden'));const first=buttons[0],end=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();end?.focus();}else if(!e.shiftKey&&document.activeElement===end){e.preventDefault();first?.focus();}}
    return;
  }
  if(state.autoSorting)return;
  if(e.key==='Escape'){if(state.inspectCat!==null)closeInspection();else if(state.selected!==null){state.selected=null;renderWork();}else if(state.activeCat!==null){state.activeCat=null;renderWork();}else if(state.screen==='work')setScreen('reception');}
});
document.addEventListener('visibilitychange',()=>{last=performance.now();save();});addEventListener('pagehide',save);addEventListener('resize',resize);
function tick(now){const dt=Math.min(1,(now-last)/1000);last=now;if(state.started&&!state.paused&&!state.ended&&!state.autoSorting&&!document.hidden){state.seconds=Math.max(0,state.seconds-dt*(state.screen==='work'?CONFIG.workTimeRate:1));tickArrivals();updateHud();saveClock+=dt;if(saveClock>=5){saveClock=0;save();}}requestAnimationFrame(tick);}

setup();resize();render();requestAnimationFrame(tick);
