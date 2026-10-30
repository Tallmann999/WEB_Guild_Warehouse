'use strict';
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const OUT='output/playwright/revisions-20261030';fs.mkdirSync(OUT,{recursive:true});
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
async function fixture(p,options={}){
 await p.evaluate(options=>{
  cancelDrag();forceCloseModal();BagPour.clear();Tower.close('none');City.close();LootkeeperEngine.bridge.step=()=>{};
  state=freshState();Object.assign(state,{started:true,day:3,gold:500,screen:'reception',orders:[],order:null,orderUid:0,unknownTray:[],visitorCooldown:0,tutorial:{active:false},collection:items.map(x=>x.id),city:{towerOwned:false}});
  state.story={letterRead:true,inheritedOpened:true,firstPaid:true,firstDayFlowVersion:2,firstDayComplete:true,firstDayPurchases:2,firstDayDeliveries:2,restored:true,shopRestorationStage:2,secondDayFlowVersion:2,secondDayActive:false,secondDayPurchases:3,secondDayDeliveries:1,secondDaySorted:3,secondDaySupplyRun:0,completedB2:true,dwarfEncounterSeen:true,goblinEncounterSeen:true,nextVisit:999,elapsed:40,royalProgress:{notified:true},earlyVisitVersion:1,earlyVisitIndex:0};
  state.dwarf={hired:true,enabled:false,batches:[]};state.goblin={hired:true,enabled:false,pendingFirstParcel:false};
  Object.assign(state,options.state||{});Object.assign(state.story,options.story||{});Object.assign(state.dwarf,options.dwarf||{});Object.assign(state.goblin,options.goblin||{});
  Story.ensure();Dwarf.ensure();Goblin.ensure();
  for(const c of Object.values(Contracts.ensure())){c.offerSeen=true;c.offerState='later';}
  render();save();
 },options);
}
async function reload(p){await p.evaluate(()=>save());await p.reload();await p.waitForFunction(()=>LootkeeperEngine?.ready);await p.evaluate(()=>LootkeeperEngine.bridge.step=()=>{});await p.locator('#loadGame').click();}
async function ledger(p){return p.evaluate(()=>({gold:state.gold,ids:owned().map(x=>x.uid).sort((a,b)=>a-b),orders:state.orders.map(o=>({id:o.id,packed:o.packed.map(x=>x.uid),reserved:o.reservedUids.slice()})),switches:[state.dwarf.enabled,state.goblin.enabled]}));}
async function nextGuest(p){return p.evaluate(()=>{forceCloseModal();state.story.nextVisit=0;state.visitorCooldown=0;Story.arrivals();render();return counterGuest()?.kind||Contracts.activeOffer()?.key;});}
async function buyAndSort(p,borin=false){
 await p.evaluate(()=>setScreen('reception'));
 const before=await p.evaluate(()=>({gold:state.gold,uids:counterGuest().value.loot.map(x=>x.uid)}));
 await p.locator('#buyBag').click();await p.evaluate(()=>{BagPour.advance(1);BagPour.advance(1);});
 if(borin)await p.evaluate(()=>{for(let i=0;i<3;i++)Dwarf.advance(10);});
 else await p.evaluate(()=>{for(const x of [...state.bag])sortItem(x.uid,items[x.type].cat);});
 assert.equal(await p.evaluate(()=>state.bag.length),0);
 assert.equal(await p.evaluate(()=>state.gold),before.gold-10-(borin?2:0));
 for(const uid of before.uids)assert.equal(await p.evaluate(uid=>state.stock.some(x=>x.uid===uid)||state.unknownTray.some(x=>x.uid===uid),uid),true);
 await p.evaluate(()=>Story.advance(.01));return before;
}
async function packAndShip(p,regularKey=null){
 if(!regularKey){await p.evaluate(()=>setScreen('reception'));await p.locator('#receptionOrder').click();await p.locator('#acceptOrder').click();}
 const result=await p.evaluate(key=>{
  const o=key?Contracts.current(key):state.orders.find(o=>!o.regularKey&&o.accepted!==false);openOrder(o);
  const gold=state.gold;for(const r of o.recipe)while(remaining(r)>0){const x=state.stock.find(x=>x.type===r.type&&!isUnknown(x)&&Goblin.canUse(x.uid,o.id));if(!x)throw Error('No original component for '+r.type);packItem(x.uid);}
  render();return {id:o.id,gold,reward:o.reward,uids:o.packed.map(x=>x.uid)};
 },regularKey);
 await p.locator('#ship').click();assert.equal(await p.evaluate(()=>state.gold),result.gold+result.reward);
 for(const uid of result.uids)assert.equal(await p.evaluate(uid=>owned().some(x=>x.uid===uid),uid),false);
 return result;
}
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url());});
  await p.goto(BASE);await p.waitForFunction(()=>LootkeeperEngine?.ready);
  if(!process.argv.includes('--ui')){
  // Real hiring and original bag, before the first kitchen invitation.
  await fixture(p,{state:{day:2,gold:300},story:{secondDayActive:true,shopRestorationStage:1,completedB2:false,dwarfEncounterSeen:false,dwarfEncounterPending:true},dwarf:{hired:false},goblin:{hired:false}});
  await p.evaluate(()=>{for(const type of [38,31,32])for(let i=0;i<4;i++){const x=makeItem(type);x.unknown=false;state.stock.push(x);}const contracts=Contracts.ensure();for(const key of ['chef','royal']){contracts[key].offerSeen=false;contracts[key].offerState='unseen';}Story.advance(.01);});
  await p.locator('#acceptDwarf').click();assert.equal(await nextGuest(p),'bag');assert.equal(await p.evaluate(()=>Contracts.activeOffer()),null);
  await buyAndSort(p,true);assert.equal(await p.evaluate(()=>state.story.borinIntroduction.phase),'complete');assert.equal(await nextGuest(p),'chef');
  await p.evaluate(()=>setScreen('reception'));
  assert.equal(await p.locator('#notice .agreement-delivery').count(),2);assert.match(await p.locator('#speech').textContent(),/две поставки/);
  await p.locator('#signContractOffer').click();await packAndShip(p,'chef');assert.equal(await p.evaluate(()=>Contracts.ready('royal')),false);
  await p.evaluate(()=>{state.story.elapsed=Contracts.ensure().chef.nextAt;Contracts.sync();render();});await packAndShip(p,'chef');
  assert.equal(await p.evaluate(()=>Contracts.ensure().chef.completed),true);assert.equal(await p.evaluate(()=>Contracts.current('chef')),undefined);assert.equal(await p.evaluate(()=>Contracts.ready('royal')),true);
  await p.evaluate(()=>{state.story.elapsed+=100;Contracts.sync();state.story.royalProgress.notified=false;RoyalProgress.advance();});
  assert.equal(await p.locator('#royalRankNotice').isVisible(),true);assert.equal(await p.evaluate(()=>Contracts.current('chef')),undefined);
  await p.locator('#royalRankContinue').click();assert.match(await p.locator('#contractOfferSheet').textContent(),/15.*360/s);await p.locator('#laterOfferSheet').click();
  console.log('PASS Borin -> original paid bag + automatic sorting -> two real kitchen deliveries -> armoury before day5.');

  // Legacy kitchen's already-promised third parcel remains original and payable.
  await fixture(p);await p.evaluate(()=>{
   const c=Contracts.ensure().chef;c.signed=true;c.deliveries=2;delete c.seriesVersion;
   const x=makeItem(38),y=makeItem(31);state.stock=[y];state.order={id:++state.orderUid,accepted:true,assignedTo:'manual',regularKey:'chef',title:'Снабжение городской кухни',recipe:[{type:38,count:1},{type:31,count:1}],packed:[x],reservedUids:[y.uid],customer:4,reward:200};state.orders=[state.order];Goblin.reconcile();render();
  });const old=await ledger(p);await p.evaluate(()=>{Contracts.ensure();Contracts.ensure();});assert.deepEqual(await ledger(p),old);assert.equal(await p.evaluate(()=>Contracts.ensure().chef.seriesLimit),3);await reload(p);assert.deepEqual(await ledger(p),old);await packAndShip(p,'chef');await p.evaluate(()=>{state.story.elapsed+=20;Contracts.sync();});assert.equal(await p.evaluate(()=>Contracts.current('chef')),undefined);
  console.log('PASS legacy third kitchen partial and reserves survive migration/reload; no new repeats.');

  // Alchemist price, in-place old parcel migration, safe pending invitation.
  await fixture(p);await p.evaluate(()=>{state.goblin.hired=false;for(let i=0;i<8;i++)state.stock.push(makeItem(0));state.story.ordersCreated=1;Story.createOrder();render();});
  assert.equal(await p.evaluate(()=>state.order.title),'Запасы для алхимика');assert.equal(await p.evaluate(()=>state.order.reward),110);
  await p.evaluate(()=>{const o=state.order;o.accepted=true;o.reward=o.originalReward=90;delete o.alchemyParcelRewardVersion;const x=state.stock.shift();o.packed.push(x);Goblin.reconcile();});
  const alch=await ledger(p);await p.evaluate(()=>{Story.ensure();Story.ensure();});assert.deepEqual(await ledger(p),alch);assert.equal(await p.evaluate(()=>state.order.reward),110);await reload(p);assert.deepEqual(await ledger(p),alch);
  await p.evaluate(()=>{state.screen='work';state.mode='order';state.gold=600;state.story.goblinEncounterSeen=false;state.story.goblinEncounterPending=true;state.story.earlyVisitIndex=0;state.story.nextVisit=0;state.visitorCooldown=0;Story.arrivals();});assert.equal(await p.evaluate(()=>counterGuest()?.kind),'bag','A safely postponed Grik invitation cannot deadlock supply');
  console.log('PASS alchemist110 migration preserves UID/partial/gold; pending hire no longer blocks suppliers.');

  // A full 60/40 rhythm now works with the tower already owned, after day4.
  await fixture(p,{state:{day:5,city:{towerOwned:true}}});await p.evaluate(()=>{for(const type of [0,1,6,38,31,32,18,19,24])for(let i=0;i<4;i++)state.stock.push(makeItem(type));render();});
  const visits=[];
  for(let i=0;i<15;i++){
   const kind=await nextGuest(p);visits.push(kind==='bag'?'A':'P');
   if(i===6){await p.evaluate(()=>Goblin.reconcile());const saved=await ledger(p),index=await p.evaluate(()=>state.story.earlyVisitIndex);await reload(p);assert.deepEqual(await ledger(p),saved);assert.equal(await p.evaluate(()=>state.story.earlyVisitIndex),index);}
   if(kind==='bag')await buyAndSort(p);else{assert.equal(kind,'order');await packAndShip(p);}
  }
  assert.deepEqual(visits,Array.from({length:3},()=>['A','P','A','A','P']).flat());console.log('PASS 15 real visits after day4 with owned tower: 9 adventurers / 6 parcels, phase survives loading.');

  // Both four-second upgrades, saved pending information, actual audio graph.
  await fixture(p,{state:{day:1,gold:160},story:{restored:false,shopRestorationStage:0,secondDayActive:true,secondDayPurchases:0,secondDayDeliveries:0,secondDaySorted:0,repairPromptSeen:true,royalProgress:{notified:true}}});
  await p.evaluate(()=>{Restoration.begin();Restoration.advance(3.999);});assert.equal(await p.evaluate(()=>Restoration.active()),true);
  await p.evaluate(()=>{Restoration.advance(.001);RoyalProgress.advance();});assert.equal(await p.locator('#shopUpgradeNotice').isVisible(),true);assert.equal(await p.locator('.shop-rating-bar').getAttribute('aria-valuenow'),'2');
  const upgradeLedger=await ledger(p);await reload(p);assert.equal(await p.locator('#shopUpgradeNotice').isVisible(),true);assert.deepEqual(await ledger(p),upgradeLedger);
  await p.locator('#shopUpgradeContinue').click();assert.equal(await p.evaluate(()=>RoyalProgress.advance()),false);
  await p.evaluate(()=>{state.story.secondDayComplete=true;state.story.secondDayEndPending=true;Restoration.beginSecond();Restoration.advance(4);RoyalProgress.advance();});assert.equal(await p.locator('.shop-rating-bar').getAttribute('aria-valuenow'),'3');
  await p.screenshot({path:OUT+'/upgrade-rating.png'});await p.locator('#shopUpgradeContinue').click();
  await p.locator('#sound').click();assert.equal(await p.evaluate(()=>state.muted),false);
  const audio=await p.evaluate(async()=>{
   const original=audioContext,offline=new OfflineAudioContext(1,48000*2,48000);audioContext=offline;const played=playUpgradeFanfare();const buffer=await offline.startRendering();audioContext=original;
   let peak=0,energy=0;for(const value of buffer.getChannelData(0)){peak=Math.max(peak,Math.abs(value));energy+=value*value;}
   state.muted=true;return {played,peak,energy,mutedPlayed:playUpgradeFanfare()};
  });assert.equal(audio.played,true);assert.ok(audio.peak>0.001&&audio.peak<1);assert.ok(audio.energy>1);assert.equal(audio.mutedPlayed,false);
  console.log('PASS both upgrade notices, wide yellow rating, acknowledgment/reload, original brass waveform and mute.',JSON.stringify(audio));

  // Borin's real mystery routing, then exactly two assistant reminders.
  await fixture(p,{state:{screen:'work',mode:'sort'},dwarf:{enabled:true}});await p.evaluate(()=>{state.collection=state.collection.filter(x=>x!==4);const x=makeItem(4);x.unknown=true;state.bag=[x];Dwarf.onBagPurchased(state.bag);Dwarf.advance(2.5);render();Story.guide();});
  assert.equal(await p.locator('#tutorialGuide').getAttribute('data-staff-hint'),'recognition');assert.equal(await p.locator('#unknownTrayButton').evaluate(n=>n.classList.contains('tutorial-focus')),true);await p.screenshot({path:OUT+'/unknown-hint.png'});
  await fixture(p);await p.evaluate(()=>{for(let i=0;i<3;i++){const o={id:++state.orderUid,accepted:true,assignedTo:'manual',recipe:[{type:0,count:1}],packed:[],reservedUids:[],customer:0,reward:110,title:'Запасы для алхимика'};state.orders.push(o);}state.order=state.orders[0];render();Story.guide();});
  for(let i=0;i<2;i++){
   assert.equal(await p.locator('#tutorialGuide').getAttribute('data-staff-hint'),'assistant');assert.match(await p.locator('.tutorial-note').textContent(),new RegExp((i+1)+' из 2'));
   if(i===0)await p.screenshot({path:OUT+'/grik-hint.png'});
   await p.locator('#taskRail [data-order-id="'+(i+1)+'"] [data-parcel-action="assistant"]').click();await p.evaluate(()=>Story.guide());
  }
  assert.equal(await p.locator('#tutorialGuide').count(),0);assert.equal(await p.evaluate(()=>state.story.staffGuidance.assistantShown.length),2);await reload(p);await p.evaluate(()=>Story.guide());assert.equal(await p.locator('#tutorialGuide').count(),0);
  console.log('PASS mystery hand and first two actionable Grik prompts; no third prompt or repeat on reload.');
  }

  // Actual layers, left-aligned geometry, UI hit testing and viewport bounds.
  for(const [width,height]of [[1920,920],[1366,768],[1280,720],[1024,768]]){
   await p.setViewportSize({width,height});await fixture(p,{state:{screen:'work'}});
   await p.evaluate(()=>{for(const type of [0,1,6,18,19,24])for(let i=0;i<4;i++)state.stock.push(makeItem(type));Contracts.signRegular('chef');const o={id:++state.orderUid,accepted:true,assignedTo:'manual',recipe:[{type:0,count:2}],packed:[],reservedUids:[],customer:0,reward:110,title:'Запасы для алхимика'};state.orders.push(o);state.order=o;state.bag=[makeItem(1),makeItem(6)];render();resize();});
   await p.waitForFunction(()=>LootkeeperEngine.stats?.scene==='Workbench');
   const bounds=await p.evaluate(()=>{
    const rect=n=>n.getBoundingClientRect(),g=rect($('game')),table=rect($('table')),shelf=rect(document.querySelector('.lower-shelf .shelf-box')),rail=rect($('taskRail'));
    return {tableLeft:(table.left-g.left)/scale,shelfLeft:(shelf.left-g.left)/scale,tableRight:table.right,railLeft:rail.left,railHeight:rail.height/scale,zTable:+getComputedStyle($('table')).zIndex,zRail:+getComputedStyle($('taskRail')).zIndex,scroll:[document.documentElement.scrollWidth-innerWidth,document.documentElement.scrollHeight-innerHeight]};
   });assert.ok(Math.abs(bounds.tableLeft-24)<2);assert.ok(Math.abs(bounds.shelfLeft-24)<2);assert.ok(bounds.tableRight<bounds.railLeft);assert.ok(bounds.railHeight>500);assert.ok(bounds.zTable<bounds.zRail);assert.deepEqual(bounds.scroll,[0,0]);
   const manual=p.locator('#orderBoard [data-parcel-action="manual"]').first();await manual.click();await p.waitForFunction(()=>state.mode==='order');
   const stacking=await p.evaluate(()=>({table:getComputedStyle($('table')).zIndex,rail:getComputedStyle($('taskRail')).zIndex,classes:$('work').className,mode:state.mode}));
   assert.ok(Number(stacking.table)>Number(stacking.rail),JSON.stringify(stacking));
   await p.screenshot({path:OUT+'/assembly-'+width+'.png'});
   await p.evaluate(()=>setScreen('work','sort'));await p.screenshot({path:OUT+'/sorting-'+width+'.png'});
   const before=await ledger(p);
   await p.evaluate(()=>{state.city.towerOwned=true;City.ensure();});
   for(let stage=0;stage<3;stage++){
    await p.evaluate(stage=>{state.story.shopRestorationStage=stage;state.story.restored=stage>0;Tower.open();Tower.update();},stage);
    await p.waitForFunction(stage=>LootkeeperEngine.stats?.scene==='Tower'&&LootkeeperEngine.game.scene.getScene('Tower').towerLayers.get('room')?.texture.key==='environment.tower-stage-'+(stage+1),stage);
    const layers=await p.evaluate(()=>{const scene=LootkeeperEngine.game.scene.getScene('Tower');return {stage:Tower.stage(),ids:[...scene.towerLayers.keys()],counter:scene.towerLayers.get('workbench').texture.key,dom:[...$('towerArt').querySelectorAll('img')].map(x=>x.getAttribute('src')),canvas:document.querySelectorAll('#phaser-world canvas').length};});
    assert.equal(layers.stage,stage+1);assert.equal(layers.ids.includes('mechanism'),stage>0);assert.equal(layers.counter,'prop.tower-counter-'+(stage+1));assert.ok(layers.dom.every(x=>x.startsWith('assets/New Sprites/Mage Tower/')));assert.equal(layers.canvas,1);assert.deepEqual(await ledger(p),before);
    await p.screenshot({path:OUT+'/tower-'+(stage+1)+'-'+width+'.png'});
    if(width===1280){await p.evaluate(()=>$('game').classList.remove('phaser-ready'));await p.screenshot({path:OUT+'/tower-fallback-'+(stage+1)+'.png'});await p.evaluate(()=>$('game').classList.add('phaser-ready'));}
   }
   await reload(p);assert.equal(await p.evaluate(()=>Tower.isOpen()),true);assert.equal(await p.evaluate(()=>Tower.stage()),3);assert.deepEqual(await ledger(p),before);await p.locator('#towerClose').click();assert.equal(await p.evaluate(()=>City.isOpen()),true);await p.evaluate(()=>Tower.open());await p.locator('#towerReturnShop').click();assert.equal(await p.evaluate(()=>state.screen),'reception');
  }
  console.log('PASS four viewports: left shelves/table, tall clickable letters, assembly stacking; all tower states, native+fallback, reload and both returns preserve ledger.');
  await fixture(p,{state:{screen:'work',mode:'sort'}});
  await p.evaluate(()=>{state.bag=Array.from({length:24},(_,i)=>makeItem(i%4));Dwarf.onBagPurchased(state.bag);render();for(let i=0;i<35;i++){renderWork();LootkeeperEngine.bridge.capture();}});
  const retained=await p.evaluate(()=>({native:LootkeeperEngine.bridge.nativeNodes.size,detached:[...LootkeeperEngine.bridge.nativeNodes].filter(n=>!n.isConnected).length}));
  assert.equal(retained.detached,0);assert.ok(retained.native<=40,JSON.stringify(retained));
  await p.evaluate(()=>{state.dwarf.enabled=true;LootkeeperEngine.bridge.step=LootkeeperBridge.step;window.liveProbe={frame:LootkeeperEngine.bridge.frame,elapsed:state.story.elapsed};last=performance.now();});
  await p.waitForTimeout(1500);
  const live=await p.evaluate(()=>({frames:LootkeeperEngine.bridge.frame-liveProbe.frame,seconds:state.story.elapsed-liveProbe.elapsed,job:state.dwarf.job?.elapsed||0}));assert.ok(live.frames>0&&live.seconds>.1&&live.job>0,JSON.stringify(live));
  await p.locator('#pause').click();const paused=await p.evaluate(()=>state.story.elapsed);await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>state.story.elapsed),paused);await p.locator('#resume').click();assert.equal(await p.evaluate(()=>state.paused),false);
  console.log('PASS bounded DOM retention after35 refreshes and live frame/worker clock, pause/resume.',JSON.stringify({retained,live}));
  assert.deepEqual(errors,[]);console.log('PASS no page/HTTP errors.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
