'use strict';

// The inheritance arc deliberately uses the existing inventory and packing rules.
// It never copies stock into an order: every item keeps its original uid.
const Story = (()=>{
  const VERSION=1, REPAIR_COST=30, HIRE_COST=120, FOOD=38, VISIT_SECONDS=6;
  const enabled=()=>!!state.story;
  function ensure(){
    if(!enabled())return null;
    const s=state.story;
    s.version=VERSION;s.elapsed??=0;s.deliveries??=0;s.supplyCount??=0;s.nextVisit??=6;
    if(s.firstDayFlowVersion!==2){
      s.firstDayPurchases??=Math.min(2,Math.max(s.inheritedOpened?1:0,state.dayBought||0));
      s.firstDayDeliveries??=Math.min(2,s.deliveries||0);
      s.firstDayFlowVersion=2;
      if(!s.restored&&!s.restoration){s.firstDayComplete=s.firstDayPurchases>=2&&s.firstDayDeliveries>=2;if(!s.firstDayComplete){s.repairPromptSeen=false;s.repairOfferPending=false;}}
    }
    s.firstDayPurchases??=0;s.firstDayDeliveries??=0;
    if(s.restored||s.restoration)s.firstDayComplete=true;
    else{
      s.firstDayComplete=s.firstDayPurchases>=2&&s.firstDayDeliveries>=2;
      const accepted=(state.orders||[]).some(o=>o.accepted!==false);
      state.seconds=s.firstDayComplete?0:s.firstDayPurchases>=2?(accepted?30:60):s.firstPaid?90:s.inheritedOpened?(accepted?120:150):180;
    }
    s.lastVisitKind??=s.lastWasOrder?'customer':'supplier';
    state.unknownTray??=[];state.orders??=[];state.schedule=[];state.orderSchedule=[];state.nextBagOrder=false;
    state.timingVersion=2;state.lootVersion=1;state.queueVersion=1;state.arrivalPacingVersion=3;Contracts.ensure();Restoration.ensure();
    return s;
  }
  function start(){
    try{const old=localStorage.getItem(SAVE_KEY);if(old&&!JSON.parse(old).story)localStorage.setItem('guild-warehouse-before-inheritance-v1',old);}catch{}
    state=freshState();state.started=true;state.orders=[];state.unknownTray=[];
    state.story={version:VERSION,letterRead:false,restored:false,elapsed:0,deliveries:0,supplyCount:0,nextVisit:6};
    state.timingVersion=2;state.lootVersion=1;state.queueVersion=1;state.arrivalPacingVersion=3;state.orderSchedule=[];
    const loot=[24,FOOD,FOOD,FOOD,0,0,0,4].map(type=>{const x=makeItem(type);x.unknown=type===4;return x;});
    state.offers=[{visitor:0,loot,price:0,qualityRolled:true,tutorial:true,inherited:true,arrivalSerial:1}];state.arrivalSerial=1;
    startTutorial();last=performance.now();render();save();letter();
  }
  function letter(){
    modal('<div id="inheritanceLetter"><span class="brief-eyebrow">НАЧАЛО ИСТОРИИ</span><h2>Лавка дедушки</h2><p>Дед оставил вам старую лавку на окраине города. Полки запылились, вывеска потускнела, а постоянные покупатели почти перестали заходить.</p><blockquote>«Порядок начинается с одного мешка. Найди покупателя, выполни обещанное — и лавка снова оживёт».</blockquote><p>В кассе осталось <b>80 монет</b>. Роуэн сохранил последнюю дедову поставку: этот мешок уже оплачен.</p><button id="acceptInheritance" class="primary">Открыть дедову лавку</button></div>',{locked:true});
    $('acceptInheritance').onclick=()=>{state.story.letterRead=true;forceCloseModal();render();save();};
  }
  function startTutorial(){
    let completed=false;try{completed=localStorage.getItem(TUTORIAL_KEY)==='1';}catch{}
    const loot=state.offers[0].loot;
    state.tutorial={active:!completed,stage:'bag',targets:[loot[0].uid,loot[1].uid,loot[4].uid]};
  }
  function available(){
    const free=[...state.stock,...state.bag].filter(x=>!isUnknown(x)),reserved=new Map();
    for(const o of allOrders())for(const r of o.recipe){const packed=o.packed.filter(x=>x.type===r.type).length;reserved.set(r.type,(reserved.get(r.type)||0)+Math.max(0,r.count-packed));}
    return [...new Set(free.map(x=>x.type))].map(type=>({type,count:free.filter(x=>x.type===type).length-(reserved.get(type)||0)})).filter(r=>r.count>0);
  }
  function createOrder(keepSelection=true){
    const s=ensure();if(!s||allOrders().length>=4||allOrders().some(o=>o.accepted===false))return false;
    if(!s.restored&&!s.firstDayComplete&&s.firstPaid&&(s.firstDayPurchases<2||state.bag.length))return false;
    const first=!s.firstPaid&&!allOrders().length;
    let recipe,customer,title,description;
    if(first){
      if(state.stock.filter(x=>x.type===FOOD&&!isUnknown(x)).length<2)return false;
      recipe=[{type:FOOD,count:2}];customer=4;title='Первый ужин после открытия';description='Соседи сказали, что дедова лавка снова открылась. Мне нужны два кусочка мяса для ужина. Я заплачу 40 монет.';
    }else{
      const candidates=available();if(!candidates.length)return false;
      const chef=candidates.filter(r=>items[r.type].cat===4),alchemy=candidates.filter(r=>[0,1,2].includes(items[r.type].cat));
      const preferChef=(s.ordersCreated||0)%2===0;
      const chosen=preferChef&&chef.length?chef:alchemy.length?alchemy:chef.length?chef:candidates;
      recipe=chosen.slice().sort((a,b)=>b.count-a.count||a.type-b.type).slice(0,2).map(r=>({type:r.type,count:Math.min(2,r.count)}));
      if(state.dwarf?.hired){
        // The larger payment buys a larger parcel, rather than the old two items.
        const sorted=chosen.slice().sort((a,b)=>b.count-a.count||a.type-b.type);
        if(sorted.reduce((n,r)=>n+r.count,0)<4)return false;
        recipe=[];let left=4;
        for(const r of sorted){const count=Math.min(left,r.count);if(count)recipe.push({type:r.type,count});left-=count;if(!left)break;}
      }
      customer=chosen===chef?4:0;title=customer===4?'Припасы для кухни':'Запасы для алхимика';
      description=customer===4?'Готовлю ужин для горожан. Соберите продукты из сегодняшних поставок.':'Для новой партии зелий нужны эти компоненты. Я слышал, что в вашей лавке снова можно найти всё по списку.';
    }
    const active=state.order,reward=first?40:state.dwarf?.hired?90:60;
    const order={id:state.orderUid=(state.orderUid||0)+1,recipe,packed:[],accepted:false,customer,reward,originalReward:reward,createdDay:state.day,carried:false,title,description,storyOrder:true,arrivalSerial:state.arrivalSerial=(state.arrivalSerial||0)+1};
    state.orders.push(order);state.order=keepSelection&&active?active:order;s.ordersCreated=(s.ordersCreated||0)+1;state.dayOrdersCreated=(state.dayOrdersCreated||0)+1;
    return true;
  }
  function makeSupply(){
    const s=state.story,index=s.supplyCount||0;
    const credit=state.gold<10&&!(s.supplierDebt>0);
    if(state.gold<10&&!credit)return false;
    // A small initial catalogue keeps both professions legible and orders achievable.
    const sets=[[FOOD,FOOD,31,31,0,0,6,24],[32,32,FOOD,FOOD,1,1,12,18],[FOOD,FOOD,31,31,0,6,6,24]];
    const types=sets[index%sets.length].slice();
    if(state.dwarf?.hired){const secret=[9,14,19,29,4].find(t=>!state.collection.includes(t));if(secret!==undefined)types[7]=secret;}
    const lesson=!s.restored&&!s.firstDayComplete&&s.firstDayPurchases<2;
    const loot=types.map(type=>{const x=makeItem(type);x.unknown=!lesson&&mysteryType(type)&&!state.collection.includes(type);return x;});
    state.offers.push({visitor:(index+1)%adventurers.length,loot,price:credit?0:10,qualityRolled:true,credit:credit?10:0,arrivalSerial:state.arrivalSerial=(state.arrivalSerial||0)+1});s.supplyCount++;
    return true;
  }
  function arrivals(){
    const s=ensure();if(!s||!s.letterRead||Restoration.active()||state.visitorCooldown>0)return;
    if(!s.firstPaid){
      if(!s.inheritedOpened||state.bag.length||allOrders().length||visitorQueue().length)return;
      if(createOrder()){if(state.tutorial?.active)state.tutorial.stage='guest';refreshArrivals();save();}return;
    }
    if(state.tutorial?.active||s.nextVisit>0)return;
    // Opening the new day brings a supplier to the front without deleting a
    // carried customer's order or any of the player's existing stock.
    if(s.forceSupplier&&state.bag.length<24){
      if(state.offers.length||makeSupply()){
        state.offers[0].openingDay=true;s.forceSupplier=false;s.lastVisitKind='supplier';s.nextVisit=VISIT_SECONDS;
        refreshArrivals();save();return;
      }
    }
    if(visitorQueue().length)return;
    // The opening day teaches exactly two complete trades. After the second
    // purchase, finish its sorting and parcel before inviting another supplier.
    if(!s.restored&&!s.firstDayComplete){
      if(s.firstDayPurchases>=2){
        if(state.bag.length||allOrders().length)return;
        if(createOrder()){s.lastVisitKind='customer';s.nextVisit=VISIT_SECONDS;refreshArrivals();save();}
      }else if(makeSupply()){s.lastVisitKind='supplier';s.nextVisit=VISIT_SECONDS;refreshArrivals();save();}
      return;
    }
    // One person at the counter. Accepted leaflets do not occupy that counter.
    const orderCount=allOrders().filter(o=>o.accepted!==false).length;
    let changed=false;
    const supply=()=>{if(state.offers.length||state.bag.length>=24)return false;const ok=makeSupply();if(ok)s.lastVisitKind='supplier';return ok;};
    const customer=()=>{if(orderCount>=2||!available().length)return false;const ok=createOrder();if(ok)s.lastVisitKind='customer';return ok;};
    if(s.lastVisitKind==='customer')changed=supply()||customer();
    else changed=customer()||supply();
    s.nextVisit=VISIT_SECONDS;
    if(changed){refreshArrivals();save();}
  }
  function refreshArrivals(){
    // A new visitor never needs to recreate the workbench under the player's hand.
    if(state.screen==='reception')renderReception();else{renderOrderBoard();updateHud();}
  }
  function advance(dt){
    if(!enabled()||!state.started||state.paused||state.ended||state.autoSorting||document.hidden)return;
    dt=Math.max(0,Math.min(10,Number(dt)||0));if(!dt)return;
    const s=ensure();if(!s||!s.letterRead)return;
    if(Restoration.active()){Restoration.advance(dt);return;}
    s.elapsed+=dt;s.nextVisit=Math.max(0,s.nextVisit-dt);
    // The first day follows two trades, without a waiting timer. Later days use
    // the regular active clock; reading and the repair scene remain paused.
    if(s.restored){
      state.seconds=Math.max(0,state.seconds-dt);
      if(state.seconds<=0){state.seconds=CONFIG.daySeconds;state.day++;state.dayIncome=state.daySpent=state.dayOrders=state.dayBought=0;state.dayCollectionStart=state.collection.length;}
    }
    advanceVisitorGap(dt);arrivals();Dwarf.advance(dt);Goblin.advance(dt);
    if(Contracts.sync())refreshArrivals();
    checkCompletion();Restoration.advance(0);
  }
  function onBagPurchased(offer){
    const s=ensure();if(!s)return;if(offer.inherited)s.inheritedOpened=true;
    if(!s.restored&&!s.firstDayComplete)s.firstDayPurchases=Math.min(2,s.firstDayPurchases+1);
    if(offer.credit)s.supplierDebt=(s.supplierDebt||0)+offer.credit;
    s.nextVisit=VISIT_SECONDS;state.visitorCooldown=VISIT_SECONDS;Dwarf.onBagPurchased(offer.loot);
  }
  function onOrderAccepted(){const s=ensure();if(!s)return;s.nextVisit=VISIT_SECONDS;state.visitorCooldown=VISIT_SECONDS;}
  function onOrderDelivered(order,origin='manual'){
    const s=ensure();if(!s)return;const first=!s.firstPaid;s.deliveries++;s.firstPaid=true;
    if(!s.restored&&!s.firstDayComplete&&origin==='manual')s.firstDayDeliveries=Math.min(2,s.firstDayDeliveries+1);
    if(first){s.forceSupplier=true;s.nextVisit=VISIT_SECONDS;}
    if(state.dwarf?.hired&&origin==='manual')s.manualAfterDwarf++;
    Contracts.onDelivery(order);Goblin.reconcile();
    if(s.supplierDebt){const paid=Math.min(state.gold,s.supplierDebt);state.gold-=paid;state.daySpent+=paid;s.supplierDebt-=paid;toast('Поставка рассчитана: '+paid+' монет поставщику.');}
    if(state.tutorial?.active)finishTutorial(true);
    if(origin==='manual'&&!visitorQueue().length){startVisitorGap('order');state.visitorCooldown=VISIT_SECONDS;s.nextVisit=VISIT_SECONDS;}
    checkCompletion();if(origin==='manual')render();save();
  }
  function restore(){
    return Restoration.begin();
  }
  function hire(){
    if(!Dwarf.hire())return false;
    state.story.hireOrders=state.totalOrders;state.story.hireSorted=state.dwarf?.sorted||0;
    render();save();toast('Борин занял рабочий уголок. Закупки и заказы по-прежнему выбираете вы.');return true;
  }
  function objective(){
    const s=state.story;if(!s.letterRead)return ['НАСЛЕДСТВО','Снова открыть дедову лавку','Прочитайте письмо и примите первую поставку.'];
    if(!s.inheritedOpened)return ['ВОЗВРАЩЕНИЕ ЛАВКИ','Разобрать наследственный мешок','Роуэн уже принёс оплаченную поставку.'];
    if(!s.firstPaid)return ['ПЕРВАЯ ТОРГОВЛЯ','Выполнить первый заказ','Разложите находки. Повар закажет два кусочка мяса.'];
    if(!s.restored&&!s.firstDayComplete)return ['ПЕРВЫЙ РАБОЧИЙ ДЕНЬ','Ещё одна поставка и посылка','Примите второй мешок, разберите его и выдайте вторую посылку. Затем восстановим лавку.'];
    if(!s.restored)return ['ИТОГИ ПЕРВОГО ДНЯ','Вернуть лавке былой вид','День завершён. В итогах можно восстановить лавку за 30 монет и встретить новый рассвет.'];
    if(!state.dwarf?.hired)return ['ПЕРВЫЙ ПОМОЩНИК','Накопить 120 монет на гнома',Math.max(0,3-state.totalOrders)?'Выполните ещё '+Math.max(0,3-state.totalOrders)+' поручения. Борин доверяет хозяину с тремя заказами.':'Заказы приносят 60 монет. Наймите Борина в улучшениях.'];
    if(!s.completedB2)return ['РАБОТА ВДВОЁМ','Собрать посылку, пока работает Борин','Купите новую партию, а сами выполните ещё один заказ.'];
    if(!state.goblin?.hired)return ['РЕГУЛЯРНОЕ СНАБЖЕНИЕ','Договориться с клиентами и нанять Грика','Книга договорённостей: постоянные посылки. Грику нужны 240 монет и 3 ручные выдачи после найма Борина ('+Math.min(3,s.manualAfterDwarf||0)+'/3).'];
    if(!s.completedB3)return ['НОВЫЙ ПОМОЩНИК','Передать обычную посылку Грику','В договорённостях выберите «Передать гоблину». Он соберёт и выдаст товар, пока вы заняты другим заказом.'];
    return ['ЛАВКА РАБОТАЕТ ВМЕСТЕ','Грик выдал первую посылку','Договорённости повторяются. Покупайте поставки и продолжайте ручную работу; безопасные автозакупки — следующая глава.'];
  }
  function setup(){
    Contracts.setup();Restoration.setup();
    const goal=document.createElement('aside');goal.id='storyObjective';goal.className='hidden';goal.innerHTML='<span></span><strong></strong><small></small>';$('game').append(goal);
    const action=button($('reception'),'Улучшить лавку',showBusiness,'storyAction');action.className='primary hidden';
    const dwarf=button($('reception'),'',showBusiness,'dwarfStation');dwarf.className='hidden';dwarf.innerHTML='<img src="assets/dwarf-sorter.png" alt="Борин, гном-сортировщик"><span class="dwarf-name">Борин</span><span class="dwarf-status"></span><span class="dwarf-progress"><i></i></span>';dwarf.querySelector('img').onerror=e=>{e.currentTarget.src='assets/s3_2.png';e.currentTarget.onerror=null;};
    const tray=button(document.querySelector('.work-heading'),'Поднос неизвестного · 0',openTray,'unknownTrayButton');tray.className='hidden';
    const workStatus=button($('work'),'',showBusiness,'dwarfWorkStatus');workStatus.className='hidden';workStatus.innerHTML='<span class="worker-label"></span><span class="worker-progress"><i></i></span>';
    $('help').onclick=()=>{if(!enabled()){help();return;}if(state.paused)return;modal('<h2>Как вернуть лавку к жизни</h2><div class="rules"><b>Наследство.</b> Первая поставка уже оплачена. Разложите её и выполните заказ повара.<br><b>Торговля.</b> Принимайте поручения у стойки. Листки справа сразу открывают сборку. Каждый компонент — отдельная вещь в вашем запасе.<br><b>Преображение.</b> После двух торговых кругов восстановите существующую лавку за 30 монет.<br><b>Первый гном.</b> Три выданных заказа и 120 монет позволяют нанять Борина в «Улучшениях». Он разбирает партии параллельно с вашей сборкой.<br><b>Работа Борина.</b> Известное — в коробки, неизвестное — на поднос. За партию 2 монеты один раз. Закупки остаются за вами. В рабочем уголке гнома можно приостановить.<br><b>Изучение.</b> Нажмите неизвестную находку на подносе и очистите её. Предмет перейдёт в подходящую коробку.<br><b>Продолжение.</b> На паузе мир останавливается. Игра сохраняется в этом браузере. После первой главы можно продолжать торговлю.</div>');};
  }
  function update(){
    const active=enabled()&&state.started;$('game').classList.toggle('story-mode',active);if(!$('storyObjective'))return;
    hidden('storyObjective',!active);hidden('storyAction',!active||state.screen!=='reception'||!state.story?.restored);hidden('dwarfStation',!active||!state.dwarf?.hired||state.screen!=='reception');hidden('unknownTrayButton',!active||!state.dwarf?.hired);hidden('dwarfWorkStatus',!active||!state.dwarf?.hired);
    Contracts.update();if(!active)return;ensure();
    $('game').dataset.shop=state.story.restored?'restored':'neglected';$('game').dataset.dwarf=state.dwarf?.hired?'hired':'none';
    const goal=objective();['span','strong','small'].forEach((tag,i)=>{const el=$('storyObjective').querySelector(tag);if(el.textContent!==goal[i])el.textContent=goal[i];});
    $('dayLabel').textContent=state.story.restored?'День '+state.day:'Первый день · '+Math.min(2,state.story.firstDayDeliveries||0)+'/2 посылки';$('goldAdButton')?.classList.add('hidden');$('receptionGoldAd')?.classList.add('hidden');
    $('upgradesNav')?.classList.toggle('upgrade-prompt',!!state.story.firstPaid&&(!state.story.restored&&state.story.firstDayComplete||state.story.restored&&!state.dwarf?.hired&&state.gold>=HIRE_COST&&state.totalOrders>=3));
    const a=$('storyAction');if(!state.story.restored){a.textContent='Восстановить лавку · 30 монет';a.id='storyAction';a.dataset.action='restore';a.onclick=()=>restore();a.disabled=state.gold<REPAIR_COST;}
    else if(!state.dwarf?.hired){a.textContent=state.totalOrders<3?'Борин: нужно 3 выданных заказа':'Нанять гнома · 120 монет';a.dataset.action='hire';a.onclick=()=>hire();a.disabled=state.gold<HIRE_COST||state.totalOrders<3;}
    else{a.textContent=state.story.completedB2?'Книга договорённостей':'Рабочий уголок Борина';a.onclick=state.story.completedB2?Contracts.openBook:showBusiness;a.disabled=false;a.dataset.action='workshop';}
    const status=Dwarf.status();$('dwarfStation').querySelector('.dwarf-status').textContent=status.label||status.text||'Сортирует поставки';$('dwarfStation').querySelector('.dwarf-progress i').style.width=(status.progress||0)*100+'%';
    $('unknownTrayButton').textContent='Поднос неизвестного · '+state.unknownTray.length;
    $('dwarfWorkStatus').querySelector('.worker-label').textContent=status.label.startsWith('Борин')?status.label:'Борин · '+status.label;
    $('dwarfWorkStatus').querySelector('.worker-progress i').style.width=(status.progress||0)*100+'%';
    $('dwarfWorkStatus').title='Рабочий уголок. Обработка партии — 2 монеты один раз.';
    $('closeDay')?.classList.add('hidden');
    Restoration.update();
  }
  function decorate(){
    update();if(!enabled()||!state.started)return;
    const offer=counterGuest()?.kind==='bag'?counterGuest().value:null;
    if(offer?.inherited){$('speech').innerHTML='<span class="eyebrow">ПОСЛЕДНЯЯ ДЕДОВА ПОСТАВКА</span><h2>Роуэн</h2><p>Твой дед оплатил этот мешок заранее. Я сохранил его для нового хозяина. Начнём с порядка?</p>';if($('buyBag'))$('buyBag').textContent='Разобрать наследственный мешок';}
    else if(offer?.credit){$('speech').innerHTML='<span class="eyebrow">ПОСТАВКА ПОД РАСЧЁТ</span><h2>'+adventurers[offer.visitor][0]+'</h2><p>Мешок стоит 10 монет. Отдадите их из оплаты следующего заказа. Лавка должна работать!</p>';if($('buyBag'))$('buyBag').textContent='Принять · 10 монет из следующего заказа';}
    if(state.screen==='reception'&&!counterGuest()){$('speech').innerHTML='<span class="eyebrow">'+(state.story.restored?'ЛАВКА СНОВА ЖИВЁТ':'ДЕДОВО НАСЛЕДСТВО')+'</span><h2>'+objective()[1]+'</h2><p>'+objective()[2]+'</p>';}
    $('stepHint').textContent='';
  }
  function showBusiness(){
    if(!enabled()){openUpgrade();return;}if(state.paused||state.autoSorting)return;
    const s=ensure(),hired=!!state.dwarf?.hired,canHire=s.restored&&state.totalOrders>=3&&state.gold>=HIRE_COST;
    if(!s.restored){
      modal('<span class="brief-eyebrow">ДЕДОВА ЛАВКА</span><h2>'+(s.firstDayComplete?'Первый рабочий день завершён':'Два первых торговых круга')+'</h2><p>'+(s.firstDayComplete?'Можно подвести итоги и привести лавку в порядок перед новым рассветом.':'Наследственный мешок и первая посылка, затем покупной мешок и вторая посылка. Сразу после второй выдачи появится предложение восстановить лавку.')+'</p><button id="reviewRestoration" class="primary" '+(!s.firstDayComplete||!s.firstPaid?'disabled':'')+'>Итоги дня и восстановление</button>');
      $('reviewRestoration').onclick=()=>{closeModal();Restoration.prompt();};return;
    }
    modal('<span class="brief-eyebrow">ПРЕОБРАЖЕНИЕ СУЩЕСТВУЮЩЕЙ ЛАВКИ</span><h2>Лавка и помощники</h2><p>В кассе '+state.gold+' монет · выполнено '+state.totalOrders+' поручений</p><div class="story-business-grid"><article><h3>Возвращение лавки к жизни</h3><p>Убрать пыль, починить ставни и вывеску. Свет снова попадает в окно, а покупатели возвращаются.</p><button id="restoreShop" class="primary" '+(s.restored||!s.firstPaid||state.gold<REPAIR_COST?'disabled':'')+'>'+(s.restored?'Лавка восстановлена':'Восстановить · 30 монет')+'</button><small>После двух первых торговых кругов.</small></article><article><h3>Борин, гном-сортировщик</h3><p>Сам раскладывает известные вещи по коробкам, пока вы собираете посылку. Неизвестные складывает на отдельный поднос. Закупки выбираете вы.</p><button id="hireDwarf" class="primary" '+(hired||!canHire?'disabled':'')+'>'+(hired?'Борин нанят':'Нанять · 120 монет')+'</button><small>Восстановленная лавка и 3 выданных заказа. Обработка купленной партии — 2 монеты; если на неё не хватает, Борин ждёт.</small></article></div>'+(hired?'<div class="story-worker-controls"><p id="workerDetails"></p><button id="toggleDwarf">'+(state.dwarf.enabled?'Приостановить Борина':'Продолжить работу Борина')+'</button><button id="openUnknownTray">Неизвестные на подносе · '+state.unknownTray.length+'</button><button id="contractsBookButton">Договорённости и гоблин</button></div>':'')+'<p class="story-future">Постоянные посылки и помощник выдачи доступны в книге договорённостей. Безопасные автозакупки, карта города и старая башня — следующие главы.</p>',{wide:true});
    $('restoreShop').onclick=()=>{closeModal();restore();showBusiness();};$('hireDwarf').onclick=()=>{closeModal();hire();showBusiness();};
    if(hired){$('workerDetails').textContent='Борин работает с вашей настоящей поставкой. Предмет можно забрать вручную в любой момент; во время паузы работа останавливается.';$('toggleDwarf').onclick=()=>{Dwarf.setEnabled(!state.dwarf.enabled);closeModal();render();save();};$('openUnknownTray').onclick=()=>{closeModal();openTray();};$('contractsBookButton').onclick=()=>{closeModal();Contracts.openBook();};}
  }
  function openTray(){
    if(!enabled()||state.paused||state.autoSorting)return;ensure();
    modal('<span class="brief-eyebrow">РАБОЧИЙ УГОЛОК БОРИНА</span><h2>Поднос неизвестного</h2><p>Борин не угадывает категории. Распознайте находку: она попадёт в подходящую коробку, а название — в атлас.</p><div id="unknownTrayItems">'+(state.unknownTray.length?state.unknownTray.map(x=>'<button class="tray-item mystery-item" data-tray-uid="'+x.uid+'" aria-label="Распознать неизвестную находку"><img src="'+asset(items[x.type].sprite)+'" alt="Неизвестная находка"><i class="mystery-question">?</i></button>').join(''):'<p>Пока пусто. Неизвестные из новых поставок будут ждать здесь.</p>')+'</div>');
    document.querySelectorAll('[data-tray-uid]').forEach(b=>b.onclick=()=>{const x=state.unknownTray.find(x=>x.uid===Number(b.dataset.trayUid));if(x){closeModal();openCleaning(x.type,x);}});
  }
  function afterRecognition(instance){
    if(!enabled()||!instance)return;
    const recognized=state.unknownTray.filter(x=>!isUnknown(x));
    state.unknownTray=state.unknownTray.filter(isUnknown);
    for(const x of recognized){x.unknown=false;delete x.tablePos;delete x.boxPos;state.stock.push(x);rewardSortedItem(x.uid);}
  }
  function checkCompletion(){
    const s=state.story,d=state.dwarf;if(!s||!d?.hired)return;
    if(!s.completedB3&&(state.goblin?.deliveries||0)>0){s.completedB3=true;s.completedB3At=s.elapsed;save();toast('Грик выдал настоящую посылку. Регулярная торговля теперь работает вместе с вами.');}
    if(s.completedB2)return;
    if((d.completedBatches||0)>0&&state.totalOrders>(s.hireOrders??state.totalOrders)){
      s.completedB2=true;s.completedAt=s.elapsed;save();
      toast('Лавка работает вдвоём: Борин разобрал поставку, а вы выдали посылку. Первая глава пройдена!');
    }
  }
  function afterLoad(){if(!enabled())return;ensure();Dwarf.ensure();Goblin.ensure();Goblin.reconcile();state.ended=false;render();if(!state.story.letterRead)letter();else Restoration.afterLoad();}
  function guide(){
    const t=state.tutorial;if(!enabled()||!t?.active||!state.started){clearTutorialHighlight();$('tutorialGuide')?.remove();return;}
    if(!state.story.letterRead){clearTutorialHighlight();$('tutorialGuide')?.remove();return;}
    const modalOpen=!$('modal').classList.contains('hidden');$('autoSortButton').disabled=true;
    if(modalOpen){
      if($('dirt')){if($('cleanKey').disabled)tutorialGuide($('closeModal'),'Находка распознана. Закройте окно и положите её в Трофеи.');else tutorialGuide($('dirt'),'Зажмите левую кнопку и очищайте находку круговыми движениями. Можно нажимать «Распознать».',true);}
      else if($('acceptOrder'))tutorialGuide($('acceptOrder'),'Повару нужны два кусочка мяса. Они уже лежат на складе. Примите поручение.');
      else tutorialGuide($('closeModal'),'Закройте окно, чтобы вернуться к первому заказу.');return;
    }
    if(!state.story.inheritedOpened){tutorialGuide($('buyBag')||$('bag'),'Наследственный мешок уже оплачен. Разберите его на столе.');return;}
    if(state.bag.length){
      if(state.screen!=='work'||state.mode!=='sort'){tutorialGuide($('resumeBag')||$('goWork'),'Вернитесь к столу и разложите первую поставку.');return;}
      if(state.inspectCat!==null){tutorialGuide($('closeInspector'),'Закройте коробку и продолжите разбор.');return;}
      const next=t.targets.map(uid=>state.bag.find(x=>x.uid===uid)).find(Boolean)||state.bag.find(x=>!isUnknown(x));
      if(next){const it=items[next.type],held=drag?.uid===next.uid||state.selected===next.uid;tutorialGuide(held?document.querySelector('#shelves [data-cat="'+it.cat+'"]'):document.querySelector('#pile [data-uid="'+next.uid+'"]'),held?'Положите в «'+categories[it.cat].name+'».':'Перенесите «'+it.name+'» в «'+categories[it.cat].name+'».');return;}
      const unknown=state.bag.find(isUnknown);if(unknown)tutorialGuide(document.querySelector('#pile [data-uid="'+unknown.uid+'"]'),'Нажмите силуэт, чтобы распознать неизвестную находку.');return;
    }
    const order=allOrders()[0];
    if(!order){tutorialGuide(null,'Первая поставка разобрана. Сейчас к стойке подойдёт повар.');return;}
    if(order.accepted===false){if(state.screen!=='reception')tutorialGuide($('arrivalSignal'),'Повар у стойки! Нажмите уведомление о госте.');else tutorialGuide($('receptionOrder'),'Примите первое поручение.');return;}
    if(state.screen!=='work'||state.mode!=='order'){tutorialGuide(document.querySelector('#orderBoard [data-order-id="'+order.id+'"]'),'Листок — ваше принятое поручение. Нажмите его и начните сборку.');return;}
    if(orderComplete()){tutorialGuide($('ship'),'Посылка собрана. Выдайте её и получите первый заработок.');return;}
    const line=order.recipe.find(r=>remaining(r)>0),cat=items[line.type].cat;
    if(state.activeCat!==cat){tutorialGuide(document.querySelector('#shelves [data-cat="'+cat+'"]'),'Откройте «'+categories[cat].name+'»: там лежит нужный компонент.');return;}
    const x=stockFor(cat).find(x=>x.type===line.type);tutorialGuide(drag?.uid===x?.uid?$('parcelDrop'):document.querySelector('#sourceItems [data-uid="'+x?.uid+'"]'),'Возьмите «'+items[line.type].name+'» и положите в посылку слева.');
  }
  return {enabled,ensure,start,startTutorial,arrivals,advance,createOrder,onBagPurchased,onOrderAccepted,onOrderDelivered,restore,hire,setup,update,render:decorate,showBusiness,openTray,afterRecognition,afterLoad,guide,checkCompletion,signRegular:Contracts.signRegular};
})();
