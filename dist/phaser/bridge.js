import {textureKey} from './assets.js';
import {receptionLayout,visitorLayout} from './reception-layout.js';

// The sole adapter between simulation/DOM input and disposable Phaser views.
// A scene receives plain snapshots, never a reference to mutable game state.
export class SceneBridge{
  constructor({step,read,actions={}}){
    this.step=step;this.read=read;this.actions=actions;this.snapshot=null;
    this.root=document.getElementById('game');this.ready=false;this.frame=0;
    this.keys=new WeakMap();this.serial=0;this.nativeNodes=new Set();
    this.inputTargets=new Map();this.inputBindings=new WeakMap();this.inputEvents=0;this.activeScene=null;
  }
  action(name,...args){const action=this.actions[name];return typeof action==='function'?action(...args):false;}
  update(time){
    this.step?.(time);this.frame++;
    this.snapshot=this.capture();return this.snapshot;
  }
  current(){return this.snapshot||this.capture();}
  receivePointer(id,event){
    const binding=this.inputTargets.get(id);if(!binding)return false;
    this.inputEvents++;
    if(binding.action){
      if(typeof this.actions[binding.action]==='function')return this.action(binding.action);
      return binding.original?.call(binding.node,event);
    }
    if(typeof this.actions.beginItemPointer==='function')return this.action('beginItemPointer',event,binding.node,binding.uid,binding.kind);
    return binding.original?.call(binding.node,event);
  }
  bindPointer(node,id){
    if(!node||!node.classList.contains('item')||node.classList.contains('dragging'))return;
    let binding=this.inputBindings.get(node);
    if(!binding){
      binding={node,original:node.onpointerdown,uid:Number(node.dataset.uid),kind:node.dataset.kind};
      this.inputBindings.set(node,binding);
      node.onpointerdown=event=>{
        const scene=this.activeScene,view=scene?.views.get(id);
        if(!view)return binding.original?.call(node,event);
        // The semantic DOM rectangle supplies accessibility and pointer capture;
        // Phaser dispatches the native game-object input before the simulation.
        scene.input.emit('gameobjectdown',{event},view.sprite,event);
      };
    }
    this.inputTargets.set(id,binding);
  }
  bindControl(node,id){
    const controls={bag:'buyBag',parcel:'openOrder',dwarfStation:'openBorin',goblinStation:'openGoblinParcel'};
    if(!node||!controls[node.id])return;
    let binding=this.inputBindings.get(node);
    if(!binding||node.onclick!==binding.wrapper){
      binding={node,original:node.onclick,action:controls[node.id]};
      binding.wrapper=event=>{
        const scene=this.activeScene,view=scene?.views.get(id);
        if(!view)return binding.original?.call(node,event);
        scene.input.emit('gameobjectdown',{event},view.sprite,event);
      };
      this.inputBindings.set(node,binding);node.onclick=binding.wrapper;
    }
    this.inputTargets.set(id,binding);
  }
  foregroundActors(){
    // Native takeover must not keep detached workbench DOM alive after every
    // item move, worker refresh or scene change.
    for(const img of this.nativeNodes)if(!img.isConnected)this.nativeNodes.delete(img);
    // These transient actors must cross DOM table/shelf/window borders. The
    // world canvas is intentionally below accessible DOM controls, so retain
    // this small foreground in DOM rather than hiding it under that canvas.
    this.root.querySelectorAll('#bagPourScene img,#dwarfCarrier img,#dwarfPickupSpot img').forEach(img=>{
      delete img.dataset.phaserArt;this.nativeNodes.delete(img);
    });
  }
  visible(el){
    if(this.visibilityCache?.has(el))return this.visibilityCache.get(el);
    if(!el||!el.isConnected||!el.getClientRects().length)return false;
    for(let node=el;node&&node!==this.root;node=node.parentElement){
      if(node.hidden||node.classList.contains('hidden'))return false;
      const css=this.style(node);
      if(css.display==='none'||css.visibility==='hidden')return false;
    }
    this.visibilityCache?.set(el,true);
    return true;
  }
  style(el){
    let css=this.styleCache?.get(el);
    if(!css){css=getComputedStyle(el);this.styleCache?.set(el,css);}
    return css;
  }
  rect(el){
    if(!el)return null;
    const r=el.getBoundingClientRect(),root=this.rootRect||this.root.getBoundingClientRect(),unit=this.unit||root.width/this.root.offsetWidth||1;
    return {x:(r.left-root.left)/unit,y:(r.top-root.top)/unit,width:r.width/unit,height:r.height/unit};
  }
  sprite(el,id,layer=20,motion=null){
    if(!this.visible(el))return null;
    const key=textureKey(el.currentSrc||el.getAttribute('src'));if(!key)return null;
    const rect=this.rect(el),style=this.style(el),r={...rect};
    let angle=0,alpha=1,flipX=false,scaleX=1,scaleY=1;
    for(let node=el;node&&node!==this.root;node=node.parentElement){
      const css=this.style(node);
      // Native takeover hides the source image with CSS opacity. Its previous
      // inline alpha still controls bag reveals, carry/drop and dragged items.
      alpha*=node===el&&node.dataset.phaserArt?(Number(node.style.opacity||1)):Number(css.opacity||1);
      if(css.transform&&css.transform!=='none'){
        const matrix=new DOMMatrixReadOnly(css.transform);
        // The root matrix is excluded: its responsive scaling is applied to
        // the canvas and DOM together by the shell.
        if(node===el||node.classList.contains('item')||node.id==='dwarfCarrier'){
          angle+=Math.atan2(matrix.b,matrix.a)*180/Math.PI;
          scaleX*=Math.hypot(matrix.a,matrix.b);scaleY*=Math.hypot(matrix.c,matrix.d);
          if(matrix.a<0&&Math.abs(matrix.b)<.001){flipX=!flipX;angle-=180;}
        }
      }
    }
    // getBoundingClientRect includes rotation. Use the unrotated image size,
    // but keep the measured centre (which includes the saved item position).
    r.x+=r.width/2;r.y+=r.height/2;r.width=(el.offsetWidth||r.width)*scaleX;r.height=(el.offsetHeight||r.height)*scaleY;
    if(el.closest('.dragging')){r.width=rect.width;r.height=rect.height;}
    const parent=el.closest('.item'),emphasis=parent||el.closest('button');
    // The carrier owns a silhouette item, not a silhouette body. An ancestor's
    // `.unknown` flag must never tint Borin's actual portrait or carry sprite.
    const carriedUnknown=el.matches('.dwarf-carrier-item img,#dwarfPickupSpot img')&&!!el.closest('.unknown');
    const unknown=!!(parent?.classList.contains('mystery-item')||carriedUnknown);
    this.bindPointer(parent,id);
    this.bindControl(el.closest('button'),id);
    let mask=null;
    const scroll=el.closest('#inspectScroll,#sourceScroll,#packedScroll,#targetScroll,.target-items');
    if(scroll)mask=this.rect(scroll);
    const img=el,source=img.naturalWidth&&img.naturalHeight?{width:img.naturalWidth,height:img.naturalHeight}:null;
    if(this.ready&&this.textureReady?.(key)){if(img.dataset.phaserArt!==key)img.dataset.phaserArt=key;this.nativeNodes.add(img);}
    return {id,key,x:r.x,y:r.y,width:r.width,height:r.height,angle,alpha:Math.min(1,Math.max(0,alpha)),flipX,unknown,layer,motion,mask,fit:style.objectFit||'contain',source,selected:!!emphasis?.classList.contains('chosen'),hovered:!!emphasis&&!emphasis.disabled&&emphasis.matches(':hover,:focus-visible,.tutorial-focus,.drop-ready')};
  }
  capture(){
    const state=this.read?.()||{},root=this.root;
    this.styleCache=new WeakMap();this.visibilityCache=new WeakMap();
    this.rootRect=root.getBoundingClientRect();this.unit=this.rootRect.width/root.offsetWidth||1;
    this.foregroundActors();
    this.inputTargets.clear();
    const city=document.getElementById('cityMap'),cityOpen=this.visible(city);
    const key=!state.started?'Menu':state.screen==='tower'?'Tower':cityOpen?'City':state.screen==='work'?'Workbench':'Reception';
    const get=id=>document.getElementById(id),rect=id=>this.rect(get(id));
    const sprites=[];const add=(el,id,depth,motion)=>{const sprite=this.sprite(el,id,depth,motion);if(sprite)sprites.push(sprite);};
    const css=this.style(root),num=(key,fallback=0)=>Number.parseFloat(css.getPropertyValue(key))||fallback;
    const receptionBounds=rect('reception');
    const receptionPresentation={story:!!state.story,stage:Number(state.story?.shopRestorationStage||0),furnished:num('--repair-furnished'),clean:num('--repair-clean'),restoration:state.story?.restoration?{kind:state.story.restoration.kind,elapsed:state.story.restoration.elapsed}:null,night:num('--light-night'),evening:num('--light-evening')};
    const receptionLayers=key==='Reception'&&receptionBounds?receptionLayout({...receptionPresentation,bounds:receptionBounds}):null;
    const counter=receptionLayers?.counter||null;let visitorPose=null;
    if(key==='Reception'){
      const visitor=get('visitor');
      const serial=state.offers?.[0]?.arrivalSerial??state.orders?.find(o=>o.accepted===false)?.arrivalSerial??state.story?.contractOfferPending??'';
      add(visitor,'visitor:'+serial+':'+visitor?.getAttribute('src'),20,'visitor');
      const portrait=sprites.find(sprite=>sprite.id.startsWith('visitor:'));
      if(portrait&&receptionBounds){
        portrait.source=this.textureSource?.(portrait.key)||portrait.source;
        visitorPose=visitorLayout(receptionBounds,portrait.key,portrait.source);
        if(visitorPose)Object.assign(portrait,{x:visitorPose.x,y:visitorPose.y,width:visitorPose.width,height:visitorPose.height,fit:'contain'});
      }
      // Move the existing DOM controls before measuring their native images,
      // so the click target and visible prop share the source table footpoint.
      window.LootkeeperReceptionLayers?.update({...receptionPresentation,key,bounds:receptionBounds,receptionLayers,visitorPose});
      add(get('bag')?.querySelector('img'),'counter-bag:'+serial,35,'bag');
      add(get('parcel')?.querySelector('img'),'counter-parcel:'+serial,35,'bag');
      add(get('dwarfStation')?.querySelector('img'),'borin-station',95);
      add(get('goblinStation')?.querySelector('img'),'grik-station',95);
    }else if(key==='Workbench'){
      get('shelves')?.querySelectorAll('img.boxart').forEach((img,i)=>add(img,'shelf:'+i,8));
      const unique=new Map();
      root.querySelectorAll('#pile .item>img,#sourceItems .item>img,#inspectItems .item>img,#targetItems .item>img,#packedItems>img').forEach((img,i)=>{
        const parent=img.closest('.item'),uid=parent?.dataset.uid||img.dataset.uid||i,kind=parent?.dataset.kind||img.parentElement.id;
        const id='loot:'+kind+':'+uid,front=!!img.closest('#inspectItems,#targetItems');
        unique.set(id,[img,id,(front?42:20)+(parent?Number.parseInt(parent.style.zIndex||'0',10)/100000:2)]);
      });
      for(const args of unique.values())add(...args);
    }
    document.querySelectorAll('img.flying-loot,img.flying,.dragging>img').forEach(img=>{
      if(!this.keys.has(img))this.keys.set(img,'transient:'+ ++this.serial);
      add(img,this.keys.get(img),120);
    });
    const surfaces={};
    if(key==='Workbench')for(const id of ['work','table','sourceBox','inspector','targetPreview','parcelDrop']){
      const el=get(id);if(this.visible(el))surfaces[id]={rect:this.rect(el),open:el.classList.contains('source-open')||['inspector','targetPreview','parcelDrop'].includes(id)};
    }
    const snapshot={key,frame:this.frame,paused:!!state.paused||document.hidden,started:!!state.started,selected:state.selected??null,mode:state.mode,
      viewport:{width:root.clientWidth,height:root.clientHeight},
      bounds:key==='Menu'?{x:0,y:0,width:root.clientWidth,height:root.clientHeight}:key==='Tower'?rect('towerInterior'):key==='City'?rect('cityMap'):rect(key==='Workbench'?'work':'reception'),
      counter,
      cityLandscape:key==='City'?this.rect(city.querySelector('.city-landscape')):null,
      surfaces,sprites,...receptionPresentation,receptionLayers,visitorPose,
      towerOwned:!!state.city?.towerOwned,towerStage:Math.max(1,Math.min(3,Number(state.story?.shopRestorationStage||0)+1))};
    return Object.freeze(snapshot);
  }
  enable(textures){
    this.textureReady=key=>textures.exists(key);
    this.textureSource=key=>{if(!textures.exists(key))return null;const source=textures.get(key).getSourceImage();return {width:source.width,height:source.height};};
    this.ready=true;this.root.classList.add('phaser-ready');this.root.dataset.renderer='phaser';
  }
  dispose(){
    this.ready=false;this.root.classList.remove('phaser-ready');delete this.root.dataset.renderer;
    for(const node of this.nativeNodes)if(node.isConnected)delete node.dataset.phaserArt;
    this.nativeNodes.clear();
  }
}
