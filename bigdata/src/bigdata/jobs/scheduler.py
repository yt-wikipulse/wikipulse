#!/usr/bin/env python3
"""
    source ~/a-summer-school
    uv run scheduler            # демон: цикл каждые 5 минут
    uv run scheduler --once     # один цикл (проверка)
"""
import argparse
import logging
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

import yt.wrapper as yt

BASE = "//home/wikipulse"
SPYT_MARTS_LOCAL = Path(__file__).with_name("spyt_marts.py")
SPYT_MARTS_REMOTE = f"{BASE}/src/spyt_marts.py"
SPYT_MARTS_SPARK = f"yt:///{BASE.lstrip('/')}/src/spyt_marts.py"

PROXY_HOST = "your-cluster.example.com"
SPARK_MASTER = f"ytsaurus://https://{PROXY_HOST}"
SPYT_DEPS_ZIP = "yt:///home/wikipulse/lib/spyt_deps.zip"
H3_ZIP = f"yt:///{BASE.lstrip('/')}/lib/h3.zip"

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


def build_spark_submit(hours: int, yt_token: str,
                       top_n: int | None = None,
                       h3_res: int | None = None) -> list[str]:
    cmd = [
        "spark-submit",
        "--master", SPARK_MASTER,
        "--deploy-mode", "cluster",
        "--num-executors", "2",
        "--executor-memory", "2g",
        "--executor-cores", "1",
        "--driver-memory", "2g",
        "--conf", "spark.hadoop.yt.proxy.role=http",
        "--conf", f"spark.yarn.appMasterEnv.YT_TOKEN={yt_token}",
        "--conf", f"spark.yarn.appMasterEnv.YT_PROXY={PROXY_HOST}",
        "--conf", "spark.pyspark.python=/usr/bin/python3.11",
        "--conf", "spark.shuffle.useOldFetchProtocol=true",
        "--py-files", SPYT_DEPS_ZIP,
        "--files", H3_ZIP,
        SPYT_MARTS_SPARK,
        "--hours", str(hours),
    ]
    if top_n is not None:
        cmd += ["--top-n", str(top_n)]
    if h3_res is not None:
        cmd += ["--h3-res", str(h3_res)]
    return cmd


def resolve_spark_env() -> dict[str, str]:
    """PATH для spark-шагов: каталог найденного spark-submit первым.

    spark-submit — шелл-скрипт, который определяет SPARK_HOME через
    питоновский find_spark_home.py. Под `uv run` первым в PATH лежит venv
    проекта без pyspark, скрипт падает и SPARK_HOME остаётся пустым
    (/bin/spark-class, код 126). Каталог самого spark-submit вперёд —
    и `python` внутри скрипта берётся из окружения с pyspark.
    """
    env = os.environ.copy()
    spark_submit = shutil.which("spark-submit")
    if spark_submit:
        spark_bin = os.path.dirname(spark_submit)
        env["PATH"] = f"{spark_bin}{os.pathsep}{env.get('PATH', '')}"
    return env


def windows_due(last_slow: float, now: float, slow_interval: int) -> bool:
    return now - last_slow >= slow_interval


def upload_marts_script():
    data = SPYT_MARTS_LOCAL.read_bytes()
    yt.write_file(SPYT_MARTS_REMOTE, data)
    log.info("spyt_marts.py залит в Cypress: %d байт", len(data))


def run_step(name: str, cmd: list[str], timeout: int = STEP_TIMEOUT,
             env: dict[str, str] | None = None) -> bool:
    """Запускает команду, логирует длительность. True — успех."""
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
        upload_marts_script()
    except Exception as e:
        log.error("заливка spyt_marts.py не удалась: %s", e)

    run_step("archiver", ARCHIVER_CMD)

    windows = [FAST_WINDOW]
    if windows_due(state["last_slow"], time.time(), state["slow_interval"]):
        windows += list(SLOW_WINDOWS)
        state["last_slow"] = time.time()

    token = os.environ.get("YT_TOKEN", "")
    for hours in windows:
        run_step(f"marts {hours}h", build_spark_submit(hours, token, top_n, h3_res),
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


def check_env():
    missing = [v for v in ("YT_PROXY", "YT_TOKEN") if not os.environ.get(v)]
    if missing:
        print(f"ОШИБКА: не задано: {', '.join(missing)}.")
        print("Выполни: source ~/a-summer-school")
        sys.exit(1)
    log.info("Прокси: %s", os.environ["YT_PROXY"])


def main():
    args = parse_args()
    check_env()

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
