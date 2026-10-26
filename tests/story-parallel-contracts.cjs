'use strict';
// Real purchase/packing/dispatch paths in isolated Edge storage. The renderer
// keeps drawing; the test advances simulation time explicitly for a stable ledger.
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
const leaf='#contractOfferBoard [data-contract-key="chef"]';
async function load(page){await page.goto(BASE);await page.waitForFunction(()=>window.LootkeeperEngine?.ready);await page.evaluate(()=>{LootkeeperEngine.bridge.step=()=>{};});}
async function fixture(page,day=3){await page.evaluate(day=>{
  cancelDrag();forceCloseModal();BagPour.clear();City.close();state=freshState();
  Object.assign(state,{started:true,day,gold:700,orderUid:0,screen:'reception',orders:[],order:null,offers:[],bag:[],stock:[],unknownTray:[],visitorCooldown:0,tutorial:{active:false},collection:items.map(x=>x.id),city:{towerOwned:false}});
  state.story={version:1,letterRead:true,inheritedOpened:true,firstPaid:true,restored:true,shopRestorationStage:day===2?1:2,firstDayFlowVersion:2,firstDayComplete:true,firstDayPurchases:2,firstDayDeliveries:2,secondDayFlowVersion:2,secondDayActive:day===2,secondDayPurchases:3,secondDayDeliveries:1,secondDaySorted:3,secondDaySupplyRun:0,elapsed:50,nextVisit:0,forceSupplier:true,dwarfEncounterSeen:true,goblinEncounterSeen:true,completedB2:true,manualAfterDwarf:1};
  state.dwarf={hired:true,enabled:false,batches:[]};state.goblin={hired:true,enabled:false};
  for(const type of [38,31,32,0,1,6,24])for(let i=0;i<8;i++){const x=makeItem(type);x.unknown=false;state.stock.push(x);}
  Story.ensure();Dwarf.ensure();Goblin.ensure();render();save();
},day);}
async function guest(page){return page.evaluate(()=>{
  forceCloseModal();state.story.nextVisit=0;state.visitorCooldown=0;Story.advance(.01);render();save();
  const g=counterGuest();return g?{kind:g.kind,id:g.value.id,uids:g.value.loot?.map(x=>x.uid)}:null;
});}
async function purchase(page){
  const before=await page.evaluate(()=>({gold:state.gold,uids:counterGuest().value.loot.map(x=>x.uid)}));
  await page.evaluate(()=>setScreen('reception'));await page.locator('#buyBag').click();
  await page.evaluate(()=>{BagPour.advance(1);BagPour.advance(1);for(const x of [...state.bag])sortItem(x.uid,items[x.type].cat);Story.advance(.01);render();save();});
  assert.equal(await page.evaluate(()=>state.gold),before.gold-10);
  assert.equal(await page.evaluate(()=>state.bag.length),0);
  for(const uid of before.uids)assert.equal(await page.evaluate(uid=>state.stock.some(x=>x.uid===uid),uid),true);
}
async function sale(page){
  await page.evaluate(()=>setScreen('reception'));await page.locator('#receptionOrder').click();await page.locator('#acceptOrder').click();
  const sale=await page.evaluate(()=>{
    const o=state.orders.find(o=>!o.regularKey&&o.accepted!==false);openOrder(o);const gold=state.gold;
    for(const row of o.recipe)while(remaining(row)>0){const x=state.stock.find(x=>x.type===row.type&&!isUnknown(x)&&Goblin.canUse(x.uid,o.id));if(!x)throw Error('No real available sale component');packItem(x.uid);}
    render();return {id:o.id,reward:o.reward,gold,uids:o.packed.map(x=>x.uid)};
  });
  await page.locator('#ship').click();assert.equal(await page.evaluate(()=>state.gold),sale.gold+sale.reward);
  for(const uid of sale.uids)assert.equal(await page.evaluate(uid=>owned().some(x=>x.uid===uid),uid),false);
}
async function snapshot(page){return page.evaluate(()=>({gold:state.gold,uid:state.uid,orderUid:state.orderUid,owned:owned().map(x=>({uid:x.uid,type:x.type,tablePos:x.tablePos,tableAngle:x.tableAngle===0?0:x.tableAngle})),orders:state.orders.map(o=>({id:o.id,packed:o.packed.map(x=>x.uid),reserved:o.reservedUids.slice(),assignedTo:o.assignedTo})),switches:[state.dwarf.enabled,state.goblin.enabled],job:state.goblin.job,fees:state.goblin.feesPaid,receipts:state.goblin.receipts}));}
async function reload(page){await page.evaluate(()=>save());await page.reload();await page.waitForFunction(()=>window.LootkeeperEngine?.ready);await page.evaluate(()=>{LootkeeperEngine.bridge.step=()=>{};});await page.locator('#loadGame').click();}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
  const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await load(page);
  for(const signed of [false,true]){
    await fixture(page,2);await page.evaluate(()=>{state.story.forceSupplier=false;Contracts.maybeOffer();render();});
    await page.locator('#laterContractOffer').click();assert.equal(await page.evaluate(()=>state.story.regularContracts.chef.signed),false);
    let partial=null;
    if(signed){await page.locator(leaf+' .agreement-open-offer').click();await page.locator('#signOfferSheet').click();partial=await page.evaluate(()=>{
      const o=Contracts.current('chef'),x=state.stock.find(x=>x.type===38&&Goblin.canUse(x.uid,o.id));packItem(x.uid);state.story.secondDayChefFlow=true;Goblin.reconcile();save();return {id:o.id,packed:o.packed.map(x=>x.uid),reserved:o.reservedUids.slice()};
    });}
    for(let i=0;i<3;i++){assert.equal((await guest(page))?.kind,'bag');await purchase(page);}
    assert.equal((await guest(page))?.kind,'order','Kitchen does not replace the next ordinary buyer');await sale(page);
    await page.evaluate(()=>{Story.advance(.1);render();});assert.equal(await page.locator('#finishSecondDay').isVisible(),true,'Day two ends with the optional kitchen untouched');
    assert.equal(await page.evaluate(()=>state.story.secondDayDeliveries),2);assert.equal(await page.evaluate(()=>state.story.regularContracts.chef.deliveries),0);
    const before=await snapshot(page);await page.locator('#startThirdDay').click();await page.evaluate(()=>{Restoration.advance(4);render();save();});assert.equal(await page.evaluate(()=>state.day),3);assert.deepEqual(await snapshot(page),before);
    if(signed){await reload(page);assert.deepEqual(await page.evaluate(()=>{const o=Contracts.current('chef');return {id:o.id,packed:o.packed.map(x=>x.uid),reserved:o.reservedUids.slice()};}),partial);}
    else{await page.locator(leaf+' .agreement-open-offer').click();await page.locator('#signOfferSheet').click();assert.equal(await page.evaluate(()=>Contracts.current('chef').reward),200,'A postponed kitchen is available after the next day');}
  }
  console.log('PASS: postponed and half-packed kitchen allow three paid suppliers, ordinary second sale and day3; partial UID/reserves/switches persist.');

  await fixture(page,3);await page.evaluate(()=>{Contracts.signRegular('chef');const o=Contracts.current('chef'),x=state.stock.find(x=>x.type===38&&Goblin.canUse(x.uid,o.id));openOrder(o);packItem(x.uid);render();save();});
  const kitchen=await page.evaluate(()=>({id:Contracts.current('chef').id,packed:Contracts.current('chef').packed.map(x=>x.uid),reserved:Contracts.current('chef').reservedUids.slice()})),visits=[];
  for(let i=0;i<15;i++){
    const g=await guest(page);assert.ok(g,'A real visitor is invited');visits.push(g.kind==='bag'?'A':'P');
    if(i===6){const waiting=await snapshot(page),pointer=await page.evaluate(()=>state.story.earlyVisitIndex);await reload(page);assert.deepEqual(await snapshot(page),waiting);assert.equal(await page.evaluate(()=>state.story.earlyVisitIndex),pointer);assert.equal(await page.evaluate(()=>counterGuest().kind),g.kind);}
    if(g.kind==='bag')await purchase(page);else await sale(page);
    assert.deepEqual(await page.evaluate(()=>{const o=Contracts.current('chef');return {id:o.id,packed:o.packed.map(x=>x.uid),reserved:o.reservedUids.slice()};}),kitchen);
  }
  assert.deepEqual(visits,Array.from({length:3},()=>['A','P','A','A','P']).flat());
  await page.screenshot({path:'audit_source/parallel-contracts-rhythm-1280.png'});
  console.log('PASS: three exact A-P-A-A-P cycles before tower; kitchen does not consume slots, ordinary sales use real stock, pending guest/phase survive reload.');

  // A save from the old 3:1 policy can already contain its next supplier.
  // Convert its counter once, without removing or recreating that visitor.
  await fixture(page,3);await page.evaluate(()=>Contracts.postpone('chef'));assert.equal((await guest(page))?.kind,'bag');
  const oldWaiting=await page.evaluate(()=>{delete state.story.earlyVisitVersion;delete state.story.earlyVisitIndex;state.story.earlySupplyRun=1;state.story.forceSupplier=false;return JSON.stringify(state.offers);});
  const oldOwned=await snapshot(page);await page.evaluate(()=>{Story.ensure();Story.ensure();save();});assert.deepEqual(await snapshot(page),oldOwned);assert.equal(await page.evaluate(()=>JSON.stringify(state.offers)),oldWaiting);assert.equal(await page.evaluate(()=>state.story.earlyVisitIndex),1);
  await reload(page);assert.equal(await page.evaluate(()=>JSON.stringify(state.offers)),oldWaiting);await purchase(page);assert.equal((await guest(page))?.kind,'order');await sale(page);

  // A buyer slot with all known goods reserved is retained until another paid
  // supplier provides enough unreserved goods; no fictitious order or grant.
  await fixture(page,3);await page.evaluate(()=>{Contracts.signRegular('chef');state.stock=state.stock.filter(x=>[38,31,32].includes(x.type)).filter((x,i,list)=>list.filter(y=>y.type===x.type).indexOf(x)<2);Goblin.reconcile();state.story.earlyVisitIndex=1;state.story.forceSupplier=false;render();});
  assert.equal((await guest(page))?.kind,'bag');assert.equal(await page.evaluate(()=>state.story.earlyVisitIndex),1,'An impossible buyer slot waits through a necessary extra supplier');await purchase(page);
  for(let i=0;i<4;i++){const g=await guest(page);if(g.kind==='order'){await sale(page);break;}assert.equal(await page.evaluate(()=>state.story.earlyVisitIndex),1);await purchase(page);if(i===3)throw Error('Extra real supplies did not unblock the ordinary sale');}
  assert.equal(await page.evaluate(()=>state.story.earlyVisitIndex),2);

  await fixture(page,4);await page.evaluate(()=>{state.city.towerOwned=true;Contracts.signRegular('chef');Contracts.signRegular('alchemy');state.day=5;Contracts.signRegular('royal');const c=Contracts.current('chef'),a=Contracts.current('alchemy');for(const o of [c,a]){o.reward=120;o.originalReward=120;delete o.contractRewardVersion;const x=state.stock.splice(state.stock.findIndex(x=>x.type===o.recipe[0].type),1)[0];o.packed.push(x);}state.story.regularContracts.chef.deliveries=1;state.story.regularContracts.chef.deliveryOrderIds=[999];state.goblin.receipts=[{orderId:999,regularKey:'chef',gross:120,fee:3,uids:[9000]}];state.goblin.gross=120;state.goblin.feesPaid=3;Goblin.reconcile();save();});
  const before=await snapshot(page);await page.evaluate(()=>{Contracts.ensure();Contracts.ensure();render();});assert.deepEqual(await snapshot(page),before,'Migration preserves money, original ownership, packing/reserves, jobs and old receipt');
  assert.deepEqual(await page.evaluate(()=>state.orders.map(o=>[o.regularKey,o.reward,o.originalReward])),[['chef',200,200],['alchemy',200,200],['royal',360,360]]);await reload(page);assert.deepEqual(await snapshot(page),before);
  assert.deepEqual(await page.evaluate(()=>state.orders.map(o=>[o.regularKey,o.reward])),[['chef',200],['alchemy',200],['royal',360]]);
  assert.deepEqual(await page.evaluate(()=>state.goblin.receipts),before.receipts);assert.deepEqual(errors,[]);
  console.log('PASS: insufficient free stock recovers through a paid supplier; unpaid kitchen/alchemy migrate120→200, royal360 and historical gross120/fee3 remain intact across reload.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
