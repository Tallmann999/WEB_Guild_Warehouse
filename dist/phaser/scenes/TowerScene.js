import {BaseScene} from './BaseScene.js';
export class TowerScene extends BaseScene{
  constructor(){super('Tower');}
  create(){
    this.towerLayers=new Map();
    super.create();
    this.events.once('shutdown',()=>this.towerLayers.clear());
  }
  paintWorld(snapshot){
    super.paintWorld(snapshot);
    const bounds=snapshot.bounds||{x:0,y:0,width:snapshot.viewport.width,height:snapshot.viewport.height};
    // A viewport clips the shared art board at the actual room boundary, so
    // furniture cannot paint over the HUD or the footer when cover crops it.
    this.cameras.main.setViewport(bounds.x,bounds.y,bounds.width,bounds.height).setScroll(bounds.x,bounds.y);
    const layers=window.LootkeeperTowerArt.layout(bounds,snapshot.towerStage);
    const present=new Set(layers.map(layer=>layer.id));
    for(const [id,image]of this.towerLayers)if(!present.has(id)){image.destroy();this.towerLayers.delete(id);}
    for(const layer of layers){
      if(!this.textures.exists(layer.key))continue;
      let image=this.towerLayers.get(layer.id);
      if(!image){
        image=this.add.image(layer.x,layer.y,layer.key).setName('tower:'+layer.id).setDepth(layer.depth);
        this.towerLayers.set(layer.id,image);this.backgrounds.push(image);
      }
      if(image.texture.key!==layer.key)image.setTexture(layer.key);
      image.setPosition(layer.x,layer.y).setDisplaySize(layer.width,layer.height);
    }
    if(!this.towerLayers.has('room'))this.world.fillGradientStyle(0x272338,0x33243c,0x15131c,0x1c1720,1).fillRect(bounds.x,bounds.y,bounds.width,bounds.height);
  }
}
