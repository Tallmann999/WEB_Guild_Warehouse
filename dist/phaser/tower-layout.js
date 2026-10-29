'use strict';

// Immutable presentation data shared by the DOM fallback and the native scene.
// Positions belong to one art board; a resize moves every layer together.
window.LootkeeperTowerArt=(()=>{
  const design=Object.freeze({width:1536,height:768});
  const layers=Object.freeze([
    {id:'room',key:'environment.tower',path:'assets/tower-mage/room.png',depth:0,box:{x:0,y:0,width:1536,height:768},source:{width:1672,height:941},fit:'cover'},
    {id:'workbench',key:'prop.tower-workbench',path:'assets/tower-mage/workbench.png',depth:2,box:{x:12,y:448,width:1512,height:1512*470/2188},source:{width:2188,height:470},fit:'contain'},
    {id:'mechanism',key:'prop.tower-mechanism',path:'assets/tower-mage/mechanism.png',depth:4,box:{x:1536*.235-192,y:448+1512*470/2188*.36-384*803/1689,width:384,height:384*803/1689},source:{width:1689,height:803},fit:'contain'},
    {id:'orb',key:'prop.tower-orb',path:'assets/tower-mage/orb.png',depth:5,box:{x:1536*.49-1536*.08/2,y:448+1512*470/2188*.36-1536*.08*1188/845,width:1536*.08,height:1536*.08*1188/845},source:{width:845,height:1188},fit:'contain'}
  ].map(layer=>Object.freeze({...layer,box:Object.freeze(layer.box),source:Object.freeze(layer.source)})));
  function layout(bounds){
    const scale=bounds.width/design.width;
    const table=layers[1].box,tableHeight=table.height*scale;
    // The room covers the viewport; all furniture shares one width-fitted
    // plane. Its back edge sits low in a wide view and the whole plane follows
    // the bottom in a tall view, preserving both table contact and silhouettes.
    const tableTop=Math.max(bounds.height*.58,bounds.height-tableHeight-14);
    const x=bounds.x,y=bounds.y+tableTop-table.y*scale;
    return layers.map(layer=>{
      const {box,source}=layer;
      if(layer.id==='room'){
        const fit=Math.max(bounds.width/source.width,bounds.height/source.height);
        return {...layer,x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2,width:source.width*fit,height:source.height*fit};
      }
      const fit=(layer.fit==='cover'?Math.max:Math.min)(box.width/source.width,box.height/source.height);
      const width=source.width*fit*scale,height=source.height*fit*scale;
      return {...layer,x:x+(box.x+box.width/2)*scale,y:y+(box.y+box.height/2)*scale,width,height};
    });
  }
  return Object.freeze({design,layers,layout});
})();
