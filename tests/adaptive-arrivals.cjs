const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');const path=require('node:path');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:800}});
 await p.goto('file:///'+path.resolve(__dirname,'../dist/index.html').replaceAll('\\','/'));await p.clock.install();await p.locator('#startGame').click();await p.clock.runFor(2100);await p.locator('#buyBag').click();
 // Auto-sort owns the clock until its last item has landed.
 await p.evaluate(()=>{state.stock.push(...state.bag);state.bag=[];state.autoSorting=true;});
 const frozen=await p.evaluate(()=>state.seconds);await p.clock.runFor(5000);assert.equal(await p.evaluate(()=>state.seconds),frozen);
 await p.evaluate(()=>{state.autoSorting=false;renderWork();});await p.clock.runFor(2800);assert.equal(await p.evaluate(()=>allOrders().length),0);
 await p.clock.runFor(300);assert.equal(await p.evaluate(()=>allOrders().length),1);
 assert.ok(await p.evaluate(()=>state.seconds)>frozen-2,'No day-clock fast-forward');
 await p.clock.runFor(5000);assert.equal(await p.evaluate(()=>state.offers.length),0,'Pending customer blocks accelerated arrivals');
 await p.evaluate(()=>{state.order.accepted=true;});await p.clock.runFor(3100);assert.equal(await p.evaluate(()=>state.offers.length),1);
 await p.clock.runFor(3100);assert.equal(await p.evaluate(()=>state.offers.length),1,'Do not pile up accelerated guests');
 const results=await p.evaluate(()=>{
  const out=[];
  for(const day of [1,2]){
   state=freshState();state.started=true;state.day=day;planDay();
   for(let elapsed=0;elapsed<180;elapsed++){
    state.seconds-=.5;tickArrivals();advanceReadyVisitor(1);
    while(state.offers.length){buyBag();state.stock.push(...state.bag);state.bag=[];}
    for(const o of [...allOrders()]){o.accepted=true;state.order=o;for(const r of o.recipe)while(remaining(r)>0){const item=state.stock.find(x=>x.type===r.type);if(!item)break;packItem(item.uid);}if(orderComplete()){state.activeCat=null;finishOrder();}}
    if(!state.schedule.length&&!state.orderSchedule.length&&!state.offers.length&&!allOrders().length){out.push({day,bought:state.dayBought,orders:state.dayOrders,remainingTime:state.seconds});break;}
   }
  }
  return out;
 });
 assert.equal(results.length,2);for(const r of results){assert.equal(r.bought,7);assert.equal(r.orders,r.day===1?2:3);assert.ok(r.remainingTime>60);}
 console.log('PASS: 3-second adaptive gap, ad/animation pause, no time skipping, no guest pileup, 7 + 2/3 quotas preserved',JSON.stringify(results));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
