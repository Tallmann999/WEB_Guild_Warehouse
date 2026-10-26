'use strict';

// Transaction-level coverage uses an isolated VM: no browser profile or live
// save is read, modified, or cleared by this test.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const goblinSource=fs.readFileSync(path.join(__dirname,'../dist/goblin.js'),'utf8');
const automationSource=fs.readFileSync(path.join(__dirname,'../dist/automation.js'),'utf8');

function fixture(saved){
  const state=saved||{
    started:true,paused:false,ended:false,autoSorting:false,tutorial:{active:false},
    screen:'reception',mode:'sort',selected:null,activeCat:null,inspectCat:null,
    day:3,gold:500,daySpent:0,dayIncome:0,rep:0,totalOrders:0,dayOrders:0,
    story:{completedB2:true,goblinEncounterSeen:true,elapsed:10},
    stock:[],bag:[],orders:[],order:null
  };
  const context={state,drag:null,items:[{name:'Трофей'},{name:'Мясо'},{name:'Трава'}],
    document:{hidden:false,getElementById:()=>null},
    City:{opened:false,isOpen(){return this.opened;}},
    Automation:{enabled:()=>false},BagPour:{active:()=>false},
    modalIsOpen:()=>false,isModalBlockingWork:()=>false,isItemBeingExamined:()=>false,
    isUnknown:x=>!!x.unknown,
    saved:null,deliveries:[],renders:0,
    renderWork(){context.renders++;},renderReception(){context.renders++;},
    updateHud(){},showGoldSpend(){},toast(){},
    cancelDrag(){context.drag=null;state.selected=null;},
    save(){context.saved=JSON.stringify(context.state);},
    Story:{onOrderDelivered(o,origin){context.deliveries.push({id:o.id,origin});}}
  };
  vm.createContext(context);
  vm.runInContext(goblinSource+'\nglobalThis.Goblin=Goblin;',context);
  return context;
}
const item=(uid,type=1)=>({uid,type,unknown:false});
const order=(id,{type=1,count=1,packed=[],accepted=true,...rest}={})=>({
  id,accepted,recipe:[{type,count}],packed,reservedUids:[],customer:0,reward:90,...rest
});
const clone=x=>JSON.parse(JSON.stringify(x));

// A real partial parcel is the first hire assignment, with every packed UID
// and another manual parcel's reservation preserved.
{
  let c=fixture();
  const packed=item(1),free=item(2),other=item(3,2);
  const first=order(1,{count:2,packed:[packed]}),manual=order(2,{type:2});
  c.state.orders=[first,manual];c.state.order=first;c.state.stock=[free,other];
  assert.equal(c.Goblin.hire(),true);
  assert.equal(c.state.goblin.enabled,true);
  assert.equal(first.assignedTo,'goblin');
  assert.deepEqual(clone(first.packed),[packed]);
  assert.deepEqual(clone(manual.reservedUids),[3]);
  assert.equal(c.state.gold,260);
  assert.equal(c.Goblin.hire(),false);
  assert.equal(c.state.gold,260,'Hiring cannot charge twice');
  c.Goblin.advance(1.9);
  assert.equal(c.state.goblin.job.elapsed,1.9);
  c.state.paused=true;
  const paused=JSON.stringify(c.state);
  c.Goblin.advance(10);
  assert.equal(JSON.stringify(c.state),paused,'Paused work preserves the exact clock');
  c.state.paused=false;
  c=fixture(clone(c.state));
  c.Goblin.advance(.11);
  const ready=c.state.orders[0];
  assert.equal(c.Goblin.readyToClaim(ready),true);
  assert.equal(c.Goblin.isReady(ready),true);
  assert.equal(c.state.gold,260,'The open counter never silently credits the parcel');
  assert.equal(c.state.goblin.deliveries,0);
  assert.deepEqual(clone(ready.packed.map(x=>x.uid)),[1,2]);
  c.Goblin.advance(10);
  assert.equal(c.state.gold,260,'Waiting for the ready button never creates repeat payouts');
  c.state.paused=true;assert.equal(c.Goblin.claim(ready),false);
  c.state.paused=false;c.document.hidden=true;assert.equal(c.Goblin.claim(ready),false);
  c.document.hidden=false;
  assert.equal(c.Goblin.claim(ready),true);
  assert.equal(c.state.gold,347);
  assert.equal(c.state.dayIncome,90);
  assert.equal(c.state.goblin.feesPaid,3);
  assert.equal(c.state.goblin.receipts.length,1);
  assert.deepEqual(clone(c.state.goblin.receipts[0].uids),[1,2]);
  assert.equal(c.Goblin.claim(ready),false);
  assert.equal(c.state.gold,347);
  assert.equal(c.state.orders.length,1);
  assert.deepEqual(clone(c.state.orders[0].reservedUids),[3]);
  assert.deepEqual(clone(c.state.stock.map(x=>x.uid)),[3]);
  const reloaded=fixture(clone(c.state));
  reloaded.Goblin.advance(10);
  assert.equal(reloaded.state.gold,347,'Receipt and original UID consumption survive reload');
  assert.equal(reloaded.state.goblin.receipts.length,1);
}

