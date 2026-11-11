"""Real fund lists: converter rules, seed (no secret funds anywhere), fund list search and
filters, newspapers. The converter is tested on inline rows, not on the source files."""

import json
import re
from datetime import date

import pytest
from sqlalchemy import select

from app.config import get_settings
from app.models import Fund, Newspaper
from app.models.enums import FundType, WorkflowStatus
from app.schemas.catalog import FundListParams
from app.schemas.search import SearchFilters
from app.services import catalog as catalog_service
from app.services import indexing, search
from seed.common import Report
from seed.info_content import seed_branches
from seed.real_funds import DATA_DIR, seed_real_funds
from seed.tools.convert_real_funds import FUNDS_COLUMNS, PARTY_COLUMNS, build_funds, build_newspapers, split_number
from tests.catalog.conftest import get, token

# Fully secret funds of the source list (the list itself shows these numbers as «секретный фонд»).
SECRET_NUMBERS = {"Р-65", "Р-75", "Р-207", "Р-343", "Р-563", "Р-1566"}


def _row(columns, no, number, dates, name, **cells):
    """A sheet row: `columns` is the converter's column layout of the file."""
    keys = ("no", "received", "number", "category", "ownership", "dates", "name", "units", "start", "end", "card")
    values = {"ownership": "государственная", **cells, "no": no, "number": number, "dates": dates, "name": name}
    row = [None] * 16
    for index, key in zip(columns, keys, strict=True):
        row[index] = values.get(key)
    return row


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Р-1", ("Р-1", None)), ("Р -1", ("Р-1", None)), ("Р1", ("Р-1", None)), ("489", ("Р-489", None)),
        ("Р -41 ч.с.", ("Р-41", "partial")), ("Р--1447 ч.с.", ("Р-1447", "partial")), ("Р-12ч/с", ("Р-12", "partial")),
        ("Р-12 с.ч.", ("Р-12", "partial")), ("Р-12 ч. с.", ("Р-12", "partial")), ("Р-12ч.с..", ("Р-12", "partial")),
        ("Р-65с", ("Р-65", "secret")), ("Р-599 с", ("Р-599", "secret")), ("Р-7 дсп", ("Р-7", "secret")),
        ("2П", ("2П", None)), ("1П/ч.с", ("1П", "partial")),
    ],
)  # fmt: skip
def test_fund_number_and_secrecy_mark(raw, expected):
    assert split_number(raw) == expected


