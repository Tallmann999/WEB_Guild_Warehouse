'use strict';

const path=require('node:path');
const {spawn}=require('node:child_process');
const {probeServer,GAME_URL}=require('./serve.cjs');
const repoRoot=path.resolve(__dirname,'..');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function ensureServer(){
  const initial=await probeServer();
  if(initial.ready)return {reused:true};
  if(initial.busy)throw new Error('Port 18765 belongs to another application. The game was not opened.');
  const child=spawn(process.execPath,[path.join(__dirname,'serve.cjs')],{
    cwd:repoRoot,detached:true,stdio:'ignore',windowsHide:true
  });
  let launchError;
  child.once('error',error=>{launchError=error;});child.unref();
  for(let attempt=0;attempt<50;attempt++){
    if(launchError)throw launchError;
    await sleep(200);
    const status=await probeServer();
    if(status.ready)return {reused:false};
    if(status.busy)throw new Error('Port 18765 belongs to another application. The game was not opened.');
  }
  throw new Error('The local game server did not start. Run node tools/serve.cjs to see its error.');
}

function openBrowser(){
  return new Promise((resolve,reject)=>{
    // The only shell input is this fixed loopback URL; no user-supplied path,
    // save value, or command text is interpolated into the Windows start command.
    const executable=process.platform==='win32'?'cmd.exe':process.platform==='darwin'?'open':'xdg-open';
    const args=process.platform==='win32'?['/d','/s','/c',`start "" "${GAME_URL}"`]:[GAME_URL];
    const child=spawn(executable,args,{cwd:repoRoot,detached:true,stdio:'ignore',windowsHide:true});
    child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});
  });
}

async function main(){
  const {reused}=await ensureServer();
  if(process.argv.some(value=>['--check','--headless','--no-browser'].includes(value))){
    console.log(JSON.stringify({ready:true,reused,url:GAME_URL,browserOpened:false}));return;
  }
  await openBrowser();
  console.log('The Lootkeeper: '+GAME_URL+(reused?' (existing server)':''));
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={ensureServer};
