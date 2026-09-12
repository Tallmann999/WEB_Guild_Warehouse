const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('file:///'+path.resolve('dist/index.html').replaceAll('\\','/'));
 await p.locator('#startGame').click();
 const stats=await p.evaluate(()=>{let total=0,organic=0;for(let d=1;d<=2;d++){state.day=d;for(let j=0;j<100;j++){planDay();for(const o of [...state.offers,...state.schedule]){total+=o.loot.length;organic+=o.loot.filter(x=>items[x.type].organic).length;}if(d===2&&!state.schedule.some(o=>o.big))throw Error('No guaranteed big bag');}}return {total,organic,items:items.length};});
 assert.equal(stats.items,84);assert.ok(stats.organic/stats.total>.56&&stats.organic/stats.total<.63);
 await p.evaluate(()=>{state=freshState();state.started=true;planDay();state.gold=500;render();openUpgrade();});
 assert.equal(await p.locator('.upgrade-card').count(),4);await p.screenshot({path:'audit_source/four-upgrades.png'});
 for(let i=0;i<4;i++){if(i)await p.evaluate(()=>openUpgrade());await p.locator(i?'#buyUpgrade'+i:'#buyUpgrade').click();}
 assert.deepEqual(await p.evaluate(()=>({gold:state.gold,chance:state.bigBagChance,capacity:state.bagCapacity,bonus:state.orderBonus,junk:state.upgrade})),{gold:395,chance:.05,capacity:true,bonus:true,junk:true});
 await p.evaluate(()=>{state.day=2;planDay();state.seconds=141;tickArrivals();state.offers=state.offers.filter(o=>o.big);state.orders=[];state.order=null;render();});
 assert.match(await p.locator('#buyBag').textContent(),/20 монет/);assert.match(await p.locator('#bag img').getAttribute('src'),/bag-premium/);
 await p.screenshot({path:'audit_source/premium-bag.png'});const gold=await p.evaluate(()=>state.gold);await p.locator('#buyBag').click();assert.equal(await p.evaluate(()=>state.gold),gold-20);assert.ok(await p.evaluate(()=>state.bag.length>=26));
 await p.screenshot({path:'audit_source/monster-loot.png'});
 // Full day supply, existing order reservations, then the chef's end-of-day request.
 for(let trial=0;trial<30;trial++){
  const result=await p.evaluate(()=>{state=freshState();state.started=true;planDay();state.stock=state.schedule.flatMap(o=>o.loot);state.schedule=[];state.dayOrdersCreated=0;createOrder();const first=state.order;first.accepted=true;state.dayOrdersCreated=2;createOrder();const chef=state.order;
   return {customer:chef.customer,title:chef.title,count:chef.recipe.length,valid:chef.recipe.every(r=>items[r.type].food&&countType(r.type)>=r.count+(first.recipe.find(x=>x.type===r.type)?.count||0))};});
  assert.equal(result.customer,4);assert.equal(result.title,'Меню для короля');assert.equal(result.count,3);assert.equal(result.valid,true);
 }
 await p.evaluate(()=>{render();openOrder(state.order);});await p.screenshot({path:'audit_source/royal-chef.png'});
 await p.evaluate(()=>{closeModal();save();});await p.reload();await p.locator('#loadGame').click();assert.equal(await p.evaluate(()=>allOrders().some(o=>o.title==='Меню для короля')),true);
 assert.deepEqual(errors,[]);console.log('PASS: 54 new assets, ~60% organic loot, four functional upgrades, guaranteed premium bag, available chef recipe, save/resume');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
