'use strict';
// Regression: the eight-item first purchase must fit the workbench and every item
// must be sortable through the UI; invalid coordinates in an old save must heal.
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
async function geometry(p,label,count=8){
 const report=[];
 // The responsive workbench can be taller than the physical viewport. Check
 // each real centre after scrolling it into view, without weakening pile bounds.
 for(const item of await p.locator('#pile .item').all()){
  await item.scrollIntoViewIfNeeded();
  report.push(await item.evaluate(e=>{const p=document.getElementById('pile').getBoundingClientRect(),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('.item');return{uid:Number(e.dataset.uid),inside:r.left>=p.left-1&&r.right<=p.right+1&&r.top>=p.top-1&&r.bottom<=p.bottom+1,hit:hit===e,rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},pos:state.bag.find(x=>x.uid===Number(e.dataset.uid)).tablePos};}));
 }
 assert.equal(report.length,count,label+': all item buttons rendered');
 assert.deepEqual(report.filter(x=>!x.inside||!x.hit),[],label+': every item must fit and have a clickable centre');
}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const [width,height] of [[1280,800],[820,850]]){
  const p=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);await p.locator('#startGame').click();await p.locator('#acceptInheritance').click();await p.locator('#buyBag').click();
  await p.waitForFunction(()=>typeof BagPour==='undefined'||!BagPour.active());assert.equal(await p.evaluate(()=>state.gold),70,'First bag is bought for ten coins');
  assert.equal(await p.evaluate(()=>state.bag.length),8);await geometry(p,width+' fresh purchased bag');const original=await p.evaluate(()=>JSON.parse(JSON.stringify(state)));
  // Reproduce exactly the bad coordinates written by the old four-item FTUE.
  await p.evaluate(()=>{state.bag.forEach((x,i)=>x.tablePos={x:.12+i*.22,y:.35});save();});
  await p.reload();await p.locator('#loadGame').click();await geometry(p,width+' saved invalid inherited layout');await p.screenshot({path:'audit_source/adaptive-story-first-bag-'+width+'.png',fullPage:true});
  const expected=await p.evaluate(()=>state.bag.map(x=>({uid:x.uid,cat:items[x.type].cat,unknown:isUnknown(x)})));
  for(const x of expected){
   const item=p.locator('#pile [data-uid="'+x.uid+'"]');await item.click();
   if(x.unknown){
    await p.waitForSelector('#dirt');assert.equal(await p.evaluate(()=>state.paused),true);await p.evaluate(()=>{for(let i=0;i<80&&!$('cleanKey').disabled;i++)$('cleanKey').click();});assert.equal(await p.locator('#cleanKey').textContent(),'Распознано');await p.waitForSelector('#modal.hidden',{state:'attached'});await p.locator('#pile [data-uid="'+x.uid+'"]').click();
   }
   assert.equal(await p.evaluate(()=>drag?.uid),x.uid,'Real click picks up uid '+x.uid);await p.locator('#shelves [data-cat="'+x.cat+'"]').click();assert.equal(await p.evaluate(uid=>state.bag.some(x=>x.uid===uid),x.uid),false,'Real shelf click sorts uid '+x.uid);
  }
  assert.equal(await p.evaluate(()=>state.bag.length),0);assert.equal(await p.evaluate(()=>state.stock.length),8);assert.deepEqual(await p.evaluate(()=>state.stock.map(x=>x.uid).sort((a,b)=>a-b)),expected.map(x=>x.uid).sort((a,b)=>a-b));assert.equal(await p.locator('#workProgress').textContent(),'0 на столе');
  await p.waitForFunction(()=>counterGuest()?.kind==='order',{},{timeout:15000});assert.deepEqual(await p.evaluate(()=>counterGuest().value.recipe),[{type:38,count:2}]);assert.equal(await p.locator('#arrivalSignal').isVisible(),true,'Chef notification follows complete first bag');// Exact user save: the first five goods were sorted, leaving two claws and
  // the unknown skull offscreen. Repair must preserve money and all ownership.
  await p.evaluate(original=>{forceCloseModal();cancelDrag();state=JSON.parse(JSON.stringify(original));state.stock=state.bag.splice(0,5);state.bag.forEach((x,i)=>x.tablePos={x:1.22+i*.22,y:.35});state.daySorted=5;state.combo=5;state.sortingBatches.forEach(b=>b.pending=b.pending.filter(uid=>state.bag.some(x=>x.uid===uid)));save();},original);
  await p.reload();await p.locator('#loadGame').click();assert.equal(await p.evaluate(()=>state.gold),70,'Partial-save repair preserves gold');assert.equal(await p.evaluate(()=>state.stock.length),5,'Partial-save repair preserves five sorted goods');assert.deepEqual(await p.evaluate(()=>state.bag.map(x=>x.uid)),[6,7,8]);await geometry(p,width+' partial three-item invalid save',3);assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem(SAVE_KEY)).bag.every(x=>x.tablePos.x>=0&&x.tablePos.x<=1&&x.tablePos.y>=0&&x.tablePos.y<=1)),true,'Repaired positions persist immediately');
  for(const x of expected.filter(x=>[6,7,8].includes(x.uid))){await p.locator('#pile [data-uid="'+x.uid+'"]').click();if(x.unknown){await p.waitForSelector('#dirt');await p.evaluate(()=>{for(let i=0;i<80&&!$('cleanKey').disabled;i++)$('cleanKey').click();});await p.waitForSelector('#modal.hidden',{state:'attached'});await p.locator('#pile [data-uid="'+x.uid+'"]').click();}assert.equal(await p.evaluate(()=>drag?.uid),x.uid);await p.locator('#shelves [data-cat="'+x.cat+'"]').click();}
  assert.equal(await p.evaluate(()=>state.bag.length),0);assert.equal(await p.evaluate(()=>state.stock.length),8);assert.deepEqual(await p.evaluate(()=>state.stock.map(x=>x.uid).sort((a,b)=>a-b)),expected.map(x=>x.uid).sort((a,b)=>a-b));assert.deepEqual(errors,[]);console.log('PASS '+width+'x'+height+': paid fresh8/broken8/broken3 fit and click, partial save preserves gold70+stock5, all8 UI sorts, automatic study close and first chef arrival');await p.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
