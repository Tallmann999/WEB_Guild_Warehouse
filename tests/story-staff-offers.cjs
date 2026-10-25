'use strict';
// Day3 hire and explicit ordinary parcels work before tower/contracts; legacy policies stay intact.
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
const inventory=p=>p.evaluate(()=>owned().map(x=>x.uid).sort((a,b)=>a-b));
async function fixture(p){
  return p.evaluate(()=>{
    cancelDrag();forceCloseModal();BagPour.clear();state=freshState();state.orderUid=0;state.started=true;state.screen='reception';state.day=3;state.gold=500;state.tutorial={active:false};
    state.orders=[];state.order=null;state.offers=[];state.bag=[];state.junk=[];state.unknownTray=[];
    state.story={version:1,letterRead:true,inheritedOpened:true,firstPaid:true,restored:true,firstDayFlowVersion:2,firstDayComplete:true,firstDayPurchases:2,firstDayDeliveries:2,secondDayFlowVersion:1,secondDayActive:false,dwarfEncounterSeen:true,completedB2:false,hireOrders:4,manualAfterDwarf:0,elapsed:20,nextVisit:999,guild:{version:1,founded:true,name:'Гильдия теста',phase:'complete'},automation:{version:1,enabled:false,activated:false},regularContracts:{chef:{signed:false,delegated:false,deliveries:0,nextAt:9999},alchemy:{signed:false,delegated:false,deliveries:0,nextAt:9999}}};
    state.city={towerOwned:false};state.dwarf={hired:true,enabled:false,batches:[],completedBatches:1};state.goblin={hired:false,enabled:false};
    state.stock=[0,0,38,38,31,31,32,32].map(type=>{const x=makeItem(type);x.unknown=false;return x;});
    const manual={id:++state.orderUid,accepted:true,customer:0,reward:90,title:'Последняя ручная посылка перед встречей',recipe:[{type:0,count:2}],packed:[],reservedUids:[],storyOrder:true};
    state.orders=[manual];state.order=manual;state.totalOrders=4;Story.ensure();Dwarf.ensure();Goblin.ensure();Goblin.reconcile();render();save();return {order:manual.id,ids:owned().map(x=>x.uid)};
  });
}
async function shipManual(p,id){
  await p.evaluate(()=>setScreen('work','sort'));await p.locator('#orderBoard [data-order-id="'+id+'"]').click();
  while(!await p.evaluate(()=>orderComplete())){
    const x=await p.evaluate(()=>{const r=state.order.recipe.find(r=>remaining(r)>0),x=state.stock.find(x=>x.type===r.type&&Goblin.canUse(x.uid,state.order.id));return {uid:x.uid,cat:items[x.type].cat};});
    await p.locator('#shelves [data-cat="'+x.cat+'"]').click();await p.locator('#tidySource').click();await p.locator('#sourceItems [data-uid="'+x.uid+'"]').click();assert.equal(await p.evaluate(()=>drag?.uid),x.uid);await p.locator('#parcelDrop').click();
  }
  await p.locator('#ship').click();
}
async function restore(p,snapshot){
  await p.evaluate(snapshot=>{cancelDrag();forceCloseModal();state=JSON.parse(JSON.stringify(snapshot));save();},snapshot);await p.reload();await p.locator('#loadGame').click();
}
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);
    const initial=await fixture(p);assert.equal(await p.evaluate(()=>Goblin.eligible()),false,'Before the shared Borin milestone Grik stays locked');
    await shipManual(p,initial.order);await p.waitForSelector('#goblinEncounter');
    assert.equal(await p.evaluate(()=>state.story.completedB2),true);assert.equal(await p.evaluate(()=>Contracts.signedCount()),0);assert.equal(await p.evaluate(()=>state.city.towerOwned),false);assert.equal(await p.evaluate(()=>state.gold),590,'The triggering parcel pays only its real reward');
    const offered=await p.evaluate(()=>JSON.parse(JSON.stringify(state))),offeredIds=await inventory(p);
    await p.reload();await p.locator('#loadGame').click();await p.waitForSelector('#goblinEncounter');assert.equal(await p.evaluate(()=>state.gold),590,'An unanswered hiring offer survives reload without a charge');
    await p.locator('#acceptGoblin').click();assert.equal(await p.evaluate(()=>state.goblin.hired),true);assert.equal(await p.evaluate(()=>state.goblin.enabled),false,'Accepting hire leaves the automation switch off');
    assert.equal(await p.evaluate(()=>state.gold),350);assert.equal(await p.evaluate(()=>state.goblin.spent),240);assert.deepEqual(await inventory(p),offeredIds,'Hiring preserves every unsold instance');
    await p.waitForSelector('#toggleGoblinUpgrades');assert.equal(await p.evaluate(()=>Goblin.hire()),false);assert.equal(await p.evaluate(()=>state.gold),350,'Hiring twice cannot spend twice');
    assert.equal(await p.evaluate(()=>state.story.regularContracts.chef.delegated),false,'Hiring never grants permission for future parcels');
    assert.equal(await p.locator('[data-upgrade-delegate]').count(),0,'No agreement is invented to enable day3 Grik');
    await p.locator('#closeModal').click();
    await p.setViewportSize({width:820,height:850});await p.waitForFunction(()=>Math.abs(scale-820/1280)<.001);
    const parcels=await p.evaluate(()=>{
      const a={id:++state.orderUid,accepted:true,customer:4,reward:90,title:'Обычная посылка Грику',recipe:[{type:31,count:2},{type:38,count:2}],packed:[],reservedUids:[],storyOrder:true};
      const b={id:++state.orderUid,accepted:true,customer:4,reward:90,title:'Посылка хозяина',recipe:[{type:32,count:2}],packed:[],reservedUids:[],storyOrder:true};
      state.orders=[a,b];state.order=a;state.story.nextVisit=999;Goblin.reconcile();render();save();return {a:a.id,b:b.id,ids:owned().map(x=>x.uid).sort((a,b)=>a-b)};
    });
    await p.evaluate(()=>setScreen('work','sort'));await p.locator('#orderBoard [data-order-id="'+parcels.a+'"]').click();await p.locator('#shelves [data-cat="4"]').click();await p.locator('#tidySource').click();
    const partialUid=await p.evaluate(()=>state.stock.find(x=>x.type===31).uid);await p.locator('#sourceItems [data-uid="'+partialUid+'"]').click();await p.locator('#parcelDrop').click();
    await p.locator('#goblinWorkStatus').click();await p.locator('[data-upgrade-parcel="'+parcels.a+'"]').click();
    await p.locator('[data-upgrade-parcel="'+parcels.a+'"]').scrollIntoViewIfNeeded();
    const parcelControl=await p.locator('[data-upgrade-parcel="'+parcels.a+'"]').evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {inside:r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight,hit:hit===e||e.contains(hit)};});assert.deepEqual(parcelControl,{inside:true,hit:true},'Ordinary assignment control is visible and clickable after scrolling at820');
    await p.screenshot({path:'audit_source/goblin-ordinary-parcel-820.png'});
    assert.equal(await p.evaluate(id=>allOrders().find(o=>o.id===id).assignedTo,parcels.a),'goblin');assert.equal(await p.evaluate(()=>state.gold),350,'Assignment does not spend a fee');
    await p.locator('[data-upgrade-parcel="'+parcels.a+'"]').click();assert.deepEqual(await p.evaluate(id=>allOrders().find(o=>o.id===id).packed.map(x=>x.uid),parcels.a),[partialUid],'Returning a partial ordinary parcel keeps its original packed item');
    assert.deepEqual(await inventory(p),parcels.ids,'Assign/return preserves every reserved and packed instance');
    await p.locator('[data-upgrade-parcel="'+parcels.a+'"]').click();await p.locator('#toggleGoblinUpgrades').click();assert.equal(await p.evaluate(()=>state.goblin.enabled),true);
    await shipManual(p,parcels.b);assert.equal(await p.evaluate(id=>allOrders().find(o=>o.id===id)?.assignedTo,parcels.a),'goblin','The player can pack another parcel alongside Grik');
    await p.waitForFunction(id=>state.goblin.receipts.some(r=>r.orderId===id),parcels.a,{timeout:15000});
    assert.equal(await p.evaluate(()=>state.gold),527,'One manual sale90 and one actual worker sale90 minus commission3');assert.equal(await p.evaluate(()=>state.goblin.feesPaid),3);
    await p.reload();await p.locator('#loadGame').click();assert.equal(await p.evaluate(()=>state.gold),527,'Loading cannot replay the worker receipt');assert.equal(await p.evaluate(()=>state.goblin.receipts.length),1);
    assert.equal(await p.evaluate(()=>state.story.completedB3),true,'Ordinary day3 dispatch completes the worker introduction without a contract');
    assert.equal(await p.evaluate(()=>Contracts.signedCount()),0);assert.equal(await p.evaluate(()=>state.city.towerOwned),false);

    await restore(p,offered);await p.waitForSelector('#goblinEncounter');await p.locator('#declineGoblin').click();
    assert.equal(await p.evaluate(()=>state.goblin.hired),false);assert.equal(await p.evaluate(()=>state.gold),590);await p.waitForSelector('#hireGoblinUpgrades');assert.equal(await p.locator('#hireGoblinUpgrades').isEnabled(),true,'Refusal leaves a later hire in Improvements');
    await p.locator('#closeModal').click();await p.reload();await p.locator('#loadGame').click();assert.equal(await p.locator('#goblinEncounter').isVisible(),false,'A refused offer does not return on every load');
    await p.evaluate(()=>setScreen('reception'));await p.locator('#upgradesNav').click();await p.locator('#hireGoblinUpgrades').click();assert.equal(await p.evaluate(()=>state.goblin.hired),true);assert.equal(await p.evaluate(()=>state.gold),350);assert.equal(await p.evaluate(()=>state.goblin.enabled),false);
    await p.locator('#closeModal').click();

    // Unknown items routed to Borin's tray must be visible without opening it.
    await p.evaluate(()=>{state.goblin.enabled=false;state.unknownTray=[makeItem(9)];state.unknownTray[0].unknown=true;render();save();});
    for(const selector of ['#dwarfStation','#unknownTrayButton']){assert.equal(await p.locator(selector).evaluate(e=>e.classList.contains('has-unknown')),true);assert.match(await p.locator(selector).getAttribute('aria-label'),/1/);}
    await p.evaluate(()=>setScreen('work','sort'));assert.equal(await p.locator('#dwarfWorkStatus').evaluate(e=>e.classList.contains('has-unknown')),true);
    await p.locator('#unknownTrayButton').click();await p.locator('[data-tray-uid]').click();
    await p.evaluate(()=>{for(let i=0;i<80&&!$('cleanKey').disabled;i++)$('cleanKey').click();});await p.waitForSelector('#modal.hidden',{state:'attached'});
    assert.equal(await p.evaluate(()=>state.unknownTray.length),0);for(const selector of ['#dwarfStation','#unknownTrayButton','#dwarfWorkStatus'])assert.equal(await p.locator(selector).evaluate(e=>e.classList.contains('has-unknown')),false,'Recognizing the last unknown clears '+selector+' alert');
    assert.deepEqual(errors,[]);console.log('PASS: day3 Grik without tower/signature after shared Borin work; hire240 once, explicit ordinary assignment/partial return, real parallel manual sale, commission3 once/load, persistent decline and Borin alerts.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
