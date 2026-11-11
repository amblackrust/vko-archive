"""Content built on the Wikimedia Commons selection (seed/media/commons/manifest.json). Data only.

What describes an image (title, description, date, place, author, licence, source) is taken from
the manifest by seed/open_materials.py. This file adds the catalogue structure of the fund ОИ-1
and the editorial texts of the exhibitions, collections, persons and map objects built from those
documents: only well-established facts, and what is not confirmed is said to be so in the text.
The materials are real but are NOT holdings of the archive; every text a visitor reads says that."""

FUND_NUMBER = "ОИ-1"
FUND_TITLE = "Открытые исторические материалы о регионе (подборка из Wikimedia Commons)"
FUND_ANNOTATION = (
    "Изображения с Викисклада (Wikimedia Commons), опубликованные под свободными лицензиями или находящиеся "
    "в общественном достоянии: гравюры, карты, фотографии и открытки XVIII — начала XX века и современные "
    "фотографии региона. В фонды Государственного архива Восточно-Казахстанской области они не входят. "
    "Автор, лицензия и ссылка на страницу файла указаны в карточке каждого документа; «ОИ-1» и шифры "
    "документов — нумерация подборки."
)
FUND_SOURCE = "commons.wikimedia.org: подборка свободно лицензированных изображений"

# (inventory number, title, [(case number, title, doc_type, language of the text on the image, [files])]).
# The order of the files is the document numbering: append, never reorder.
STRUCTURE = [
    ("1", "Опись 1. Фотографии и открытки XIX — первой половины XX века", [
        ("1", "Фотографии экспедиций и путешествий (1875–1914)", "photo", None, [
            "zaysan-post-1875.jpg", "zhemini-gorge-zaysan-1875.jpg", "altai-mountains-near-altai-station-1885.jpg",
            "altai-view-near-altai-station-1885.jpg", "bukhtarma-valley-rapids-1885.jpg",
            "altai-kazakh-eagle-hunter-borisov-1911.jpg",
        ]),
        ("2", "Открытки начала XX века", "photo", "ru", [
            "oskemen-view-from-cathedral-postcard.jpg", "oskemen-view-from-fire-station-postcard.jpg",
            "rakhmanov-springs-postcard-1900s.jpg", "black-berel-headwaters-borisov-1911.jpg",
        ]),
        ("3", "Портреты", "photo", None, [
            "george-kennan-portrait-1885.jpg", "bazhov-pavel-portrait-1911.jpg", "kornilov-lavr-portrait.jpg",
        ]),
        ("4", "Фотографии военных лет (1942)", "photo", None, [
            "wwii-kazakh-soldiers-letter-1942.jpg", "wwii-sowing-defence-hectares-urdzhar-1942.jpg",
        ]),
    ]),
    ("2", "Опись 2. Гравюры и рисунки XVIII–XIX веков", [
        ("1", "Иллюстрации из книги Дж. Кеннана «Siberia and the Exile System» (1891)", "drawing", "en", [
            "oskemen-town-view-kennan-1891.jpg", "upper-irtysh-valley-kennan-1891.jpg", "altai-station-kennan-1891.jpg",
            "bukhtarma-valley-picnic-kennan-1891.jpg", "white-berel-valley-descent-kennan-1891.jpg",
        ]),
        ("2", "Аблайкит в изданиях П. С. Палласа и Г. И. Спасского", "drawing", "ru", [
            "ablaikit-pallas-1786.jpg", "ablaikit-spassky-1818.jpg",
        ]),
    ]),
    ("3", "Опись 3. Карты, гербы и памятные знаки", [
        ("1", "Карты Семипалатинской области и маршрутов путешественников (1876–1903)", "map", "ru", [
            "map-zaysan-altai-stanitsa-finsch-1876.jpg", "map-route-semipalatinsk-altai-kennan-1891.jpg",
            "map-semipalatinsk-volosts-1893.png", "map-semipalatinsk-oblast-marks-atlas.jpg",
        ]),
        ("2", "Гербы и памятные знаки (1878, 1970)", "drawing", "ru", [
            "coat-of-arms-semipalatinsk-winkler-1878.jpg", "oskemen-250-years-badge-1970.jpg",
        ]),
    ]),
    ("4", "Опись 4. Современные фотографии (2008–2025)", [
        ("1", "Усть-Каменогорск: город и памятники архитектуры", "photo", None, [
            "oskemen-city-panorama-2019.jpg", "oskemen-irtysh-embankment-2024.jpg", "oskemen-ulba-river-2024.jpg",
            "oskemen-narodny-dom-drama-theatre-2024.jpg", "oskemen-local-history-museum-2024.jpg",
            "oskemen-art-museum-menovshchikov-office-2024.jpg", "oskemen-kozhevnikov-shop-gorky-st-2024.jpg",
            "oskemen-merchant-warehouse-gorky-st-2024.jpg", "oskemen-ethnographic-museum-shop-2024.jpg",
            "oskemen-metallurgists-palace-of-culture-2024.jpg", "oskemen-mass-grave-obelisk-2024.jpg",
        ]),
        ("2", "Промышленность и энергетика", "photo", None, [
            "oskemen-hydro-station-2017.jpg", "bukhtarma-reservoir-panorama-2013.jpg",
            "oskemen-metallurgical-complex-2016.jpg", "ulba-metallurgical-plant-leu-bank-2019.jpg",
            "ridder-sunset-aerial-2019.jpg", "ridder-view-from-kruglaya-sopka-2022.jpg",
        ]),
        ("3", "Природа Восточного Казахстана", "photo", None, [
            "ulba-valley-aerial-2019.jpg", "katon-karagay-bukhtarma-valley-2019.jpg", "markakol-urunkhaika-aerial-2019.jpg",
            "katon-ridge-altai-2025.jpg", "kazakh-altai-mountains-2008.jpg", "zaysan-lake-shore-2024.jpg",
            "belukha-yazevoe-lake-2021.jpg", "ivanovsky-ridge-west-altai-2017.jpg",
            "katon-karagay-national-park-2019.jpg", "kiin-kerish-2024.jpg",
        ]),
        ("4", "Археологические памятники", "photo", None, ["berel-kurgans-2018.jpg", "ablaikit-excavation-2018.jpg"]),
    ]),
]  # fmt: skip

