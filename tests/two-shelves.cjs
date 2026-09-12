const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');const path=require('node:path');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:800}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('file:///'+path.resolve(__dirname,'../dist/index.html').replaceAll('\\','/'));await p.locator('#startGame').click();await p.locator('#buyBag').click();
 assert.equal(await p.locator('.shelf-row').count(),2);assert.equal(await p.locator('.upper-shelf .shelf-placeholder').count(),5);assert.equal(await p.locator('#shelves .quantity').count(),0);
 const upper=await p.locator('.upper-shelf').boundingBox(),lower=await p.locator('.lower-shelf').boundingBox(),table=await p.locator('#table').boundingBox();
 assert.ok(upper.y+upper.height<=lower.y);assert.ok(lower.y+lower.height<table.y);assert.ok(table.y-lower.y-lower.height<40);
 assert.equal((await p.locator('#game>header').boundingBox()).height,77);assert.equal((await p.locator('#game>footer').boundingBox()).height,70);assert.equal(table.height,304);assert.ok(table.width<1110&&table.width>1100);
 const x=await p.evaluate(()=>{const node=[...document.querySelectorAll('#pile .item')].reverse().find(n=>{const r=n.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.item')===n});const item=state.bag.find(x=>x.uid===Number(node.dataset.uid));return {uid:item.uid,cat:items[item.type].cat};});
 await p.locator(`#pile [data-uid="${x.uid}"]`).click();await p.locator(`#shelves [data-cat="${x.cat}"]`).click();assert.equal(await p.locator(`#shelves [data-cat="${x.cat}"] .shelf-count`).textContent(),'1');
 await p.screenshot({path:path.resolve(__dirname,'../audit_source/two-shelves.png'),animations:'disabled'});
 await p.locator('#shelves [data-cat="4"]').click();assert.equal(await p.locator('#inspectTitle').textContent(),'Ингредиенты');await p.locator('#closeInspector').click();
 await p.evaluate(()=>{state.seconds=CONFIG.daySeconds-INTRO_TIMING[1].orders[0];tickArrivals();state.order.accepted=true;setScreen('work','order');selectBox(2);});
 await p.screenshot({path:path.resolve(__dirname,'../audit_source/two-shelves-order.png'),animations:'disabled'});
 const note=await p.locator('#checklist').boundingBox();assert.ok(note.x+note.width<table.x+table.width&&note.y+note.height<table.y+table.height);
 assert.deepEqual(errors,[]);console.log('PASS: two rows, five transparent slots, inline counts, compact HUD/table, sorting, ingredients, order layout');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
