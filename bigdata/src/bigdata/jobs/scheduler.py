#!/usr/bin/env python3
import argparse
import logging
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

from bigdata import paths
from bigdata.runtime import proxy_host, require_env
from bigdata.scripts.upload_artifacts import upload_job_script

SPYT_MARTS_LOCAL = Path(__file__).with_name("spyt_marts.py")
SPYT_DEPS_ZIP = "yt:///home/wikipulse/lib/spyt_deps.zip"

FAST_INTERVAL = 300
SLOW_INTERVAL = 3600
FAST_WINDOW = 24
SLOW_WINDOWS = (168, 720)
STEP_TIMEOUT = 1800

ARCHIVER_CMD = [sys.executable, "-m", "bigdata.jobs.archiver"]


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("scheduler")


def build_spark_submit(hours: int,
                       top_n: int | None = None,
                       h3_res: int | None = None) -> list[str]:
    host = proxy_host()
    py_files = ",".join((SPYT_DEPS_ZIP, paths.spark_url(paths.LIB_BIGDATA_ZIP)))
    cmd = [
        "spark-submit",
        "--master", f"ytsaurus://https://{host}",
        "--deploy-mode", "cluster",
        "--num-executors", "2",
        "--executor-memory", "2g",
        "--executor-cores", "1",
        "--driver-memory", "2g",
        "--conf", "spark.hadoop.yt.proxy.role=http",
        "--conf", f"spark.yarn.appMasterEnv.YT_PROXY={host}",
        "--conf", f"spark.yarn.appMasterEnv.YT_BASE_PATH={paths.BASE}",
        "--conf", "spark.pyspark.python=/usr/bin/python3.11",
        "--conf", "spark.shuffle.useOldFetchProtocol=true",
        "--py-files", py_files,
        "--files", paths.spark_url(paths.LIB_H3_ZIP),
        paths.spark_url(paths.SRC_SPYT_MARTS),
        "--hours", str(hours),
    ]
    if top_n is not None:
        cmd += ["--top-n", str(top_n)]
    if h3_res is not None:
        cmd += ["--h3-res", str(h3_res)]
    return cmd


def resolve_spark_env() -> dict[str, str]:
    env = os.environ.copy()
    spark_submit = shutil.which("spark-submit")
    if spark_submit:
        spark_bin = os.path.dirname(spark_submit)
        env["PATH"] = f"{spark_bin}{os.pathsep}{env.get('PATH', '')}"
    return env


def windows_due(last_slow: float, now: float, slow_interval: int) -> bool:
    return now - last_slow >= slow_interval


def run_step(name: str, cmd: list[str], timeout: int = STEP_TIMEOUT,
             env: dict[str, str] | None = None) -> bool:
    start = time.monotonic()
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True,
                              timeout=timeout, env=env)
    except subprocess.TimeoutExpired:
        log.error("%s: превысил %d сек — убит", name, timeout)
        return False
    duration = time.monotonic() - start
    if proc.returncode != 0:
        tail = "\n".join((proc.stderr or proc.stdout or "").splitlines()[-10:])
        log.error("%s: код %d за %.0f сек. Хвост вывода:\n%s",
                  name, proc.returncode, duration, tail)
        return False
    log.info("%s: ок за %.0f сек", name, duration)
    return True


def run_cycle(state: dict, top_n: int | None, h3_res: int | None,
              spark_env: dict[str, str]):
    try:
        size = upload_job_script(SPYT_MARTS_LOCAL)
        log.info("spyt_marts.py залит в Cypress: %d байт", size)
    except Exception as e:
        log.error("заливка spyt_marts.py не удалась: %s", e)

    run_step("archiver", ARCHIVER_CMD)

    windows = [FAST_WINDOW]
    if windows_due(state["last_slow"], time.time(), state["slow_interval"]):
        windows += list(SLOW_WINDOWS)
        state["last_slow"] = time.time()

    for hours in windows:
        run_step(f"marts {hours}h", build_spark_submit(hours, top_n, h3_res),
                 env=spark_env)

    log.info("цикл завершён: окна %s", ", ".join(f"{h}ч" for h in windows))


def parse_args():
    parser = argparse.ArgumentParser(
        description="Шедулер: archiver + витрины spyt_marts по расписанию"
    )
    parser.add_argument("--once", action="store_true",
                        help="выполнить один цикл и выйти (проверка)")
    parser.add_argument("--interval", type=int, default=FAST_INTERVAL,
                        help="интервал цикла, сек (по умолчанию 300)")
    parser.add_argument("--slow-interval", type=int, default=SLOW_INTERVAL,
                        help="интервал тяжёлых окон, сек (по умолчанию 3600)")
    parser.add_argument("--top-n", type=int, default=None,
                        help="размер топов, передаётся в spyt_marts")
    parser.add_argument("--h3-res", type=int, default=None,
                        help="резолюция H3, передаётся в spyt_marts")
    return parser.parse_args()


def main():
    args = parse_args()
    require_env("YT_PROXY", "YT_TOKEN")
    log.info("Прокси: %s | база: %s", proxy_host(), paths.BASE)

    spark_bin = shutil.which("spark-submit")
    if not spark_bin:
        log.warning("spark-submit не найден в PATH — шаги marts будут падать")
    else:
        log.info("spark-submit: %s", spark_bin)

    spark_env = resolve_spark_env()
    if spark_bin:
        run_step("spark-submit --version", [spark_bin, "--version"],
                 timeout=60, env=spark_env)

    state = {"last_slow": 0.0, "slow_interval": args.slow_interval}

    log.info("Шедулер стартовал: цикл %d сек", args.interval)
    log.info("  каждый цикл:  archiver + marts %dч", FAST_WINDOW)
    log.info("  раз в %d сек: marts %s", args.slow_interval,
             " + ".join(f"{h}ч" for h in SLOW_WINDOWS))
    log.info("-" * 60)

    if args.once:
        run_cycle(state, args.top_n, args.h3_res, spark_env)
        return

    next_tick = time.monotonic()
    while True:
        run_cycle(state, args.top_n, args.h3_res, spark_env)

        next_tick += args.interval
        now = time.monotonic()
        while next_tick <= now:
            next_tick += args.interval
        time.sleep(next_tick - now)


if __name__ == "__main__":
    main()
