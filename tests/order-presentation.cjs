const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');const path=require('node:path');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file:///'+path.resolve(__dirname,'../dist/index.html').replaceAll('\\','/'));
 await page.locator('#startGame').click();await page.locator('#buyBag').waitFor();await page.locator('#buyBag').click();
 await page.evaluate(()=>{
  state.rep=8;state.bag=[];state.stock=[makeItem(0),makeItem(0),makeItem(6)];
  state.order={recipe:[{type:0,count:2},{type:6,count:1}],packed:[],customer:0,reward:20,originalReward:20,createdDay:1,carried:false};
  setScreen('work','order');for(const x of [...state.stock])packItem(x.uid);
 });
 assert.equal(await page.locator('#packedItems img').count(),3);
 assert.match(await page.locator('#parcelDrop').evaluate(n=>getComputedStyle(n).backgroundImage),/box-top/);
 const box=await page.locator('#parcelDrop').boundingBox();
 for(const img of await page.locator('#packedItems img').all()){const r=await img.boundingBox();assert.ok(r.x>box.x&&r.x+r.width<box.x+box.width&&r.y>box.y&&r.y+r.height<box.y+box.height-20);}
 await page.screenshot({path:path.resolve(__dirname,'../audit_source/open-order-box.png'),animations:'disabled'});
 const gold=await page.evaluate(()=>state.gold);await page.evaluate(()=>{state.activeCat=null;finishOrder();});
 assert.equal(await page.evaluate(()=>state.gold),gold+20);assert.equal(await page.evaluate(()=>state.rep),12);
 assert.match(await page.locator('#orderReward').textContent(),/Золото получено: \+20/);assert.match(await page.locator('#orderReward').textContent(),/Репутация повышена: \+4/);assert.match(await page.locator('#orderReward').textContent(),/Новый ранг/);
 await page.screenshot({path:path.resolve(__dirname,'../audit_source/order-reward.png'),animations:'disabled'});
 const reward=await page.locator('#orderReward').boundingBox();assert.ok(Math.abs(reward.x+reward.width/2-640)<2&&Math.abs(reward.y+reward.height/2-400)<2);
 assert.deepEqual(errors,[]);console.log('PASS: items inside open box, payout, reputation, promotion, centered reward');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
