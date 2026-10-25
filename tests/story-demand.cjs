'use strict';
// Surplus equipment must have an actual buyer; food orders must exclude organs.
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
async function offer(p,types,ordersCreated,{day=3}={}){return p.evaluate(({types,ordersCreated,day})=>{
  cancelDrag();forceCloseModal();BagPour.clear();state=freshState();state.orderUid=0;state.started=true;state.day=day;state.screen='reception';state.gold=500;state.tutorial={active:false};state.orders=[];state.order=null;state.offers=[];state.bag=[];state.unknownTray=[];
  state.story={version:1,letterRead:true,inheritedOpened:true,firstPaid:true,restored:true,firstDayFlowVersion:2,firstDayComplete:true,firstDayPurchases:2,firstDayDeliveries:2,secondDayFlowVersion:2,secondDayActive:day===2,secondDayPurchases:day===2?3:0,secondDayDeliveries:0,secondDaySorted:day===2?3:0,secondDaySupplyRun:day===2?3:0,dwarfEncounterSeen:true,completedB2:false,manualAfterDwarf:0,ordersCreated,nextVisit:999};
  state.dwarf={hired:true,enabled:false,batches:[]};state.goblin={hired:false,enabled:false};state.stock=types.map(type=>{const x=makeItem(type);x.unknown=false;return x;});Story.ensure();Dwarf.ensure();Goblin.ensure();const made=Story.createOrder();render();save();return {made,ids:owned().map(x=>x.uid),id:state.order?.id,customer:state.order?.customer,reward:state.order?.reward,recipe:state.order?.recipe};
},{types,ordersCreated,day});}
async function ship(p,order){
  await p.locator('#receptionOrder').click();await p.locator('#acceptOrder').click();await p.locator('#orderBoard [data-order-id="'+order.id+'"]').click();const packed=[];
  while(!await p.evaluate(()=>orderComplete())){
    const x=await p.evaluate(()=>{const r=state.order.recipe.find(r=>remaining(r)>0),x=state.stock.find(x=>x.type===r.type&&Goblin.canUse(x.uid,state.order.id));return {uid:x.uid,cat:items[x.type].cat};});await p.locator('#shelves [data-cat="'+x.cat+'"]').click();const e=p.locator('#sourceItems [data-uid="'+x.uid+'"]');await e.scrollIntoViewIfNeeded();await e.click();assert.equal(await p.evaluate(()=>drag?.uid),x.uid);await p.locator('#parcelDrop').click();packed.push(x.uid);
  }
  await p.locator('#ship').click();assert.equal(await p.evaluate(()=>state.gold),590);assert.deepEqual(await p.evaluate(()=>owned().map(x=>x.uid).sort((a,b)=>a-b)),order.ids.filter(uid=>!packed.includes(uid)).sort((a,b)=>a-b),'A sale consumes only the selected real originals');
}
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);
    const smith=await offer(p,[18,19,24,25],2);assert.equal(smith.made,true);assert.equal(smith.customer,1);assert.equal(smith.reward,90);assert.equal(smith.recipe.reduce((n,r)=>n+r.count,0),4);assert.ok(await p.evaluate(()=>state.order.recipe.every(r=>items[r.type].cat===3)));await ship(p,smith);
    const chef=await offer(p,[38,38,31,31,66,66,69,69],0);assert.equal(chef.customer,4);assert.ok(await p.evaluate(()=>state.order.recipe.every(r=>items[r.type].food)),'The chef buys edible food rather than nonfood organs in the same crate category');await ship(p,chef);assert.equal(await p.evaluate(()=>state.stock.every(x=>!items[x.type].food)),true);
    const alchemy=await offer(p,[66,66,69,69],1);assert.equal(alchemy.customer,0);assert.equal(alchemy.recipe.reduce((n,r)=>n+r.count,0),4);await ship(p,alchemy);
    const fallback=await offer(p,[38,38,18,19,24,25],0,{day:2});assert.equal(fallback.made,true,'An underfilled preferred profession does not block the capped second day');assert.equal(fallback.recipe.reduce((n,r)=>n+r.count,0),4);assert.equal(fallback.customer,1);
    const mixed=await offer(p,[38,38,18,19],0,{day:2});assert.equal(mixed.made,true);assert.equal(mixed.customer,3,'The innkeeper buys a mixed outfit rather than mislabeling it as an alchemist recipe');assert.equal(mixed.recipe.reduce((n,r)=>n+r.count,0),4);await ship(p,mixed);assert.deepEqual(errors,[]);
    console.log('PASS: actual four-equipment sale to smith for90, edible-only chef sale, nonfood alchemist sale, preserved uid/money and second-day fallback demand.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
