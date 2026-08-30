import importlib

import pytest

from bigdata import paths


@pytest.fixture
def custom_base(monkeypatch):
    monkeypatch.setenv("YT_BASE_PATH", "//home/fork/wikipulse/")
    yield importlib.reload(paths)
    monkeypatch.undo()
    importlib.reload(paths)


def test_default_base_matches_contract(monkeypatch):
    monkeypatch.delenv("YT_BASE_PATH", raising=False)
    reloaded = importlib.reload(paths)

    assert reloaded.BASE == "//home/wikipulse"
    monkeypatch.undo()
    importlib.reload(paths)


def test_every_table_follows_the_base(custom_base):
    assert custom_base.BASE == "//home/fork/wikipulse"
    assert custom_base.Q_RAW == "//home/fork/wikipulse/q_raw"
    assert custom_base.DICT_COORDS == "//home/fork/wikipulse/dict/coords"
    assert custom_base.T_HISTORY == "//home/fork/wikipulse/history/t_history"
    assert custom_base.MARTS_TOP_GEO == "//home/fork/wikipulse/marts/top_geo"


def test_spark_url_keeps_three_slashes(custom_base):
    assert custom_base.spark_url(custom_base.LIB_H3_ZIP) == \
        "yt:///home/fork/wikipulse/lib/h3.zip"
