const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');const path=require('node:path');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:800}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('file:///'+path.resolve(__dirname,'../dist/index.html').replaceAll('\\','/'));
 await p.evaluate(()=>document.fonts.ready);assert.equal(await p.evaluate(()=>[...document.fonts].some(f=>f.family==='Roboto Condensed'&&f.status==='loaded')),true);
 await p.locator('#startGame').click();await p.locator('#buyBag').click();await p.evaluate(()=>{state.seconds=CONFIG.daySeconds-INTRO_TIMING[state.day].orders[0];tickArrivals();});assert.equal(await p.locator('#pileCaption').isVisible(),false);
 await p.evaluate(()=>openInspection(2));assert.equal(await p.locator('#inspectTitle').textContent(),'Руда');assert.equal(await p.locator('.inspection-heading').textContent().then(t=>t.includes('СОДЕРЖИМОЕ')),false);
 const title=await p.locator('#inspectTitle').boundingBox(),box=await p.locator('#inspector').boundingBox();assert.ok(Math.abs(title.x+title.width/2-box.x-box.width/2)<2);
 await p.screenshot({path:path.resolve(__dirname,'../audit_source/box-label-roboto.png'),animations:'disabled'});
 await p.evaluate(()=>{closeInspection();state.order.accepted=true;setScreen('work','order');selectBox(2);});
 assert.equal(await p.locator('.source-heading span').count(),0);assert.equal(await p.locator('.source-heading b').textContent(),'Руда');assert.equal(await p.locator('.parcel-count').count(),0);
 await p.clock.install();await p.evaluate(()=>showOrderReward(20,false));
 const samples=await p.locator('#orderReward').evaluate(n=>{const a=n.getAnimations()[0];a.pause();return [0,999,1500,1999].map(t=>{a.currentTime=t;return Number(getComputedStyle(n).opacity);});});
 assert.equal(samples[0],1);assert.equal(samples[1],1);assert.ok(samples[2]>.45&&samples[2]<.55);assert.ok(samples[3]<.01);
 await p.clock.runFor(2000);assert.equal(await p.locator('#orderReward').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: local Roboto Condensed, centered category-only labels, no inner counts, 1s hold + 1s fade');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
