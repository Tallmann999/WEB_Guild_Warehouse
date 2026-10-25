import {BaseScene} from './BaseScene.js';
export class CityScene extends BaseScene{
  constructor(){super('City');}
  paintWorld(s){
    super.paintWorld(s);this.replaceBackground('environment.city',s.cityLandscape);
    this.backgrounds[0]?.setTint(0xb1baa4);
    if(this.backgrounds[0]&&s.cityLandscape)this.backgrounds[0].y=s.cityLandscape.y+this.backgrounds[0].displayHeight/2;
    if(s.towerOwned&&s.cityLandscape){const r=s.cityLandscape;this.world.fillStyle(0xffdc83,.13).fillCircle(r.x+r.width*.82,r.y+r.height*.3,85);}
  }
}
