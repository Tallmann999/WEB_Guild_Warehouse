'use strict';
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
const ids=p=>p.evaluate(()=>owned().map(x=>x.uid).sort((a,b)=>a-b));
async function ready(p){await p.waitForFunction(()=>window.LootkeeperEngine?.ready);await p.evaluate(()=>{LootkeeperEngine.bridge.step=()=>{};});}
async function fixture(p,{empty=false,gold=4,automatic=false}={}){
  return p.evaluate(({empty,gold,automatic})=>{
    cancelDrag();forceCloseModal();BagPour.clear();state=freshState();Object.assign(state,{started:true,day:4,gold,screen:'reception',orderUid:0,orders:[],order:null,offers:[],bag:[],unknownTray:[],tutorial:{active:false},visitorCooldown:0,city:{version:1,towerOwned:false}});
    state.story={version:1,letterRead:true,inheritedOpened:true,firstPaid:true,restored:true,firstDayFlowVersion:2,firstDayComplete:true,firstDayPurchases:2,firstDayDeliveries:2,secondDayFlowVersion:2,secondDayActive:false,dwarfEncounterSeen:true,goblinEncounterSeen:true,completedB2:true,completedB3:true,manualAfterDwarf:0,elapsed:20,nextVisit:0,supplyCount:1,forceSupplier:true,earlySupplyRun:0,guild:{version:1,phase:'complete',founded:true,name:'Проверка кассы',draftName:'Проверка кассы'},automation:{activated:automatic,enabled:automatic}};
    state.dwarf={hired:true,enabled:true,batches:[]};state.goblin={hired:true,enabled:automatic};
    if(!empty){
      state.stock=[0,0,1,1,38,38,31,31].map(type=>{const x=makeItem(type);x.unknown=false;return x;});const packed=state.stock.splice(0,1);
      const manual={id:++state.orderUid,accepted:true,customer:0,reward:90,originalReward:90,recipe:[{type:0,count:2}],packed,reservedUids:[],assignedTo:'manual',storyOrder:true,title:'Прежняя частичная посылка'};state.orders.push(manual);state.order=manual;
    }
    const loot=[38,38,31,31,0,0,6,24].map(type=>{const x=makeItem(type);x.unknown=false;return x;});state.offers.push({visitor:0,loot,price:10,qualityRolled:true,arrivalSerial:state.arrivalSerial=1});
    Story.ensure();Dwarf.ensure();Goblin.ensure();Goblin.reconcile();Automation.afterLoad();const c=Contracts.ensure();for(const key of ['chef','alchemy'])Object.assign(c[key],{offerSeen:true,offerState:'later'});render();save();
    return {gold:state.gold,ids:owned().map(x=>x.uid).sort((a,b)=>a-b),offer:JSON.parse(JSON.stringify(state.offers[0])),manual:state.orders[0]?{id:state.orders[0].id,packed:state.orders[0].packed.map(x=>x.uid),reserved:state.orders[0].reservedUids.slice()}:null};
  },{empty,gold,automatic});
}
async function accept(p){await p.locator('#receptionOrder').click();await p.locator('#acceptOrder').click();}
async function manualSale(p,orderId){
  await p.locator('#orderBoard [data-order-id="'+orderId+'"] [data-parcel-action="manual"]').click();const shipped=[];
  while(!await p.evaluate(()=>orderComplete())){
    const x=await p.evaluate(()=>{const row=state.order.recipe.find(line=>remaining(line)>0),x=state.stock.find(x=>x.type===row.type&&Goblin.canUse(x.uid,state.order.id));return {uid:x.uid,cat:items[x.type].cat};});
    await p.locator('#shelves [data-cat="'+x.cat+'"]').click();const source=p.locator('#sourceItems [data-uid="'+x.uid+'"]');await source.scrollIntoViewIfNeeded();await source.click();assert.equal(await p.evaluate(()=>drag?.uid),x.uid);await p.locator('#parcelDrop').click();shipped.push(x.uid);
  }
  await p.locator('#ship').click();return shipped;
}
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);await ready(p);
    const original=await fixture(p);await p.evaluate(()=>{Story.arrivals();render();save();});
    assert.equal(await p.evaluate(()=>state.gold),4,'Recovering liquidity grants no money');assert.deepEqual(await ids(p),original.ids,'The buyer creates demand, not goods');
    assert.deepEqual(await p.evaluate(()=>state.story.deferredSupplierOffers[0]),original.offer,'The unaffordable supplier keeps all original offered instances and price');
    assert.deepEqual(await p.evaluate(()=>{const o=state.orders.find(o=>o.id===1);return {id:o.id,packed:o.packed.map(x=>x.uid),reserved:o.reservedUids};}),original.manual);
    const recovery=await p.evaluate(()=>{const o=state.orders.find(o=>o.recoveryOrder);return {id:o.id,reward:o.reward,count:o.recipe.reduce((n,line)=>n+line.count,0)};});assert.deepEqual(recovery,{id:2,reward:90,count:4});
    assert.equal(await p.evaluate(()=>state.story.supplierDebt||0),0);await accept(p);const shipped=await manualSale(p,recovery.id);
    assert.equal(await p.evaluate(()=>state.gold),94);assert.deepEqual(await ids(p),original.ids.filter(uid=>!shipped.includes(uid)));assert.equal(await p.evaluate(()=>state.story.supplierDebt||0),0,'A stock sale avoids new credit');
    assert.deepEqual(await p.evaluate(()=>state.orders.find(o=>o.id===1).packed.map(x=>x.uid)),original.manual.packed);assert.deepEqual(await p.evaluate(()=>state.orders.find(o=>o.id===1).reservedUids),original.manual.reserved);
    await p.evaluate(()=>{state.visitorCooldown=0;state.story.nextVisit=0;Story.arrivals();render();});assert.deepEqual(await p.evaluate(()=>state.offers[0].loot.map(x=>x.uid)),original.offer.loot.map(x=>x.uid));assert.equal(await p.evaluate(()=>state.offers[0].price),10);
    await p.locator('#buyBag').click();assert.equal(await p.evaluate(()=>state.gold),84);await p.evaluate(()=>{BagPour.clear();Dwarf.advance(.1);save();});assert.equal(await p.evaluate(()=>state.gold),82);await p.evaluate(()=>Dwarf.advance(.1));assert.equal(await p.evaluate(()=>state.gold),82,'The real batch fee is charged once');
    console.log('PASS: cash4 unlocks an actual90 stock buyer, protects manual partial/reserved originals, restores the exact deferred10 supplier, then pays10+2 once without credit/free rewards.');

    await fixture(p,{gold:11,automatic:true});await p.evaluate(()=>{Automation.advance(2);render();});assert.equal(await p.evaluate(()=>state.gold),11,'Autotrade reserves the2 sorting fee instead of spending its last11 on a10 bag');assert.equal(await p.evaluate(()=>state.bag.length),0);assert.equal(await p.evaluate(()=>state.story.deferredSupplierOffers.length),1);
    await fixture(p,{empty:true,gold:11,automatic:true});await p.evaluate(()=>{delete state.offers[0].price;Story.arrivals();render();});assert.equal(await p.evaluate(()=>Automation.resumeDeferredSupplier()),false,'A legacy unpriced proposal still reserves its real10 price plus2, rather than bouncing forever as a free offer');
    await p.evaluate(()=>{state.story.nextVisit=0;state.visitorCooldown=0;Story.arrivals();render();});assert.equal(await p.evaluate(()=>state.offers[0].credit),10);assert.equal(await p.evaluate(()=>state.gold),11);assert.deepEqual(await ids(p),[]);
    const credit=await fixture(p,{empty:true,automatic:true});await p.evaluate(()=>{Story.arrivals();state.visitorCooldown=0;state.story.nextVisit=0;Story.arrivals();render();});
    assert.equal(await p.evaluate(()=>state.offers[0].price),0);assert.equal(await p.evaluate(()=>state.offers[0].credit),10);assert.equal(await p.evaluate(()=>state.gold),4);assert.deepEqual(await ids(p),[],'A credit offer is not yet owned');
    await p.evaluate(()=>{Automation.advance(2);render();});assert.equal(await p.evaluate(()=>state.gold),4);assert.equal(await p.evaluate(()=>state.story.supplierDebt),10);const purchased=await ids(p);assert.equal(purchased.length,8);assert.equal(new Set(purchased).size,8);
    assert.deepEqual(await p.evaluate(()=>state.story.deferredSupplierOffers[0]),credit.offer);
    await p.evaluate(()=>{state.story.nextVisit=99999;state.visitorCooldown=99999;for(let i=0;i<3;i++)Dwarf.advance(10);Story.advance(.1);state.story.nextVisit=0;state.visitorCooldown=0;Story.arrivals();render();});
    assert.equal(await p.evaluate(()=>state.gold),2);assert.equal(await p.evaluate(()=>state.dwarf.feesPaid),1);assert.equal(await p.evaluate(()=>state.orders.find(o=>o.recoveryOrder)?.recipe.reduce((n,line)=>n+line.count,0)),4);
    await p.evaluate(()=>{Automation.advance(2);Goblin.advance(10);render();save();});const orderId=await p.evaluate(()=>state.orders.find(o=>o.recoveryOrder).id),sold=await p.evaluate(id=>state.orders.find(o=>o.id===id).packed.map(x=>x.uid),orderId);
    assert.equal(await p.evaluate(()=>state.gold),2,'Packing does not repay debt or grant revenue before the actual sale');await p.locator('#orderBoard [data-order-id="'+orderId+'"] [data-parcel-action="claim"]').click();
    assert.equal(await p.evaluate(()=>state.gold),79,'4 minus2 sorting plus90 sale minus3 commission minus10 supplier debt');assert.equal(await p.evaluate(()=>state.story.supplierDebt),0);assert.equal(await p.evaluate(()=>state.daySpent),15);assert.deepEqual(await ids(p),purchased.filter(uid=>!sold.includes(uid)));
    await p.reload();await ready(p);await p.locator('#loadGame').click();assert.equal(await p.evaluate(()=>state.gold),79);assert.equal(await p.evaluate(()=>state.story.supplierDebt),0);assert.equal(await p.evaluate(()=>state.goblin.receipts.length),1);
    const conversion=await p.evaluate(()=>{const offer=state.story.deferredSupplierOffers[0],uids=offer.loot.map(x=>x.uid);offer.price=0;offer.credit=10;const resumed=Automation.resumeDeferredSupplier();return {resumed,gold:state.gold,price:state.offers[0].price,credit:state.offers[0].credit,uids:state.offers[0].loot.map(x=>x.uid),original:uids,debt:state.story.supplierDebt};});
    assert.equal(conversion.resumed,true);assert.equal(conversion.gold,79);assert.equal(conversion.price,10);assert.equal(conversion.credit,0);assert.equal(conversion.debt,0);assert.deepEqual(conversion.uids,conversion.original,'Cash restored before purchase avoids unnecessary new credit and keeps the original offer goods');
    console.log('PASS: only an empty/unpayable shop gets a real10 deferred-price supply, paid2 sorting; the actual90 sale pays3 commission and10 debt exactly once; final79 survives reload with original uid.');
    await fixture(p,{empty:true});const single=await p.evaluate(()=>{const x=makeItem(18);x.unknown=false;state.stock.push(x);Story.arrivals();render();const o=state.orders.find(o=>o.recoveryOrder);return {uid:x.uid,id:o.id,count:o.recipe.reduce((n,line)=>n+line.count,0),reward:o.reward,gold:state.gold};});
    assert.equal(single.count,1);assert.equal(single.reward,22);assert.equal(single.gold,4);await accept(p);assert.deepEqual(await manualSale(p,single.id),[single.uid]);assert.equal(await p.evaluate(()=>state.gold),26);assert.deepEqual(await ids(p),[]);assert.equal(await p.evaluate(()=>state.story.supplierDebt||0),0);assert.deepEqual(errors,[]);
    console.log('PASS: a single free original sells for22 at the ordinary per-item rate instead of inventing a four-item parcel, restoring cash4to26 without credit.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
