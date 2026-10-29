'use strict';
const fs=require('node:fs'),path=require('node:path');
const sharp=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const base=path.resolve(__dirname,'../dist/assets/New Sprites/Mage Tower');
async function trim(input){
  const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let x0=info.width,y0=info.height,x1=-1,y1=-1,zero=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const a=data[(y*info.width+x)*4+3];if(!a)zero++;if(a>16){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}}
  if(!zero||x1<x0)throw Error('Missing real alpha: '+input);
  return sharp(input).extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}).png().toBuffer();
}
(async()=>{
  const manifest={canvas:{width:1536,height:1024},installed:false,counter:{x:-192,y:735,width:1920,height:389,overscanEachSide:192},orb:{x:720,y:810,width:120},machine:{x:190,y:810,width:410},stages:[]};
  for(let stage=1;stage<=3;stage++){
    await sharp(path.join(base,'sources/room-'+stage+'.png')).resize(1536,1024).removeAlpha().png().toFile(path.join(base,'backgrounds/stage-'+stage+'.png'));
    const counter=await trim(path.join(base,'sources/counter-'+stage+'.png'));
    // Rear bevel corners live outside the level. Trim the three faint alpha
    // rows so the visible rear edge is continuous from the first pixel row.
    await sharp(counter).resize(1920,392,{fit:'fill'}).extract({left:0,top:3,width:1920,height:389}).png().toFile(path.join(base,'counters/stage-'+stage+'.png'));
    manifest.stages.push({stage,background:'backgrounds/stage-'+stage+'.png',counter:'counters/stage-'+stage+'.png',orb:stage===3?'props/orb-clean.png':'props/orb-dusty.png',machine:stage>=2?'props/machine.png':null});
  }
  await sharp(await trim(path.join(base,'sources/orb-dusty.png'))).png().toFile(path.join(base,'props/orb-dusty.png'));
  fs.copyFileSync(path.resolve(__dirname,'../dist/assets/tower-mage/orb.png'),path.join(base,'props/orb-clean.png'));
  fs.copyFileSync(path.resolve(__dirname,'../dist/assets/tower-mage/mechanism.png'),path.join(base,'props/machine.png'));
  const sheets=[];
  for(const s of manifest.stages){
    const parts=[];
    parts.push({input:await sharp(path.join(base,s.counter)).extract({left:192,top:0,width:1536,height:289}).toBuffer(),left:0,top:735});
    if(s.machine){const m=await sharp(path.join(base,s.machine)).resize({width:410}).png().toBuffer(),meta=await sharp(m).metadata();parts.push({input:m,left:190,top:810-meta.height});}
    const orb=await sharp(path.join(base,s.orb)).resize({width:120}).png().toBuffer(),meta=await sharp(orb).metadata();parts.push({input:orb,left:720,top:810-meta.height});
    const preview=await sharp(path.join(base,s.background)).composite(parts).png().toBuffer();
    fs.writeFileSync(path.join(base,'previews/stage-'+s.stage+'.png'),preview);
    sheets.push({input:await sharp(preview).resize(768,512).png().toBuffer(),left:(s.stage-1)*768,top:0});
  }
  await sharp({create:{width:2304,height:512,channels:3,background:'#191b20'}}).composite(sheets).png().toFile(path.join(base,'previews/three-stages.png'));
  fs.writeFileSync(path.join(base,'layers.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log('PASS: 3 backgrounds + 3 alpha counters + dusty/clean orb + machine; 3 assembled previews, not installed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