def test_converter_groups_names_and_never_writes_secret_funds():
    rows = [
        _row(FUNDS_COLUMNS, 1.0, "Р-1 ч.с.", "[03]1926-19.02.1932", "Городской  Совет\nрабочих депутатов",
             received=15274.0, category="1", units="3618/34с", start="1926", end="1993", card=41415.0),
        _row(FUNDS_COLUMNS, 2.0, "Р -1", "20.02.1932-", "Городской Совет народных депутатов", category=1.0, ownership="частная"),
        _row(FUNDS_COLUMNS, 3.0, "Р-2", "неизвестно", "Комиссариат просвещения", received="неизв",
             card="Фонд выслан в архив\nКрымской области"),
        _row(FUNDS_COLUMNS, 4.0, None, "1950-1955", "Комиссариат культуры"),  # no number: the same fund
        _row(FUNDS_COLUMNS, 5.0, "Р-65с", None, "секретный фонд"),
        _row(FUNDS_COLUMNS, 6.0, "Р-207", None, "секретный фонд"),
        _row(FUNDS_COLUMNS, 7.0, "Р-727", "1949-1951", "Комитет общества", units="15/8с", category=3.0, start=1968.0, end=1962.0),
        _row(FUNDS_COLUMNS, 8.0, "Р-8", "2004-", "Иванов Иван Иванович - писатель", ownership="частная", received=1948.0),
        [None] * 16,
        _row(FUNDS_COLUMNS, 9.0, "Р-2", "1960", "Другая организация"),
    ]  # fmt: skip
    funds, meta = build_funds(rows, FUNDS_COLUMNS, "organization", {9.0: "Р-9"})
    by_number = {fund["number"]: fund for fund in funds}
    assert list(by_number) == ["Р-1", "Р-2", "Р-727", "Р-8", "Р-9"]
    assert meta == {"funds": 5, "names": 7, "partial": 2, "skipped_restricted": 2,
                    "warnings": ["Р-727: years 1968 > 1962, swapped"]}  # fmt: skip
    assert "Р-2: repeated in row 9.0" in build_funds(rows, FUNDS_COLUMNS, "organization")[1]["warnings"]

    one = by_number["Р-1"]
    assert one["names"] == [
        {"dates": "[03]1926-19.02.1932", "name": "Городской Совет рабочих депутатов"},
        {"dates": "20.02.1932-", "name": "Городской Совет народных депутатов"},
    ]
    assert one["title"] == "Городской Совет народных депутатов" and one["type"] == "organization"
    assert (one["dates_from"], one["dates_to"], one["units_count"], one["category"]) == (1926, 1993, 3618, 1)
    assert (one["restricted"], one["ownership"], one["first_received"]) == ("partial", "private", "1941-10-25")
    two = by_number["Р-2"]
    assert [n["dates"] for n in two["names"]] == [None, "1950-1955"] and two["title"] == "Комиссариат культуры"
    assert (two["dates_from"], two["dates_to"], two["first_received"], two["category"]) == (1950, 1955, None, None)
    assert two["note"] == "Фонд выслан в архив Крымской области"
    # Secret units without a mark on the number still make the fund partially restricted.
    assert (by_number["Р-727"]["restricted"], by_number["Р-727"]["units_count"]) == ("partial", 15)
    assert (by_number["Р-727"]["dates_from"], by_number["Р-727"]["dates_to"]) == (1962, 1968)
    person = by_number["Р-8"]  # open-ended dates; 1948.0 is a year typed as a number, not a date
    assert (person["type"], person["dates_from"], person["dates_to"], person["first_received"]) == ("personal", 2004, None, None)
    dump = json.dumps(funds, ensure_ascii=False)
    assert "секретн" not in dump and "Р-65" not in dump and "Р-207" not in dump
    assert "34с" not in dump and "/8" not in dump  # counts of secret units are never written


def test_converter_party_funds():
    rows = [
        _row(PARTY_COLUMNS, 1.0, "1П/ч.с", "10.1939-10.1952", "Обком КП(б) Казахстана", units="17646/3с 5211 ОД", start="1922", end="1991"),
        _row(PARTY_COLUMNS, 2.0, "1П/ч.с", "1965-1991", "Обком Компартии Казахстана"),
        _row(PARTY_COLUMNS, 3.0, "6П", "1928-1934", "Райком ВКП(б)", units="1250/486 ОД"),
        [None, None, "итого: 2 фонда", *[None] * 13],
    ]  # fmt: skip
    funds, meta = build_funds(rows, PARTY_COLUMNS, "party")
    assert [(f["number"], f["type"], f["units_count"], f["restricted"]) for f in funds] == [
        ("1П", "party", 17646, "partial"), ("6П", "party", 1250, None),
    ]  # fmt: skip
    assert funds[0]["title"] == "Обком Компартии Казахстана" and meta["skipped_restricted"] == 0
    assert "3с" not in json.dumps(funds, ensure_ascii=False)


def test_converter_newspapers():
    rows = [
        ["№\nп/п", "Наименование газет", "Место и орган издания", "Кол-во\nтомов", "Годы", "Примечание"],
        ["1", "2", "3", "4", "5", "6"],
        ["", "«Знамя труда»", "Орган райкома\nс. Катон-Карагай", "1", "1957", ""],
        ["", "«Знамя труда»", "-/-", "1", "1958", "Том 1"],
        ["", "«Знамя труда»", "-/-", "1", "1958", "Том 2"],
        ["", "«Знамя труда»", "Орган совхоза п. Шемонаиха", "1", "02.08.-24.12.\n1958", ""],
        ["", "«Сталинец»", "Орган Самарского райкома", "1", "1942,\n1944-1946", ""],
        ["", "«Машинострои-\nтель»", "", "2", "1984", ""],
    ]
    first, other_publisher, ranges, no_publisher = build_newspapers(rows)
    assert first == {
        "title": "«Знамя труда»", "publisher": "Орган райкома с. Катон-Карагай", "year_from": 1957, "year_to": 1958,
        "volumes_total": 3, "years_covered": [1957, 1958],
        "years": [{"year": 1957, "volumes": 1, "note": None}, {"year": 1958, "volumes": 1, "note": "Том 1"},
                  {"year": 1958, "volumes": 1, "note": "Том 2"}],
    }  # fmt: skip
    assert (other_publisher["title"], other_publisher["publisher"]) == ("«Знамя труда»", "Орган совхоза п. Шемонаиха")
    assert other_publisher["years"] == [{"year": 1958, "volumes": 1, "note": "02.08.-24.12. 1958"}]
    assert ranges["years_covered"] == [1942, 1944, 1945, 1946] and (ranges["year_from"], ranges["year_to"]) == (1942, 1946)
    assert ranges["years"] == [{"year": 1942, "volumes": 1, "note": "1942, 1944-1946"}]
    assert (no_publisher["title"], no_publisher["publisher"], no_publisher["volumes_total"]) == ("«Машиностроитель»", None, 2)


