import {BaseScene} from './BaseScene.js';
export class TowerScene extends BaseScene{
  constructor(){super('Tower');}
  paintWorld(snapshot){
    super.paintWorld(snapshot);
    const bounds=snapshot.bounds||{x:0,y:0,width:snapshot.viewport.width,height:snapshot.viewport.height};
    this.replaceBackground('environment.tower',bounds);
    if(!this.backgrounds.length)this.world.fillGradientStyle(0x272338,0x33243c,0x15131c,0x1c1720,1).fillRect(bounds.x,bounds.y,bounds.width,bounds.height);
  }
}
