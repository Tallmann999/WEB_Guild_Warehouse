const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs');
const path=require('path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const results=[];const record=(name,data)=>{results.push({name,...data});console.log(name,JSON.stringify(data));};
 await page.goto('file:///'+path.resolve(__dirname,'Guild_Warehouse_v5/dist/index.html').replaceAll('\\','/'));
 await page.screenshot({path:path.join(__dirname,'reception.png')});
 await page.getByRole('button',{name:'Начать смену',exact:true}).click();
 await page.locator('#bag').click();await page.getByRole('button',{name:'Сортировать мешок',exact:true}).click();
 await page.screenshot({path:path.join(__dirname,'sorting.png')});
 record('initial',await page.evaluate(()=>({count:state.bag.length,items:items.length,categories:categories.length})));
 let first=await page.evaluate(()=>({uid:state.bag[0].uid,cat:items[state.bag[0].type].cat}));
 await page.locator(`[data-uid="${first.uid}"]`).click();await page.locator(`[data-cat="${(first.cat+1)%4}"]`).click();
 record('wrong category',await page.evaluate(()=>({bag:state.bag.length,stock:state.stock.length,errors:state.errors})));
 await page.locator(`[data-cat="${first.cat}"]`).click();
 while(await page.evaluate(()=>!!state.bag?.length)){
  const x=await page.evaluate(()=>({uid:state.bag[0].uid,cat:items[state.bag[0].type].cat}));
  await page.locator(`#pile [data-uid="${x.uid}"]`).click();await page.locator(`[data-cat="${x.cat}"]`).click();
 }
 record('manual bag',await page.evaluate(()=>({screen:state.screen,gold:state.gold,stock:state.stock.length,order:state.order.recipe})));
 await page.locator('#returnToCounter').click();await page.locator('#acceptOrder').waitFor();await page.screenshot({path:path.join(__dirname,'order.png')});await page.locator('#acceptOrder').click();
 while(!await page.evaluate(()=>orderComplete())){
  const x=await page.evaluate(()=>{let r=state.order.recipe.find(r=>state.order.packed.filter(x=>x.type===r.type).length<r.count);return {cat:items[r.type].cat,uid:state.stock.find(x=>x.type===r.type).uid,active:state.activeCat}});
  if(x.active!==x.cat){if(x.active!==null)await page.locator('#closeSource').click();await page.locator(`[data-cat="${x.cat}"]`).click();}
  await page.locator(`#sourceItems [data-uid="${x.uid}"]`).click();
 }
 record('assembly',await page.evaluate(()=>({packed:state.order.packed.length,stock:state.stock.length,shipVisible:!!document.getElementById('ship')})));
 await page.screenshot({path:path.join(__dirname,'assembly.png')});await page.locator('#closeSource').click();await page.locator('#ship').click();
 record('dispatch',await page.evaluate(()=>({gold:state.gold,orders:state.dayOrders})));
 await page.getByRole('button',{name:'Подождать у окна',exact:true}).click();await page.locator('#bag').click();await page.getByRole('button',{name:'Сортировать мешок',exact:true}).click();
 await page.locator('#autoSortButton').click();record('ad locked', {disabled:await page.locator('#confirmAutoSort').isDisabled()});await page.locator('#closeModal').click();
 record('cancel ad',await page.evaluate(()=>({bag:state.bag.length,autoSorting:state.autoSorting,paused:state.paused})));
 await page.locator('#autoSortButton').click();await page.locator('#confirmAutoSort').click();await page.waitForFunction(()=>!state.autoSorting);
 record('auto bag',await page.evaluate(()=>({bag:state.bag,gold:state.gold,screen:state.screen,dayBags:state.dayBags})));
 // Controlled boundary setup; normal UI remains responsible for the transitions.
 await page.evaluate(()=>{state.seconds=0;tickArrival()});
 await page.locator('#returnToCounter').click();await page.locator('#acceptOrder').click();
 await page.evaluate(()=>{for(const r of state.order.recipe){state.activeCat=items[r.type].cat;for(let i=0;i<r.count;i++)putItem(state.stock.find(x=>x.type===r.type).uid)}returnBox()});
 await page.locator('#ship').click();record('day end',await page.evaluate(()=>({ended:state.ended,closing:state.closing,gold:state.gold,stock:state.stock.length})));
 await page.locator('#nextDay').click();record('next day',await page.evaluate(()=>({day:state.day,gold:state.gold,stock:state.stock.length,bag:state.bag.length})));
 await page.locator('#bag').click();await page.getByRole('button',{name:'Сортировать мешок',exact:true}).click();
 // Put an item at depth 1001 using actual drag, then inspect stacking after hover.
 const item=page.locator('#pile .item').first();const box=await item.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(650,530,{steps:12});await page.mouse.up();
 record('drag depth',await page.evaluate(()=>{const x=state.bag.find(x=>x.depth);return {uid:x?.uid,depth:x?.depth,pos:x?.tablePos}}));
 await page.mouse.move(650,530);record('hover depth',await page.evaluate(()=>{const x=state.bag.find(x=>x.depth);const e=document.querySelector(`#pile [data-uid="${x?.uid}"]`);return {inline:e?.style.zIndex,computed:e&&getComputedStyle(e).zIndex}}));
 // Help dialog geometry and keyboard escape/focus.
 await page.locator('#help').click();record('help bounds',await page.locator('.modal-card').boundingBox());await page.keyboard.press('Escape');
 for(const [width,height] of [[1024,768],[800,600],[390,844]]){await page.setViewportSize({width,height});record('viewport '+width,await page.locator('#game').boundingBox());await page.screenshot({path:path.join(__dirname,`viewport-${width}.png`)});}
 record('page errors',{errors});fs.writeFileSync(path.join(__dirname,'browser-results.json'),JSON.stringify(results,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
