"""
Тесты обогащения: ``enrich_partition`` — обычная функция над итератором
строк, поэтому проверяется без Spark и без кластера. Клиент YTsaurus и
``h3`` подменяются заглушками.

``spyt_enrich`` импортируется локально благодаря ленивым pyspark-импортам.
"""
import pytest

from bigdata.jobs import spyt_enrich

DICT = "//test/dict/coords"
QUEUE = "//test/q_enriched"


class FakeClient:
    """Клиент YTsaurus, который отдаёт заранее заданный справочник."""

    def __init__(self, coords):
        self.coords = coords
        self.inserted = []

    def lookup_rows(self, table, keys, **kwargs):
        assert table == DICT
        return [
            {"wiki": k["wiki"], "title": k["title"], **self.coords[(k["wiki"], k["title"])]}
            for k in keys
            if (k["wiki"], k["title"]) in self.coords
        ]

    def insert_rows(self, table, rows, **kwargs):
        assert table == QUEUE
        self.inserted.extend(rows)


class FakeH3:
    """Геокод-заглушка: ячейка собирается из координат, чтобы её было видно."""

    @staticmethod
    def latlng_to_cell(lat, lon, res):
        return f"cell-{lat}-{lon}-{res}"


@pytest.fixture
def client(monkeypatch):
    fake = FakeClient({
        ("ruwiki", "Москва"): {"lat": 55.75, "lon": 37.61},
        ("enwiki", "Paris"): {"lat": 48.85, "lon": 2.35},
    })
    monkeypatch.setattr(spyt_enrich, "yt_client", lambda proxy=None: fake)
    monkeypatch.setattr(spyt_enrich, "worker_h3", lambda: FakeH3)
    return fake


def row(wiki, title):
    return {
        "event_id": f"{wiki}|{title}",
        "wiki": wiki,
        "title": title,
        "url": f"https://{wiki}.example.org/{title}",
        "event_ts": 1_760_000_000,
        "length_update": 42,
        "diff_url": f"https://{wiki}.example.org/diff/{title}",
    }


def run(rows):
    return spyt_enrich.enrich_partition(iter(rows), proxy="https://yt.example",
                                        dict_coords=DICT, q_enriched=QUEUE)


def test_пустая_партиция_ничего_не_пишет(client):
    assert run([]) == [(0, 0)]
    assert client.inserted == []


def test_событие_с_координатами_уезжает_в_очередь(client):
    assert run([row("ruwiki", "Москва")]) == [(1, 1)]

    assert len(client.inserted) == 1
    written = client.inserted[0]
    assert written["event_id"] == "ruwiki|Москва"
    assert written["h3_r9"] == "cell-55.75-37.61-9"
    assert "wiki" not in written


def test_событие_без_координат_отбрасывается(client):
    assert run([row("ruwiki", "Москва"), row("dewiki", "Кот")]) == [(2, 1)]
    assert [r["event_id"] for r in client.inserted] == ["ruwiki|Москва"]


def test_вставка_режется_на_куски(client, monkeypatch):
    monkeypatch.setattr(spyt_enrich, "INSERT_CHUNK", 1)
    calls = []
    original = client.insert_rows
    monkeypatch.setattr(client, "insert_rows",
                        lambda table, rows, **kw: (calls.append(len(rows)),
                                                   original(table, rows, **kw)))

    assert run([row("ruwiki", "Москва"), row("enwiki", "Paris")]) == [(2, 2)]
    assert calls == [1, 1]
