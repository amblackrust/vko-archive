import uuid

from app.models import MemorialDate
from app.models.enums import WorkflowStatus
from tests.admin.conftest import Factory, api, factory, roles_ready  # noqa: F401  (fixtures)


def _memorial(factory: Factory, year: int, month: int, day: int, status=WorkflowStatus.PUBLISHED) -> MemorialDate:
    return factory.add(MemorialDate(
        slug=f"t-{uuid.uuid4().hex[:8]}", year=year, month=month, day=day,
        text={"ru": f"ДЕМО дата {year}-{month}-{day}"}, workflow_status=status,
    ))


def test_memorial_dates_by_year_and_month(api, factory):
    _memorial(factory, 2024, 3, 5)
    _memorial(factory, 2024, 1, 9)
    _memorial(factory, 2024, 3, 1, status=WorkflowStatus.DRAFT)
    _memorial(factory, 2023, 3, 2)

    year = api.get("/api/home/memorial-dates", params={"year": 2024}).json()
    assert year["year"] == 2024 and year["month"] is None
    assert [(i["month"], i["day"]) for i in year["items"] if i["text"].startswith("ДЕМО дата 2024")] == [(1, 9), (3, 5)]

    march = api.get("/api/home/memorial-dates", params={"year": 2024, "month": 3}).json()
    assert [i["day"] for i in march["items"]] == [5]
    assert not any(i["is_today"] for i in march["items"])
