const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('file:///'+path.resolve('dist/index.html').replaceAll('\\','/'));await p.locator('#startGame').click();await p.waitForFunction(()=>document.querySelector('#bag.tutorial-focus'));
 assert.equal(await p.locator('.tutorial-ring').count(),0);
 const aura=sel=>p.locator(sel).evaluate(n=>({outline:getComputedStyle(n).outlineStyle,animation:getComputedStyle(n,'::after').animationName,background:getComputedStyle(n,'::after').backgroundImage,z:getComputedStyle(n,'::after').zIndex}));
 assert.equal((await aura('#bag')).animation,'goldenAura');assert.match((await aura('#bag')).background,/conic-gradient/);assert.equal((await aura('#bag')).z,'-1');
 await p.screenshot({path:'audit_source/golden-tutorial-bag.png'});
 for(const sel of ['#settings','#buyBag']){await p.locator(sel).hover();assert.equal((await aura(sel)).animation,'goldenAura');assert.equal((await aura(sel)).outline,'none');}
 await p.locator('#buyBag').click();await p.locator('#shelves [data-cat="3"]').hover();assert.equal((await aura('#shelves [data-cat="3"]')).animation,'goldenAura');
 await p.screenshot({path:'audit_source/golden-tutorial-table.png'});
 await p.locator('#pile .mystery-item').click();assert.equal(await p.locator('#dirt').isVisible(),true);assert.equal(await p.locator('#inspectUnknown').count(),0);assert.equal(await p.locator('#cleanKey').textContent(),'Распознать');assert.equal(await p.locator('body > .dragging').count(),0);
 const stage=await p.locator('.clean-stage').boundingBox(),key=await p.locator('#cleanKey').boundingBox();assert.ok(key.y>stage.y+stage.height);assert.ok(Math.abs(key.x+key.width/2-stage.x-stage.width/2)<2);
 await p.screenshot({path:'audit_source/single-click-study.png'});
 const before=await p.evaluate(()=>({gold:state.gold,rep:state.rep}));await p.evaluate(()=>{for(let i=0;i<80&&!document.getElementById('cleanKey').disabled;i++)document.getElementById('cleanKey').click();});
 assert.equal(await p.evaluate(()=>state.gold),before.gold+12);assert.equal(await p.evaluate(()=>state.rep),before.rep+1);await p.locator('#closeModal').click();
 await p.evaluate(()=>{finishTutorial(true);setScreen('reception');state.paused=true;window.phaseEvents=[];document.getElementById('game').addEventListener('dayperiodchange',e=>phaseEvents.push(e.detail.period));});
 for(const [progress,period,label] of [[0,'morning','Утро'],[.4,'day','День'],[.76,'evening','Вечер'],[1,'night','Ночь']]){
  await p.evaluate(v=>{state.seconds=CONFIG.daySeconds*(1-v);updateHud();updateHud();},progress);assert.equal(await p.locator('#clock').textContent(),label);assert.equal(await p.locator('#game').getAttribute('data-period'),period);assert.equal(await p.locator('.suntrack').isVisible(),false);
  await p.waitForTimeout(450);await p.screenshot({path:'audit_source/daylight-'+period+'.png'});
 }
 assert.deepEqual(await p.evaluate(()=>phaseEvents),['day','evening','night']);
 await p.evaluate(()=>{save();});await p.reload();await p.locator('#loadGame').click();assert.equal(await p.locator('#clock').textContent(),'Ночь');
 assert.deepEqual(errors,[]);console.log('PASS: ray aura without frames on FTUE/items/shelves/buttons, one-click study, centered recognition, rewards, four day periods and saved lighting');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
