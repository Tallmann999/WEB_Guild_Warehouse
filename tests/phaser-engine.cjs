'use strict';
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
async function scene(p,key){await p.waitForFunction(key=>LootkeeperEngine.stats?.scene===key,key);}
async function snapshot(p,path){
 try{await p.screenshot({path});}
 catch(error){
  if(error.code!=='UNKNOWN'&&error.errno!==-4094)throw error;
  const alternate=path.replace(/\.png$/,'-rerun-'+Date.now()+'.png');await p.screenshot({path:alternate});console.log('Screenshot saved separately because Windows could not open the previous PNG: '+alternate);
 }
}
async function fixture(p){return p.evaluate(()=>{
 cancelDrag();forceCloseModal();City.close();BagPour.clear();state=freshState();state.started=true;state.day=3;state.gold=900;state.tutorial={active:false};state.orderUid=0;state.orders=[];state.order=null;state.offers=[];state.collection=items.map(x=>x.id);state.unknownTray=[];
 state.story={version:1,letterRead:true,inheritedOpened:true,firstPaid:true,restored:true,shopRestorationStage:2,firstDayComplete:true,firstDayFlowVersion:2,firstDayPurchases:2,firstDayDeliveries:2,secondDayFlowVersion:2,secondDayActive:false,completedB2:true,elapsed:30,nextVisit:999,dwarfEncounterSeen:true,goblinEncounterSeen:true,regularContracts:{}};
 state.dwarf={hired:true,enabled:false,batches:[]};state.goblin={hired:true,enabled:false,deliveries:0};state.city={towerOwned:false,mapUnlocked:true};
 state.bag=[0,6,12,18,38,40,48,71].map(type=>{const x=makeItem(type);x.unknown=false;return x;});BagPour.layout(state.bag);state.stock=[];Story.ensure();render();
 LootkeeperEngine.bridge.step=()=>{};setScreen('work','sort');return state.bag.map(x=>x.uid);
});}
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:850},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);await p.waitForFunction(()=>window.LootkeeperEngine?.ready);await scene(p,'Menu');
 assert.match(await p.evaluate(()=>Phaser.VERSION),/^4\./);assert.equal(await p.locator('#phaser-world canvas').count(),1);assert.deepEqual(await p.evaluate(()=>LootkeeperEngine.failures),[]);assert.ok(await p.evaluate(()=>LootkeeperEngine.stats.textures>=120));
 assert.equal(/requestAnimationFrame/.test(fs.readFileSync('dist/game.js','utf8')),false,'The simulation never creates a competing frame loop');
 const ids=await fixture(p);await scene(p,'Workbench');await p.waitForFunction(()=>LootkeeperEngine.stats.sprites>=20);
 const native=await p.evaluate(()=>{const s=LootkeeperEngine.game.scene.getScenes(true)[0];return {sprites:[...s.views].filter(([key])=>key.startsWith('loot:')).length,images:[...s.views.values()].every(x=>x.sprite instanceof Phaser.GameObjects.Image),hidden:[...document.querySelectorAll('#pile .item img')].every(img=>getComputedStyle(img).opacity==='0')};});
 assert.equal(native.sprites,8);assert.equal(native.images,true);assert.equal(native.hidden,true,'World item images are native Phaser objects, not duplicate DOM art');
 const beforeInput=await p.evaluate(()=>LootkeeperEngine.bridge.inputEvents);await p.locator('#pile [data-uid="'+ids[0]+'"]').click();await p.locator('#shelves [data-cat="0"]').click();assert.equal(await p.evaluate(uid=>state.stock.some(x=>x.uid===uid),ids[0]),true);assert.equal(await p.evaluate(()=>LootkeeperEngine.bridge.inputEvents),beforeInput+1,'The accessible hit target routes pointer input through the native scene');
 await p.evaluate(()=>{state.bag=[];state.stock=Array.from({length:22},()=>{const x=makeItem(0);x.unknown=false;return x;});renderWork();openInspection(0);});await p.waitForFunction(()=>LootkeeperEngine.stats.masks>0);assert.equal(await p.locator('#pile .empty-pile').isVisible(),false,'The empty-table caption cannot show through a native filled inspection box');
 const masks=await p.evaluate(()=>{const s=LootkeeperEngine.game.scene.getScenes(true)[0];return [...s.clipGroups.values()].map(group=>({native:group.container instanceof Phaser.GameObjects.Container,filters:group.container.filters.external.getActive().length}));});assert.ok(masks.every(x=>x.native&&x.filters===1),'Phaser4 mask filters clip native scroller inventory');
 for(let cycle=0;cycle<3;cycle++){
  await p.evaluate(()=>{closeInspection();setScreen('reception');state.offers=[{arrivalSerial:1,visitor:0,loot:[],price:10}];renderReception();});await scene(p,'Reception');
  assert.equal(await p.evaluate(()=>LootkeeperEngine.game.scene.getScenes(true)[0].backgrounds.length>=2),true,'Reception background and foreground counter survive scene restarts');
  const counter=await p.evaluate(()=>{const s=LootkeeperEngine.game.scene.getScenes(true)[0];return {cut:LootkeeperEngine.bridge.current().counter.y,top:LootkeeperEngine.bridge.current().bounds.y,cropped:s.backgrounds.filter(x=>x.depth===25).every(x=>x.isCropped)};});assert.ok(counter.cut>counter.top+300);assert.equal(counter.cropped,true,'Visitor is behind a native cropped counter');
  await p.evaluate(()=>City.open('tower'));await scene(p,'City');assert.equal(await p.locator('#reception').evaluate(e=>getComputedStyle(e).visibility),'hidden');assert.equal(await p.evaluate(()=>LootkeeperEngine.game.scene.getScenes(true)[0].backgrounds.length),1);
  await p.evaluate(()=>{City.close();setScreen('work','sort');});await scene(p,'Workbench');
 }
 await p.setViewportSize({width:820,height:850});await p.waitForTimeout(100);await snapshot(p,'audit_source/phaser-workbench-820.png');
 await p.evaluate(()=>{setScreen('reception');renderReception();});await scene(p,'Reception');await p.waitForTimeout(700);await snapshot(p,'audit_source/phaser-reception-820.png');
 const paused=await p.evaluate(()=>{state.paused=true;return state.story.elapsed;});await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>state.story.elapsed),paused);
 assert.deepEqual(errors,[]);console.log('PASS: local Phaser4 boot and native asset manifest, Menu/Reception/Workbench/City, real item input and uid, scroll masks, foreground counter crop, three scene restart cycles,820 geometry and one engine frame loop.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
