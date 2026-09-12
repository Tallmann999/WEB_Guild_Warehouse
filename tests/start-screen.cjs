const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file:///'+path.resolve(__dirname,'../dist/index.html').replaceAll('\\','/'));
  await page.clock.install();
  assert.equal(await page.locator('#startScreen').isVisible(),true);
  assert.equal(await page.locator('#reception').isVisible(),false);
  assert.equal(await page.locator('#game>header').isVisible(),false);
  assert.equal(await page.locator('#startGame').textContent(),'Начать');
  await page.screenshot({path:path.resolve(__dirname,'../audit_source/start-screen.png')});
  await page.locator('#startGame').click();
  assert.equal(await page.locator('#startScreen').isVisible(),false);
  assert.equal(await page.locator('#visitor').isVisible(),false);
  assert.equal(await page.locator('#speech').isVisible(),false);
  await page.clock.runFor(1900);
  assert.equal(await page.locator('#visitor').isVisible(),false);
  await page.clock.runFor(200);
  assert.equal(await page.locator('#visitor').isVisible(),true);
  assert.equal(await page.locator('#buyBag').isVisible(),true);
  await page.clock.runFor(700);
  await page.screenshot({path:path.resolve(__dirname,'../audit_source/visitor-left-info.png'),animations:'disabled'});
  const speech=await page.locator('#speech').boundingBox(),visitor=await page.locator('#visitor').boundingBox();
  assert.ok(speech.x+speech.width+40<=visitor.x);
  assert.equal(await page.locator('#speech').evaluate(n=>getComputedStyle(n).backgroundImage),'none');
  await page.locator('#buyBag').click();
  assert.equal(await page.evaluate(()=>state.gold),70);
  assert.deepEqual(errors,[]);
  console.log('PASS: start screen, empty counter, delayed visitor, left info panel, purchase');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
