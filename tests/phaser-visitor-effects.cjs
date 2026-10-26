'use strict';
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
const errors=[];
async function start(page){
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(BASE);await page.waitForFunction(()=>window.LootkeeperEngine?.ready,null,{timeout:60000});
  await page.locator('#startGame').click();await page.locator('#acceptInheritance').click();
  await page.evaluate(()=>{LootkeeperEngine.bridge.step=()=>{};});await page.mouse.move(5,5);
}
async function geometry(page,label){
  const result=await page.evaluate(()=>{
    const scene=LootkeeperEngine.game.scene.getScene('Reception'),snapshot=LootkeeperEngine.bridge.snapshot;
    const visitor=[...scene.views].find(([id])=>id.startsWith('visitor:'))[1].sprite;
    const top=visitor.y-visitor.displayHeight/2,bottom=visitor.y+visitor.displayHeight/2;
    const fit=Math.max(snapshot.bounds.width/1536,snapshot.bounds.height/1024),edge=snapshot.bounds.y+(snapshot.bounds.height-1024*fit)/2+635*fit;
    return {edge,counter:snapshot.counter.y,lip:!!scene.counterLip&&scene.counterLip.depth>visitor.depth,alpha:visitor.alpha,cropped:visitor.isCropped,top,bottom,headClear:top>=snapshot.bounds.y+10,leftClear:visitor.x-visitor.displayWidth/2>=snapshot.bounds.x+10,rightClear:visitor.x+visitor.displayWidth/2<=snapshot.bounds.x+snapshot.bounds.width-10,torso:(snapshot.counter.y-top)/visitor.displayHeight,behind:scene.backgrounds.some(image=>image.depth>visitor.depth&&image.isCropped),overlap:bottom-snapshot.counter.y};
  });
  assert.equal(result.alpha,1,label+': fully visible after entry');
  assert.ok(Math.abs(result.edge-result.counter)<.01,label+': occlusion follows the source-image tabletop edge after cover '+JSON.stringify(result));
  assert.equal(result.lip,true,label+': the rear tabletop shadow has its own layer above the visitor');
  assert.equal(result.cropped,false,label+': the visitor image has no artificial crop');
  assert.ok(result.headClear&&result.leftClear&&result.rightClear,label+': complete head and shoulders fit the room '+JSON.stringify(result));
  assert.ok(result.behind&&result.overlap>20&&result.torso>=.59&&result.torso<=.61,label+': physical counter conceals the lower body while the torso remains visible '+JSON.stringify(result));
}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
  for(const [width,height]of [[1920,920],[1280,720],[1024,768]]){
    const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});await start(page);await page.waitForTimeout(800);
    assert.equal(await page.evaluate(()=>{const views=[...LootkeeperEngine.game.scene.getScene('Reception').views];return views.some(([id,v])=>id.startsWith('visitor:')&&v.sprite.alpha>.5)&&views.some(([id,v])=>id.startsWith('counter-bag:')&&v.sprite.alpha>.5);}),true,'Real first visitor and sack are visible800ms after accepting inheritance');
    await geometry(page,width+' first visitor');await page.screenshot({path:'audit_source/visitor-counter-repair-'+width+'.png'});
    const originals=await page.evaluate(()=>({gold:state.gold,uids:owned().map(x=>x.uid)}));
    const portraits=await page.evaluate(()=>[...new Set([...adventurers,...customers].map(visitor=>asset(visitor[2])))]);
    for(const src of portraits){
      await page.locator('#visitor').evaluate((node,src)=>{node.src=src;return node.decode();},src);
      await page.waitForFunction(src=>{const d=LootkeeperEngine.bridge.snapshot.sprites.find(d=>d.id.startsWith('visitor:')&&d.id.endsWith(src)),v=d&&LootkeeperEngine.game.scene.getScene('Reception').views.get(d.id)?.sprite;return d?.source&&v&&Math.abs(v.y-d.y)<.01&&Math.abs((LootkeeperEngine.bridge.snapshot.counter.y-(v.y-v.displayHeight/2))/v.displayHeight-.6)<.01;},src);
      await geometry(page,width+' '+src);
      if(src==='assets/s3_6.png'||src==='assets/s4_5.png'){await page.waitForTimeout(450);await page.screenshot({path:'audit_source/visitor-counter-repair-'+width+'-'+src.split('/').at(-1)});}
    }
    assert.deepEqual(await page.evaluate(()=>({gold:state.gold,uids:owned().map(x=>x.uid)})),originals,'Visitor art never alters money or goods');await page.close();
  }
  const page=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'no-preference'});await start(page);
  await page.waitForFunction(()=>[...LootkeeperEngine.game.scene.getScene('Reception').views].some(([id,v])=>id.startsWith('visitor:')&&v.entering));
  await page.evaluate(()=>{state.paused=true;});await page.waitForTimeout(100);
  const paused=await page.evaluate(()=>{const scene=LootkeeperEngine.game.scene.getScene('Reception'),visitor=[...scene.views].find(([id])=>id.startsWith('visitor:'))[1];return {alpha:visitor.sprite.alpha,time:scene.visualTime};});
  await page.waitForTimeout(250);
  assert.deepEqual(await page.evaluate(()=>{const scene=LootkeeperEngine.game.scene.getScene('Reception'),visitor=[...scene.views].find(([id])=>id.startsWith('visitor:'))[1];return {alpha:visitor.sprite.alpha,time:scene.visualTime};}),paused,'Normal entry fade stops throughout a gameplay pause');
  await page.evaluate(()=>{state.paused=false;});await page.waitForTimeout(800);await geometry(page,'Normal motion resumed');await page.close();
  assert.deepEqual(errors,[]);console.log('PASS: all11 supplier/customer portraits keep complete heads/shoulders and conceal40% behind the real cover-fitted tabletop edge at1920/1280/1024; a rear lip/shadow defines the derelict counter, real first entry is visible after800ms, and normal motion pauses/resumes without changing goods or money.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
