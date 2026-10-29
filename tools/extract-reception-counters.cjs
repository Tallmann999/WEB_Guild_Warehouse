'use strict';

// Exact foreground extractions: source RGB is never repainted, resampled or
// color-keyed. The only edit to each full-size image is its alpha channel.
// Run: node tools/extract-reception-counters.cjs [--check]
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const sharp=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'dist/assets/New Sprites/counters');
const stages=['derelict','bare-walls','guild-furnished'];
const checkOnly=process.argv.includes('--check');
const search={top:626,bottom:639,horizontalRadius:3,continuityPenalty:9,medianRadius:3};
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');

function traceBackEdge(data,width){
  // The actual back silhouette is around y629..635. Follow its bright lip
  // immediately below the dark separation line. A continuous path avoids
  // selecting isolated floor highlights or a grain line inside the worktop.
  const height=search.bottom-search.top+1,score=new Float64Array(width*height);
  const luminance=(x,y)=>{
    const i=(y*width+x)*4;return data[i]*.25+data[i+1]*.5+data[i+2]*.25;
  };
  for(let x=0;x<width;x++)for(let row=0;row<height;row++){
    const y=search.top+row;let gradient=0;
    for(let dx=-search.horizontalRadius;dx<=search.horizontalRadius;dx++){
      const sx=Math.min(width-1,Math.max(0,x+dx));
      gradient+=luminance(sx,y+1)-luminance(sx,y-1);
    }
    score[x*height+row]=gradient/(search.horizontalRadius*2+1);
  }
  let previous=Array.from({length:height},(_,row)=>score[row]);
  const parents=new Int8Array(width*height);
  for(let x=1;x<width;x++){
    const next=new Array(height);
    for(let row=0;row<height;row++){
      let value=-Infinity,parent=row;
      for(let candidate=Math.max(0,row-1);candidate<=Math.min(height-1,row+1);candidate++){
        const candidateValue=previous[candidate]-Math.abs(candidate-row)*search.continuityPenalty;
        if(candidateValue>value){value=candidateValue;parent=candidate;}
      }
      parents[x*height+row]=parent;next[row]=value+score[x*height+row];
    }
    previous=next;
  }
  let row=previous.indexOf(Math.max(...previous));
  const traced=new Array(width);
  for(let x=width-1;x>=0;x--){
    // Keep the original dark outline above the first fully lit wood row.
    traced[x]=search.top+row-1;row=parents[x*height+row];
  }
  return traced.map((_,x)=>{
    const neighborhood=traced.slice(Math.max(0,x-search.medianRadius),Math.min(width,x+search.medianRadius+1)).sort((a,b)=>a-b);
    return neighborhood[Math.floor(neighborhood.length/2)];
  });
}

function cutAlpha(source,width,height,edge){
  const cut=Buffer.from(source);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4;
    // One source-pixel coverage ramp: row edge-1 is transparent, row edge is
    // half-covered and row edge+1 onward retains the complete source alpha.
    const coverage=Math.min(1,Math.max(0,y-edge[x]+.5));
    cut[i+3]=Math.round(source[i+3]*coverage);
  }
  return cut;
}

async function verify(file,source,width,height,edge,expected){
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,width);assert.equal(info.height,height);assert.equal(info.channels,4);
  const minEdge=Math.min(...edge),maxEdge=Math.max(...edge);
  let transparent=0,partial=0,opaque=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4;
    for(let channel=0;channel<3;channel++)assert.equal(data[i+channel],source[i+channel],'Original RGB changed at '+x+','+y);
    assert.equal(data[i+3],expected[i+3],'Alpha mask differs at '+x+','+y);
    if(data[i+3]===0)transparent++;else if(data[i+3]===255)opaque++;else partial++;
    if(y<minEdge-1)assert.equal(data[i+3],0);
    if(y>maxEdge+1)assert.equal(data[i+3],source[i+3]);
  }
  assert.ok(transparent>width*620);assert.ok(opaque>width*380);assert.ok(partial>0&&partial<=width);
  // Replacing the original counter with this aligned layer is pixel-exact.
  const composite=await sharp(source,{raw:{width,height,channels:4}}).composite([{input:file,left:0,top:0}]).raw().toBuffer();
  let compositeMaxDelta=0;
  for(let i=0;i<composite.length;i+=4)for(let c=0;c<3;c++)compositeMaxDelta=Math.max(compositeMaxDelta,Math.abs(composite[i+c]-source[i+c]));
  assert.equal(compositeMaxDelta,0,'Aligned replacement must be identical to the source');
  return {transparentPixels:transparent,softEdgePixels:partial,opaquePixels:opaque,originalRgbDifferences:0,alignedCompositeMaxRgbDelta:compositeMaxDelta};
}

