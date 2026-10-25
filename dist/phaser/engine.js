import {SceneBridge} from './bridge.js';
import {BootScene} from './scenes/BootScene.js';
import {MenuScene} from './scenes/MenuScene.js';
import {ReceptionScene} from './scenes/ReceptionScene.js';
import {WorkbenchScene} from './scenes/WorkbenchScene.js';
import {CityScene} from './scenes/CityScene.js';
import {TowerScene} from './scenes/TowerScene.js';

const controller={game:null,bridge:null,ready:false,loading:0,failures:[],stats:null,
  boot(options){
    if(this.game)return this;
    if(!window.Phaser)throw new Error('Local Phaser runtime was not loaded');
    this.bridge=new SceneBridge(options);
    const host=document.createElement('div');host.id='phaser-world';host.setAttribute('aria-hidden','true');
    document.getElementById('game').prepend(host);
    const runtime=this;
    const width=Math.max(1,this.bridge.root.clientWidth),height=Math.max(1,this.bridge.root.clientHeight);
    this.game=new Phaser.Game({
      type:Phaser.AUTO,parent:host,width,height,transparent:true,antialias:true,roundPixels:false,
      render:{antialias:true,powerPreference:'high-performance'},
      input:{keyboard:false,mouse:false,touch:false,gamepad:false},
      scene:[BootScene,MenuScene,ReceptionScene,WorkbenchScene,CityScene,TowerScene],
      callbacks:{preBoot(game){game.registry.set('lootkeeper.runtime',runtime);}},
      audio:{noAudio:true},banner:false,fps:{target:60,smoothStep:false}
    });
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.bridge.root);
    return this;
  },
  resize(width=this.bridge?.root.clientWidth,height=this.bridge?.root.clientHeight){
    if(!this.game?.scale)return;
    // Shell dimensions may include its border. The canvas fills the content
    // box, which is also the coordinate space used by bridge snapshots.
    width=this.bridge?.root.clientWidth||width;height=this.bridge?.root.clientHeight||height;
    width=Math.max(1,Math.round(Number(width)||1280));height=Math.max(1,Math.round(Number(height)||800));
    if(this.game.scale.width!==width||this.game.scale.height!==height)this.game.scale.resize(width,height);
  },
  frame(time){return this.bridge.update(time);},
  action(name,...args){return this.bridge?.action(name,...args);},
  destroy(){this.resizeObserver?.disconnect();this.bridge?.dispose();this.game?.destroy(true);this.game=null;this.ready=false;document.getElementById('phaser-world')?.remove();}
};
window.LootkeeperEngine=controller;
if(window.LootkeeperBridge)controller.boot(window.LootkeeperBridge);
else window.addEventListener('lootkeeper:ready',()=>controller.boot(window.LootkeeperBridge),{once:true});
export default controller;
