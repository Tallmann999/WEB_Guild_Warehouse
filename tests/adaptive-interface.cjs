'use strict';
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
async function fixture(p){await p.evaluate(()=>{
 forceCloseModal();City.close();BagPour.clear();state=freshState();state.started=true;state.day=3;state.gold=900;state.orders=[];state.order=null;state.orderUid=0;state.offers=[];state.bag=[];state.stock=[];state.collection=items.map(x=>x.id);state.unknownTray=[];state.tutorial={active:false};
 state.story={letterRead:true,inheritedOpened:true,firstPaid:true,restored:true,shopRestorationStage:2,firstDayFlowVersion:2,firstDayPurchases:2,firstDayDeliveries:2,firstDayComplete:true,secondDayFlowVersion:2,secondDayActive:false,completedB2:true,completedB3:true,goblinEncounterSeen:true,dwarfEncounterSeen:true,elapsed:30,nextVisit:999,guild:{founded:true,name:'Гильдия мастеров',phase:'complete'},regularContracts:{}};
 state.dwarf={hired:true,enabled:false,batches:[]};state.goblin={hired:true,enabled:false,deliveries:1,receipts:[]};
 const o={id:++state.orderUid,accepted:true,assignedTo:'manual',title:'Большая посылка для оружейной',customer:1,reward:360,recipe:[{type:18,count:5},{type:19,count:5},{type:24,count:5}],packed:[],reservedUids:[]};state.orders=[o];state.order=o;
 state.stock=o.recipe.flatMap(r=>Array.from({length:r.count},()=>{const x=makeItem(r.type);x.unknown=false;return x;}));
 Story.ensure();Goblin.ensure();Goblin.reconcile();LootkeeperEngine.bridge.step=()=>{};setScreen('reception');save();
 });await p.waitForTimeout(180);}
async function noHorizontal(p){assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'The whole page fits the physical device width');}
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 for(const [width,height]of [[320,568],[390,844],[844,390],[820,850],[1280,800],[1920,1080]]){
  const p=await b.newPage({viewport:{width,height},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);await p.waitForFunction(()=>window.LootkeeperEngine?.ready);await fixture(p);
  assert.equal(await p.evaluate(()=>$('game').clientWidth),width-2);await noHorizontal(p);
  const card=p.locator('#orderBoard .order-card');assert.equal(await card.locator('.parcel-recipe li').count(),3);assert.match(await card.textContent(),/Кому:/);assert.match(await card.textContent(),/360 монет/);assert.equal(await card.locator('.parcel-recipe li b').first().textContent(),'0/5');
  assert.equal(await card.evaluate(e=>e.scrollHeight<=e.clientHeight+1),true,'The entire order letter expands without an internal scroll');
  assert.equal(await p.locator('footer #ordersNav').count(),0);assert.equal(await p.locator('#taskRail #ordersNav').count(),1);
  await p.waitForFunction(()=>Math.abs($('taskRail').offsetTop-document.querySelector('#game>header').offsetHeight)<2,undefined,{timeout:5000}).catch(async error=>{console.log(await p.evaluate(()=>({top:$('taskRail').offsetTop,header:document.querySelector('#game>header').offsetHeight,vars:$('game').style.cssText})));throw error;});
  await card.locator('[data-parcel-action="manual"]').click();assert.equal(await p.evaluate(()=>state.screen+'/'+state.mode),'work/order');await p.waitForTimeout(180);await noHorizontal(p);
  const info=p.locator('#checklist');assert.match(await info.textContent(),/Кому:/);assert.match(await info.textContent(),/Оплата: 360 монет/);assert.equal(await info.locator('.check-row').count(),3);assert.equal(await info.evaluate(e=>getComputedStyle(e).overflowX==='visible'&&e.scrollHeight<=e.clientHeight+1),true,'Packing information is one complete expanding sheet');
  if(!await p.locator('#shelves [data-cat="3"]').isVisible()){console.log(await p.evaluate(()=>['game','work','shelves'].map(id=>{const e=$(id),r=e.getBoundingClientRect(),c=getComputedStyle(e);return {id,cls:e.className,w:r.width,h:r.height,display:c.display,visibility:c.visibility,top:r.top,screen:state.screen};})));await p.screenshot({path:'audit_source/adaptive-debug-'+width+'.png',fullPage:true});}
  await p.locator('#shelves [data-cat="3"]').click();await p.locator('#tidySource').click();const uid=await p.evaluate(()=>state.stock.find(x=>x.type===18).uid);await p.locator('#sourceItems [data-uid="'+uid+'"]').click();await p.locator('#parcelDrop').click();assert.equal(await p.evaluate(()=>state.order.packed.length),1,'A real source uid can be packed on this device');
  await info.scrollIntoViewIfNeeded();await p.screenshot({path:'audit_source/adaptive-parcel-'+width+'-'+process.pid+'.png'});assert.deepEqual(errors,[]);await p.close();console.log('PASS adaptive '+width+'x'+height+': full recipe/client/price, no sheet/page horizontal scrolling, top task row, actual manual packing.');
 }
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
