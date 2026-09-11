const{chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('file:///D:/WEB-Project/WEB_Guild_Warehouse/dist/index.html');await p.locator('#startGame').click();
const days=[];
async function fill(){await p.evaluate(()=>{setScreen('work','order');for(const r of state.order.recipe){state.activeCat=items[r.type].cat;while(remaining(r)>0){const x=state.stock.find(x=>x.type===r.type);if(!x)break;packItem(x.uid);}}state.activeCat=null;renderWork();});}
for(let day=1;day<=5;day++){
 let batches=0;
 while(await p.evaluate(()=>!!(state.schedule.length||state.offers.length))){
  if(!await p.evaluate(()=>state.offers.length)){await p.evaluate(()=>setScreen('reception'));await p.locator('#waitVisitor').click();}
  await p.locator('#buyBag').click();batches++;
  const before=await p.evaluate(()=>state.gold);
  await p.evaluate(()=>{while(state.bag.length)sortItem(state.bag[0].uid,items[state.bag[0].type].cat);});
  assert.equal(await p.evaluate(()=>state.gold),before);
  if(await p.evaluate(()=>!!state.order)){await fill();if(await p.evaluate(()=>orderComplete()))await p.locator('#ship').click();else await p.evaluate(()=>setScreen('reception'));}
  if(batches>5)throw Error('Loop exceeded bag budget');
 }
 await p.evaluate(()=>setScreen('reception'));
 assert.equal(await p.evaluate(()=>state.order),null,'All guaranteed recipes fulfilled by day end');
 days.push(await p.evaluate(()=>({day:state.day,gold:state.gold,orders:state.dayOrders,rank:rank()+1,stock:state.stock.length})));
 await p.locator('#closeDay').click();await p.locator('#finishDay').click();assert.equal(await p.evaluate(()=>state.ended),true);
 for(let i=0;i<12;i++){await p.keyboard.press('Tab');assert.ok(await p.evaluate(()=>$('modal').contains(document.activeElement)));}
 if(day<5)await p.locator('#nextDay').click();
}
assert.equal(await p.evaluate(()=>state.day),5);await p.screenshot({path:'audit_source/playtest-five-days.png'});
await p.reload();await p.locator('#loadGame').click();assert.equal(await p.evaluate(()=>state.ended),true);assert.ok(await p.locator('#nextDay').isVisible());
await p.locator('#nextDay').click();assert.equal(await p.evaluate(()=>state.day),1);assert.equal(await p.evaluate(()=>state.gold),80);
// Cancel the fake ad: no transfer. Complete it: inventory conserved, no payment.
await p.locator('#buyBag').click();const loot=await p.evaluate(()=>owned().length);await p.locator('#autoSortButton').click();await p.locator('#closeModal').click();assert.equal(await p.evaluate(()=>state.bag.length),loot);
await p.locator('#autoSortButton').click();await p.locator('#confirmAuto').click();await p.waitForFunction(()=>!state.autoSorting);assert.equal(await p.evaluate(()=>state.bag.length),0);assert.equal(await p.evaluate(()=>owned().length),loot);assert.equal(await p.evaluate(()=>state.gold),70);
assert.deepEqual(errors,[]);console.log('PASS: five days, guaranteed orders, no sorting pay, cash, ranks, modal focus, final save and restart, ad cancel and completion');console.log(JSON.stringify(days));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
