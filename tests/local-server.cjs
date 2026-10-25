'use strict';

const assert=require('node:assert/strict');
const http=require('node:http');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {createServer,probeServer,HOST,GAME_URL}=require('../tools/serve.cjs');

function request(port,url,method='GET'){
  return new Promise((resolve,reject)=>{
    const req=http.request({hostname:HOST,port,path:url,method},response=>{
      let body='';response.setEncoding('utf8');response.on('data',chunk=>{body+=chunk;});
      response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body}));
    });
    req.once('error',reject);req.end();
  });
}

(async()=>{
  const server=createServer();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,HOST,resolve);});
  try{
    const port=server.address().port;
    const page=await request(port,'/');
    assert.equal(page.status,200);assert.match(page.body,/<title>The Lootkeeper/);
    assert.match(page.headers['cache-control'],/no-store/);
    assert.equal(page.headers['x-content-type-options'],'nosniff');
    const script=await request(port,'/game.js?v=launcher-check');
    assert.equal(script.status,200);assert.match(script.headers['content-type'],/^text\/javascript/);
    const phaser=await request(port,'/vendor/phaser.min.js','HEAD');
    assert.equal(phaser.status,200);assert.match(phaser.headers['content-type'],/^text\/javascript/);
    assert.equal(phaser.body,'');assert.ok(Number(phaser.headers['content-length'])>100000);
    const data=await request(port,'/assets/ingredients/catalog.json');
    assert.equal(data.status,200);assert.match(data.headers['content-type'],/^application\/json/);
    assert.doesNotThrow(()=>JSON.parse(data.body));
    assert.equal((await request(port,'/%2e%2e%2fpackage.json')).status,403);
    assert.equal((await request(port,'/%00')).status,400);
    assert.equal((await request(port,'/%ZZ')).status,400);
    assert.equal((await request(port,'/missing-engine-module.js')).status,404);
    const post=await request(port,'/','POST');
    assert.equal(post.status,405);assert.equal(post.headers.allow,'GET, HEAD');
    assert.deepEqual(await probeServer(`http://${HOST}:${port}/`),{busy:true,ready:true});
  }finally{await new Promise(resolve=>server.close(resolve));}

  // --check deliberately never opens a real user browser or reads its storage.
  const checked=JSON.parse(execFileSync(process.execPath,[path.join(__dirname,'../tools/open-game.cjs'),'--check'],{encoding:'utf8'}));
  assert.equal(checked.ready,true);assert.equal(checked.reused,true);
  assert.equal(checked.url,GAME_URL);assert.equal(checked.browserOpened,false);
  console.log('PASS: local server HTML/JS/Phaser/JSON MIME, HEAD, no-cache, safe paths and methods; launcher reuses 127.0.0.1:18765 without opening a browser.');
})().catch(error=>{console.error(error);process.exitCode=1;});