_LOC = "Библиотека Конгресса США, Prints & Photographs Division, George Kennan Papers"
_WDL = "Мировая цифровая библиотека, World Digital Library"
_MUSEUM = "открытка в экспозиции Национального музея Республики Казахстан, фотография витрины"
# Per-file additions to the manifest:
#   holder    where the manifest says the original or its scan is kept;
#   note      a caveat shown on the card (historical_note);
#   year_from lower bound of «начало XX в.» for the catalogue filters (the dating stays marked as unconfirmed);
#   place, doc_type, lang  override the manifest / the case.
EXTRA: dict[str, dict] = {
    "altai-mountains-near-altai-station-1885.jpg": {"holder": _LOC},
    "altai-view-near-altai-station-1885.jpg": {"holder": _LOC},
    "bukhtarma-valley-rapids-1885.jpg": {"holder": _LOC},
    "george-kennan-portrait-1885.jpg": {"holder": _LOC},
    "zaysan-post-1875.jpg": {"holder": _WDL},
    "zhemini-gorge-zaysan-1875.jpg": {"holder": _WDL},
    "map-zaysan-altai-stanitsa-finsch-1876.jpg": {"holder": "Британская библиотека, скан книги", "lang": None},
    "map-route-semipalatinsk-altai-kennan-1891.jpg": {"lang": "en"},
    "oskemen-view-from-cathedral-postcard.jpg": {"holder": _MUSEUM, "year_from": 1901},
    "oskemen-view-from-fire-station-postcard.jpg": {"holder": _MUSEUM, "year_from": 1901},
    "map-semipalatinsk-oblast-marks-atlas.jpg": {"year_from": 1901},
    "oskemen-250-years-badge-1970.jpg": {"doc_type": "photo"},
    "kornilov-lavr-portrait.jpg": {
        "place": "Усть-Каменогорск (место рождения по одной из версий)",
        "note": "Место рождения Л. Г. Корнилова в литературе указывается по-разному: Усть-Каменогорск либо "
                "Каркаралинская станица (Каркаралинск). На сайте это сведение документами архива не подтверждено.",
    },
    "wwii-kazakh-soldiers-letter-1942.jpg": {
        "note": "Снимок сделан на фронте, в районе Старой Руссы, и к территории Восточно-Казахстанской области "
                "не относится.",
    },
    "wwii-sowing-defence-hectares-urdzhar-1942.jpg": {
        "holder": "каталог Государственного исторического музея",
        "note": "Урджарский район в 1942 г. входил в Семипалатинскую область Казахской ССР; сейчас это область Абай, "
                "а не Восточно-Казахстанская область.",
    },
}  # fmt: skip

_RU_TAIL = (
    " Изображения взяты из Wikimedia Commons и в фонды Государственного архива ВКО не входят. "
    "Автор, лицензия и источник указаны у каждого экспоната."
)
_KK_TAIL = (
    " Бейнелер Wikimedia Commons-тан алынған және Шығыс Қазақстан облысы мемлекеттік архивінің қорларына кірмейді. "
    "Әр экспонатта авторы, лицензиясы және дереккөзі көрсетілген."
)
_EN_TAIL = (
    " The images come from Wikimedia Commons and are not holdings of the State Archive of East Kazakhstan Region. "
    "The author, licence and source are given for every exhibit."
)

