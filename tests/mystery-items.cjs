const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('file:///'+path.resolve('dist/index.html').replaceAll('\\','/'));await p.locator('#startGame').click();await p.locator('#buyBag').click();
 const initial=await p.evaluate(()=>({n:state.bag.length,unknown:state.bag.filter(isUnknown).length,core:items.find(x=>x.name==='Магическое ядро').cat}));assert.equal(initial.unknown,Math.round(initial.n*.2));assert.equal(initial.core,0);
 const target=await p.evaluate(()=>{const x=state.bag.find(isUnknown);return {uid:x.uid,type:x.type,name:items[x.type].name};});
 const node=p.locator(`#pile [data-uid="${target.uid}"]`);assert.equal(await node.getAttribute('aria-label'),'Неизвестная находка');assert.equal(await node.locator('.mystery-question').textContent(),'?');
 await p.screenshot({path:'audit_source/mystery-loot.png'});
 await p.evaluate(uid=>{state.upgrade=true;openUnknown(state.bag.find(x=>x.uid===uid));},target.uid);await p.locator('#stashUnknown').click();assert.ok(await p.evaluate(uid=>state.junk.some(x=>x.uid===uid),target.uid));
 await p.evaluate(uid=>openUnknown(state.junk.find(x=>x.uid===uid)),target.uid);await p.locator('#inspectUnknown').click();assert.equal(await p.locator('#recognitionTitle').textContent(),'Осмотр находки');
 const before=await p.evaluate(()=>({gold:state.gold,rep:state.rep}));
 await p.evaluate(()=>{for(let i=0;i<80&&!document.getElementById('cleanKey').disabled;i++)document.getElementById('cleanKey').click();});
 assert.equal(await p.locator('#recognitionTitle').textContent(),target.name);assert.equal(await p.evaluate(()=>state.gold),before.gold+12);assert.equal(await p.evaluate(()=>state.rep),before.rep+1);assert.ok(await p.locator('.reward-coin').count()>0);
 await p.screenshot({path:'audit_source/mystery-recognized.png'});
 await p.evaluate(type=>recognizeItem(type,state.junk.find(x=>x.type===type)),target.type);assert.equal(await p.evaluate(()=>state.gold),before.gold+12);
 await p.locator('#backCollection').click();assert.match(await p.locator(`[data-type="${target.type}"]`).textContent(),/Распознано/);
 const regular=await p.evaluate(()=>state.bag.find(x=>!isUnknown(x)&&!state.collection.includes(x.type)).type);
 assert.match(await p.locator(`[data-type="${regular}"]`).textContent(),/Название неизвестно/);await p.locator(`[data-type="${regular}"]`).click();
 await p.evaluate(()=>{for(let i=0;i<80&&!document.getElementById('cleanKey').disabled;i++)document.getElementById('cleanKey').click();});assert.equal(await p.evaluate(()=>state.gold),before.gold+17);assert.equal(await p.evaluate(()=>state.rep),before.rep+2);
 await p.evaluate(()=>{closeModal();save();});await p.reload();await p.locator('#loadGame').click();assert.ok(await p.evaluate(type=>state.collection.includes(type),target.type));assert.equal(await p.evaluate(uid=>isUnknown(state.junk.find(x=>x.uid===uid)),target.uid),false);
 // Auto-sort must leave still-hidden items untouched and unrewarded for sorting.
 await p.evaluate(()=>{const hidden=makeItem(items.find(x=>mysteryType(x.id)&&!state.collection.includes(x.id)).id);hidden.unknown=true;state.bag.push(hidden);setScreen('work','sort');showAutoSortAd();document.getElementById('confirmAuto').disabled=false;});await p.evaluate(()=>autoSort());assert.ok(await p.evaluate(()=>state.bag.length>0&&state.bag.every(isUnknown)));
 assert.deepEqual(errors,[]);console.log('PASS: 20% hidden, silhouettes/no name leak, stash, real cleaning, +12/+5 and rep, no repeat rewards, coins, persistence, auto-sort respects hidden items');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
