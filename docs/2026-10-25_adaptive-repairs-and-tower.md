# The Lootkeeper — адаптивность, видимый ремонт и башня

> Последняя спецификация геометрии — [игра целиком в окне](2026-10-25_viewport-fit.md): внешняя прокрутка запрещена, Phaser и DOM находятся в одной логической рамке не меньше 1280×800. Описанный ниже рост страницы по содержимому и проверка adaptive-interface относятся к предыдущей редакции. Правила ремонта, торговли и башни продолжают действовать.

Последнее поручение 25 октября 2026. Это продолжение незакоммиченного переноса на Phaser поверх `main/c2d5eb4`. Живое сохранение не сбрасывалось, публикация/коммит/push не выполнялись.

## Интерфейс и слои

- Размер игрового поля теперь следует ширине устройства и содержимому. Убрано сжатие всей игры в фиксированный кадр 1280×800. Узкий экран перестраивает полки и сборку в колонки; при необходимости прокручивается страница, а не обрезанный листок поручения. Canvas Phaser меняет размер вместе с полем, координаты ввода используют ту же геометрию.
- Общая полоса поручений находится сверху, под кошельком/днём. Принятые обычные и договорные листки показывают получателя, название, весь список с количеством и цену. У окна сборки восстановлены эти же данные. Листки расширяются по содержимому; горизонтальной и вложенной прокрутки информационного листа нет. Прокрутка физического содержимого ящика остаётся.
- Фоном поручений, договоров и списка сборки служит новый `dist/assets/quest-parchment.png`. Общие детали обычной посылки создаёт `parcelContents` в `dist/ui/parcel-actions.js`; адаптивная раскладка — `dist/responsive.css`.
- Подсветка предмета рисуется нативно позади его изображения. Мешок высыпания находится перед россыпью. Маленький Борин и переносимый им настоящий экземпляр находятся поверх ящика при осмотре; в режиме сборки его работа по-прежнему идёт в фоне.
- Чёрный силуэт применяется только к неизвестной вещи. Раньше признак `.unknown` распространялся и на тело носильщика. Портрет Грика теперь той же высоты и на том же уровне, что у Борина, справа от своего текста.
- После найма Борина кнопка быстрой сортировки поручает работу ему. Она больше не обходит его платную работу мгновенным бесплатным переносом. Разбор — 2,5 активные секунды на экземпляр, комиссия 2 за партию один раз, сохранённый elapsed и ручная вещь защищены.

## Лавка и город

- Новая стадия 0 — отдельное серое разрушенное помещение с грязью, обваленной штукатуркой и большим количеством паутины (`reception-derelict.png`). За четыре активные секунды первой уборки оно плавно превращается в чистые пустые стены.
- Стадия 1 пока использует прежний `reception-bare-walls.png`: пользователь упомянул отдельный референс после первой починки, но изображения в последнем сообщении нет. Новую замену этого фона без референса не выдумывали. Стадия 2 сохраняет заработанное обустройство с мебелью и вывеской.
- Оба преображения занимают **ровно 4 активные секунды**, утром, без дополнительной ночи/рассвета. Уведомление и начало возвращают из города/башни в лавку и показывают изменяемое помещение, подписи фаз и прогресс. Процесс выводится в поле зрения на адаптивной странице. После завершения сразу продолжается утренняя торговля. Первый расход 30 однократен; второе обустройство бесплатно.
- Старый сохранённый `dawn` означает уже заработанное преображение: он завершается без повторной оплаты и нового ожидания. Частичные посылки, uid, резервы и выключатели сохраняются.
- В новой игре «Город» появляется только в главе покупки башни после подтверждения гильдии. Уже заработанный старый маршрут/владение совместимы с миграцией.
- После покупки за 1000 есть явная «Войти». Добавлены `Tower` и нативная `TowerScene`: вход, сохранение внутри, возврат на карту/в лавку. Помещение — тёмный разрушенный каменный зал с костями, старым каменным столом, костяным механизмом и фиолетовым шаром (`tower-interior.png`). Это окружение; механика мага/источника не добавлена.

