const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('file:///'+path.resolve('dist/index.html').replaceAll('\\','/'));
 await p.evaluate(()=>{state=freshState();state.started=true;state.upgrade=true;const x=makeItem(4);x.unknown=true;x.tablePos={x:.15,y:.25};state.bag=[x];setScreen('work','sort');});
 await p.waitForTimeout(500);const node=p.locator('#pile .item'),r=await node.boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();await p.mouse.move(r.x+180,r.y+80,{steps:8});
 assert.equal(await p.locator('.dragging.mystery-item').count(),1);assert.equal(await p.locator('.dragging img').evaluate(n=>getComputedStyle(n).filter),'brightness(0)');assert.equal(await p.locator('.dragging').evaluate(n=>getComputedStyle(n).opacity),'1');
 await p.screenshot({path:'audit_source/black-unknown-drag.png'});await p.mouse.up();assert.ok(await p.evaluate(()=>state.bag[0].tablePos.x>.2));assert.equal(await p.locator('#pile .mystery-item').count(),1);
 await p.waitForTimeout(170);await p.locator('#pile .item').click();assert.equal(await p.locator('#inspectUnknown').textContent(),'Распознать');await p.locator('#inspectUnknown').click();await p.waitForTimeout(300);
 await p.evaluate(()=>{for(let i=0;i<80&&!document.getElementById('cleanKey').disabled;i++)document.getElementById('cleanKey').click();});
 assert.equal(await p.locator('#cleanStatus').evaluate(n=>getComputedStyle(n).color),'rgb(255, 223, 118)');
 const source=await p.locator('#recognitionGold').boundingBox();const coin=await p.locator('.reward-coin').first().evaluate(n=>({x:parseFloat(n.style.left),y:parseFloat(n.style.top)}));assert.ok(Math.abs(coin.x-source.x-source.width/2)<2&&Math.abs(coin.y-source.y-source.height/2)<2);
 await p.screenshot({path:'audit_source/yellow-recognition-reward.png'});
 // Buy five bags with an older item still lying on the table.
 const oldUid=await p.evaluate(()=>{closeModal();state=freshState();state.started=true;state.gold=217;planDay();const old=makeItem(0);old.tablePos={x:.1,y:.1};state.bag=[old];trackSortingBag([old]);state.offers=state.schedule.splice(0,5);state.schedule=[];state.orderSchedule=[];render();return old.uid;});
 for(let i=0;i<5;i++){assert.equal(await p.locator('#buyBag').isEnabled(),true);await p.locator('#buyBag').click();if(i<4)await p.locator('#back').click();}
 assert.equal(await p.evaluate(()=>state.gold),167);assert.equal(await p.evaluate(()=>state.bag.length),61);assert.ok(await p.evaluate(uid=>state.bag.some(x=>x.uid===uid),oldUid));assert.equal(await p.evaluate(()=>state.sortingBatches.length),6);
 assert.equal(await p.locator('#pile.crowded-pile').count(),1);assert.ok(await p.locator('#pile').evaluate(n=>n.scrollHeight>n.clientHeight));await p.screenshot({path:'audit_source/five-bags-on-table.png'});
 await p.evaluate(()=>save());await p.reload();await p.locator('#loadGame').click();assert.equal(await p.evaluate(()=>state.bag.length),61);
 await p.evaluate(()=>{state.collection=items.map(x=>x.id);showAutoSortAd();document.getElementById('confirmAuto').disabled=false;});await p.evaluate(()=>autoSort());assert.equal(await p.evaluate(()=>state.gold),227);assert.equal(await p.evaluate(()=>state.sortingBatches.length),0);assert.equal(await p.evaluate(()=>state.stock.length),61);
 assert.deepEqual(errors,[]);console.log('PASS: black drag ghost and movement, recognize wording, yellow money origin, five bag purchases preserve pile, scrolling, reload, six independent sorting rewards');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
