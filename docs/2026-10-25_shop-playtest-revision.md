# Правки лавки после плейтеста — 25 октября 2026

Действующая редакция учитывает последнее уточнение пользователя: меньше ручных посылок во втором дне, сначала работа Борина, Грик доступен с дня 3, новые договорённости только после покупки башни. Ранние правила этой правки о 3/3 и выключенном найме заменены. Существующие предметы и заработок не пересчитываются задним числом.

- В начале 80 монет. Первый авантюрист продаёт восемь находок за 10; уже оплаченной дедовой поставки больше нет. История наследства относится к лавке.
- Каждая покупка сразу фиксирует расход и исходные экземпляры товара. Рядом с кошельком появляется красное «−10». Высыпание занимает 1,5 активной секунды: открытый мешок, падение настоящих вещей в неровную россыпь, исчезновение мешка. Пауза и скрытая вкладка останавливают сцену; загрузка показывает уже купленные вещи без повторного списания.
- Все вещи должны оставаться доступны настоящим кликом, в том числе при 820×850. Сохраняются uid и свободное перемещение; повреждённые старые координаты восстанавливаются без потери товара.
- После распознавания награда начисляется один раз, монеты летят к кошельку, через 1,5 секунды окно закрывается само. Пока оно открыто, торговля и помощники стоят на паузе. Скрытая вкладка останавливает отсчёт показа результата.
- Кошелёк находится слева сверху на всех рабочих экранах, размер цифр — 69 px вместо 23. Надпись гильдии в шапке убрана. Все награды используют текущую геометрию значка кошелька.
- Следующий посетитель приходит спустя две активные секунды после полного разбора мешка. До окончания сортировки его приход не запускается. После выдачи посылки следующий торговый цикл тоже начинается через две секунды.
- Первый день: два покупных мешка и две посылки, затем восстановление за 30. Преображение 4 секунды, рассвет ещё 2. Паутина сметается веником, старые ящики сменяются новыми, через дымку появляются стеллажи и вывеска; отдельный фон скрывает мебель до ремонта.
- Новый второй день: шесть поставок и две посылки, два блока «три поставщика → покупатель». Доля покупателей 25% относится к обычным торговым визитам после вводного дня. Свет следует прогрессу; после второй выдачи — итог и явная кнопка дня 3. С дня 3 до покупки башни тот же ритм 3:1, день длится 180 активных секунд.
- После первой выдачи второго дня и минимум двух разобранных поставок приходит Борин. В новом обычном маршруте разобраны три мешка. Найм 120 сразу включает сортировку без автоматического открытия улучшений. Настройки доступны вручную; отказ оставляет поздний найм. Старый выключенный сотрудник при загрузке не включается.
- Работа Борина по-прежнему стоит 2 за партию, 2,5 секунды на предмет. Неизвестное попадает на поднос. Ручные действия, реальные экземпляры, сохранение и параллельная работа с принятыми посылками остаются доступны.

Грик открывается с дня 3 после B2, найм 240, явное включение и поручение одной принятой обычной посылки через улучшения; работа не требует раннего договора. Новые договорённости открываются только после фактической покупки башни 1000 с дня 4; жёлтые листки с подсветкой/«СРОЧНО», без сроков и штрафов. Старые подписи, частичная сборка, резервы и наймы сохранены. Подробности — в [отчёте продолжения](2026-10-25_city-contracts-and-stock.md).

Пример денег после первого дня с распознаванием: 80 − 10 + 12 + 40 − 10 + 60 − 30 = **142**. Награда за изучение не обязательна для оплаты восстановления.

## Изображения

Открытый мешок: `dist/assets/open-loot-bag.png`. Сгенерирован встроенным `image_gen` с прозрачностью и с существующим `dist/assets/storage/bag.png` как стилевым референсом.

Борин: `dist/assets/dwarf-borin-redhat.png`. Сгенерирован тем же встроенным инструментом по присланному пользователем `dc5b72d57cd111eea8b44659bdca6a39_upscaled.jfif`: красный мягкий колпак, белая борода, зелёная туника, коричневый жилет. Полнофигурный PNG 1024×1536 с альфа-каналом используется при приходе, в рабочем уголке и в улучшениях. Старый спрайт сохранён отдельным файлом.

Промпт мешка:

> Use case: stylized-concept. Asset type: transparent sprite for an existing cozy fantasy shop browser game, an OPEN loot sack used briefly when pouring purchased items onto a wooden sorting table. Image 1 is a STYLE REFERENCE of the existing closed sack, not an edit target: match its hand painted warm tan burlap, thick dark ink outlines, small game sprite readability, simple sun-like merchant emblem, golden rope and gentle parchment shading. Generate one single open tipped sack, full object isolated, a wide visibly open dark mouth pointing diagonally down-right as if contents are falling OUT, loose cord, folds showing emptied soft cloth. Slight three-quarter view, recognizable empty bag, compact silhouette with clean alpha edges and generous transparent padding. No items or particles, no table, no ground, no shadow rectangle, no character, no background, no written text, no additional icons. Output genuinely transparent background. Keep illustration compatible with 200px high displayed game sprite.

Промпт Борина:

> Use case: stylized-concept. Asset type: single transparent character sprite for The Lootkeeper cozy fantasy shop game, Borin the dwarf who sorts merchandise. Image1 is the character identity and appearance REFERENCE. Preserve the distinctive friendly round face, expressive warm dark eyes, big round nose, white eyebrows, huge soft white moustache and long white beard, tall floppy red pointed cloth hat, green tunic, brown sleeveless leather vest and brown cuffs; the same approachable little elderly worker. Create one clean full body sprite standing in a slight three-quarter front view and looking toward the player, compact short dwarf proportions, sturdy brown boots, kind smile. Both hands visible at waist height in a welcoming job interview gesture, one hand open and the other lightly touching his vest; empty hands. Adapt the rendering to readable hand-painted fantasy game illustration with crisp dark outlines, warm highlights, detailed but simplified cloth and beard, good readability at200px high. Keep the reference character identity and clothing. Frame full hat to boots, single isolated character centered with a small transparent margin, no cropping. Transparent background with proper alpha. No books, furniture, scenery, library, ground plane, shadow rectangle, tools, text, UI, border, or additional characters. This sprite is used both beside a shop counter and next to a sorting workbench.

## Проверка

Текущий набор включает 14 браузерных проверок, в том числе новое визуальное восстановление. 13 полных стандартных команд прошли с PASS, exit 0; story-goblin проверен отдельно финансовой трассой и полным набором фикстур (STORY_FIXTURES_ONLY=1, exit 0). Полный стандартный story-goblin после исправления ожиданий не повторялся. Подробности и полный список — в [отчёте города, договорённостей и ассортимента](2026-10-25_city-contracts-and-stock.md). Старый результат 12 PASS описывал предыдущую версию и не переносится автоматически на новые требования.
