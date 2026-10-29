'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createPreviewServer,ASSETS_ROOT}=require('../tools/preview-reception-layers.cjs');
const ROOT=path.join(ASSETS_ROOT,'New Sprites'),STAGES=['derelict','bare-walls','guild-furnished'];

// Decode the PNG's stored channels, independent of browser color management.
function png(file){
  const data=fs.readFileSync(file);assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a',file+': PNG signature');
  let width,height,channels;const chunks=[];
  for(let at=8;at<data.length;){
    const length=data.readUInt32BE(at),kind=data.toString('ascii',at+4,at+8),body=data.subarray(at+8,at+8+length);at+=length+12;
    if(kind==='IHDR'){
      width=body.readUInt32BE(0);height=body.readUInt32BE(4);assert.equal(body[8],8,file+': 8-bit pixels');assert.equal(body[12],0,file+': no interlacing');
      channels=({0:1,2:3,4:2,6:4})[body[9]];assert.ok(channels,file+': supported grayscale/RGB/RGBA channels');
    }else if(kind==='IDAT')chunks.push(body);else if(kind==='IEND')break;
  }
  assert.ok(width>0&&height>0&&width*height<10000000,file+': bounded image dimensions');
  const packed=zlib.inflateSync(Buffer.concat(chunks)),stride=width*channels,raw=Buffer.alloc(stride*height);
  assert.equal(packed.length,(stride+1)*height,file+': full PNG scanlines');
  const paeth=(a,b,c)=>{const p=a+b-c,aa=Math.abs(p-a),bb=Math.abs(p-b),cc=Math.abs(p-c);return aa<=bb&&aa<=cc?a:bb<=cc?b:c;};
  for(let y=0;y<height;y++){
    const filter=packed[y*(stride+1)];assert.ok(filter<=4,file+': valid PNG filter');
    for(let x=0;x<stride;x++){
      const left=x>=channels?raw[y*stride+x-channels]:0,up=y?raw[(y-1)*stride+x]:0,corner=y&&x>=channels?raw[(y-1)*stride+x-channels]:0;
      const predictor=filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):paeth(left,up,corner);
      raw[y*stride+x]=(packed[y*(stride+1)+x+1]+predictor)&255;
    }
  }
  const rgba=Buffer.alloc(width*height*4);
  for(let i=0;i<width*height;i++){
    const at=i*channels,out=i*4;
    if(channels<3){rgba[out]=rgba[out+1]=rgba[out+2]=raw[at];rgba[out+3]=channels===2?raw[at+1]:255;}
    else{rgba[out]=raw[at];rgba[out+1]=raw[at+1];rgba[out+2]=raw[at+2];rgba[out+3]=channels===4?raw[at+3]:255;}
  }
  return {width,height,rgba};
}
function dimensions(image,label){assert.deepEqual([image.width,image.height],[1536,1024],label+': full source-sized canvas');}
function verifyAssets(){
  const counterNames=STAGES.map(stage=>stage+'-counter.png').sort(),backgroundNames=STAGES.flatMap(stage=>['day','night'].map(time=>stage+'-'+time+'.png')).sort();
  assert.deepEqual(fs.readdirSync(path.join(ROOT,'counters')).filter(name=>/-counter\.png$/i.test(name)).sort(),counterNames,'Exactly three named counter PNGs (independent review sheets are excluded)');
  assert.deepEqual(fs.readdirSync(path.join(ROOT,'backgrounds')).filter(name=>/\.png$/i.test(name)).sort(),backgroundNames,'Exactly six named background PNGs');
  for(const stage of STAGES){
    const original=png(path.join(ASSETS_ROOT,'reception-'+stage+'.png')),counter=png(path.join(ROOT,'counters',stage+'-counter.png'));dimensions(original,stage+' original');dimensions(counter,stage+' counter');
    let transparent=0,opaque=0,edge=0;
    for(let pixel=0;pixel<1536*1024;pixel++){
      const at=pixel*4,alpha=counter.rgba[at+3];
      if(alpha===0)transparent++;else if(alpha===255){
        opaque++;for(let channel=0;channel<3;channel++)assert.equal(counter.rgba[at+channel],original.rgba[at+channel],stage+': exact original RGB at opaque pixel '+pixel);
      }else edge++;
      if(pixel<1536*600)assert.equal(alpha,0,stage+': upper room is transparent in the counter layer');
      if(pixel>=1536*900)assert.equal(alpha,255,stage+': lower counter face has no transparent holes');
    }
    assert.ok(transparent>1536*1024*.5&&opaque>1536*1024*.25,stage+': meaningful transparency and original foreground');
    assert.ok(edge<1536*12,stage+': antialiasing stays near the cut edge');
    for(const time of ['day','night']){
      const room=png(path.join(ROOT,'backgrounds',stage+'-'+time+'.png'));dimensions(room,stage+' '+time);
      for(let at=3;at<room.rgba.length;at+=4)assert.equal(room.rgba[at],255,stage+' '+time+': opaque room including the newly painted floor');
      if(time==='day'){
        for(let pixel=0;pixel<1536*600;pixel++)for(let channel=0;channel<3;channel++){
          const at=pixel*4+channel;
          assert.equal(room.rgba[at],original.rgba[at],stage+': day rows 0..599 preserve exact original RGB at pixel '+pixel);
        }
      }
    }
    console.log('Checked '+stage+': '+opaque+' exact opaque source pixels; '+transparent+' transparent pixels; '+edge+' edge pixels; two complete backgrounds');
  }
}
async function range(page,id,value){await page.locator('#'+id).evaluate((input,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));},String(value));}
async function sceneShot(page,name){await page.locator('#mainScene').screenshot({path:path.join(ROOT,'previews',name+'.png')});}
async function verifyPreview(){
  const server=createPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port,errors=[],failures=[];
  let browser;
  try{
    browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1100}}),page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400)failures.push(response.status()+' '+response.url());});
    await page.goto(url+'/New%20Sprites/preview.html');await page.waitForFunction(()=>window.previewReady&&[...document.images].every(image=>image.complete&&image.naturalWidth>0));
    assert.equal(await page.evaluate(()=>typeof state),'undefined','The preview does not load the game simulation');assert.equal(await page.evaluate(()=>localStorage.length),0,'The separate preview has no game save');
    assert.deepEqual(await page.locator('#stage option').evaluateAll(options=>options.map(option=>option.value)),STAGES);
    assert.deepEqual(await page.locator('#counterY').evaluate(input=>[input.min,input.max]),['-80','280']);
    const stack=await page.locator('#mainScene').evaluate(element=>[...element.querySelectorAll('img')].map(image=>({id:image.id,z:Number(getComputedStyle(image).zIndex)})));
    assert.ok(stack.find(x=>x.id==='dayLayer').z<stack.find(x=>x.id==='nightLayer').z&&stack.find(x=>x.id==='nightLayer').z<stack.find(x=>x.id==='actorLayer').z&&stack.find(x=>x.id==='actorLayer').z<stack.find(x=>x.id==='counterLayer').z,'The real character stands between background and foreground');
    fs.mkdirSync(path.join(ROOT,'previews'),{recursive:true});
    for(const stage of STAGES){
      await page.locator('#stage').selectOption(stage);await page.waitForFunction(()=>window.previewReady);await page.locator('#resetY').click();
      for(const [time,value]of [['day',0],['night',100]]){await range(page,'blend',value);assert.equal(await page.locator('#nightLayer').evaluate(image=>Number(getComputedStyle(image).opacity)),value/100);await sceneShot(page,stage+'-'+time+'-layers');}
      await range(page,'blend',50);assert.equal(await page.locator('#nightLayer').evaluate(image=>Number(getComputedStyle(image).opacity)),.5,'Halfway slider blends the actual night background');
    }
    await range(page,'blend',0);const before=await page.locator('#counterLayer').boundingBox(),frame=await page.locator('#mainScene').boundingBox();
    await page.locator('#lowerY').click();const after=await page.locator('#counterLayer').boundingBox();assert.ok(Math.abs(after.y-before.y-180*frame.height/1024)<1,'The 180 source-pixel shift moves the counter independently at preview scale');
    assert.equal(await page.locator('#counterY').inputValue(),'180');await sceneShot(page,'guild-furnished-counter-lowered-180');
    await page.locator('#showCounter').uncheck();assert.equal(await page.locator('#counterLayer').isVisible(),false);await page.locator('#showActor').uncheck();await sceneShot(page,'guild-furnished-floor-without-counter');
    await page.locator('#contactSheet').screenshot({path:path.join(ROOT,'previews','reception-layers-contact-sheet.png')});
    assert.equal(await page.locator('#contactGrid .card').count(),6,'The comparison sheet includes every stage and light state');
    assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);await context.close();
    const game=await fetch(url+'/index.html');assert.equal(game.status,404,'The assets-only server does not serve the game HTML');
    console.log('Checked private Edge preview: three stages, day/night crossfade, independent 180px counter shift, real character between layers, toggles and six-card contact sheet; no game/save loaded');
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
(async()=>{verifyAssets();if(!process.argv.includes('--pixels-only'))await verifyPreview();console.log('PASS: 3 exact transparent counters + 6 opaque 1536x1024 room backgrounds'+(process.argv.includes('--pixels-only')?'':' and isolated interactive preview')+'.');})().catch(error=>{console.error(error);process.exitCode=1;});
