'use strict';
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
const leaf='#contractOfferBoard [data-contract-key="royal"]';
const inventory=p=>p.evaluate(()=>owned().map(x=>x.uid).sort((a,b)=>a-b));
async function ready(p){await p.waitForFunction(()=>window.LootkeeperEngine?.ready);await p.evaluate(()=>{LootkeeperEngine.bridge.step=()=>{};});}
async function reload(p){await p.reload();await ready(p);await p.locator('#loadGame').click();}
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);await ready(p);
    const initial=await p.evaluate(()=>{
      cancelDrag();forceCloseModal();BagPour.clear();state=freshState();Object.assign(state,{started:true,day:4,gold:500,screen:'reception',orders:[],order:null,orderUid:0,offers:[],bag:[],unknownTray:[],tutorial:{active:false},city:{version:1,towerOwned:false},visitorCooldown:99999});
      state.story={version:1,letterRead:true,inheritedOpened:true,firstPaid:true,restored:true,firstDayFlowVersion:2,firstDayComplete:true,firstDayPurchases:2,firstDayDeliveries:2,secondDayFlowVersion:2,secondDayActive:false,dwarfEncounterSeen:true,goblinEncounterSeen:true,completedB2:true,completedB3:true,manualAfterDwarf:0,elapsed:20,nextVisit:99999,guild:{version:1,phase:'complete',founded:true,name:'Королевская проверка',draftName:'Королевская проверка'}};
      state.dwarf={hired:true,enabled:false,batches:[]};state.goblin={hired:true,enabled:false};
      state.stock=[...Array(17).fill(18),...Array(15).fill(19),...Array(15).fill(24)].map(type=>{const x=makeItem(type);x.unknown=false;return x;});
      const manual={id:++state.orderUid,accepted:true,customer:1,reward:90,originalReward:90,recipe:[{type:18,count:2}],packed:[state.stock.splice(0,1)[0]],reservedUids:[],assignedTo:'manual',storyOrder:true,title:'Прежнее ручное обещание'};state.orders.push(manual);state.order=manual;
      Story.ensure();Dwarf.ensure();Goblin.ensure();Goblin.reconcile();RoyalProgress.ensure();render();save();return {gold:state.gold,ids:owned().map(x=>x.uid).sort((a,b)=>a-b),manual:{packed:manual.packed.map(x=>x.uid),reserved:manual.reservedUids.slice()}};
    });
    assert.equal(await p.evaluate(()=>Contracts.ready('royal')),false);assert.equal(await p.evaluate(()=>Contracts.signRegular('royal')),false);assert.equal(await p.evaluate(()=>RoyalProgress.advance()),false);
    await p.evaluate(()=>{state.day=5;Story.advance(.1);if(Contracts.ready('royal'))throw Error('Day5 alone must not unlock armoury');state.day=4;const c=Contracts.ensure().chef;c.signed=true;c.deliveries=2;Contracts.ensure();Story.advance(.1);render();save();});await p.waitForSelector('#royalRankNotice');assert.match(await p.locator('#royalRankNotice').textContent(),/Королевская оружейная ждёт поставщика/);assert.match(await p.locator('#royalRankNotice').textContent(),/Все поставки городской кухне выполнены/);
    assert.equal(await p.evaluate(()=>state.gold),initial.gold);assert.deepEqual(await inventory(p),initial.ids,'The milestone grants no goods or money');assert.equal(await p.evaluate(()=>state.story.royalProgress.notified),true);await p.locator('#royalRankContinue').click();await p.locator('#laterOfferSheet').click();
    await reload(p);await p.evaluate(()=>{Story.advance(.1);render();});assert.equal(await p.locator('#royalRankNotice').isVisible(),false,'The saved informational notice is one-time');
    assert.equal(await p.evaluate(()=>Contracts.ready('royal')),true,'Completed kitchen unlocks armoury before day5 without requiring the tower');assert.equal(await p.evaluate(()=>Contracts.ready('alchemy')),false);
    assert.equal(await p.evaluate(()=>Contracts.signRegular('royal')),true);await p.evaluate(()=>render());
    assert.deepEqual(await p.evaluate(()=>Contracts.current('royal').recipe),[{type:18,count:5},{type:19,count:5},{type:24,count:5}]);assert.equal(await p.evaluate(()=>Contracts.current('royal').reward),360);assert.equal(await p.evaluate(()=>customers[Contracts.current('royal').customer][0]),'Интендант короля');
    assert.match(await p.locator(leaf).textContent(),/0\/15/);assert.match(await p.locator(leaf).textContent(),/Железный меч/);assert.equal(await p.locator(leaf+' .agreement-delivery').count(),3);
    await p.locator('#contractsNav').click();assert.match(await p.locator('[data-book-contract-key="royal"]').textContent(),/0\/15/);assert.equal(await p.locator('#signRegularAlchemy').count(),0,'The new kitchen milestone does not unlock alchemy');await p.locator('#closeModal').click();
    await p.setViewportSize({width:820,height:850});await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:'audit_source/royal-contract-15-820.png'});await p.screenshot({path:'audit_source/royal-contract-15-full-820.png',fullPage:true});const sold=[];
    for(let delivery=1;delivery<=3;delivery++){
      await p.locator(leaf+' [data-parcel-action="assistant"]').click();await p.evaluate(()=>{for(let step=0;step<3;step++)Story.advance(10);render();save();});
      const parcel=await p.evaluate(()=>{const o=Contracts.current('royal');return {id:o.id,ready:Goblin.readyToClaim(o),uids:o.packed.map(x=>x.uid),count:o.packed.length};});assert.equal(parcel.ready,true);assert.equal(parcel.count,15);assert.equal(new Set(parcel.uids).size,15);sold.push(...parcel.uids);
      assert.equal(await p.evaluate(()=>state.gold),initial.gold+(delivery-1)*357,'Fifteen packed goods do not pay before a real shipment');await p.locator(leaf+' [data-parcel-action="claim"]').click();
      assert.equal(await p.evaluate(()=>state.gold),initial.gold+delivery*357);assert.equal(await p.evaluate(()=>state.story.regularContracts.royal.deliveries),delivery);assert.deepEqual(await inventory(p),initial.ids.filter(uid=>!sold.includes(uid)));
      assert.deepEqual(await p.evaluate(()=>state.orders.find(o=>o.id===1).packed.map(x=>x.uid)),initial.manual.packed);assert.deepEqual(await p.evaluate(()=>state.orders.find(o=>o.id===1).reservedUids),initial.manual.reserved);
      if(delivery<3){assert.equal(await p.locator(leaf+' .agreement-delivery.checked').count(),delivery);await p.evaluate(()=>{Story.advance(6);Story.advance(6);render();save();});}
    }
    assert.equal(sold.length,45);assert.equal(new Set(sold).size,45);assert.equal(await p.locator(leaf).count(),0);await p.evaluate(()=>{Story.advance(10);Story.advance(10);Contracts.sync();render();save();});assert.equal(await p.evaluate(()=>Contracts.current('royal')||null),null);
    assert.equal(await p.evaluate(()=>state.goblin.feesPaid),9);assert.equal(await p.evaluate(()=>state.goblin.deliveries),3);await reload(p);await p.evaluate(()=>{Story.advance(.1);render();});assert.equal(await p.evaluate(()=>state.gold),1571);assert.equal(await p.evaluate(()=>state.story.regularContracts.royal.deliveries),3);assert.equal(await p.locator(leaf).count(),0);assert.equal(await p.locator('#royalRankNotice').isVisible(),false);assert.equal(await p.evaluate(()=>Contracts.signRegular('royal')),false);assert.deepEqual(errors,[]);
    console.log('PASS: saved one-time completed-kitchen information without free rewards, independent royal unlock, real5swords/5daggers/5helmets with15-count UI, three actual360 sales/fee9,45 original uid and protected manual promise; terminal reload/no fourth.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
