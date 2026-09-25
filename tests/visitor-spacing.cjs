const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('file:///'+path.resolve('dist/index.html').replaceAll('\\','/'));
 const result=await p.evaluate(()=>{
  state=freshState();state.started=true;state.gold=500;state.collection=items.map(x=>x.id);planDay();state.seconds=0;tickArrivals();
  if(visitorQueue().length!==1)throw Error('Overdue guests arrived together');
  buyBag();const gap=state.visitorCooldown;if(gap<5||gap>10)throw Error('Bag gap outside 5–10 seconds');
  advanceVisitorGap(gap-1);tickArrivals();if(counterGuest())throw Error('Guest before bag cooldown');
  advanceVisitorGap(1);tickArrivals();if(!counterGuest()||!state.bag.length)throw Error('No guest while sorting');
  for(let i=0;i<10;i++)tickArrivals();if(visitorQueue().length!==1)throw Error('Queue grew behind waiting guest');
  // Legacy queues are kept, but their next guest stays out of sight during the gap.
  const old={visitor:1,loot:[makeItem(24)],price:10,qualityRolled:true,arrivalSerial:999};state.offers.push(old);startVisitorGap();
  if(counterGuest())throw Error('Legacy queue bypassed cooldown');advanceVisitorGap(10);if(!counterGuest())throw Error('Lost legacy visitor');
  // Readiness shortens a long bag delay without restarting an almost finished timer.
  state.offers=[];state.orders=[];state.order=null;state.visitorCooldown=10;state.visitorGapPending=true;state.visitorIdleReady=false;state.bag=[];
  advanceVisitorGap(0);if(state.visitorCooldown<5||state.visitorCooldown>7)throw Error('Empty table gap outside 5–7');
  state.visitorCooldown=1;state.visitorIdleReady=false;advanceVisitorGap(0);if(state.visitorCooldown!==1)throw Error('Readiness extended wait');
  state.bag=[makeItem(24)];state.screen='reception';state.visitorCooldown=10;state.visitorIdleReady=false;advanceVisitorGap(0);if(state.visitorCooldown>7)throw Error('Reception wait not shortened');
  state.screen='work';const gaps=new Set();for(let i=0;i<50;i++){startVisitorGap();gaps.add(state.visitorCooldown);}if(gaps.size<2)throw Error('Gaps are not randomized');
  // A far-future timetable must not impose another long wait after servicing.
  state=freshState();state.started=true;state.gold=500;planDay();state.seconds=0;tickArrivals();buyBag();state.schedule[0].at=999;state.orderSchedule=[1000];
  advanceVisitorGap(10);tickArrivals();if(!counterGuest())throw Error('Timetable blocked service gap');
  // If no known ingredients can fulfil an early order, bring supplies instead.
  state=freshState();state.started=true;state.gold=500;planDay();state.seconds=178;tickArrivals();buyBag();state.bag=[];
  advanceVisitorGap(10);tickArrivals();if(counterGuest()?.kind!=='bag')throw Error('Unfulfillable order blocked next bag');
  const results=[];
  for(let day=1;day<=2;day++){
   state=freshState();state.started=true;state.gold=500;state.day=day;state.collection=items.map(x=>x.id);planDay();let accepted=0,lastService=-1000,minGap=0;
   for(let t=0;t<650;t++){
    state.seconds=Math.max(0,CONFIG.daySeconds-t);advanceVisitorGap(1);tickArrivals();advanceReadyVisitor(1);
    const head=counterGuest();
    if(visitorQueue().length>1)throw Error('Guests accumulated in queue');
    if(head){if(t-lastService<minGap)throw Error('Guests spaced too closely');if(lastService>=0&&t-lastService>10)throw Error('Wait too long');lastService=t;minGap=head.kind==='order'?3:5;
     setScreen('reception');if(head.kind==='bag'){buyBag();state.stock.push(...state.bag);state.bag=[];}
     else{openOrder(head.value);document.getElementById('acceptOrder').click();if(!head.value.accepted||state.visitorCooldown!==3)throw Error('Acceptance or 3-second pause failed');accepted++;}
    }
    for(const o of [...allOrders()])if(o.accepted&&o.recipe.every(r=>state.stock.filter(x=>x.type===r.type).length>=r.count)){
     state.order=o;setScreen('work','order');for(const r of o.recipe)while(remaining(r))packItem(state.stock.find(x=>x.type===r.type).uid);finishOrder();
    }
    if(!state.schedule.length&&!state.orderSchedule.length&&!visitorQueue().length&&!allOrders().length){results.push({day,bags:state.dayBought,accepted});break;}
   }
  }
  return results;
 });assert.deepEqual(result,[{day:1,bags:7,accepted:3},{day:2,bags:7,accepted:3}]);
 // Accepted leaflets open the exact parcel directly, including partially packed items.
 await p.evaluate(()=>{state=freshState();state.started=true;state.orders=[1,2].map(id=>({id,accepted:true,customer:0,recipe:[{type:24,count:2}],packed:[makeItem(24)],reward:20}));state.order=state.orders[0];setScreen('work','sort');});
 await p.locator('#orderBoard [data-order-id="2"]').click();assert.equal(await p.evaluate(()=>state.order.id),2);assert.equal(await p.evaluate(()=>state.mode),'order');assert.equal(await p.locator('#modal').isVisible(),false);assert.equal(await p.locator('#packedItems .item').count(),1);
 await p.locator('#closeParcel').click();await p.locator('#orderBoard [data-order-id="1"]').click();assert.equal(await p.evaluate(()=>state.order.id),1);assert.equal(await p.locator('#modal').isVisible(),false);
 await p.locator('#ordersNav').click();await p.locator('[data-accepted-order="2"]').click();assert.equal(await p.evaluate(()=>state.order.id),2);assert.equal(await p.locator('#modal').isVisible(),false);
 await p.evaluate(()=>{state.visitorCooldown=6;state.visitorGapPending=true;state.arrivalPacingVersion=3;save();});await p.reload();await p.locator('#loadGame').click();assert.ok(await p.evaluate(()=>state.visitorCooldown)>5);
 // Restart is directly available at the main counter and clears completed FTUE.
 await p.evaluate(()=>{localStorage.setItem(TUTORIAL_KEY,'1');state.gold=999;state.day=2;setScreen('reception');});
 await p.locator('#restartTutorial').click();await p.waitForFunction(()=>state.tutorial?.active&&state.tutorial.stage==='bag');
 assert.equal(await p.evaluate(()=>state.day),1);assert.equal(await p.evaluate(()=>state.gold),80);assert.equal(await p.evaluate(()=>state.stock.length+state.bag.length+allOrders().length),0);
 assert.equal(await p.locator('#buyBag').textContent(),'Отсортировать');
 await p.reload();await p.locator('#restartStartTutorial').click();assert.equal(await p.evaluate(()=>state.tutorial.active),true);
 assert.deepEqual(errors,[]);console.log('PASS: random 5–10s arrivals during sorting, 5–7s idle waits, 3s after orders, no accumulating queue, 7+3 both days, direct assembly, saved cooldown and restart with tutorial');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
