'use strict';
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
const errors=[];
async function ledger(p){return p.evaluate(()=>({gold:state.gold,ids:owned().map(x=>x.uid).sort((a,b)=>a-b),orders:state.orders.map(o=>({id:o.id,packed:o.packed.map(x=>x.uid),reserved:o.reservedUids.slice()})),dwarf:state.dwarf.enabled}));}
async function fixture(p){await p.evaluate(()=>{
  forceCloseModal();Tower.close('none');City.close();BagPour.clear();cancelDrag();state=freshState();
  state.started=true;state.screen='reception';state.mode='sort';state.day=1;state.gold=160;state.orders=[];state.orderUid=1;state.tutorial={active:false};state.stock=[];state.bag=[];
  const packed=makeItem(0),reserved=makeItem(0);packed.unknown=reserved.unknown=false;state.stock.push(reserved,makeItem(38),makeItem(38));
  const partial={id:1,accepted:true,regularKey:'chef',recipe:[{type:0,count:2}],packed:[packed],reservedUids:[reserved.uid],customer:4,reward:120,title:'Частичная сохранённая посылка'};
  state.orders=[partial];state.order=partial;state.dwarf={hired:false,enabled:false};state.goblin={hired:false,enabled:false};
  state.story={letterRead:true,inheritedOpened:true,firstPaid:true,firstDayComplete:true,firstDayPurchases:2,firstDayDeliveries:2,firstDayFlowVersion:2,secondDayFlowVersion:2,secondDayActive:true,secondDayPurchases:0,secondDaySorted:0,secondDayDeliveries:0,secondDaySupplyRun:0,restored:false,repairPromptSeen:true,repairOfferPending:false,nextVisit:999,regularContracts:{chef:{signed:true,deliveries:0,delegated:false,nextAt:9999}}};
  Story.ensure();Dwarf.ensure();Goblin.ensure();Goblin.reconcile();render();save();
});}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
  for(const width of [1280,820]){
    const p=await browser.newPage({viewport:{width,height:850},reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);
    await p.waitForFunction(()=>window.LootkeeperEngine?.ready&&typeof Tower!=='undefined'&&!!$('towerInterior'));
    await fixture(p);
    assert.equal(await p.evaluate(()=>City.unlocked()),false);assert.equal(await p.locator('#cityNav').isVisible(),false);
    assert.equal(await p.evaluate(()=>City.open()),false,'The map cannot be opened before the tower chapter');
    assert.equal(await p.evaluate(()=>{state.day=4;const result=City.open();state.day=1;return result;}),false,'A new game does not unlock the city merely by reaching day four');
    // Reproduce an old save already on the map when a repair becomes ready.
    await p.evaluate(()=>{state.city.mapUnlocked=true;state.city.guildTowerOfferUnlocked=true;City.open();});
    assert.equal(await p.evaluate(()=>City.isOpen()),true);
    const before=await ledger(p);
    await p.evaluate(()=>Restoration.prompt());
    assert.equal(await p.evaluate(()=>City.isOpen()),false);assert.equal(await p.evaluate(()=>state.screen),'reception');
    assert.equal(await p.locator('#clock').textContent(),'Утро');assert.equal(await p.evaluate(()=>Number($('game').style.getPropertyValue('--light-night'))),0);
    await p.locator('#restoreShop').click();assert.equal(await p.evaluate(()=>state.gold),130);assert.equal(await p.evaluate(()=>Restoration.begin()),false);
    assert.equal(await p.evaluate(()=>{const room=$('reception').getBoundingClientRect(),overlay=$('restorationScene').getBoundingClientRect();return Math.abs(room.top-overlay.top)<2&&room.top<innerHeight/3&&overlay.bottom>0;}),true,'The repair overlay and changed room are actually in view after leaving the city');
    await p.evaluate(()=>{state.paused=true;state.story.restoration.elapsed=1.25;Restoration.update();save();});
    const saved=await p.evaluate(()=>JSON.stringify(state.story.restoration));await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>JSON.stringify(state.story.restoration)),saved);
    await p.reload();await p.waitForFunction(()=>window.LootkeeperEngine?.ready);await p.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}));
    await p.locator('#loadGame').click();assert.equal(await p.evaluate(()=>JSON.stringify(state.story.restoration)),saved,'Reload preserves the exact active repair clock');
    await p.evaluate(()=>{delete document.hidden;state.paused=true;state.story.restoration.elapsed=0;Restoration.update();});
    const almost=await p.evaluate(()=>{state.paused=false;Restoration.advance(3.999);state.paused=true;return {active:Restoration.active(),day:state.day,phase:state.story.restoration.phase,elapsed:state.story.restoration.elapsed};});
    assert.deepEqual(almost,{active:true,day:1,phase:'repair',elapsed:3.999});
    const finished=await p.evaluate(()=>{state.paused=false;Restoration.advance(.001);state.paused=true;return {active:Restoration.active(),day:state.day,stage:state.story.shopRestorationStage,clock:$('clock').textContent};});
    assert.deepEqual(finished,{active:false,day:2,stage:1,clock:'Утро'},'Exactly four active seconds finish the repair without another dawn');
    assert.deepEqual(await ledger(p),{...before,gold:130});
    await p.evaluate(()=>{state.paused=false;state.story.secondDayComplete=true;state.story.secondDayEndPending=true;state.story.secondDayPurchases=6;state.story.secondDayDeliveries=2;state.story.secondDaySupplyRun=3;state.story.dwarfEncounterSeen=true;state.offers=[];state.bag=[];delete state.story.sortingGate;state.visitorCooldown=0;state.city.mapUnlocked=true;City.open();Story.advance(.01);});
    assert.equal(await p.evaluate(()=>City.isOpen()),false,'The furnishing notice also leaves the map');assert.equal(await p.evaluate(()=>state.screen),'reception');
    assert.equal(await p.locator('#clock').textContent(),'Утро');
    const secondBefore=await ledger(p),started=Date.now();await p.locator('#startThirdDay').click();
    if(width===820){
      await p.waitForTimeout(2100);assert.equal(await p.evaluate(()=>state.story.restoration?.phase),'repair');assert.equal(await p.locator('#clock').textContent(),'Утро');
      await p.waitForFunction(()=>!Restoration.active(),{},{timeout:9000});
      assert.ok(Date.now()-started>=3700,'The live Phaser frame loop plays the four-second transformation');
      assert.ok(Date.now()-started<9500,'There is no separate night/dawn or stalled overlay');
    }else await p.evaluate(()=>Restoration.advance(4));
    await p.evaluate(()=>{state.paused=true;Restoration.update();});
    assert.equal(await p.evaluate(()=>state.day),3);assert.equal(await p.evaluate(()=>state.story.shopRestorationStage),2);assert.equal(await p.locator('#clock').textContent(),'Утро');
    assert.deepEqual(await ledger(p),secondBefore,'Furnishing has no new price and preserves partial real parcels');
    await p.screenshot({path:'audit_source/phaser-repair-four-seconds-'+width+'.png',fullPage:true});
    // A saved old dawn is already earned: migrate it directly to its morning.
    if(width===1280){const legacyGold=await p.evaluate(()=>{state.day=2;state.story.shopRestorationStage=1;state.story.restoration={kind:'furnish',phase:'dawn',elapsed:.8,startDay:2,charged:true};Restoration.afterLoad();return state.gold;});assert.equal(await p.evaluate(()=>Restoration.active()),false);assert.equal(await p.evaluate(()=>state.day),3);assert.equal(legacyGold,secondBefore.gold);}
    await p.evaluate(()=>{state.paused=false;state.city={accessVersion:2,mapUnlocked:false,towerOwned:false};state.story.guild={version:1,founded:true,name:'Гильдия проверки',phase:'charter'};state.story.completedB3=true;state.story.secondDayActive=false;state.story.secondDayEndPending=false;state.story.nextVisit=999;state.story.forceSupplier=false;state.gold=1000;render();});
    assert.equal(await p.evaluate(()=>City.unlocked()),false);assert.equal(await p.evaluate(()=>City.open()),false,'The charter itself does not prematurely open the city');
    await p.evaluate(()=>{forceCloseModal();state.story.guild.phase='city_intro';City.update();City.open('tower');});assert.equal(await p.evaluate(()=>City.isOpen()),true);
    await p.locator('#guildCityNext').click();await p.locator('#cityBuyTower').click();assert.equal(await p.evaluate(()=>state.gold),0);assert.equal(await p.evaluate(()=>state.city.towerPaid),1000);
    assert.equal(await p.evaluate(()=>City.buyTower()),false,'The tower is charged once');
    const owned=await ledger(p);await p.screenshot({path:'audit_source/phaser-tower-purchased-map-'+width+'.png',fullPage:true});await p.locator('#cityEnterTower').click();await p.waitForFunction(()=>Tower.isOpen()&&LootkeeperEngine.stats?.scene==='Tower');
    assert.equal(await p.evaluate(()=>state.screen),'tower');assert.equal(await p.locator('#towerInterior').isVisible(),true);assert.equal(await p.evaluate(()=>City.isOpen()),false);
    assert.deepEqual(await ledger(p),owned,'Entering the scene does not change money or inventory');
    await p.screenshot({path:'audit_source/phaser-tower-interior-'+width+'.png',fullPage:true});
    await p.evaluate(()=>save());await p.reload();await p.waitForFunction(()=>window.LootkeeperEngine?.ready);await p.locator('#loadGame').click();
    await p.waitForFunction(()=>Tower.isOpen()&&LootkeeperEngine.stats?.scene==='Tower');assert.deepEqual(await ledger(p),owned,'Loading inside the tower preserves ownership and partial parcels');
    await p.locator('#towerClose').click();assert.equal(await p.evaluate(()=>City.isOpen()),true);await p.locator('#cityOpenTower').click();await p.waitForFunction(()=>Tower.isOpen());
    await p.locator('#towerReturnShop').click();assert.equal(await p.evaluate(()=>state.screen),'reception');assert.equal(await p.evaluate(()=>City.isOpen()),false);assert.deepEqual(await ledger(p),owned);
    await p.close();
  }
  assert.deepEqual(errors,[]);console.log('PASS: exactly 4 active seconds, morning repair notices leave city, no dawn, pause/reload/legacy dawn and original partial UID/money preservation; city locked until tower chapter; one-charge purchase, native Tower entry/load/city/shop return at 1280/820.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
