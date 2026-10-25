'use strict';
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);await p.waitForFunction(()=>window.LootkeeperEngine?.ready);
 const uids=await p.evaluate(()=>{
  cancelDrag();forceCloseModal();City.close();BagPour.clear();state=freshState();state.started=true;state.day=5;state.gold=500;state.tutorial={active:false};state.orders=[];state.order=null;state.offers=[];state.collection=items.map(x=>x.id);state.unknownTray=[];
  state.story={version:1,letterRead:true,inheritedOpened:true,firstPaid:true,restored:true,shopRestorationStage:2,firstDayComplete:true,firstDayFlowVersion:2,firstDayPurchases:2,firstDayDeliveries:2,secondDayFlowVersion:2,secondDayActive:false,completedB2:true,completedB3:true,elapsed:30,nextVisit:999,dwarfEncounterSeen:true,goblinEncounterSeen:true,regularContracts:{},guild:{founded:true,name:'Пятый день',phase:'complete'}};
  state.dwarf={hired:true,enabled:false,batches:[]};state.goblin={hired:true,enabled:false,deliveries:1};state.stock=[];
  state.bag=Array.from({length:8},()=>{const x=makeItem(0);x.unknown=false;return x;});BagPour.layout(state.bag);Story.ensure();Dwarf.onBagPurchased(state.bag);LootkeeperEngine.bridge.step=()=>{};setScreen('work','sort');return state.bag.map(x=>x.uid);
 });
 await p.locator('#autoSortButton').click();assert.equal(await p.evaluate(()=>state.dwarf.enabled),true);assert.equal(await p.evaluate(()=>state.bag.length),8,'The old quick-sort control cannot bypass the paid worker');assert.equal(await p.evaluate(()=>state.autoSorting),false);
 await p.evaluate(()=>Dwarf.advance(2.49));assert.equal(await p.evaluate(()=>state.stock.length),0);assert.equal(await p.evaluate(()=>state.gold),498);assert.equal(await p.evaluate(()=>state.dwarf.feesPaid),1);
 await p.evaluate(()=>Dwarf.advance(.01));assert.equal(await p.evaluate(()=>state.stock.length),1,'Exactly one original uid after2.5active seconds');assert.equal(await p.evaluate(()=>state.bag.length),7);
 await p.evaluate(()=>{Dwarf.advance(1.25);save();});const clock=await p.evaluate(()=>state.dwarf.job.elapsed);assert.ok(Math.abs(clock-1.25)<1e-9);
 await p.evaluate(()=>{state.paused=true;Dwarf.advance(8);});assert.equal(await p.evaluate(()=>state.dwarf.job.elapsed),clock);await p.evaluate(()=>{state.paused=false;save();});
 await p.reload();await p.waitForFunction(()=>window.LootkeeperEngine?.ready);await p.evaluate(()=>{LootkeeperEngine.bridge.step=()=>{};});await p.locator('#loadGame').click();assert.equal(await p.evaluate(()=>state.dwarf.job.elapsed),clock);assert.equal(await p.evaluate(()=>state.gold),498);
 await p.evaluate(()=>Dwarf.advance(1.24));assert.equal(await p.evaluate(()=>state.stock.length),1);await p.evaluate(()=>Dwarf.advance(.01));assert.equal(await p.evaluate(()=>state.stock.length),2);
 const held=await p.evaluate(()=>{const uid=state.bag[0].uid;state.selected=uid;Dwarf.advance(2.5);return uid;});assert.equal(await p.evaluate(uid=>state.bag.some(x=>x.uid===uid),held),true,'Manual held uid is protected');await p.evaluate(()=>{state.selected=null;Dwarf.advance(10);Dwarf.advance(2.5);});
 assert.equal(await p.evaluate(()=>state.bag.length),0);assert.equal(await p.evaluate(()=>state.stock.length),8);assert.equal(await p.evaluate(()=>state.gold),498);assert.equal(await p.evaluate(()=>state.dwarf.feesPaid),1);assert.deepEqual(await p.evaluate(()=>state.stock.map(x=>x.uid).sort((a,b)=>a-b)),uids);
 assert.deepEqual(errors,[]);console.log('PASS: day5 quick-sort delegates to Borin,2.5active seconds per real uid, pause/reload preserve clock, manual hands protected and one batch fee.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