## Деньги и пятый день

Состояние «на четвёртый день осталось 4» воспроизведено отдельной фикстурой. Наймы и несколько мешков переводили кассу в запас, а поставщик за 10 мог перекрыть путь покупателю. Ошибка кредитной закупки дополнительно требовала сумму долга заранее, хотя долг должен выплачиваться продажей. Полного исторического журнала живого сохранения нет: точную сумму всех старых покупок мы не утверждаем.

Теперь при нехватке денег приходит реальный покупатель свободного известного товара. Резервы и частичная ручная посылка остаются владельцу. Отложенный поставщик со своими исходными uid возвращается после продажи. Четыре товара обычного заказа дают 90; меньший остаток оценивается по той же ставке 22,5 за вещь с округлением вниз. Автомат сохраняет 2 на обработку. Кредитный мешок нужен только при отсутствии другого товарного пути и создаёт настоящий долг, погашаемый следующей продажей. Деньги и товар бесплатно не выдаются, цены 120/240/1000 и 10 не изменены.

На пятом дне появляется одно сохранённое информационное окно о росте рейтинга и элитных покупателях. В книге доступен новый клиент — Интендант короля. Королевская оружейная требует **5 железных мечей (тип 18), 5 кинжалов (19), 5 шлемов (24)**. Договор состоит из трёх реальных выдач по 15 вещей; выбранная цена новой большой посылки — **360**, или 24 за вещь против обычных 22,5. При выдаче Гриком остаётся 357 после комиссии 3. Типы добычи учитывают реальный дефицит нового договора; завершённые договоры больше не создают спрос. Алхимик сохраняет своё отдельное условие покупки башни.

## Проверка

Новые проверки текущего поручения, PASS / exit 0:

- `node tests/phaser-layers.cjs`: подсветка за вещью, мешок и носильщик поверх россыпи/ящика, чёрный только предмет, одинаковая высота работников, новые фоны и TowerScene.
- `node tests/story-dwarf-day5.cjs`: настоящий клик «Поручить Борину», 0 переносов за 2,49 и первый за 2,5 секунды; пауза, загрузка рабочего времени, защита руки и одна комиссия.
- `node tests/story-repair-tower.cjs`: четыре активные секунды, утро, переход из города к видимому ремонту, pause/reload/старый dawn, реальные частичные uid/резервы, закрытая карта, однократная покупка и вход/загрузка/возврат башни на 1280/820.
- `node tests/story-cash-recovery.cjs`: из 4 монет настоящая продажа даёт 94, возвращённый мешок и обработка оставляют 82; автомат с 11 не покупает мешок без резерва 2. Проверены кредит/реальное погашение без дублей и продажа единственной свободной вещи за 22.
- `node tests/story-royal-progress.cjs`: day5-информация один раз, новый клиент и 15 предметов, три настоящие выплаты по 357, уход ровно 45 исходных uid, сохранённая ручная частичная посылка и запрет четвёртой выдачи.
- `node tests/story-royal-loot.cjs`: правильные типы, дефицит 15, разнообразие/лимиты реальных мешков без создания денег/uid.
- `node tests/adaptive-interface.cjs`: полные данные листка и сборки, верхний ряд, отсутствие горизонтальной прокрутки и реальная ручная упаковка на 320×568, 390×844, 844×390, 820×850, 1280×800, 1920×1080.

Повторены с PASS: `phaser-engine`, обновлённый `story-restoration-visuals`, `story-loot-balance`, полный `story-automation` на 600 активных секундах. Полные `story-first-bag` и `story-source-layout` также прошли на 1280/820: платный старт/частичная загрузка и 22 настоящих доступных предмета, упаковка, работа Борина, деньги и резервы. Их хелперы прокручивают адаптивную страницу перед реальным кликом, экономические проверки сохранены. В финансовой фикстуре автоматизации day5-уведомление уже прочитано; само окно отдельно проверяет `story-royal-progress`. Это не утверждение о повторном прохождении всех старых 18/19 сценариев или о новом сквозном живом плейтесте.

