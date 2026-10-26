'use strict';
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {PNG}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs');
const assert=require('node:assert/strict');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
const errors=[];
const pixel=(buffer,x,y)=>{const png=PNG.sync.read(buffer),at=(Math.round(y)*png.width+Math.round(x))*4;return [...png.data.slice(at,at+4)];};
function changedInBand(a,b,band){
  const left=PNG.sync.read(a),right=PNG.sync.read(b);let changed=0,max=0;
  const minX=Math.max(0,Math.ceil(band.x)),maxX=Math.min(left.width,Math.floor(band.x+band.width));
  const minY=Math.max(0,Math.ceil(band.y)),maxY=Math.min(left.height,Math.floor(band.y+band.height));
  for(let y=minY;y<maxY;y++)for(let x=minX;x<maxX;x++){
    const at=(y*left.width+x)*4,delta=Math.max(...[0,1,2].map(channel=>Math.abs(left.data[at+channel]-right.data[at+channel])));
    if(delta>=25)changed++;max=Math.max(max,delta);
  }
  return {changed,max};
}
async function settle(p){await p.waitForTimeout(80);}
async function fixture(p){await p.evaluate(()=>{
  cancelDrag();forceCloseModal();City.close();Tower.close('none');BagPour.clear();state=freshState();state.started=true;state.day=3;state.gold=100;state.tutorial={active:false};state.collection=items.map(x=>x.id);state.orders=[];state.order=null;state.bag=[];state.stock=[];
  state.story={letterRead:true,inheritedOpened:true,firstPaid:true,restored:true,shopRestorationStage:2,firstDayComplete:true,firstDayFlowVersion:2,firstDayPurchases:2,firstDayDeliveries:2,secondDayFlowVersion:2,secondDayActive:false,completedB2:true,nextVisit:999,dwarfEncounterSeen:true,goblinEncounterSeen:true};
  state.dwarf={hired:true,enabled:false,batches:[]};state.goblin={hired:false,enabled:false};
  LootkeeperEngine.bridge.step=()=>{};setScreen('work','sort');
});await p.waitForFunction(()=>LootkeeperEngine.stats?.scene==='Workbench');}
async function compareForeground(p,selector,band,path){
  await p.locator(selector).evaluate(el=>el.style.visibility='hidden');await settle(p);const behind=await p.screenshot();
  await p.locator(selector).evaluate(el=>el.style.visibility='visible');await settle(p);const front=await p.screenshot({path});
  const difference=changedInBand(behind,front,band);
  assert.ok(difference.changed>=8&&difference.max>=40,selector+' visibly paints above the DOM workbench: '+JSON.stringify(difference));
}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
  for(const [width,height]of [[1280,800],[1366,768]]){
    const p=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});p.on('pageerror',error=>errors.push(error.message));await p.goto(BASE);await p.waitForFunction(()=>window.LootkeeperEngine?.ready);await fixture(p);
    await p.evaluate(()=>{const x=makeItem(38);x.unknown=false;x.boxPos={x:.4,y:24};x.boxAngle=0;state.stock=[x];renderWork();openInspection(items[x.type].cat);});
    await p.waitForFunction(()=>LootkeeperEngine.stats.masks>0);await p.mouse.move(5,5);await settle(p);
    const rect=await p.locator('#inspectItems .item img').boundingBox(),before=await p.screenshot();
    await p.evaluate(()=>{const node=$('inspectItems').querySelector('.item');state.selected=Number(node.dataset.uid);node.classList.add('chosen');});await settle(p);
    const after=await p.screenshot({path:'audit_source/phaser-layers-aura-'+width+'.png'}),a=pixel(before,rect.x+rect.width/2,rect.y+rect.height/2),b=pixel(after,rect.x+rect.width/2,rect.y+rect.height/2);
    assert.ok(Math.max(...[0,1,2].map(i=>Math.abs(a[i]-b[i])))<=3,'The aura cannot recolour the item centre: '+JSON.stringify({a,b}));
    const halo=changedInBand(before,after,{x:rect.x-20,y:rect.y-20,width:rect.width+40,height:rect.height+40});
    assert.ok(halo.changed>=20&&halo.max>=25,'Gold rays are visibly painted around the item: '+JSON.stringify(halo));
    assert.equal(await p.evaluate(()=>{const scene=LootkeeperEngine.game.scene.getScene('Workbench'),entry=[...scene.views].find(([id])=>id.startsWith('loot:inspect:'))[1],container=entry.sprite.parentContainer;return entry.glow.depth<entry.sprite.depth&&container.list.indexOf(entry.glow)<container.list.indexOf(entry.sprite)&&getComputedStyle($('inspectItems').querySelector('.item'),'::after').content==='none';}),true,'The masked aura sorts below the image and the extra DOM aura is absent');
    await p.evaluate(()=>{const node=$('inspectItems').querySelector('.item');node.classList.remove('chosen');state.selected=null;node.focus();});await settle(p);
    assert.equal(await p.evaluate(()=>[...LootkeeperEngine.game.scene.getScene('Workbench').views].find(([id])=>id.startsWith('loot:inspect:'))[1].glow.visible),true,'Keyboard focus keeps its native highlight');
    for(const selector of ['#sound','#help']){
      await p.locator(selector).evaluate(node=>node.blur());await settle(p);const plain=await p.screenshot(),button=await p.locator(selector).boundingBox();
      await p.locator(selector).focus();await settle(p);const lit=await p.screenshot();
      const face=changedInBand(plain,lit,{x:button.x+4,y:button.y+4,width:button.width-8,height:button.height-8});
      assert.ok(face.max<=3,selector+' focus rays never recolour the button background or text: '+JSON.stringify(face));
      const outside=changedInBand(plain,lit,{x:button.x-24,y:button.y-24,width:button.width+48,height:button.height+48});
      assert.ok(outside.changed>=20,selector+' has visible gold rays outside its face: '+JSON.stringify(outside));
      await p.locator(selector).evaluate(node=>node.blur());
    }
    await p.evaluate(()=>{$('inspectItems').querySelector('.item').classList.add('chosen');$('help').focus();});
    await p.locator('#shelves .shelf-box:not(:disabled)').first().hover();await settle(p);
    assert.equal(await p.evaluate(()=>[...LootkeeperEngine.game.scene.getScene('Workbench').views].some(([id,entry])=>id.startsWith('shelf:')&&entry.glow?.visible&&entry.glow.depth<entry.sprite.depth)),true,'A hovered crate keeps its gold rays behind its artwork');
    await p.screenshot({path:'audit_source/phaser-golden-rays-'+width+'.png'});
    // Preserve real purchased items while the sack pours over the tabletop.
    await fixture(p);const original=await p.evaluate(()=>{
      state.bag=[38,31,32,0,6,12,18,24].map(type=>{const x=makeItem(type);x.unknown=false;return x;});BagPour.layout(state.bag);renderWork();BagPour.start(state.bag.map(x=>x.uid));BagPour.advance(.4);return {uids:owned().map(x=>x.uid),gold:state.gold};
    });await settle(p);await p.evaluate(()=>BagPour.render());await settle(p);
    const bag=await p.evaluate(()=>{
      const r=$('table').getBoundingClientRect(),img=$('bagPourScene').querySelector('img'),sack=img.getBoundingClientRect();
      return {band:{x:sack.x+sack.width*.2,y:sack.y+sack.height*.25,width:sack.width*.6,height:sack.height*.55},opacity:getComputedStyle(img).opacity,native:LootkeeperEngine.game.scene.getScene('Workbench').views.has('pour-bag'),tag:img.dataset.phaserArt};
    });assert.equal(bag.opacity,'1');assert.equal(bag.native,false);assert.equal(bag.tag,undefined);assert.ok(bag.band.width>0);
    await compareForeground(p,'#bagPourScene',bag.band,'audit_source/phaser-layers-pouring-bag-'+width+'.png');
    assert.deepEqual(await p.evaluate(()=>({uids:owned().map(x=>x.uid),gold:state.gold})),original,'Foreground art does not own or duplicate the goods');
    // The actual saved dwarf job supplies the carrier's UID and elapsed clock.
    await p.evaluate(()=>{BagPour.clear();state.selected=null;state.dwarf.enabled=true;Dwarf.onBagPurchased(state.bag);Dwarf.advance(.01);});
    const carrier=await p.evaluate(()=>{
      const frame=$('table').getBoundingClientRect();let chosen;
      for(const fraction of [.36,.44,.52,.6,.68,.76,.84]){
        state.dwarf.job.elapsed=2.5*fraction;Dwarf.updateVisual();const r=$('dwarfCarrier').getBoundingClientRect();
        if(r.top<frame.top&&r.bottom>frame.top+8){chosen={x:Math.max(r.left,frame.left),y:frame.top,width:Math.min(r.right,frame.right)-Math.max(r.left,frame.left),height:Math.max(3,parseFloat(getComputedStyle($('table')).borderTopWidth)*scale)};break;}
      }
      if(!chosen)throw Error('No real carry position crosses the table border');
      return {band:chosen,uid:state.dwarf.job.uid,clock:state.dwarf.job.elapsed,gold:state.gold,owned:owned().map(x=>x.uid)};
    });await settle(p);
    assert.equal(await p.evaluate(()=>{const carrier=$('dwarfCarrier'),img=carrier.querySelector('.dwarf-carrier-body');return Number(carrier.dataset.uid)===state.dwarf.job.uid&&getComputedStyle(img).opacity==='1'&&!img.dataset.phaserArt&&!LootkeeperEngine.game.scene.getScene('Workbench').views.has('borin-carrier');}),true,'Only one foreground Borin carries the actual job UID');
    await compareForeground(p,'#dwarfCarrier',carrier.band,'audit_source/phaser-layers-borin-'+width+'.png');
    assert.deepEqual(await p.evaluate(()=>({uid:state.dwarf.job.uid,clock:state.dwarf.job.elapsed,gold:state.gold,owned:owned().map(x=>x.uid)})),{uid:carrier.uid,clock:carrier.clock,gold:carrier.gold,owned:carrier.owned});
    await p.close();
  }
  assert.deepEqual(errors,[]);console.log('PASS: gold rays appear behind items, hovered crates and focused header/footer buttons without changing opaque item pixels or button faces; pouring sack paints above the tabletop and saved-clock Borin crosses DOM table borders at1280/1366, with original UID/money preserved.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
