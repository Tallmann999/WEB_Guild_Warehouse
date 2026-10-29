import {BaseScene} from './BaseScene.js';
import {receptionLayout} from '../reception-layout.js';
export class ReceptionScene extends BaseScene{
  constructor(){super('Reception');}
  create(){
    this.receptionLayers=new Map();
    super.create();
    this.events.once('shutdown',()=>this.receptionLayers.clear());
  }
  paintWorld(snapshot){
    super.paintWorld(snapshot);
    const bounds=snapshot.bounds,layout=snapshot.receptionLayers||receptionLayout(snapshot);
    // Clip the common source camera to the actual room. Full-canvas alpha
    // counters are translated by source +100px, never cropped from a room PNG.
    this.cameras.main.setViewport(bounds.x,bounds.y,bounds.width,bounds.height).setScroll(bounds.x,bounds.y);
    for(const layer of layout.layers){
      if(!this.textures.exists(layer.key))continue;
      let image=this.receptionLayers.get(layer.id);
      if(!image){
        image=this.add.image(layer.x,layer.y,layer.key).setName('reception:'+layer.id).setDepth(layer.depth);
        this.receptionLayers.set(layer.id,image);this.backgrounds.push(image);
      }
      image.setPosition(layer.x,layer.y).setDisplaySize(layer.width,layer.height).setAlpha(layer.alpha).setVisible(layer.alpha>0);
    }
  }
}