async function previews(images){
  const strips=[],isolated=[];
  for(let i=0;i<images.length;i++){
    const {source,edge,width,height,file}=images[i],top=602,stripHeight=68;
    const rgba=Buffer.alloc(width*stripHeight*4);
    for(let y=0;y<stripHeight;y++)for(let x=0;x<width;x++){
      const src=((top+y)*width+x)*4,dst=(y*width+x)*4;
      source.copy(rgba,dst,src,src+4);
      if(top+y===edge[x]){rgba[dst]=58;rgba[dst+1]=255;rgba[dst+2]=121;rgba[dst+3]=255;}
    }
    strips.push({input:await sharp(rgba,{raw:{width,height:stripHeight,channels:4}}).png().toBuffer(),left:0,top:i*(stripHeight+6)});
    const checker=Buffer.alloc(width*(height-602)*4);
    for(let y=0;y<height-602;y++)for(let x=0;x<width;x++){
      const j=(y*width+x)*4,c=(Math.floor(x/24)+Math.floor(y/24))%2?218:242;
      checker[j]=c;checker[j+1]=c;checker[j+2]=c;checker[j+3]=255;
    }
    const counter=await sharp(file).extract({left:0,top:602,width,height:height-602}).png().toBuffer();
    const composite=await sharp(checker,{raw:{width,height:height-602,channels:4}}).composite([{input:counter}]).png().toBuffer();
    isolated.push({input:await sharp(composite).resize(768,211).png().toBuffer(),left:0,top:i*217});
  }
  await sharp({create:{width:1536,height:images.length*74,channels:4,background:'#22322a'}}).composite(strips).png().toFile(path.join(output,'counter-contours-preview.png'));
  await sharp({create:{width:768,height:images.length*217,channels:4,background:'#22322a'}}).composite(isolated).png().toFile(path.join(output,'counter-alpha-preview.png'));
}

(async()=>{
  if(!checkOnly)fs.mkdirSync(output,{recursive:true});
  const entries=[],images=[];
  for(const stage of stages){
    const sourceFile=path.join(root,'dist/assets/reception-'+stage+'.png');
    const sourcePng=fs.readFileSync(sourceFile),sourceSha256=hash(sourcePng);
    const {data:source,info}=await sharp(sourcePng).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.equal(info.width,1536);assert.equal(info.height,1024);
    const edge=traceBackEdge(source,info.width),cut=cutAlpha(source,info.width,info.height,edge);
    const file=path.join(output,stage+'-counter.png');
    if(!checkOnly)await sharp(cut,{raw:{width:info.width,height:info.height,channels:4}}).png({compressionLevel:9}).toFile(file);
    const checks=await verify(file,source,info.width,info.height,edge,cut);
    assert.equal(hash(fs.readFileSync(sourceFile)),sourceSha256,'Source PNG must remain unchanged');
    entries.push({stage,source:'dist/assets/reception-'+stage+'.png',sourceSha256,path:'dist/assets/New Sprites/counters/'+stage+'-counter.png',width:info.width,height:info.height,anchor:{x:0,y:0},backEdgeY:{min:Math.min(...edge),max:Math.max(...edge)},edgeByColumn:edge,...checks});
    images.push({source,edge,width:info.width,height:info.height,file});
    console.log('PASS '+stage+': '+info.width+'x'+info.height+', contour y'+Math.min(...edge)+'..'+Math.max(...edge)+', '+checks.opaquePixels+' untouched opaque pixels, exact aligned replacement.');
  }
  if(!checkOnly){
    fs.writeFileSync(path.join(output,'counter-masks.json'),JSON.stringify({format:'lootkeeper-counter-cut-v1',generator:'tools/extract-reception-counters.cjs',method:'Exact source RGB with traced rear silhouette, a one-source-pixel alpha coverage ramp and no resampling/color key/repainting. Full canvas, source registration anchor 0,0. Above silhouette is transparent; entire original wood below is retained.',search,previewOrder:stages,entries},null,2)+'\n');
    await previews(images);
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
