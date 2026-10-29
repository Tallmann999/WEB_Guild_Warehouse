'use strict';
// An assets-only preview server. It never serves the game or its save code.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const ASSETS_ROOT=path.resolve(__dirname,'../dist/assets');
const HOST='127.0.0.1',PORT=Number(process.env.RECEPTION_PREVIEW_PORT||18766);
const PREVIEW_URL=`http://${HOST}:${PORT}/New%20Sprites/preview.html`;
const TYPES={'.html':'text/html; charset=utf-8','.png':'image/png','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.webp':'image/webp'};
const inside=(root,file)=>{const relative=path.relative(root,file);return relative!==''&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);};
function createPreviewServer(){
  const root=fs.realpathSync(ASSETS_ROOT);
  return http.createServer((req,res)=>{
    const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Lootkeeper-Asset-Preview':'1'};
    const finish=(code,message)=>{res.writeHead(code,{...headers,'Content-Type':'text/plain; charset=utf-8'});res.end(req.method==='HEAD'?'':message);};
    if(!['GET','HEAD'].includes(req.method)){finish(405,'GET and HEAD only');return;}
    let route;try{route=decodeURIComponent(new URL(req.url,'http://127.0.0.1/').pathname);}catch{finish(400,'Invalid URL');return;}
    if(route==='/'){res.writeHead(302,{...headers,Location:'/New%20Sprites/preview.html'});res.end();return;}
    if(route.includes('\0')){finish(400,'Invalid path');return;}
    const file=path.resolve(root,'.'+route);if(!inside(root,file)){finish(403,'Forbidden');return;}
    fs.realpath(file,(error,real)=>{
      if(error){finish(404,'Asset not found');return;}if(!inside(root,real)){finish(403,'Forbidden');return;}
      fs.stat(real,(error,stat)=>{
        if(error||!stat.isFile()){finish(404,'Asset not found');return;}
        const metadata={...headers,'Content-Type':TYPES[path.extname(real).toLowerCase()]||'application/octet-stream','Content-Length':stat.size};
        if(req.method==='HEAD'){res.writeHead(200,metadata);res.end();return;}
        fs.readFile(real,(error,data)=>{if(error){finish(404,'Asset not found');return;}res.writeHead(200,metadata);res.end(data);});
      });
    });
  });
}
if(require.main===module){
  if(process.argv.includes('--check')){
    const req=http.get(PREVIEW_URL,{timeout:1500},res=>{res.resume();const ready=res.statusCode===200&&res.headers['x-lootkeeper-asset-preview']==='1';console.log(JSON.stringify({ready,url:PREVIEW_URL}));if(!ready)process.exitCode=1;});
    req.on('timeout',()=>req.destroy());req.on('error',()=>{console.log(JSON.stringify({ready:false,url:PREVIEW_URL}));process.exitCode=1;});
  }else{
    const server=createPreviewServer();server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Preview port is busy; check the existing preview with --check.':error.message);process.exitCode=1;});
    server.listen(PORT,HOST,()=>console.log('Reception layers preview: '+PREVIEW_URL));
  }
}
module.exports={createPreviewServer,ASSETS_ROOT,PREVIEW_URL};
