'use strict';
// Saved inspection positions must never hide the contents of the packing crate.
// No "tidy" action is used: the player opens the source and packs real instances.
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
const inventory=p=>p.evaluate(()=>owned().map(x=>x.uid).sort((a,b)=>a-b));
async function exposedSource(p){
  await p.locator('#sourceScroll').scrollIntoViewIfNeeded();
  return p.evaluate(()=>{
    const pane=$('sourceScroll').getBoundingClientRect();
    return [...document.querySelectorAll('#sourceItems .item')].filter(e=>{
      const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
      return x>=pane.left&&x<=pane.right&&y>=pane.top&&y<=pane.bottom&&document.elementFromPoint(x,y)?.closest('.item')===e;
    }).map(e=>Number(e.dataset.uid));
  });
}
async function pick(p,uid){
  const e=p.locator('#sourceItems [data-uid="'+uid+'"]');await e.scrollIntoViewIfNeeded();
  const target=await e.evaluate(e=>{const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,pane=document.getElementById('sourceScroll').getBoundingClientRect();return {x,y,inside:x>=pane.x&&x<=pane.right&&y>=pane.y&&y<=pane.bottom,hit:document.elementFromPoint(x,y)?.closest('.item')===e};});
  assert.equal(target.inside,true,'Source centre is inside its scrolling pane');assert.equal(target.hit,true,'Source centre receives the actual click');await p.mouse.click(target.x,target.y);assert.equal(await p.evaluate(()=>drag?.uid),uid);
}
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    for(const [width,height] of [[1280,800],[820,850]]){
      const p=await browser.newPage({viewport:{width,height}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);
      const original=await p.evaluate(()=>{
        cancelDrag();forceCloseModal();BagPour.clear();state=freshState();state.orderUid=0;state.started=true;state.screen='work';state.mode='sort';state.day=3;state.gold=200;state.tutorial={active:false};state.orders=[];state.offers=[];state.bag=[];state.junk=[];state.unknownTray=[];
        state.story={version:1,letterRead:true,inheritedOpened:true,firstPaid:true,restored:true,firstDayFlowVersion:2,firstDayComplete:true,firstDayPurchases:2,firstDayDeliveries:2,secondDayFlowVersion:1,secondDayActive:false,dwarfEncounterSeen:true,elapsed:0,nextVisit:999,hireOrders:4,completedB2:false,manualAfterDwarf:0};
        state.dwarf={hired:true,enabled:false,batches:[]};state.goblin={hired:false,enabled:false};
        const positions=[{x:99999,y:99999},{x:NaN,y:NaN},{x:-999,y:-999},{x:.5,y:50000},{x:120,y:140},{x:Infinity,y:Infinity}];
        state.stock=Array.from({length:22},(_,i)=>{const x=makeItem(38);x.unknown=false;x.boxPos={...positions[i%positions.length]};if(i%3!==0)x.sourcePos={...positions[(i+1)%positions.length]};return x;});
        const order={id:++state.orderUid,accepted:true,customer:4,reward:90,title:'Четыре кусочка мяса',recipe:[{type:38,count:4}],packed:[],reservedUids:[],storyOrder:true};state.orders=[order];state.order=order;state.totalOrders=4;
        const workerItem=makeItem(38);workerItem.unknown=false;workerItem.tablePos={x:.5,y:.5};state.bag=[workerItem];Story.ensure();Dwarf.ensure();Dwarf.onBagPurchased([workerItem]);Goblin.ensure();Goblin.reconcile();save();return {ids:owned().map(x=>x.uid).sort((a,b)=>a-b),stock:state.stock.map(x=>x.uid),order:order.id,worker:workerItem.uid};
      });
      await p.reload();await p.locator('#loadGame').click();assert.equal(await p.evaluate(()=>state.gold),200);assert.deepEqual(await inventory(p),original.ids,'Repairing saved positions preserves ownership');
      await p.locator('#orderBoard [data-order-id="'+original.order+'"]').click();await p.locator('#shelves [data-cat="4"]').click();
      assert.equal(await p.locator('#shelves [data-cat="4"] .shelf-count').textContent(),'22');assert.equal(await p.locator('#sourceItems .item').count(),22);assert.ok((await exposedSource(p)).length>0,'Opening the22-item crate immediately exposes actual clickable goods');
      assert.equal(await p.evaluate(()=>state.gold),200,'Position repair spends nothing');await p.screenshot({path:'audit_source/adaptive-source-crate-22-'+width+'.png',fullPage:true});
      // All22 original source items can be reached by scrolling; no tidy button.
      for(const uid of original.stock){const e=p.locator('#sourceItems [data-uid="'+uid+'"]');await e.scrollIntoViewIfNeeded();assert.ok((await exposedSource(p)).includes(uid),'Original uid '+uid+' is reachable in the source pane');}
      await pick(p,original.stock[0]);await p.evaluate(()=>Dwarf.setEnabled(true));await p.waitForTimeout(2800);
      assert.equal(await p.evaluate(()=>drag?.uid),original.stock[0]);assert.equal(await p.evaluate(()=>drag.node.isConnected),true,'A background source refresh preserves the held original');assert.equal(await p.evaluate(()=>state.dwarf.sorted),1);assert.equal(await p.evaluate(()=>state.gold),198,'The worker charges only its normal two-coin batch fee');
      assert.equal(await p.evaluate(()=>state.stock.length),23);assert.ok(await p.locator('#sourceItems .item').count()>=22,'A deferred worker refresh keeps the existing source populated while an item is held');await p.locator('#parcelDrop').click();assert.equal(await p.locator('#sourceItems .item').count(),22,'Releasing the held item refreshes the complete source contents');
      for(const uid of original.stock.slice(1,4)){await pick(p,uid);await p.locator('#parcelDrop').click();}
      assert.deepEqual(await p.evaluate(()=>state.order.packed.map(x=>x.uid)),original.stock.slice(0,4),'The parcel contains exactly four selected originals');assert.equal(await p.evaluate(()=>orderComplete()),true);assert.equal(await p.evaluate(()=>state.stock.length),19);assert.deepEqual(await inventory(p),original.ids,'Packing changes location without copying or dropping anything');
      await p.locator('#ship').click();assert.equal(await p.evaluate(()=>state.gold),288);assert.deepEqual(await inventory(p),original.ids.filter(uid=>!original.stock.slice(0,4).includes(uid)),'Shipment removes only the four delivered instances');assert.deepEqual(errors,[]);await p.close();
      console.log('PASS '+width+': saved huge/NaN/pixel box positions,22 goods visible without tidy, real scroll/click packing, live worker refresh, original reservations and exact money.');
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
