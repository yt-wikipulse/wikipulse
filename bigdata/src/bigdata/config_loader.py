import os
from pathlib import Path
from functools import lru_cache

import yaml

_THIS_DIR = Path(__file__).resolve().parent
_CANDIDATE_DIRS = [
    _THIS_DIR / "config",
    _THIS_DIR / "src" / "config",
]


def _find_config(env: str) -> Path:
    for d in _CANDIDATE_DIRS:
        p = d / f"{env}.yaml"
        if p.exists():
            return p
    raise FileNotFoundError(
        f"Конфиг {env}.yaml не найден. Искал в: "
        + ", ".join(str(d) for d in _CANDIDATE_DIRS)
    )


@lru_cache(maxsize=1)
def load_config(env: str = "hackathon") -> dict:
    path = _find_config(env)
    with open(path) as f:
        return yaml.safe_load(f)


def table_path(cfg: dict, table: str, subdir: str | None = None) -> str:
    base = cfg["base_dir"].rstrip("/")
    name = cfg["table_names"][table]

    if subdir is None:
        subdir = _guess_subdir(table, cfg)

    if subdir and subdir in cfg.get("subdirs", {}):
        sub = cfg["subdirs"][subdir]
        return f"{base}/{sub}/{name}"

    return f"{base}/{name}"


def _guess_subdir(table: str, cfg: dict) -> str | None:
    prefixes = {
        "dict_":   "dict",
        "mart_":   "marts",
    }
    for prefix, subdir_key in prefixes.items():
        if table.startswith(prefix):
            return subdir_key

    if table.startswith("consumer_"):
        return "consumers"
    if table.startswith("checkpoint_"):
        return "checkpoints"

    return None

class _Paths:

    def __init__(self, cfg: dict):
        self._cfg = cfg

    @property
    def base_dir(self) -> str:
        return self._cfg["base_dir"]

    @property
    def q_raw(self) -> str:
        return table_path(self._cfg, "q_raw")

    @property
    def q_enriched(self) -> str:
        return table_path(self._cfg, "q_enriched")

    @property
    def dict_coords(self) -> str:
        return table_path(self._cfg, "dict_coords")

    @property
    def dict_countries(self) -> str:
        return table_path(self._cfg, "dict_countries")

    @property
    def t_history(self) -> str:
        return f"{self.base_dir}/history"

    @property
    def mart_top_countries(self) -> str:
        return table_path(self._cfg, "mart_top_countries")

    @property
    def mart_by_language(self) -> str:
        return table_path(self._cfg, "mart_by_language")

    @property
    def mart_trends(self) -> str:
        return table_path(self._cfg, "mart_trends")

    @property
    def consumer_enrich(self) -> str:
        return table_path(self._cfg, "consumer_enrich")

    @property
    def checkpoint_enrich(self) -> str:
        base = self.base_dir.lstrip("/")
        sub = self._cfg["subdirs"]["checkpoints"]
        name = self._cfg["table_names"]["checkpoint_enrich"]
        return f"yt:///{base}/{sub}/{name}"


def get_paths(env: str = "hackathon") -> _Paths:
    return _Paths(load_config(env))

paths = get_paths()
