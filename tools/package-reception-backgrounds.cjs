'use strict';
// Keep the original daytime room pixels; use image_gen only for the revealed floor.
const fs=require('node:fs');
const path=require('node:path');
const sharp=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'dist/assets/New Sprites');
const states=['derelict','bare-walls','guild-furnished'];
const width=1536,height=1024;
(async()=>{
  fs.mkdirSync(path.join(output,'backgrounds'),{recursive:true});
  const manifest=[];
  for(const state of states){
    const original=await sharp(path.join(root,'dist/assets/reception-'+state+'.png')).removeAlpha().raw().toBuffer();
    const generated=await sharp(path.join(output,'sources',state+'-day-generated.png')).resize(width,height,{fit:'fill'}).removeAlpha().raw().toBuffer();
    const pixels=Buffer.from(original);
    // At 624 the replacement is complete, before the nearest counter begins.
    // All architecture, the city, cage, canary and clock above 600 stay exact.
    for(let y=600;y<height;y++){
      const linear=Math.min(1,(y-600)/24),blend=linear*linear*(3-2*linear);
      for(let x=0;x<width;x++)for(let c=0;c<3;c++){
        const i=(y*width+x)*3+c;pixels[i]=Math.round(original[i]*(1-blend)+generated[i]*blend);
      }
    }
    await sharp(pixels,{raw:{width,height,channels:3}}).png({compressionLevel:9}).toFile(path.join(output,'backgrounds',state+'-day.png'));
    manifest.push({state,day:{source:'../../reception-'+state+'.png',generation:'sources/'+state+'-day-generated.png',file:'backgrounds/'+state+'-day.png',originalPixelsUnchangedThroughY:599,transitionRows:[600,623],reconstructedFloorFromY:624}});
    const night=path.join(output,'sources',state+'-night-generated.png');
    if(fs.existsSync(night)){
      await sharp(night).resize(width,height,{fit:'fill'}).removeAlpha().png({compressionLevel:9}).toFile(path.join(output,'backgrounds',state+'-night.png'));
      manifest[manifest.length-1].night={source:'backgrounds/'+state+'-day.png',generation:'sources/'+state+'-night-generated.png',file:'backgrounds/'+state+'-night.png',edit:'ImageGen lighting-only edit, same camera and layout'};
    }
  }
  fs.writeFileSync(path.join(output,'sources/backgrounds-manifest.json'),JSON.stringify({width,height,states:manifest},null,2)+'\n');
  console.log('Packaged opaque 1536x1024 backgrounds; original day pixels y0..599 preserved.');
})().catch(error=>{console.error(error);process.exitCode=1;});
