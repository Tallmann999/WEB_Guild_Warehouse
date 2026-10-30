'use strict';

// Non-blocking reminders. They do not set tutorial.active, pause workers,
// assign a parcel or acquire an inventory instance.
const StaffGuidance=(()=>{
  function ensure(){
    if(!state.story)return null;
    const g=state.story.staffGuidance??={assistantShown:[],assistantDismissed:[],unknownDismissed:[]};
    return g;
  }
  function guide(){
    const g=ensure();
    if(!g||!state.started||state.paused||state.autoSorting||document.hidden||drag||state.selected!==null||BagPour.active()||Restoration.active())return false;
    let acknowledged=false;
    for(const id of g.assistantShown){
      const o=allOrders().find(o=>o.id===id);
      if((!o||Goblin.isAssigned(o))&&!g.assistantDismissed.includes(id)){g.assistantDismissed.push(id);acknowledged=true;}
    }
    if(acknowledged)save();
    const unknown=state.unknownTray?.find(x=>isUnknown(x)&&!g.unknownDismissed.includes(x.uid));
    if(unknown&&state.dwarf?.hired&&state.screen==='work'&&state.mode==='sort'){
      let target,message;
      if(!modalIsOpen()){target=$('unknownTrayButton');message='Борин нашёл неизвестный предмет. Откройте поднос и распознайте находку.';}
      else if($('unknownTrayItems')){target=document.querySelector('[data-tray-uid="'+unknown.uid+'"]');message='Нажмите неизвестную находку, чтобы распознать её.';}
      else if($('cleanKey')&&!$('cleanKey').disabled){target=$('cleanKey');message='Распознайте предмет: очищайте его мышью или нажимайте «Распознать».';}
      if(target){tutorialGuide(target,message,false,{label:'Понятно',skip:()=>{g.unknownDismissed.push(unknown.uid);save();}});$('tutorialGuide').dataset.staffHint='recognition';return true;}
    }
    if(state.screen!=='reception'||modalIsOpen()||!state.goblin?.hired)return false;
    const eligible=allOrders().filter(o=>o.accepted!==false&&!o.delivered&&!Goblin.isAssigned(o)&&!g.assistantDismissed.includes(o.id));
    const order=eligible.find(o=>g.assistantShown.includes(o.id))||(g.assistantShown.length<2?eligible.find(o=>!g.assistantShown.includes(o.id)):null);
    if(!order)return false;
    const target=document.querySelector('#taskRail [data-order-id="'+order.id+'"] [data-parcel-action="assistant"]');
    if(!target||target.disabled||!target.getClientRects().length)return false;
    if(!g.assistantShown.includes(order.id)){
      const letters=$('taskRail').querySelector('.task-letters'),r=target.getBoundingClientRect(),area=letters.getBoundingClientRect();
      if(r.bottom>area.bottom||r.top<area.top)letters.scrollTop+=r.bottom-area.bottom+12;
      g.assistantShown.push(order.id);save();
    }
    tutorialGuide(target,'Новая посылка: нажмите «Доверить помощнику», чтобы Грик начал сборку. Подсказка '+(g.assistantShown.indexOf(order.id)+1)+' из 2.',false,{label:'Понятно',skip:()=>{g.assistantDismissed.push(order.id);save();}});
    $('tutorialGuide').dataset.staffHint='assistant';return true;
  }
  return {guide};
})();
