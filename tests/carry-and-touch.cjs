const{chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true});const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:18765');await p.locator('#startGame').tap();await p.locator('#buyBag').tap();
const x=await p.evaluate(()=>{const node=[...document.querySelectorAll('#pile .item')].reverse().find(n=>{const r=n.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.item')===n});const item=state.bag.find(x=>x.uid===Number(node.dataset.uid));return {uid:item.uid,cat:items[item.type].cat}});
await p.locator(`[data-uid="${x.uid}"]`).tap();await p.locator(`[data-cat="${x.cat}"]`).tap();assert.ok(await p.evaluate(uid=>state.stock.some(x=>x.uid===uid),x.uid));
await p.getByRole('button',{name:'Коллекция',exact:true}).tap();await p.locator('.collection-item:not(:disabled)').first().tap();
const cdp=await context.newCDPSession(p),rect=await p.locator('#dirt').boundingBox();
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+10,y:rect.y+10}]});
for(let row=0;row<8;row++){for(let col=0;col<12;col++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:rect.x+5+(row%2?11-col:col)*(rect.width-10)/11,y:rect.y+5+row*(rect.height-10)/7}]});}}
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await p.evaluate(()=>state.collection.length),1);await p.waitForTimeout(500);await p.locator('#closeModal').tap();await p.locator('#modal').waitFor({state:'hidden'});
// Prepare closing boundary without changing the order; exercise actual carry UI.
await p.evaluate(()=>{state.inspectCat=null;state.paused=false;for(const y of [...state.bag])sortItem(y.uid,items[y.type].cat);state.schedule=[];state.offers=[];state.seconds=0;setScreen('reception')});
assert.equal(await p.evaluate(()=>state.bag.length),0,'Closing setup must empty the bag');
const original=await p.evaluate(()=>state.order.reward);await p.locator('#closeDay').tap();await p.locator('#carryBase').tap();assert.equal(await p.evaluate(()=>state.order.reward),Math.floor(original*.8));
await p.locator('#nextDay').tap();assert.equal(await p.evaluate(()=>state.day),2);assert.ok(await p.evaluate(()=>state.order.carried));
await p.evaluate(()=>{state.schedule=[];state.offers=[];setScreen('reception')});await p.locator('#closeDay').tap();await p.locator('#carryBase').tap();assert.equal(await p.evaluate(()=>state.order.reward),Math.floor(original*.8));
assert.deepEqual(errors,[]);console.log('PASS: landscape touch purchase and classification, touch cleaning, explicit carry choice, one-time discount, next-day persistence');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});




