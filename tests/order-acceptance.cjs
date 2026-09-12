const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');const path=require('node:path');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:800}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('file:///'+path.resolve(__dirname,'../dist/index.html').replaceAll('\\','/'));
 await p.locator('#startGame').click();await p.locator('#buyBag').click();await p.evaluate(()=>{state.seconds=CONFIG.daySeconds-INTRO_TIMING[state.day].orders[0];tickArrivals();});
 assert.equal(await p.locator('#checklist').isVisible(),false);assert.equal(await p.evaluate(()=>state.order.accepted),false);
 await p.locator('#ordersNav').click();assert.equal(await p.evaluate(()=>state.screen),'reception');
 await p.locator('#closeModal').click();assert.equal(await p.evaluate(()=>state.order.accepted),false);
 await p.locator('#receptionOrder').click();await p.locator('#acceptOrder').click();
 assert.equal(await p.evaluate(()=>state.screen),'reception');assert.equal(await p.evaluate(()=>state.order.accepted),true);
 assert.equal(await p.locator('#receptionOrder').textContent(),'Собрать поручение');assert.ok(await p.locator('#receptionOrder').evaluate(n=>n.classList.contains('primary')));
 await p.reload();await p.locator('#loadGame').click();assert.equal(await p.evaluate(()=>state.order.accepted),true);
 await p.locator('#receptionOrder').click();await p.locator('#beginAssembly').click();assert.equal(await p.evaluate(()=>state.mode),'order');assert.equal(await p.locator('#checklist').isVisible(),true);
 await p.evaluate(()=>setScreen('work','sort'));assert.equal(await p.locator('#assembleNote').textContent(),'Собрать поручение');
 assert.deepEqual(errors,[]);console.log('PASS: pending order hidden, acceptance at counter, separate assembly button, saved acceptance, checklist');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
