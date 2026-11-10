"""T2.2: approximate branch coordinates (centre of the settlement), keyed by the number in
'Адреса и контакты филиалов.xls'. They are NOT surveyed: every branch is seeded with
coords_verified=False and the UI shows «координаты приблизительные, уточняются».
Source of the values: general geographic knowledge, not info/. To be verified by the customer."""

from decimal import Decimal

# no: (slug, short name ru, branch type, lat, lng)
BRANCH_COORDS: dict[int, tuple[str, str, str, str, str]] = {
    1: ("altai", "Алтай", "district", "49.7167", "84.2667"),  # г. Алтай (бывш. Зыряновск)
    2: ("glubokoe", "Глубоковский", "district", "50.1450", "82.3150"),  # п. Глубокое
    3: ("zaisan", "Зайсанский", "district", "47.4667", "84.8767"),  # г. Зайсан
    4: ("katon-karagai", "Катон-Карагайский", "district", "49.1700", "85.6000"),  # с. Катон-Карагай
    5: ("kurchum", "Курчумский", "district", "48.5700", "83.6500"),  # с. Курчум
    6: ("markakol", "Маркаколь", "district", "48.7500", "85.7700"),  # с. Маркаколь
    7: ("ridder", "Риддер", "city", "50.3450", "83.5100"),  # г. Риддер
    8: ("samar", "Самар", "district", "49.1900", "83.3700"),  # с. Самар
    9: ("tarbagatai", "Тарбагатайский", "district", "47.9700", "83.2800"),  # с. Акжар
    10: ("ulan", "Уланский", "district", "49.7000", "82.3000"),  # п. Касыма Кайсенова
    11: ("ulken-naryn", "Үлкен-Нарын", "district", "49.2000", "84.3300"),  # с. Улкен Нарын
    12: ("ust-kamenogorsk-personnel", "Усть-Каменогорск (по личному составу)", "personnel", "49.9617", "82.6061"),
    13: ("shemonaikha", "Шемонаихинский", "district", "50.6300", "81.9000"),  # г. Шемонаиха
}

HEAD_COORDS = (Decimal("49.9487"), Decimal("82.6283"))  # г. Усть-Каменогорск, ул. Бейбітшілік 26/1
