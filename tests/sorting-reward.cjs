const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('file:///'+path.resolve('dist/index.html').replaceAll('\\','/'));await p.locator('#startGame').click();await p.locator('#buyBag').click();
 const before=await p.evaluate(()=>state.gold);
 await p.evaluate(()=>{while(state.bag.length>1){const x=state.bag[0];sortItem(x.uid,items[x.type].cat);}save();});
 assert.equal(await p.evaluate(()=>state.gold),before);
 // Persist a partially sorted bag; reloading must retain its reward progress.
 await p.reload();await p.locator('#loadGame').click();
 const uid=await p.evaluate(()=>{const x=state.bag[0];sortItem(x.uid,items[x.type].cat);return x.uid;});
 assert.equal(await p.evaluate(()=>state.gold),before+10);assert.equal(await p.evaluate(()=>state.dayIncome),10);
 assert.match(await p.locator('#sortingReward').textContent(),/Поздравляем.*\+10 монет/);
 await p.screenshot({path:'audit_source/sorting-reward.png'});
 await p.evaluate(uid=>rewardSortedItem(uid),uid);assert.equal(await p.evaluate(()=>state.gold),before+10);
 await p.waitForTimeout(1600);assert.equal(await p.locator('#sortingReward').count(),0);
 // Dumping to junk is not sorting; the reward comes after correct transfers.
 await p.evaluate(()=>{state.offers=[];state.orders=[];state.order=null;state.seconds=150;tickArrivals();state.orders=[];state.order=null;buyBag();state.upgrade=true;sweep();});
 const junkGold=await p.evaluate(()=>state.gold);await p.evaluate(()=>{openInspection('junk');for(const x of [...state.junk])sortItem(x.uid,items[x.type].cat);});
 assert.equal(await p.evaluate(()=>state.gold),junkGold+10);
 // Auto sorting uses the same one-time completion reward.
 await p.evaluate(()=>{closeInspection();state.offers=[];state.orders=[];state.order=null;state.seconds=120;tickArrivals();state.orders=[];state.order=null;buyBag();showAutoSortAd();document.getElementById('confirmAuto').disabled=false;});
 const autoGold=await p.evaluate(()=>state.gold);await p.evaluate(()=>autoSort());assert.equal(await p.evaluate(()=>state.gold),autoGold+10);
 assert.equal(await p.evaluate(()=>state.sortingBatches.length),0);assert.deepEqual(errors,[]);
 console.log('PASS: +10 once per bag, partial-save continuation, 1.5s popup, junk requires sorting, auto sorting reward');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
