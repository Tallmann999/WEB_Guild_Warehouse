'use strict';
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
const CASES=[[1920,920],[1366,768],[1280,720],[1024,768]];
const settle=p=>p.waitForTimeout(90);
async function click(p,selector){
 const point=await p.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);if(r.x<0||r.y<0||r.right>innerWidth+1||r.bottom>innerHeight+1||!(hit===e||e.contains(hit)))throw Error('Unreachable '+e.id);return {x,y};});
 await p.mouse.click(point.x,point.y);
}
async function fixture(p){
 return p.evaluate(()=>{
  cancelDrag();forceCloseModal();BagPour.clear();City.close();
  state=freshState();state.started=true;state.day=5;state.gold=777;state.tutorial={active:false};state.orderUid=0;state.orders=[];state.unknownTray=[];state.collection=items.map(x=>x.id);
  state.story={version:1,letterRead:true,inheritedOpened:true,firstPaid:true,restored:true,shopRestorationStage:2,firstDayComplete:true,firstDayFlowVersion:2,firstDayPurchases:2,firstDayDeliveries:2,secondDayFlowVersion:2,secondDayActive:false,completedB2:true,completedB3:true,elapsed:30,nextVisit:999,dwarfEncounterSeen:true,goblinEncounterSeen:true,regularContracts:{},guild:{founded:true,name:'Проверка коробки',phase:'complete'}};
  state.dwarf={hired:true,enabled:false,batches:[]};state.goblin={hired:true,enabled:false,deliveries:1};state.city={towerOwned:true,mapUnlocked:true,accessVersion:2};
  Story.ensure();Dwarf.ensure();Goblin.ensure();Contracts.ensure();LootkeeperEngine.bridge.step=()=>{};
  const partial=makeItem(0);partial.unknown=false;partial.boxPos={x:.5,y:8};
  state.stock=[0,0,6].map((type,i)=>{const x=makeItem(type);x.unknown=false;x.boxPos={x:.1+i*.25,y:8};return x;});
  state.order={id:++state.orderUid,accepted:true,customer:0,reward:90,title:'Проверка широкой коробки',recipe:[{type:0,count:3}],packed:[partial],reservedUids:[],assignedTo:'manual'};state.orders=[state.order];
  Goblin.reconcile();setScreen('work','order');state.activeCat=0;renderWork();
  return {packed:partial.uid,first:state.stock[0].uid,second:state.stock[1].uid,uids:owned().map(x=>x.uid).sort((a,b)=>a-b),gold:state.gold};
 });
}
async function parcelGeometry(p,label){
 const report=await p.evaluate(()=>{const g=$('game').getBoundingClientRect(),t=$('table').getBoundingClientRect(),d=$('parcelDrop').getBoundingClientRect(),s=$('sourceBox').getBoundingClientRect(),scale=g.width/$('game').offsetWidth;return {left:(d.left-g.left)/scale,width:d.width/scale,right:d.right<=s.left+1,top:d.top>=t.top-1,bottom:d.bottom<=t.bottom+1,tableRatio:$('table').offsetWidth/($('game').clientWidth-56),center:(t.left+t.width/2-g.left-g.width/2)/scale,scrollX,scrollY};});
 assert.ok(Math.abs(report.left-24)<=1,label+': parcel reaches the left game edge '+JSON.stringify(report));
 assert.ok(report.width>=380&&report.right&&report.top&&report.bottom,label+': wider real parcel remains separate from source '+JSON.stringify(report));
 assert.ok(report.tableRatio>.69&&report.tableRatio<.71&&Math.abs(report.center)<=1,label+': centred 70% table preserved');
 assert.equal(report.scrollX,0);assert.equal(report.scrollY,0);
}
async function shortDialog(p,selectors,label){
 assert.equal(await p.locator('#modal').isVisible(),true,label+': real modal is open');
 const report=await p.evaluate(selectors=>{
  const content=$('modalContent'),c=content.getBoundingClientRect(),card=content.parentElement.getBoundingClientRect();
  const nodes=[...content.querySelectorAll(selectors)];
  return {overflow:getComputedStyle(content).overflowY,cardFits:card.left>=0&&card.top>=0&&card.right<=innerWidth+1&&card.bottom<=innerHeight+1,nodes:nodes.map(e=>{const r=e.getBoundingClientRect();return {id:e.id||e.className||e.tagName,inside:r.top>=c.top-1&&r.bottom<=c.bottom+1&&r.left>=c.left-1&&r.right<=c.right+1}}),scrollX,scrollY};
 },selectors);
 assert.equal(report.overflow,'clip',label+': short dialog has no decorative scrollbar');assert.equal(report.cardFits,true,label+': modal is inside viewport');assert.ok(report.nodes.length>0&&report.nodes.every(x=>x.inside),label+': actual text and controls fit '+JSON.stringify(report));assert.equal(report.scrollX,0);assert.equal(report.scrollY,0);
}
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),errors=[];
 try{
  for(const [width,height]of CASES){
   const p=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);await p.waitForFunction(()=>window.LootkeeperEngine?.ready);const label=width+'x'+height;
   const keep=await fixture(p);await settle(p);await parcelGeometry(p,label);
   await click(p,'#sourceItems [data-uid="'+keep.first+'"]');assert.equal(await p.evaluate(()=>drag?.uid),keep.first);
   await p.evaluate(()=>{window.__heldParcelLayoutNode=drag.node;});
   await p.setViewportSize({width:1280,height:720});await settle(p);await parcelGeometry(p,label+' resized');
   assert.deepEqual(await p.evaluate(()=>({uid:drag?.uid,same:drag?.node===window.__heldParcelLayoutNode,connected:!!drag?.node.isConnected,packed:state.order.packed.map(x=>x.uid)})),{uid:keep.first,same:true,connected:true,packed:[keep.packed]});
   await p.setViewportSize({width,height});await settle(p);await parcelGeometry(p,label+' restored');
   const drop=await p.locator('#parcelDrop').boundingBox();await p.mouse.click(drop.x+drop.width*.12,drop.y+drop.height*.8);
   assert.deepEqual(await p.evaluate(()=>state.order.packed.map(x=>x.uid)),[keep.packed,keep.first],label+': real click in the added left area packs the original held UID');
   assert.deepEqual(await p.evaluate(()=>({uids:owned().map(x=>x.uid).sort((a,b)=>a-b),gold:state.gold})),{uids:keep.uids,gold:keep.gold});
   await p.screenshot({path:'audit_source/parcel-modal-wide-'+label+'.png'});
   // The short repair offer contains no long ledger; external button rays
   // used to add a false 25px scrollbar even though all text already fitted.
   await p.evaluate(()=>{cancelDrag();forceCloseModal();state.day=1;state.story.restored=false;state.story.shopRestorationStage=0;delete state.story.restoration;Restoration.prompt();});await settle(p);
   await shortDialog(p,'#restorationOffer > *,#restorationOffer .restoration-preview > span,#restorationOffer .restoration-day-results > span',label+' repair');
   await click(p,'#restoreLater');
   // Use the actual carrier from a saved dwarf job behind recognition.
   await p.evaluate(()=>{state.day=3;state.story.restored=true;state.story.shopRestorationStage=2;state.order=null;state.orders=[];state.bag=[0,6].map(type=>{const x=makeItem(type);x.unknown=false;x.tablePos={x:.5,y:.5};return x;});state.dwarf.enabled=true;Dwarf.onBagPurchased(state.bag);setScreen('work','sort');Dwarf.advance(1.1);Dwarf.updateVisual();state.collection=state.collection.filter(type=>type!==38);const subject=makeItem(38);subject.unknown=true;state.stock.push(subject);openCleaning(38,subject);});await settle(p);
   await shortDialog(p,':scope > *,.recognition-actions > button',label+' recognition');
   const layer=await p.evaluate(()=>{const modal=$('modal'),carrier=$('dwarfCarrier'),r=carrier.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {carrierVisible:!carrier.classList.contains('hidden'),modalZ:Number(getComputedStyle(modal).zIndex),carrierZ:Number(getComputedStyle(carrier).zIndex),covered:modal.contains(hit)||hit===modal,hit:hit?.id||hit?.className};});
   assert.ok(layer.carrierVisible&&layer.modalZ>layer.carrierZ&&layer.covered,label+': recognition paints above the actual foreground worker '+JSON.stringify(layer));
   await click(p,'#cleanKey');assert.match(await p.locator('#cleanStatus').textContent(),/Очищено/);
   await p.screenshot({path:'audit_source/parcel-modal-recognition-'+label+'.png'});
   await p.close();
  }
  assert.deepEqual(errors,[]);console.log('PASS: left-edge parcel accepts original held UIDs at four viewport sizes, keeps partial packing and the same held node on resize; short repair/recognition dialogs fit without decorative scrollbars, recognition covers the real carrier.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
