'use strict';

const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../dist');
const HOST='127.0.0.1',PORT=18765,GAME_URL=`http://${HOST}:${PORT}/`;
const types={
  '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8','.map':'application/json; charset=utf-8',
  '.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon',
  '.ttf':'font/ttf','.woff':'font/woff','.woff2':'font/woff2',
  '.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.wasm':'application/wasm'
};
const inside=(root,file)=>{
  const relative=path.relative(root,file);
  return relative!==''&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);
};
function createServer({root=ROOT}={}){
  root=fs.realpathSync(root);
  return http.createServer((req,res)=>{
    const headers={
      'Cache-Control':'no-store, no-cache, must-revalidate','Pragma':'no-cache','Expires':'0',
      'X-Content-Type-Options':'nosniff','X-Lootkeeper-Server':'1'
    };
    const finish=(status,message)=>{
      res.writeHead(status,{...headers,'Content-Type':'text/plain; charset=utf-8'});
      res.end(req.method==='HEAD'?'':message);
    };
    if(!['GET','HEAD'].includes(req.method)){
      res.setHeader('Allow','GET, HEAD');finish(405,'Method not allowed');return;
    }
    let name;
    try{name=decodeURIComponent(new URL(req.url,GAME_URL).pathname);}catch{finish(400,'Invalid URL');return;}
    if(name.includes('\0')){finish(400,'Invalid path');return;}
    const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
    if(!inside(root,file)){finish(403,'Forbidden');return;}
    // Check the final real path too: a symlink inside dist cannot expose files
    // from the repository, the user's profile, or another drive.
    fs.realpath(file,(realError,realFile)=>{
      if(realError){finish(404,'File not found');return;}
      if(!inside(root,realFile)){finish(403,'Forbidden');return;}
      fs.stat(realFile,(statError,stat)=>{
        if(statError||!stat.isFile()){finish(404,'File not found');return;}
        const responseHeaders={...headers,'Content-Type':types[path.extname(realFile).toLowerCase()]||'application/octet-stream','Content-Length':stat.size};
        if(req.method==='HEAD'){res.writeHead(200,responseHeaders);res.end();return;}
        fs.readFile(realFile,(error,data)=>{
          if(error){finish(404,'File not found');return;}
          res.writeHead(200,{...responseHeaders,'Content-Length':data.length});res.end(data);
        });
      });
    });
  });
}

// Recognize both this server and the previous version, so opening the game
// never requires killing an existing process or changing its save origin.
function probeServer(url=GAME_URL){
  return new Promise(resolve=>{
    const request=http.get(url,{timeout:1000},response=>{
      let body='';
      response.setEncoding('utf8');
      response.on('data',chunk=>{if(body.length<65536)body+=chunk;});
      response.on('end',()=>resolve({busy:true,ready:response.statusCode===200&&
        (response.headers['x-lootkeeper-server']==='1'||/<title>\s*The Lootkeeper\b/i.test(body))}));
      response.on('error',()=>resolve({busy:true,ready:false}));
    });
    request.on('timeout',()=>request.destroy());
    request.on('error',()=>resolve({busy:false,ready:false}));
  });
}

if(require.main===module){
  const server=createServer();
  server.on('error',async error=>{
    if(error.code==='EADDRINUSE'&&(await probeServer()).ready){
      console.log('The Lootkeeper is already running: '+GAME_URL);return;
    }
    console.error(error.code==='EADDRINUSE'?'Port 18765 is used by another application.':error.message);
    process.exitCode=1;
  });
  server.listen(PORT,HOST,()=>console.log('The Lootkeeper: '+GAME_URL));
}

module.exports={createServer,probeServer,ROOT,HOST,PORT,GAME_URL};
