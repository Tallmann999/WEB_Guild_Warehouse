// One stable manifest for the native renderer. Gameplay keeps item type/uid;
// neither scenes nor saved games depend on Phaser texture handles.
export const ASSETS={
  'environment.menu':'assets/start-lootkeeper.png',
  'environment.shop':'assets/reception.png',
  'environment.shop-bare':'assets/reception-bare-walls.png',
  'environment.shop-derelict':'assets/reception-derelict.png',
  'environment.shop-furnished':'assets/reception-guild-furnished.png',
  'environment.city':'assets/city-town-map.png',
  'environment.tower':'assets/tower-mage/room.png',
  'prop.tower-workbench':'assets/tower-mage/workbench.png',
  'prop.tower-mechanism':'assets/tower-mage/mechanism.png',
  'prop.tower-orb':'assets/tower-mage/orb.png',
  'character.borin':'assets/dwarf-borin-redhat.png',
  'character.borin-carry':'assets/dwarf-borin-carry.png',
  'character.grik':'assets/goblin-grik-packer.png',
  'prop.open-bag':'assets/open-loot-bag.png',
  'prop.box-top':'assets/storage/box-top.png'
};
for(const stage of ['derelict','bare-walls','guild-furnished']){
  for(const time of ['day','night'])ASSETS['environment.reception-'+stage+'-'+time]='assets/New Sprites/backgrounds/'+stage+'-'+time+'.png';
  ASSETS['prop.reception-'+stage+'-counter']='assets/New Sprites/counters/'+stage+'-counter.png';
}
const raw=['s1_19','s3_0','s3_1','s3_2','s3_3','s3_5','s3_6','s3_7','s4_0','s4_1','s4_3','s4_5','s10_2','s10_3',
  's6_7','s6_4','s6_5','s6_14','s6_10','s6_12','s7_0','s7_1','s7_2','s7_3','s7_5','s7_6','s8_0','s8_1','s8_2','s8_3','s8_4','s8_5',
  's9_0','s9_1','s9_2','s9_3','s9_4','s9_5','s9_6','s9_7','s9_8','s9_9','s9_10','s9_14'];
for(const name of raw)ASSETS['art.'+name]='assets/'+name+'.png';
for(const [series,count]of [[5,19],[6,17],[7,18]])for(let i=0;i<count;i++)ASSETS['loot.ingredient-'+series+'-'+i]='assets/ingredients/item'+series+'-'+i+'.png';
for(const name of ['crate','chest','cage','weapons','herbs','potions','bag','bag-premium','parcel','open-crate','case','cart','basket','barrel'])ASSETS['prop.'+name]='assets/storage/'+name+'.png';
const keyByPath=new Map(Object.entries(ASSETS).map(([key,path])=>[path,key]));
export function assetPath(source){
  const path=String(source||'').split(/[?#]/)[0].replaceAll('\\','/');
  const index=path.lastIndexOf('/assets/');
  return index>=0?path.slice(index+1):path.replace(/^\.\//,'');
}
export function textureKey(source){return keyByPath.get(assetPath(source))||null;}
export function assetUrl(path){return new URL('../'+path,import.meta.url).href;}
