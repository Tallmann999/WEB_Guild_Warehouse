import {BaseScene} from './BaseScene.js';
export class ReceptionScene extends BaseScene{
  constructor(){super('Reception');}
  paintWorld(s){
    super.paintWorld(s);
    const derelict=s.story&&s.stage===0&&this.textures.exists('environment.shop-derelict');
    const key=s.story?(derelict?'environment.shop-derelict':'environment.shop-bare'):'environment.shop';
    const cleaning=derelict&&s.restoration?.kind==='clean'?Math.min(1,Math.max(0,s.restoration.elapsed/4)):0;
    const signature=JSON.stringify([key,s.bounds,s.counter]);
    if(signature!==this.shopSignature){
      this.shopSignature=signature;this.backgrounds.forEach(x=>x.destroy());this.backgrounds=[];
      const base=this.image(key,s.bounds);if(base)this.backgrounds.push(base);
      if(derelict){const clean=this.image('environment.shop-bare',s.bounds,.5,'cover',cleaning);if(clean){clean.cleanOverlay=true;this.backgrounds.push(clean);}}
      const furnished=this.image('environment.shop-furnished',s.bounds,1,'cover',s.furnished);if(furnished)this.backgrounds.push(furnished);
      // Same source and camera, drawn after visitors through the foreground
      // counter's crop. Visitors can never cover the front of the shop counter.
      const layers=[[key,1,25],...(derelict?[['environment.shop-bare',cleaning,25.5]]:[]),['environment.shop-furnished',s.furnished,26]];
      for(const [texture,alpha,depth]of layers)if(s.counter){
        const front=this.image(texture,s.bounds,depth,'cover',alpha);
        if(derelict&&texture==='environment.shop-bare')front.cleanOverlay=true;
        const left=front.x-front.displayWidth/2,top=front.y-front.displayHeight/2;
        front.setCrop((s.counter.x-left)/front.scaleX,(s.counter.y-top)/front.scaleY,s.counter.width/front.scaleX,s.counter.height/front.scaleY);
        this.backgrounds.push(front);
      }
    }
    for(const image of this.backgrounds){
      if(image.cleanOverlay)image.setAlpha(cleaning);
      else if(image.texture.key==='environment.shop-furnished')image.setAlpha(s.furnished);
    }
    if(s.night>0)this.world.fillStyle(0x0a1435,s.night*.57).fillRect(s.bounds.x,s.bounds.y,s.bounds.width,s.bounds.height*.68);
    if(s.evening>0)this.world.fillStyle(0x8a3b26,s.evening*.18).fillRect(s.bounds.x,s.bounds.y,s.bounds.width,s.bounds.height*.68);
  }
}
