'use strict';
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
async function step(p,seconds){await p.evaluate(seconds=>{while(seconds>1e-8){const dt=Math.min(1,seconds);tick(last+dt*1000);seconds-=dt;}},seconds);}
async function fixture(p,{automation=false,screen='work'}={}){return p.evaluate(options=>{
  cancelDrag();forceCloseModal();BagPour.clear();City.close();Tower.close('none');
  LootkeeperEngine.bridge.step=()=>{};
  state=freshState();Object.assign(state,{started:true,day:3,gold:1000,screen:options.screen,mode:'sort',orders:[],order:null,orderUid:0,tutorial:{active:false},collection:items.map(x=>x.id).filter(type=>type!==49),unknownTray:[]});
  state.story={version:1,letterRead:true,inheritedOpened:true,firstPaid:true,firstDayComplete:true,firstDayFlowVersion:2,firstDayPurchases:2,firstDayDeliveries:2,restored:true,shopRestorationStage:2,secondDayFlowVersion:2,secondDayActive:false,completedB2:true,completedB3:true,dwarfEncounterSeen:true,goblinEncounterSeen:true,elapsed:30,nextVisit:999,forceSupplier:false,royalProgress:{version:1,notified:true},guild:{version:1,founded:true,name:'Фоновая лавка',phase:'complete'}};
  state.dwarf={hired:true,enabled:true,batches:[],completedBatches:1};state.goblin={hired:true,enabled:true,deliveries:1};state.city={towerOwned:false};
  Story.ensure();for(const c of Object.values(Contracts.ensure())){c.offerSeen=true;c.offerState='later';}
  const secret=makeItem(49);secret.unknown=true;state.unknownTray.push(secret);
  const manualPacked=makeItem(18),manualFree=makeItem(18);manualPacked.unknown=manualFree.unknown=false;
  const manual={id:++state.orderUid,accepted:true,assignedTo:'manual',recipe:[{type:18,count:2}],packed:[manualPacked],reservedUids:[manualFree.uid],customer:1,reward:90,title:'Защищённая ручная посылка'};
  const a=makeItem(0),b=makeItem(0);a.unknown=b.unknown=false;
  const worker={id:++state.orderUid,accepted:true,assignedTo:'goblin',recipe:[{type:0,count:2}],packed:[],reservedUids:[a.uid,b.uid],customer:0,reward:90,title:'Фоновая посылка'};
  state.orders=[manual,worker];state.order=manual;state.stock=[manualFree,a,b];
  state.bag=[6,6,31,32].map(type=>{const item=makeItem(type);item.unknown=false;return item;});BagPour.layout(state.bag);Dwarf.onBagPurchased(state.bag);Goblin.reconcile();
  if(options.automation)Automation.enable();
  render();save();return {secret:secret.uid,manual:manual.id,manualUids:[manualPacked.uid,manualFree.uid],worker:worker.id,workerUids:[a.uid,b.uid],bag:state.bag.map(x=>x.uid)};
},{automation,screen});}
async function snapshot(p){return p.evaluate(()=>JSON.stringify({gold:state.gold,elapsed:state.story.elapsed,seconds:state.seconds,d:state.dwarf,g:state.goblin,a:state.story.automation,items:owned().map(x=>x.uid),manual:state.orders.find(o=>o.assignedTo==='manual')}));}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);await p.waitForFunction(()=>LootkeeperEngine?.ready);
 const keep=await fixture(p);await p.evaluate(()=>openCleaning(49,state.unknownTray[0]));
 assert.equal(await p.evaluate(()=>state.paused),false);assert.equal(await p.locator('#modal').getAttribute('data-activity'),'background');
 const canvas=await p.locator('#dirt').elementHandle();await step(p,.5);await p.waitForTimeout(100);
 assert.equal(await p.locator('#dwarfCarrier').isVisible(),true,'Borin keeps carrying behind recognition');
 const layer=await p.evaluate(()=>{const button=$('cleanKey').getBoundingClientRect(),hit=document.elementFromPoint(button.x+button.width/2,button.y+button.height/2);return {modal:Number(getComputedStyle($('modal')).zIndex),carrier:Number(getComputedStyle($('dwarfCarrier')).zIndex),hit:hit?.closest('button')?.id};});
 assert.ok(layer.modal>layer.carrier,JSON.stringify(layer));assert.equal(layer.hit,'cleanKey');
 await p.screenshot({path:'audit_source/revision-background-recognition-1366.png'});
 await step(p,8);
 assert.equal(await canvas.evaluate(node=>node.isConnected),true,'Background rendering preserves the live scratch canvas');
 const ledger=await p.evaluate(keep=>({gold:state.gold,receipts:state.goblin.receipts,sorted:state.dwarf.sorted,secret:owned().find(x=>x.uid===keep.secret),manual:state.orders.find(o=>o.id===keep.manual),ids:owned().map(x=>x.uid)}),keep);
 assert.equal(ledger.gold,1085,'Two real batch-fee coins and one90minus3 sale');assert.equal(ledger.receipts.length,1);assert.deepEqual(ledger.receipts[0].uids,keep.workerUids);assert.ok(ledger.sorted>=3);assert.ok(ledger.secret?.unknown);assert.deepEqual(ledger.manual.packed.map(x=>x.uid),[keep.manualUids[0]]);assert.deepEqual(ledger.manual.reservedUids,[keep.manualUids[1]]);assert.equal(new Set(ledger.ids).size,ledger.ids.length);
 for(let i=0;i<60&&!await p.locator('#cleanKey').isDisabled();i++)await p.locator('#cleanKey').click();
 assert.equal(await p.locator('#cleanKey').isDisabled(),true);const rewarded=await p.evaluate(()=>state.gold);assert.equal(rewarded,1097);
 await step(p,1.49);assert.equal(await p.locator('#modal').isVisible(),true);await step(p,.02);assert.equal(await p.locator('#modal').isVisible(),false);await step(p,3);assert.equal(await p.evaluate(()=>state.gold),rewarded,'Recognition reward is credited once');
 // Each reading surface is unattended work, even while the underlying screen
 // is reception. Books update sold parcels without replacing the whole dialog.
 for(const kind of ['orders','collection','contracts']){
  const ids=await fixture(p,{screen:'reception'});
  await p.evaluate(kind=>{if(kind==='orders')showOrders();else if(kind==='collection')openCollection();else Contracts.openBook();},kind);
  assert.equal(await p.evaluate(()=>state.paused),false,kind+' allows work');await step(p,8);
  assert.equal(await p.evaluate(()=>state.goblin.receipts.length),1,kind+' allows actual dispatch behind the window');assert.equal(await p.locator('#modal').isVisible(),true);
  if(kind==='orders')assert.equal(await p.locator('[data-accepted-order="'+ids.worker+'"]').count(),0,'The book removes a parcel actually dispatched in the background');
  await p.locator('#closeModal').click();
 }
 // Auto procurement retains the original supplied instances and the exact
 // recognition canvas. It is available only after explicit guild activation.
 await fixture(p,{automation:true});const supplier=await p.evaluate(()=>{state.bag=[];delete state.story.sortingGate;state.offers=[{visitor:0,price:10,qualityRolled:true,arrivalSerial:1,loot:[6,6,31,31,32,32,38,38].map(type=>{const x=makeItem(type);x.unknown=false;return x;})}];const ids=state.offers[0].loot.map(x=>x.uid);openCleaning(49,state.unknownTray[0]);return ids;});
 await step(p,1);assert.equal(await p.evaluate(()=>state.story.automation.purchases),1);assert.equal(await p.evaluate(ids=>ids.every(uid=>owned().some(x=>x.uid===uid)),supplier),true);assert.equal(await p.locator('#dirt').isVisible(),true);assert.equal(await p.evaluate(()=>state.screen),'work');
 // Pauses and consequential choices stop all clocks; closing a background
 // window cannot erase a pause that was already active before that window.
 for(const kind of ['settings','pause','choice','hidden']){
  await fixture(p);await step(p,.6);
  if(kind==='settings')await p.locator('#settings').click();
  else if(kind==='pause')await p.locator('#pause').click();
  else if(kind==='choice')await p.evaluate(()=>Contracts.openOffer('chef'));
  else await p.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}));
  const before=await snapshot(p);await step(p,20);assert.equal(await snapshot(p),before,kind+' preserves every active clock and transaction');
  if(kind==='hidden')await p.evaluate(()=>delete document.hidden);else await p.locator('#closeModal').click();
 }
 // Inspecting an employee's current original parks that operation with its
 // paid partial clock. Other work continues; save/reload resumes the original.
 for(const kind of ['dwarf','pack','dispatch']){
  await fixture(p);const parked=await p.evaluate(kind=>{
   if(kind==='dwarf'){
    Goblin.setEnabled(false);state.bag=state.bag.slice(0,2);Dwarf.advance(.75);const job={...state.dwarf.job};openCleaning(state.bag.find(x=>x.uid===job.uid).type,state.bag.find(x=>x.uid===job.uid));return job;
   }
   Dwarf.setEnabled(false);state.screen='work';
   if(kind==='dispatch'){Goblin.advance(4);Goblin.advance(.75);}else Goblin.advance(.75);
   const job={...state.goblin.job},o=state.orders.find(o=>o.id===job.orderId),item=kind==='dispatch'?o.packed[0]:state.stock.find(x=>x.uid===job.uid);openCleaning(item.type,item);return job;
  },kind);
  await step(p,3);const waiting=await p.evaluate(kind=>({...state[kind==='dwarf'?'dwarf':'goblin'].suspendedRecognitionJobs[0]}),kind);
  assert.equal(waiting.elapsed,parked.elapsed,kind+' keeps its original elapsed time');assert.equal(waiting.uid,parked.uid);assert.equal(waiting.orderId,parked.orderId);
  if(kind==='dwarf')assert.equal(await p.evaluate(()=>state.dwarf.sorted),1,'Other sorting continues around the examined original');
  await p.evaluate(()=>save());await p.reload();await p.waitForFunction(()=>LootkeeperEngine?.ready);await p.evaluate(()=>LootkeeperEngine.bridge.step=()=>{});await p.locator('#loadGame').click();await step(p,.1);
  const resumed=await p.evaluate(kind=>state[kind==='dwarf'?'dwarf':'goblin'].job,kind);assert.equal(resumed.elapsed,parked.elapsed+.1,kind+' resumes its saved partial clock after reload');assert.equal(resumed.uid,parked.uid);assert.equal(resumed.orderId,parked.orderId);
 }
 for(const kind of ['dwarf','pack']){
  await fixture(p);const a=await p.evaluate(kind=>{
   if(kind==='dwarf'){Goblin.setEnabled(false);Dwarf.advance(.75);const job={...state.dwarf.job},item=state.bag.find(x=>x.uid===job.uid);openCleaning(item.type,item);return job;}
   Dwarf.setEnabled(false);Goblin.advance(.75);const job={...state.goblin.job},item=state.stock.find(x=>x.uid===job.uid);openCleaning(item.type,item);return job;
  },kind);
  await step(p,.4);const b=await p.evaluate(kind=>{const worker=state[kind==='dwarf'?'dwarf':'goblin'],job={...worker.job},item=owned().find(x=>x.uid===job.uid);closeModal();openCleaning(item.type,item);return job;},kind);
  await step(p,.1);const result=await p.evaluate(kind=>{const worker=state[kind==='dwarf'?'dwarf':'goblin'];return {job:worker.job,parked:worker.suspendedRecognitionJobs};},kind);
  assert.equal(result.job.uid,a.uid,kind+' resumes A while B is examined');assert.ok(Math.abs(result.job.elapsed-a.elapsed-.1)<1e-8);assert.equal(result.parked.length,1);assert.equal(result.parked[0].uid,b.uid);assert.ok(Math.abs(result.parked[0].elapsed-b.elapsed)<1e-8,kind+' retains B without overwriting A');
 }
 await fixture(p);await p.evaluate(()=>{Dwarf.setEnabled(false);Goblin.setEnabled(false);openCollection();});const disabled=await snapshot(p);await step(p,4);const switches=await p.evaluate(()=>({d:state.dwarf.enabled,g:state.goblin.enabled,bag:state.bag.length,packed:state.orders[1].packed.length}));assert.deepEqual(switches,{d:false,g:false,bag:4,packed:0});assert.ok(disabled);
 await p.evaluate(()=>{forceCloseModal();state.paused=true;modal('<h2>Чтение на паузе</h2>',{activity:'background',kind:'book'});closeModal();});assert.equal(await p.evaluate(()=>state.paused),true,'Closing reading UI preserves a pre-existing explicit pause');
 assert.deepEqual(errors,[]);console.log('PASS: recognition stays above Borin while real paid sorting, assembly, dispatch and guild procurement continue; subject/manual UID protection, live books, single recognition reward, intentional switches, and settings/pause/hidden/decision clocks.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
