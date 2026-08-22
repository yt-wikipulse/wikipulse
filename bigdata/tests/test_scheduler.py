"""
Юнит-тесты шедулера: сборка spark-submit и расписание тяжёлых окон.
Без Spark и YTsaurus — проверяются только чистые функции.
"""
import os

from bigdata.jobs.scheduler import (
    build_spark_submit,
    resolve_spark_env,
    windows_due,
)


def test_spark_submit_contains_mandatory_confs():
    cmd = build_spark_submit(24, "secret-token")

    assert cmd[0] == "spark-submit"
    assert cmd[cmd.index("--deploy-mode") + 1] == "cluster"
    for conf in (
        "spark.hadoop.yt.proxy.role=http",
        "spark.yarn.appMasterEnv.YT_TOKEN=secret-token",
        "spark.yarn.appMasterEnv.YT_PROXY=your-cluster.example.com",
        "spark.pyspark.python=/usr/bin/python3.11",
        "spark.shuffle.useOldFetchProtocol=true",
    ):
        assert conf in cmd
    assert "yt:///home/wikipulse/src/spyt_marts.py" in cmd


def test_spark_submit_passes_hours():
    cmd = build_spark_submit(168, "t")

    assert cmd[cmd.index("--hours") + 1] == "168"


def test_optional_flags_added_only_when_given():
    base = build_spark_submit(24, "t")
    assert "--top-n" not in base
    assert "--h3-res" not in base

    full = build_spark_submit(24, "t", top_n=50, h3_res=5)
    assert full[full.index("--top-n") + 1] == "50"
    assert full[full.index("--h3-res") + 1] == "5"


def test_windows_due_only_after_interval():
    assert windows_due(100.0, 100.0 + 3599, 3600) is False
    assert windows_due(100.0, 100.0 + 3600, 3600) is True


def test_first_cycle_includes_slow_windows():
    # last_slow = 0.0 при старте — тяжёлые окна уходят в первый же цикл
    assert windows_due(0.0, 1_700_000_000.0, 3600) is True


def test_resolve_spark_env_puts_spark_bin_first(tmp_path, monkeypatch):
    fake = tmp_path / "spark-submit"
    fake.write_text("#!/bin/sh\n")
    fake.chmod(0o755)
    monkeypatch.setenv("PATH", f"/some/venv/bin:{tmp_path}:/usr/bin")

    env = resolve_spark_env()

    assert env["PATH"].split(os.pathsep)[0] == str(tmp_path)
    assert "/some/venv/bin" in env["PATH"]


def test_resolve_spark_env_without_spark_submit_keeps_path(monkeypatch):
    monkeypatch.setenv("PATH", "/usr/bin:/bin")

    env = resolve_spark_env()

    assert env["PATH"] == "/usr/bin:/bin"
