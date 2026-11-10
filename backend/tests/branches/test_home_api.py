from tests.admin.conftest import api, roles_ready  # noqa: F401  (fixtures)


def test_memorial_dates_current_month(api):
    data = api.get("/api/home/memorial-dates").json()
    assert 1 <= data["month"] <= 12
    assert all(item["month"] == data["month"] and item["text"] for item in data["items"])
    todays = [i["is_today"] for i in data["items"]]
    assert todays == sorted(todays, reverse=True)


def test_memorial_dates_bad_lang(api):
    assert api.get("/api/home/memorial-dates", params={"lang": "xx"}).status_code == 422