def test_seed_loads_real_funds_and_no_secret_fund_is_anywhere(db_session):
    report = Report()
    seed_branches(db_session, report, False)
    db_session.flush()
    seed_real_funds(db_session, report, False)
    data = [json.loads((DATA_DIR / name).read_text(encoding="utf-8")) for name in ("funds.json", "party_funds.json")]
    expected = sum(d["meta"]["funds"] for d in data)
    real = db_session.scalars(select(Fund).where(Fund.source.is_not(None))).all()
    assert len(real) == report.created["funds"] == expected > 1600
    assert report.created["newspapers"] == db_session.query(Newspaper).count() > 100
    assert all(not f.is_demo and f.workflow_status == WorkflowStatus.PUBLISHED for f in real)
    assert {f.restricted for f in real} == {None, "partial"}
    assert {f.type for f in real} == {FundType.ORGANIZATION, FundType.PERSONAL, FundType.PARTY}
    again = Report()
    seed_real_funds(db_session, again, False)
    assert not again.created and again.existing == {"funds": expected, "newspapers": report.created["newspapers"]}

    # Secret funds are only counted: not in the JSON, not in the database, not in the list.
    assert data[0]["meta"]["skipped_restricted"] == 38
    dump = json.dumps(data, ensure_ascii=False).lower()
    assert "секретный фонд" not in dump and not re.search(r"\d\s*/\s*\d+\s*[сc]\b", dump)
    assert not SECRET_NUMBERS & {f.number for f in real}

    def found(q: str) -> list[str]:
        return [item.number for item in catalog_service.list_funds(db_session, FundListParams(q=q, per_page=100)).items]

    assert found("секретный фонд") == []
    assert not SECRET_NUMBERS & {number for secret in SECRET_NUMBERS for number in found(secret)}

    # Р-103, the Pushkin library: found by number, by its oldest name and with typos.
    pushkin = db_session.scalar(select(Fund).where(Fund.number == "Р-103"))
    assert len(pushkin.former_names) == 11 and pushkin.title == {"ru": pushkin.former_names[-1]["name"]}
    assert pushkin.translation_status == {"kk": "missing", "ru": "verified", "en": "missing"}
    assert found("Р-103")[0] == "Р-103"
    assert found("областная библиотека Пушкина отдела народного образования") == ["Р-103"]
    assert found("библеотека пушкена") == ["Р-103"]

    # The hybrid search index carries the former names and the bare number.
    indexing.reindex_object(db_session, "fund", pushkin)
    for query in ("универсальная научная библиотека", "Р-103"):
        result = search.search(db_session, get_settings(), SearchFilters(q=query, types=["fund"], log=False))
        assert [item.id for group in result.groups for item in group.items] == [pushkin.id]


