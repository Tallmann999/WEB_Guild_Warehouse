const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:18765/');await page.waitForFunction(()=>window.LootkeeperEngine?.ready);
  await page.evaluate(()=>{
   const samples=window.stallSamples={capture:[],hud:[],frames:[],long:[]};
   new PerformanceObserver(list=>samples.long.push(...list.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true});
   const hud=updateHud;updateHud=function(...args){const t=performance.now();try{return hud(...args);}finally{samples.hud.push(performance.now()-t);}};
   const bridge=LootkeeperEngine.bridge,capture=bridge.capture.bind(bridge);bridge.capture=function(){const t=performance.now();try{return capture();}finally{samples.capture.push(performance.now()-t);samples.frames.push(t);}};
   forceCloseModal();state=freshState();Object.assign(state,{started:true,day:4,gold:700,orders:[],order:null,orderUid:0,tutorial:{active:false},screen:'work',mode:'sort',collection:items.map(x=>x.id)});
   state.story={letterRead:true,inheritedOpened:true,firstPaid:true,firstDayFlowVersion:2,firstDayComplete:true,firstDayPurchases:2,firstDayDeliveries:2,restored:true,shopRestorationStage:2,secondDayFlowVersion:2,secondDayActive:false,completedB2:true,goblinEncounterSeen:true,nextVisit:999,elapsed:30};
   state.dwarf={hired:true,enabled:false,batches:[]};state.goblin={hired:true,enabled:false};Story.ensure();for(const c of Object.values(Contracts.ensure())){c.offerSeen=true;c.offerState='later';}
   state.bag=Array.from({length:24},(_,i)=>makeItem(i%4));Dwarf.onBagPurchased(state.bag);render();
  });
  await page.waitForTimeout(3500);
  console.log('BASELINE',JSON.stringify(await page.evaluate(()=>{
   const summary=a=>{a=a.slice().sort((a,b)=>a-b);return {n:a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:a.at(-1)};};
   const s=stallSamples;return {capture:summary(s.capture),hud:summary(s.hud),interval:summary(s.frames.slice(1).map((x,i)=>x-s.frames[i])),long:s.long,native:LootkeeperEngine.bridge.nativeNodes.size};
  })));
  await page.evaluate(()=>{LootkeeperEngine.bridge.step=()=>{};for(let i=0;i<35;i++){renderWork();LootkeeperEngine.bridge.capture();}});
  console.log('RERENDERS',JSON.stringify(await page.evaluate(()=>({native:LootkeeperEngine.bridge.nativeNodes.size,disconnected:[...LootkeeperEngine.bridge.nativeNodes].filter(x=>!x.isConnected).length}))));
  console.log('ERRORS',JSON.stringify(errors));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
