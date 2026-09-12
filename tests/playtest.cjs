const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const url='file:///'+path.resolve(__dirname,'../dist/index.html').replaceAll('\\','/');
const shots=path.resolve(__dirname,'../audit_source');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:800}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.locator('#startGame').click();await page.locator('#buyBag').click();await page.evaluate(()=>{state.seconds=CONFIG.daySeconds-INTRO_TIMING[state.day].orders[0];tickArrivals();});
 assert.equal(await page.evaluate(()=>state.gold),70);
 // Wrong classification retains the item and does not charge the player.
 await page.evaluate(()=>{state.selected=state.bag[0].uid;selectBox((items[state.bag[0].type].cat+1)%4)});
 assert.equal(await page.evaluate(()=>state.dayErrors),1);assert.equal(await page.evaluate(()=>state.gold),70);
 // Actual pointer drag to shelf (choose an exposed item at its centre).
 const item=await page.evaluate(()=>[...document.querySelectorAll('#pile .item')].reverse().find(n=>{const r=n.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.item')===n})?.dataset.uid);
 assert.ok(item);const typeCat=await page.evaluate(id=>items[state.bag.find(x=>x.uid===Number(id)).type].cat,item);
 const a=await page.locator(`#pile [data-uid="${item}"]`).boundingBox(),z=await page.locator(`[data-cat="${typeCat}"]`).boundingBox();
 await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(z.x+z.width/2,z.y+z.height/2,{steps:15});await page.mouse.up();
 assert.ok(await page.evaluate(id=>state.stock.some(x=>x.uid===Number(id)),item));
 // Purchase the single upgrade and sweep, then transfer between boxes.
 await page.getByRole('button',{name:'Улучшение',exact:true}).click();await page.locator('#buyUpgrade').click();assert.equal(await page.evaluate(()=>state.gold),50);
 const balance=await page.evaluate(()=>owned().length);await page.locator('#sweepButton').click();assert.equal(await page.evaluate(()=>state.bag.length),0);assert.equal(await page.evaluate(()=>owned().length),balance);
 await page.locator('#junkShelf').click();
 await page.evaluate(()=>{const x=state.junk[0];state.selected=x.uid;state.targetCat=items[x.type].cat;renderInspection();renderTarget()});
 await page.locator('#moveSelected').click();assert.equal(await page.evaluate(()=>owned().length),balance);
 await page.screenshot({path:path.join(shots,'playtest-junk.png')});await page.locator('#closeInspector').click();
 // Collection cleaning by keyboard alternative, inventory must not change.
 await page.getByRole('button',{name:'Коллекция',exact:true}).click();await page.locator('.collection-item:not(:disabled)').first().click();
 for(let i=0;i<48&&!await page.locator('#cleanKey').isDisabled();i++)await page.locator('#cleanKey').click();
 assert.ok(await page.evaluate(()=>state.collection.length===1));assert.equal(await page.evaluate(()=>owned().length),balance);
 await page.screenshot({path:path.join(shots,'playtest-clean.png')});await page.locator('#closeModal').click();
 // Modal focus must stay within the dialog.
 await page.locator('#help').click();for(let i=0;i<20;i++){await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>$('modal').contains(document.activeElement)));}await page.keyboard.press('Escape');
 // A promised ingredient is present somewhere in stock, current or future supplies.
 assert.ok(await page.evaluate(()=>state.order.recipe.every(r=>countType(r.type)+[...state.offers,...state.schedule].reduce((n,s)=>n+s.loot.filter(x=>x.type===r.type).length,0)>=r.count)));
 for(const viewport of [{width:1024,height:768},{width:844,height:390}]){await page.setViewportSize(viewport);await page.waitForFunction(()=>Math.abs(scale-Math.min(innerWidth/1280,innerHeight/800))<.0001);const r=await page.locator('#game').boundingBox();assert.ok(r.x>=-1&&r.y>=-1&&r.x+r.width<=viewport.width+1&&r.y+r.height<=viewport.height+1);await page.screenshot({path:path.join(shots,`playtest-${viewport.width}.png`)});}
 await page.setViewportSize({width:1280,height:800});
 // Reload restores currency, stock, junk, order and collection.
 const saved=await page.evaluate(()=>{save();return {gold:state.gold,n:owned().length,collection:state.collection.length}});await page.reload();await page.reload();await page.locator('#loadGame').click();
 assert.deepEqual(await page.evaluate(()=>({gold:state.gold,n:owned().length,collection:state.collection.length})),saved);
 assert.deepEqual(errors,[]);console.log('PASS: purchase, pointer sorting, wrong category, upgrade, sweep, transfer, collection, focus, guaranteed stock, viewports, save/resume');
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
