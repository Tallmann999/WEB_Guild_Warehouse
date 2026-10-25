'use strict';
// Existing day2 queues, a half-packed parcel, disabled helpers and future 3:1
// visits are exercised through real controls in isolated browser storage.
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
async function guest(p){for(let i=0;i<20;i++){if(await p.evaluate(()=>!!Contracts.activeOffer())){await p.evaluate(()=>setScreen('reception'));await p.locator('#laterContractOffer').click();}if(await p.evaluate(()=>!!counterGuest()))return;await p.evaluate(()=>{Story.advance(.5);render();});}throw Error('No visitor');}
async function sort(p){
  await p.waitForFunction(()=>!BagPour.active());
  while(await p.evaluate(()=>state.bag.length)){
    const x=await p.evaluate(()=>{for(const e of document.querySelectorAll('#pile .item')){const r=e.getBoundingClientRect();if(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.item')===e){const x=state.bag.find(x=>x.uid===Number(e.dataset.uid));return {uid:x.uid,cat:items[x.type].cat};}}throw Error('No clickable original');});
    await p.locator('#pile [data-uid="'+x.uid+'"]').click();await p.locator('#shelves [data-cat="'+x.cat+'"]').click();
  }
}
async function finish(p,id){
  await p.evaluate(()=>setScreen('work','sort'));await p.locator('#orderBoard [data-order-id="'+id+'"]').click();
  while(!await p.evaluate(()=>orderComplete())){
    const x=await p.evaluate(()=>{const r=state.order.recipe.find(r=>remaining(r)>0),x=state.stock.find(x=>x.type===r.type&&Goblin.canUse(x.uid,state.order.id));return {uid:x.uid,cat:items[x.type].cat};});
    await p.locator('#shelves [data-cat="'+x.cat+'"]').click();await p.locator('#tidySource').click();await p.locator('#sourceItems [data-uid="'+x.uid+'"]').click();await p.locator('#parcelDrop').click();
  }
  await p.locator('#ship').click();
}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
  const p=await browser.newPage({viewport:{width:820,height:850}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);
  const old=await p.evaluate(()=>{
    forceCloseModal();state=freshState();state.started=true;state.day=2;state.gold=233;state.orderUid=1;state.tutorial={active:false};
    state.story={letterRead:true,inheritedOpened:true,firstPaid:true,restored:true,firstDayFlowVersion:2,firstDayComplete:true,firstDayPurchases:2,firstDayDeliveries:2,secondDayFlowVersion:1,secondDayActive:true,secondDayPurchases:2,secondDayDeliveries:1,secondDaySorted:2,dwarfEncounterSeen:true,elapsed:20,nextVisit:999};
    state.dwarf={hired:true,enabled:false,batches:[],spent:120};state.goblin={hired:true,enabled:false,spent:240};state.city={towerOwned:false};state.unknownTray=[];
    const packed=makeItem(38),free=makeItem(38);state.stock=[free];const o={id:1,accepted:true,customer:4,reward:90,originalReward:90,recipe:[{type:38,count:2}],packed:[packed],reservedUids:[free.uid],storyOrder:true,title:'Сохранённая посылка'};state.orders=[o];state.order=o;
    const loot=[0,0,1,1,6,6,38,38].map(type=>{const x=makeItem(type);x.unknown=false;return x;});state.offers=[{visitor:0,price:10,qualityRolled:true,arrivalSerial:7,loot}];
    state.totalOrders=3;save();return {owned:owned().map(x=>x.uid).sort((a,b)=>a-b),offer:loot.map(x=>x.uid),packed:packed.uid,gold:state.gold};
  });
  await p.reload();await p.locator('#loadGame').click();
  assert.equal(await p.evaluate(()=>state.story.secondDayFlowVersion),2);assert.equal(await p.evaluate(()=>state.gold),old.gold);assert.deepEqual(await p.evaluate(()=>owned().map(x=>x.uid).sort((a,b)=>a-b)),old.owned);
  assert.equal(await p.evaluate(()=>state.dwarf.enabled),false,'An intentionally stopped old Borin stays stopped');assert.equal(await p.evaluate(()=>state.goblin.enabled),false);
  assert.deepEqual(await p.evaluate(()=>state.offers[0].loot.map(x=>x.uid)),old.offer);assert.deepEqual(await p.evaluate(()=>state.orders[0].packed.map(x=>x.uid)),[old.packed]);
  await finish(p,1);assert.equal(await p.evaluate(()=>state.gold),323,'Old partial parcel pays once without rewriting its price');
  await p.evaluate(()=>{state.visitorCooldown=0;render();});await p.locator('#buyBag').click();assert.equal(await p.evaluate(()=>state.gold),313);await sort(p);
  await p.waitForSelector('#finishSecondDay');assert.equal(await p.evaluate(()=>state.story.secondDayDeliveries),2);assert.equal(await p.evaluate(()=>state.story.secondDayPurchases),3,'Paid old counters are retained rather than changed to six');
  assert.deepEqual(await p.evaluate(()=>owned().map(x=>x.uid).sort((a,b)=>a-b)),[...old.offer].sort((a,b)=>a-b));
  await p.reload();await p.locator('#loadGame').click();assert.equal(await p.evaluate(()=>state.gold),313);await p.waitForSelector('#finishSecondDay');

  // A pre-quota save already employing Borin keeps its open-ended day2, while
  // newly arriving visitors adopt three suppliers per buyer without a reset.
  await p.evaluate(()=>{forceCloseModal();state.day=2;state.seconds=180;state.gold=200;state.orders=[];state.order=null;state.offers=[];state.bag=[];state.stock=[];state.unknownTray=[];delete state.story.secondDayFlowVersion;delete state.story.secondDayActive;delete state.story.secondDayComplete;delete state.story.secondDayEndPending;state.story.nextVisit=0;state.story.completedB2=true;state.story.goblinEncounterSeen=true;state.story.forceSupplier=false;state.dayBought=0;state.dayOrders=0;state.collection=items.map(x=>x.id);Story.ensure();render();save();});
  assert.equal(await p.evaluate(()=>state.story.secondDayActive),false,'Advanced pre-quota save retains its ongoing day');
  for(let i=0;i<3;i++){await guest(p);assert.equal(await p.evaluate(()=>counterGuest().kind),'bag');await p.evaluate(()=>setScreen('reception'));await p.locator('#buyBag').click();await sort(p);}
  await guest(p);assert.equal(await p.evaluate(()=>counterGuest().kind),'order','An old hired day2 path also gets 25% buyers');
  assert.equal(await p.evaluate(()=>state.gold),170);assert.equal(await p.evaluate(()=>state.dwarf.enabled),false);assert.equal(await p.evaluate(()=>Contracts.signedCount()),0);assert.deepEqual(errors,[]);
  console.log('PASS: old day2 partial parcel/queued goods/money/disabled staff retained at820; one payment across reload; pre-quota hired saves receive three new suppliers then buyer.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