# Exhibits: (file, caption); caption None = the manifest description of the document.
EXHIBITIONS = [
    {
        "slug": "exhibition-ust-kamenogorsk", "theme": "ust-kamenogorsk", "period": "XIX — начало XX века",
        "title": {
            "ru": "Старый Усть-Каменогорск: гравюра, открытки и сохранившиеся здания",
            "kk": "Ескі Өскемен: гравюра, ашықхаттар және сақталған ғимараттар",
            "en": "Old Ust-Kamenogorsk: an engraving, postcards and surviving buildings",
        },
        "intro": {
            "ru": "Каким видели уездный Усть-Каменогорск путешественники и издатели открыток — и какие здания того "
                  "времени стоят в городе сегодня. Гравюра из книги Джорджа Кеннана (1891), две дореволюционные "
                  "открытки, герб Семипалатинской области и современные фотографии памятников архитектуры." + _RU_TAIL,
            "kk": "Саяхатшылар мен ашықхат шығарушылар уездік Өскеменді қалай көрді және сол дәуірдің қандай "
                  "ғимараттары бүгін де қалада тұр. Джордж Кеннан кітабындағы гравюра (1891), революцияға дейінгі екі "
                  "ашықхат, Семей облысының елтаңбасы және сәулет ескерткіштерінің қазіргі фотосуреттері." + _KK_TAIL,
            "en": "How travellers and postcard publishers saw the district town of Ust-Kamenogorsk, and which "
                  "buildings of that time still stand in the city. An engraving from George Kennan's book (1891), two "
                  "pre-revolutionary postcards, the coat of arms of Semipalatinsk Oblast and present-day photographs "
                  "of architectural monuments." + _EN_TAIL,
        },
        "cover": "oskemen-view-from-cathedral-postcard.jpg",
        "exhibits": [
            ("oskemen-town-view-kennan-1891.jpg",
             "Вид Усть-Каменогорска из книги Джорджа Кеннана «Siberia and the Exile System» (Нью-Йорк, 1891). Кеннан "
             "проезжал город в 1885 г. по пути из Семипалатинска на Алтай; автор рисунка на Викискладе не указан."),
            ("map-route-semipalatinsk-altai-kennan-1891.jpg", None),
            ("oskemen-view-from-cathedral-postcard.jpg", None),
            ("oskemen-view-from-fire-station-postcard.jpg", None),
            ("coat-of-arms-semipalatinsk-winkler-1878.jpg",
             "Герб Семипалатинской области, утверждённый 5 июля 1878 г., на странице гербовника П. П. фон Винклера. "
             "Усть-Каменогорск был уездным городом этой области."),
            ("oskemen-narodny-dom-drama-theatre-2024.jpg", None),
            ("oskemen-local-history-museum-2024.jpg", None),
            ("oskemen-art-museum-menovshchikov-office-2024.jpg", None),
            ("oskemen-kozhevnikov-shop-gorky-st-2024.jpg", None),
            ("oskemen-250-years-badge-1970.jpg",
             "Значок к 250-летию города с датами «1720–1970»: 1720 год — год основания Усть-Каменогорской крепости. "
             "Фотография 2023 г."),
        ],
    },
    {
        "slug": "exhibition-travellers", "theme": "travellers", "period": "1786–1914",
        "title": {
            "ru": "Алтай, Зайсан и Аблайкит глазами путешественников XVIII — начала XX века",
            "kk": "XVIII ғасыр мен XX ғасыр басындағы саяхатшылар көзімен: Алтай, Зайсан және Абылайкит",
            "en": "Altai, Zaysan and Ablaikit through the eyes of travellers, 18th to early 20th century",
        },
        "intro": {
            "ru": "Гравюры, фотографии, карта и открытка, оставленные исследователями и путешественниками, побывавшими "
                  "в крае: издания П. С. Палласа (1786) и Г. И. Спасского (1818) с видами Аблайкита, снимок "
                  "А. Э. Боярского у Зайсанского поста (1875), маршрутная карта экспедиции О. Финша и А. Брема (1876), "
                  "фотографии и гравюры, связанные с поездкой Джорджа Кеннана на Алтай (1885), снимок С. И. Борисова "
                  "(1911–1914)." + _RU_TAIL,
            "kk": "Өлкеде болған зерттеушілер мен саяхатшылар қалдырған гравюралар, фотосуреттер, карта және ашықхат: "
                  "Абылайкит бейнеленген П. С. Паллас (1786) пен Г. И. Спасский (1818) басылымдары, А. Э. Боярскийдің "
                  "Зайсан бекетінде түсірген суреті (1875), О. Финш пен А. Брем экспедициясының жол картасы (1876), "
                  "Джордж Кеннанның Алтайға сапарына (1885) қатысты фотосуреттер мен гравюралар, С. И. Борисовтың "
                  "фотосуреті (1911–1914)." + _KK_TAIL,
            "en": "Engravings, photographs, a map and a postcard left by explorers and travellers who visited the "
                  "region: the publications of P. S. Pallas (1786) and G. I. Spassky (1818) showing Ablaikit, "
                  "A. E. Boiarskii's photograph of the Zaysan Post (1875), the route map of the expedition of O. Finsch "
                  "and A. Brehm (1876), photographs and engravings connected with George Kennan's journey to the Altai "
                  "(1885), and a photograph by S. I. Borisov (1911–1914)." + _EN_TAIL,
        },
        "cover": "altai-kazakh-eagle-hunter-borisov-1911.jpg",
        "exhibits": [
            ("ablaikit-pallas-1786.jpg", None),
            ("ablaikit-spassky-1818.jpg", None),
            ("zaysan-post-1875.jpg", None),
            ("map-zaysan-altai-stanitsa-finsch-1876.jpg", None),
            ("altai-mountains-near-altai-station-1885.jpg",
             "Фотоотпечаток 1885 г. из бумаг Джорджа Кеннана в Библиотеке Конгресса США: горы близ Алтайской станицы "
             "(ныне село Катон-Карагай). Фотограф на Викискладе не указан."),
            ("altai-station-kennan-1891.jpg", None),
            ("bukhtarma-valley-rapids-1885.jpg", None),
            ("white-berel-valley-descent-kennan-1891.jpg", None),
            ("rakhmanov-springs-postcard-1900s.jpg", None),
            ("altai-kazakh-eagle-hunter-borisov-1911.jpg", None),
        ],
    },
    {
        "slug": "exhibition-semipalatinsk-maps", "theme": "maps", "period": "1876–1903",
        "title": {
            "ru": "Семипалатинская область на старых картах",
            "kk": "Семей облысы ескі карталарда",
            "en": "Semipalatinsk Oblast on old maps",
        },
        "intro": {
            "ru": "В конце XIX века Усть-Каменогорский и Зайсанский уезды входили в Семипалатинскую область Российской "
                  "империи. На выставке — четыре карты 1876–1903 годов, герб области и виды мест, отмеченных на этих "
                  "картах: долина верхнего Иртыша, окрестности Зайсанского поста и Алтайской станицы." + _RU_TAIL,
            "kk": "XIX ғасырдың соңында Өскемен және Зайсан уездері Ресей империясының Семей облысына қарады. Көрмеде "
                  "1876–1903 жылдардағы төрт карта, облыс елтаңбасы және сол карталарда белгіленген жерлердің "
                  "көріністері ұсынылған: жоғарғы Ертіс аңғары, Зайсан бекеті мен Алтай станицасының маңы." + _KK_TAIL,
            "en": "In the late 19th century the Ust-Kamenogorsk and Zaysan districts (uezds) were part of Semipalatinsk "
                  "Oblast of the Russian Empire. The exhibition shows four maps of 1876–1903, the coat of arms of the "
                  "oblast and views of places marked on those maps: the upper Irtysh valley and the surroundings of "
                  "the Zaysan Post and of Altai Station." + _EN_TAIL,
        },
        "cover": "map-semipalatinsk-oblast-marks-atlas.jpg",
        "exhibits": [
            ("coat-of-arms-semipalatinsk-winkler-1878.jpg", None),
            ("map-semipalatinsk-volosts-1893.png", None),
            ("map-semipalatinsk-oblast-marks-atlas.jpg", None),
            ("map-route-semipalatinsk-altai-kennan-1891.jpg", None),
            ("upper-irtysh-valley-kennan-1891.jpg", None),
            ("map-zaysan-altai-stanitsa-finsch-1876.jpg", None),
            ("zhemini-gorge-zaysan-1875.jpg", None),
            ("altai-view-near-altai-station-1885.jpg", None),
        ],
    },
    {
        "slug": "exhibition-industry", "theme": "industry", "period": "2013–2024",
        "title": {
            "ru": "Промышленный и современный Восточный Казахстан",
            "kk": "Өнеркәсіпті және қазіргі Шығыс Қазақстан",
            "en": "Industrial and present-day East Kazakhstan",
        },
        "intro": {
            "ru": "Современные фотографии 2013–2024 годов: гидроэлектростанция и водохранилище на Иртыше, "
                  "металлургические предприятия Усть-Каменогорска, город Риддер, панорамы областного центра. Это не "
                  "архивные документы, а снимки наших дней, опубликованные их авторами под свободными лицензиями."
                  + _RU_TAIL,
            "kk": "2013–2024 жылдардағы қазіргі фотосуреттер: Ертістегі су электр станциясы мен су қоймасы, Өскеменнің "
                  "металлургия кәсіпорындары, Риддер қаласы, облыс орталығының панорамалары. Бұл архив құжаттары "
                  "емес, авторлары еркін лицензиямен жариялаған бүгінгі күннің суреттері." + _KK_TAIL,
            "en": "Present-day photographs of 2013–2024: the hydroelectric power station and the reservoir on the "
                  "Irtysh, the metallurgical plants of Ust-Kamenogorsk, the city of Ridder, panoramas of the regional "
                  "centre. These are not archival documents but photographs of our time, published by their authors "
                  "under free licences." + _EN_TAIL,
        },
        "exhibits": [
            ("oskemen-hydro-station-2017.jpg", None),
            ("bukhtarma-reservoir-panorama-2013.jpg", None),
            ("oskemen-metallurgical-complex-2016.jpg", None),
            ("ulba-metallurgical-plant-leu-bank-2019.jpg", None),
            ("oskemen-metallurgists-palace-of-culture-2024.jpg", None),
            ("ridder-sunset-aerial-2019.jpg",
             "Город Риддер на закате, снимок с воздуха, май 2019 г. В 1941–2002 годах город назывался Лениногорск."),
            ("ridder-view-from-kruglaya-sopka-2022.jpg", None),
            ("oskemen-city-panorama-2019.jpg", None),
            ("oskemen-irtysh-embankment-2024.jpg", None),
            ("ulba-valley-aerial-2019.jpg", None),
        ],
    },
]  # fmt: skip

