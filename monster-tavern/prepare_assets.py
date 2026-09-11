"""Register source rectangles; preserve the user's original PNGs unchanged."""
from pathlib import Path
from PIL import Image
import shutil, json
root=Path(__file__).resolve().parent
out=root/'assets'/'custom'
out.mkdir(parents=True,exist_ok=True)
for n in range(3,11):
    source=Path('D:/Downloads')/f'ChatGPT Image 10 сент. 2026 г., 10_38_30 ({n}).png'
    shutil.copyfile(source,out/f'sheet-{n}.png')
sprites={}
def add(sheet,names,xs,y0,y1):
    im=Image.open(out/f'sheet-{sheet}.png')
    for name,x0,x1 in zip(names,xs,xs[1:]):
        box=im.getchannel('A').crop((x0,y0,x1,y1)).getbbox()
        if box:
            a,b,c,d=box
            sprites[name]={'sheet':sheet,'x':x0+a,'y':y0+b,'w':c-a,'h':d-b}
add(3,['ranger','knight','hunter','mushroom_mage'],[0,315,630,935,1254],0,478)
add(3,['ice_mage','rogue','berserker'],[0,385,731,1254],478,879)
add(3,['goblin','raven','wolf_rider'],[0,351,706,1254],879,1254)
add(4,['alchemist','smith','steward','innkeeper'],[0,307,606,900,1254],0,480)
add(4,['noble','scribe','sage','butcher'],[0,331,596,902,1254],480,940)
add(4,['courier','owl'],[251,604,960],940,1254)
add(5,['crate','weapons_crate','sack','barrel','chest'],[0,282,550,764,963,1254],0,352)
add(5,['basket','cart','storage_sign','hook','lantern'],[0,280,598,938,1084,1254],352,675)
add(5,['crate_tag','supply_tag','weapon_tag','parcel','cage'],[0,225,445,675,990,1254],675,940)
add(5,['bottles','herb_bundle','scroll_case','ledger'],[0,375,611,940,1254],940,1254)
add(6,['eyes','crab_leg','slime','fur_fang','horn','feathers'],[0,242,471,703,874,1039,1254],0,350)
add(6,['ear','claw','fang','bone_plate','skull','eye_jar'],[0,237,415,635,827,1034,1254],350,640)
add(6,['wing','tail','scales','rib','heart','slime_sack'],[0,241,427,679,838,1040,1254],640,916)
add(6,['fang_necklace','spirit_jar','ice_heart','fungus_fang','cursed_fang','meat'],[0,239,425,644,848,1034,1254],916,1254)
add(7,['red_mushroom','mushroom','herb','ice_herb','thorn'],[0,250,500,751,1003,1254],0,301)
add(7,['root','flowers','moss','glowing_mushroom','potion'],[0,250,500,751,1003,1254],301,550)
add(7,['poison','salt','berries','bellflower','blue_flower'],[0,250,500,751,1003,1254],550,782)
add(7,['mandrake','leaves','incense','green_jar','flour'],[0,250,500,751,1003,1254],782,1031)
add(7,['candles','spice'],[0,278,588],1031,1254)
add(8,['iron','silver','gold_ore','purple_crystal','ice_crystal'],[0,250,505,760,1010,1254],0,277)
add(8,['geode','rune_stone','magic_orb','totem','eye_amulet'],[0,250,505,760,1010,1254],277,552)
add(8,['ring','gems','rune_tablet','flaming_skull','fire_jar'],[0,250,505,760,1010,1254],552,806)
add(8,['compass','relic_box','coins','crown','staff_relic'],[0,250,505,760,1010,1254],806,1057)
add(8,['dragon_scale','key'],[342,610,947],1057,1254)
add(9,['sword','dagger','axe','spear','bow','crossbow'],[0,265,420,634,816,1000,1254],0,438)
add(9,['helmet','shield','gauntlet','boots','chainmail'],[0,220,495,712,987,1254],438,720)
add(9,['pot','broken_lantern','bottle','rope','horseshoe','nails'],[0,236,409,630,830,1012,1254],720,954)
add(9,['rags','wheel','pan','scrap','bucket'],[0,250,500,760,1010,1254],954,1254)
add(10,['portal','workbench','shelves'],[0,410,842,1254],0,350)
add(10,['apothecary','forge','meat_rack','altar'],[0,349,699,1033,1254],350,667)
add(10,['trophy_cabinet','royal_chest','wagon'],[0,409,812,1254],667,919)
add(10,['owl_post','notice_board','recipe_desk','monster_cage'],[0,329,598,927,1254],919,1254)
(out/'sprites.json').write_text(json.dumps(sprites,ensure_ascii=False,indent=2),encoding='utf8')
print(f'Registered {len(sprites)} sprites from all 8 original sheets. No image pixels changed.')