def test_fund_list_former_names_filters_and_sorting(api, factory):
    word, old_word, tag = token(), token(), token()[4:]
    branch = factory.branch()
    names = [{"dates": "1952-1972", "name": f"Педагогический институт {old_word}"}, {"dates": "1991-", "name": f"Университет {word}"}]

    def fund(n: int, title: str, **values) -> Fund:
        defaults = {"type": FundType.ORGANIZATION, "workflow_status": WorkflowStatus.PUBLISHED}
        return factory.add(Fund(number=f"{tag}-{n}", title={"ru": f"{title} {word}"}, **{**defaults, **values}))

    university = fund(2, "Университет", former_names=names, dates_from=1952, category=2, units_count=3417,
                      ownership="state", restricted="partial", first_received=date(1961, 6, 4), source="тест",
                      branch_id=branch.id)  # fmt: skip
    fund(10, "Библиотека", dates_from=1939, dates_to=1945, category=1, type=FundType.PARTY)
    fund(1, "Архив", is_demo=True)
    fund(3, f"Черновик {old_word}", workflow_status=WorkflowStatus.DRAFT)

    def numbers(**params) -> list[int]:
        return [int(item["number"].rsplit("-", 1)[1]) for item in get(api, "funds", **params)["items"]]

    # Natural order of numbers (2 before 10), demo funds last; the other sorts.
    assert numbers(q=word) == numbers(q=word, sort="number") == [2, 10, 1]
    assert get(api, "funds", q=word)["sort"] == "relevance" and get(api, "funds")["sort"] == "number"
    assert numbers(q=word, sort="title") == [1, 10, 2]
    assert numbers(q=word, sort="year") == [10, 2, 1]
    assert numbers(q=f"{tag}-1") == [1, 10]  # the number itself comes first

    # By a former name (the draft with the same word stays hidden), also with a typo.
    by_old_name = get(api, "funds", q=f"институт {old_word}")
    assert by_old_name["total"] == 1
    item = by_old_name["items"][0]
    assert item["id"] == str(university.id) and item["former_names"] == names and not item["is_demo"]
    assert (item["units_count"], item["category"], item["ownership"], item["restricted"]) == (3417, 2, "state", "partial")
    assert (item["first_received"], item["source"], item["dates_to"]) == ("1961-06-04", "тест", None)
    assert numbers(q=old_word[:8] + "я" + old_word[9:]) == [2]
    detail = get(api, f"funds/{university.id}")
    assert detail["former_names"] == names and detail["branch"] is None  # the branch is a draft
    branch.workflow_status = WorkflowStatus.PUBLISHED
    factory.session.commit()
    assert get(api, f"funds/{university.id}")["branch"] == {"name": "ДЕМО филиал", "href": f"/branches/{branch.slug}"}

    # Years overlap [dates_from, dates_to]; no dates_to means the fund is still open.
    assert numbers(q=word, year=1960) == [2] and numbers(q=word, year=1940) == [10]
    assert numbers(q=word, year_from=1900, year_to=1950) == [10] and numbers(q=word, year_from=1946) == [2]
    assert numbers(q=word, category=1) == [10] and numbers(q=word, type="party") == [10]
    for bad in ({"category": 4}, {"sort": "x"}, {"year": 99}):
        assert api.get("/api/catalog/funds", params=bad).status_code == 422


def test_newspapers_list(api, factory):
    word, publisher = token(), token()
    years = [{"year": 1957, "volumes": 1, "note": None}, {"year": 1958, "volumes": 2, "note": "Том 1"}]
    first = factory.add(Newspaper(title=f"«{word}»", publisher="Орган райкома", year_from=1957, year_to=1958,
                                  volumes_total=3, years_covered=[1957, 1958], years=years))  # fmt: skip
    second = factory.add(Newspaper(title=f"«{word}»", publisher=f"Орган совхоза {publisher}", year_from=1960, year_to=1960,
                                   volumes_total=1, years_covered=[1960], years=[{"year": 1960, "volumes": 1, "note": None}]))  # fmt: skip

    def ids(**params) -> list[str]:
        return [item["id"] for item in get(api, "newspapers", **params)["items"]]

    body = get(api, "newspapers", q=word)
    assert body["total"] == 2 and ids(q=word) == [str(first.id), str(second.id)]
    assert body["items"][0] == {"id": str(first.id), "title": f"«{word}»", "publisher": "Орган райкома",
                                "year_from": 1957, "year_to": 1958, "volumes_total": 3, "years": years}  # fmt: skip
    assert ids(q=word, year=1958) == [str(first.id)] and ids(q=word, year=1959) == []
    assert ids(q=publisher) == [str(second.id)]
    assert ids(q=word[:8] + "я" + word[9:]) == [str(first.id), str(second.id)]  # a typo
    assert get(api, "newspapers", per_page=1)["total"] >= 2