_OPEN = " Материалы взяты из открытых источников (Wikimedia Commons) и в фонды Государственного архива ВКО не входят."

# «Архив памяти»: (slug, theme, period, title, description, [(file, editorial note or None)]).
# Themes follow the ТЗ directions: region, settlements (key "ust-kamenogorsk"), industry, people,
# education and science (key "education"), culture, war, periods. Military history, family history
# and public organisations have no honest material in the selection and stay empty.
COLLECTIONS = [
    ("collection-region-history", "region", "до 1917 года", "История края: Аблайкит, Берель, Зайсанский пост",
     "Памятники и места, с которыми связана ранняя история края: буддийский монастырь Аблайкит на гравюрах 1786 и "
     "1818 годов и на снимке раскопок 2018 года, Берельские курганы, Зайсанский пост в 1875 году, герб и карты "
     "Семипалатинской области." + _OPEN,
     [("ablaikit-pallas-1786.jpg", None), ("ablaikit-spassky-1818.jpg", None), ("ablaikit-excavation-2018.jpg", None),
      ("berel-kurgans-2018.jpg", None), ("zaysan-post-1875.jpg", None),
      ("coat-of-arms-semipalatinsk-winkler-1878.jpg", None), ("map-semipalatinsk-volosts-1893.png", None),
      ("map-semipalatinsk-oblast-marks-atlas.jpg", None)]),
    ("collection-ust-kamenogorsk", "ust-kamenogorsk", "1875–2022", "Усть-Каменогорск и другие населённые пункты края",
     "Усть-Каменогорск на гравюре 1891 года и дореволюционных открытках, значок к 250-летию города и современная "
     "панорама; другие населённые пункты — Алтайская станица (ныне Катон-Карагай), Зайсанский пост, Риддер, село "
     "Урунхайка на озере Маркаколь." + _OPEN,
     [("oskemen-town-view-kennan-1891.jpg", None), ("oskemen-view-from-cathedral-postcard.jpg", None),
      ("oskemen-view-from-fire-station-postcard.jpg", None), ("oskemen-250-years-badge-1970.jpg", None),
      ("oskemen-city-panorama-2019.jpg", None), ("altai-station-kennan-1891.jpg", None),
      ("katon-karagay-bukhtarma-valley-2019.jpg", None), ("zaysan-post-1875.jpg", None),
      ("ridder-view-from-kruglaya-sopka-2022.jpg", None), ("markakol-urunkhaika-aerial-2019.jpg", None)]),
    ("collection-industry", "industry", "2013–2024", "Промышленность и энергетика: современные фотографии",
     "Усть-Каменогорская ГЭС, Бухтарминское водохранилище, металлургические предприятия Усть-Каменогорска и город "
     "Риддер на фотографиях 2013–2024 годов. Исторических документов о предприятиях в подборке нет: это современные "
     "снимки." + _OPEN,
     [("oskemen-hydro-station-2017.jpg", None), ("bukhtarma-reservoir-panorama-2013.jpg", None),
      ("oskemen-metallurgical-complex-2016.jpg", None), ("ulba-metallurgical-plant-leu-bank-2019.jpg", None),
      ("ridder-sunset-aerial-2019.jpg", None), ("oskemen-metallurgists-palace-of-culture-2024.jpg", None)]),
    ("collection-people", "people", "1885–1918", "Личности, связанные с краем: портреты",
     "Портреты трёх людей, чьи биографии связаны с Усть-Каменогорском и Алтаем: путешественника Джорджа Кеннана, "
     "писателя Павла Бажова и генерала Лавра Корнилова. Краткие справки о них — в разделе «Исторические личности»; "
     "сведения, не подтверждённые документами, там оговорены." + _OPEN,
     [("george-kennan-portrait-1885.jpg", None), ("bazhov-pavel-portrait-1911.jpg", None),
      ("kornilov-lavr-portrait.jpg", "Место рождения Л. Г. Корнилова в литературе указывается по-разному и документами "
                                     "архива на сайте не подтверждено.")]),
    ("collection-expeditions", "education", "1786–2018", "Наука и изучение края: экспедиции и раскопки",
     "Как изучали край: издание академика П. С. Палласа с изображением Аблайкита, публикация Г. И. Спасского о его "
     "развалинах, учёно-торговая экспедиция Ю. А. Сосновского (1874–1875), западносибирская экспедиция О. Финша и "
     "А. Брема (1876), археологические раскопки 2018 года. Материалов по истории школ и образования в подборке нет."
     + _OPEN,
     [("ablaikit-pallas-1786.jpg", None), ("ablaikit-spassky-1818.jpg", None), ("zhemini-gorge-zaysan-1875.jpg", None),
      ("map-zaysan-altai-stanitsa-finsch-1876.jpg", None), ("ablaikit-excavation-2018.jpg", None)]),
    ("collection-culture", "culture", "1911–2024", "Культура и искусство: театр, музеи, памятники архитектуры",
     "Здания, в которых сегодня работают театр и музеи Усть-Каменогорска, — бывшие Народный дом, полицейская управа "
     "и контора золотопромышленника, — Дворец культуры металлургов, купеческие постройки старого города и снимок "
     "казаха с беркутом работы С. И. Борисова (1911–1914)." + _OPEN,
     [("oskemen-narodny-dom-drama-theatre-2024.jpg", None), ("oskemen-local-history-museum-2024.jpg", None),
      ("oskemen-art-museum-menovshchikov-office-2024.jpg", None), ("oskemen-ethnographic-museum-shop-2024.jpg", None),
      ("oskemen-metallurgists-palace-of-culture-2024.jpg", None), ("oskemen-kozhevnikov-shop-gorky-st-2024.jpg", None),
      ("oskemen-merchant-warehouse-gorky-st-2024.jpg", None), ("altai-kazakh-eagle-hunter-borisov-1911.jpg", None)]),
    ("collection-war-1942", "war", "1942", "Годы Великой Отечественной войны: две фотографии 1942 года",
     "Две фотографии ТАСС 1942 года, находящиеся в общественном достоянии. Обе сняты не на территории нынешней "
     "Восточно-Казахстанской области: одна — на фронте под Старой Руссой, другая — в Урджарском районе тогдашней "
     "Семипалатинской области (ныне область Абай). Документов военных лет из фондов архива здесь нет: подборка "
     "показывает, как такие материалы могут быть представлены в разделе." + _OPEN,
     [("wwii-kazakh-soldiers-letter-1942.jpg", "Снято на фронте, в районе Старой Руссы; к территории области снимок "
                                               "не относится."),
      ("wwii-sowing-defence-hectares-urdzhar-1942.jpg", "Урджарский район в 1942 г. входил в Семипалатинскую область; "
                                                        "сейчас это область Абай.")]),
    ("collection-then-and-now", "periods", "1786–2019", "Край в разные эпохи: тогда и сейчас",
     "Одни и те же места на изображениях разных эпох: Аблайкит на гравюрах 1786 и 1818 годов и на раскопках 2018 года, "
     "Усть-Каменогорск на гравюре 1891 года, дореволюционной открытке и панораме 2019 года, Алтайская станица и долина "
     "Бухтармы в 1885–1891 годах и в 2019 году." + _OPEN,
     [("ablaikit-pallas-1786.jpg", None), ("ablaikit-spassky-1818.jpg", None), ("ablaikit-excavation-2018.jpg", None),
      ("oskemen-town-view-kennan-1891.jpg", None), ("oskemen-view-from-cathedral-postcard.jpg", None),
      ("oskemen-city-panorama-2019.jpg", None), ("altai-station-kennan-1891.jpg", None),
      ("bukhtarma-valley-rapids-1885.jpg", None), ("katon-karagay-bukhtarma-valley-2019.jpg", None)]),
]  # fmt: skip

