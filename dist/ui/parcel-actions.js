// The same commands are used by ordinary letters, agreements and their book.
// Only simulation transactions move instances or credit money; these controls
// remain disposable views when the Phaser scene changes.
function escapeQuestText(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function styleQuestSheet(container,o){
  container.dataset.questRarity=o?.rarity==='special'?'special':o?.regularKey?'unique':'ordinary';
}
function parcelContents(o){
  return '<span class="quest-eyebrow">ПОРУЧЕНИЕ · №'+o.id+'</span><h3>'+escapeQuestText(o.title||'Посылка')+'</h3><p class="quest-recipient">Кому: <b>'+escapeQuestText(customers[o.customer]?.[0]||'Заказчик')+'</b><small>'+escapeQuestText(customers[o.customer]?.[1]||'')+'</small></p><ul class="parcel-recipe">'+o.recipe.map(r=>{const packed=o.packed.filter(x=>x.type===r.type).length;return '<li class="'+(packed>=r.count?'done':'')+'"><img src="'+asset(items[r.type].sprite)+'" alt=""><span>'+escapeQuestText(items[r.type].name)+'</span><b>'+packed+'/'+r.count+'</b></li>';}).join('')+'</ul><strong class="quest-price">Оплата: '+o.reward+' монет</strong>';
}
function renderParcelActions(container,o){
  if(!o)return;
  styleQuestSheet(container,o);
  const assigned=Story.enabled()&&Goblin.isAssigned(o),ready=assigned&&Goblin.readyToClaim(o);
  container.dataset.orderId=o.id;
  container.classList.toggle('parcel-assistant-working',assigned&&!ready);
  container.classList.toggle('parcel-ready',!!ready);
  const actions=document.createElement('div');actions.className='parcel-actions';container.append(actions);
  const command=fn=>e=>{e.stopPropagation();if(state.autoSorting||drag)return;if(!$('modal').classList.contains('hidden')){if(modalLocked)return;forceCloseModal();}if(!allOrders().includes(o)||o.delivered){toast('Эта посылка уже выдана.');return;}fn();};
  if(ready&&Goblin.autoDispatchEnabled()){
    const label=document.createElement('small');label.className='parcel-worker-status';label.dataset.parcelAction='dispatching';label.textContent=state.goblin?.enabled?'Грик выдаёт посылку…':'Грик приостановлен';actions.append(label);return;
  }
  if(ready){
    const done=button(actions,'Выполнено',null);done.className='primary parcel-claim';done.dataset.parcelAction='claim';done.onclick=command(()=>claimParcel(o,container));return;
  }
  if(assigned){const label=document.createElement('small');label.className='parcel-worker-status';label.textContent=state.goblin?.enabled?'Собирает Грик · '+o.packed.length+'/'+o.recipe.reduce((n,r)=>n+r.count,0):'Грик приостановлен';actions.append(label);}
  const manual=button(actions,'Собрать самому',null);manual.dataset.parcelAction='manual';manual.onclick=command(()=>{if(Story.enabled())Goblin.assign(o,false);openOrder(o);});
  const helper=button(actions,'Доверить помощнику',null);helper.dataset.parcelAction='assistant';helper.disabled=!state.goblin?.hired;
  helper.title=helper.disabled?'Сначала наймите Грика':'';
  helper.onclick=command(()=>{if(!state.goblin?.hired)return;Goblin.setEnabled(true);Goblin.assign(o,true);render();save();});
}
function parcelReceipt(origin){
  if(!origin?.isConnected)return null;
  const r=origin.getBoundingClientRect(),game=$('game').getBoundingClientRect(),copy=origin.cloneNode(true);
  copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));copy.className='parcel-receipt';copy.inert=true;copy.setAttribute('aria-hidden','true');
  // The letter is hidden while manually packing; its completion can still
  // appear in the reception rail after the player returns from the table.
  Object.assign(copy.style,{left:(r.width?(r.left-game.left)/scale:1010)+'px',top:(r.height?(r.top-game.top)/scale:108)+'px',width:(r.width?r.width/scale:240)+'px',height:(r.height?r.height/scale:165)+'px'});
  const actions=copy.querySelector('.parcel-actions');if(actions)actions.innerHTML='<b class="parcel-completed-label">Выполнено ✓</b>';
  $('effects').append(copy);const motion=copy.animate([{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(-16px) scale(.97)'}],{duration:1500,easing:'ease-in',fill:'forwards'});motion.finished.catch(()=>{}).finally(()=>copy.remove());return copy;
}
function updateParcelReceipt(receipt,o){
  if(!receipt||!o.regularKey)return;
  const completed=Math.min(3,state.story?.regularContracts?.[o.regularKey]?.deliveries||0);
  receipt.querySelectorAll('.agreement-delivery').forEach((square,index)=>{square.classList.toggle('checked',index<completed);square.textContent=index<completed?'✓':'';});
}
function automaticParcelFeedback(o,amount){
  const sheets=[...document.querySelectorAll('#orderBoard [data-order-id],#contractOfferBoard [data-order-id]')];
  const origin=sheets.find(node=>Number(node.dataset.orderId)===o.id&&node.getClientRects().length&&node.getBoundingClientRect().width>0);
  if(!origin)return;
  const receipt=parcelReceipt(origin);updateParcelReceipt(receipt,o);animateGold(amount,receipt||origin);beep();
}
function claimParcel(o,origin){
  if(state.paused||!Goblin.readyToClaim(o))return false;
  const receipt=parcelReceipt(origin),amount=o.reward-Math.min(3,o.reward);
  if(!Goblin.claim(o)){receipt?.remove();return false;}
  updateParcelReceipt(receipt,o);
  animateGold(amount,receipt||origin);beep();return true;
}
function openGoblinParcel(){
  if(!state.started||state.paused||state.autoSorting)return;
  const active=allOrders().find(o=>o.id===state.goblin?.job?.orderId)||allOrders().find(o=>o.accepted!==false&&Goblin.isAssigned(o))||allOrders().find(o=>o.accepted!==false);
  if(active)openOrder(active);else{cancelDrag();City.close();state.screen='work';state.mode='order';state.activeCat=null;state.inspectCat=null;render();save();toast('Примите посылку у стойки — здесь Грик будет её собирать.');}
}
