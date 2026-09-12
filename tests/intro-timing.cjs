const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');const path=require('node:path');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:800}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('file:///'+path.resolve(__dirname,'../dist/index.html').replaceAll('\\','/'));await p.clock.install();await p.locator('#startGame').click();
 await p.clock.runFor(2100);assert.equal(await p.evaluate(()=>state.offers.length),1);await p.locator('#buyBag').click();
 assert.equal(await p.evaluate(()=>allOrders().length),0);await p.clock.runFor(32000);
 assert.equal(await p.evaluate(()=>allOrders().length),1);assert.equal(await p.locator('#arrivalSignal').isVisible(),true);
 const results=await p.evaluate(()=>{
  const results=[];
  for(let trial=0;trial<10;trial++){
   state=freshState();state.started=true;
   for(let day=1;day<=2;day++){
    state.day=day;planDay();state.screen='work';state.mode='sort';
    const visits=[],requests=[];
    for(let t=0;t<=180;t++){
     state.seconds=CONFIG.daySeconds-t;const previous=state.dayOrdersCreated;tickArrivals();
     if(state.dayOrdersCreated>previous)requests.push(t);
     while(state.offers.length){visits.push(t);buyBag();state.stock.push(...state.bag);state.bag=[];}
     for(const o of [...allOrders()]){
      o.accepted=true;state.order=o;
      for(const r of o.recipe)while(remaining(r)>0){const x=state.stock.find(x=>x.type===r.type);if(!x)break;packItem(x.uid);}
      if(orderComplete()){state.activeCat=null;finishOrder();}
     }
    }
    results.push({day,visits,requests,created:state.dayOrdersCreated,bought:state.dayBought,completed:state.dayOrders,remaining:allOrders().length});
   }
  }
  return results;
 });
 for(const r of results){assert.deepEqual(r.visits,r.day===1?[2,22,43,64,85,108,132]:[2,20,39,58,78,99,122]);assert.deepEqual(r.requests,r.day===1?[14,76]:[12,52,94]);assert.equal(r.created,r.day===1?2:3);assert.equal(r.bought,7);assert.equal(r.completed,r.day===1?2:3);assert.equal(r.remaining,0);}
 // Idle players still receive exactly the daily quota; reload cannot duplicate it.
 await p.evaluate(()=>{state=freshState();state.started=true;planDay();state.seconds=0;tickArrivals();save();});
 assert.equal(await p.evaluate(()=>state.offers.length),7);assert.equal(await p.evaluate(()=>allOrders().length),2);
 await p.reload();await p.locator('#loadGame').click();await p.evaluate(()=>{tickArrivals();tickArrivals();});
 assert.equal(await p.evaluate(()=>state.offers.length),7);assert.equal(await p.evaluate(()=>allOrders().length),2);
 // Legacy random schedules are expanded without removing purchased bags.
 const migrated=await p.evaluate(()=>{state=freshState();state.started=true;planDay();state.dayBought=1;state.schedule=state.schedule.slice(1,3);delete state.timingVersion;delete state.orderSchedule;restoreOrders();return {total:state.dayBought+state.offers.length+state.schedule.length,orders:state.orderSchedule.length};});
 assert.deepEqual(migrated,{total:7,orders:2});
 assert.equal(await p.locator('#waitVisitor').count(),0);assert.deepEqual(errors,[]);
 console.log('PASS: automatic arrivals on live clock, workbench half-speed, 10 two-day runs with 7 adventurers per day and 2/3 completable orders');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
