'use strict';

// The tower is a real visited scene. It does not award resources, invent a
// wizard/source mechanic, or own the shop's ongoing work and inventory.
const Tower=(()=>{
  const isOpen=()=>state.screen==='tower'&&!!state.city?.towerOwned;
  function setup(){
    if($('towerInterior'))return;
    const interior=document.createElement('section');interior.id='towerInterior';interior.className='hidden';interior.setAttribute('aria-label','Внутри старой башни');
    interior.innerHTML='<div id="towerArt" class="tower-art-layers" role="img" aria-label="Два арочных окна над деревянным столом с ящиками. Слева старый костяной механизм, рядом фиолетовый шар на подставке."></div><div class="tower-heading"><div><span>СТАРАЯ БАШНЯ · ВАШЕ ВЛАДЕНИЕ</span><h2>Башня мага</h2></div><button id="towerClose">Вернуться в город</button></div><div class="tower-visit-caption"><p>На старом деревянном столе — костяной механизм и фиолетовый шар.</p><button id="towerReturnShop" class="primary">Вернуться в лавку</button></div>';
    for(const layer of window.LootkeeperTowerArt.layers){
      const image=document.createElement('img');image.src=layer.path;image.alt='';image.draggable=false;image.dataset.towerLayer=layer.id;image.style.zIndex=layer.depth;
      interior.querySelector('#towerArt').append(image);
    }
    $('game').append(interior);
    new ResizeObserver(updateArt).observe(interior);updateArt();
    $('towerClose').onclick=()=>close('city');$('towerReturnShop').onclick=()=>close('reception');
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&isOpen()&&$('modal').classList.contains('hidden')){e.preventDefault();e.stopImmediatePropagation();close('city');}
    },true);
  }
  function updateArt(){
    const interior=$('towerInterior');if(!interior?.clientWidth||!interior.clientHeight)return;
    for(const layer of window.LootkeeperTowerArt.layout({x:0,y:0,width:interior.clientWidth,height:interior.clientHeight})){
      const image=interior.querySelector('[data-tower-layer="'+layer.id+'"]');
      image.style.left=(layer.x-layer.width/2)+'px';image.style.top=(layer.y-layer.height/2)+'px';image.style.width=layer.width+'px';image.style.height=layer.height+'px';
    }
  }
  function open(){
    if(!state.started||state.paused||state.ended||state.autoSorting||document.hidden||!state.city?.towerOwned||Restoration.active()||BagPour.active())return false;
    cancelDrag();City.close();state.screen='tower';state.mode='sort';state.activeCat=null;state.inspectCat=null;
    hidden('inspector',true);hidden('targetPreview',true);hidden('tooltip',true);
    state.city.towerEntered=true;state.city.towerEnteredAt??=state.story?.elapsed||0;
    render();update();save();$('towerClose')?.focus();return true;
  }
  function close(destination='city'){
    const wasOpen=state.screen==='tower';
    $('towerInterior')?.classList.add('hidden');$('game')?.classList.remove('viewing-tower');
    if(!wasOpen)return false;
    state.screen='reception';state.mode='sort';state.activeCat=null;state.inspectCat=null;
    render();save();
    if(destination==='city')City.open('tower');
    return true;
  }
  function update(){
    const active=state.started&&isOpen();
    $('towerInterior')?.classList.toggle('hidden',!active);$('game')?.classList.toggle('viewing-tower',!!active);
    if(active)updateArt();
  }
  function afterLoad(){
    if(state.screen==='tower'&&!state.city?.towerOwned){state.screen='reception';state.mode='sort';render();}
    update();
  }
  return {setup,open,close,update,afterLoad,isOpen};
})();