## Новые изображения и точные промпты

Использован встроенный `image_gen`. Все результаты скопированы в репозиторий; исходные генерации оставлены. Фон лавки и интерьер башни непрозрачны, формат 1536×1024; бумага непрозрачная 1024×1536. При создании лавки редактировался `reception-bare-walls.png`; для башни он служил только референсом стиля. Бумага создана с нуля.

### `dist/assets/reception-derelict.png`

> Precise edit for a fantasy browser game background. The provided clean empty shop is EDIT TARGET. Create a NEW initial derelict state of EXACT same shop, camera, central window, mountain/castle town view, lantern location, wall beams, and foreground counter. 1536x1024 landscape. Preserve counter geometry from y635 to bottom and window frame geometry. Make the whole room clearly abandoned, cold desaturated GREY dirty and partly ruined: extensive thick white cobwebs in BOTH upper corners, ropes of webs between beams, heavy dusty surfaces, crumbling cracked plaster on side walls with missing sections exposing rough stone/lath, dark damp grime streaks, dusty crooked damaged window trim, splinters and peeling aged wood. Counter still usable and intact in silhouette but worn grey, dusty, scratched, chipped edges. Low grey overcast daylight through window with muted city colours, weak warm lantern only. No shelves, furniture, people, UI, text, signs, loose floor chests, added doors or changed perspective. Readable charming handpainted fantasy art matching reference, deliberately much dirtier and more damaged than reference; it should contrast strongly with a warm clean repaired shop.

### `dist/assets/quest-parchment.png`

> Production texture asset for fantasy game order sheets and parchment UI. ONE blank old handmade PAPER sheet, straight-on flat orthographic, portrait 2:3, 1024x1536 pixels. The entire canvas is warm pale cream parchment with a broad clean lightly mottled CENTRAL WRITING AREA (at least 82 percent of width and height) for readable dark game text, with subtly darker irregular aged/tattered edges within outer 5 percent, softened creases, fine paper grain and a few tiny brown age flecks at perimeter. Light neutral parchment, no heavy gradients across center. Painted cozy fantasy game style, restrained realistic paper fibers. No writing, symbols, stamps, seals, lines, illustrations, items, shadowed desk, background objects or frames. All pixels opaque. This image will be stretched as CSS background for cards and dynamically sized panels so avoid distinctive high contrast features; edges visually worn but rectangular canvas fully covered with paper.

### `dist/assets/tower-interior.png`

> Create a NEW fantasy game interior, reference image is STYLE REFERENCE ONLY for cohesive detailed handpainted cozy fantasy rendering. 1536x1024 landscape scene, first person view inside a dark abandoned ancient STONE TOWER workshop. Desaturated grey cracked stone walls, heavy dust, many large cobwebs, broken plaster, old curved arch and narrow high window admitting faint cold blue moonlike daylight; dim but clearly readable scene. Scattered old bones and a few skulls on dusty stone floor by the side walls, atmospheric rather than graphic. The lower foreground is one broad ancient chipped STONE WORKTABLE spanning the lower third. On back-center of the table stands a strange OLD MECHANISM BUILT FROM BONES, rib arches, vertebral gear ring and worn brass joints cradling a large luminous PURPLE CRYSTAL ORB in the central area (roughly x650..950 y350..650). Orb purple glow softly lights nearby bones and stone. No people, ghosts, monsters, UI, text, captions, treasure, blood, gore, labels or modern objects. Still camera, balanced playable game background with room for HUD across top and actions at sides, table clearly distinct from floor. Keep scene moody, abandoned and grey; focus on stone table, skeletal mechanism and purple orb.