_EDITORIAL = (
    "Справка составлена по общедоступным биографическим сведениям"
)
_WIKI = "https://ru.wikipedia.org/wiki/"

# Persons with a portrait in the selection: (slug, name, birth, death, portrait file, bio, extra sources).
# The link with the region is stated as carefully as the sources allow.
PERSONS = [
    ("person-kennan", "Кеннан Джордж", 1845, 1924, "george-kennan-portrait-1885.jpg",
     "Американский журналист и путешественник. В 1885–1886 годах проехал через Сибирь; в 1885 году его путь лежал из "
     "Семипалатинска через Усть-Каменогорск к Алтайской станице (ныне село Катон-Карагай) и в долины Бухтармы и "
     "Берели. Виды этих мест вошли в его книгу «Siberia and the Exile System» (Нью-Йорк, 1891).",
     [{"title": "Kennan G. Siberia and the Exile System. Vol. 1. New York: The Century Co., 1891"},
      {"title": "Википедия (англ.), статья «George Kennan (explorer)», просмотрено 12.11.2026",
       "url": "https://en.wikipedia.org/wiki/George_Kennan_(explorer)"}]),
    ("person-kornilov", "Корнилов Лавр Георгиевич", 1870, 1918, "kornilov-lavr-portrait.jpg",
     "Русский военачальник, генерал от инфантерии; в июле — августе 1917 года Верховный главнокомандующий русской "
     "армией, затем один из организаторов и первый командующий Добровольческой армии. Погиб 13 апреля 1918 года под "
     "Екатеринодаром. Местом рождения обычно называют Усть-Каменогорск, однако в части изданий указана Каркаралинская "
     "станица (Каркаралинск), куда семья переехала в его раннем детстве: сведение о месте рождения документами архива "
     "на сайте не подтверждено и требует проверки по метрическим записям.",
     [{"title": "Википедия, статья «Корнилов, Лавр Георгиевич», просмотрено 12.11.2026",
       "url": _WIKI + "Корнилов,_Лавр_Георгиевич"}]),
    ("person-bazhov", "Бажов Павел Петрович", 1879, 1950, "bazhov-pavel-portrait-1911.jpg",
     "Русский писатель, автор сборника уральских сказов «Малахитовая шкатулка». По опубликованным биографиям, "
     "в 1919–1921 годах жил в Усть-Каменогорске: заведовал отделом народного образования ревкома и редактировал "
     "местную газету; осенью 1921 года переехал в Семипалатинск, а в конце того же года вернулся на Урал. Сведения "
     "об усть-каменогорском периоде приведены по литературе и документами архива на сайте не подтверждены.",
     [{"title": "Википедия, статья «Бажов, Павел Петрович», просмотрено 12.11.2026",
       "url": _WIKI + "Бажов,_Павел_Петрович"}]),
]  # fmt: skip
PERSON_NOTE = {"title": _EDITORIAL}

