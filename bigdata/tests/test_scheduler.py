import importlib
import os

import pytest

from bigdata import paths
from bigdata.jobs.scheduler import (
    build_spark_submit,
    resolve_spark_env,
    windows_due,
)


@pytest.fixture
def cluster_env(monkeypatch):
    monkeypatch.setenv("YT_PROXY", "https://yt.example.tech/")
    monkeypatch.setenv("YT_BASE_PATH", "//home/wikipulse")
    importlib.reload(paths)
    yield
    monkeypatch.undo()
    importlib.reload(paths)


def test_spark_submit_contains_mandatory_confs(cluster_env):
    cmd = build_spark_submit(24)

    assert cmd[0] == "spark-submit"
    assert cmd[cmd.index("--deploy-mode") + 1] == "cluster"
    assert cmd[cmd.index("--master") + 1] == "ytsaurus://https://yt.example.tech"
    for conf in (
        "spark.hadoop.yt.proxy.role=http",
        "spark.yarn.appMasterEnv.YT_PROXY=yt.example.tech",
        "spark.yarn.appMasterEnv.YT_BASE_PATH=//home/wikipulse",
        "spark.pyspark.python=/usr/bin/python3.11",
        "spark.shuffle.useOldFetchProtocol=true",
    ):
        assert conf in cmd
    assert "yt:///home/wikipulse/src/spyt_marts.py" in cmd
    assert "yt:///home/wikipulse/lib/bigdata.zip" in cmd[cmd.index("--py-files") + 1]


def test_spark_submit_never_carries_the_token(cluster_env, monkeypatch):
    monkeypatch.setenv("YT_TOKEN", "secret-token")
    monkeypatch.setenv("YT_SECURE_VAULT_YT_TOKEN", "secret-token")

    cmd = build_spark_submit(24)

    assert not any("secret-token" in arg for arg in cmd)
    assert not any("YT_TOKEN" in arg for arg in cmd)


def test_spark_submit_passes_hours(cluster_env):
    cmd = build_spark_submit(168)

    assert cmd[cmd.index("--hours") + 1] == "168"


def test_optional_flags_added_only_when_given(cluster_env):
    base = build_spark_submit(24)
    assert "--top-n" not in base
    assert "--h3-res" not in base

    full = build_spark_submit(24, top_n=50, h3_res=5)
    assert full[full.index("--top-n") + 1] == "50"
    assert full[full.index("--h3-res") + 1] == "5"


def test_windows_due_only_after_interval():
    assert windows_due(100.0, 100.0 + 3599, 3600) is False
    assert windows_due(100.0, 100.0 + 3600, 3600) is True


def test_first_cycle_includes_slow_windows():
    assert windows_due(0.0, 1_700_000_000.0, 3600) is True


def test_resolve_spark_env_puts_spark_bin_first(tmp_path, monkeypatch):
    name = "spark-submit.bat" if os.name == "nt" else "spark-submit"
    fake = tmp_path / name
    fake.write_text("#!/bin/sh\n")
    fake.chmod(0o755)
    venv_bin = tmp_path / "venv-bin"
    venv_bin.mkdir()
    monkeypatch.setenv("PATH", os.pathsep.join([str(venv_bin), str(tmp_path)]))

    env = resolve_spark_env()

    assert env["PATH"].split(os.pathsep)[0] == str(tmp_path)
    assert str(venv_bin) in env["PATH"]


def test_resolve_spark_env_without_spark_submit_keeps_path(tmp_path, monkeypatch):
    empty = tmp_path / "empty"
    empty.mkdir()
    monkeypatch.setenv("PATH", str(empty))

    env = resolve_spark_env()

    assert env["PATH"] == str(empty)
