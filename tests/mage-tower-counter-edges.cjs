'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const sharp=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createPreviewServer}=require('../tools/preview-reception-layers.cjs');
(async()=>{
  const base=path.resolve('dist/assets/New Sprites/Mage Tower');
  for(let stage=1;stage<=3;stage++){
    const {data,info}=await sharp(path.join(base,'counters/stage-'+stage+'.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.deepEqual([info.width,info.height],[1920,389]);
    // Inspect every visible pixel, including both frame edges and rear edge.
    for(let y=0;y<289;y++)for(let x=192;x<1728;x++)assert.ok(data[(y*info.width+x)*4+3]>=240,`stage${stage}: hole at ${x-192},${y}`);
  }
  const server=createPreviewServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const p=await browser.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.goto('http://127.0.0.1:'+server.address().port+'/New%20Sprites/Mage%20Tower/preview.html');
    for(const width of [1920,820]){
      await p.setViewportSize({width,height:1080});
      for(const stage of ['1','2','3']){
        await p.locator('#stage').selectOption(stage);await p.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
        const r=await p.evaluate(()=>{const frame=document.getElementById('scene').getBoundingClientRect(),counter=document.getElementById('counter').getBoundingClientRect();return {left:counter.left-frame.left,right:counter.right-frame.right,ratio:counter.width/frame.width,overflow:getComputedStyle(document.getElementById('scene')).overflow};});
        assert.ok(r.left<0&&r.right>0);assert.ok(Math.abs(r.ratio-1.25)<.001);assert.equal(r.overflow,'hidden');
      }
    }
    assert.deepEqual(errors,[]);console.log('PASS: all visible counter pixels opaque in all 3 stages; both ends extend outside the clipped frame at 1920/820 widths.');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
