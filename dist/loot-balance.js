'use strict';

// Select types only. Purchases, original instances, gold and reservations belong
// to the existing trading systems and are never changed by this module.
const LootBalance=(()=>{
  const RECIPES={chef:[{type:38,count:2},{type:31,count:2},{type:32,count:2}],alchemy:[{type:0,count:2},{type:1,count:2},{type:6,count:2}]};
  const THEMES=[
    {name:'Добыча из Сумрачного леса',trophies:[0,1,49,52,53,55,56,61,74,78],groups:[1,4,4,3]},
    {name:'Трофеи с охотничьего перевала',trophies:[0,2,49,50,51,52,54,57,58,64,65],groups:[4,4,3,1]},
    {name:'Находки у древних руин',trophies:[3,4,50,51,54,55,59,60,62,63,70,81],groups:[2,3,1,4]},
    {name:'Добыча с Туманного болота',trophies:[1,3,5,49,52,54,55,67,68,73,74,79,82],groups:[1,4,4,2]}
  ];
  const range=(first,last)=>Array.from({length:last-first+1},(_,i)=>first+i);
  const unique=list=>[...new Set(list)].filter(type=>!!items[type]);
  function random(seed){let value=seed>>>0;return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};}
  function catalogue(day){
    const stage=Math.max(2,Math.floor(Number(day)||2));
    const trophies=stage===2?[0,1,...range(49,55)]:[0,1,2,3,5,...range(49,60)];
    if(stage>=4)trophies.push(4,...range(61,65),...items.filter(x=>x.cat===0&&x.id>=66).map(x=>x.id));
    const food=stage===2?[30,31,32,35,37,38,39,42]:range(30,48);
    const plants=stage===2?[6,7,8]:range(6,11),ore=stage===2?[12,13,16]:range(12,17);
    const equipment=stage===2?[18,19,24,25]:stage===3?[18,19,20,21,24,25,26,27,29]:range(18,29);
    const organs=stage===2?[]:stage===3?[66,69]:items.filter(x=>x.id>=66&&x.cat===4&&!x.food).map(x=>x.id);
    return {trophies:unique(trophies).filter(type=>items[type].cat===0),other:unique([...food,...plants,...ore,...equipment,...organs]).filter(type=>items[type].cat!==0)};
  }
  function inventory(){
    const snapshot=typeof state==='undefined'?{}:state,seen=new Set(),free=new Map(),owned=new Map();
    const known=x=>!x.unknown||(snapshot.collection||[]).includes(x.type);
    const original=list=>list.filter(x=>{
      if(!x||!items[x.type])return false;
      if(x.uid===undefined||x.uid===null)return true;
      if(seen.has(x.uid))return false;seen.add(x.uid);return true;
    });
    for(const x of original([...(snapshot.stock||[]),...(snapshot.bag||[])])){
      owned.set(x.type,(owned.get(x.type)||0)+1);
      if(known(x))free.set(x.type,(free.get(x.type)||0)+1);
    }
    const orders=(snapshot.orders||[]).filter(o=>!o.delivered);
    for(const x of original([...(snapshot.junk||[]),...(snapshot.unknownTray||[]),...orders.flatMap(o=>o.packed||[])]))owned.set(x.type,(owned.get(x.type)||0)+1);
    return {snapshot,orders,free,owned};
  }
  function demand(snapshot,orders,free){
    const requests=[];
    const useRecipe=(recipe,packed,priority)=>{
      for(const line of recipe||[]){
        const needed=Math.max(0,line.count-(packed||[]).filter(x=>x.type===line.type).length);
        const used=Math.min(needed,free.get(line.type)||0);free.set(line.type,(free.get(line.type)||0)-used);
        const deficit=needed-used;if(deficit>0)requests.push({type:line.type,count:deficit,priority});
      }
    };
    // Allocate each known uid once, first to manual promises. Packed originals
    // satisfy only their own parcel; they are not counted as free stock again.
    const priority=o=>o.assignedTo==='goblin'?2:o.regularKey?1:0;
    for(const order of orders.slice().sort((a,b)=>priority(a)-priority(b)))useRecipe(order.recipe,order.packed,priority(order));
    for(const [key,c] of Object.entries(snapshot.story?.regularContracts||{}))if(c.signed&&!orders.some(o=>o.regularKey===key))useRecipe(RECIPES[key],[],3);
    return requests;
  }
  function makeTypes({day=2,index=0,lesson=false}={}){
    if(lesson)return {types:[38,38,31,31,0,0,6,24],theme:'Первая торговая поставка',unknownBudget:0};
    const ordinal=Math.max(0,Math.floor(Number(index)||0)),stage=Math.max(2,Math.floor(Number(day)||2));
    const theme=THEMES[ordinal%THEMES.length],roll=random((Math.imul(stage,2654435761)^Math.imul(ordinal+1,2246822519))>>>0);
    const pools=catalogue(stage),{snapshot,orders,free,owned}=inventory(),requests=demand(snapshot,orders,free),entries=[],counts=new Map();
    const add=(type,requested=false,priority=4)=>{entries.push({type,requested,priority});counts.set(type,(counts.get(type)||0)+1);};
    const wanted=trophy=>{
      let best=null,bestScore=Infinity;
      for(const request of requests){
        if(!items[request.type]||request.count<=0||(counts.get(request.type)||0)>=2||(items[request.type].cat===0)!==trophy)continue;
        const score=request.priority*100-request.count*3+roll();
        if(score<bestScore){best=request;bestScore=score;}
      }
      if(!best)return null;best.count--;return best;
    };
    const filler=(pool,preferred=[],excluded=null)=>{
      const candidates=pool.filter(type=>type!==excluded&&(counts.get(type)||0)<2);
      const choices=candidates.length?candidates:pool.filter(type=>type!==excluded);
      let best=choices[0],bestScore=Infinity;
      for(const type of choices){
        const score=(owned.get(type)||0)*6+(counts.get(type)||0)*8+(preferred.includes(type)?0:2.5)+roll()*3;
        if(score<bestScore){best=type;bestScore=score;}
      }
      return best;
    };
    for(let slot=0;slot<8;slot++){
      const trophy=slot<4,request=wanted(trophy);
      if(request){add(request.type,true,request.priority);continue;}
      const pool=trophy?pools.trophies:pools.other;
      const preferred=trophy?theme.trophies:pool.filter(type=>items[type].cat===theme.groups[slot-4]);
      add(filler(pool,preferred));
    }
    // Even an unusually repetitive outstanding recipe must not make the next
    // purchased bag an exact copy of the last one. Keep its category balance.
    const signature=list=>list.slice().sort((a,b)=>a-b).join(',');
    const previous=snapshot.story?.lastSupplyTypes;
    if(Array.isArray(previous)&&signature(entries.map(x=>x.type))===signature(previous)){
      const victim=entries.map((entry,i)=>({...entry,i})).sort((a,b)=>Number(a.requested)-Number(b.requested)||b.priority-a.priority||b.i-a.i)[0];
      const trophy=items[victim.type].cat===0,pool=trophy?pools.trophies:pools.other;
      counts.set(victim.type,counts.get(victim.type)-1);
      entries[victim.i]={type:filler(pool,trophy?theme.trophies:[],victim.type),requested:false,priority:4};
    }
    for(let i=entries.length-1;i>0;i--){const j=Math.floor(roll()*(i+1));[entries[i],entries[j]]=[entries[j],entries[i]];}
    return {types:entries.map(x=>x.type),theme:theme.name,unknownBudget:1};
  }
  return {makeTypes,catalogue};
})();
