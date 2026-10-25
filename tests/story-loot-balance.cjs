'use strict';
// Exercise the production selector with the production catalogue. It must only
// choose types; inventory instances, reservations and money remain untouched.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context=vm.createContext({state:{stock:[],bag:[],junk:[],unknownTray:[],orders:[],collection:[],gold:321,story:{regularContracts:{}}}});
vm.runInContext(fs.readFileSync('dist/catalog.js','utf8')+'\n'+fs.readFileSync('dist/loot-balance.js','utf8')+'\nthis.balance=LootBalance;this.catalogueItems=items;',context);
const balance=context.balance,items=context.catalogueItems;
const signature=types=>types.slice().sort((a,b)=>a-b).join(',');
const count=(types,type)=>types.filter(value=>value===type).length;
let uid=0;
function instance(type){return {uid:++uid,type,unknown:false};}
function empty(){return {stock:[],bag:[],junk:[],unknownTray:[],orders:[],collection:[],gold:321,story:{regularContracts:{}}};}
function select(day,index,lesson=false){
  const before=JSON.stringify(context.state),plan=balance.makeTypes({day,index,lesson});
  assert.equal(JSON.stringify(context.state),before,'Selecting a future supply never mutates owned instances, gold or promises');
  assert.equal(plan.types.length,8);assert.ok(plan.types.every(type=>Number.isInteger(type)&&items[type]));assert.ok(plan.theme.length>0);
  assert.ok(plan.unknownBudget>=0&&plan.unknownBudget<=1,'A bag has at most one study detour');
  if(!lesson){assert.equal(plan.types.filter(type=>items[type].cat===0).length,4,'Half of each regular bag consists of trophies');for(const type of new Set(plan.types))assert.ok(count(plan.types,type)<=2,'At most two copies of a type in one bag');}
  return plan;
}
const lesson=select(1,0,true);assert.equal(signature(lesson.types),signature([38,38,31,31,0,0,6,24]));assert.equal(lesson.unknownBudget,0);
const lengths=[2,3,4].map(day=>balance.catalogue(day).trophies.length);assert.ok(lengths[0]>=9&&lengths[1]>lengths[0]&&lengths[2]>lengths[1],'Later days expand the trophy catalogue');
for(const day of [2,3,4,12]){
  context.state=empty();let previous=null;const discovered=new Set();
  for(let index=0;index<24;index++){
    const plan=select(day,index);if(previous!==null)assert.notEqual(signature(plan.types),previous,'Consecutive supplies vary their actual contents');
    for(const type of plan.types)if(items[type].cat===0)discovered.add(type);previous=signature(plan.types);context.state.story.lastSupplyTypes=Array.from(plan.types);context.state.stock.push(...Array.from(plan.types,instance));
  }
  assert.ok(discovered.size>=Math.min(9,balance.catalogue(day).trophies.length),'Trophy variety is actually used on day'+day);
}
const recipes={chef:[{type:38,count:2},{type:31,count:2},{type:32,count:2}],alchemy:[{type:0,count:2},{type:1,count:2},{type:6,count:2}]};
for(const key of ['chef','alchemy']){
  context.state=empty();context.state.story.regularContracts[key]={signed:true,delegated:false};context.state.orders=[{id:1,regularKey:key,assignedTo:'manual',recipe:recipes[key],packed:[],reservedUids:[]}];
  for(let index=0;index<3;index++){const plan=select(3,index);context.state.stock.push(...Array.from(plan.types,instance));context.state.story.lastSupplyTypes=Array.from(plan.types);}
  for(const line of recipes[key])assert.ok(context.state.stock.filter(x=>x.type===line.type).length>=line.count,'Three mixed bags can supply the complete signed '+key+' recipe');
}
// The same claw uid exposed in two inventory lists can satisfy only one claim.
context.state=empty();const shared=instance(38),packed=instance(38);context.state.stock=[shared];context.state.bag=[shared];context.state.orders=[{id:1,recipe:[{type:38,count:4}],packed:[packed],reservedUids:[shared.uid]}];
const duplicatePlan=select(3,0);assert.equal(count(Array.from(duplicatePlan.types),38),2,'A duplicate reference and a packed original are not counted as extra free stock');
// Two concurrent manual promises need four claws in total, not two shared ones.
context.state=empty();context.state.story.regularContracts={chef:{signed:true},alchemy:{signed:true}};context.state.orders=[{id:1,recipe:[{type:0,count:2}],packed:[],reservedUids:[]},{id:2,regularKey:'chef',recipe:recipes.chef,packed:[],reservedUids:[]},{id:3,regularKey:'alchemy',recipe:recipes.alchemy,packed:[],reservedUids:[]}];
for(let index=0;index<3;index++){const plan=select(3,index);context.state.stock.push(...Array.from(plan.types,instance));context.state.story.lastSupplyTypes=Array.from(plan.types);}
const demand=[{type:0,count:4},{type:1,count:2},{type:6,count:2},...recipes.chef];for(const line of demand)assert.ok(context.state.stock.filter(x=>x.type===line.type).length>=line.count,'Concurrent claims remain independently supplyable: '+items[line.type].name);
console.log('PASS: production catalogue growth,4/8 trophies, max2 same type, one unknown budget,24 varied purchases per stage, regular recipe coverage, uid deduplication, packed/manual priorities and read-only money/ownership.');