# Historical map: (slug, title, kind, place, lat, lng, description, [files], Wikipedia article of the coordinates).
# Coordinates are those of the Russian Wikipedia article (read 2026-11-12), at the precision of a
# settlement or a landmark; events have no "verified" flag, the map shows every point as approximate.
MAP_OBJECTS = [
    ("map-ablaikit", "Аблайкит", "heritage", "Уланский район, Восточно-Казахстанская область", "49.456591", "82.570843",
     "Развалины буддийского монастыря-крепости XVII века. Его изображения опубликованы в трудах П. С. Палласа (1786) "
     "и Г. И. Спасского (1818); на снимке 2018 года — раскопки памятника.",
     ["ablaikit-pallas-1786.jpg", "ablaikit-spassky-1818.jpg", "ablaikit-excavation-2018.jpg"], "Аблайкит"),
    ("map-berel", "Берельские курганы", "heritage", "Катон-Карагайский район, Восточно-Казахстанская область",
     "49.340022", "86.374736", "Курганный могильник раннего железного века в долине Бухтармы, у села Берель.",
     ["berel-kurgans-2018.jpg"], "Берельские_курганы"),
    ("map-zaysan-post", "Зайсанский пост (ныне город Зайсан)", "events", "г. Зайсан", "47.466670", "84.866670",
     "Военный пост, выросший в город Зайсан. В 1875 году пост и ущелье Жемини в его окрестностях снял А. Э. Боярский, "
     "фотограф экспедиции Ю. А. Сосновского; путь от Зайсана к Алтайской станице показан на маршрутной карте "
     "экспедиции О. Финша и А. Брема (1876).",
     ["zaysan-post-1875.jpg", "zhemini-gorge-zaysan-1875.jpg", "map-zaysan-altai-stanitsa-finsch-1876.jpg"],
     "Зайсан_(город)"),
    ("map-altai-stanitsa", "Алтайская станица (ныне село Катон-Карагай)", "events", "с. Катон-Карагай",
     "49.176670", "85.601390",
     "Казачья станица, ныне село Катон-Карагай. Сюда ведёт маршрут на карте экспедиции О. Финша и А. Брема (1876); "
     "в 1885 году в станице побывал Джордж Кеннан — сохранились гравюра из его книги и фотографии окрестностей.",
     ["altai-station-kennan-1891.jpg", "altai-mountains-near-altai-station-1885.jpg",
      "altai-view-near-altai-station-1885.jpg", "map-zaysan-altai-stanitsa-finsch-1876.jpg",
      "katon-karagay-bukhtarma-valley-2019.jpg"], "Катон-Карагай"),
    ("map-rakhmanov-springs", "Рахмановские ключи", "heritage", "Катон-Карагайский район, Восточно-Казахстанская область",
     "49.534440", "86.507500",
     "Термальные источники в горах Алтая. На открытке начала XX века (издание книжного магазина В. М. Посохина) "
     "подписаны как «Рахмановские ключи на р. Арасан».",
     ["rakhmanov-springs-postcard-1900s.jpg"], "Рахмановские_Ключи"),
    ("map-markakol", "Озеро Маркаколь", "heritage", "Восточно-Казахстанская область", "48.750000", "85.750000",
     "Горное озеро на юге Алтая. Показано на маршрутной карте экспедиции О. Финша и А. Брема (1876); на снимке "
     "2019 года — озеро и село Урунхайка.",
     ["markakol-urunkhaika-aerial-2019.jpg", "map-zaysan-altai-stanitsa-finsch-1876.jpg"], "Маркаколь"),
    ("map-kiin-kerish", "Урочище Киин-Кериш", "heritage", "Восточно-Казахстанская область", "48.133600", "84.493600",
     "Урочище с обнажениями цветных глин близ озера Зайсан.", ["kiin-kerish-2024.jpg"], "Киин-Кериш"),
    ("map-old-town", "Усть-Каменогорск: старый город", "building", "г. Усть-Каменогорск", "49.950000", "82.616667",
     "В городе сохранились здания бывших Народного дома, Городской полицейской управы и конторы золотопромышленника "
     "А. С. Меновщикова — сейчас в них театр и музеи. Точка поставлена в центре города, а не у конкретного здания.",
     ["oskemen-view-from-cathedral-postcard.jpg", "oskemen-view-from-fire-station-postcard.jpg",
      "oskemen-narodny-dom-drama-theatre-2024.jpg", "oskemen-local-history-museum-2024.jpg",
      "oskemen-art-museum-menovshchikov-office-2024.jpg"], "Усть-Каменогорск"),
    ("map-hydro-station", "Усть-Каменогорская ГЭС", "enterprise", "г. Усть-Каменогорск", "49.901167", "82.718722",
     "Гидроэлектростанция на Иртыше выше Усть-Каменогорска; первые агрегаты пущены в начале 1950-х годов.",
     ["oskemen-hydro-station-2017.jpg"], "Усть-Каменогорская_ГЭС"),
    ("map-bukhtarma", "Бухтарминская ГЭС и водохранилище", "enterprise", "Восточно-Казахстанская область",
     "49.658944", "83.346417",
     "Плотина Бухтарминской ГЭС на Иртыше образовала Бухтарминское водохранилище. Точка поставлена у плотины; "
     "место съёмки панорамы 2013 года на Викискладе не уточнено.",
     ["bukhtarma-reservoir-panorama-2013.jpg"], "Бухтарминская_ГЭС"),
    ("map-ulba-plant", "Ульбинский металлургический завод", "enterprise", "г. Усть-Каменогорск", "49.990000", "82.625000",
     "Предприятие НАК «Казатомпром» в Усть-Каменогорске; на его площадке размещён Банк низкообогащённого урана МАГАТЭ "
     "(снимок 2019 года).",
     ["ulba-metallurgical-plant-leu-bank-2019.jpg"], "Ульбинский_металлургический_завод"),
    ("map-ridder", "Риддер (в 1941–2002 годах — Лениногорск)", "enterprise", "г. Риддер", "50.339170", "83.505830",
     "Город в Рудном Алтае, выросший при руднике, который в 1786 году открыл Филипп Риддер.",
     ["ridder-sunset-aerial-2019.jpg", "ridder-view-from-kruglaya-sopka-2022.jpg"], "Риддер"),
]  # fmt: skip
MAP_WIKI = _WIKI
