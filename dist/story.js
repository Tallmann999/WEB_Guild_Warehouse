'use strict';

// The inheritance arc deliberately uses the existing inventory and packing rules.
// It never copies stock into an order: every item keeps its original uid.
const Story = (()=>{
  const VERSION=1, REPAIR_COST=30, HIRE_COST=120, FOOD=38, VISIT_SECONDS=2;
  const enabled=()=>!!state.story;
  function ensure(){
    if(!enabled())return null;
    const s=state.story;
    s.version=VERSION;s.elapsed??=0;s.deliveries??=0;s.supplyCount??=0;s.nextVisit??=VISIT_SECONDS;
    if(s.firstDayFlowVersion!==2){
      s.firstDayPurchases??=Math.min(2,Math.max(s.inheritedOpened?1:0,state.dayBought||0));
      s.firstDayDeliveries??=Math.min(2,s.deliveries||0);
      s.firstDayFlowVersion=2;
      if(!s.restored&&!s.restoration){s.firstDayComplete=s.firstDayPurchases>=2&&s.firstDayDeliveries>=2;if(!s.firstDayComplete){s.repairPromptSeen=false;s.repairOfferPending=false;}}
    }
    s.firstDayPurchases??=0;s.firstDayDeliveries??=0;
    if(!s.inheritedOpened)for(const offer of state.offers||[])if(offer.inherited&&offer.price===0)offer.price=10;
    if(!s.secondDayFlowVersion){
      // Existing advanced games keep their current day, stock and assistants.
      s.secondDayActive=state.day<=2&&!state.dwarf?.hired;
      s.secondDayPurchases=state.day===2?Math.min(3,state.dayBought||0):0;
      s.secondDayDeliveries=state.day===2?Math.min(3,state.dayOrders||0):0;
      s.secondDaySorted=state.day===2&&!state.bag.length?s.secondDayPurchases:Math.max(0,s.secondDayPurchases-1);
      s.secondDayFlowVersion=1;
      if(state.day>2||state.dwarf?.hired)s.dwarfEncounterSeen=true;
    }
    if(s.secondDayFlowVersion!==2){
      // Count completed old trades toward the shorter parcel quota. Never
      // discard queued visitors, paid goods or a parcel already in progress.
      const pending=(state.orders||[]).some(o=>!o.regularKey);
      s.secondDaySupplyRun=pending?3:Math.min(3,Math.max(0,(s.secondDayPurchases||0)-(s.secondDayDeliveries||0)));
      s.secondDayFlowVersion=2;
    }
    s.secondDaySupplyRun??=0;s.earlySupplyRun??=0;
    if(state.dwarf?.hired){s.dwarfEncounterSeen=true;s.dwarfEncounterPending=false;}
    s.goblinEncounterSeen??=false;s.goblinEncounterPending??=false;
    if(state.goblin?.hired){s.goblinEncounterSeen=true;s.goblinEncounterPending=false;}
    if(!s.sortingGate&&state.bag.length)s.sortingGate={uids:state.bag.map(x=>x.uid),day:state.day,ordinal:state.day===2?s.secondDayPurchases:s.firstDayPurchases};
    if(s.restored||s.restoration)s.firstDayComplete=true;
    else{
      s.firstDayComplete=s.firstDayPurchases>=2&&s.firstDayDeliveries>=2;
      const accepted=(state.orders||[]).some(o=>o.accepted!==false);
      state.seconds=s.firstDayComplete?0:s.firstDayPurchases>=2?(accepted?30:60):s.firstPaid?90:s.inheritedOpened?(accepted?120:150):180;
    }
    if(secondDay())state.seconds=Math.max(0,CONFIG.daySeconds*(1-Math.min(1,(s.secondDayDeliveries+Math.min(3,s.secondDaySupplyRun)/3)/2)));
    s.lastVisitKind??=s.lastWasOrder?'customer':'supplier';
    state.unknownTray??=[];state.orders??=[];state.schedule=[];state.orderSchedule=[];state.nextBagOrder=false;
    state.timingVersion=2;state.lootVersion=1;state.queueVersion=1;state.arrivalPacingVersion=3;Contracts.ensure();Restoration.ensure();if(typeof Automation!=='undefined')Automation.ensure();
    return s;
  }
  function start(){
    City.close();
    if(typeof BagPour!=='undefined')BagPour.clear();
    try{const old=localStorage.getItem(SAVE_KEY);if(old&&!JSON.parse(old).story)localStorage.setItem('guild-warehouse-before-inheritance-v1',old);}catch{}
    state=freshState();state.started=true;state.orders=[];state.unknownTray=[];
    state.story={version:VERSION,letterRead:false,restored:false,elapsed:0,deliveries:0,supplyCount:0,nextVisit:VISIT_SECONDS};
    state.timingVersion=2;state.lootVersion=1;state.queueVersion=1;state.arrivalPacingVersion=3;state.orderSchedule=[];
    const loot=[24,FOOD,FOOD,FOOD,0,0,0,4].map(type=>{const x=makeItem(type);x.unknown=type===4;return x;});
    state.offers=[{visitor:0,loot,price:10,qualityRolled:true,tutorial:true,inherited:true,arrivalSerial:1}];state.arrivalSerial=1;
    startTutorial();last=performance.now();render();save();letter();
  }
  function letter(){
    modal('<div id="inheritanceLetter"><span class="brief-eyebrow">НАЧАЛО ИСТОРИИ</span><h2>Лавка дедушки</h2><p>Дед оставил вам старую лавку на окраине города. Полки запылились, вывеска потускнела, а постоянные покупатели почти перестали заходить.</p><blockquote>«Порядок начинается с одного мешка. Найди покупателя, выполни обещанное — и лавка снова оживёт».</blockquote><p>Первый авантюрист уже ждёт у стойки. Купите его добычу и начните торговлю.</p><button id="acceptInheritance" class="primary">Открыть дедову лавку</button></div>',{locked:true});
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
  function secondDay(){return !!state.story?.secondDayActive&&state.day===2;}
  function earlyTrade(){return state.day>=2&&!state.city?.towerOwned;}
  function observeSorting(){
    const s=state.story,gate=s?.sortingGate;if(!gate)return false;
    if(gate.uids.some(uid=>state.bag.some(x=>x.uid===uid)))return false;
    if(gate.day===2)s.secondDaySorted=Math.max(s.secondDaySorted||0,gate.ordinal||0);
    delete s.sortingGate;s.nextVisit=VISIT_SECONDS;state.visitorCooldown=VISIT_SECONDS;
    state.visitorGapPending=true;state.visitorIdleReady=true;save();return true;
  }
  function secondDayMilestones(){
    const s=state.story;if(!secondDay())return false;
    if(!state.dwarf?.hired&&!s.dwarfEncounterSeen&&s.secondDaySorted>=2&&s.secondDayDeliveries>=1)s.dwarfEncounterPending=true;
    const ordinaryPending=allOrders().some(o=>!o.regularKey||o.accepted===false),suppliesDone=!s.secondDayChefFlow||s.secondDayPurchases>=6;
    if(s.secondDayDeliveries>=2&&suppliesDone&&!state.bag.length&&!ordinaryPending&&!visitorQueue().length){s.secondDayComplete=true;s.secondDayEndPending=true;}
    if(state.paused||state.autoSorting||drag||document.hidden||!$('modal').classList.contains('hidden'))return false;
    if(s.dwarfEncounterPending){showDwarfEncounter();return true;}
    if(s.secondDayEndPending){showSecondDayEnd();return true;}
    return false;
  }
  function showDwarfEncounter(){
    const s=state.story;if(!s?.dwarfEncounterPending||state.dwarf?.hired)return false;
    state.screen='reception';state.mode='sort';render();
    modal('<div id="dwarfEncounter" class="dwarf-interview"><img class="dwarf-interview-portrait" src="assets/dwarf-borin-redhat.png" alt="Борин, гном-сортировщик"><span class="brief-eyebrow">ГОСТЬ В ПОИСКАХ РАБОТЫ</span><h2>Борин</h2><p>Я ищу работу и очень люблю складывать и сортировать вещи, но моя работа стоит денег — 120 монет.</p><div class="dwarf-interview-actions"><button id="acceptDwarf" class="primary" '+(state.gold<HIRE_COST?'disabled':'')+'>Согласиться и взять на работу · 120 монет</button><button id="declineDwarf">Отказаться и прогнать гнома</button></div>'+(state.gold<HIRE_COST?'<p>Можно нанять Борина позже в улучшениях, когда накопите 120 монет.</p>':'')+'</div>',{locked:true});
    $('acceptDwarf').onclick=()=>{
      if(!hire())return;
      s.dwarfEncounterPending=false;s.dwarfEncounterSeen=true;s.dwarfEncounterChoice='hired';
      forceCloseModal();render();save();
    };
    $('declineDwarf').onclick=()=>{
      s.dwarfEncounterPending=false;s.dwarfEncounterSeen=true;s.dwarfEncounterChoice='declined';
      forceCloseModal();render();save();showBusiness();
    };
    save();return true;
  }
  function showSecondDayEnd(){
    const s=state.story;if(!s?.secondDayEndPending)return false;
    modal('<div id="finishSecondDay"><span class="brief-eyebrow">ВТОРОЙ РАБОЧИЙ ДЕНЬ ЗАВЕРШЁН</span><h2>'+s.secondDayPurchases+' поставок, '+s.secondDayDeliveries+' посылки</h2><p>Обновим лавку перед новым утром: стеллажи, уютный уголок у окна и вывеска гильдии.</p><button id="startThirdDay" class="primary">Обновить лавку и начать третий день</button></div>',{locked:true});
    $('startThirdDay').onclick=()=>{
      if(Restoration.active()||state.day!==2||!s.secondDayEndPending)return;
      if(Restoration.readySecond()){forceCloseModal();Restoration.beginSecond();return;}
      s.secondDayEndPending=false;state.day=3;state.seconds=CONFIG.daySeconds;
      state.dayIncome=state.daySpent=state.dayOrders=state.dayBought=0;state.dayCollectionStart=state.collection.length;
      s.nextVisit=0;s.forceSupplier=true;state.visitorCooldown=0;forceCloseModal();render();save();
    };
    save();return true;
  }
  function goblinMilestones(){
    const s=state.story;if(!s||state.goblin?.hired||s.goblinEncounterSeen||!Goblin.eligible())return false;
    if(!s.goblinEncounterPending){if(state.gold<240)return false;s.goblinEncounterPending=true;save();}
    if(state.paused||state.autoSorting||state.tutorial?.active||drag||state.selected!==null||document.hidden||state.bag.length||s.sortingGate||visitorQueue().length||Contracts.activeOffer?.()||typeof BagPour!=='undefined'&&BagPour.active()||typeof City!=='undefined'&&City.isOpen()||!$('modal').classList.contains('hidden')||state.screen==='work'&&state.mode==='order')return false;
    return showGoblinEncounter();
  }
  function showGoblinEncounter(){
    const s=state.story;if(!s?.goblinEncounterPending||state.goblin?.hired)return false;
    state.screen='reception';state.mode='sort';render();
    modal('<div id="goblinEncounter" class="staff-interview"><img class="staff-interview-portrait" src="assets/goblin-grik-packer.png" alt="Грик, гоблин-комплектовщик"><span class="brief-eyebrow">ГОСТЬ В ПОИСКАХ РАБОТЫ</span><h2>Грик</h2><p>Вы уже освоились с Борином. Я люблю аккуратно собирать и выдавать посылки. Найм стоит 240 монет. Какую посылку поручить мне — решаете вы.</p><div class="staff-interview-actions"><button id="acceptGoblin" class="primary" '+(state.gold<240?'disabled':'')+'>Взять на работу · 240 монет</button><button id="declineGoblin">Отказаться и отпустить Грика</button></div>'+(state.gold<240?'<p>Можно нанять Грика позже в улучшениях, когда накопите 240 монет.</p>':'')+'</div>',{locked:true});
    $('acceptGoblin').onclick=()=>{
      if(!Goblin.canHire())return;
      forceCloseModal();if(!hireGoblin())return;
      s.goblinEncounterChoice='hired';render();save();showBusiness();
    };
    $('declineGoblin').onclick=()=>{
      s.goblinEncounterPending=false;s.goblinEncounterSeen=true;s.goblinEncounterChoice='declined';
      forceCloseModal();render();save();showBusiness();
    };
    save();return true;
  }
  function hireGoblin(){
    if(!Goblin.hire())return false;
    state.story.goblinEncounterSeen=true;state.story.goblinEncounterPending=false;state.story.goblinEncounterChoice='hired';
    render();save();toast('Грик нанят. В улучшениях включите его работу и поручите выбранную посылку.');return true;
  }
  function createOrder(keepSelection=true){
    const s=ensure();if(!s||allOrders().length>=4||allOrders().some(o=>o.accepted===false))return false;
    if(secondDay()&&(s.regularContracts?.chef?.signed||s.secondDayDeliveries>=2||s.secondDaySupplyRun<3||state.bag.length||s.sortingGate))return false;
    if(!s.restored&&!s.firstDayComplete&&s.firstPaid&&(s.firstDayPurchases<2||state.bag.length))return false;
    const first=!s.firstPaid&&!allOrders().length;
    let recipe,customer,title,description;
    if(first){
      if(state.stock.filter(x=>x.type===FOOD&&!isUnknown(x)).length<2)return false;
      recipe=[{type:FOOD,count:2}];customer=4;title='Первый ужин после открытия';description='Соседи сказали, что дедова лавка снова открылась. Мне нужны два кусочка мяса для ужина. Я заплачу 40 монет.';
    }else{
      const candidates=available();if(!candidates.length)return false;
      const chef=candidates.filter(r=>items[r.type].food),alchemy=candidates.filter(r=>[0,1,2].includes(items[r.type].cat)||items[r.type].cat===4&&!items[r.type].food);
      const equipment=candidates.filter(r=>items[r.type].cat===3);
      const preferChef=(s.ordersCreated||0)%2===0;
      let chosen=preferChef&&chef.length?chef:alchemy.length?alchemy:chef.length?chef:candidates;
      if(state.day>=3&&(s.ordersCreated||0)%3===2&&equipment.reduce((n,r)=>n+r.count,0)>=(state.dwarf?.hired?4:2))chosen=equipment;
      if(state.dwarf?.hired&&chosen.reduce((n,r)=>n+r.count,0)<4){
        chosen=[preferChef?alchemy:chef,equipment,candidates].find(group=>group.reduce((n,r)=>n+r.count,0)>=4)||chosen;
      }
      recipe=chosen.slice().sort((a,b)=>b.count-a.count||a.type-b.type).slice(0,2).map(r=>({type:r.type,count:Math.min(2,r.count)}));
      if(state.dwarf?.hired){
        // The larger payment buys a larger parcel, rather than the old two items.
        const sorted=chosen.slice().sort((a,b)=>b.count-a.count||a.type-b.type);
        if(sorted.reduce((n,r)=>n+r.count,0)<4)return false;
        recipe=[];let left=4;
        for(const r of sorted){const count=Math.min(left,r.count);if(count)recipe.push({type:r.type,count});left-=count;if(!left)break;}
      }
      customer=chosen===equipment?1:chosen===chef?4:chosen===alchemy?0:3;title=customer===1?'Снаряжение для кузницы':customer===4?'Припасы для кухни':customer===3?'Припасы для постояльцев':'Запасы для алхимика';
      description=customer===1?'Перекую старое снаряжение для нового похода. Приму оружие, броню и полезную оснастку из ваших запасов.':customer===4?'Готовлю ужин для горожан. Соберите продукты из сегодняшних поставок.':customer===3?'Мои постояльцы собираются в поход. Возьму разные припасы и снаряжение из вашего запаса.':'Для новой партии зелий нужны трофеи, травы и компоненты из ваших запасов.';
    }
    const active=state.order,reward=first?40:state.dwarf?.hired?90:60;
    const order={id:state.orderUid=(state.orderUid||0)+1,recipe,packed:[],accepted:false,customer,reward,originalReward:reward,createdDay:state.day,carried:false,title,description,storyOrder:true,arrivalSerial:state.arrivalSerial=(state.arrivalSerial||0)+1};
    state.orders.push(order);state.order=keepSelection&&active?active:order;s.ordersCreated=(s.ordersCreated||0)+1;state.dayOrdersCreated=(state.dayOrdersCreated||0)+1;
    if(earlyTrade())s.earlySupplyRun=0;
    return true;
  }
  function makeSupply(){
    const s=state.story,index=s.supplyCount||0;
    if(secondDay()&&(s.regularContracts?.chef?.signed?s.secondDayPurchases>=6:s.secondDayDeliveries>=2||s.secondDaySupplyRun>=3))return false;
    const credit=state.gold<10&&!(s.supplierDebt>0);
    if(state.gold<10&&!credit)return false;
    const lesson=!s.restored&&!s.firstDayComplete&&s.firstDayPurchases<2;
    const {types,theme,unknownBudget}=LootBalance.makeTypes({day:state.day,index,lesson});
    let unknownCount=0;
    const loot=types.map(type=>{const x=makeItem(type);x.unknown=!lesson&&unknownCount<unknownBudget&&mysteryType(type)&&!state.collection.includes(type);if(x.unknown)unknownCount++;return x;});
    state.offers.push({visitor:(index+1)%adventurers.length,loot,theme,price:credit?0:10,qualityRolled:true,credit:credit?10:0,arrivalSerial:state.arrivalSerial=(state.arrivalSerial||0)+1});
    s.lastSupplyTypes=types.slice();s.supplyCount++;
    return true;
  }
  function arrivals(){
    const s=ensure();if(!s||!s.letterRead||Restoration.active()||state.visitorCooldown>0||s.sortingGate||state.bag.length)return;
    if(!s.firstPaid){
      if(!s.inheritedOpened||state.bag.length||allOrders().length||visitorQueue().length)return;
      if(createOrder()){if(state.tutorial?.active)state.tutorial.stage='guest';refreshArrivals();save();}return;
    }
    if(state.tutorial?.active||s.nextVisit>0)return;
    if(Contracts.activeOffer?.())return;
    if(Contracts.maybeOffer?.()){refreshArrivals();return;}
    if(secondDay()){
      if(s.dwarfEncounterPending||s.secondDayEndPending||s.secondDayComplete||visitorQueue().length||allOrders().some(o=>!o.regularKey||o.accepted===false))return;
      let changed=false;
      if(s.regularContracts?.chef?.signed){changed=makeSupply();if(changed)s.lastVisitKind='supplier';}
      else if(s.secondDaySupplyRun>=3){changed=createOrder();if(changed)s.lastVisitKind='customer';}
      else if(s.secondDayDeliveries<2){
        changed=makeSupply();if(changed){s.lastVisitKind='supplier';if(s.forceSupplier)state.offers[0].openingDay=true;s.forceSupplier=false;}
      }
      s.nextVisit=VISIT_SECONDS;if(changed){refreshArrivals();save();}return;
    }
    if(s.goblinEncounterPending)return;
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
    if(earlyTrade())changed=s.earlySupplyRun>=3?customer()||supply():supply()||customer();
    else if(s.lastVisitKind==='customer')changed=supply()||customer();
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
    const sortingFinished=observeSorting();
    s.elapsed+=dt;if(!sortingFinished)s.nextVisit=Math.max(0,s.nextVisit-dt);
    // The first day follows two trades, without a waiting timer. Later days use
    // the regular active clock; reading and the repair scene remain paused.
    if(s.restored&&!secondDay()){
      state.seconds=Math.max(0,state.seconds-dt);
      if(state.seconds<=0){state.seconds=CONFIG.daySeconds;state.day++;state.dayIncome=state.daySpent=state.dayOrders=state.dayBought=0;state.dayCollectionStart=state.collection.length;}
    }
    if(!sortingFinished)advanceVisitorGap(dt);
    if(secondDayMilestones())return;
    if(goblinMilestones())return;
    arrivals();if(typeof Automation!=='undefined')Automation.advance(dt);Dwarf.advance(dt);Goblin.advance(dt);
    if(Contracts.sync())refreshArrivals();
    checkCompletion();if(typeof Guild!=='undefined')Guild.advance();Restoration.advance(0);
  }
  function onBagPurchased(offer){
    const s=ensure();if(!s)return;if(offer.inherited)s.inheritedOpened=true;
    if(!s.restored&&!s.firstDayComplete)s.firstDayPurchases=Math.min(2,s.firstDayPurchases+1);
    if(secondDay()){s.secondDayPurchases++;s.secondDaySupplyRun++;}
    else if(earlyTrade())s.earlySupplyRun++;
    s.sortingGate={uids:state.bag.map(x=>x.uid),day:state.day,ordinal:secondDay()?s.secondDayPurchases:s.firstDayPurchases};
    if(offer.credit)s.supplierDebt=(s.supplierDebt||0)+offer.credit;
    s.nextVisit=VISIT_SECONDS;state.visitorCooldown=VISIT_SECONDS;Dwarf.onBagPurchased(offer.loot);
  }
  function onOrderAccepted(){const s=ensure();if(!s)return;s.nextVisit=VISIT_SECONDS;state.visitorCooldown=VISIT_SECONDS;}
  function onOrderDelivered(order,origin='manual'){
    const s=ensure();if(!s)return;const first=!s.firstPaid;s.deliveries++;s.firstPaid=true;
    if(!s.restored&&!s.firstDayComplete&&origin==='manual')s.firstDayDeliveries=Math.min(2,s.firstDayDeliveries+1);
    if(secondDay()&&origin==='manual'){s.secondDayDeliveries++;s.secondDaySupplyRun=0;}
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
    state.story.dwarfEncounterSeen=true;state.story.dwarfEncounterPending=false;
    render();save();toast('Борин нанят и сразу разбирает поставки. Его можно приостановить в улучшениях.');return true;
  }
  function objective(){
    const s=state.story;if(!s.letterRead)return ['НАСЛЕДСТВО','Снова открыть дедову лавку','Прочитайте письмо и примите первую поставку.'];
    if(!s.inheritedOpened)return ['ВОЗВРАЩЕНИЕ ЛАВКИ','Купить первый мешок','Роуэн принёс восемь находок. Купите мешок за 10 монет и разберите поставку.'];
    if(!s.firstPaid)return ['ПЕРВАЯ ТОРГОВЛЯ','Выполнить первый заказ','Разложите находки. Повар закажет два кусочка мяса.'];
    if(!s.restored&&!s.firstDayComplete)return ['ПЕРВЫЙ РАБОЧИЙ ДЕНЬ','Ещё одна поставка и посылка','Примите второй мешок, разберите его и выдайте вторую посылку. Затем восстановим лавку.'];
    if(!s.restored)return ['ИТОГИ ПЕРВОГО ДНЯ','Вернуть лавке былой вид','День завершён. В итогах можно восстановить лавку за 30 монет и встретить новый рассвет.'];
    if(!state.dwarf?.hired)return ['ПЕРВЫЙ ПОМОЩНИК',Dwarf.unlocked()?'Нанять Борина за 120 монет':'Второй день · три поставки на посылку',Dwarf.unlocked()?'Борин ждёт решения в улучшениях. После найма он сразу начнёт разбирать поставки.':'После трёх разобранных мешков и первой выданной посылки придёт гном-сортировщик.'];
    if(!state.dwarf.enabled)return ['ПЕРВЫЙ ПОМОЩНИК','Включить автосортировку Борина','Откройте улучшения и поручите Борину разбор настоящей поставки.'];
    if(!s.completedB2)return ['РАБОТА ВДВОЁМ','Собрать посылку, пока работает Борин','Купите новую партию, а сами выполните ещё один заказ.'];
    if(!state.goblin?.hired)return ['НОВЫЙ ПОМОЩНИК',state.day>=3?'Нанять Грика за 240 монет':'Сначала поработать вместе с Борином',state.day>=3?state.gold<240?'Продолжайте обычную торговлю и накопите 240 монет. Грик сможет собирать выбранную посылку.':'Грик предложит работу у свободной стойки. После найма включите его и выберите посылку в улучшениях.':'Грик придёт с третьего дня, когда вы освоите работу вдвоём с Борином.'];
    if(!state.goblin.enabled)return ['НОВЫЙ ПОМОЩНИК','Включить работу Грика','В улучшениях включите Грика и явно поручите ему выбранную посылку. Остальные посылки остаются за вами.'];
    if(!s.completedB3)return ['НОВЫЙ ПОМОЩНИК','Передать обычную посылку Грику','В улучшениях поручите Грику одну принятую посылку. Он соберёт и выдаст товар, пока вы заняты другим заказом.'];
    if(!s.guild?.founded||s.guild.phase==='charter')return ['НАЧАЛО ГИЛЬДИИ','Основать свою гильдию','Выберите название, получите флаг и включите автоторговлю в окне гильдии.'];
    if(!Automation.enabled())return ['ЛАВКА И ГИЛЬДИЯ','Возобновить автоторговлю','Откройте окно гильдии, чтобы включить покупку мешков и выдачу обычных посылок.'];
    if(!state.city?.towerOwned)return ['СТАРАЯ БАШНЯ',City.towerAvailable()?'Купить башню · 1000 монет':'Накопить на старую башню','Лавка торгует сама. Покупка башни на карте города откроет договорённости с другими постоянными клиентами.'];
    if(!Contracts.signedCount())return ['ПОСТОЯННЫЕ КЛИЕНТЫ','Договорённости доступны','Откройте условия повара и алхимика. Можно подписать договорённость или решить позже.'];
    return ['ЛАВКА РАБОТАЕТ ВМЕСТЕ','Грик выдал первую посылку','Договорённости повторяются. Лавка ведёт обычную торговлю сама; выбранные договорённости можно поручать Грику.'];
  }
  function setup(){
    Contracts.setup();Restoration.setup();
    const goal=document.createElement('aside');goal.id='storyObjective';goal.className='hidden';goal.innerHTML='<span></span><strong></strong><small></small>';$('game').append(goal);
    const action=button($('reception'),'Улучшить лавку',showBusiness,'storyAction');action.className='primary hidden';
    const dwarf=button($('reception'),'',showBusiness,'dwarfStation');dwarf.className='hidden';dwarf.innerHTML='<img src="assets/dwarf-borin-redhat.png" alt="Борин, гном-сортировщик"><span class="dwarf-name">Борин</span><span class="dwarf-status"></span><span class="dwarf-progress"><i></i></span>';dwarf.querySelector('img').onerror=e=>{e.currentTarget.src='assets/s3_2.png';e.currentTarget.onerror=null;};
    const tray=button(document.querySelector('.work-heading'),'Поднос неизвестного · 0',openTray,'unknownTrayButton');tray.className='hidden';
    const workStatus=button($('work'),'',showBusiness,'dwarfWorkStatus');workStatus.className='hidden';workStatus.innerHTML='<span class="worker-label"></span><span class="worker-progress"><i></i></span>';
    $('help').onclick=()=>{if(!enabled()){help();return;}if(state.paused)return;modal('<h2>Как вернуть лавку к жизни</h2><div class="rules"><b>Начало торговли.</b> Купите первый мешок за 10 монет, разложите находки и выполните заказ повара.<br><b>Торговля.</b> Принимайте поручения у стойки. Листки справа сразу открывают сборку. Каждый компонент — отдельная вещь в вашем запасе.<br><b>Преображение.</b> После первого дня уберите пыль и паутину и почините окно за 30 монет. После второго дня появятся стеллажи, уютный уголок и вывеска гильдии.<br><b>Второй день.</b> Три поставки на одну посылку: всего шесть поставок и две посылки. После первой выдачи придёт Борин. Найм — 120 монет; после оплаты Борин сразу начинает сортировку. Он разбирает партии параллельно с вашей сборкой.<br><b>Работа Борина.</b> Известное — в коробки, неизвестное — на поднос. За партию 2 монеты один раз. После основания гильдии можно включить автоторговлю. В рабочем уголке гнома можно приостановить.<br><b>Изучение.</b> Нажмите неизвестную находку на подносе и очистите её. Предмет перейдёт в подходящую коробку.<br><b>Продолжение.</b> На паузе мир останавливается. Игра сохраняется в этом браузере. После первой главы можно продолжать торговлю.</div>');};
  }
  function update(){
    const active=enabled()&&state.started;$('game').classList.toggle('story-mode',active);if(!$('storyObjective'))return;
    hidden('storyObjective',!active);hidden('storyAction',!active||state.screen!=='reception'||!state.story?.restored);hidden('dwarfStation',!active||!state.dwarf?.hired||state.screen!=='reception');hidden('unknownTrayButton',!active||!state.dwarf?.hired);hidden('dwarfWorkStatus',!active||!state.dwarf?.hired);
    Contracts.update();if(!active)return;ensure();
    $('game').dataset.shop=state.story.restored?'restored':'neglected';$('game').dataset.dwarf=state.dwarf?.hired?'hired':'none';
    const goal=objective();['span','strong','small'].forEach((tag,i)=>{const el=$('storyObjective').querySelector(tag);if(el.textContent!==goal[i])el.textContent=goal[i];});
    $('dayLabel').textContent=state.story.restored?(secondDay()?'День 2 · '+Math.min(2,state.story.secondDayDeliveries||0)+'/2 посылки':'День '+state.day):'Первый день · '+Math.min(2,state.story.firstDayDeliveries||0)+'/2 посылки';$('goldAdButton')?.classList.add('hidden');$('receptionGoldAd')?.classList.add('hidden');
    $('upgradesNav')?.classList.toggle('upgrade-prompt',!!state.story.firstPaid&&(!state.story.restored&&state.story.firstDayComplete||state.story.restored&&Dwarf.canHire()||state.dwarf?.hired&&!state.dwarf.enabled));
    const a=$('storyAction');if(!state.story.restored){a.textContent='Восстановить лавку · 30 монет';a.id='storyAction';a.dataset.action='restore';a.onclick=()=>restore();a.disabled=state.gold<REPAIR_COST;}
    else if(!state.dwarf?.hired){a.textContent=Dwarf.unlocked()?'Нанять гнома · 120 монет':'Борин придёт после первой посылки';a.dataset.action='hire';a.onclick=showBusiness;a.disabled=!Dwarf.canHire();}
    else{const contracts=Contracts.ready()||Contracts.signedCount()>0;a.textContent=contracts?'Книга договорённостей':'Рабочий уголок Борина';a.onclick=contracts?Contracts.openBook:showBusiness;a.disabled=false;a.dataset.action='workshop';}
    const status=Dwarf.status();$('dwarfStation').querySelector('.dwarf-status').textContent=status.label||status.text||'Сортирует поставки';$('dwarfStation').querySelector('.dwarf-progress i').style.width=(status.progress||0)*100+'%';
    const tray=$('unknownTrayButton');let trayLabel=tray.querySelector('.unknown-tray-label');
    if(!trayLabel){trayLabel=document.createElement('span');trayLabel.className='unknown-tray-label';tray.replaceChildren(trayLabel);}
    trayLabel.textContent='Поднос неизвестного · '+state.unknownTray.length;
    $('dwarfWorkStatus').querySelector('.worker-label').textContent=status.label.startsWith('Борин')?status.label:'Борин · '+status.label;
    $('dwarfWorkStatus').querySelector('.worker-progress i').style.width=(status.progress||0)*100+'%';
    $('dwarfWorkStatus').title='Рабочий уголок. Обработка партии — 2 монеты один раз.';
    updateUnknownNotice($('dwarfStation'),state.unknownTray.length,'Борин. Открыть рабочий уголок');
    updateUnknownNotice(tray,state.unknownTray.length,'Поднос неизвестного');
    updateUnknownNotice($('dwarfWorkStatus'),state.unknownTray.length,'Борин. Открыть рабочий уголок');
    $('closeDay')?.classList.add('hidden');
    Restoration.update();Dwarf.updateVisual();
  }
  function updateUnknownNotice(node,count,label){
    if(!node)return;
    let mark=node.querySelector(':scope > .staff-alert');
    if(!mark){mark=document.createElement('span');mark.className='staff-alert';mark.setAttribute('aria-hidden','true');node.append(mark);}
    mark.hidden=count===0;node.classList.toggle('has-unknown',count>0);
    const message=count>0?'Борин отложил неизвестные находки: '+count+'. Откройте поднос и распознайте их.':label;
    node.title=message;node.setAttribute('aria-label',message);
  }
  function decorate(){
    update();if(!enabled()||!state.started)return;
    const offer=counterGuest()?.kind==='bag'?counterGuest().value:null;
    if(offer?.inherited){$('speech').innerHTML='<span class="eyebrow">ПЕРВЫЙ АВАНТЮРИСТ</span><h2>Роуэн</h2><p>Слышал, лавка снова открылась. Принёс восемь находок из последнего похода. Мешок стоит 10 монет.</p>';if($('buyBag'))$('buyBag').textContent='Купить мешок · 10 монет';}
    else if(offer?.credit){$('speech').innerHTML='<span class="eyebrow">ПОСТАВКА ПОД РАСЧЁТ</span><h2>'+adventurers[offer.visitor][0]+'</h2><p>Мешок стоит 10 монет. Отдадите их из оплаты следующего заказа. Лавка должна работать!</p>';if($('buyBag'))$('buyBag').textContent='Принять · 10 монет из следующего заказа';}
    if(state.screen==='reception'&&!counterGuest()){$('speech').innerHTML='<span class="eyebrow">'+(state.story.restored?'ЛАВКА СНОВА ЖИВЁТ':'ДЕДОВО НАСЛЕДСТВО')+'</span><h2>'+objective()[1]+'</h2><p>'+objective()[2]+'</p>';}
    $('stepHint').textContent='';
  }
  function showBusiness(){
    if(!enabled()){openUpgrade();return;}if(state.paused||state.autoSorting)return;
    const s=ensure(),hired=!!state.dwarf?.hired,canHire=Dwarf.canHire();
    if(!s.restored){
      modal('<span class="brief-eyebrow">ДЕДОВА ЛАВКА</span><h2>'+(s.firstDayComplete?'Первый рабочий день завершён':'Два первых торговых круга')+'</h2><p>'+(s.firstDayComplete?'Можно подвести итоги и привести лавку в порядок перед новым рассветом.':'Купите первый мешок и выдайте первую посылку, затем повторите торговый круг. Сразу после второй выдачи появится предложение восстановить лавку.')+'</p><button id="reviewRestoration" class="primary" '+(!s.firstDayComplete||!s.firstPaid?'disabled':'')+'>Итоги дня и восстановление</button>');
      $('reviewRestoration').onclick=()=>{closeModal();Restoration.prompt();};return;
    }
    modal('<span class="brief-eyebrow">ПРЕОБРАЖЕНИЕ СУЩЕСТВУЮЩЕЙ ЛАВКИ</span><h2>Лавка и помощники</h2><p>В кассе '+state.gold+' монет · выполнено '+state.totalOrders+' поручений</p><div class="story-business-grid"><article><h3>Возвращение лавки к жизни</h3><p>После первого дня убираем пыль и паутину и чиним окно. После второго — обновляем лавку: стеллажи, уголок у окна и вывеска гильдии.</p><button id="restoreShop" class="primary" '+(s.restored||!s.firstPaid||state.gold<REPAIR_COST?'disabled':'')+'>'+(s.restored?(s.shopRestorationStage>=2?'Лавка обновлена':'Лавка убрана'):'Убрать и починить · 30 монет')+'</button><small>Уборка — после первого дня; обновление — после второго.</small></article><article><h3>Борин, гном-сортировщик</h3><p>Сам раскладывает известные вещи по коробкам, пока вы собираете посылку. Неизвестные складывает на отдельный поднос. После основания гильдии закупки можно передать автоторговле.</p><button id="hireDwarf" class="primary" '+(hired||!canHire?'disabled':'')+'>'+(hired?'Борин нанят':'Нанять · 120 монет')+'</button><small>Борин приходит после первой посылки второго дня. После найма он сразу начинает сортировку. Обработка купленной партии — 2 монеты; если на неё не хватает, Борин ждёт.</small></article></div>'+(hired?'<div class="story-worker-controls"><p id="workerDetails"></p><button id="toggleDwarf">'+(state.dwarf.enabled?'Приостановить Борина':'Включить автосортировку Борина')+'</button><button id="openUnknownTray">Неизвестные на подносе · '+state.unknownTray.length+'</button><button id="contractsBookButton">Листы договорённостей</button></div>':'')+goblinBusiness()+'<p class="story-future">После первой выдачи Грика можно основать гильдию и включить автоторговлю. На карте гильдию ждёт башня за 1000 золотых.</p>',{wide:true});
    $('restoreShop').onclick=()=>{closeModal();restore();showBusiness();};$('hireDwarf').onclick=()=>{closeModal();hire();};
    if($('contractsBookButton'))$('contractsBookButton').disabled=!Contracts.ready()&&!Contracts.signedCount();
    if(hired){$('workerDetails').textContent='Борин работает с вашей настоящей поставкой. Предмет можно забрать вручную в любой момент; во время паузы работа останавливается.';$('toggleDwarf').onclick=()=>{Dwarf.setEnabled(!state.dwarf.enabled);closeModal();render();save();};$('openUnknownTray').onclick=()=>{closeModal();openTray();};$('contractsBookButton').onclick=()=>{closeModal();Contracts.openBook();};}
    bindGoblinBusiness();
  }
  function goblinBusiness(){
    if(!state.dwarf?.hired||!state.story.completedB2&&!state.goblin?.hired)return '';
    const g=Goblin.ensure(),status=Goblin.status(),contracts=Contracts.ensure();
    const signed=Object.entries(contracts).filter(([,c])=>c.signed);
    const policies=g.hired?'<div class="staff-contract-policies">'+(signed.length?signed.map(([key,c])=>{
      const order=(state.orders||[]).find(o=>o.regularKey===key),name=key==='chef'?'Городская кухня':'Мастерская алхимика';
      return '<article><div><strong>'+name+'</strong><small>'+(c.delegated?'Текущую и следующие собирает Грик':'Текущую и следующие собираете вы')+'</small></div><button data-upgrade-delegate="'+key+'">'+(c.delegated?'Вернуть мне · следующие тоже':'Поручить Грику · повторять')+'</button>'+(order?'<button data-upgrade-manual="'+order.id+'" '+(Goblin.isAssigned(order)?'disabled':'')+'>Собрать вручную</button>':'')+'</article>';
    }).join(''):'<p>Постоянные договорённости появятся после покупки башни.</p>')+'</div>':'';
    const parcels=g.hired?'<div class="staff-contract-policies">'+(allOrders().filter(o=>!o.regularKey&&o.accepted!==false).map(o=>'<article><div><strong>'+(o.title||'Обычная посылка')+' · №'+o.id+'</strong><small>'+o.packed.length+'/'+o.recipe.reduce((n,r)=>n+r.count,0)+' · '+o.reward+' монет · '+(Goblin.isAssigned(o)?'Собирает Грик':'Собираете вы')+'</small></div><button data-upgrade-parcel="'+o.id+'">'+(Goblin.isAssigned(o)?'Вернуть эту посылку мне':'Поручить эту посылку Грику')+'</button></article>').join('')||'<p>Примите обычное поручение у стойки, затем выберите посылку для Грика здесь.</p>')+'</div>':'';
    return '<section id="goblinUpgrades" class="staff-goblin-controls"><img class="staff-upgrade-portrait" src="assets/goblin-grik-packer.png" alt="Грик"><div class="staff-upgrade-heading"><span class="brief-eyebrow">СБОРКА И ВЫДАЧА</span><h3>Грик, гоблин-комплектовщик</h3><p>'+status.label+'</p></div>'+(g.hired?'<button id="toggleGoblinUpgrades" class="primary">'+(g.enabled?'Приостановить Грика':'Включить работу Грика')+'</button>':'<button id="hireGoblinUpgrades" class="primary" '+(!Goblin.canHire()?'disabled':'')+'>Нанять Грика · 240 монет</button>')+'<p class="staff-policy-note">Выберите отдельную посылку для Грика. После запуска автоторговли он также принимает новые обычные поручения; ранее принятые ручные посылки остаются за вами. Комиссия 3 монеты списывается один раз при выдаче.</p>'+parcels+policies+'</section>';
  }
  function bindGoblinBusiness(){
    if($('hireGoblinUpgrades'))$('hireGoblinUpgrades').onclick=()=>{closeModal();hireGoblin();showBusiness();};
    if($('toggleGoblinUpgrades'))$('toggleGoblinUpgrades').onclick=()=>{Goblin.setEnabled(!state.goblin.enabled);closeModal();render();save();};
    document.querySelectorAll('[data-upgrade-parcel]').forEach(b=>b.onclick=()=>{
      const order=allOrders().find(o=>o.id===Number(b.dataset.upgradeParcel));
      closeModal();if(order)Goblin.assign(order,!Goblin.isAssigned(order));render();save();showBusiness();
      document.querySelector('[data-upgrade-parcel="'+b.dataset.upgradeParcel+'"]')?.focus();
    });
    document.querySelectorAll('[data-upgrade-delegate]').forEach(b=>b.onclick=()=>{
      const key=b.dataset.upgradeDelegate,c=state.story.regularContracts[key];if(!c||!state.goblin?.hired)return;
      closeModal();Contracts.setDelegated(key,!c.delegated);render();save();showBusiness();
    });
    document.querySelectorAll('[data-upgrade-manual]').forEach(b=>b.onclick=()=>{
      const order=(state.orders||[]).find(o=>o.id===Number(b.dataset.upgradeManual));
      closeModal();if(order&&!Goblin.isAssigned(order))openOrder(order);
    });
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
    if(!s.completedB3&&(state.goblin?.deliveries||0)>0){s.completedB3=true;s.completedB3At=s.elapsed;save();toast('Грик выдал настоящую посылку. Лавка теперь работает вместе с вами.');}
    if(s.completedB2)return;
    if((d.completedBatches||0)>0&&state.totalOrders>(s.hireOrders??state.totalOrders)){
      s.completedB2=true;s.completedAt=s.elapsed;save();
      toast('Лавка работает вдвоём: Борин разобрал поставку, а вы выдали посылку. Первая глава пройдена!');
    }
  }
  function afterLoad(){if(!enabled())return;ensure();Dwarf.ensure();Goblin.ensure();Goblin.reconcile();state.ended=false;render();if(!state.story.letterRead)letter();else{Restoration.afterLoad();if(!secondDayMilestones())goblinMilestones();}if(typeof Automation!=='undefined')Automation.afterLoad();if(typeof Guild!=='undefined')Guild.afterLoad();}
  function guide(){
    if(typeof BagPour!=='undefined'&&BagPour.active()){clearTutorialHighlight();$('tutorialGuide')?.remove();return;}
    const t=state.tutorial;if(!enabled()||!t?.active||!state.started){clearTutorialHighlight();$('tutorialGuide')?.remove();return;}
    if(!state.story.letterRead){clearTutorialHighlight();$('tutorialGuide')?.remove();return;}
    const modalOpen=!$('modal').classList.contains('hidden');$('autoSortButton').disabled=true;
    if(modalOpen){
      if($('dirt')){if($('cleanKey').disabled)tutorialGuide(null,'Находка распознана. Сейчас окно закроется само.');else tutorialGuide($('dirt'),'Зажмите левую кнопку и очищайте находку круговыми движениями. Можно нажимать «Распознать».',true);}
      else if($('acceptOrder'))tutorialGuide($('acceptOrder'),'Повару нужны два кусочка мяса. Они уже лежат на складе. Примите поручение.');
      else tutorialGuide($('closeModal'),'Закройте окно, чтобы вернуться к первому заказу.');return;
    }
    if(!state.story.inheritedOpened){tutorialGuide($('buyBag')||$('bag'),'Купите первый мешок за 10 монет и разберите находки на столе.');return;}
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
  return {enabled,ensure,start,startTutorial,arrivals,advance,createOrder,onBagPurchased,onOrderAccepted,onOrderDelivered,restore,hire,hireGoblin,setup,update,render:decorate,showBusiness,openTray,afterRecognition,afterLoad,guide,checkCompletion,signRegular:Contracts.signRegular};
})();
