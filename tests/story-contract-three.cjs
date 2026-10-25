'use strict';

// Isolated browser storage: real sales close a three-shipment agreement while
// older accepted parcels and their original inventory survive migration.
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
const leaf='#contractOfferBoard [data-contract-key="chef"]';
async function fixture(p){
  return p.evaluate(()=>{
    cancelDrag();forceCloseModal();BagPour.clear();state=freshState();
    Object.assign(state,{started:true,day:4,gold:500,screen:'reception',orders:[],order:null,orderUid:0,offers:[],bag:[],unknownTray:[],tutorial:{active:false},city:{version:1,towerOwned:true,towerPaid:1000}});
    state.story={version:1,letterRead:true,inheritedOpened:true,firstPaid:true,restored:true,firstDayFlowVersion:2,firstDayComplete:true,firstDayPurchases:2,firstDayDeliveries:2,secondDayFlowVersion:1,secondDayActive:false,dwarfEncounterSeen:true,goblinEncounterSeen:true,completedB2:true,completedB3:true,manualAfterDwarf:0,elapsed:20,nextVisit:99999};
    state.story.guild={version:1,phase:'complete',founded:true,name:'Проверка серии',draftName:'Проверка серии'};
    state.dwarf={hired:true,enabled:false,batches:[]};state.goblin={hired:true,enabled:false};state.visitorCooldown=99999;
    state.stock=Array.from({length:3},()=>[38,38,31,31,32,32]).flat().map(type=>{const x=makeItem(type);x.unknown=false;return x;});
    state.stock.push(makeItem(0));Story.ensure();Dwarf.ensure();Goblin.ensure();render();save();
    return {gold:state.gold,uids:owned().map(x=>x.uid).sort((a,b)=>a-b)};
  });
}
async function packCurrent(p){
  return p.evaluate(()=>{
    forceCloseModal();const o=Contracts.current('chef');
    for(const row of o.recipe)while(o.packed.filter(x=>x.type===row.type).length<row.count){
      const i=state.stock.findIndex(x=>x.type===row.type);if(i<0)throw Error('Fixture lacks a real ingredient');
      o.packed.push(state.stock.splice(i,1)[0]);
    }
    state.activeCat=null;openOrder(o);render();save();return JSON.parse(JSON.stringify(o));
  });
}
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.setDefaultTimeout(8000);p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);
    const initial=await fixture(p);assert.equal(await p.evaluate(()=>Contracts.signRegular('chef')),true);await p.evaluate(()=>render());
    assert.equal(await p.locator(leaf+' .agreement-delivery').count(),3);assert.equal(await p.locator(leaf+' .checked').count(),0);
    assert.equal(await p.locator('#contractOfferBoard').textContent().then(x=>x.includes('СРОЧНО')),false);
    const sold=[];
    for(let delivery=1;delivery<=3;delivery++){
      const order=await packCurrent(p);sold.push(...order.packed.map(x=>x.uid));await p.locator('#ship').click();
      assert.equal(await p.evaluate(()=>state.gold),initial.gold+delivery*120,'Only a real shipment credits its 120 coins');
      assert.equal(await p.evaluate(()=>state.story.regularContracts.chef.deliveries),delivery);
      assert.deepEqual(await p.evaluate(()=>owned().map(x=>x.uid).sort((a,b)=>a-b)),initial.uids.filter(uid=>!sold.includes(uid)));
      await p.evaluate(o=>{Contracts.onDelivery(o);render();},order);
      assert.equal(await p.evaluate(()=>state.story.regularContracts.chef.deliveries),delivery,'Repeated notification cannot add a check');
      if(delivery<3){
        assert.equal(await p.locator(leaf+' .agreement-delivery.checked').count(),delivery);
        await p.evaluate(()=>{state.story.elapsed+=13;Contracts.sync();render();save();});
        assert.ok(await p.evaluate(()=>Contracts.current('chef')));
      }
    }
    assert.equal(await p.locator(leaf).count(),0,'The finished agreement disappears');
    await p.evaluate(()=>{state.story.elapsed+=100;Contracts.sync();render();save();});
    assert.equal(await p.evaluate(()=>Contracts.current('chef')||null),null,'No fourth parcel is generated');
    assert.equal(await p.evaluate(()=>Contracts.signRegular('chef')),false,'The completed series is not signed again');
    await p.reload();await p.locator('#loadGame').click();
    assert.equal(await p.evaluate(()=>state.story.regularContracts.chef.deliveries),3);assert.equal(await p.locator(leaf).count(),0);
    assert.equal(await p.evaluate(()=>Contracts.current('chef')||null),null);
    console.log('PASS: three actual shipments, original uid consumption, three checks, one-time credits, terminal reload.');

    await fixture(p);const legacy=await p.evaluate(()=>{
      Contracts.signRegular('chef');const c=state.story.regularContracts.chef,o=Contracts.current('chef');
      c.deliveries=7;c.deliveryOrderIds=[];const x=state.stock.splice(state.stock.findIndex(x=>x.type===38),1)[0];o.packed.push(x);
      Goblin.reconcile();Contracts.ensure();render();save();
      return {gold:state.gold,uids:owned().map(x=>x.uid).sort((a,b)=>a-b),packed:o.packed.map(x=>x.uid),reserved:o.reservedUids.slice(),id:o.id};
    });
    await p.reload();await p.locator('#loadGame').click();
    assert.equal(await p.evaluate(()=>state.story.regularContracts.chef.deliveries),7,'Historical earned deliveries stay intact');
    assert.deepEqual(await p.evaluate(()=>owned().map(x=>x.uid).sort((a,b)=>a-b)),legacy.uids);
    assert.deepEqual(await p.evaluate(()=>Contracts.current('chef').packed.map(x=>x.uid)),legacy.packed);
    assert.deepEqual(await p.evaluate(()=>Contracts.current('chef').reservedUids),legacy.reserved);
    assert.equal(await p.evaluate(()=>state.gold),legacy.gold);assert.equal(await p.evaluate(()=>state.goblin.enabled||state.dwarf.enabled),false);
    assert.equal(await p.locator(leaf).count(),1,'An older accepted parcel stays accessible after the historical series limit');
    assert.equal(await p.locator(leaf+' .agreement-delivery.checked').count(),3);
    const last=await packCurrent(p);await p.locator('#ship').click();await p.evaluate(()=>{state.story.elapsed+=100;Contracts.sync();render();save();});
    assert.equal(await p.evaluate(()=>state.gold),legacy.gold+120);assert.equal(await p.evaluate(()=>state.story.regularContracts.chef.deliveries),8);
    assert.equal(await p.evaluate(()=>Contracts.current('chef')||null),null);assert.equal(await p.locator(leaf).count(),0);
    assert.deepEqual(await p.evaluate(()=>owned().map(x=>x.uid).sort((a,b)=>a-b)),legacy.uids.filter(uid=>!last.packed.some(x=>x.uid===uid)));
    assert.deepEqual(errors,[]);console.log('PASS: old seven-delivery agreement retains its accepted partial parcel, reserves, disabled workers and exact inventory; no further repeat.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
