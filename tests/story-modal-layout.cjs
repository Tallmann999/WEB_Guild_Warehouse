'use strict';
// Resize geometry must wait for the game transform, not just the scale variable.
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
async function reachable(p,selector){
  const report=await p.locator(selector).evaluate(e=>{
    const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    // The header is intentionally inert while a modal is open. Its wallet
    // remains visible above the backdrop without becoming an active control.
    const visibleWallet=e.id==='gold'&&Number(getComputedStyle(e.closest('header')).zIndex)>Number(getComputedStyle(document.getElementById('modal')).zIndex);
    return {inside:r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,hit:visibleWallet||hit===e||e.contains(hit)};
  });
  assert.deepEqual(report,{inside:true,hit:true},selector+' stays visible and receives real input');
}
async function resize(p,width,height){
  await p.setViewportSize({width,height});await p.waitForFunction(({width,height})=>{
    const r=$('game').getBoundingClientRect(),expected=Math.min(width/1280,height/800);
    return innerWidth===width&&innerHeight===height&&Math.abs(scale-expected)<.001&&Math.abs(r.width-1280*expected)<1&&r.left>=-1&&r.right<=width+1&&r.top>=-1&&r.bottom<=height+1;
  },{width,height});
}
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);
    await p.evaluate(()=>{
      state=freshState();state.started=true;state.day=2;state.gold=777;state.tutorial={active:false};
      state.story={version:1,letterRead:true,restored:true,inheritedOpened:true,firstPaid:true,firstDayFlowVersion:2,firstDayComplete:true,firstDayPurchases:2,firstDayDeliveries:2,secondDayFlowVersion:2,secondDayActive:true,secondDayPurchases:3,secondDayDeliveries:1,secondDaySorted:3,secondDaySupplyRun:0,dwarfEncounterPending:true,nextVisit:999};
      Story.afterLoad();
    });
    await p.waitForSelector('#dwarfEncounter');
    assert.match(await p.locator('.dwarf-interview-portrait').getAttribute('src'),/dwarf-borin-redhat\.png/);
    for(const [width,height] of [[1280,800],[820,850]]){
      await resize(p,width,height);for(const selector of ['#gold','#acceptDwarf','#declineDwarf'])await reachable(p,selector);
      await p.screenshot({path:'audit_source/dwarf-redhat-encounter-'+width+'.png'});
    }
    await p.locator('#acceptDwarf').click();assert.equal(await p.evaluate(()=>state.dwarf.enabled),true);
    assert.equal(await p.locator('#modal:not(.hidden)').count(),0,'Paid hire starts Borin without opening improvements');
    await p.locator('#upgradesNav').click();
    for(const [width,height] of [[1280,800],[820,850]]){
      await resize(p,width,height);for(const selector of ['#gold','#closeModal','#toggleDwarf'])await reachable(p,selector);
      await p.screenshot({path:'audit_source/dwarf-redhat-enable-'+width+'.png'});
    }
    await p.locator('#closeModal').click();
    await p.evaluate(()=>{state.day=4;state.story.completedB2=true;state.city={towerOwned:true,towerPaid:1000};state.goblin={hired:true,enabled:true};Goblin.ensure();render();Contracts.openBook();});
    for(const [width,height] of [[1280,800],[820,850]]){
      await resize(p,width,height);for(const selector of ['#gold','#closeModal','#signRegularChef','#signRegularAlchemy']){const action=p.locator(selector);await action.scrollIntoViewIfNeeded();await reachable(p,selector);}
      await p.screenshot({path:'audit_source/shop-book-wallet-'+width+'.png'});
    }
    assert.deepEqual(errors,[]);console.log('PASS: large upper-left wallet remains readable above interview, improvements and contract modals; all actions and close controls fit and receive input at1280/820.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
