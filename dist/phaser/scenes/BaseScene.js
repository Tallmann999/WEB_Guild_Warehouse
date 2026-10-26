export class BaseScene extends Phaser.Scene{
  constructor(key){super({key});this.views=new Map();}
  init(data){this.runtime=data.runtime||this.game.registry.get('lootkeeper.runtime');}
  create(){
    this.runtime.bridge.activeScene=this;
    this.backgroundSignature='';this.shopSignature='';this.views.clear();
    this.visualTime=0;this.visualAt=performance.now();this.visualPaused=false;
    this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const visibility=()=>{this.visualAt=performance.now();this.visualPaused=true;};
    document.addEventListener('visibilitychange',visibility);
    this.input.on('gameobjectdown',(pointer,object,event)=>object.emit('pointerdown',pointer,0,0,event));
    this.world=this.add.graphics();this.world.setDepth(0);
    this.backgrounds=[];this.surfaceViews=new Map();this.clipGroups=new Map();
    this.events.once('shutdown',()=>{
      this.input.removeAllListeners('gameobjectdown');
      document.removeEventListener('visibilitychange',visibility);
      for(const group of this.clipGroups.values())group.art.destroy();
      this.clipGroups.clear();this.views.clear();
    });
    this.draw(this.runtime.bridge.current());
  }
  update(){
    const snapshot=this.runtime.frame(performance.now());
    if(snapshot.key!==this.scene.key){this.scene.start(snapshot.key,{runtime:this.runtime});return;}
    this.draw(snapshot);
  }
  image(key,rect,depth=0,fit='cover',alpha=1){
    if(!rect||!this.textures.exists(key))return null;
    const image=this.add.image(rect.x+rect.width/2,rect.y+rect.height/2,key).setDepth(depth).setAlpha(alpha);
    const source=image.texture.getSourceImage();const ratio=(fit==='contain'?Math.min:Math.max)(rect.width/source.width,rect.height/source.height);
    image.setDisplaySize(source.width*ratio,source.height*ratio);return image;
  }
  replaceBackground(key,rect,alpha=1){
    const signature=JSON.stringify([key,rect,alpha]);if(signature===this.backgroundSignature)return;
    this.backgroundSignature=signature;this.backgrounds.forEach(x=>x.destroy());this.backgrounds=[];
    const image=this.image(key,rect,0,'cover',alpha);if(image)this.backgrounds.push(image);
  }
  paintWorld(snapshot){this.world.clear();}
  draw(snapshot){
    const now=performance.now();
    // Visual entry uses elapsed active time, not Phaser's capped render delta.
    // Slow frames must not leave a new visitor invisible for several seconds.
    if(!snapshot.paused&&!this.visualPaused)this.visualTime+=Math.max(0,now-this.visualAt);
    this.visualAt=now;this.visualPaused=snapshot.paused;
    if(snapshot.paused)this.tweens.pauseAll();else this.tweens.resumeAll();
    this.paintWorld(snapshot);this.sync(snapshot.sprites);
    if(snapshot.paused)this.tweens.pauseAll();
    this.runtime.stats={scene:this.scene.key,frames:this.runtime.bridge.frame,sprites:this.views.size,textures:this.textures.getTextureKeys().length,masks:this.clipGroups.size,inputEvents:this.runtime.bridge.inputEvents,native:true};
  }
  sync(descriptors){
    const present=new Set(),clips=new Set();
    for(const d of descriptors){
      if(!this.textures.exists(d.key))continue;present.add(d.id);
      let entry=this.views.get(d.id);
      if(!entry){
        const sprite=this.add.image(d.x,d.y,d.key);entry={sprite,key:d.key,entering:false};this.views.set(d.id,entry);
        sprite.setInteractive();sprite.on('pointerdown',(pointer,x,y,event)=>this.runtime.bridge.receivePointer(d.id,event||pointer.event));
        if(d.motion&&!this.reducedMotion){
          entry.entering=true;entry.enteredAt=this.visualTime;
        }
      }
      const {sprite}=entry;
      if(entry.key!==d.key){sprite.setTexture(d.key);entry.key=d.key;}
      if(entry.entering){
        const progress=Math.min(1,(this.visualTime-entry.enteredAt)/(d.motion==='visitor'?620:700));
        const eased=d.motion==='visitor'?Math.sin(progress*Math.PI/2):Phaser.Math.Easing.Bounce.Out(progress);
        sprite.setPosition(d.x-(d.motion==='visitor'?55*(1-eased):0),d.y-(d.motion==='bag'?70*(1-eased):0)).setAlpha(d.alpha*Math.sin(progress*Math.PI/2));
        if(progress===1)entry.entering=false;
      }else sprite.setPosition(d.x,d.y).setAlpha(d.alpha);
      const source=sprite.texture.getSourceImage(),ratio=(d.fit==='cover'?Math.max:Math.min)(d.width/source.width,d.height/source.height);
      sprite.setDisplaySize(source.width*ratio,source.height*ratio).setAngle(d.angle).setFlipX(d.flipX).setDepth(d.layer);
      sprite.setTint(d.unknown?0x151415:0xffffff);
      if(d.selected||d.hovered){
        if(!entry.glow)entry.glow=this.add.graphics();
        const glow=entry.glow;glow.clear().setPosition(sprite.x,sprite.y).setDepth(d.layer-.05).setAlpha(sprite.alpha).setVisible(true);
        this.paintAura(glow,d);
      }else entry.glow?.setVisible(false);
      if(d.mask){
        const signature=JSON.stringify(d.mask);clips.add(signature);
        let group=this.clipGroups.get(signature);
        if(!group){
          const art=this.make.graphics({x:0,y:0});art.fillStyle(0xffffff).fillRect(d.mask.x,d.mask.y,d.mask.width,d.mask.height);
          const container=this.add.container(0,0).setDepth(d.layer);
          if(this.game.renderer.type===Phaser.WEBGL){
            // Phaser4 replaced WebGL GeometryMask with mask filters. One
            // filter per scroll region keeps all item sprites in one batch.
            container.enableFilters();const filter=container.filters.external.addMask(art);filter.autoUpdate=false;
          }else container.setMask(art.createGeometryMask());
          group={container,art};this.clipGroups.set(signature,group);
        }
        if(sprite.parentContainer!==group.container)group.container.add(sprite);
        if(entry.glow&&entry.glow.parentContainer!==group.container)group.container.add(entry.glow);
      }else{
        if(sprite.parentContainer){sprite.parentContainer.remove(sprite);this.add.existing(sprite);}
        if(entry.glow?.parentContainer){entry.glow.parentContainer.remove(entry.glow);this.add.existing(entry.glow);}
      }
    }
    for(const [id,entry]of this.views){
      if(present.has(id))continue;
      this.views.delete(id);this.tweens.killTweensOf(entry.sprite);
      entry.glow?.destroy();
      if(id.startsWith('visitor:'))this.tweens.add({targets:entry.sprite,x:entry.sprite.x+65,alpha:0,duration:400,onComplete:()=>entry.sprite.destroy()});
      else entry.sprite.destroy();
    }
    for(const [signature,group]of this.clipGroups){
      if(!clips.has(signature)){group.container.destroy();group.art.destroy();this.clipGroups.delete(signature);}
      else group.container.sort('depth');
    }
  }
  paintAura(glow,d){
    const phase=this.reducedMotion?0:this.visualTime/1000,pulse=.94+.06*Math.sin(phase*2.2),rx=d.width*.88*pulse,ry=d.height*.84*pulse;
    // Soft gold close to the silhouette, with distinct tapered sun rays. The
    // entire Graphics object sorts below its opaque image, including in masks.
    for(let ring=6;ring>=1;ring--)glow.fillStyle(0xffdf94,.019*(7-ring)).fillEllipse(0,0,rx*(.72+ring*.12),ry*(.72+ring*.12));
    for(let ray=0;ray<16;ray++){
      const angle=ray*Math.PI/8+Math.sin(phase*.6)*.025,wide=ray%2===0,tip=wide?1: .81,base=.29,half=wide?.11:.07;
      glow.fillStyle(wide?0xffe9a6:0xfff5d0,(d.selected?.72:.64)*(wide?1:.8));
      glow.fillTriangle(Math.cos(angle-half)*rx*base,Math.sin(angle-half)*ry*base,Math.cos(angle)*rx*tip,Math.sin(angle)*ry*tip,Math.cos(angle+half)*rx*base,Math.sin(angle+half)*ry*base);
    }
    glow.fillStyle(0xffd568,.065).fillEllipse(0,0,rx*.85,ry*.85);
  }
}
