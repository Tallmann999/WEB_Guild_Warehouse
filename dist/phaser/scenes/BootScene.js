import {ASSETS,assetUrl} from '../assets.js';
export class BootScene extends Phaser.Scene{
  constructor(){super({key:'Boot'});}
  preload(){
    this.runtime=this.game.registry.get('lootkeeper.runtime');
    const label=this.add.text(this.scale.width/2,this.scale.height/2,'The Lootkeeper',{fontFamily:'Georgia',fontSize:'30px',color:'#efd28b'}).setOrigin(.5);
    this.load.on('progress',progress=>this.runtime.loading=Math.round(progress*100));
    this.load.on('loaderror',file=>this.runtime.failures.push(file.key));
    for(const [key,path]of Object.entries(ASSETS))this.load.image(key,assetUrl(path));
    this.load.once('complete',()=>label.destroy());
  }
  create(){
    this.runtime.bridge.enable(this.textures);this.runtime.ready=true;
    this.runtime.bridge.snapshot=this.runtime.bridge.capture();
    this.scene.start(this.runtime.bridge.current().key,{runtime:this.runtime});
  }
}
