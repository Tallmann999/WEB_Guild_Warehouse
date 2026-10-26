'use strict';
// Screen-fit regression: no page movement and no automatic scrolling helpers.
// Only the physical inventory pane may scroll while selecting its real items.
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
const CASES=process.env.VIEWPORT_FIT_SIZES?process.env.VIEWPORT_FIT_SIZES.split(',').map(size=>size.split('x').map(Number)):[[1920,920],[1366,768],[1280,720],[1024,768]];
const pause=async p=>p.waitForTimeout(60);
async function bounded(p,label){
 const result=await p.evaluate(()=>{const doc=document.documentElement,body=document.body,s=document.scrollingElement,r=$('game').getBoundingClientRect();return {docHeight:doc.scrollHeight,bodyHeight:body.scrollHeight,docWidth:doc.scrollWidth,bodyWidth:body.scrollWidth,width:innerWidth,height:innerHeight,scrollX,scrollY,inside:r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1};});
 assert.ok(result.docHeight<=result.height+1&&result.bodyHeight<=result.height+1&&result.docWidth<=result.width+1&&result.bodyWidth<=result.width+1,label+': document fits the viewport '+JSON.stringify(result));assert.equal(result.scrollX,0,label+': no horizontal page movement');assert.equal(result.scrollY,0,label+': no vertical page movement');assert.equal(result.inside,true,label+': full game shell fits');
}
async function visible(p,selector,label=selector){
 const result=await p.locator(selector).first().evaluate(e=>{
  const r=e.getBoundingClientRect(),cx=r.x+r.width/2,cy=r.y+r.height/2,hit=document.elementFromPoint(cx,cy),blocked=[];
  for(let a=e.parentElement;a&&a!==document.body;a=a.parentElement){const css=getComputedStyle(a),box=a.getBoundingClientRect();if(/hidden|clip|auto|scroll/.test(css.overflowY)&&(r.top<box.top-1||r.bottom>box.bottom+1))blocked.push(a.id||a.className||a.tagName);if(/hidden|clip|auto|scroll/.test(css.overflowX)&&(r.left<box.left-1||r.right>box.right+1))blocked.push(a.id||a.className||a.tagName);}
  const css=getComputedStyle(e);return {inside:r.width>0&&r.height>0&&r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,painted:css.display!=='none'&&css.visibility!=='hidden'&&Number(css.opacity)>0,hit:hit===e||e.contains(hit),blocked,rect:{x:r.x,y:r.y,width:r.width,height:r.height},point:{x:cx,y:cy},hitName:hit?.id||hit?.closest('button')?.id||hit?.className||hit?.tagName};
 });
 assert.ok(result.inside&&result.painted&&result.hit&&!result.blocked.length,label+': fully visible and actually hittable '+JSON.stringify(result));return result.point;
}
async function click(p,selector,label=selector){
 const point=await visible(p,selector,label);assert.equal(await p.locator(selector).first().isEnabled(),true,label+': enabled');await p.mouse.click(point.x,point.y);
}
async function footer(p,label){
 for(const selector of ['#help','#upgradesNav','#ordersNav'])if(await p.locator(selector).isVisible())await visible(p,selector,label+' '+selector);
 await bounded(p,label);
}
async function cardFits(p,selector,label){
 const report=await p.locator(selector).first().evaluate(e=>{
  const box=e.getBoundingClientRect(),nodes=[...new Set(e.querySelectorAll(':scope > *,.parcel-actions > *,.parcel-recipe > li,.contract-recipe > span'))];
  const content=nodes.filter(node=>{const css=getComputedStyle(node);return css.display!=='none'&&css.visibility!=='hidden'&&node.getClientRects().length;}).map(node=>{const r=node.getBoundingClientRect();return {tag:node.tagName,class:node.className,text:node.textContent.trim().slice(0,70),left:r.left-box.left,top:r.top-box.top,right:r.right-box.right,bottom:r.bottom-box.bottom,width:r.width,height:r.height};});
  return {client:e.clientHeight,content:content.length,outside:content.filter(r=>r.left< -1||r.top< -1||r.right>1||r.bottom>1)};
 });
 // Intentional external ray pseudos contribute to scrollHeight. Actual rows,
 // text blocks and command rectangles must still fit the parchment itself.
 assert.ok(report.client>0&&report.content>0&&!report.outside.length,label+': all real card content fits the sheet, excluding decorative ray pseudos '+JSON.stringify(report));
}
async function glyphFits(p,selector,label){
 const report=await p.locator(selector).first().evaluate(e=>{
  const box=e.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(e);const ink=range.getBoundingClientRect(),unit=$('game').getBoundingClientRect().width/$('game').offsetWidth||1,css=getComputedStyle(e);
  return {text:e.textContent.trim(),client:e.clientHeight,scroll:e.scrollHeight,boxHeight:box.height/unit,inkHeight:ink.height/unit,topOverflow:(box.top-ink.top)/unit,bottomOverflow:(ink.bottom-box.bottom)/unit,lineHeight:css.lineHeight,flexShrink:css.flexShrink};
 });
 assert.ok(report.client>0&&report.scroll<=report.client+1&&report.topOverflow<=1&&report.bottomOverflow<=1,label+': title/price glyphs fit vertically '+JSON.stringify(report));
}
async function workScale(p,label){
 const report=await p.evaluate(()=>{const game=$('game').getBoundingClientRect(),work=$('work').getBoundingClientRect(),table=$('table').getBoundingClientRect(),shelves=$('shelves').getBoundingClientRect(),center=game.left+game.width/2;return {tableRatio:$('table').offsetWidth/($('game').clientWidth-56),workLeft:work.left-game.left,workRight:game.right-work.right,tableCenter:table.left+table.width/2-center,shelfCenter:shelves.left+shelves.width/2-center,crates:[...document.querySelectorAll('#shelves img.boxart')].filter(img=>!img.closest('.shelf-placeholder')).map(img=>({width:img.offsetWidth,height:img.offsetHeight}))};});
 assert.ok(report.tableRatio>=.62&&report.tableRatio<=.78,label+': sorting table is about70% of the previous full width '+JSON.stringify(report));
 assert.ok(report.crates.length>=5&&report.crates.every(r=>r.width===144&&r.height===104),label+': crate images are doubled to144x104 logical pixels '+JSON.stringify(report));
 assert.ok(Math.abs(report.workLeft)<=1&&Math.abs(report.workRight)<=1,label+': work scene spans the full frame without a reserved right strip '+JSON.stringify(report));
 assert.ok(Math.abs(report.tableCenter)<=1&&Math.abs(report.shelfCenter)<=1,label+': table and shelves are centered on the full game frame '+JSON.stringify(report));
 for(const selector of ['#unknownTrayButton','#autoSortButton'])if(await p.locator(selector).isVisible())await visible(p,selector,label+' unobscured work heading '+selector);
}
async function overlayDock(p,label){
 const report=await p.evaluate(()=>{
  const rail=$('taskRail'),css=getComputedStyle(rail),work=getComputedStyle($('work')),box=rail.getBoundingClientRect(),x=box.left+2,y=box.top+Math.min(45,box.height/2),hit=document.elementFromPoint(x,y),card=rail.querySelector('.order-card,.contract-offer-leaf');
  const channels=css.backgroundColor.match(/[\d.]+/g)||[],alpha=css.backgroundColor==='transparent'?0:channels.length===4?Number(channels[3]):1;
  return {background:css.backgroundColor,image:css.backgroundImage,shadow:css.boxShadow,alpha,pointer:css.pointerEvents,cardPointer:card&&getComputedStyle(card).pointerEvents,z:Number(css.zIndex)||0,workZ:Number(work.zIndex)||0,paddingPassesThrough:!!hit&&!rail.contains(hit),paddingHit:hit?.id||hit?.tagName};
 });
 assert.ok(report.alpha===0&&report.image==='none'&&report.shadow==='none',label+': only sheets have a surface; the dock has no grey panel '+JSON.stringify(report));
 assert.equal(report.pointer,'none',label+': transparent dock gaps pass pointer input');assert.equal(report.cardPointer,'auto',label+': individual sheets remain interactive');assert.ok(report.z>report.workZ,label+': sheets overlay the full-width game');assert.equal(report.paddingPassesThrough,true,label+': an empty dock edge hits the game below '+JSON.stringify(report));
}
async function rarityTheme(p,label){
 const report=await p.evaluate(()=>{
  const leaf=document.querySelector('#contractOfferBoard [data-contract-key="royal"]'),before=JSON.stringify({orders:state.orders,uid:state.uid,gold:state.gold}),special=document.createElement('article');special.className='quest-sheet';special.style.cssText='position:absolute;visibility:hidden;pointer-events:none';$('game').append(special);styleQuestSheet(special,{rarity:'special'});
  const result={contract:leaf.dataset.questRarity,contractColor:getComputedStyle(leaf).backgroundColor,special:special.dataset.questRarity,specialColor:getComputedStyle(special).backgroundColor};special.remove();result.statePreserved=before===JSON.stringify({orders:state.orders,uid:state.uid,gold:state.gold});return result;
 });
 assert.equal(report.contract,'unique',label+': agreements have the unique visual theme');assert.equal(report.special,'special',label+': the special visual theme is prepared');
 const gold=report.contractColor.match(/[\d.]+/g).map(Number),purple=report.specialColor.match(/[\d.]+/g).map(Number);assert.ok(gold[0]>gold[2]&&gold[1]>gold[2],label+': unique sheet uses a gold background');assert.ok(purple[0]>purple[1]&&purple[2]>purple[1],label+': special sheet uses a purple background');assert.equal(report.statePreserved,true,label+': preparing a visual theme creates no special order, item or reward');
}
async function visibleTaskCards(p){
 return p.evaluate(()=>{
  const rail=$('taskRail'),pane=rail.querySelector('.task-letters').getBoundingClientRect();
  return [...rail.querySelectorAll('.order-card,.contract-offer-leaf')].filter(e=>{
   const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=pane.left-1&&r.right<=pane.right+1&&r.top>=pane.top-1&&r.bottom<=pane.bottom+1&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;
  }).map(e=>e.matches('.order-card')?{id:'order:'+e.dataset.orderId,selector:'#orderBoard .order-card[data-order-id="'+e.dataset.orderId+'"]',contract:false}:{id:'contract:'+e.dataset.contractKey,selector:'#contractOfferBoard [data-contract-key="'+e.dataset.contractKey+'"]',contract:true});
 });
}
async function snapshot(p,name){
 const path='audit_source/fit-'+name+'.png';
 try{await p.screenshot({path});}
 catch(error){
  if(error.code!=='UNKNOWN'&&error.errno!==-4094)throw error;
  const alternate=path.replace(/\.png$/,'-rerun-'+Date.now()+'.png');await p.screenshot({path:alternate});console.log('Screenshot saved separately because Windows could not open the previous PNG: '+alternate);
 }
}
async function advancedFixture(p){
 return p.evaluate(()=>{
  cancelDrag();forceCloseModal();BagPour.clear();City.close();if(typeof Tower!=='undefined'&&Tower.isOpen())Tower.close('reception');
  state=freshState();state.started=true;state.day=5;state.gold=2000;state.tutorial={active:false};state.orderUid=0;state.orders=[];state.order=null;state.offers=[];state.stock=[];state.bag=[];state.junk=[];state.unknownTray=[];state.collection=items.map(x=>x.id);
  state.story={version:1,letterRead:true,inheritedOpened:true,firstPaid:true,restored:true,shopRestorationStage:2,firstDayComplete:true,firstDayFlowVersion:2,firstDayPurchases:2,firstDayDeliveries:2,secondDayFlowVersion:2,secondDayActive:false,completedB2:true,completedB3:true,elapsed:30,nextVisit:999,dwarfEncounterSeen:true,goblinEncounterSeen:true,regularContracts:{},guild:{founded:true,name:'Лавка на экране',phase:'complete'}};
  state.dwarf={hired:true,enabled:false,batches:[]};state.goblin={hired:true,enabled:false,deliveries:1};state.city={towerOwned:true,mapUnlocked:true,accessVersion:2,guildTowerOfferUnlocked:true};
  Story.ensure();Dwarf.ensure();Goblin.ensure();Contracts.ensure();LootkeeperEngine.bridge.step=()=>{};setScreen('reception','sort');save();
 });
}
async function royalFixture(p){
 return p.evaluate(()=>{
  forceCloseModal();cancelDrag();state.orders=[];state.order=null;state.bag=[];state.offers=[];state.stock=[];
  const contracts=Contracts.ensure();for(const key of ['chef','alchemy'])Object.assign(contracts[key],{signed:true,deliveries:3,completed:true,offerState:'completed'});
  Object.assign(contracts.royal,{signed:true,delegated:false,deliveries:0,completed:false,nextAt:0,offerState:'signed',deliveryOrderIds:[]});Contracts.sync();
  const order=Contracts.current('royal');for(const line of order.recipe)for(let i=0;i<line.count;i++){const x=makeItem(line.type);x.unknown=false;state.stock.push(x);}Goblin.reconcile();setScreen('reception','sort');render();
  return {id:order.id,uids:state.stock.map(x=>x.uid),reward:order.reward,gold:state.gold};
 });
}
async function exposeSourceUid(p,uid){
 // This is a bounded crate's own scroll position, never a page scroll. A real
 // mouse click still has to pass the complete visibility/hit checks below.
 await p.evaluate(uid=>{const node=document.querySelector('#sourceItems [data-uid="'+uid+'"]'),pane=$('sourceScroll'),unit=$('game').getBoundingClientRect().width/$('game').offsetWidth||1;const r=node.getBoundingClientRect(),v=pane.getBoundingClientRect();if(r.top<v.top+2)pane.scrollTop-=(v.top+2-r.top)/unit;else if(r.bottom>v.bottom-2)pane.scrollTop+=(r.bottom-v.bottom+2)/unit;},uid);await pause(p);
}
async function runRoyal(p,label,resizeMidway=false){
 const keep=await royalFixture(p);await pause(p);await bounded(p,label+' royal letter');
 const royalLeaf='#contractOfferBoard [data-contract-key="royal"]';
 await rarityTheme(p,label);await overlayDock(p,label+' reception dock');
 await cardFits(p,royalLeaf,label+' signed royal card');await glyphFits(p,royalLeaf+' h3',label+' signed royal title');await glyphFits(p,royalLeaf+' .quest-price',label+' signed royal price');
 await p.evaluate(()=>{const o=Contracts.current('royal');Goblin.setEnabled(true);Goblin.assign(o,true);render();});await pause(p);await cardFits(p,royalLeaf,label+' working royal card');await glyphFits(p,royalLeaf+' h3',label+' working royal title');await glyphFits(p,royalLeaf+' .quest-price',label+' working royal price');
 await p.evaluate(()=>{Goblin.assign(Contracts.current('royal'),false);Goblin.setEnabled(false);render();});await pause(p);
 await click(p,'#contractOfferBoard [data-contract-key="royal"] [data-parcel-action="manual"]',label+' royal manual command');await pause(p);
 await workScale(p,label+' royal work geometry');await overlayDock(p,label+' assembly overlay');
 assert.equal(await p.evaluate(()=>state.mode),'order');assert.equal(await p.locator('#checklist .check-row').count(),3);assert.deepEqual(await p.locator('#checklist .check-row b').allTextContents(),['0/5','0/5','0/5']);
 for(let i=0;i<3;i++)await visible(p,'#checklist .check-row:nth-of-type('+(i+1)+')',label+' complete royal recipe row'+i);
 assert.match(await p.locator('#checklist').textContent(),/Интендант короля/);assert.match(await p.locator('#checklist').textContent(),/360/);await visible(p,'#backSort',label+' manual return');await footer(p,label+' royal assembly');await snapshot(p,label+'-royal');
 await click(p,'#shelves [data-cat="3"]',label+' equipment crate');
 for(let i=0;i<keep.uids.length;i++){
  const uid=keep.uids[i];let alreadyHeld=false;
  if(resizeMidway&&i===5){
   await exposeSourceUid(p,uid);await click(p,'#sourceItems [data-uid="'+uid+'"]',label+' held original before resize');
   const before=await p.evaluate(()=>{window.__fitHeldNode=drag.node;return state.order.packed.map(x=>x.uid);});
   await p.setViewportSize({width:1280,height:720});await pause(p);await footer(p,label+' resize1920to1280');assert.deepEqual(await p.evaluate(()=>state.order.packed.map(x=>x.uid)),before,'Viewport resize preserves five already packed originals');
   await workScale(p,label+' held resize geometry');await overlayDock(p,label+' held resize overlay');
   assert.deepEqual(await p.evaluate(()=>({uid:drag?.uid,connected:!!drag?.node.isConnected,same:drag?.node===window.__fitHeldNode})),{uid,connected:true,same:true},'Viewport resize preserves the held original and its live input node');
   const last=keep.uids.at(-1);await exposeSourceUid(p,last);await visible(p,'#sourceItems [data-uid="'+last+'"]',label+' last source original immediately after resize');alreadyHeld=true;
  }
  if(!alreadyHeld){await exposeSourceUid(p,uid);await click(p,'#sourceItems [data-uid="'+uid+'"]',label+' originaluid'+uid);}
  assert.equal(await p.evaluate(()=>drag?.uid),uid);await click(p,'#parcelDrop',label+' parcel drop');
 }
 assert.deepEqual(await p.evaluate(()=>state.order.packed.map(x=>x.uid)),keep.uids);assert.equal(await p.evaluate(()=>orderComplete()),true);await visible(p,'#ship',label+' completed ship command');await footer(p,label+' completed royal');await click(p,'#ship',label+' ship');assert.equal(await p.evaluate(()=>state.gold),keep.gold+keep.reward);assert.equal(await p.evaluate(()=>state.story.regularContracts.royal.deliveries),1);assert.equal(await p.evaluate(()=>state.stock.length),0);
}
async function stressAndCity(p,label){
 await advancedFixture(p);
 await p.evaluate(()=>{
  state.orders=Array.from({length:4},(_,i)=>({id:++state.orderUid,accepted:true,customer:i,reward:90,title:'Поручение '+(i+1),recipe:[{type:0,count:2},{type:6,count:1},{type:18,count:1}],packed:[],reservedUids:[],assignedTo:'manual'}));state.order=state.orders[0];
  for(const c of Object.values(Contracts.ensure()))Object.assign(c,{signed:false,completed:false,deliveries:0,offerSeen:true,offerState:'later'});render();
 });await pause(p);assert.equal(await p.locator('#orderBoard .order-card').count(),4);assert.equal(await p.locator('#contractOfferBoard .contract-offer-leaf').count(),3);await footer(p,label+' seven letters');
 const dock=await p.locator('#taskRail').evaluate(e=>{const r=e.getBoundingClientRect(),g=$('game').getBoundingClientRect();return {right:r.right<=g.right+1,rightColumn:r.left>=g.left+g.width*.6,vertical:r.height>r.width};});assert.deepEqual(dock,{right:true,rightColumn:true,vertical:true},label+': letters use the right vertical dock');
 await visible(p,'#orderBoard .order-card:first-child [data-parcel-action="manual"]',label+' first letter command');await snapshot(p,label+'-seven-letters');
 const seen=new Set();
 for(let page=0;page<10;page++){
  const cards=await visibleTaskCards(p);assert.ok(cards.length,label+': each list page exposes a complete card');
  for(const card of cards){
   await cardFits(p,card.selector,label+' '+card.id+' full card');await glyphFits(p,card.selector+' h3',label+' '+card.id+' title');await glyphFits(p,card.selector+' .quest-price',label+' '+card.id+' price');await visible(p,card.selector+' .quest-recipient',label+' '+card.id+' recipient');
   await visible(p,card.selector+(card.contract?' .agreement-open-offer':' [data-parcel-action="manual"]'),label+' '+card.id+' actual command');
   const recipe=card.contract?' .contract-recipe span':' .parcel-recipe li';assert.equal(await p.locator(card.selector+recipe).count(),3);
   for(let i=1;i<=3;i++)await visible(p,card.selector+recipe+':nth-child('+i+')',label+' '+card.id+' complete recipe'+i);seen.add(card.id);
  }
  await bounded(p,label+' right list page'+page);
  if(await p.locator('#taskNext').isDisabled())break;
  await click(p,'#taskNext',label+' next letters down');await pause(p);
 }
 assert.equal(seen.size,7,label+': all seven letters, recipes and commands are reachable through list buttons');await snapshot(p,label+'-last-royal-offer');
 for(let page=0;page<10&&!await p.locator('#taskPrev').isDisabled();page++){await click(p,'#taskPrev',label+' previous letters up');await pause(p);}assert.equal(await p.locator('#taskPrev').isDisabled(),true);
 const overlayLoot=await p.evaluate(()=>{state.bag=[{type:0,x:.2},{type:38,x:.92}].map(({type,x})=>{const item=makeItem(type);item.unknown=false;item.tablePos={x,y:.52};return item;});setScreen('work','sort');return {gold:state.gold,items:state.bag.map(item=>({uid:item.uid,cat:items[item.type].cat}))};});await pause(p);await workScale(p,label+' seven-letter sorting');await overlayDock(p,label+' sorting overlay');
 for(const item of overlayLoot.items){await click(p,'#pile [data-uid="'+item.uid+'"]',label+' original under open overlay'+item.uid);assert.equal(await p.evaluate(()=>drag?.uid),item.uid);await click(p,'#shelves [data-cat="'+item.cat+'"]',label+' uncovered real shelf'+item.cat);assert.equal(await p.evaluate(uid=>state.stock.some(item=>item.uid===uid),item.uid),true);}
 assert.equal(await p.evaluate(()=>state.bag.length),0);assert.equal(await p.evaluate(()=>state.gold),overlayLoot.gold,'The overlay input check never grants money or charges another fee');await bounded(p,label+' sorted beside seven letters');await snapshot(p,label+'-centered-overlay');
 await click(p,'#ordersNav',label+' all orders book');assert.equal(await p.locator('#modal .quest-book article').count(),4);await visible(p,'#closeModal',label+' orders book close');await click(p,'#closeModal',label+' close orders book');
 await click(p,'#cityNav',label+' city control');await pause(p);await visible(p,'#cityClose',label+' city return');await visible(p,'#cityEnterTower',label+' enter tower');await bounded(p,label+' city');await snapshot(p,label+'-city');
 await click(p,'#cityEnterTower',label+' tower entry');await pause(p);assert.equal(await p.evaluate(()=>state.screen),'tower');await visible(p,'#towerClose',label+' tower city return');await visible(p,'#towerReturnShop',label+' tower shop return');await bounded(p,label+' tower');await snapshot(p,label+'-tower');await click(p,'#towerReturnShop',label+' tower return');assert.equal(await p.evaluate(()=>state.screen),'reception');
}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const [width,height]of CASES){
  const p=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));const label=width+'x'+height;
  await p.goto(BASE);await p.waitForFunction(()=>window.LootkeeperEngine?.ready);await pause(p);await bounded(p,label+' menu');await click(p,'#startGame',label+' actual new game');await pause(p);await bounded(p,label+' letter');await click(p,'#acceptInheritance',label+' inheritance accept');await p.waitForTimeout(800);
  const entry=await p.evaluate(()=>{const scene=LootkeeperEngine.game.scene.getScenes(true)[0],views=[...scene.views],relevant=views.filter(([id])=>id.startsWith('visitor:')||id.startsWith('counter-bag:'));return {visible:views.some(([id,v])=>id.startsWith('visitor:')&&v.sprite.alpha>.5)&&views.some(([id,v])=>id.startsWith('counter-bag:')&&v.sprite.alpha>.5),scene:scene.sys.settings.key,screen:state.screen,paused:state.paused,hidden:document.hidden,views:relevant.map(([id,v])=>({id,alpha:v.sprite.alpha,visible:v.sprite.visible,x:v.sprite.x,y:v.sprite.y})),visitorCss:getComputedStyle($('visitor')).opacity,bagCss:getComputedStyle($('bag').querySelector('img')).opacity};});
  assert.equal(entry.visible,true,'Native first visitor and sack are visibly present '+JSON.stringify(entry));
  await visible(p,'#buyBag',label+' first purchase button');await bounded(p,label+' first purchase');await snapshot(p,label+'-start');await click(p,'#buyBag',label+' paid first bag');
  await p.waitForFunction(()=>!BagPour.active());assert.equal(await p.evaluate(()=>state.gold),70);assert.equal(await p.evaluate(()=>state.bag.length),8);await footer(p,label+' first sorting');await workScale(p,label+' sorting geometry');await snapshot(p,label+'-sorting');
  const originals=await p.evaluate(()=>state.bag.map(x=>({uid:x.uid,cat:items[x.type].cat,unknown:isUnknown(x)})));
  for(const x of originals){
   await click(p,'#pile [data-uid="'+x.uid+'"]',label+' firstbag uid'+x.uid);
   if(x.unknown){await visible(p,'#cleanKey',label+' recognition control');await p.evaluate(()=>{for(let i=0;i<80&&!$('cleanKey').disabled;i++)$('cleanKey').click();});await p.waitForSelector('#modal.hidden',{state:'attached'});await click(p,'#pile [data-uid="'+x.uid+'"]',label+' known uid'+x.uid);}
   assert.equal(await p.evaluate(()=>drag?.uid),x.uid);await click(p,'#shelves [data-cat="'+x.cat+'"]',label+' correct shelf');
  }
  assert.equal(await p.evaluate(()=>state.bag.length),0);assert.deepEqual(await p.evaluate(()=>state.stock.map(x=>x.uid).sort((a,b)=>a-b)),originals.map(x=>x.uid).sort((a,b)=>a-b));await bounded(p,label+' sorted8');
  await advancedFixture(p);await runRoyal(p,label,width===1920);if(width===1920){await p.setViewportSize({width,height});await pause(p);}await stressAndCity(p,label);assert.deepEqual(errors,[]);await p.close();console.log('PASS '+label+': real start/letter/bag,8 original sorts, full royal15+ship,7-letter rail,city/tower returns and no page scroll'+(width===1920?' with1920to1280 resize.':'.'));
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