// Collecting an earlier ready letter must not restart Grik's next active job.
{
  const c=fixture(),ready=order(1,{packed:[item(1)],assignedTo:'goblin',fulfillmentReady:true}),next=order(2,{type:2,assignedTo:'goblin'});
  c.state.orders=[ready,next];c.state.order=next;c.state.stock=[item(2,2)];c.state.goblin={hired:true,enabled:true,receipts:[]};
  c.Goblin.advance(.75);const working=JSON.stringify(c.state.goblin.job);
  assert.equal(c.state.goblin.job.orderId,2);assert.equal(c.Goblin.claim(ready),true);
  assert.equal(JSON.stringify(c.state.goblin.job),working,'Claiming another ready parcel preserves the current uid and elapsed clock');
  const reloaded=fixture(clone(c.state));reloaded.Goblin.advance(1.25);
  assert.equal(reloaded.Goblin.readyToClaim(reloaded.state.orders[0]),true);assert.equal(reloaded.state.gold,587);
  assert.equal(reloaded.state.goblin.receipts.length,1,'Finishing the next pack does not silently collect another payout');
}

// If the shop has no accepted parcel at hire time, only the first subsequent
// acceptance is adopted; a held item and an explicit manual choice win.
{
  const c=fixture();c.state.stock=[item(11),item(12)];
  assert.equal(c.Goblin.hire(),true);
  assert.equal(c.state.goblin.pendingFirstParcel,true);
  const offered=order(1,{accepted:false});c.state.orders=[offered];
  c.Goblin.advance(3);assert.notEqual(offered.assignedTo,'goblin');
  offered.accepted=true;c.drag={uid:11};c.state.selected=11;
  c.Goblin.advance(3);assert.notEqual(offered.assignedTo,'goblin');
  assert.equal(c.state.goblin.pendingFirstParcel,true);
  c.drag=null;c.state.selected=null;c.Goblin.advance(2);
  assert.equal(offered.assignedTo,'goblin');
  assert.equal(c.Goblin.readyToClaim(offered),true);
  const next=order(2);c.state.orders.push(next);c.Goblin.advance(10);
  assert.notEqual(next.assignedTo,'goblin','Hiring is not perpetual permission to take manual work');
  assert.equal(c.state.gold,260);
  const manual=fixture();manual.Goblin.hire();
  const chosen=order(3);manual.state.orders=[chosen];
  manual.Goblin.assign(chosen,false);manual.Goblin.advance(3);
  assert.notEqual(chosen.assignedTo,'goblin','An explicit manual choice cancels the pending hire assignment');
}

// City view keeps screen=reception internally. It must still run a real timed
// dispatch, while returning to the open counter exposes the ready button.
{
  const c=fixture();const parcel=order(1);c.state.orders=[parcel];c.state.stock=[item(21)];
  c.Goblin.hire();c.Goblin.advance(2);
  assert.equal(c.Goblin.readyToClaim(parcel),true);
  c.City.opened=true;c.Goblin.advance(1);
  assert.equal(c.state.goblin.job.kind,'dispatch');
  assert.equal(c.state.goblin.job.elapsed,1);
  c.City.opened=false;c.Goblin.advance(10);
  assert.equal(c.state.gold,260);
  assert.equal(c.Goblin.readyToClaim(parcel),true);
  c.City.opened=true;c.Goblin.advance(3);
  assert.equal(c.state.gold,347);
  assert.equal(c.state.orders.length,0);
  assert.equal(c.state.goblin.receipts.length,1);
  c.Goblin.advance(10);assert.equal(c.state.gold,347);
}

