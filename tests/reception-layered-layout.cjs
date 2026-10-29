'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
const STAGES=['derelict','bare-walls','guild-furnished'],VISITORS=['s3_0','s3_1','s3_2','s3_3','s3_5'];
const POSE={x:650,y:950,scale:140},COUNTER_Y=100;
const close=(a,b,label,tolerance=.08)=>assert.ok(Math.abs(a-b)<=tolerance,label+': '+a+' vs '+b);
async function scene(p,key){await p.waitForFunction(key=>LootkeeperEngine.stats?.scene===key,key);await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function freeze(p){await p.evaluate(()=>{LootkeeperEngine.bridge.step=()=>{};});}
async function ledger(p){return p.evaluate(()=>({gold:state.gold,items:owned().map(x=>({uid:x.uid,type:x.type,tablePos:x.tablePos,tableAngle:x.tableAngle})).sort((a,b)=>a.uid-b.uid),orders:state.orders.map(o=>({id:o.id,packed:o.packed.map(x=>x.uid),reserved:o.reservedUids.slice(),reward:o.reward})),dwarf:state.dwarf.enabled,goblin:state.goblin.enabled}));}
async function fixture(p,{stage=2,visitor=2,offer=true}={}){await p.evaluate(({stage,visitor,offer})=>{
  forceCloseModal();Tower.close('none');City.close();BagPour.clear();cancelDrag();state=freshState();
  state.started=true;state.screen='reception';state.mode='sort';state.day=stage+1;state.seconds=180;state.gold=640;
  state.tutorial={active:false};state.collection=items.map(x=>x.id);state.orderUid=1;state.stock=[];state.bag=[];state.junk=[];state.unknownTray=[];
  const packed=makeItem(0),reserved=makeItem(0),free=makeItem(6);packed.unknown=reserved.unknown=free.unknown=false;
  free.tablePos={x:.37,y:.61};free.tableAngle=-9;state.stock.push(reserved,free);
  const partial={id:1,accepted:true,customer:1,reward:90,title:'Защищённая ручная посылка',recipe:[{type:0,count:2}],packed:[packed],reservedUids:[reserved.uid],assignedTo:'manual'};
  state.orders=[partial];state.order=partial;
  state.story={version:1,letterRead:true,inheritedOpened:true,firstPaid:true,firstDayComplete:true,firstDayFlowVersion:2,firstDayPurchases:2,firstDayDeliveries:2,
    restored:stage>0,shopRestorationStage:stage,secondDayFlowVersion:2,secondDayActive:false,secondDayEndPending:false,completedB2:true,completedB3:true,
    dwarfEncounterSeen:true,goblinEncounterSeen:true,repairPromptSeen:true,repairOfferPending:false,elapsed:32,nextVisit:999,regularContracts:{},earlyVisitVersion:1,earlyVisitIndex:0};
  state.dwarf={hired:true,enabled:false,batches:[]};state.goblin={hired:true,enabled:false,deliveries:1};
  state.city={accessVersion:2,mapUnlocked:true,guildTowerOfferUnlocked:true,towerNoticeSeen:true,towerOwned:false};
  state.offers=offer?[{visitor,arrivalSerial:501,price:10,qualityRolled:true,loot:[0,6,12,18,0,6,12,18].map(type=>{const item=makeItem(type);item.unknown=false;return item;})}]:[];
  state.arrivalSerial=501;state.visitorCooldown=0;Story.ensure();Dwarf.ensure();Goblin.ensure();Contracts.ensure();Goblin.reconcile();render();save();
},{stage,visitor,offer});await scene(p,'Reception');}
async function light(p,night){await p.evaluate(night=>{for(const period of ['morning','day','evening','night'])$('game').style.setProperty('--light-'+period,period==='night'?night:period==='day'?1-night:0);},night);await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function shot(p,label){const file=path.resolve('audit_source/reception-layout-20261029-'+label+'.png');try{await p.screenshot({path:file});}catch(error){if(error.code!=='UNKNOWN'&&error.errno!==-4094)throw error;await p.screenshot({path:file.replace(/\.png$/,'-rerun-'+Date.now()+'.png')});}}
async function bounded(p,label){const r=await p.evaluate(()=>({width:innerWidth,height:innerHeight,docW:document.documentElement.scrollWidth,docH:document.documentElement.scrollHeight,bodyW:document.body.scrollWidth,bodyH:document.body.scrollHeight,x:scrollX,y:scrollY}));assert.ok(r.docW<=r.width+1&&r.bodyW<=r.width+1&&r.docH<=r.height+1&&r.bodyH<=r.height+1,label+': no outside scroll '+JSON.stringify(r));assert.equal(r.x,0);assert.equal(r.y,0);}
async function geometry(p,stage,visitor,night,label){
  await p.waitForFunction(({stage,visitor})=>{const s=LootkeeperEngine.game.scene.getScene('Reception');return s&&s.children.list.some(x=>x.texture?.key==='prop.reception-'+stage+'-counter')&&(visitor===null||[...s.views].some(([id,v])=>id.startsWith('visitor:')&&v.sprite.texture.key==='art.'+visitor));},{stage:STAGES[stage],visitor});
  const report=await p.evaluate(({stage,visitor})=>{
    const s=LootkeeperEngine.game.scene.getScene('Reception'),snap=LootkeeperEngine.bridge.current();
    const rect=image=>({x:image.x,y:image.y,width:image.displayWidth,height:image.displayHeight,scaleX:image.scaleX,scaleY:image.scaleY,alpha:image.alpha,depth:image.depth,cropped:image.isCropped});
    const image=key=>{const found=s.children.list.filter(x=>x instanceof Phaser.GameObjects.Image&&x.texture.key===key);return {count:found.length,...(found[0]?rect(found[0]):{})};};
    const entry=visitor===null?null:[...s.views].find(([id,v])=>id.startsWith('visitor:')&&v.sprite.texture.key==='art.'+visitor)?.[1].sprite;
    return {bounds:snap.bounds,day:image('environment.reception-'+stage+'-day'),night:image('environment.reception-'+stage+'-night'),counter:image('prop.reception-'+stage+'-counter'),
      visitor:entry?{...rect(entry),source:{width:entry.texture.getSourceImage().width,height:entry.texture.getSourceImage().height}}:null,
      canvas:document.querySelectorAll('#phaser-world canvas').length,failures:LootkeeperEngine.failures};
  },{stage:STAGES[stage],visitor});
  const b=report.bounds,fit=Math.max(b.width/1536,b.height/1024),left=b.x+(b.width-1536*fit)/2,top=b.y+(b.height-1024*fit)/2;
  assert.equal(report.canvas,1,label+': one Phaser canvas');assert.deepEqual(report.failures,[],label+': all assets loaded');
  for(const name of ['day','night','counter']){
    const r=report[name];assert.equal(r.count,1,label+': one '+name+' layer for the selected stage');
    close(r.width,1536*fit,label+' '+name+' width');close(r.height,1024*fit,label+' '+name+' height');close(r.x,b.x+b.width/2,label+' '+name+' centre X');
    close(r.y,b.y+b.height/2+(name==='counter'?COUNTER_Y*fit:0),label+' '+name+' centre Y');close(r.scaleX,r.scaleY,label+' '+name+' uniform scale');
  }
  close(report.night.alpha,night,label+': actual night texture blend');close(report.counter.alpha,1,label+': opaque counter strength');assert.equal(report.counter.cropped,false,label+': true alpha counter replaces rectangular crop');
  if(visitor!==null){
    const v=report.visitor;assert.ok(v,label+': selected visitor exists');const base=Math.min(1536*.22/v.source.width,1024*.65/v.source.height)*POSE.scale/100;
    close(v.width,v.source.width*base*fit,label+': portrait width');close(v.height,v.source.height*base*fit,label+': portrait height');
    close(v.x,left+POSE.x*fit,label+': approved X650 anchor');close(v.y+v.height/2,top+POSE.y*fit,label+': approved Y950 bottom anchor');
    assert.equal(v.cropped,false,label+': complete source portrait');assert.ok(report.day.depth<v.depth&&report.night.depth<v.depth&&report.counter.depth>v.depth,label+': visitor is between full background and alpha counter');
  }
  await bounded(p,label);return report;
}
async function occlusion(p,label){
  const points=await p.evaluate(()=>{
    const s=LootkeeperEngine.game.scene.getScene('Reception'),v=[...s.views].find(([id])=>id.startsWith('visitor:'))[1].sprite;
    const c=s.children.list.find(x=>x instanceof Phaser.GameObjects.Image&&x.texture.key==='prop.reception-guild-furnished-counter'),bounds=LootkeeperEngine.bridge.current().bounds;
    const pixels=image=>{const source=image.texture.getSourceImage(),canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0);return {data:ctx.getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height};};
    const vp=pixels(v),cp=pixels(c),points={},root=$('game'),r=root.getBoundingClientRect(),unit=r.width/root.offsetWidth;
    for(let y=0;y<vp.height&&!points.upper||y<vp.height&&!points.lower;y+=3){
      for(let x=Math.floor(vp.width*.25);x<vp.width*.75;x+=3){
        if(vp.data[(y*vp.width+x)*4+3]<240)continue;
        const wx=v.x-v.displayWidth/2+(x+.5)*v.scaleX,wy=v.y-v.displayHeight/2+(y+.5)*v.scaleY;
        if(wx<bounds.x+330||wx>bounds.x+bounds.width-330||wy<bounds.y+90||wy>bounds.y+bounds.height-35)continue;
        const cx=Math.floor((wx-(c.x-c.displayWidth/2))/c.scaleX),cy=Math.floor((wy-(c.y-c.displayHeight/2))/c.scaleY);
        if(cx<2||cy<2||cx>=cp.width-2||cy>=cp.height-2)continue;
        const opaque=[-2,-1,0,1,2].map(offset=>cp.data[((cy+offset)*cp.width+cx)*4+3]);
        const point={x:Math.floor(r.x+wx*unit),y:Math.floor(r.y+wy*unit)};
        if(!points.upper&&opaque.every(alpha=>alpha===0))points.upper=point;
        if(!points.lower&&opaque.every(alpha=>alpha===255))points.lower=point;
        if(points.upper&&points.lower)break;
      }
    }
    return points;
  });
  assert.ok(points.upper&&points.lower,label+': actual opaque portrait pixels cross the real alpha tabletop edge '+JSON.stringify(points));
  const shown=(await p.screenshot()).toString('base64');await p.evaluate(()=>{[...LootkeeperEngine.game.scene.getScene('Reception').views].find(([id])=>id.startsWith('visitor:'))[1].sprite.setVisible(false);});
  await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const hidden=(await p.screenshot()).toString('base64');
  await p.evaluate(()=>{[...LootkeeperEngine.game.scene.getScene('Reception').views].find(([id])=>id.startsWith('visitor:'))[1].sprite.setVisible(true);});
  const pixels=await p.evaluate(async({shown,hidden,points})=>{
    async function read(data){const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return Object.fromEntries(Object.entries(points).map(([name,p])=>[name,Array.from(ctx.getImageData(p.x,p.y,1,1).data)]));}
    return {shown:await read(shown),hidden:await read(hidden)};
  },{shown,hidden,points});
  assert.ok(pixels.shown.lower.every((value,i)=>Math.abs(value-pixels.hidden.lower[i])<=2),label+': foreground pixels hide the lower visitor');
  assert.ok(pixels.shown.upper.some((value,i)=>Math.abs(value-pixels.hidden.upper[i])>8),label+': upper visitor pixels remain visible');
}
async function fallback(p,label){
  await p.evaluate(()=>{$('game').classList.remove('phaser-ready');$('phaser-world').style.visibility='hidden';});
  try{
    const report=await p.evaluate(()=>{
      const game=$('game'),g=game.getBoundingClientRect(),unit=g.width/game.offsetWidth,b=LootkeeperEngine.bridge.current().bounds;
      const read=element=>{const r=element.getBoundingClientRect();return {x:(r.x-g.x)/unit,y:(r.y-g.y)/unit,width:r.width/unit,height:r.height/unit,loaded:element.complete&&element.naturalWidth>0};};
      return {bounds:b,day:read(document.querySelector('[data-reception-layer="guild-furnished-day"]')),counter:read(document.querySelector('[data-reception-layer="guild-furnished-counter"]')),visitor:read($('visitor'))};
    });
    const b=report.bounds,fit=Math.max(b.width/1536,b.height/1024),top=b.y+(b.height-1024*fit)/2;
    close(report.day.width,1536*fit,label+': fallback cover width',.3);close(report.day.y,top,label+': fallback cover top',.3);
    close(report.counter.y,top+COUNTER_Y*fit,label+': fallback counter+100',.3);close(report.visitor.y+report.visitor.height,top+POSE.y*fit,label+': fallback bottom anchor',.4);
    assert.ok(report.day.loaded&&report.counter.loaded&&report.visitor.loaded,label+': fallback PNGs loaded');await shot(p,label+'-fallback');
  }finally{await p.evaluate(()=>{$('game').classList.add('phaser-ready');$('phaser-world').style.removeProperty('visibility');});}
}
async function counterFoot(p,kind,label){
  await p.waitForFunction(kind=>[...LootkeeperEngine.game.scene.getScene('Reception').views].some(([id])=>id.startsWith('counter-'+kind+':')),kind);
  await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const r=await p.evaluate(kind=>{
    const s=LootkeeperEngine.game.scene.getScene('Reception'),image=[...s.views].find(([id])=>id.startsWith('counter-'+kind+':'))[1].sprite;
    const source=image.texture.getSourceImage(),canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0);const alpha=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let left=source.width,right=-1,top=source.height,bottom=-1;
    for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(alpha[(y*source.width+x)*4+3]>=16){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    const b=LootkeeperEngine.bridge.current().bounds,fit=Math.max(b.width/1536,b.height/1024),cameraTop=b.y+(b.height-1024*fit)/2;
    const worldFoot=image.y-image.displayHeight/2+(bottom+1)*image.scaleY;
    const root=$('game'),game=root.getBoundingClientRect(),unit=game.width/root.offsetWidth;
    // Hit the icon's opaque body, avoiding transparent PNG padding.
    const wx=image.x-image.displayWidth/2+(left+right+1)/2*image.scaleX,wy=image.y-image.displayHeight/2+(top+(bottom-top)*.45)*image.scaleY;
    const point={x:game.x+wx*unit,y:game.y+wy*unit},hit=document.elementFromPoint(point.x,point.y),control=$(kind),target=control.getBoundingClientRect();
    const node=control.querySelector('img'),nodeRect=node.getBoundingClientRect(),contain=Math.min(nodeRect.width/source.width,nodeRect.height/source.height);
    const domFoot=(nodeRect.y+(nodeRect.height-source.height*contain)/2+(bottom+1)*contain-game.y)/unit;
    return {sourceFoot:(worldFoot-cameraTop)/fit,worldFoot,domFoot,footInside:worldFoot>=b.y&&worldFoot<=b.y+b.height,
      targetHit:hit===control||control.contains(hit),pointInsideTarget:point.x>=target.left&&point.x<=target.right&&point.y>=target.top&&point.y<=target.bottom,
      point,hit:hit?.id||hit?.className||hit?.tagName,ancestors:hit?[...function*(node){for(;node;node=node.parentElement)yield node.id||node.tagName;}(hit)].slice(0,6):[]};
  },kind);
  close(r.sourceFoot,810,label+': visible '+kind+' alpha footprint follows source Y810',2);
  assert.ok(r.sourceFoot>735&&r.sourceFoot<844,label+': '+kind+' rests between the rear and front tabletop edges');
  close(r.domFoot,r.worldFoot,label+': native and fallback visible '+kind+' footprint agrees',.4);
  assert.ok(r.footInside&&r.pointInsideTarget&&r.targetHit,label+': visible '+kind+' and its real hit target stay on the counter '+JSON.stringify(r));
}
async function pendingParcel(p,enabled){
  await p.evaluate(enabled=>{
    if(enabled){window.__layoutSavedOffers=state.offers;state.offers=[];state.orders.push({id:2,accepted:false,customer:0,arrivalSerial:505,reward:90,recipe:[{type:6,count:1}],packed:[],reservedUids:[],assignedTo:'manual'});}
    else{state.orders=state.orders.filter(o=>o.id!==2);state.offers=window.__layoutSavedOffers;delete window.__layoutSavedOffers;}
    renderReception();
  },enabled);await scene(p,'Reception');
}
async function footprints(p){
  for(const [width,height]of [[1280,720],[1920,920],[1366,768],[1024,768],[820,850]]){
    await p.setViewportSize({width,height});await scene(p,'Reception');await light(p,1);await geometry(p,2,'s3_2',1,width+'x'+height);await shot(p,width+'x'+height);await counterFoot(p,'bag',width+'x'+height);
    await pendingParcel(p,true);await light(p,1);await counterFoot(p,'parcel',width+'x'+height);await bounded(p,width+'x'+height+' parcel');await p.waitForTimeout(430);await shot(p,width+'x'+height+'-parcel');await pendingParcel(p,false);
  }
}
async function legacy(p){
  await fixture(p);
  const direct=await p.evaluate(()=>{
    const a={visitor:5,arrivalSerial:701,price:10,loot:[{uid:7001,type:0}],extra:{keep:true}},b={visitor:6,arrivalSerial:702,price:10,loot:[{uid:7002,type:6}]};
    state.offers=[a];state.schedule=[b];state.story.deferredSupplierOffers=[a,b];const arrays=[state.offers,state.schedule,state.story.deferredSupplierOffers],loot=a.loot;
    const before=JSON.stringify({a:{...a,visitor:0},b:{...b,visitor:1}});normalizeAdventurerVisitors();
    return {same:arrays[0]===state.offers&&arrays[1]===state.schedule&&arrays[2]===state.story.deferredSupplierOffers&&state.offers[0]===a&&state.schedule[0]===b&&a.loot===loot,exact:JSON.stringify({a,b})===before};
  });assert.deepEqual(direct,{same:true,exact:true},'Retired visitor helper changes only visitor numbers in place');
  await fixture(p);await p.evaluate(()=>{
    state.offers[0].visitor=5;const loot=[makeItem(12),makeItem(18)];loot.forEach(x=>x.unknown=false);
    state.offers.push({visitor:6,arrivalSerial:502,price:10,qualityRolled:true,loot});state.story.deferredSupplierOffers=[{visitor:6,arrivalSerial:503,price:10,qualityRolled:true,loot:[makeItem(6)]}];save();
  });const before=await ledger(p),saved=await p.evaluate(()=>({offers:state.offers.map(o=>({...o,visitor:o.visitor-5})),deferred:state.story.deferredSupplierOffers.map(o=>({...o,visitor:1}))}));
  await p.reload();await p.waitForFunction(()=>LootkeeperEngine?.ready);await freeze(p);await p.locator('#loadGame').click();await scene(p,'Reception');
  assert.deepEqual(await p.evaluate(()=>({offers:state.offers,deferred:state.story.deferredSupplierOffers})),saved,'Loading old visitor5/6 preserves original offers, loot UID, serials and deferred queue');
  assert.deepEqual(await ledger(p),before,'Loading retired visitors preserves money and manual partial parcels');
  assert.ok(await p.evaluate(()=>state.offers.every(o=>o.visitor<5)),'Retired portraits never remain in the arrival queue');
}
async function realClicks(p){
  await fixture(p);const keep=await ledger(p),buy=await p.evaluate(()=>({uids:state.offers[0].loot.map(x=>x.uid),events:LootkeeperEngine.bridge.inputEvents}));
  await p.locator('#bag').click();await scene(p,'Workbench');assert.equal(await p.evaluate(()=>state.gold),keep.gold-10,'Native bag click spends ten exactly once');
  assert.deepEqual(await p.evaluate(()=>state.bag.map(x=>x.uid)),buy.uids,'Original offered items enter the workbench');assert.equal(await p.evaluate(()=>LootkeeperEngine.bridge.inputEvents),buy.events+1,'The bag click uses native input routing');
  await p.evaluate(()=>{BagPour.advance(1);BagPour.advance(1);});assert.equal(await p.evaluate(()=>BagPour.active()),false);
  assert.deepEqual((await ledger(p)).orders,keep.orders,'Buying and revealing a bag preserves the manual partial');
  await fixture(p,{offer:false});await p.evaluate(()=>{const order={id:2,accepted:false,customer:0,arrivalSerial:505,reward:90,recipe:[{type:6,count:1}],packed:[],reservedUids:[],assignedTo:'manual'};state.orders.push(order);renderReception();});await scene(p,'Reception');
  const free=await p.evaluate(()=>state.stock.find(x=>x.type===6).uid),beforeOrder=await ledger(p);
  await p.locator('#parcel').click();await p.locator('#acceptOrder').click();
  await p.locator('#orderBoard [data-order-id="2"] [data-parcel-action="manual"]').click();await scene(p,'Workbench');
  await p.locator('#shelves [data-cat="1"]').click();await p.locator('#sourceItems [data-uid="'+free+'"]').click();await p.locator('#parcelDrop').click();await p.locator('#ship').click();
  assert.equal(await p.evaluate(()=>state.gold),beforeOrder.gold+90,'Actual accepted parcel pays its real reward once');assert.deepEqual((await ledger(p)).orders,keep.orders,'Real parcel sale keeps the other manual partial and reserve');
}
async function repairs(p){
  await fixture(p,{stage:0,offer:false});const keep=await ledger(p);assert.equal(await p.evaluate(()=>Restoration.prompt()),true);await p.locator('#restoreShop').click();
  assert.equal(await p.evaluate(()=>state.gold),keep.gold-30);await p.evaluate(()=>{Restoration.advance(1.25);state.paused=true;Restoration.update();save();});
  const saved=await p.evaluate(()=>JSON.stringify(state.story.restoration));await p.evaluate(()=>Restoration.advance(10));assert.equal(await p.evaluate(()=>JSON.stringify(state.story.restoration)),saved,'Pause stops the saved morning clock');
  await p.reload();await p.waitForFunction(()=>LootkeeperEngine?.ready);await freeze(p);await p.locator('#loadGame').click();await scene(p,'Reception');assert.equal(await p.evaluate(()=>JSON.stringify(state.story.restoration)),saved,'Load retains partial morning work');
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});Restoration.advance(10);delete document.hidden;});assert.equal(await p.evaluate(()=>JSON.stringify(state.story.restoration)),saved,'Hidden time does not advance repair');
  await p.evaluate(()=>Restoration.advance(2.749));assert.equal(await p.evaluate(()=>Restoration.active()),true);close(await p.evaluate(()=>state.story.restoration.elapsed),3.999,'Repair remains active before four seconds',.00001);await shot(p,'clean-before-four-seconds');
  await p.evaluate(()=>Restoration.advance(.001));assert.deepEqual(await p.evaluate(()=>({active:Restoration.active(),day:state.day,stage:state.story.shopRestorationStage})),{active:false,day:2,stage:1});
  assert.deepEqual(await ledger(p),{...keep,gold:keep.gold-30},'Cleaning preserves source UID/partial and charges once');
  await p.evaluate(()=>{state.story.secondDayComplete=true;state.story.secondDayEndPending=true;state.story.guild={version:1,founded:true,name:'Гильдия проверки',phase:'complete'};state.offers=[];state.bag=[];render();});
  assert.equal(await p.evaluate(()=>Restoration.beginSecond()),true);const started=Date.now();await p.evaluate(()=>{last=performance.now();LootkeeperEngine.bridge.step=window.LootkeeperBridge.step;});
  await p.waitForTimeout(1350);await p.locator('#pause').click();await p.waitForTimeout(80);const paused=await p.evaluate(()=>state.story.restoration.elapsed);await p.waitForTimeout(250);close(await p.evaluate(()=>state.story.restoration.elapsed),paused,'Live frame repair pauses',.00001);
  await p.setViewportSize({width:1024,height:768});await bounded(p,'Paused morning resized');await p.locator('#resume').click();await p.waitForFunction(()=>!Restoration.active(),null,{timeout:10000});await freeze(p);
  assert.ok(Date.now()-started>=4100,'The live scene plays four active seconds plus its pause');assert.deepEqual(await p.evaluate(()=>({day:state.day,stage:state.story.shopRestorationStage})),{day:3,stage:2});
  assert.deepEqual(await ledger(p),{...keep,gold:keep.gold-30},'Furnishing has no second price and keeps original partial items');assert.equal(await p.locator('#modal').evaluate(node=>node.classList.contains('hidden')),true,'The completed furnishing is visible in this earned-guild fixture');await shot(p,'furnished-after-four-seconds');
}
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true}),errors=[];
  try{
    const context=await browser.newContext({viewport:{width:1280,height:720},reducedMotion:'reduce'}),p=await context.newPage();p.on('pageerror',error=>errors.push(error.message));await p.goto(BASE);await p.waitForFunction(()=>LootkeeperEngine?.ready,null,{timeout:60000});await freeze(p);
    if(process.argv.includes('--footprints-only')){await fixture(p);await footprints(p);assert.deepEqual(errors,[]);await context.close();console.log('PASS: visible bag/parcel footprints and real hit targets at source Y810 in all five viewports.');return;}
    assert.deepEqual(await p.evaluate(()=>adventurers.map(x=>x[2])),VISITORS,'Exactly five remaining adventurers');assert.equal(/requestAnimationFrame/.test(fs.readFileSync('dist/game.js','utf8')),false,'Simulation does not own another frame loop');
    for(let stage=0;stage<3;stage++){
      await fixture(p,{stage});const keep=await ledger(p);
      for(const night of [0,1])for(let visitor=0;visitor<5;visitor++){
        await p.evaluate(visitor=>{state.offers[0].visitor=visitor;renderReception();},visitor);await light(p,night);await geometry(p,stage,VISITORS[visitor],night,STAGES[stage]+'/'+night+'/'+VISITORS[visitor]);
        if(visitor===2){await p.waitForTimeout(420);await shot(p,STAGES[stage]+'-'+(night?'night':'day'));}
      }
      assert.deepEqual(await ledger(p),keep,'Every stage/light/visitor layout preserves money, UID, manual parcel and switches');
    }
    await fixture(p);await light(p,0);await p.waitForTimeout(450);await occlusion(p,'Furnished native alpha counter');await fallback(p,'furnished-1280');
    const keep=await ledger(p);
    await footprints(p);
    assert.deepEqual(await ledger(p),keep,'Resize keeps original item identities and manual partial');
    for(let cycle=0;cycle<3;cycle++){await p.evaluate(()=>setScreen('work','sort'));await scene(p,'Workbench');await p.evaluate(()=>setScreen('reception'));await scene(p,'Reception');await light(p,0);await geometry(p,2,'s3_2',0,'restart '+cycle);}
    await p.setViewportSize({width:1280,height:720});await legacy(p);await realClicks(p);await repairs(p);assert.deepEqual(errors,[]);await context.close();
    console.log('PASS: five approved 650/950/140 visitor poses; 3 stages x day/night with true alpha counter+100 in source cover coordinates; native/fallback occlusion, visible bag/parcel alpha footprints at source Y810 with aligned hit targets in five viewports/no scroll, three restarts, real bag/order clicks, old visitor5/6 migration preserving original UID/money/partial, saved/live four-second morning repairs and pause/resize.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
