const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('file:///'+path.resolve('dist/index.html').replaceAll('\\','/'));await p.clock.install();
 await p.evaluate(()=>{localStorage.setItem(TUTORIAL_KEY,'1');startGame();state.schedule=[];state.orderSchedule=[];state.offers=[];state.gold=500;render();});
 // Six actual purchases retain positions and put later bags above old items.
 for(let i=0;i<6;i++)await p.evaluate(()=>{state.offers=[{visitor:0,loot:makeLoot(),price:10,qualityRolled:true}];setScreen('reception');buyBag();});
 assert.equal(await p.evaluate(()=>state.bag.length),72);
 assert.equal(await p.locator('#pile').evaluate(n=>getComputedStyle(n).display),'block');
 assert.equal(await p.locator('#pile').evaluate(n=>getComputedStyle(n).overflowY),'hidden');
 assert.ok(await p.locator('#pile').evaluate(n=>{const r=n.getBoundingClientRect();return [...n.querySelectorAll('.item')].every(x=>{const b=x.getBoundingClientRect();return b.left>=r.left-1&&b.right<=r.right+1&&b.top>=r.top-1&&b.bottom<=r.bottom+1;});}));
 assert.ok(await p.evaluate(()=>Math.min(...state.bag.slice(-12).map(x=>x.depth))>Math.max(...state.bag.slice(0,60).map(x=>x.depth))));
 const before=await p.evaluate(()=>state.bag.map(x=>x.tablePos));await p.evaluate(()=>renderWork());assert.deepEqual(await p.evaluate(()=>state.bag.map(x=>x.tablePos)),before);
 assert.ok(await p.evaluate(()=>items.filter(x=>['Синяя чешуя','Красная чешуя'].includes(x.name)).every(x=>x.cat===0)));
 await p.evaluate(()=>{state.orders=Array.from({length:4},(_,i)=>({id:i+1,accepted:true,customer:0,recipe:[{type:24,count:1}],packed:[],reward:20}));state.order=state.orders[0];state.offers=[{visitor:1,loot:[],price:10,qualityRolled:true,arrivalSerial:100}];render();});
 assert.equal(await p.locator('#orderBoard .order-card').count(),4);assert.equal(await p.locator('#checklist').isVisible(),false);
 await p.screenshot({path:'audit_source/workbench-chaotic-orders.png'});
 await p.evaluate(()=>openInspection(0));
 assert.ok(await p.locator('#arrivalSignal').evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.left+30,r.top+30));}));
 await p.clock.runFor(8000);assert.equal(await p.locator('#arrivalSignal').evaluate(n=>n.classList.contains('compact')),false);
 await p.clock.runFor(2100);assert.equal(await p.locator('#arrivalSignal').evaluate(n=>n.classList.contains('compact')),true);
 await p.locator('#arrivalSignal').click();assert.equal(await p.evaluate(()=>state.screen),'reception');
 // A fifth order cannot exceed the four accepted leaflets.
 await p.evaluate(()=>{state.offers=[];const o={id:5,accepted:false,customer:0,recipe:[{type:24,count:1}],packed:[],reward:20};state.orders.push(o);render();openOrder(o);});
 await p.locator('#acceptOrder').click();assert.equal(await p.evaluate(()=>allOrders().filter(o=>o.accepted!==false).length),4);await p.locator('#closeModal').click();
 // Last required item closes the source crate and enables highlighted dispatch.
 await p.evaluate(()=>{state.orders=[{id:10,accepted:true,customer:0,recipe:[{type:24,count:1}],packed:[],reward:20}];state.order=state.orders[0];state.stock=[makeItem(24)];state.offers=[{visitor:1,loot:[],price:10,qualityRolled:true,arrivalSerial:101}];setScreen('work','order');state.activeCat=3;renderWork();});
 await p.locator('#sourceItems .item').click();await p.locator('#parcelDrop').click();
 assert.equal(await p.evaluate(()=>state.activeCat),null);assert.equal(await p.locator('#sourceItems').count(),0);assert.equal(await p.locator('#ship').isEnabled(),true);assert.ok(await p.locator('#ship').evaluate(n=>n.classList.contains('dispatch-ready')));
 await p.screenshot({path:'audit_source/parcel-ready.png'});
 await p.evaluate(()=>openSettings());assert.ok(await p.locator('#arrivalSignal').evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.left+30,r.top+30));}));await p.locator('#arrivalSignal').click();assert.equal(await p.locator('#modal').isVisible(),false);
 // Unknown item action follows its sprite and remains clickable.
 await p.evaluate(()=>{state.orders=[];state.order=null;state.offers=[];state.bag=[{...makeItem(4),unknown:true,tablePos:{x:.4,y:.3}}];setScreen('work','sort');});
 await p.locator('#pile .item').click();let r=await p.locator('body>.item.dragging').boundingBox(),a=await p.locator('#heldRecognize').boundingBox();assert.ok(a.y>=r.y+r.height&&a.y-r.y-r.height<12);
 await p.locator('#heldRecognize').click();assert.equal(await p.locator('#inspectUnknown').isVisible(),true);await p.locator('#closeModal').click();
 r=await p.locator('#pile .item').boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();await p.mouse.move(r.x+140,r.y+25,{steps:8});await p.mouse.up();
 r=await p.locator('#pile .item').boundingBox();a=await p.locator('#heldRecognize').boundingBox();assert.ok(a.y>=r.y+r.height&&a.y-r.y-r.height<12);
 await p.screenshot({path:'audit_source/recognize-under-item.png'});await p.locator('#heldRecognize').click();assert.equal(await p.locator('#inspectUnknown').isVisible(),true);
 assert.deepEqual(errors,[]);console.log('PASS: chaotic six-bag pile without scroll, 4 order leaflets and cap, scales, 10s guest overlay, automatic crate closure, highlighted dispatch, recognition under picked/dropped item');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
