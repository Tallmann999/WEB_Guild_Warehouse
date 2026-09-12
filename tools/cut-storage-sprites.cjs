// Exact crops from the supplied transparent sheet; no redrawing or resampling.
const sharp=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const fs=require('node:fs');
const path=require('node:path');
const source=process.argv[2];
if(!source)throw new Error('Pass the original transparent sprite sheet PNG.');
const output=path.resolve(__dirname,'../dist/assets/storage');
const regions={
 crate:[0,70,280,290],weapons:[285,0,255,360],bag:[540,70,220,290],barrel:[765,75,205,285],chest:[980,80,265,280],
 basket:[0,380,285,290],cart:[285,370,310,310],sign:[600,365,340,320],hook:[945,375,130,300],lantern:[1090,365,155,320],
 'tag-crate':[0,685,220,280],'tag-supplies':[240,685,205,280],'tag-weapons':[475,685,210,280],parcel:[695,730,285,230],cage:[1000,695,245,265],
 potions:[0,975,355,265],herbs:[380,975,245,275],case:[635,1000,350,230],ledger:[1000,965,245,285]
};
(async()=>{
 fs.mkdirSync(output,{recursive:true});const manifest={};
 for(const [name,[left,top,width,height]] of Object.entries(regions)){
  const {data}=await sharp(source).extract({left,top,width,height}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  // Keep the largest connected silhouette, discarding stray pixels/adjacent art.
  const seen=new Uint8Array(width*height);let largest=[];
  for(let p=0;p<seen.length;p++){
   if(seen[p]||!data[p*4+3])continue;
   const component=[p];seen[p]=1;
   for(let j=0;j<component.length;j++){
    const q=component[j],x=q%width,y=Math.floor(q/width);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
     const nx=x+dx,ny=y+dy,n=ny*width+nx;
     if(nx<0||nx>=width||ny<0||ny>=height||seen[n]||!data[n*4+3])continue;
     seen[n]=1;component.push(n);
    }
   }
   if(component.length>largest.length)largest=component;
  }
  const keep=new Uint8Array(width*height);let x0=width,y0=height,x1=0,y1=0;
  for(const p of largest){keep[p]=1;x0=Math.min(x0,p%width);x1=Math.max(x1,p%width);y0=Math.min(y0,Math.floor(p/width));y1=Math.max(y1,Math.floor(p/width));}
  for(let p=0;p<keep.length;p++)if(!keep[p])data.fill(0,p*4,p*4+4);
  await sharp(data,{raw:{width,height,channels:4}}).extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}).extend({top:4,bottom:4,left:4,right:4,background:{r:0,g:0,b:0,alpha:0}}).png().toFile(path.join(output,name+'.png'));
  manifest[name]={sourceBounds:[left+x0,top+y0,x1-x0+1,y1-y0+1],padding:4};
 }
 fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 // A neutral background makes crop errors and alpha boundaries visible.
 const cells=await Promise.all(Object.keys(regions).map(async(name,i)=>({input:await sharp(path.join(output,name+'.png')).resize(180,180,{fit:'inside'}).extend({top:4,bottom:4,left:4,right:4,background:'#77716a'}).png().toBuffer(),left:(i%5)*210+10,top:Math.floor(i/5)*210+10})));
 await sharp({create:{width:1050,height:840,channels:4,background:'#77716a'}}).composite(cells).png().toFile(path.resolve(__dirname,'../audit_source/storage-cutouts.png'));
 console.log(`Cut ${Object.keys(regions).length} sprites into ${output}`);
})().catch(e=>{console.error(e);process.exitCode=1});
