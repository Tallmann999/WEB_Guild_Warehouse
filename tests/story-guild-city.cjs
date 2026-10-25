'use strict';
// Isolated city transactions and entry controls; the full guild naming/guide
// path is covered by story-guild.cjs. This never opens the player's profile.
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
async function reachable(p,selector){
 const result=await p.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {inside:r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,hit:hit===e||e.contains(hit)};});
 assert.deepEqual(result,{inside:true,hit:true},selector+' is visible and receives an actual click');
}
async function fixture(p,{founded=false,enabled=false,gold=1200}={}){
 return p.evaluate(({founded,enabled,gold})=>{
  cancelDrag();forceCloseModal();City.close();BagPour.clear();state=freshState();state.orderUid=0;state.started=true;state.screen='reception';state.mode='sort';state.day=3;state.gold=gold;state.tutorial={active:false};state.orders=[];state.order=null;state.offers=[];state.bag=[];state.unknownTray=[];
  state.story={version:1,letterRead:true,inheritedOpened:true,firstPaid:true,restored:true,firstDayFlowVersion:2,firstDayComplete:true,firstDayPurchases:2,firstDayDeliveries:2,secondDayFlowVersion:2,secondDayActive:false,dwarfEncounterSeen:true,goblinEncounterSeen:true,completedB2:true,completedB3:founded,elapsed:20,nextVisit:999,regularContracts:{},automation:{version:1,enabled,activated:enabled}};
  if(founded)state.story.guild={version:1,phase:'complete',founded:true,name:'Лесной дозор'};
  state.dwarf={hired:true,enabled:false,batches:[]};state.goblin={hired:true,enabled:false,deliveries:founded?1:0};state.stock=[38,38,31,31,0,0].map(type=>{const x=makeItem(type);x.unknown=false;return x;});
  Story.ensure();Dwarf.ensure();Goblin.ensure();Goblin.reconcile();City.ensure();render();save();return owned().map(x=>x.uid).sort((a,b)=>a-b);
 },{founded,enabled,gold});
}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);await p.waitForFunction(()=>typeof City!=='undefined');
 await fixture(p);await p.locator('#cityNav').click();await p.locator('#cityTower').click();assert.equal(await p.evaluate(()=>City.towerAvailable()),false);assert.equal(await p.locator('#cityBuyTower').count(),0,'Old day3 remains locked');assert.equal(await p.evaluate(()=>City.buyTower()),false);
 await p.evaluate(()=>{state.day=4;City.update();});assert.equal(await p.locator('#cityBuyTower').isEnabled(),true,'Old day4 offer remains compatible');
 await fixture(p,{founded:true,enabled:false});await p.locator('#cityNav').click();await p.locator('#cityTower').click();assert.equal(await p.evaluate(()=>City.towerAvailable()),false,'An unstarted guild charter does not unlock the offer');
 const ids=await fixture(p,{founded:true,enabled:true,gold:999});await p.locator('#cityNav').click();await p.locator('#cityTower').click();assert.equal(await p.evaluate(()=>state.day),3,'The guild does not skip a day');assert.equal(await p.evaluate(()=>City.towerAvailable()),true);assert.equal(await p.locator('#cityBuyTower').textContent(),'Купить за 1000 золотых');assert.equal(await p.locator('#cityBuyTower').isDisabled(),true);assert.match(await p.locator('#cityTowerDetails').textContent(),/Нужно ещё 1 монет/);assert.equal(await p.evaluate(()=>Contracts.ready('alchemy')),false,'Offer alone never unlocks other agreements');assert.equal(await p.evaluate(()=>City.buyTower()),false);assert.equal(await p.evaluate(()=>state.gold),999);
 assert.equal(await p.locator('#cityShop #cityEnterShop').count(),0,'The entry control is not a nested button');
 for(const [width,height]of [[1280,800],[820,850]]){
  await p.setViewportSize({width,height});await p.waitForFunction(({width,height})=>{const r=$('game').getBoundingClientRect();return innerWidth===width&&innerHeight===height&&r.left>=-1&&r.top>=-1&&r.right<=width+1&&r.bottom<=height+1;},{width,height});
  await reachable(p,'#cityEnterShop');await reachable(p,'#cityTower');await p.screenshot({path:'audit_source/guild-city-entry-'+width+'.png'});
 }
 await p.locator('#cityEnterShop').click();assert.equal(await p.evaluate(()=>City.isOpen()),false);assert.equal(await p.evaluate(()=>state.screen),'reception');assert.equal(await p.evaluate(()=>state.story.automation.enabled),true,'Entering the shop keeps automation on');
 await p.evaluate(()=>{state.story.automation.enabled=false;state.gold=1200;City.update();save();});await p.locator('#cityNav').click();await p.locator('#cityTower').click();assert.equal(await p.evaluate(()=>City.towerAvailable()),true,'Stopping automation does not revoke an already unlocked offer');assert.equal(await p.locator('#cityEnterShop').isVisible(),false);
 const gold=await p.evaluate(()=>state.gold);await p.locator('#cityBuyTower').click();assert.equal(await p.evaluate(()=>state.gold),gold-1000);assert.equal(await p.evaluate(()=>state.city.towerOwned),true);assert.equal(await p.evaluate(()=>Contracts.ready('alchemy')),true);assert.equal(await p.evaluate(()=>City.buyTower()),false);assert.equal(await p.evaluate(()=>state.gold),gold-1000);assert.deepEqual(await p.evaluate(()=>owned().map(x=>x.uid).sort((a,b)=>a-b)),ids);
 await p.reload();await p.locator('#loadGame').click();assert.equal(await p.evaluate(()=>state.gold),gold-1000);assert.equal(await p.evaluate(()=>state.city.towerOwned),true);assert.equal(await p.evaluate(()=>state.dwarf.enabled),false);assert.equal(await p.evaluate(()=>state.goblin.enabled),false);assert.equal(await p.evaluate(()=>state.story.automation.enabled),false);assert.deepEqual(await p.evaluate(()=>owned().map(x=>x.uid).sort((a,b)=>a-b)),ids);assert.deepEqual(errors,[]);
 console.log('PASS: guild grants a real day3 tower offer without free gold/day skips, old day4 remains, 999 cash cannot pay, green shop entry works1280/820, one1000 debit and preserved items/stopped staff across reload.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
