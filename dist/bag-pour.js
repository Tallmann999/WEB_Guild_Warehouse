'use strict';

// Only the presentation lives here. A purchase commits its original item
// instances and its price before this short, interruptible reveal starts.
const BagPour=(()=>{
  const ITEM_SIZE=79;
  let job=null;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  function random(seed){
    let value=(Number(seed)||1)>>>0;
    return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
  }
  function geometry(){
    const pile=document.getElementById('pile');
    // The narrower workbench with an accepted parcel is the limiting case.
    return {width:Math.min(720,pile?.clientWidth||720),height:pile?.clientHeight||235};
  }
  function scatter(count,seed,occupied=[]){
    const roll=random(seed),{width,height}=geometry();
    const rangeX=Math.max(1,width-ITEM_SIZE-20),rangeY=Math.max(1,height-ITEM_SIZE-20);
    const placed=occupied.map(x=>({x:clamp(x.x,0,1),y:clamp(x.y,0,1)})),result=[];
    for(let index=0;index<count;index++){
      let best=null,bestScore=-Infinity;
      for(let attempt=0;attempt<420;attempt++){
        const candidate={x:.045+roll()*.91,y:.045+roll()*.91};
        const clearance=placed.length?Math.min(...placed.map(p=>Math.max(Math.abs(p.x-candidate.x)*rangeX,Math.abs(p.y-candidate.y)*rangeY))):85;
        const distance=Math.hypot((candidate.x-.5)*rangeX,(candidate.y-.48)*rangeY);
        // Favour a loose heap near the middle, while leaving every button's
        // centre uncovered. The best of many candidates avoids a tidy grid.
        const safe=clearance>=56;
        const score=(safe?1000:0)+Math.min(clearance,82)-distance*.14+roll()*10;
        if(score>bestScore){best=candidate;bestScore=score;}
      }
      placed.push(best);result.push(best);
    }
    return result;
  }
  function position(index,count,seed=1){
    const amount=Math.max(1,Math.floor(Number(count)||1));
    return scatter(amount,seed)[clamp(Math.floor(Number(index)||0),0,amount-1)];
  }
  function layout(list,{existing=[]}={}){
    const seed=list.reduce((value,x)=>Math.imul(value^Number(x.uid||0),16777619)>>>0,2166136261);
    const occupied=existing.filter(x=>x.tablePos).map(x=>x.tablePos);
    const points=scatter(list.length,seed,occupied),roll=random(seed^0xa51f29);
    list.forEach((x,index)=>{x.tablePos=points[index];x.tableAngle=Math.round((roll()-.5)*22);});
    return list;
  }
  function originalAngle(item){return Number.isFinite(item?.tableAngle)?item.tableAngle:(Number(item?.uid)||0)%21-10;}
  function resetNode(node){
    const item=state.bag.find(x=>x.uid===Number(node.dataset.uid));
    node.style.opacity='';node.style.transform='rotate('+originalAngle(item)+'deg)';
    node.removeAttribute('data-pouring');
  }
  function clear(){
    job=null;
    const pile=document.getElementById('pile');
    if(pile){pile.inert=false;pile.querySelectorAll('[data-pouring]').forEach(resetNode);}
    document.getElementById('bagPourScene')?.remove();
    document.getElementById('work')?.classList.remove('bag-pouring');
  }
  function start(uids){
    clear();
    const actual=[...new Set(uids)].filter(uid=>state.bag.some(x=>x.uid===uid));
    if(!actual.length)return false;
    job={uids:actual,elapsed:0,interval:Math.min(.085,.7/Math.max(1,actual.length-1)),duration:1.5};
    render();return true;
  }
  function render(){
    if(!job)return;
    const work=document.getElementById('work'),pile=document.getElementById('pile'),table=document.getElementById('table');
    if(!work||!pile||!table)return;
    const visible=state.screen==='work'&&state.mode==='sort';
    let scene=document.getElementById('bagPourScene');
    if(!scene){
      scene=document.createElement('div');scene.id='bagPourScene';scene.setAttribute('aria-hidden','true');
      scene.innerHTML='<div class="bag-pour-sack"><img src="assets/open-loot-bag.png" alt="" draggable="false"></div>';
      work.append(scene);
    }
    scene.hidden=!visible;work.classList.toggle('bag-pouring',visible);pile.inert=true;
    if(!visible)return;
    const width=pile.clientWidth,height=pile.clientHeight;
    const originX=width*.5,originY=-10;
    // This sprite already lies on its side. Its mouth is at 67% / 65%; align
    // that opening with the real buttons' launch point rather than rotating it.
    scene.style.left=(table.offsetLeft+table.clientLeft+pile.offsetLeft+originX-147.4)+'px';
    scene.style.top=(table.offsetTop+table.clientTop+pile.offsetTop+originY-108.55)+'px';
    const intro=clamp(job.elapsed/.15,0,1),outro=clamp((job.elapsed-1.12)/.38,0,1);
    const sack=scene.firstElementChild;
    sack.style.opacity=String(intro*(1-outro));
    sack.style.transform='translateY('+(-12*(1-intro)-24*outro)+'px) rotate('+(Math.sin(job.elapsed*29)*2)+'deg) scale('+(1-.12*outro)+')';
    for(const [index,uid] of job.uids.entries()){
      const node=pile.querySelector('[data-uid="'+uid+'"]'),item=state.bag.find(x=>x.uid===uid);
      if(!node||!item)continue;
      node.dataset.pouring='';
      const local=job.elapsed-.17-index*job.interval;
      if(local<0){node.style.opacity='0';continue;}
      const progress=clamp(local/.52,0,1),ease=1-Math.pow(1-progress,2);
      const finalX=10+item.tablePos.x*Math.max(1,width-ITEM_SIZE-20)+ITEM_SIZE/2;
      const finalY=10+item.tablePos.y*Math.max(1,height-ITEM_SIZE-20)+ITEM_SIZE/2;
      const dx=(originX-finalX)*(1-ease),dy=(originY-finalY)*(1-progress)-Math.sin(progress*Math.PI)*18;
      const angle=originalAngle(item)+(1-progress)*(index%2?48:-46);
      const bounce=progress>.8?Math.sin((progress-.8)/.2*Math.PI)*.07:0;
      node.style.opacity=String(clamp(progress*7,0,1));
      node.style.transform='translate('+dx+'px,'+dy+'px) rotate('+angle+'deg) scale('+(1+bounce)+')';
    }
  }
  function advance(dt){
    if(!job)return false;
    job.elapsed+=Math.max(0,Math.min(1,Number(dt)||0));
    if(job.elapsed>=job.duration){clear();return true;}
    render();return false;
  }
  function afterLoad(){clear();}
  return {layout,position,start,active:()=>!!job,advance,render,clear,afterLoad};
})();
