'use strict';
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
async function reachable(p,selector){
 const result=await p.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {inside:r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,hit:e===hit||e.contains(hit)};});
 assert.deepEqual(result,{inside:true,hit:true},selector+' receives real input');
}
async function fixture(p){return p.evaluate(()=>{
 cancelDrag();forceCloseModal();City.close();BagPour.clear();state=freshState();state.orderUid=0;state.started=true;state.screen='work';state.mode='sort';state.day=3;state.gold=900;state.tutorial={active:false};state.orders=[];state.order=null;state.offers=[];state.bag=[];state.unknownTray=[];state.stock=[];
 state.story={version:1,letterRead:true,inheritedOpened:true,firstPaid:true,restored:true,firstDayFlowVersion:2,firstDayComplete:true,firstDayPurchases:2,firstDayDeliveries:2,secondDayFlowVersion:2,secondDayActive:false,dwarfEncounterSeen:true,goblinEncounterSeen:true,completedB2:true,completedB3:true,elapsed:20,nextVisit:999,regularContracts:{}};
 state.dwarf={hired:true,enabled:false,batches:[],completedBatches:1};state.goblin={hired:true,enabled:false,deliveries:1,receipts:[]};Story.ensure();Dwarf.ensure();Goblin.ensure();render();Guild.advance();save();
});}
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});const errors=[];try{
 for(const width of [1280,820]){
  const p=await b.newPage({viewport:{width,height:850},reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);await fixture(p);await p.waitForSelector('#guildFounding');
  assert.equal(await p.evaluate(()=>state.screen),'reception');assert.equal(await p.evaluate(()=>state.paused),true);assert.match(await p.locator('#guildFounding h2').textContent(),/Поздравляем/);assert.equal(await p.locator('#guildNav').isVisible(),false);
  const before=await p.evaluate(()=>({elapsed:state.story.elapsed,gold:state.gold}));await p.evaluate(()=>Story.advance(5));assert.deepEqual(await p.evaluate(()=>({elapsed:state.story.elapsed,gold:state.gold})),before,'The naming celebration stops game time and spending');
  await p.locator('#guildNameInput').fill('Три ключа');await p.reload();await p.locator('#loadGame').click();await p.waitForSelector('#guildNameInput');assert.equal(await p.locator('#guildNameInput').inputValue(),'Три ключа');
  await p.locator('#guildCreate').click();await p.locator('#guildCharterNext').click();await p.locator('#guildCityNext').click();
  assert.equal(await p.locator('#guildCityGuide .guild-city-caption').isVisible(),false,'The redundant left tower panel is removed');assert.equal(await p.locator('#guildTowerArrow').isVisible(),true);assert.equal(await p.locator('#cityBuyTower').isDisabled(),true);
  await reachable(p,'#cityNav');await reachable(p,'#cityTower');await reachable(p,'#cityEnterShop');
  const geometry=await p.evaluate(()=>{const card=$('cityTowerDetails').getBoundingClientRect(),land=document.querySelector('.city-landscape').getBoundingClientRect(),tower=$('cityTower').getBoundingClientRect(),wallet=$('goldWallet').getBoundingClientRect(),nav=$('cityNav').getBoundingClientRect();return {top:card.top-land.top,upper:card.bottom<land.top+land.height*.65,besideTower:card.right<tower.left,besideWallet:nav.left>=wallet.right,header:$('cityNav').parentElement.tagName,footer:!!document.querySelector('footer #cityNav')};});
  assert.ok(geometry.top>=0&&geometry.top<25);assert.equal(geometry.upper,true);assert.equal(geometry.besideTower,true);assert.equal(geometry.besideWallet,true);assert.equal(geometry.header,'HEADER');assert.equal(geometry.footer,false);
  await p.screenshot({path:'audit_source/city-tower-revision-'+width+'.png'});
  await p.evaluate(()=>{state.gold=1200;City.update();});await reachable(p,'#cityBuyTower');await p.locator('#cityBuyTower').click();assert.equal(await p.evaluate(()=>state.gold),200);assert.equal(await p.evaluate(()=>City.buyTower()),false);assert.equal(await p.evaluate(()=>state.story.guild.phase),'complete');
  await p.locator('#cityNav').click();assert.equal(await p.evaluate(()=>City.isOpen()),false);assert.equal(await p.evaluate(()=>state.story.automation.enabled),true);await p.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS: automatic paused guild celebration on reception, saved naming draft, header City control beside wallet, upper tower sale card without redundant panel at1280/820 and one purchase.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
