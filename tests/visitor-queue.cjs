const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('file:///'+path.resolve('dist/index.html').replaceAll('\\','/'));
 const result=await p.evaluate(()=>{
  for(let run=0;run<30;run++){
   state=freshState();state.started=true;state.gold=500;
   for(let day=1;day<=2;day++){
    state.day=day;planDay();let accepted=0;
    for(let t=0;t<=180;t+=2){state.seconds=180-t;tickArrivals();let guard=0;
     while(counterGuest()&&guard++<20){const head=counterGuest();setScreen('reception');
      if(head.kind==='bag'){
       if(document.getElementById('receptionOrder'))throw Error('Order action mixed with adventurer');
       const pending=allOrders().find(o=>o.accepted===false);if(pending){openOrder(pending);if(state.paused)throw Error('Opened out-of-turn order');}
       buyBag();state.stock.push(...state.bag);state.bag=[];
      }else{
       const gold=state.gold;buyBag();if(state.gold!==gold)throw Error('Bought out-of-turn bag');
       const o=head.value;if(day===1){const demand=new Map();for(const order of allOrders())for(const r of order.recipe)demand.set(r.type,(demand.get(r.type)||0)+r.count);for(const [type,n] of demand)if(countType(type)<n)throw Error('Day 1 recipe unavailable or over-reserved');}
       openOrder(o);document.getElementById('acceptOrder').click();accepted++;
      }
      tickArrivals();
     }
    }
    if(accepted!==3||state.dayBought!==7)throw Error(`Quota: day ${day}, orders ${accepted}, bags ${state.dayBought}`);
    if(day===1&&!allOrders().some(o=>o.customer===4))throw Error('No chef finale');
   }
  }
  setScreen('reception');return allOrders().length;
 });assert.equal(result,6);
 await p.locator('#ordersNav').click();assert.equal(await p.locator('[data-accepted-order]').count(),6);
 await p.screenshot({path:'audit_source/accepted-orders-list.png'});
 await p.locator('[data-accepted-order]').nth(2).click();assert.equal(await p.locator('#beginAssembly').count(),1);
 await p.locator('#beginAssembly').click();assert.equal(await p.evaluate(()=>state.order.customer),4);
 await p.evaluate(()=>save());const queueBefore=await p.evaluate(()=>visitorQueue().map(x=>[x.kind,x.value.arrivalSerial]));
 await p.reload();await p.locator('#loadGame').click();assert.deepEqual(await p.evaluate(()=>visitorQueue().map(x=>[x.kind,x.value.arrivalSerial])),queueBefore);assert.equal(await p.evaluate(()=>allOrders().length),6);
 // One clock jump must interleave actual arrivals by event time.
 const order=await p.evaluate(()=>{state=freshState();state.started=true;planDay();state.stock=state.schedule[0].loot.map(x=>({...x}));state.seconds=155;tickArrivals();return visitorQueue().map(x=>x.kind);});assert.deepEqual(order,['bag','order','bag']);
 assert.deepEqual(errors,[]);console.log('PASS: 30 two-day runs, 7+3 daily quotas, first-day reserved stock, FIFO counter actions, accepted list, chef, save/resume');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
