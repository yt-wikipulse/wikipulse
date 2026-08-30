#!/usr/bin/env python3
import argparse
import io
import logging
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

import yt.wrapper as yt

from bigdata import paths
from bigdata.runtime import require_env

CLUSTER_PYTHON = "3.11"
CLUSTER_PLATFORM = "manylinux2014_x86_64"

PACKAGE_ROOT = Path(__file__).resolve().parent.parent
JOB_SCRIPTS = (
    PACKAGE_ROOT / "jobs" / "spyt_enrich.py",
    PACKAGE_ROOT / "jobs" / "spyt_marts.py",
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("upload_artifacts")


def build_package_zip() -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for module in sorted(PACKAGE_ROOT.rglob("*.py")):
            arcname = Path(PACKAGE_ROOT.name) / module.relative_to(PACKAGE_ROOT)
            archive.write(module, arcname)
    return buffer.getvalue()


def build_h3_zip() -> bytes:
    with tempfile.TemporaryDirectory() as staging:
        subprocess.run(
            [
                sys.executable, "-m", "pip", "install", "h3",
                "--target", staging,
                "--platform", CLUSTER_PLATFORM,
                "--python-version", CLUSTER_PYTHON,
                "--only-binary=:all:",
                "--no-compile",
                "--quiet",
            ],
            check=True,
        )
        root = Path(staging)
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
            for item in sorted(root.rglob("*")):
                if item.is_file():
                    archive.write(item, item.relative_to(root))
        return buffer.getvalue()


def upload_job_script(local: Path) -> int:
    data = local.read_bytes()
    yt.write_file(f"{paths.SRC_DIR}/{local.name}", data)
    return len(data)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Сборка и заливка артефактов SPYT в Cypress"
    )
    parser.add_argument("--skip-h3", action="store_true",
                        help="не пересобирать h3.zip (нужен pip с доступом в сеть)")
    return parser.parse_args()


def main():
    args = parse_args()
    require_env("YT_PROXY", "YT_TOKEN")

    package = build_package_zip()
    yt.write_file(paths.LIB_BIGDATA_ZIP, package)
    log.info("%s: %d байт", paths.LIB_BIGDATA_ZIP, len(package))

    if args.skip_h3:
        log.info("%s: пропущен (--skip-h3)", paths.LIB_H3_ZIP)
    else:
        h3_zip = build_h3_zip()
        yt.write_file(paths.LIB_H3_ZIP, h3_zip)
        log.info("%s: %d байт", paths.LIB_H3_ZIP, len(h3_zip))

    for script in JOB_SCRIPTS:
        size = upload_job_script(script)
        log.info("%s/%s: %d байт", paths.SRC_DIR, script.name, size)


if __name__ == "__main__":
    main()
