'use strict';
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
async function geometry(page){return page.evaluate(()=>{
  const rect=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
  const table=rect($('table')),work=$('work'),scene=$('bagPourScene'),sack=scene.firstElementChild;
  const root=rect(scene),scaleX=work.getBoundingClientRect().width/work.offsetWidth,scaleY=work.getBoundingClientRect().height/work.offsetHeight;
  const origin=getComputedStyle(sack).transformOrigin.split(' ').map(parseFloat);
  const firstNode=$('pile').querySelector('.item'),first=rect(firstNode),matrix=new DOMMatrixReadOnly(getComputedStyle(firstNode).transform);
  return {table,centre:{x:table.x+table.width/2,y:table.y+table.height/2},mouth:{x:root.x+origin[0]*scaleX,y:root.y+origin[1]*scaleY},first:{x:first.x+first.width/2,y:first.y+first.height/2},firstAngle:Math.atan2(matrix.b,matrix.a),firstOpacity:getComputedStyle(firstNode).opacity,opacity:getComputedStyle(sack).opacity,foreground:getComputedStyle(scene).zIndex,imgOpacity:getComputedStyle(sack.firstElementChild).opacity,native:LootkeeperEngine.game.scene.getScene('Workbench').views.has('pour-bag'),scroll:{height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,innerHeight,innerWidth}};
});}
function centred(report,label){
  assert.ok(Math.abs(report.mouth.x-report.centre.x)<1&&Math.abs(report.mouth.y-report.centre.y)<1,label+': opening is over the measured table centre: '+JSON.stringify(report));
  assert.ok(report.scroll.height<=report.scroll.innerHeight&&report.scroll.width<=report.scroll.innerWidth,label+': no outer scrolling');
  assert.equal(report.native,false,'Sack remains the single DOM foreground actor');
  assert.equal(report.imgOpacity,'1');
}
async function ownership(page){return page.evaluate(()=>({gold:state.gold,daySpent:state.daySpent,dayBought:state.dayBought,bag:state.bag.map(x=>({uid:x.uid,type:x.type,tablePos:x.tablePos,tableAngle:x.tableAngle})),stock:state.stock.map(x=>x.uid)}));}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
  for(const [width,height]of [[1280,800],[1280,720],[1920,920]]){
    const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));await page.goto(BASE);await page.waitForFunction(()=>window.LootkeeperEngine?.ready);
    await page.locator('#startGame').click();await page.locator('#acceptInheritance').click();
    // Isolate presentation time while using the actual purchase and UID path.
    await page.evaluate(()=>{LootkeeperEngine.bridge.step=()=>{};});await page.locator('#buyBag').click();await page.mouse.move(3,3);
    await page.waitForFunction(()=>$('bagPourScene')?.querySelector('img').naturalWidth>0&&LootkeeperEngine.stats?.scene==='Workbench');
    const original=await ownership(page);assert.equal(original.gold,70);assert.equal(original.bag.length,8);assert.equal(original.daySpent,10);assert.equal(original.dayBought,1);
    await page.evaluate(()=>BagPour.advance(.17));await page.waitForTimeout(80);let report=await geometry(page);centred(report,width+' launch');
    assert.ok(Math.abs(report.first.x-report.mouth.x)<1&&Math.abs(report.first.y-report.mouth.y)<1,'First real item launches from the opening, with its actual button size');
    assert.equal(Number(report.opacity),1);
    await page.evaluate(()=>BagPour.advance(.20));await page.waitForTimeout(100);const beforeResize=await geometry(page);
    await page.screenshot({path:'audit_source/bag-pour-centre-'+width+'x'+height+'.png'});
    await page.locator('#pause').click();assert.equal(await page.evaluate(()=>state.paused),true);
    const next=width===1280?{width:1920,height:920}:{width:1280,height:720};await page.setViewportSize(next);await page.waitForTimeout(150);
    report=await geometry(page);centred(report,width+' resized to '+next.width);
    assert.ok(Math.abs(report.firstAngle-beforeResize.firstAngle)<.00001,'Resizing repositions the same active pose without advancing or restarting its clock');
    assert.equal(report.firstOpacity,beforeResize.firstOpacity);assert.equal(report.opacity,beforeResize.opacity);
    assert.deepEqual(await ownership(page),original,'Mid-pour resize preserves every purchased UID, pose and economic counter');
    await page.locator('#resume').click();assert.equal(await page.evaluate(()=>state.paused),false);await page.waitForTimeout(80);
    const resumed=await geometry(page);assert.ok(Math.abs(resumed.firstAngle-beforeResize.firstAngle)<.00001,'Pause/resume retains the interrupted pour pose');
    await page.screenshot({path:'audit_source/bag-pour-centre-resize-'+width+'x'+height+'-to-'+next.width+'x'+next.height+'.png'});
    await page.evaluate(()=>{BagPour.advance(1);BagPour.advance(.2);});
    assert.equal(await page.evaluate(()=>BagPour.active()),false);assert.equal(await page.locator('#bagPourScene').count(),0);
    assert.equal(await page.evaluate(()=>$('pile').inert),false);assert.equal(await page.locator('#pile [data-pouring]').count(),0);
    assert.deepEqual(await ownership(page),original,'Completing the reveal never rebuys, replaces, sorts or duplicates goods');
    assert.deepEqual(errors,[]);console.log('PASS '+width+'x'+height+': table-centred mouth + actual first-item launch, foreground art, paused mid-pour resize to '+next.width+', original eight UIDs and gold70 preserved');
    await page.close();
  }
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
