'use strict';

// Immutable presentation data shared by the DOM fallback and the native scene.
// Positions belong to one art board; a resize moves every layer together.
window.LootkeeperTowerArt=(()=>{
  const design=Object.freeze({width:1536,height:1024});
  const base='assets/New Sprites/Mage Tower/';
  const clamp=stage=>Math.max(1,Math.min(3,Math.floor(Number(stage)||1)));
  function layersFor(stage=1){
    stage=clamp(stage);const clean=stage===3,orb=clean?{width:845,height:1188}:{width:1019,height:1446};
    return [
      {id:'room',key:'environment.tower-stage-'+stage,path:base+'backgrounds/stage-'+stage+'.png',depth:0,box:{x:0,y:0,width:1536,height:1024}},
      {id:'workbench',key:'prop.tower-counter-'+stage,path:base+'counters/stage-'+stage+'.png',depth:2,box:{x:-192,y:735,width:1920,height:389}},
      ...(stage>=2?[{id:'mechanism',key:'prop.tower-machine',path:base+'props/machine.png',depth:4,box:{x:190,y:810-410*803/1689,width:410,height:410*803/1689}}]:[]),
      {id:'orb',key:'prop.tower-orb-'+(clean?'clean':'dusty'),path:base+'props/orb-'+(clean?'clean':'dusty')+'.png',depth:5,box:{x:720,y:810-120*orb.height/orb.width,width:120,height:120*orb.height/orb.width}}
    ];
  }
  function layout(bounds,stage=1){
    const scale=Math.max(bounds.width/design.width,bounds.height/design.height);
    const x=bounds.x+(bounds.width-design.width*scale)/2,y=bounds.y+(bounds.height-design.height*scale)/2;
    return layersFor(stage).map(layer=>({...layer,x:x+(layer.box.x+layer.box.width/2)*scale,y:y+(layer.box.y+layer.box.height/2)*scale,width:layer.box.width*scale,height:layer.box.height*scale}));
  }
  return Object.freeze({design,layers:layersFor(1),layersFor,layout});
})();
