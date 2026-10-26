'use strict';

// Uses an isolated Edge context, never the player's live browser profile.
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
const ordinary=id=>'#orderBoard [data-order-id="'+id+'"]';
const agreement='#contractOfferBoard [data-contract-key="chef"]';
const inventory=p=>p.evaluate(()=>owned().map(x=>x.uid).sort((a,b)=>a-b));
async function fixture(p,{hired=false,contracts=false}={}){
  return p.evaluate(({hired,contracts})=>{
    cancelDrag();forceCloseModal();BagPour.clear();state=freshState();
    Object.assign(state,{started:true,day:3,gold:1000,screen:'reception',orders:[],order:null,orderUid:0,offers:[],bag:[],unknownTray:[],tutorial:{active:false},city:{version:1,towerOwned:true,towerPaid:1000},visitorCooldown:99999});
    state.story={version:1,letterRead:true,inheritedOpened:true,firstPaid:true,restored:true,firstDayFlowVersion:2,firstDayComplete:true,firstDayPurchases:2,firstDayDeliveries:2,secondDayFlowVersion:1,secondDayActive:false,dwarfEncounterSeen:true,goblinEncounterSeen:true,completedB2:true,completedB3:true,manualAfterDwarf:0,elapsed:20,nextVisit:99999,guild:{version:1,phase:'complete',founded:true,name:'Проверка посылок',draftName:'Проверка посылок'}};
    state.dwarf={hired:true,enabled:false,batches:[]};state.goblin={hired,enabled:false};
    state.stock=Array.from({length:3},()=>[38,38,31,31,32,32]).flat().map(type=>{const x=makeItem(type);x.unknown=false;return x;});
    if(!contracts){
      const partial=state.stock.splice(state.stock.findIndex(x=>x.type===38),1)[0];
      const first={id:++state.orderUid,accepted:true,customer:4,reward:90,originalReward:90,recipe:[{type:38,count:2},{type:31,count:2}],packed:[partial],reservedUids:[],assignedTo:'manual',storyOrder:true,title:'Первая настоящая посылка'};
      const second={id:++state.orderUid,accepted:true,customer:4,reward:90,originalReward:90,recipe:[{type:32,count:2}],packed:[],reservedUids:[],assignedTo:'manual',storyOrder:true,title:'Следующая ручная посылка'};
      state.orders.push(first,second);state.order=first;
    }
    Story.ensure();Dwarf.ensure();Goblin.ensure();Goblin.reconcile();render();save();
    return {gold:state.gold,uids:owned().map(x=>x.uid).sort((a,b)=>a-b),partial:state.orders[0]?.packed.map(x=>x.uid)||[],manualReserved:state.orders[1]?.reservedUids.slice()||[]};
  },{hired,contracts});
}
async function readyEngine(p){
  await p.waitForFunction(()=>window.LootkeeperEngine?.ready);
  // Keep the real renderer and hit targets active, but advance simulation
  // explicitly so packing cannot race UI assertions or a saved fixture.
  await p.evaluate(()=>{window.__parcelInterfaceStep=LootkeeperEngine.bridge.step;LootkeeperEngine.bridge.step=()=>{};});
}
async function reload(p){await p.reload();await readyEngine(p);await p.locator('#loadGame').click();}
async function reachable(p,selector){
  const value=await p.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {inside:r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,hit:hit===el||el.contains(hit)};});
  assert.deepEqual(value,{inside:true,hit:true},selector+' is visible and receives real input');
}
async function screenshot(p,path){
  try{await p.screenshot({path});}
  catch(error){
    if(error.code!=='UNKNOWN'&&error.errno!==-4094)throw error;
    const alternate=path.replace(/\.png$/,'-rerun-'+Date.now()+'.png');await p.screenshot({path:alternate});console.log('Screenshot saved separately because Windows could not open the previous PNG: '+alternate);
  }
}
async function finishPackingAtCounter(p){await p.evaluate(()=>{setScreen('reception');for(let i=0;i<3;i++)Story.advance(6);render();save();});}
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.setDefaultTimeout(10000);p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);await readyEngine(p);
    const initial=await fixture(p);await p.locator('#upgradesNav').click();await p.locator('#hireGoblinUpgrades').click();
    assert.equal(await p.evaluate(()=>state.gold),760);assert.equal(await p.evaluate(()=>state.goblin.hired&&state.goblin.enabled),true,'Hiring starts Grik immediately');
    assert.equal(await p.evaluate(()=>Goblin.isAssigned(state.orders.find(o=>o.id===1))),true,'The first real partial parcel becomes his initial task');
    assert.equal(await p.evaluate(()=>Goblin.isAssigned(state.orders.find(o=>o.id===2))),false,'Other accepted manual promises stay with the owner');
    assert.deepEqual(await p.evaluate(()=>state.orders.find(o=>o.id===1).packed.map(x=>x.uid)),initial.partial);
    await p.evaluate(()=>{Story.advance(.1);render();});assert.equal(await p.evaluate(()=>state.goblin.job?.orderId),1);
    assert.equal(await p.locator(ordinary(1)).getAttribute('class').then(x=>x.includes('parcel-assistant-working')),true);
    assert.notEqual(await p.locator(ordinary(1)).evaluate(el=>getComputedStyle(el).animationName),'none','The working parcel has a pulsing aura');
    await screenshot(p,'audit_source/parallel-contracts-phaser-parcel-working-1280.png');await p.setViewportSize({width:820,height:850});await reachable(p,ordinary(1)+' [data-parcel-action="manual"]');await screenshot(p,'audit_source/parallel-contracts-phaser-parcel-working-820.png');await p.setViewportSize({width:1280,height:800});
    await p.locator('#dwarfStation').click();assert.equal(await p.evaluate(()=>state.screen+'/'+state.mode),'work/sort');assert.equal(await p.locator('#goblinUpgrades').isVisible(),false);
    await p.locator('#back').click();await p.locator('#goblinStation').click();assert.equal(await p.evaluate(()=>state.screen+'/'+state.mode),'work/order');assert.equal(await p.evaluate(()=>state.order.id),1);assert.equal(await p.evaluate(()=>$('modal').classList.contains('hidden')),true,'Grik opens his parcel instead of upgrades');await p.locator('#back').click();
    await finishPackingAtCounter(p);
    assert.equal(await p.evaluate(()=>state.gold),760,'Packing at the counter does not issue payment');assert.equal(await p.evaluate(()=>state.goblin.feesPaid),0);assert.equal(await p.evaluate(()=>state.goblin.deliveries),0);
    assert.equal(await p.locator(ordinary(1)+' [data-parcel-action="claim"]').textContent(),'Выполнено');assert.ok(await p.locator(ordinary(1)).getAttribute('class').then(x=>x.includes('parcel-ready')));
    const ready=await p.evaluate(()=>JSON.parse(JSON.stringify(state.orders.find(o=>o.id===1)))),beforeClaim=await inventory(p);
    assert.deepEqual(await p.evaluate(()=>state.orders.find(o=>o.id===2).reservedUids),initial.manualReserved,'The second manual reservation stays protected');
    await screenshot(p,'audit_source/parallel-contracts-parcel-ready-counter-1280.png');await reload(p);assert.equal(await p.evaluate(()=>state.gold),760);assert.equal(await p.evaluate(()=>Goblin.readyToClaim(state.orders.find(o=>o.id===1))),true);assert.deepEqual(await inventory(p),beforeClaim);
    await p.setViewportSize({width:820,height:850});await reachable(p,ordinary(1)+' [data-parcel-action="claim"]');await screenshot(p,'audit_source/parallel-contracts-parcel-ready-counter-820.png');await screenshot(p,'audit_source/parallel-contracts-phaser-parcel-ready-820.png');
    await p.locator(ordinary(1)+' [data-parcel-action="claim"]').click();
    const paid=await p.evaluate(()=>({gold:state.gold,deliveries:state.goblin.deliveries,fees:state.goblin.feesPaid,receipts:state.goblin.receipts.length,total:state.totalOrders,income:state.dayIncome}));
    assert.deepEqual(paid,{gold:847,deliveries:1,fees:3,receipts:1,total:1,income:90});
    assert.equal(await p.locator('.parcel-receipt').count(),1);assert.equal(await p.locator('.reward-coin').count(),9,'Real coins fly from the completed letter');
    assert.equal(await p.locator('.parcel-receipt').evaluate(el=>el.getAnimations()[0].effect.getTiming().duration),1500);
    assert.equal(await p.evaluate(o=>Goblin.claim(o),ready),false);assert.equal(await p.evaluate(()=>state.gold),847,'Repeated collection cannot credit another payment');
    assert.deepEqual(await inventory(p),beforeClaim.filter(uid=>!ready.packed.some(x=>x.uid===uid)),'Only the original packed instances leave inventory');
    await screenshot(p,'audit_source/parallel-contracts-parcel-receipt-820.png');await p.waitForFunction(()=>!document.querySelector('.parcel-receipt'),undefined,{timeout:3500});
    await reload(p);assert.equal(await p.evaluate(()=>state.gold),847);assert.equal(await p.evaluate(()=>state.goblin.receipts.length),1);assert.equal(await p.evaluate(()=>state.goblin.feesPaid),3);assert.equal(await p.locator(ordinary(1)).count(),0);
    await reachable(p,ordinary(2)+' [data-parcel-action="manual"]');await p.locator(ordinary(2)+' [data-parcel-action="manual"]').click();assert.equal(await p.evaluate(()=>state.screen+'/'+state.mode),'work/order');assert.equal(await p.evaluate(()=>state.order.id),2);assert.equal(await p.evaluate(()=>$('modal').classList.contains('hidden')),true);
    await p.locator('#back').click();await p.locator(ordinary(2)+' [data-parcel-action="assistant"]').click();assert.equal(await p.evaluate(()=>state.goblin.enabled&&Goblin.isAssigned(state.orders.find(o=>o.id===2))),true);assert.ok(await p.locator(ordinary(2)).getAttribute('class').then(x=>x.includes('parcel-assistant-working')));
    await p.locator(ordinary(2)+' [data-parcel-action="manual"]').click();assert.equal(await p.evaluate(()=>state.screen+'/'+state.mode),'work/order');assert.equal(await p.evaluate(()=>Goblin.isAssigned(state.order)),false);assert.equal(await p.evaluate(()=>state.goblin.enabled),true,'Taking the parcel back preserves the worker switch');
    console.log('PASS: real hire starts first partial parcel; protected manual order; Borin/Grik navigation; counter readiness without payout; claim credits87/fee3 once; coins and1500ms receipt; reload; direct manual/helper actions1280/820.');

    const series=await fixture(p,{hired:true,contracts:true});await p.evaluate(()=>{Contracts.signRegular('chef');render();save();});
    for(let delivery=1;delivery<=3;delivery++){
      assert.equal(await p.locator(agreement+' .agreement-delivery').count(),3);assert.equal(await p.locator(agreement+' .agreement-delivery.checked').count(),delivery-1);assert.equal(await p.locator(agreement+' [data-parcel-action="manual"]').textContent(),'Собрать самому');
      if(delivery===1){await p.locator('#contractsNav').click();assert.equal(await p.locator('[data-book-contract-key="chef"] [data-parcel-action="assistant"]').textContent(),'Доверить помощнику');await p.locator('[data-book-contract-key="chef"] [data-parcel-action="manual"]').click();assert.equal(await p.evaluate(()=>state.screen+'/'+state.mode),'work/order');assert.equal(await p.evaluate(()=>state.order.regularKey),'chef');assert.equal(await p.evaluate(()=>$('modal').classList.contains('hidden')),true);await p.locator('#back').click();}
      await p.locator(agreement+' [data-parcel-action="assistant"]').click();assert.ok(await p.locator(agreement).getAttribute('class').then(x=>x.includes('parcel-assistant-working')));await finishPackingAtCounter(p);
      assert.equal(await p.evaluate(()=>state.gold),series.gold+(delivery-1)*197,'Ready agreement parcels also wait for their button');
      assert.equal(await p.locator(agreement+' [data-parcel-action="claim"]').textContent(),'Выполнено');await p.locator(agreement+' [data-parcel-action="claim"]').click();assert.equal(await p.evaluate(()=>state.gold),series.gold+delivery*197);assert.equal(await p.evaluate(()=>state.story.regularContracts.chef.deliveries),delivery);
      if(delivery<3){assert.equal(await p.locator(agreement+' .agreement-delivery.checked').count(),delivery);await p.evaluate(()=>{Story.advance(6);Story.advance(6);render();save();});}
    }
    assert.equal(await p.locator(agreement).count(),0);assert.equal(await p.locator('.parcel-receipt').last().locator('.agreement-delivery.checked').count(),3,'The final disappearing letter shows all three earned checks');await p.evaluate(()=>{Story.advance(6);Story.advance(6);render();save();});assert.equal(await p.evaluate(()=>Contracts.current('chef')||null),null);assert.equal(await p.evaluate(()=>state.goblin.feesPaid),9);assert.equal(await p.evaluate(()=>state.goblin.deliveries),3);
    await reload(p);assert.equal(await p.evaluate(()=>state.gold),1591);assert.equal(await p.locator(agreement).count(),0);assert.equal(await p.evaluate(()=>Contracts.signRegular('chef')),false);assert.deepEqual(errors,[]);
    console.log('PASS: agreement shares direct actions/aura/ready claim, three actual197 net sales and fee9; three checks, terminal save without fourth parcel.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
