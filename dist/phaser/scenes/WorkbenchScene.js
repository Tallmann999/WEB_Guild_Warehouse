import {BaseScene} from './BaseScene.js';
export class WorkbenchScene extends BaseScene{
  constructor(){super('Workbench');}
  paintWorld(s){
    super.paintWorld(s);const g=this.world,b=s.bounds;
    g.fillGradientStyle(0x62513d,0x62513d,0x211e1a,0x211e1a,1).fillRect(b.x,b.y,b.width,b.height);
    const table=s.surfaces.table?.rect;
    if(table){
      g.fillStyle(0x24180f).fillRoundedRect(table.x-3,table.y-3,table.width+6,table.height+6,15);
      g.fillStyle(0x493321).fillRoundedRect(table.x,table.y,table.width,table.height,13);
      g.fillGradientStyle(0x936b42,0xaf8250,0x77512f,0x93623a,1).fillRoundedRect(table.x+11,table.y+11,table.width-22,table.height-22,5);
      for(let y=table.y+78;y<table.y+table.height-10;y+=78)g.lineStyle(3,0x3b2617,.35).lineBetween(table.x+12,y,table.x+table.width-12,y);
    }
    const present=new Set();
    for(const [id,surface]of Object.entries(s.surfaces)){
      if(!surface.open)continue;present.add(id);
      let image=this.surfaceViews.get(id);
      if(!image){image=this.image('prop.box-top',surface.rect,['inspector','targetPreview'].includes(id)?40:12,'cover');this.surfaceViews.set(id,image);}
      const r=surface.rect;image.setPosition(r.x+r.width/2,r.y+r.height/2).setDisplaySize(r.width*1.07,r.height*1.12);
    }
    for(const [id,image]of this.surfaceViews)if(!present.has(id)){image.destroy();this.surfaceViews.delete(id);}
  }
}
