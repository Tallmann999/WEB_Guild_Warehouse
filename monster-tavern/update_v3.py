from pathlib import Path
import re
p=Path(__file__).resolve().parent
h=(p/'index.html').read_text(encoding='utf8')
h=re.sub(r'<section class="panel"><div class="panelhead"><h2>У очага</h2>.*?</section>','',h)
h=h.replace('<div class="scene-note">','<nav class="quick-access" aria-label="Книга и припасы"><button data-panel="recipes">Книга рецептов</button><button data-panel="stock">Склад <span id="stockTotal"></span></button></nav><div class="scene-note">')
h=re.sub(r'<button data-tab="stock">.*?</button><button data-tab="recipes">.*?</button>','',h)
(p/'index.html').write_text(h,encoding='utf8')
g=(p/'game.js').read_text(encoding='utf8')
a=g.index("if(a==='cook'){");b=g.index("if(a==='clearbag')",a)
g=g[:a]+"if(a==='cook'){startCooking();return;}"+g[b:]
a=g.index("const orders=guests.filter",g.index('function renderUI'));b=g.index('const e=state.event',a)
g=g[:a]+'renderOrders();'+g[b:]
g=g.replace("modal.type==='trophy'||modal.type==='cook'&&modal.step===1","modal.type==='trophy'")
g=g.replace('drawScene(now/1000);','if(!document.hidden)advanceCooking(raw);drawScene(now/1000);')
g=g.replace("if(b.dataset.up)upgrade(b.dataset.up);","if(b.dataset.up)upgrade(b.dataset.up);if(b.dataset.panel)openPanel(b.dataset.panel);")
g=g.replace("tab='stock';document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));renderTab();","openPanel('stock');")
g=g.replace("toast('Доставка: припасы пополнены');renderUI();save();","toast('Доставка: припасы пополнены');renderUI();if(modal?.type==='panel'&&modal.panel==='stock')refreshPanel();save();")
(p/'game.js').write_text(g,encoding='utf8')
d=(p/'dashboard.js').read_text(encoding='utf8').replace("function renderTab(){let html='';","function dashboardContent(tab){let html='';")
d=d.replace("if($('tabContent').innerHTML!==html)$('tabContent').innerHTML=html;}","return html;}\nfunction renderTab(){const html=dashboardContent(tab);if($('tabContent').innerHTML!==html)$('tabContent').innerHTML=html;}")
(p/'dashboard.js').write_text(d,encoding='utf8')
a=(p/'assembly.js').read_text(encoding='utf8')
start=a.index('function cookUI()');end=a.index('function supplyUI()',start)
a=a[:start]+'''function cookUI(){const g=guests.find(g=>g.id===modal.guest),r=RECIPES[g.recipe];if(modal.step===0){const options=[...new Set([...r.need,0,1,2,3,11,7])].slice(0,6).sort((a,b)=>a-b);assemblyUI(r.name,'Кухня',options,'cook','Готовить');}else show(modalHead('Кухня',r.name)+`<div class="board heat-board simmer">${r.need.map(i=>artIcon(ingredientArt[i],65)).join(' + ')}<span>→</span>${artIcon('pot',115)}</div><h3 class="cooking-title">Блюдо готовится…</h3><p>Когда полоска заполнится, официант автоматически подаст заказ.</p><div class="cook-progress" id="cookProgress" role="progressbar" aria-label="Приготовление блюда" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="cookFill"></i></div><p class="cook-time" id="cookTime">${Math.ceil(modal.duration)} с</p><p class="hint">Можно отменить приготовление, закрыв окно. Ингредиенты вернутся на склад.</p>`);}
function startCooking(){if(modal?.type!=='cook'||modal.step!==0)return;if(!assemblyReady()){toast('Положите все ингредиенты на плиту');return;}const r=RECIPES[guests.find(g=>g.id===modal.guest).recipe];if(r.need.some(i=>state.stock[i]<1)){toast('Не хватает продуктов');return;}cancelCarry();modal.step=1;modal.elapsed=0;modal.duration=5/(1+state.up.kitchen*.22);cookUI();}
function advanceCooking(dt){if(modal?.type!=='cook'||modal.step!==1)return;modal.elapsed=Math.min(modal.duration,modal.elapsed+dt);const percent=Math.round(modal.elapsed/modal.duration*100);$('cookFill').style.width=percent+'%';$('cookProgress').setAttribute('aria-valuenow',percent);$('cookTime').textContent=Math.max(0,Math.ceil(modal.duration-modal.elapsed))+' с';if(modal.elapsed<modal.duration)return;const g=guests.find(g=>g.id===modal.guest);if(g?.phase==='seated'){RECIPES[g.recipe].need.forEach(i=>state.stock[i]--);finishGuest(g,true,1);}closeModal();}
'''+a[end:]
a=a.replace('<span>СЮДА НУЖНО ПОЛОЖИТЬ</span>',"<span>${label==='Кухня'?'ПЛИТА · ПОЛОЖИТЕ ИНГРЕДИЕНТЫ':'СЮДА НУЖНО ПОЛОЖИТЬ'}</span>")
a=a.replace("assemblyReady()?'Всё на месте. Заказ можно передать.'","assemblyReady()?(modal.type==='cook'?'Всё на плите. Нажмите «Готовить».':'Всё на месте. Заказ можно передать.')")
(p/'assembly.js').write_text(a,encoding='utf8')
