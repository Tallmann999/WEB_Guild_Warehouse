import {BaseScene} from './BaseScene.js';
export class MenuScene extends BaseScene{
  constructor(){super('Menu');}
  paintWorld(snapshot){super.paintWorld(snapshot);this.replaceBackground('environment.menu',snapshot.bounds);}
}
