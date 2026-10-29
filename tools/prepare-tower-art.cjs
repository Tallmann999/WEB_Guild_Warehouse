'use strict';
// Package the independently generated layers; preserve their original alpha.
const fs=require('node:fs');
const path=require('node:path');
const sharp=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
const source=path.join(root,'audit_source/tower-mage');
const output=path.join(root,'dist/assets/tower-mage');
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const layers=[];
  for(const name of ['room','workbench','mechanism','orb']){
    const input=path.join(source,name+'-generated.png');
    const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let left=info.width,top=info.height,right=-1,bottom=-1,transparent=0,partial=0;
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
      const alpha=data[(y*info.width+x)*4+3];
      if(alpha===0)transparent++;
      if(alpha>0&&alpha<255)partial++;
      // The generator leaves isolated alpha 1..12 specks in empty margins.
      // Locate the visible silhouette, keep an eight-pixel edge allowance,
      // and retain all source alpha inside it without color-keying.
      if(alpha>12){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
    }
    if(right<left)throw new Error(name+': empty alpha layer');
    if(name!=='room'&&transparent===0)throw new Error(name+': missing true transparency');
    const crop=name==='room'?{left:0,top:0,width:info.width,height:info.height}:{left:Math.max(0,left-8),top:Math.max(0,top-8),width:Math.min(info.width-1,right+8)-Math.max(0,left-8)+1,height:Math.min(info.height-1,bottom+8)-Math.max(0,top-8)+1};
    let pipeline=sharp(input).extract(crop);
    if(name!=='room')pipeline=pipeline.extend({top:4,bottom:4,left:4,right:4,background:{r:0,g:0,b:0,alpha:0}});
    const result=await pipeline.png({compressionLevel:9}).toFile(path.join(output,name+'.png'));
    layers.push({name,sourceWidth:info.width,sourceHeight:info.height,crop,width:result.width,height:result.height,transparentPixels:transparent,partialAlphaPixels:partial,path:'dist/assets/tower-mage/'+name+'.png'});
  }
  fs.writeFileSync(path.join(source,'layers.json'),JSON.stringify({generator:'built-in image_gen',processing:'Crop empty margins using alpha>12 for visible bounds with eight source pixels of allowance, then add four transparent padding pixels. Source alpha inside the crop is unchanged. No color key, matte, repainting or alpha replacement.',layers},null,2)+'\n');
  console.log(JSON.stringify(layers,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
