const sharp=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const fs=require('node:fs'),path=require('node:path');
const sheets={
 5:[
  [0,390,[0,263,520,795,1040,1254],['Стейк рогача','Рёбра зверя','Пряное мясо','Лапка грифона','Крыло грифона']],
  [390,690,[0,285,537,762,1030,1254],['Филе ящера','Жир ящера','Охотничьи колбаски','Кусочки мяса','Окорок зверя']],
  [690,949,[0,343,652,936,1254],['Рёбра вожака','Хвост ящера','Мешочек бобов','Вяленое мясо']],
  [949,1254,[0,311,539,751,1030,1254],['Грудинка зверя','Мозговая кость','Сердце зверя','Печень зверя','Язык зверя']]
 ],
 6:[
  [0,357,[0,376,641,962,1254],['Рога быка','Клыки кабана','Когти чудовища','Пятнистая шкура']],
  [357,657,[0,359,642,936,1254],['Белый мех','Кожа ящера','Красная чешуя','Пёстрые перья']],
  [657,930,[0,286,609,914,1254],['Лапа хищника','Кости зверя','Череп дракончика','Спинные шипы']],
  [930,1254,[0,277,556,734,981,1254],['Крыло летучей мыши','Выделанная кожа','Обломки костей','Панцирь чудовища','Золотые рога']]
 ],
 7:[
  [0,350,[0,297,508,745,1011,1254],['Голубая слизь','Болотная слизь','Ядовитая железа','Глаза чудовища','Магическое ядро']],
  [350,656,[0,292,541,755,1007,1254],['Огненная печень','Сердце чудовища','Ядовитый клык','Паучий шёлк','Яйцо дракончика']],
  [656,935,[0,292,493,748,1007,1254],['Кристальная кость','Кровь чудовища','Ледяные перья','Ледяная железа','Огненная плоть']],
  [935,1254,[0,458,793,1254],['Теневой рог','Синяя чешуя','Золотой жир']]
 ]
};
(async()=>{
 const dir=path.resolve(__dirname,'../dist/assets/ingredients');fs.mkdirSync(dir,{recursive:true});const entries=[];
 for(const [sheet,rows] of Object.entries(sheets)){let index=0;
  for(const [top,end,xs,names] of rows)for(let i=0;i<names.length;i++){
   const width=xs[i+1]-xs[i],height=end-top;
   const {data}=await sharp(`C:/Users/User/Downloads/Guild Warehouse/item${sheet}.png`).extract({left:xs[i],top,width,height}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   // Discard only tiny isolated border flecks; retain detached parts of each item.
   const seen=new Uint8Array(width*height),groups=[];
   for(let p=0;p<seen.length;p++){if(seen[p]||data[p*4+3]<8)continue;const group=[p];seen[p]=1;
    for(let j=0;j<group.length;j++){const q=group[j],x=q%width,y=Math.floor(q/width);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy,n=ny*width+nx;if(nx<0||ny<0||nx>=width||ny>=height||seen[n]||data[n*4+3]<8)continue;seen[n]=1;group.push(n);}}
    groups.push(group);
   }
   const cutoff=Math.max(100,Math.max(...groups.map(g=>g.length))*.08);
   for(const group of groups)if(group.length<cutoff)for(const q of group)data[q*4+3]=0;
   const sprite=`ingredients/item${sheet}-${index++}`;
   await sharp(data,{raw:{width,height,channels:4}}).trim({background:'#00000000'}).extend({top:4,bottom:4,left:4,right:4,background:'#00000000'}).png().toFile(path.resolve(__dirname,'../dist/assets',sprite+'.png'));
   entries.push({name:names[i],cat:sheet==='6'||['Паучий шёлк','Ядовитая железа','Болотная слизь','Ледяные перья','Ледяная железа','Магическое ядро'].includes(names[i])?0:4,sprite,organic:true,food:sheet==='5'});
  }
 }
 fs.writeFileSync(path.join(dir,'catalog.json'),JSON.stringify(entries,null,2));
 const thumbs=await Promise.all(entries.map(async(e,i)=>({input:await sharp(path.resolve(__dirname,'../dist/assets',e.sprite+'.png')).resize(100,100,{fit:'contain',background:'#77716a'}).png().toBuffer(),left:i%9*110,top:Math.floor(i/9)*110})));
 await sharp({create:{width:990,height:Math.ceil(entries.length/9)*110,channels:4,background:'#77716a'}}).composite(thumbs).png().toFile(path.resolve(__dirname,'../audit_source/monster-cutouts.png'));
 console.log(`Cut ${entries.length} items`);
})();
