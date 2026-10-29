'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
  const p=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:18765/');await p.waitForFunction(()=>window.LootkeeperEngine?.ready);
  await p.evaluate(()=>{
    forceCloseModal();Tower.close('none');City.close();BagPour.clear();cancelDrag();state=freshState();state.started=true;state.screen='reception';state.mode='sort';state.day=3;state.gold=100;
    state.tutorial={active:false};state.offers=[];state.bag=[];state.stock=[];state.orders=[];state.order=null;
    state.story={letterRead:true,inheritedOpened:true,firstPaid:true,firstDayComplete:true,restored:true,shopRestorationStage:2,firstDayFlowVersion:2,firstDayPurchases:2,firstDayDeliveries:2,secondDayFlowVersion:2,secondDayActive:false,completedB2:true,completedB3:true,dwarfEncounterSeen:true,goblinEncounterSeen:true,elapsed:32,nextVisit:999,regularContracts:{}};
    state.dwarf={hired:true,enabled:false,batches:[]};state.goblin={hired:true,enabled:false,deliveries:1};Story.ensure();Dwarf.ensure();Goblin.ensure();Contracts.ensure();Goblin.reconcile();LootkeeperEngine.bridge.step=()=>{};render();
  });
  for(let stage=0;stage<3;stage++)for(let customer=0;customer<5;customer++){
    await p.evaluate(({stage,customer})=>{state.story.shopRestorationStage=stage;state.orders=[{id:1,accepted:false,customer,arrivalSerial:88,reward:90,recipe:[{type:6,count:1}],packed:[],reservedUids:[]}];state.order=state.orders[0];Restoration.update();renderReception();},{stage,customer});
    await p.waitForFunction(()=>LootkeeperEngine.stats?.scene==='Reception');await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const r=await p.evaluate(()=>{const snap=LootkeeperEngine.bridge.current(),s=LootkeeperEngine.game.scene.getScene('Reception'),entry=[...s.views].find(([id])=>id.startsWith('visitor:'))?.[1].sprite;return {b:snap.bounds,w:entry.displayWidth,h:entry.displayHeight,x:entry.x,y:entry.y,sw:entry.texture.getSourceImage().width,sh:entry.texture.getSourceImage().height,key:entry.texture.key,gold:state.gold,order:state.orders[0].customer};});
    const fit=Math.max(r.b.width/1536,r.b.height/1024),left=r.b.x+(r.b.width-1536*fit)/2,top=r.b.y+(r.b.height-1024*fit)/2,scale=Math.min(1536*.22/r.sw,1024*.65/r.sh)*1.4*fit;
    for(const [a,b]of [[r.x,left+650*fit],[r.y+r.h/2,top+950*fit],[r.w,r.sw*scale],[r.h,r.sh*scale]])assert.ok(Math.abs(a-b)<.1,'Customer uses approved adventurer scale and anchor');
    assert.equal(r.gold,100);assert.equal(r.order,customer);
  }
  await p.screenshot({path:'audit_source/reception-customer-layout-20261029.png'});assert.deepEqual(errors,[]);console.log('PASS: all five parcel customers in three shop stages use X650/Y950/140%, with original orders and gold preserved.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
