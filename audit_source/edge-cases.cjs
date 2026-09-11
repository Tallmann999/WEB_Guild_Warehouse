const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('path'),fs=require('fs');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});const p=await b.newPage({viewport:{width:1280,height:800}});await p.goto('file:///'+path.resolve(__dirname,'Guild_Warehouse_v5/dist/index.html').replaceAll('\\','/'));
const out=[];const log=(name,result)=>{out.push({name,result});console.log(name,JSON.stringify(result))};
await p.getByRole('button',{name:'Начать смену',exact:true}).click();await p.locator('#bag').click();await p.getByRole('button',{name:'Сортировать мешок',exact:true}).click();
await p.evaluate(()=>{state.bag[0].tablePos={x:.45,y:.5};state.bag[0].depth=1001;state.bag[1].tablePos={x:.48,y:.5};state.bag[1].depth=1002;renderPile()});
await p.mouse.move(10,10);log('overlap before',await p.evaluate(()=>[...document.querySelectorAll('#pile .item')].slice(0,2).map(e=>({uid:e.dataset.uid,z:getComputedStyle(e).zIndex,rect:e.getBoundingClientRect().toJSON()}))));
await p.mouse.move(610,525);log('overlap hover',await p.evaluate(()=>({hit:document.elementFromPoint(610,525)?.closest('.item')?.dataset.uid,items:[...document.querySelectorAll('#pile .item')].slice(0,2).map(e=>({uid:e.dataset.uid,z:getComputedStyle(e).zIndex,hover:e.matches(':hover')}))})));
// Exercise close/reopen persistence and scrolling on a large stock fixture.
await p.evaluate(()=>{state.stock=Array.from({length:120},()=>entry(0));state.stock.forEach((x,i)=>x.slot=i);openInspection(0)});
log('large stock',await p.evaluate(()=>({count:document.querySelectorAll('#inspectItems .item').length,viewport:$('inspectScroll').clientHeight,height:$('inspectScroll').scrollHeight})));
await p.evaluate(()=>$('inspectScroll').scrollTop=700);const it=p.locator('#inspectItems .item').nth(50);await it.scrollIntoViewIfNeeded();const r=await it.boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();await p.mouse.move(r.x+r.width/2+25,r.y+r.height/2+15,{steps:8});await p.mouse.up();
const before=await p.evaluate(()=>JSON.stringify(state.stock[50].boxPos));await p.locator('#closeInspector').click();await p.locator('[data-cat="0"]').click();await p.locator('#inspectButton').click();log('box position persists',{before,after:await p.evaluate(()=>JSON.stringify(state.stock[50].boxPos))});
await p.locator('#closeInspector').click();await p.evaluate(()=>{state.bag=null;state.order=null;state.closing=true;endDay()});
const focus=[];for(let i=0;i<40;i++){await p.keyboard.press('Tab');const id=await p.evaluate(()=>document.activeElement.id);focus.push(id);if(id==='help'){await p.keyboard.press('Enter');break;}}
log('end modal keyboard', {focus,...await p.evaluate(()=>({ended:state.ended,nextDayExists:!!$('nextDay'),modalText:$('modalContent').innerText}))});await p.keyboard.press('Escape');log('after Escape',await p.evaluate(()=>({ended:state.ended,paused:state.paused,modalVisible:!$('modal').classList.contains('hidden'),nextDayExists:!!$('nextDay')})));
await p.screenshot({path:path.join(__dirname,'end-modal-blocked.png')});fs.writeFileSync(path.join(__dirname,'edge-results.json'),JSON.stringify(out,null,2));await b.close()})().catch(e=>{console.error(e);process.exit(1)});
