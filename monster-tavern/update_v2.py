"""One-time source migration to the custom-art interface."""
from pathlib import Path
p=Path(__file__).resolve().parent
g=(p/'game.js').read_text(encoding='utf8')
a=g.index('const atlas=new Image();');b=g.index('function log(',a);g=g[:a]+g[b:]
a=g.index('function cookUI()');b=g.index('function action(',a);g=g[:a]+g[b:]
a=g.index('function renderTab()');b=g.index('function rect(',a);g=g[:a]+g[b:]
a=g.index('function drawScene(');b=g.index('function frame(',a);g=g[:a]+g[b:]
g=g.replace("['Хлеб','🍞']","['Мука','🍞']").replace("['Факел','🔥']","['Фонарь','🔥']")
g=g.replace("function closeModal(){modal=null;","function closeModal(){cancelCarry();modal=null;")
g=g.replace("sprite:[98,112,84][type],","art:guestArt[n%guestArt.length],")
g=g.replace("${['🍲','🎒','🦀'][['cook','supply','trophy'].indexOf(g.kind)]}","${artIcon(g.art||guestArt[g.type],40)}")
g=g.replace("y>g.y-80","y>g.y-125")
g=g.replace("факел, мясо, верёвка","фонарь, мясо, верёвка")
g=g.replace("if(a==='cook'){","if(a==='cook'){cancelCarry();")
g=g.replace("Готовьте, собирайте припасы и разбирайте трофеи","Перетаскивайте продукты в ячейки заказа")
g=g.replace("$('tabContent').scrollIntoView({behavior:'smooth',block:'nearest'});","")
(p/'game.js').write_text(g,encoding='utf8')
h=(p/'index.html').read_text(encoding='utf8')
h=h.replace('</style></head>','</style><link rel="stylesheet" href="layout.css"></head>')
h=h.replace('<button class="small" id="help"', '<button class="small" id="fullscreen" title="Полный экран" aria-label="Полный экран">⛶</button><button class="small" id="help"')
h=h.replace('Спрайты: <a href="https://kenney.nl/assets/tiny-dungeon" target="_blank" rel="noreferrer">Kenney · CC0</a>', '<span class="asset-credit">Ваши спрайты · 8 листов</span>')
h=h.replace('<script src="game.js"></script>', '<script src="art.js"></script><script src="assembly.js"></script><script src="scene.js"></script><script src="dashboard.js"></script><script src="game.js"></script>')
h=h.replace('id="toast" hidden','id="toast" role="status" aria-live="polite" hidden')
(p/'index.html').write_text(h,encoding='utf8')
