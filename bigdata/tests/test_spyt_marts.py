"""
Юнит-тесты чистых функций расчёта витрин. Без Spark и YTsaurus —
spyt_marts импортируется локально благодаря ленивым pyspark-импортам.
"""
from bigdata.jobs.spyt_marts import with_ranks


def test_orders_by_edits_count_and_cuts_to_top_n():
    rows = [
        {"title": "B", "url": "u-b", "edits_count": 5},
        {"title": "A", "url": "u-a", "edits_count": 9},
        {"title": "C", "url": "u-c", "edits_count": 7},
        {"title": "D", "url": "u-d", "edits_count": 1},
    ]
    out = with_ranks(rows, top_n=2, period="24h")

    assert [r["title"] for r in out] == ["A", "C"]
    assert out[0]["rank"] == 1
    assert out[1]["rank"] == 2
    assert all(r["period"] == "24h" for r in out)


def test_tiebreak_is_alphabetical_and_stable():
    rows = [
        {"title": "Б", "url": "u-2", "edits_count": 5},
        {"title": "A", "url": "u-1", "edits_count": 5},
    ]
    out = with_ranks(rows, top_n=10, period="24h")

    assert [r["title"] for r in out] == ["A", "Б"]


def test_geo_rows_use_top_title_for_tiebreak():
    rows = [
        {"h3_parent": "84aaa", "top_title": "Москва", "edits_count": 3},
        {"h3_parent": "85bbb", "top_title": "Париж", "edits_count": 10},
    ]
    out = with_ranks(rows, top_n=1, period="24h")

    assert len(out) == 1
    assert out[0]["h3_parent"] == "85bbb"
    assert out[0]["rank"] == 1


def test_does_not_mutate_input_rows():
    rows = [{"title": "A", "url": "u", "edits_count": 1}]
    with_ranks(rows, top_n=5, period="24h")

    assert rows == [{"title": "A", "url": "u", "edits_count": 1}]


def test_empty_input_gives_empty_output():
    assert with_ranks([], top_n=5, period="24h") == []
