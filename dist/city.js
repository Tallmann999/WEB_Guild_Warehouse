'use strict';

// The city is a view over the working shop. Opening it never pauses employees.
const City=(()=>{
  const TOWER_PRICE=1000;
  let opened=false,selected='shop',signature='',notifyingGuild=false;
  const places={
    shop:{name:'Дедова лавка',kind:'shop',x:18,y:83,description:'Ваш дом и торговое дело. Борин сортирует поставки, Грик собирает порученные ему посылки.'},
    tower:{name:'Старая башня',kind:'tower',x:82,y:30,description:'Заброшенная башня на окраине. Толстые стены ещё крепки, но хозяин давно не открывал ставни.'},
    tavern:{name:'Таверна «Тёплый очаг»',kind:'tavern',x:27,y:35,description:'Здесь встречаются вернувшиеся из походов авантюристы. Пока таверна принадлежит другому хозяину.'},
    smith:{name:'Старая кузница',kind:'smith',x:77,y:83,description:'Знакомая кузница у городской стены. Её хозяин ещё не выставлял мастерскую на продажу.'}
  };
  function ensure(){
    if(!state.story)return null;
    const c=state.city??={};c.version=1;c.towerOwned=!!c.towerOwned;c.towerPrice=TOWER_PRICE;
    // Founding the guild opens the offer immediately. Once seen, stopping the
    // shop later must not withdraw that property offer or reset the city guide.
    if(state.story.guild?.founded&&state.story.automation?.enabled&&!c.guildTowerOfferUnlocked){c.guildTowerOfferUnlocked=true;save();}
    return c;
  }
  const towerAvailable=()=>!!state.story&&(state.day>=4||!!state.city?.guildTowerOfferUnlocked||!!state.story.guild?.founded&&!!state.story.automation?.enabled);
  function notifyGuild(){
    if(notifyingGuild||typeof Guild==='undefined'||typeof Guild.cityUpdate!=='function')return;
    notifyingGuild=true;
    try{Guild.cityUpdate({opened,selected,towerAvailable:towerAvailable(),towerOwned:!!state.city?.towerOwned});}finally{notifyingGuild=false;}
  }
  function close(){
    opened=false;document.getElementById('cityMap')?.classList.add('hidden');
    document.getElementById('cityNav')?.setAttribute('aria-expanded','false');
    document.getElementById('game')?.classList.remove('viewing-city');
    if(typeof Guild!=='undefined')Guild.onCityClosed?.();
  }
  function select(key){if(!places[key])return;selected=key;signature='';update();}
  function open(key='shop'){
    if(!state.started||!state.story||state.paused||state.ended||state.autoSorting||BagPour.active())return false;
    cancelDrag();ensure();selected=places[key]?key:'shop';opened=true;signature='';
    $('cityMap').classList.remove('hidden');$('game').classList.add('viewing-city');$('cityNav').setAttribute('aria-expanded','true');
    if(towerAvailable())state.city.towerOfferSeen=true;
    update();save();$('cityClose').focus();return true;
  }
  function buyTower(){
    const c=ensure();if(!c||c.towerOwned||!towerAvailable()||state.gold<TOWER_PRICE||state.paused||document.hidden)return false;
    // Ownership and cost are saved together; double clicks and reloads cannot pay again.
    state.gold-=TOWER_PRICE;state.daySpent=(state.daySpent||0)+TOWER_PRICE;
    c.towerOwned=true;c.towerBoughtDay=state.day;c.towerBoughtAt=state.story.elapsed;c.towerPaid=TOWER_PRICE;
    signature='';save();
    if(typeof Guild!=='undefined')Guild.onTowerPurchased?.();
    showGoldSpend(TOWER_PRICE);updateHud();update();toast('Старая башня теперь ваша. На карте зажглись её окна.');return true;
  }
  function setup(){
    const nav=button(document.querySelector('footer nav'),'Посмотреть город',()=>opened?close():open(),'cityNav');nav.className='hidden';nav.setAttribute('aria-expanded','false');
    const scene=document.createElement('section');scene.id='cityMap';scene.className='hidden';scene.setAttribute('aria-label','Карта города');
    scene.innerHTML='<div class="city-heading"><div><span>ЗНАКОМЫЙ ГОРОД</span><h2>За порогом лавки</h2></div><p id="cityWorkStatus"></p><button id="cityClose">Вернуться в лавку</button></div><div class="city-landscape"><img class="city-map-art" src="assets/city-town-map.png" alt="Старый город, лавка и башня на окраине"><div class="city-lights" aria-hidden="true"></div><div class="city-locations"></div><aside id="cityTowerDetails" class="city-place-card"></aside><div class="city-map-legend"><i></i> Ваши места светятся · остальные ждут своего часа</div></div>';
    $('game').append(scene);$('cityClose').onclick=close;
    const locations=scene.querySelector('.city-locations');
    for(const [key,place]of Object.entries(places)){
      const site=button(locations,'',()=>select(key),'city'+key[0].toUpperCase()+key.slice(1));site.className='city-site';site.dataset.site=key;
      site.style.left=place.x+'%';site.style.top=place.y+'%';site.innerHTML='<span class="city-site-light" aria-hidden="true"></span><strong>'+place.name+'</strong><small></small>';
    }
    const enter=button(locations,'Зайти',()=>{close();setScreen('reception','sort');},'cityEnterShop');enter.className='city-shop-entry hidden';enter.setAttribute('aria-label','Зайти в лавку, не останавливая автоматизацию');
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened&&$('modal').classList.contains('hidden')){e.preventDefault();e.stopImmediatePropagation();close();}},true);
  }
  function update(){
    const nav=$('cityNav');if(!nav)return;
    const c=ensure(),active=!!c&&state.started;hidden('cityNav',!active);
    if(!active){close();return;}
    const available=towerAvailable(),automated=!!state.story.automation?.enabled;
    nav.classList.toggle('city-available',available&&!c.towerOwned);nav.title=available&&!c.towerOwned?'Старая башня продаётся · 1000 монет':'Посмотреть город, пока помощники работают';
    if(available&&!c.towerNoticeSeen&&!state.paused&&!drag&&!BagPour.active()&&!document.hidden){
      c.towerNoticeSeen=true;save();toast('Старая башня выставлена на продажу. Откройте «Посмотреть город».');
    }
    if(!opened)return;
    const workerText=[state.dwarf?.hired?'Борин: '+Dwarf.status().label:'Лавка открыта',state.goblin?.hired?'Грик: '+Goblin.status().label:''].filter(Boolean).join(' · ');
    if($('cityWorkStatus').textContent!==workerText)$('cityWorkStatus').textContent=workerText;
    const next=JSON.stringify([selected,state.day,state.gold,c.towerOwned,state.story.restored,available,automated]);if(next===signature){notifyGuild();return;}signature=next;
    for(const [key,place]of Object.entries(places)){
      const site=$('city'+key[0].toUpperCase()+key.slice(1)),owned=key==='shop'||key==='tower'&&c.towerOwned;
      site.classList.toggle('owned',owned);site.classList.toggle('selected',selected===key);site.classList.toggle('for-sale',key==='tower'&&available&&!owned);
      site.setAttribute('aria-pressed',selected===key?'true':'false');
      site.querySelector('small').textContent=owned?(key==='shop'&&automated?'Автоматизация включена':'Ваше место'):key==='tower'?(available?'Продаётся · 1000 монет':'Откроется в день 4'):'Пока не продаётся';
    }
    hidden('cityEnterShop',!automated);
    $('cityMap').dataset.tower=c.towerOwned?'owned':'unowned';
    const place=places[selected],details=$('cityTowerDetails');
    details.innerHTML='<span class="city-card-eyebrow">'+(selected==='tower'?(c.towerOwned?'НОВОЕ ВЛАДЕНИЕ':available?'ОБЪЯВЛЕНИЕ О ПРОДАЖЕ':'СТАРАЯ ОКРАИНА'):'МЕСТО В ГОРОДЕ')+'</span><h3>'+place.name+'</h3><p>'+place.description+'</p>';
    if(selected==='tower'){
      if(c.towerOwned)details.innerHTML+='<strong class="city-owned-message">Башня приобретена</strong><p class="city-small">Первый шаг — вернуть ей свет. Старая мастерская и её тайны ждут хозяина.</p>';
      else if(!available)details.innerHTML+='<p class="city-small">Начиная с четвёртого дня хозяин будет готов обсудить продажу. Основанная гильдия с работающей лавкой может получить предложение раньше.</p>';
      else{
        details.innerHTML+='<p class="city-price">1000 монет <small>Останется в кошельке: '+Math.max(0,state.gold-TOWER_PRICE)+'</small></p>';
        const buy=button(details,'Купить за 1000 золотых',buyTower,'cityBuyTower',state.gold<TOWER_PRICE);buy.className='primary';
        if(state.gold<TOWER_PRICE)details.insertAdjacentHTML('beforeend','<p class="city-small">Нужно ещё '+(TOWER_PRICE-state.gold)+' монет. Лавка продолжает работать.</p>');
      }
    }else if(selected==='shop')button(details,'Вернуться к работе',close,'cityBackToShop').className='primary';
    notifyGuild();
  }
  function afterLoad(){close();ensure();signature='';update();}
  return {setup,ensure,open,close,isOpen:()=>opened,select,buyTower,towerAvailable,update,afterLoad,TOWER_PRICE};
})();
