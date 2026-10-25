'use strict';
// User-facing first purchases, active-time presentation and the 3:1 visitor
// second day. Inventory actions below click actual exposed item buttons.
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const BASE=process.env.STORY_TEST_URL||'http://127.0.0.1:18765/';
const errors=[];
const ids=p=>p.evaluate(()=>owned().map(x=>x.uid).sort((a,b)=>a-b));
async function waitPour(p){await p.waitForFunction(()=>!BagPour.active());}
async function step(p,seconds){await p.evaluate(seconds=>{Story.advance(seconds);render();save();},seconds);}
async function waitGuest(p){
  for(let i=0;i<24;i++){
    if(await p.evaluate(()=>!!Contracts.activeOffer())){await p.evaluate(()=>setScreen('reception'));await p.locator('#laterContractOffer').click();}
    if(await p.evaluate(()=>!!counterGuest()))return;
    await step(p,.5);
  }
  throw Error('No next visitor after twelve active seconds');
}
async function recognise(p){
  await p.waitForSelector('#dirt');
  const before=await p.evaluate(()=>state.gold);
  await p.evaluate(()=>{for(let i=0;i<80&&!$('cleanKey').disabled;i++)$('cleanKey').click();});
  assert.equal(await p.locator('#cleanKey').textContent(),'Распознано');
  assert.equal(await p.evaluate(()=>state.gold),before+12,'Recognition pays once before its presentation finishes');
  return before+12;
}
async function sortBag(p,{testRecognition=false}={}){
  await waitPour(p);
  for(let safe=0;safe<40&&await p.evaluate(()=>state.bag.length);safe++){
    const target=await p.evaluate(()=>{
      for(const e of document.querySelectorAll('#pile .item')){
        const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
        if(document.elementFromPoint(x,y)?.closest('.item')!==e)continue;
        const item=state.bag.find(v=>v.uid===Number(e.dataset.uid));
        return {uid:item.uid,cat:items[item.type].cat,unknown:isUnknown(item),x,y};
      }
      throw Error('No real exposed item remains on the table');
    });
    await p.mouse.click(target.x,target.y);
    if(target.unknown){
      const expectedGold=await recognise(p),start=Date.now();
      if(testRecognition){
        await p.waitForTimeout(700);
        assert.equal(await p.locator('#modal:not(.hidden)').isVisible(),true,'The result stays readable before 1.5 seconds');
      }
      await p.waitForSelector('#modal.hidden',{state:'attached',timeout:5000});
      if(testRecognition){
        const elapsed=Date.now()-start;
        assert.ok(elapsed>=1250&&elapsed<3000,'Recognition automatically closes around1.5 seconds: '+elapsed);
      }
      assert.equal(await p.evaluate(()=>state.gold),expectedGold,'Automatic close never repeats the recognition payout');
      await p.locator('#pile [data-uid="'+target.uid+'"]').click();
    }
    assert.equal(await p.evaluate(()=>drag?.uid),target.uid,'The actual item button is reachable');
    await p.locator('#shelves [data-cat="'+target.cat+'"]').click();
    assert.equal(await p.evaluate(uid=>state.bag.some(v=>v.uid===uid),target.uid),false);
  }
  assert.equal(await p.evaluate(()=>state.bag.length),0);
}
async function buy(p){
  await p.evaluate(()=>setScreen('reception'));
  const before=await p.evaluate(()=>state.gold),goods=await p.evaluate(()=>counterGuest().value.loot.map(x=>x.uid));
  await p.locator('#buyBag').click();
  assert.equal(await p.evaluate(()=>state.gold),before-10,'Every supply costs ten, including the opening one');
  await waitPour(p);
  assert.deepEqual(await p.evaluate(()=>state.bag.map(x=>x.uid)),goods,'The poured pile contains exactly the purchased instances');
  assert.ok(await p.evaluate(()=>state.bag.filter(isUnknown).length)<=1,'A real purchased bag creates at most one study interruption');
  if(await p.evaluate(()=>state.day>=2))assert.equal(await p.evaluate(()=>state.bag.filter(x=>items[x.type].cat===0).length),4,'Each actual day2 supply contains four trophies');
  return goods;
}
async function sell(p){
  await p.evaluate(()=>setScreen('reception'));await p.locator('#receptionOrder').click();
  const order=await p.evaluate(()=>({id:state.order.id,reward:state.order.reward}));
  await p.locator('#acceptOrder').click();await p.locator('#orderBoard [data-order-id="'+order.id+'"]').click();
  const sold=[];
  for(let safe=0;safe<30&&!await p.evaluate(()=>orderComplete());safe++){
    const target=await p.evaluate(()=>{
      const r=state.order.recipe.find(r=>remaining(r)>0);
      const x=state.stock.find(x=>x.type===r.type&&!isUnknown(x)&&Goblin.canUse(x.uid,state.order.id));
      if(!x)throw Error('Unfulfillable real parcel '+JSON.stringify(r));
      return {uid:x.uid,cat:items[x.type].cat};
    });
    await p.locator('#shelves [data-cat="'+target.cat+'"]').click();await p.locator('#tidySource').click();
    const e=p.locator('#sourceItems [data-uid="'+target.uid+'"]');await e.scrollIntoViewIfNeeded();await e.click();
    assert.equal(await p.evaluate(()=>drag?.uid),target.uid);await p.locator('#parcelDrop').click();sold.push(target.uid);
  }
  assert.equal(await p.evaluate(()=>orderComplete()),true);
  const before=await p.evaluate(()=>state.gold);await p.locator('#ship').click();
  assert.equal(await p.evaluate(()=>state.gold),before+order.reward,'Parcel pays its displayed price once');
  assert.equal(await p.evaluate(id=>allOrders().some(o=>o.id===id),order.id),false);
  return sold;
}
async function firstDay(p){
  await p.locator('#startGame').click();assert.doesNotMatch(await p.locator('#inheritanceLetter').textContent(),/уже оплачен|80 монет/);
  await p.locator('#acceptInheritance').click();await buy(p);await sortBag(p);await waitGuest(p);await sell(p);
  await waitGuest(p);await buy(p);await sortBag(p);await waitGuest(p);await sell(p);
  await p.waitForSelector('#restoreShop');await p.locator('#restoreShop').click();
  await p.waitForFunction(()=>state.day===2&&!Restoration.active(),{},{timeout:10000});
  assert.equal(await p.evaluate(()=>state.gold),142,'Two paid purchases, recognition, sales and repair balance exactly');
}
async function restoreSnapshot(p,snapshot){
  await p.evaluate(snapshot=>{cancelDrag();forceCloseModal();BagPour.clear();state=JSON.parse(JSON.stringify(snapshot));save();},snapshot);
  await p.reload();await p.locator('#loadGame').click();
}
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    for(const [width,height] of [[1280,800],[820,850]]){
      const p=await browser.newPage({viewport:{width,height}});p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);
      await p.locator('#startGame').click();await p.locator('#acceptInheritance').click();
      const wallet=await p.locator('#gold').evaluate(e=>{const r=e.getBoundingClientRect(),g=document.getElementById('game').getBoundingClientRect();return {left:r.left,top:r.top,gameLeft:g.left,gameTop:g.top,font:parseFloat(getComputedStyle(e).fontSize)};});
      assert.ok(wallet.left>=wallet.gameLeft&&wallet.left<wallet.gameLeft+200*width/1280,'Money is in the upper-left corner');
      assert.ok(wallet.top-wallet.gameTop<90*width/1280,'Money stays in the header');assert.ok(wallet.font>=69,'Coin digits are three times the previous23px');
      assert.equal(await p.locator('header .brand').count(),0,'The guild heading is removed');
      await p.locator('#buyBag').click();assert.equal(await p.evaluate(()=>state.gold),70);
      const debit=p.locator('.wallet-change.spending');await debit.waitFor();assert.equal(await debit.textContent(),'−10');
      const debitColour=await debit.evaluate(e=>getComputedStyle(e).color.match(/\d+/g).slice(0,3).map(Number));
      assert.ok(debitColour[0]>debitColour[1]&&debitColour[0]>debitColour[2],'The ten-coin expense is shown in red');
      assert.equal(await p.evaluate(()=>BagPour.active()),true,'Buying starts a visible pour');
      await p.waitForSelector('#bagPourScene .bag-pour-sack img');
      const purchaseIds=await ids(p),purchaseGold=await p.evaluate(()=>state.gold);
      await p.locator('#settings').click();const frozen=await p.evaluate(()=>BagPour.active());
      await p.waitForTimeout(1700);assert.equal(await p.evaluate(()=>BagPour.active()),frozen,'Settings stop the pour');
      assert.deepEqual(await ids(p),purchaseIds);assert.equal(await p.evaluate(()=>state.gold),purchaseGold);
      if(width===820){
        await p.reload();await p.locator('#loadGame').click();
        assert.equal(await p.evaluate(()=>BagPour.active()),false,'Reload settles a paid pour without replaying the purchase');
        assert.deepEqual(await ids(p),purchaseIds,'Loading mid-pour preserves every original instance');assert.equal(await p.evaluate(()=>state.gold),purchaseGold,'Loading mid-pour never charges again');
      }else await p.locator('#resumeSettings').click();
      await waitPour(p);
      assert.equal(await p.locator('#bagPourScene').count(),0,'The sack disappears when pouring finishes');
      const layout=await p.evaluate(()=>{
        const pile=$('pile').getBoundingClientRect();return [...$('pile').querySelectorAll('.item')].map(e=>{
          const r=e.getBoundingClientRect();return {inside:r.x>=pile.x-1&&r.right<=pile.right+1&&r.y>=pile.y-1&&r.bottom<=pile.bottom+1,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.item')===e,pos:state.bag.find(v=>v.uid===Number(e.dataset.uid)).tablePos};
        });
      });
      assert.equal(layout.length,8);assert.ok(layout.every(v=>v.inside&&v.hit),'Every scattered original has a real reachable centre');
      assert.ok(new Set(layout.map(v=>v.pos.y.toFixed(3))).size>2,'The landing positions are not two straight grid rows');
      await sortBag(p,{testRecognition:true});
      assert.equal(await p.evaluate(()=>!!counterGuest()),false,'No visitor appears while the last object is being put away');
      await p.waitForTimeout(900);assert.equal(await p.evaluate(()=>!!counterGuest()),false,'There is a full two-second break after sorting');
      await p.waitForFunction(()=>counterGuest()?.kind==='order',{},{timeout:4500});
      assert.deepEqual(errors,[]);await p.close();
      console.log('PASS '+width+': paid first purchase, pausable visible pour, scattered clickable original items, upper-left large wallet, automatic1.5s recognition and2s visitor pause.');
    }

    const p=await browser.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);await firstDay(p);
    const secondDayIds=new Set(await ids(p));let purchases=0,sales=0;
    for(let supply=0;supply<3;supply++){
      await waitGuest(p);assert.equal(await p.evaluate(()=>counterGuest().kind),'bag');
      for(const uid of await buy(p))secondDayIds.add(uid);purchases++;await sortBag(p);await waitGuest(p);
      assert.equal(await p.evaluate(()=>counterGuest().kind),supply===2?'order':'bag','Three paid suppliers precede one buyer');
    }
    for(const uid of await sell(p))secondDayIds.delete(uid);sales++;
    await p.waitForSelector('#dwarfEncounter');assert.equal(await p.evaluate(()=>state.day),2);
    assert.equal(purchases,3);assert.equal(sales,1);assert.equal(await p.evaluate(()=>state.dwarf?.hired||false),false);
    const encounter=await p.evaluate(()=>JSON.parse(JSON.stringify(state))),beforeHire=encounter.gold;
    await p.reload();await p.locator('#loadGame').click();await p.waitForSelector('#dwarfEncounter');
    assert.equal(await p.evaluate(()=>state.gold),beforeHire,'An unanswered encounter survives save/load without a fee');
    await p.locator('#acceptDwarf').click();assert.equal(await p.evaluate(()=>state.dwarf.hired),true);assert.equal(await p.evaluate(()=>state.dwarf.enabled),true,'Paid Borin hire immediately enables work');
    assert.equal(await p.evaluate(()=>state.gold),beforeHire-120);assert.equal(await p.locator('#modal').evaluate(e=>e.classList.contains('hidden')),true,'Hiring does not open upgrades');
    assert.equal(await p.evaluate(()=>Dwarf.hire()),false);assert.equal(await p.evaluate(()=>state.gold),beforeHire-120,'Repeated hire never charges twice');
    await waitGuest(p);await buy(p);const workerBefore=await p.evaluate(()=>state.dwarf.sorted+state.dwarf.routedUnknown);await p.waitForFunction(n=>state.dwarf.sorted+state.dwarf.routedUnknown>n,workerBefore,{timeout:5000});
    assert.equal(await p.evaluate(()=>state.dwarf.feesPaid),1,'The first genuine auto-work batch pays its commission once');
    await p.locator('#settings').click();await p.locator('#resumeSettings').click();
    await restoreSnapshot(p,encounter);await p.waitForSelector('#dwarfEncounter');await p.locator('#declineDwarf').click();
    assert.equal(await p.evaluate(()=>state.dwarf?.hired||false),false);assert.equal(await p.evaluate(()=>state.gold),beforeHire);await p.waitForSelector('#hireDwarf');assert.equal(await p.locator('#hireDwarf').isEnabled(),true,'Refusal leaves a later hire in Improvements');
    await p.locator('#closeModal').click();await p.reload();await p.locator('#loadGame').click();assert.equal(await p.locator('#dwarfEncounter').count(),0,'A refused visitor does not repeat after loading');
    for(let supply=0;supply<3;supply++){await waitGuest(p);assert.equal(await p.evaluate(()=>counterGuest().kind),'bag');for(const uid of await buy(p))secondDayIds.add(uid);purchases++;await sortBag(p);}
    await waitGuest(p);assert.equal(await p.evaluate(()=>counterGuest().kind),'order');for(const uid of await sell(p))secondDayIds.delete(uid);sales++;
    await p.waitForSelector('#finishSecondDay');assert.equal(purchases,6);assert.equal(sales,2);assert.equal(await p.evaluate(()=>state.day),2);
    assert.equal(await p.evaluate(()=>state.story.secondDayPurchases),6);assert.equal(await p.evaluate(()=>state.story.secondDayDeliveries),2);assert.equal(await p.evaluate(()=>visitorQueue().length),0,'No extra supplier or customer appears on day2');
    const endGold=await p.evaluate(()=>state.gold);await p.waitForTimeout(2500);assert.equal(await p.evaluate(()=>state.gold),endGold);assert.equal(await p.evaluate(()=>visitorQueue().length),0);
    assert.deepEqual(await ids(p),[...secondDayIds].sort((a,b)=>a-b),'Six genuine paid supplies and two sales preserve every unsold instance');
    await p.locator('#startThirdDay').click();await p.waitForFunction(()=>state.day===3&&!Restoration.active(),{},{timeout:15000});assert.equal(await p.evaluate(()=>state.story.shopRestorationStage),2);assert.deepEqual(errors,[]);
    console.log('PASS: day2 has six real paid suppliers and two buyers; Borin after firstsale, immediate enabled work without modal, persistent decline, one hire/batch fee and conserved inventory.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
