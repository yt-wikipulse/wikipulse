import os

DEFAULT_BASE = "//home/wikipulse"

BASE = (os.environ.get("YT_BASE_PATH") or DEFAULT_BASE).rstrip("/")

Q_RAW = f"{BASE}/q_raw"
Q_ENRICHED = f"{BASE}/q_enriched"

DICT_DIR = f"{BASE}/dict"
DICT_COORDS = f"{DICT_DIR}/coords"
DICT_COORDS_TMP = f"{DICT_DIR}/coords_tmp"

HISTORY_DIR = f"{BASE}/history"
T_HISTORY = f"{HISTORY_DIR}/t_history"

MARTS_DIR = f"{BASE}/marts"
MARTS_TRENDS = f"{MARTS_DIR}/trends"
MARTS_TOP_ARTICLES = f"{MARTS_DIR}/top_articles"
MARTS_TOP_GEO = f"{MARTS_DIR}/top_geo"

CONSUMERS_DIR = f"{BASE}/consumers"
CONSUMER_ENRICH = f"{CONSUMERS_DIR}/c_enrich"
CONSUMER_ARCHIVE = f"{CONSUMERS_DIR}/c_archive"

CHECKPOINTS_DIR = f"{BASE}/checkpoints"
CHECKPOINT_ENRICH = f"{CHECKPOINTS_DIR}/c_enrich"

LIB_DIR = f"{BASE}/lib"
LIB_BIGDATA_ZIP = f"{LIB_DIR}/bigdata.zip"
LIB_H3_ZIP = f"{LIB_DIR}/h3.zip"

SRC_DIR = f"{BASE}/src"
SRC_SPYT_ENRICH = f"{SRC_DIR}/spyt_enrich.py"
SRC_SPYT_MARTS = f"{SRC_DIR}/spyt_marts.py"


def spark_url(path: str) -> str:
    return f"yt:///{path.lstrip('/')}"
