const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const sharp=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
(async()=>{
 const dir=path.resolve(__dirname,'../dist/assets/storage');
 const files=fs.readdirSync(dir).filter(f=>f.endsWith('.png')&&!['open-crate.png','box-top.png'].includes(f));assert.equal(files.length,19);
 for(const f of files){
  const {data,info}=await sharp(path.join(dir,f)).raw().toBuffer({resolveWithObject:true});assert.equal(info.channels,4);
  for(let x=0;x<info.width;x++){assert.equal(data[x*4+3],0,f);assert.equal(data[((info.height-1)*info.width+x)*4+3],0,f);}
  for(let y=0;y<info.height;y++){assert.equal(data[(y*info.width)*4+3],0,f);assert.equal(data[(y*info.width+info.width-1)*4+3],0,f);}
 }
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file:///'+path.resolve(__dirname,'../dist/index.html').replaceAll('\\','/'));
  await page.locator('#startGame').click();await page.locator('#buyBag').waitFor();
  await page.screenshot({path:path.resolve(__dirname,'../audit_source/storage-reception.png'),animations:'disabled'});
  await page.locator('#buyBag').click();
  await page.locator('#shelves img').evaluateAll(async nodes=>{await Promise.all(nodes.map(n=>n.decode()));});
  assert.equal(await page.locator('#shelves .tag img').count(),0);
  assert.equal(await page.locator('#shelves .category-icon').count(),0);
  await page.screenshot({path:path.resolve(__dirname,'../audit_source/storage-sorting.png'),animations:'disabled'});
  assert.deepEqual(errors,[]);
  console.log('PASS: 19 transparent padded cutouts, shelf art loaded, plain labels, reception and sorting');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
