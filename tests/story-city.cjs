'use strict';
// The map is a working view of the same shop, not a pause or a copied inventory.
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
const inventory=p=>p.evaluate(()=>owned().map(x=>x.uid).sort((a,b)=>a-b));
const work=p=>p.evaluate(()=>JSON.stringify({gold:state.gold,seconds:state.seconds,elapsed:state.story.elapsed,dwarf:state.dwarf.job,goblin:state.goblin.job,bag:state.bag.map(x=>x.uid),stock:state.stock.map(x=>x.uid),packed:state.orders.map(o=>[o.id,o.packed.map(x=>x.uid)])}));
const staff=p=>p.evaluate(()=>JSON.stringify({gold:state.gold,dwarf:state.dwarf.job,goblin:state.goblin.job,bag:state.bag.map(x=>x.uid),stock:state.stock.map(x=>x.uid),packed:state.orders.map(o=>[o.id,o.packed.map(x=>x.uid)])}));
async function reachable(p,selector){const r=await p.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {inside:r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,hit:hit===e||e.contains(hit)};});assert.deepEqual(r,{inside:true,hit:true},selector+' fits and receives input');}
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);await p.waitForFunction(()=>typeof City!=='undefined');
    const original=await p.evaluate(()=>{
      cancelDrag();forceCloseModal();BagPour.clear();state=freshState();state.orderUid=0;state.started=true;state.screen='work';state.mode='sort';state.day=3;state.gold=1500;state.tutorial={active:false};state.offers=[];state.bag=[];state.junk=[];state.unknownTray=[];
      state.story={version:1,letterRead:true,inheritedOpened:true,firstPaid:true,restored:true,firstDayFlowVersion:2,firstDayComplete:true,firstDayPurchases:2,firstDayDeliveries:2,secondDayFlowVersion:1,secondDayActive:false,dwarfEncounterSeen:true,goblinEncounterSeen:true,completedB2:true,manualAfterDwarf:3,elapsed:20,nextVisit:999,guild:{version:1,founded:true,name:'Гильдия теста',phase:'complete'},automation:{version:1,enabled:false,activated:false},regularContracts:{chef:{signed:true,delegated:true,deliveries:0,nextAt:0},alchemy:{signed:false,delegated:false,deliveries:0,nextAt:9999,offerSeen:true,offerState:'later'}}};
      state.dwarf={hired:true,enabled:true,batches:[]};state.goblin={hired:true,enabled:true};
      state.stock=[38,38,38,38,31,31,32,32,24].map(type=>{const x=makeItem(type);x.unknown=false;return x;});
      const manual={id:++state.orderUid,accepted:true,customer:4,reward:90,title:'Ручная посылка',recipe:[{type:38,count:2}],packed:[],reservedUids:[]};
      const automatic={id:++state.orderUid,accepted:true,customer:4,reward:120,title:'Регулярная кухня',recipe:[{type:38,count:2},{type:31,count:2},{type:32,count:2}],packed:[],reservedUids:[],regularKey:'chef',assignedTo:'goblin'};
      state.orders=[manual,automatic];state.order=manual;
      const batch=[24,0,6].map((type,i)=>{const x=makeItem(type);x.unknown=false;x.tablePos=tutorialTablePosition(i,3);return x;});state.bag=batch;
      Story.ensure();Dwarf.ensure();Dwarf.onBagPurchased(batch);Goblin.ensure();Goblin.reconcile();City.ensure();render();save();return {ids:owned().map(x=>x.uid).sort((a,b)=>a-b),manual:manual.id,automatic:automatic.id,reserved:manual.reservedUids.slice()};
    });
    assert.equal(await p.evaluate(()=>Contracts.ready('alchemy')),false,'An old signed agreement does not fabricate tower ownership');assert.equal(await p.evaluate(()=>Contracts.signRegular('alchemy')),false,'New signatures wait for a real tower purchase');
    await p.locator('#cityNav').click();assert.equal(await p.evaluate(()=>City.isOpen()),true);assert.equal(await p.evaluate(()=>state.paused),false,'Opening the city keeps simulation active');assert.equal(await p.evaluate(()=>Contracts.ready('alchemy')),false,'A map visit does not unlock other new other agreements');
    const before=await p.evaluate(()=>({sorted:state.dwarf.sorted,packed:state.goblin.packed}));await p.waitForTimeout(2800);
    assert.ok(await p.evaluate(()=>state.dwarf.sorted)>before.sorted,'Borin really sorts while the map is open');assert.ok(await p.evaluate(()=>state.goblin.packed)>before.packed,'Grik really packs while the map is open');assert.deepEqual(await inventory(p),original.ids,'Viewing the map never copies or consumes stock');
    assert.deepEqual(await p.evaluate(id=>state.orders.find(o=>o.id===id).reservedUids,original.manual),original.reserved,'The map preserves manual reservations');
    await p.locator('#settings').click();const paused=await work(p);await p.evaluate(()=>Story.advance(10));await p.waitForTimeout(400);assert.equal(await work(p),paused,'Settings pause workers and the active day even on the map');await p.locator('#resumeSettings').click();
    await p.evaluate(()=>{Dwarf.setEnabled(false);Goblin.setEnabled(false);save();});const stopped=await staff(p);await p.waitForTimeout(300);assert.equal(await staff(p),stopped,'Individual worker switches also apply on the map');
    await p.locator('#cityTower').click();await p.waitForSelector('#cityTowerDetails');assert.equal(await p.locator('#cityBuyTower').count(),0,'The tower purchase is offered starting on day4');assert.equal(await p.evaluate(()=>City.buyTower()),false,'The day gate also protects the purchase transaction');
    await p.evaluate(()=>{state.day=4;City.update();});assert.equal(await p.locator('#cityBuyTower').isEnabled(),true);assert.equal(await p.evaluate(()=>Contracts.ready('alchemy')),false,'The fourth day still needs the property transaction');
    const purchaseGold=await p.evaluate(()=>state.gold),purchaseIds=await inventory(p);await p.locator('#cityBuyTower').click();assert.equal(await p.evaluate(()=>state.city.towerOwned),true);assert.equal(await p.evaluate(()=>Contracts.ready('alchemy')),true);assert.equal(await p.evaluate(()=>state.gold),purchaseGold-1000,'The existing tower costs1000 once');assert.deepEqual(await inventory(p),purchaseIds,'Purchasing property never alters item ownership');
    const afterPurchase=await p.evaluate(()=>state.gold);await p.evaluate(()=>{if(typeof City.buyTower==='function')City.buyTower();});assert.equal(await p.evaluate(()=>state.gold),afterPurchase,'A duplicate purchase cannot debit again');
    await p.reload();await p.locator('#loadGame').click();assert.equal(await p.evaluate(()=>state.city.towerOwned),true);assert.equal(await p.evaluate(()=>state.gold),afterPurchase);assert.deepEqual(await inventory(p),purchaseIds,'Tower ownership and every unfinished item survive save/load');assert.equal(await p.evaluate(()=>state.dwarf.enabled),false);assert.equal(await p.evaluate(()=>state.goblin.enabled),false);
    if(!await p.evaluate(()=>City.isOpen()))await p.locator('#cityNav').click();
    await p.locator('#cityTower').click();
    for(const [width,height] of [[1280,800],[1024,768],[820,850]]){
      await p.setViewportSize({width,height});await p.waitForFunction(({width,height})=>{const r=$('game').getBoundingClientRect(),expected=Math.min(width/1280,height/800);return innerWidth===width&&innerHeight===height&&Math.abs(r.width-1280*expected)<1&&r.left>=-1&&r.top>=-1&&r.right<=width+1&&r.bottom<=height+1;},{width,height});
      for(const selector of ['#cityClose','#cityTower','#settings'])await reachable(p,selector);await p.screenshot({path:'audit_source/city-owned-tower-'+width+'.png'});
    }
    await p.locator('#cityClose').click();assert.equal(await p.evaluate(()=>City.isOpen()),false);assert.equal(await p.evaluate(()=>state.paused),false);assert.deepEqual(errors,[]);
    console.log('PASS: real parallel staff on the city map, protected manual stock, real pause/saved switches, day4 tower gate, single1000 debit, preserved ownership/save and reachable map controls1280/1024/820.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
