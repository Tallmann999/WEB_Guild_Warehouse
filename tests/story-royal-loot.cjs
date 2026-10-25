'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context=vm.createContext({state:{gold:4,stock:[],bag:[],junk:[],unknownTray:[],orders:[],collection:[],story:{regularContracts:{royal:{signed:true,deliveries:0}}}}});
vm.runInContext(fs.readFileSync('dist/catalog.js','utf8')+'\n'+fs.readFileSync('dist/loot-balance.js','utf8')+'\nthis.balance=LootBalance;this.catalogueItems=items;',context);
const balance=context.balance,items=context.catalogueItems;
assert.equal(items[18].name,'Железный меч');assert.equal(items[19].name,'Кинжал');assert.equal(items[24].name,'Шлем');
assert.deepEqual(Array.from(balance.catalogue(5).eliteEquipment),[18,19,24]);assert.deepEqual(Array.from(balance.catalogue(4).eliteEquipment),[]);
const recipe=[{type:18,count:5},{type:19,count:5},{type:24,count:5}];let uid=0;
const manual={id:1,assignedTo:'manual',recipe:[{type:18,count:2}],packed:[{uid:++uid,type:18,unknown:false}],reservedUids:[]};
const shared={uid:++uid,type:18,unknown:false};manual.reservedUids.push(shared.uid);
context.state.stock=[shared];context.state.bag=[shared];context.state.orders=[manual,{id:2,assignedTo:'goblin',regularKey:'royal',recipe,packed:[],reservedUids:[]}];
for(let index=0;index<5;index++){
  const before=JSON.stringify(context.state),plan=balance.makeTypes({day:5,index});assert.equal(JSON.stringify(context.state),before,'Supply selection only chooses types');
  assert.equal(plan.types.length,8);assert.equal(plan.types.filter(type=>items[type].cat===0).length,4);
  for(const type of new Set(plan.types))assert.ok(plan.types.filter(x=>x===type).length<=2);
  context.state.stock.push(...Array.from(plan.types,type=>({uid:++uid,type,unknown:false})));context.state.story.lastSupplyTypes=Array.from(plan.types);
}
for(const line of recipe)assert.ok(context.state.stock.filter(x=>x.type===line.type).length>=(line.type===18?6:5),'Five real mixed supplies cover royal demand and the earlier manual sword');
assert.equal(context.state.gold,4);assert.deepEqual(manual.reservedUids,[shared.uid]);
console.log('PASS: real sword/dagger/helmet catalogue, day5 elite supply theme,15-item demand covered by five paid-bag plans with manual priority, uid deduplication,4/8 trophies,max2copies and no money mutation.');
