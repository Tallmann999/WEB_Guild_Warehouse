'use strict';

// The tower is a real visited scene. It does not award resources, invent a
// wizard/source mechanic, or own the shop's ongoing work and inventory.
const Tower=(()=>{
  const isOpen=()=>state.screen==='tower'&&!!state.city?.towerOwned;
  function setup(){
    if($('towerInterior'))return;
    const interior=document.createElement('section');interior.id='towerInterior';interior.className='hidden';interior.setAttribute('aria-label','Внутри старой башни');
    interior.innerHTML='<img id="towerArt" src="assets/tower-interior.png" alt="Каменная мастерская башни, фиолетовый шар и старый механизм из костей"><div class="tower-heading"><div><span>СТАРАЯ БАШНЯ · ВАШЕ ВЛАДЕНИЕ</span><h2>Старая мастерская</h2></div><button id="towerClose">Вернуться в город</button></div><div class="tower-visit-caption"><p>Фиолетовый шар и древний костяной механизм сохранились в старой мастерской.</p><button id="towerReturnShop" class="primary">Вернуться в лавку</button></div>';
    $('game').append(interior);
    $('towerClose').onclick=()=>close('city');$('towerReturnShop').onclick=()=>close('reception');
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&isOpen()&&$('modal').classList.contains('hidden')){e.preventDefault();e.stopImmediatePropagation();close('city');}
    },true);
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
  }
  function afterLoad(){
    if(state.screen==='tower'&&!state.city?.towerOwned){state.screen='reception';state.mode='sort';render();}
    update();
  }
  return {setup,open,close,update,afterLoad,isOpen};
})();
