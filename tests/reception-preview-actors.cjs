'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createPreviewServer}=require('../tools/preview-reception-layers.cjs');
const ACTORS=['s3_0','s3_1','s3_2','s3_3','s3_5'];
const DEFAULT={x:650,y:950,scale:140};
const close=(actual,expected,label,tolerance=1)=>assert.ok(Math.abs(actual-expected)<=tolerance,label+': '+actual+' vs '+expected);
async function range(p,id,value){await p.locator('#'+id).evaluate((input,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));},String(value));}
async function coordinate(p,id,value){await p.locator('#'+id).fill(String(value));await p.locator('#'+id).press('Tab');}
async function pose(p){return p.evaluate(()=>({x:Number(document.getElementById('actorX').value),y:Number(document.getElementById('actorY').value),scale:Number(document.getElementById('actorScale').value)}));}
async function geometry(p){return p.locator('#actorHandle').evaluate(element=>{
  const r=element.getBoundingClientRect(),s=document.getElementById('mainScene').getBoundingClientRect(),image=document.getElementById('actorLayer').getBoundingClientRect();
  return {x:r.x,y:r.y,width:r.width,height:r.height,anchorX:(r.x+r.width/2-s.x)*1536/s.width,anchorY:(r.y+r.height-s.y)*1024/s.height,image:{x:image.x,y:image.y,width:image.width,height:image.height}};
});}
async function selectActor(p,key){
  await p.locator('#actorSelect').selectOption(key);
  await p.waitForFunction(key=>{const image=document.getElementById('actorLayer');return image.complete&&image.naturalWidth>0&&new URL(image.src).pathname.endsWith('/'+key+'.png');},key);
}
async function drag(p,dx,dy,label){
  await p.locator('#mainScene').scrollIntoViewIfNeeded();
  const before=await pose(p),actor=await p.locator('#actorHandle').boundingBox(),scene=await p.locator('#mainScene').boundingBox();
  const start={x:actor.x+actor.width*.5,y:actor.y+actor.height*.3},end={x:start.x+dx*scene.width/1536,y:start.y+dy*scene.height/1024};
  assert.equal(await p.evaluate(point=>{const handle=document.getElementById('actorHandle'),hit=document.elementFromPoint(point.x,point.y);return hit===handle||handle.contains(hit);},start),true,label+': visible portrait can receive a real pointer');
  await p.mouse.move(start.x,start.y);await p.mouse.down();
  assert.equal(await p.locator('#actorHandle').evaluate(element=>element.classList.contains('is-dragging')),true,label+': pointerdown starts drag');
  await p.mouse.move(end.x,end.y,{steps:6});await p.mouse.up();
  const after=await pose(p);close(after.x,before.x+dx,label+': source X displacement');close(after.y,before.y+dy,label+': source Y displacement');assert.equal(after.scale,before.scale,label+': drag preserves scale');
  assert.equal(await p.locator('#actorHandle').evaluate(element=>element.classList.contains('is-dragging')||element.hasPointerCapture(1)),false,label+': release clears drag and pointer capture');
  await p.mouse.move(end.x+43,end.y+27);assert.deepEqual(await pose(p),after,label+': pointer movement after release does not move the portrait');
  return after;
}
async function screenshot(p){
  await p.evaluate(()=>scrollTo(0,0));
  const main=await p.locator('main').boundingBox(),actions=await p.locator('.actions').boundingBox();
  const file=path.resolve(__dirname,'../audit_source/reception-layout-20261029-preview-actors.png');fs.mkdirSync(path.dirname(file),{recursive:true});
  const options={clip:{x:Math.floor(main.x),y:0,width:Math.ceil(main.width),height:Math.ceil(actions.y+actions.height+20)}};
  try{await p.screenshot({path:file,...options});return file;}
  catch(error){if(error.code!=='UNKNOWN'&&error.errno!==-4094)throw error;const alternate=file.replace(/\.png$/,'-rerun-'+Date.now()+'.png');await p.screenshot({path:alternate,...options});return alternate;}
}
(async()=>{
  const server=createPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port,errors=[],failed=[],requests=[];
  let browser;
  try{
    browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1500}}),p=await context.newPage();
    p.on('pageerror',error=>errors.push(error.message));p.on('request',request=>requests.push(request.url()));p.on('response',response=>{if(response.status()>=400)failed.push(response.status()+' '+response.url());});
    await p.goto(base+'/New%20Sprites/preview.html');await p.waitForFunction(()=>window.previewReady&&document.getElementById('actorLayer').complete);
    assert.deepEqual(await p.locator('#actorSelect option').evaluateAll(options=>options.map(option=>option.value)),ACTORS,'Exactly the five remaining adventurers are offered');
    assert.deepEqual(await p.locator('#actorScale').evaluate(input=>[input.min,input.max]),['25','250']);
    assert.deepEqual(await pose(p),DEFAULT,'Initial center-bottom anchor and scale');
    const initial=await geometry(p);close(initial.anchorX,650,'Initial horizontal anchor');close(initial.anchorY,950,'Initial bottom anchor');
    await range(p,'actorScale',100);const native=await geometry(p);
    await range(p,'actorScale',200);const double=await geometry(p);
    close(double.width,native.width*2,'200% doubles portrait width',.1);close(double.height,native.height*2,'200% doubles portrait height',.1);
    close(double.image.width,native.image.width*2,'200% doubles the actual image width',.1);close(double.image.height,native.image.height*2,'200% doubles the actual image height',.1);
    close(double.anchorX,native.anchorX,'Scaling keeps horizontal anchor',.1);close(double.anchorY,native.anchorY,'Scaling keeps bottom anchor',.1);
    await p.locator('#resetActor').click();assert.deepEqual(await pose(p),DEFAULT);
    const counter=await p.locator('#counterLayer').boundingBox();await coordinate(p,'actorX',900);await coordinate(p,'actorY',750);await range(p,'actorScale',140);
    const moved=await geometry(p);close(moved.anchorX,900,'Numeric X moves the anchor');close(moved.anchorY,750,'Numeric Y moves the anchor');
    assert.deepEqual(await p.locator('#counterLayer').boundingBox(),counter,'Actor coordinates and scale never move the counter');
    await range(p,'counterY',180);assert.deepEqual(await pose(p),{x:900,y:750,scale:140},'Counter movement never changes the actor pose');
    await coordinate(p,'actorX',650);const dragged=await drag(p,96,64,'Desktop-sized preview');
    await p.locator('#stage').selectOption('guild-furnished');await p.waitForFunction(()=>window.previewReady);await range(p,'blend',70);
    assert.deepEqual(await pose(p),dragged,'Changing stage and day/night preserves the edited pose');
    const layers=await p.evaluate(()=>{const z=id=>Number(getComputedStyle(document.getElementById(id)).zIndex);return {day:z('dayLayer'),night:z('nightLayer'),actor:z('actorHandle'),counter:z('counterLayer')};});
    assert.ok(layers.day<layers.night&&layers.night<layers.actor&&layers.actor<layers.counter,'Portrait stacking context stays between background and foreground');
    await p.locator('#showActor').uncheck();assert.equal(await p.locator('#actorLayer').isVisible(),false);assert.equal(await p.locator('#actorHandle').isVisible(),false);await p.locator('#showActor').check();
    await p.setViewportSize({width:960,height:1200});await coordinate(p,'actorX',650);await coordinate(p,'actorY',750);
    const narrow=await drag(p,80,-48,'Narrow preview');
    await p.locator('#actorHandle').focus();await p.keyboard.press('ArrowRight');await p.keyboard.press('Shift+ArrowUp');
    assert.deepEqual(await pose(p),{x:narrow.x+10,y:narrow.y-1,scale:narrow.scale},'Keyboard movement supports 10px arrows and 1px Shift arrows');
    const remembered=await pose(p);
    for(const key of ACTORS){await selectActor(p,key);assert.ok(await p.locator('#actorLayer').evaluate(image=>image.naturalWidth>0&&image.naturalHeight>0),key+': real existing PNG loads');}
    await selectActor(p,ACTORS[0]);assert.deepEqual(await pose(p),remembered,'Returning to an adventurer restores that portrait pose');
    await p.locator('#resetActor').click();assert.deepEqual(await pose(p),DEFAULT,'Reset restores the approved 650/950 anchor and 140% scale');
    await p.setViewportSize({width:1440,height:1500});await coordinate(p,'actorY',750);await range(p,'actorScale',140);await range(p,'counterY',180);await range(p,'blend',0);
    const file=await screenshot(p);console.log('Actor controls preview: '+file);
    assert.equal(await p.evaluate(()=>typeof state),'undefined','No game state is loaded');assert.equal(await p.evaluate(()=>localStorage.length),0,'The private preview writes no save or settings');
    assert.ok(requests.every(url=>new URL(url).origin===base&&!/\/(?:game|catalog|story|engine)\.js(?:[?#]|$)/.test(url)),'Only local assets and standalone preview are requested');
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);await context.close();
    console.log('PASS: all 5 remaining adventurers, approved 650/950/140 defaults, exact 2x scaling about a fixed bottom anchor, independent X/Y and counter, actual pointer drag at two scene sizes with release, preserved per-portrait/stage/light poses, reset/keyboard/toggles, correct layers and no game/save access.');
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
