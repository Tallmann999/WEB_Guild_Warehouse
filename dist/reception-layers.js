import {RECEPTION_SOURCE,RECEPTION_STAGES,VISITOR_POSES,receptionLayout,visitorLayout,counterPropFootOffset} from './phaser/reception-layout.js';

// DOM art is the accessible fallback for the same source camera. Observers and
// the existing bridge frame update presentation; there is no second game loop.
const game=document.getElementById('game'),room=document.getElementById('reception'),visitor=document.getElementById('visitor');
const backgrounds=document.createElement('div');backgrounds.id='receptionBackgroundLayers';backgrounds.setAttribute('aria-hidden','true');room.prepend(backgrounds);
const counters=room.querySelector('.counter');counters.id='receptionCounterLayers';counters.setAttribute('aria-hidden','true');
const images=new Map();
for(const stage of RECEPTION_STAGES)for(const role of ['day','night','counter']){
  const image=document.createElement('img');image.alt='';image.draggable=false;image.dataset.receptionLayer=stage+'-'+role;
  image.src='assets/New Sprites/'+(role==='counter'?'counters/'+stage+'-counter.png':'backgrounds/'+stage+'-'+role+'.png');
  (role==='counter'?counters:backgrounds).append(image);images.set(stage+'-'+role,image);
}
game.classList.add('reception-layered');
const assign=(node,name,value)=>{if(node.style[name]!==value)node.style[name]=value;};
function fromDom(){
  const css=getComputedStyle(game),number=name=>Number.parseFloat(css.getPropertyValue(name))||0;
  const scene=document.getElementById('restorationScene'),active=game.classList.contains('restoration-active');
  const progress=(Number.parseFloat(scene?.querySelector('.restoration-timeline i')?.style.width)||0)/100;
  return {key:'Reception',bounds:{x:0,y:0,width:room.clientWidth,height:room.clientHeight},story:game.classList.contains('story-mode'),stage:Number(game.dataset.shopStage)||0,furnished:number('--repair-furnished'),clean:number('--repair-clean'),night:number('--light-night'),evening:number('--light-evening'),restoration:active?{kind:scene?.dataset.kind||'clean',elapsed:progress*4}:null};
}
function update(snapshot){
  if(!room.clientWidth||!room.clientHeight)return;
  if(!snapshot?.bounds||snapshot.key!=='Reception')snapshot=fromDom();
  const layout=snapshot.receptionLayers||receptionLayout(snapshot),bounds=snapshot.bounds;
  for(const layer of layout.layers){
    const image=images.get(layer.id);
    assign(image,'left',(layer.x-layer.width/2-bounds.x)+'px');assign(image,'top',(layer.y-layer.height/2-bounds.y)+'px');
    assign(image,'width',layer.width+'px');assign(image,'height',layer.height+'px');
    assign(image,'opacity',String(layer.alpha));assign(image,'zIndex',String(Math.round(layer.depth*10)));
  }
  const pose=snapshot.visitorPose||visitorLayout(bounds,visitor.getAttribute('src'),{width:visitor.naturalWidth,height:visitor.naturalHeight});
  if(pose){
    assign(visitor,'left',(pose.x-pose.width/2-bounds.x)+'px');assign(visitor,'top',(pose.y-pose.height/2-bounds.y)+'px');
    assign(visitor,'width',pose.width+'px');assign(visitor,'height',pose.height+'px');
  }
  for(const id of ['bag','parcel']){
    const control=document.getElementById(id),image=control?.querySelector('img');
    if(!image||!control.offsetWidth||!control.offsetHeight)continue;
    const foot=counterPropFootOffset(image.getAttribute('src'),{width:image.offsetWidth,height:image.offsetHeight});
    if(foot===null)continue;
    // Keep each existing control's width, height and right-hand position. Only
    // its vertical anchor follows the same source table plane as the artwork.
    assign(control,'top',(layout.counterPropFootY-bounds.y-image.offsetTop-foot)+'px');
  }
}
window.LootkeeperReceptionLayers=Object.freeze({update,layout:receptionLayout,source:RECEPTION_SOURCE,poses:VISITOR_POSES});
new ResizeObserver(()=>update()).observe(room);
new MutationObserver(()=>update()).observe(game,{attributes:true,attributeFilter:['style','class','data-shop-stage']});
new MutationObserver(()=>update()).observe(visitor,{attributes:true,attributeFilter:['src','class']});
visitor.addEventListener('load',()=>update());update();
