'use strict';
const ART=window.TAVERN_SPRITES;
const artSheets={};
for(const [sheet,url] of Object.entries(window.TAVERN_SHEETS)){
  // CSS custom properties reject very long data URLs in Chromium. Local Blob
  // URLs keep the original bytes intact and work in the single-file build too.
  const bytes=Uint8Array.from(atob(url.slice(url.indexOf(',')+1)),c=>c.charCodeAt(0));
  const localUrl=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));
  const img=new Image(); img.src=localUrl; artSheets[sheet]=img;
  document.documentElement.style.setProperty('--sheet-'+sheet,`url("${localUrl}")`);
}
const ingredientArt=['flour','meat','mushroom','bottles','potion','lantern','rope','crab_leg','slime','berries','rib','herb'];
const guestArt=['ranger','knight','hunter','mushroom_mage','ice_mage','rogue','berserker','goblin','raven','wolf_rider'];
function artIcon(key,size=44,label=''){
  const s=ART[key];if(!s)return '';
  const k=Math.min(size/s.w,size/s.h),w=s.w*k,h=s.h*k;
  return `<span class="art" ${label?`role="img" aria-label="${label}"`:'aria-hidden="true"'} style="width:${size}px;height:${size}px"><span style="width:${w}px;height:${h}px;background-image:var(--sheet-${s.sheet});background-size:${1254*k}px ${1254*k}px;background-position:${-s.x*k}px ${-s.y*k}px"></span></span>`;
}
function artAsset(key,x,y,w,h=w){
  const s=ART[key],img=s&&artSheets[s.sheet];if(!img?.complete||!img.naturalWidth)return;
  const sx=canvas.width/1000,sy=canvas.height/680,unit=Math.min(sx,sy);
  const k=Math.min(w*unit/s.w,h*unit/s.h),dw=s.w*k/sx,dh=s.h*k/sy;
  ctx.drawImage(img,s.x,s.y,s.w,s.h,x+(w-dw)/2,y+h-dh,dw,dh);
}
