'use strict';
const TUTORIAL_KEY='guild-warehouse-tutorial-completed-v1';
let tutorialTarget=null;
function clearTutorialHighlight(){tutorialTarget?.classList.remove('tutorial-focus');tutorialTarget=null;}
function startTutorial(){
  if(Story.enabled()){Story.startTutorial();return;}
  try{if(localStorage.getItem(TUTORIAL_KEY)==='1')return;}catch{}
  const offer=state.schedule.shift();if(!offer)return;
  const helmet=makeItem(24),ingredient=makeItem(30),trophy=makeItem(0),unknown=makeItem(4);
  for(const x of [helmet,ingredient,trophy])x.unknown=false;unknown.unknown=true;
  offer.loot=[helmet,ingredient,trophy,unknown];offer.tutorial=true;offer.price=0;offer.qualityRolled=true;offer.at=0;offer.arrivalSerial=1;state.arrivalSerial=1;state.offers=[offer];
  state.tutorial={active:true,stage:'bag',targets:[helmet.uid,ingredient.uid,trophy.uid]};
}
function finishTutorial(skipped=false){
  if(state.tutorial)state.tutorial.active=false;
  try{localStorage.setItem(TUTORIAL_KEY,'1');}catch{}
  clearTutorialHighlight();$('tutorialGuide')?.remove();render();save();
  if(!skipped)toast('Обучение завершено! Продолжайте собирать поручение.');
}
function tutorialGuide(target,message,cleaning=false,options={}){
  let guide=$('tutorialGuide');
  if(!guide){guide=document.createElement('div');guide.id='tutorialGuide';guide.innerHTML='<div class="tutorial-hand" aria-hidden="true">👇</div><div class="tutorial-note"><span role="status" aria-live="polite"></span><button>Пропустить обучение</button></div>';$('effects').append(guide);guide.querySelector('button').onclick=()=>finishTutorial(true);}
  const text=guide.querySelector('.tutorial-note span');if(text.textContent!==message)text.textContent=message;
  const skip=guide.querySelector('button');skip.textContent=options.label||'Пропустить обучение';skip.onclick=options.skip||(()=>finishTutorial(true));
  guide.classList.toggle('cleaning',cleaning);
  const hand=guide.querySelector('.tutorial-hand'),highlight=target?.tagName==='CANVAS'?target.parentElement:target;
  if(tutorialTarget!==highlight){clearTutorialHighlight();tutorialTarget=highlight;tutorialTarget?.classList.add('tutorial-focus');}
  if(!target||!target.getClientRects().length){clearTutorialHighlight();hand.style.display='none';return;}
  hand.style.display='';
  const r=target.getBoundingClientRect(),g=$('game').getBoundingClientRect(),x=(r.left-g.left)/scale,y=(r.top-g.top)/scale,w=r.width/scale,h=r.height/scale;
  Object.assign(hand.style,{left:(x+w/2-22)+'px',top:Math.max(4,cleaning?y+h/2-20:y-48)+'px'});
}
function tutorialFrame(){
  if(Story.enabled()){Story.guide();return;}
  const t=state.tutorial;if(!state.started||!t?.active){clearTutorialHighlight();$('tutorialGuide')?.remove();return;}
  const modalOpen=!$('modal').classList.contains('hidden');
  if(modalOpen&&$('resetLevel')){clearTutorialHighlight();$('tutorialGuide')?.remove();return;}
  if($('autoSortButton'))$('autoSortButton').disabled=true;
  if($('sweepButton'))$('sweepButton').disabled=true;
  if(t.stage==='bag'){
    if(state.dayBought){t.stage='sort';save();}
    else{
      if(state.screen!=='reception'){tutorialGuide($('back'),'Вернитесь к стойке за учебным мешком.');return;}
      if($('buyBag'))$('buyBag').textContent='Отсортировать';
      $('speech').innerHTML='<span class="eyebrow">ПЕРВЫЙ ПОСЕТИТЕЛЬ</span><h2>Роуэн</h2><p>Вот учебный мешок с находками. Нажмите «Отсортировать», и я покажу, куда их положить.</p>';
      tutorialGuide($('bag'),'Первый мешок уже на стойке. Нажмите на него или кнопку «Отсортировать».');return;
    }
  }
  if(t.stage==='sort'){
    if(modalOpen){
      if($('dirt')){
        if($('cleanKey').disabled)tutorialGuide(null,'Предмет распознан! Окно сейчас закроется само.');
        else tutorialGuide($('dirt'),'Зажмите левую кнопку мыши и водите по кругу, чтобы очистить предмет.',true);
      }else tutorialGuide($('closeModal'),'Закройте окно и продолжите обучение.');return;
    }
    if(state.screen!=='work'||state.mode!=='sort'){tutorialGuide($('resumeBag')||$('goWork'),'Вернитесь к столу и разложите находки.');return;}
    if(state.inspectCat!==null){tutorialGuide($('closeInspector'),'Закройте ящик, чтобы продолжить сортировку.');return;}
    const next=t.targets.map(uid=>state.bag.find(x=>x.uid===uid)).find(Boolean)||state.bag.find(x=>!isUnknown(x));
    if(next){
      const item=items[next.type],shelf=document.querySelector(`#shelves [data-cat="${item.cat}"]`),node=document.querySelector(`#pile [data-uid="${next.uid}"]`);
      const held=drag?.uid===next.uid||state.selected===next.uid;
      tutorialGuide(held?shelf:node,held?`Положите «${item.name}» в «${categories[item.cat].name}».`:`Возьмите «${item.name}» и перенесите в «${categories[item.cat].name}». Можно также нажать предмет, затем ящик.`);return;
    }
    const unknown=state.bag.find(isUnknown);
    if(unknown){tutorialGuide(document.querySelector(`#pile [data-uid="${unknown.uid}"]`),'Нажмите на неизвестную находку, чтобы сразу открыть изучение.');return;}
    if(!state.bag.length){
      const previous=state.dayOrdersCreated||0;
      if(createOrder(true)){state.orderSchedule.shift();const order=allOrders().find(o=>o.accepted===false);t.orderId=order.id;t.stage='guest';render();save();}
      else if(previous)finishTutorial();
    }
  }
  const order=allOrders().find(o=>o.id===t.orderId);
  if(t.stage==='guest'){
    if(state.screen==='work'){tutorialGuide($('arrivalSignal'),'К стойке пришёл заказчик. Нажмите уведомление о госте.');return;}
    t.stage='order';save();
  }
  if(t.stage==='order'){
    if(order?.accepted!==false){t.stage='assembly';state.order=order;for(const x of state.stock)delete x.boxPos;setScreen('work','order');save();}
    else if(modalOpen&&$('acceptOrder')){$('acceptOrder').textContent='Собрать посылку';tutorialGuide($('acceptOrder'),'Посмотрите список и нажмите «Собрать посылку».');return;}
    else{if($('receptionOrder'))$('receptionOrder').textContent='Собрать посылку';tutorialGuide($('receptionOrder'),'Гость принёс поручение. Нажмите «Собрать посылку».');return;}
  }
  if(t.stage==='assembly'&&order){
    if(order.packed.length){finishTutorial();return;}
    if(modalOpen){tutorialGuide($('beginAssembly')||$('closeModal'),$('beginAssembly')?'Нажмите «Начать собирать», чтобы вернуться к посылке.':'Закройте окно, чтобы продолжить сборку.');return;}
    if(state.screen!=='work'||state.mode!=='order'){tutorialGuide(document.querySelector(`#orderBoard [data-order-id="${order.id}"]`)||$('ordersNav'),'Откройте принятое поручение и начните сборку.');return;}
    const line=order.recipe[0],cat=items[line.type].cat;
    if(state.activeCat!==cat){tutorialGuide(document.querySelector(`#shelves [data-cat="${cat}"]`),`В списке нужен «${items[line.type].name}». Откройте ящик «${categories[cat].name}».`);return;}
    const x=stockFor(cat).find(x=>x.type===line.type),node=x&&document.querySelector(`#sourceItems [data-uid="${x.uid}"]`);
    tutorialGuide(drag?.uid===x?.uid?$('parcelDrop'):node,`Возьмите «${items[line.type].name}» и нажмите на посылку слева, чтобы положить его.`);
  }
}
