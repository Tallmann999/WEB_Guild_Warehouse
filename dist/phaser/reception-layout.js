// Source-registered presentation only. No inventory, clocks or save data live
// here: both renderers adapt the existing simulation into this one camera.
export const RECEPTION_SOURCE=Object.freeze({width:1536,height:1024,counterOffsetY:100,counterBackEdgeY:635,counterPropFootY:810});
export const RECEPTION_STAGES=Object.freeze(['derelict','bare-walls','guild-furnished']);
export const DEFAULT_VISITOR_POSE=Object.freeze({x:768,y:950,scale:100});
const adventurerPose=Object.freeze({x:650,y:950,scale:140});
export const VISITOR_POSES=Object.freeze(Object.fromEntries(['s3_0','s3_1','s3_2','s3_3','s3_5'].map(id=>[id,adventurerPose])));
// Alpha-bounds foot points of the existing PNGs, measured at alpha >= 16.
// These register the visible object, rather than its transparent image box.
const counterProps=Object.freeze({
  bag:Object.freeze({width:220,height:266,foot:256}),
  'bag-premium':Object.freeze({width:438,height:520,foot:520}),
  parcel:Object.freeze({width:275,height:209,foot:199})
});
const clamp=n=>Math.max(0,Math.min(1,Number(n)||0));

export function receptionCamera(bounds){
  const scale=Math.max(bounds.width/RECEPTION_SOURCE.width,bounds.height/RECEPTION_SOURCE.height);
  return {x:bounds.x+(bounds.width-RECEPTION_SOURCE.width*scale)/2,y:bounds.y+(bounds.height-RECEPTION_SOURCE.height*scale)/2,width:RECEPTION_SOURCE.width*scale,height:RECEPTION_SOURCE.height*scale,scale};
}

export function stageWeights(snapshot){
  const stage=snapshot.story?Number(snapshot.stage)||0:1;
  const clean=stage>=1?1:snapshot.restoration?.kind==='clean'?clamp(snapshot.restoration.elapsed/4):0;
  const furnished=stage>=2?1:snapshot.restoration?.kind==='furnish'?clamp(snapshot.furnished):0;
  return [1-clean,clean*(1-furnished),clean*furnished];
}

function overAlphas(weights){
  let accumulated=0;
  return weights.map(weight=>{accumulated+=weight;return accumulated>0?weight/accumulated:0;});
}

export function receptionLayout(snapshot){
  const camera=receptionCamera(snapshot.bounds),weights=stageWeights(snapshot);
  // The existing clock already interpolates day -> evening -> night. Half of
  // the night art at full evening gives continuous dusk without tinting wood.
  const nightBlend=clamp(clamp(snapshot.night)+clamp(snapshot.evening)*.5);
  const backgroundWeights=weights.flatMap(weight=>[weight*(1-nightBlend),weight*nightBlend]);
  const backgroundAlphas=overAlphas(backgroundWeights),counterAlphas=overAlphas(weights),layers=[];
  for(let i=0;i<RECEPTION_STAGES.length;i++){
    const stage=RECEPTION_STAGES[i];
    for(const [j,time]of ['day','night'].entries())layers.push({id:stage+'-'+time,key:'environment.reception-'+stage+'-'+time,path:'assets/New Sprites/backgrounds/'+stage+'-'+time+'.png',role:'background',stage,time,depth:(i*2+j)/10,alpha:backgroundAlphas[i*2+j],x:camera.x+camera.width/2,y:camera.y+camera.height/2,width:camera.width,height:camera.height});
    layers.push({id:stage+'-counter',key:'prop.reception-'+stage+'-counter',path:'assets/New Sprites/counters/'+stage+'-counter.png',role:'counter',stage,depth:25+i/10,alpha:counterAlphas[i],x:camera.x+camera.width/2,y:camera.y+camera.height/2+RECEPTION_SOURCE.counterOffsetY*camera.scale,width:camera.width,height:camera.height});
  }
  const edge=camera.y+(RECEPTION_SOURCE.counterBackEdgeY+RECEPTION_SOURCE.counterOffsetY)*camera.scale;
  const top=Math.min(snapshot.bounds.y+snapshot.bounds.height,Math.max(snapshot.bounds.y,edge));
  return {camera,weights,nightBlend,counterOffsetY:RECEPTION_SOURCE.counterOffsetY,counterPropFootY:camera.y+RECEPTION_SOURCE.counterPropFootY*camera.scale,layers,counter:{x:snapshot.bounds.x,y:top,width:snapshot.bounds.width,height:snapshot.bounds.y+snapshot.bounds.height-top}};
}

export function counterPropFootOffset(id,box){
  id=String(id||'').replace(/^.*\//,'').replace(/\.png(?:[?#].*)?$/,'');
  const source=counterProps[id];if(!source||!box.width||!box.height)return null;
  const fit=Math.min(box.width/source.width,box.height/source.height);
  return (box.height-source.height*fit)/2+source.foot*fit;
}

export function visitorLayout(bounds,id,source){
  if(!source?.width||!source.height)return null;
  id=String(id||'').replace(/^art\./,'').replace(/^.*\//,'').replace(/\.png(?:[?#].*)?$/,'');
  const pose=VISITOR_POSES[id]||DEFAULT_VISITOR_POSE,camera=receptionCamera(bounds);
  const baseFit=Math.min(RECEPTION_SOURCE.width*.22/source.width,RECEPTION_SOURCE.height*.65/source.height);
  const sourceScale=baseFit*pose.scale/100,width=source.width*sourceScale*camera.scale,height=source.height*sourceScale*camera.scale;
  return {id,pose,sourceScale,coverScale:camera.scale,anchor:{x:camera.x+pose.x*camera.scale,y:camera.y+pose.y*camera.scale},x:camera.x+pose.x*camera.scale,y:camera.y+pose.y*camera.scale-height/2,width,height};
}