// Intentional worker switches, unknown goods, another manual claim and paused
// automation jobs retain their saved ownership and elapsed work.
{
  const c=fixture();c.state.screen='work';c.state.goblin={hired:true,enabled:false};
  const worker=order(1,{assignedTo:'goblin',count:2}),manual=order(2,{type:2});
  c.state.orders=[manual,worker];c.state.stock=[item(31),item(32),item(33,2),{uid:34,type:1,unknown:true}];
  c.Goblin.ensure();c.Goblin.reconcile();c.Goblin.advance(10);
  assert.equal(c.state.goblin.enabled,false);
  assert.deepEqual(clone(manual.reservedUids),[33]);
  c.Goblin.setEnabled(true);c.Goblin.advance(1);
  assert.equal(c.state.goblin.job.elapsed,1);
  worker.automationOwned=true;c.Automation.enabled=()=>false;
  c.Goblin.advance(5);
  assert.equal(c.state.goblin.suspendedAutomationJob.elapsed,1);
  assert.equal(worker.packed.length,0);
  c.Automation.enabled=()=>true;c.Goblin.advance(1);
  assert.equal(worker.packed.length,1);
  c.document.hidden=true;const hidden=JSON.stringify(c.state);c.Goblin.advance(10);
  assert.equal(JSON.stringify(c.state),hidden);
  c.document.hidden=false;c.Goblin.advance(5);
  assert.equal(c.state.gold,587);
  assert.deepEqual(clone(c.state.stock.map(x=>x.uid)),[33,34]);
  assert.deepEqual(clone(manual.reservedUids),[33]);
}

// The automatic counter gives each arriving guest 1.5 active seconds of visible
// presentation. This does not slow the city, run under a modal, or accrue hidden time.
{
  const c=fixture();let purchases=0;
  const offer={arrivalSerial:1,visitor:0,price:10,loot:[item(41)]};
  Object.assign(c,{
    $:()=>({classList:{contains:()=>true}}),
    Contracts:{activeOffer:()=>null},allOrders:()=>c.state.orders,
    counterGuest:()=>c.state.offers[0]?{kind:'bag',value:c.state.offers[0]}:null,
    prepareOffer(){},startVisitorGap(){},render(){},
    buyBag(){c.state.offers.shift();c.state.gold-=10;purchases++;return true;}
  });
  c.state.offers=[offer];c.state.goblin={hired:true,enabled:true};c.state.dwarf={hired:true,enabled:true};
  c.state.story.completedB3=true;
  vm.runInContext(automationSource+'\nglobalThis.Automation=Automation;',c);
  c.Automation.enable();
  for(let i=0;i<14;i++)assert.equal(c.Automation.advance(.1),false);
  assert.equal(purchases,0);
  c.document.hidden=true;for(let i=0;i<10;i++)c.Automation.advance(1);
  assert.equal(purchases,0);
  c.document.hidden=false;c.Automation.advance(.11);
  assert.equal(purchases,1);
  c.state.offers=[{...offer,arrivalSerial:2}];c.City.opened=true;
  c.Automation.advance(.5);assert.equal(purchases,2,'The working city does not wait for an unseen arrival animation');
  c.state.offers=[{...offer,arrivalSerial:3}];c.City.opened=false;
  c.Automation.afterLoad();c.Automation.advance(.5);assert.equal(purchases,2,'Loading starts a fresh visible arrival presentation');
  c.state.paused=true;c.Automation.advance(10);assert.equal(purchases,2);
  c.state.paused=false;c.Automation.advance(1);assert.equal(purchases,3);
}

console.log('PASS: instant hire assignment; original partial UID/reservation preservation; ready/claim/reload exactly once; open-counter acknowledgement; automatic timed city dispatch; intentional switches, hands, hidden/pause clocks; visible automatic visitor dwell.');
