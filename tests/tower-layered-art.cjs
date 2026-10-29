'use strict';
// A private Edge context owns every fixture and save used by this visual check.
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
const SIZES=process.env.TOWER_ART_SIZES?process.env.TOWER_ART_SIZES.split(',').map(size=>size.split('x').map(Number)):[[1920,920],[1366,768],[1280,720],[1024,768],[820,850]];
const KEYS={room:'environment.tower',workbench:'prop.tower-workbench',mechanism:'prop.tower-mechanism',orb:'prop.tower-orb'};
const errors=[];

async function scene(p,key){await p.waitForFunction(key=>LootkeeperEngine.stats?.scene===key,key);}
async function ledger(p){return p.evaluate(()=>({
  gold:state.gold,ids:owned().map(x=>x.uid).sort((a,b)=>a-b),
  orders:state.orders.map(o=>({id:o.id,packed:o.packed.map(x=>x.uid),reserved:o.reservedUids.slice(),reward:o.reward})),
  dwarf:state.dwarf.enabled,goblin:state.goblin.enabled,towerOwned:state.city.towerOwned,towerPaid:state.city.towerPaid
}));}
async function fixture(p){await p.evaluate(()=>{
  forceCloseModal();Tower.close('none');City.close();BagPour.clear();cancelDrag();state=freshState();
  state.started=true;state.screen='reception';state.mode='sort';state.day=3;state.gold=863;
  state.tutorial={active:false};state.collection=items.map(x=>x.id);state.stock=[];state.bag=[];state.offers=[];state.unknownTray=[];
  state.orderUid=1;const packed=makeItem(0),reserved=makeItem(0),free=makeItem(38);
  packed.unknown=reserved.unknown=free.unknown=false;state.stock.push(reserved,free);
  const partial={id:1,accepted:true,customer:4,reward:90,title:'Ручная частичная посылка',recipe:[{type:0,count:2}],packed:[packed],reservedUids:[reserved.uid],assignedTo:'manual'};
  state.orders=[partial];state.order=partial;
  state.story={version:1,letterRead:true,inheritedOpened:true,firstPaid:true,restored:true,shopRestorationStage:2,
    firstDayComplete:true,firstDayFlowVersion:2,firstDayPurchases:2,firstDayDeliveries:2,secondDayFlowVersion:2,
    secondDayActive:false,completedB2:true,completedB3:true,elapsed:30,nextVisit:999,
    dwarfEncounterSeen:true,goblinEncounterSeen:true,regularContracts:{},guild:{founded:true,name:'Проверка башни',phase:'complete'}};
  state.dwarf={hired:true,enabled:false,batches:[]};state.goblin={hired:true,enabled:false,deliveries:1};
  state.city={accessVersion:2,mapUnlocked:true,guildTowerOfferUnlocked:true,towerNoticeSeen:true,towerOwned:true,towerPaid:1000};
  Story.ensure();Dwarf.ensure();Goblin.ensure();Contracts.ensure();Goblin.reconcile();
  LootkeeperEngine.bridge.step=()=>{};render();save();
});}
async function shot(p,label){
  const path='audit_source/tower-mage-20261028-'+label+'.png';
  try{await p.screenshot({path});}
  catch(error){
    if(error.code!=='UNKNOWN'&&error.errno!==-4094)throw error;
    const alternate=path.replace(/\.png$/,'-rerun-'+Date.now()+'.png');await p.screenshot({path:alternate});
    console.log('Screenshot saved separately because Windows locked the prior PNG: '+alternate);
  }
}
async function fallbackSmoke(p){
  await p.evaluate(()=>{$('game').classList.remove('phaser-ready');$('phaser-world').style.visibility='hidden';});
  try{
    const fallback=await p.locator('#towerArt [data-tower-layer]').evaluateAll(images=>images.map(image=>({
      id:image.dataset.towerLayer,complete:image.complete&&image.naturalWidth>0,opacity:Number(getComputedStyle(image).opacity),
      width:image.getBoundingClientRect().width,height:image.getBoundingClientRect().height
    })));
    assert.deepEqual(fallback.map(x=>x.id).sort(),['mechanism','orb','room','workbench']);
    assert.ok(fallback.every(x=>x.complete&&x.opacity===1&&x.width>0&&x.height>0),'DOM fallback shows all four actual PNG layers');
    for(const selector of ['#towerClose','#towerReturnShop']){
      const control=await p.locator(selector).evaluate(element=>{const r=element.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===element||element.contains(hit);});
      assert.equal(control,true,'Fallback return control remains directly hittable: '+selector);
    }
    await shot(p,'fallback-1280x720');
  }finally{
    await p.evaluate(()=>{$('game').classList.add('phaser-ready');$('phaser-world').style.removeProperty('visibility');});
  }
}
async function inspect(p,label){
  // A resize changes the logical game frame, then its ResizeObserver updates
  // the fallback. Wait for actual geometry, rather than assume one wall timer.
  await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const settlingAt=Date.now();
  try{await p.waitForFunction(keys=>{
    const scene=LootkeeperEngine.game.scene.getScenes(true).find(s=>s.scene.key==='Tower'),game=$('game'),g=game.getBoundingClientRect(),unit=g.width/game.offsetWidth;
    return Object.entries(keys).every(([name,key])=>{
      const image=scene?.children.list.find(child=>child instanceof Phaser.GameObjects.Image&&child.texture.key===key),fallback=document.querySelector('[data-tower-layer="'+name+'"]');
      if(!image||!fallback)return false;const a=image.getBounds(),b=fallback.getBoundingClientRect();
      return Math.abs(a.x-(b.x-g.x)/unit)<2&&Math.abs(a.y-(b.y-g.y)/unit)<2&&Math.abs(a.width-b.width/unit)<2&&Math.abs(a.height-b.height/unit)<2;
    });
  },KEYS,{timeout:3000});}catch(error){if(error.name!=='TimeoutError')throw error;}
  if(Date.now()-settlingAt>500)console.log('Geometry settling '+label+': '+(Date.now()-settlingAt)+'ms');
  const report=await p.evaluate(keys=>{
    const native=LootkeeperEngine.game.scene.getScenes(true).find(s=>s.scene.key==='Tower');
    const game=$('game'),gameRect=game.getBoundingClientRect(),unit=gameRect.width/game.offsetWidth;
    const logicalRect=element=>{const r=element.getBoundingClientRect();return {x:(r.x-gameRect.x)/unit,y:(r.y-gameRect.y)/unit,width:r.width/unit,height:r.height/unit};};
    const effectiveOpacity=element=>{let opacity=1;for(let node=element;node;node=node.parentElement)opacity*=Number(getComputedStyle(node).opacity);return opacity;};
    const alphaCache=window.__towerAlphaCache??={};
    const result={bounds:LootkeeperEngine.bridge.current().bounds,heading:logicalRect(document.querySelector('.tower-heading')),
      caption:logicalRect(document.querySelector('.tower-visit-caption')),layers:{},failures:LootkeeperEngine.failures,
      canvas:document.querySelectorAll('#phaser-world canvas').length,
      viewport:{width:innerWidth,height:innerHeight,docWidth:document.documentElement.scrollWidth,docHeight:document.documentElement.scrollHeight,bodyWidth:document.body.scrollWidth,bodyHeight:document.body.scrollHeight,scrollX,scrollY},
      layout:!!window.LootkeeperTowerArt};
    for(const [name,key]of Object.entries(keys)){
      const images=native.children.list.filter(child=>child instanceof Phaser.GameObjects.Image&&child.texture.key===key);
      const fallback=document.querySelector('[data-tower-layer="'+name+'"]');
      if(images.length!==1){result.layers[name]={count:images.length};continue;}
      const image=images[0],source=image.texture.getSourceImage(),r=image.getBounds();
      if(!alphaCache[key]){
        const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
        const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0);
        const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
        let minX=canvas.width,minY=canvas.height,maxX=-1,maxY=-1,transparent=0;
        for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
          const alpha=pixels[(y*canvas.width+x)*4+3];if(alpha===0)transparent++;
          if(alpha>=16){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
        }
        alphaCache[key]={x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1,transparent:transparent/(canvas.width*canvas.height)};
      }
      const a=alphaCache[key],sx=image.displayWidth/source.width,sy=image.displayHeight/source.height;
      result.layers[name]={count:1,key,depth:image.depth,alpha:image.alpha,scaleX:image.scaleX,scaleY:image.scaleY,
        width:image.displayWidth,height:image.displayHeight,sourceWidth:source.width,sourceHeight:source.height,
        rect:{x:r.x,y:r.y,width:r.width,height:r.height},opaque:{x:r.x+a.x*sx,y:r.y+a.y*sy,width:a.width*sx,height:a.height*sy},transparent:a.transparent,
        fallback:!!fallback&&{complete:fallback.complete&&fallback.naturalWidth>0,opacity:effectiveOpacity(fallback),rect:logicalRect(fallback)}};
    }
    return result;
  },KEYS);
  assert.equal(report.canvas,1,label+': exactly one world canvas');assert.deepEqual(report.failures,[],label+': no native renderer failures');
  assert.equal(report.layout,true,label+': native and fallback use a shared layout');
  const v=report.viewport;
  assert.ok(v.docWidth<=v.width+1&&v.bodyWidth<=v.width+1&&v.docHeight<=v.height+1&&v.bodyHeight<=v.height+1,label+': no page scroll '+JSON.stringify(v));
  assert.equal(v.scrollX,0);assert.equal(v.scrollY,0);
  for(const [name,layer]of Object.entries(report.layers)){
    assert.equal(layer.count,1,label+': one native '+name+' image');
    assert.equal(layer.alpha,1,label+': layer opacity preserves its generated colors');
    assert.ok(layer.width>60&&layer.height>35,label+': useful '+name+' size');
    assert.ok(Math.abs(layer.scaleX-layer.scaleY)<.0001,label+': '+name+' is not stretched');
    assert.ok(layer.fallback?.complete,label+': '+name+' DOM fallback image loaded');
    assert.equal(Number(layer.fallback.opacity),0,label+': '+name+' fallback does not duplicate Phaser art');
    for(const dimension of ['x','y','width','height'])assert.ok(Math.abs(layer.rect[dimension]-layer.fallback.rect[dimension])<2,label+': '+name+' native/fallback '+dimension+' agree '+JSON.stringify({native:layer.rect,fallback:layer.fallback.rect,bounds:report.bounds}));
    if(name!=='room')assert.ok(layer.transparent>.02,label+': '+name+' contains actual transparent pixels');
  }
  const {room,workbench,mechanism,orb}=report.layers;
  assert.ok(room.depth<workbench.depth&&workbench.depth<mechanism.depth&&mechanism.depth<orb.depth,label+': independent ordered room/table/mechanism/orb layers');
  const b=report.bounds;
  for(const name of ['mechanism','orb']){
    const r=report.layers[name].opaque;
    assert.ok(r.x>=b.x-1&&r.x+r.width<=b.x+b.width+1&&r.y>=b.y-1&&r.y+r.height<=b.y+b.height+1,label+': '+name+' stays inside the tower '+JSON.stringify({r,b}));
    assert.ok(r.y>=report.heading.y+report.heading.height-1,label+': '+name+' is clear of the heading');
    assert.ok(r.y+r.height<=report.caption.y+1,label+': '+name+' is clear of the return caption');
  }
  assert.ok(mechanism.opaque.x+mechanism.opaque.width/2<orb.opaque.x+orb.opaque.width/2,label+': mechanism remains left of the separate orb');
  return report;
}

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    for(const [width,height]of SIZES){
      const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),p=await context.newPage();
      p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);await p.waitForFunction(()=>window.LootkeeperEngine?.ready&&!!$('towerInterior'));
      await fixture(p);const keep=await ledger(p),label=width+'x'+height;
      await p.locator('#cityNav').click();await scene(p,'City');await p.locator('#cityEnterTower').click();await scene(p,'Tower');
      await inspect(p,label);assert.deepEqual(await ledger(p),keep,label+': entry preserves money, ownership and partial UID');
      await shot(p,label);
      if(width===1280){await fallbackSmoke(p);await inspect(p,label+' after fallback');assert.deepEqual(await ledger(p),keep,'Fallback rendering preserves the ledger');}
      if(width===1920){
        await p.setViewportSize({width:1280,height:720});await p.waitForTimeout(100);await inspect(p,label+' resized');assert.deepEqual(await ledger(p),keep,'Resize preserves real partial parcels');
        await p.setViewportSize({width,height});await p.waitForTimeout(100);await inspect(p,label+' restored');
      }
      await p.evaluate(()=>save());await p.reload();await p.waitForFunction(()=>window.LootkeeperEngine?.ready);await p.locator('#loadGame').click();await scene(p,'Tower');
      await p.evaluate(()=>{LootkeeperEngine.bridge.step=()=>{};});await inspect(p,label+' loaded');assert.deepEqual(await ledger(p),keep,label+': load preserves money, tower and partial UID');
      for(let cycle=0;cycle<3;cycle++){
        await p.locator('#towerClose').click();await scene(p,'City');await p.locator('#cityOpenTower').click();await scene(p,'Tower');
        await inspect(p,label+' restart '+cycle);assert.deepEqual(await ledger(p),keep,label+': repeated entry preserves ledger');
      }
      await p.locator('#towerReturnShop').click();await scene(p,'Reception');assert.equal(await p.evaluate(()=>City.isOpen()),false);assert.deepEqual(await ledger(p),keep,label+': shop return preserves ledger');
      await context.close();
      console.log('Checked tower layers, returns and saved partial at '+label);
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: layered mage tower at '+SIZES.map(size=>size.join('x')).join('/')+'; four native images, true alpha, shared proportional fallback geometry and clear UI, no page scroll, resize/load/three restarts, original money/ownership/manual partial UID and both returns.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
