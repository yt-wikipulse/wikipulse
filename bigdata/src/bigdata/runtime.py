import os
import sys
import tempfile
import zipfile
from urllib.parse import urlsplit

DEFAULT_CONTACT = "https://github.com/yt-wikipulse/wikipulse"

USER_AGENT = "WikiPulse/0.1 ({})".format(
    os.environ.get("WIKIPULSE_CONTACT") or DEFAULT_CONTACT
)
"""
Значение заголовка ``User-Agent`` для запросов к Wikimedia. Их User-Agent
policy требует рабочий способ связи, поэтому форк обязан подставить свой
контакт через ``WIKIPULSE_CONTACT``: недостижимый адрес — нарушение
политики и повод для бана по IP.
"""

H3_ZIP_NAME = "h3.zip"

_yt_client = None


def require_env(*names: str) -> None:
    """
    Проверяет, что переменные окружения заданы, и завершает процесс с
    перечислением недостающих. Единая точка проверки для всех entry points.
    """
    missing = [name for name in names if not os.environ.get(name)]
    if missing:
        sys.exit(f"ОШИБКА: не заданы переменные окружения: {', '.join(missing)}")


def proxy_url() -> str:
    """
    Адрес прокси YTsaurus для python-клиента. ``YT_PROXY`` пишут и как
    ``https://host``, и как голый ``host`` — схема добавляется, если её нет.

    Фолбэка на прокси по умолчанию нет: без ``YT_PROXY`` лучше упасть
    с ``KeyError``, чем молча писать данные в чужой кластер.
    """
    proxy = os.environ["YT_PROXY"]
    return proxy if "://" in proxy else f"https://{proxy}"


def proxy_host() -> str:
    """
    Голое имя хоста прокси — форма, которую ждут ``--master
    ytsaurus://https://<host>`` и ``spark.yarn.appMasterEnv.YT_PROXY``.
    """
    return urlsplit(proxy_url()).netloc


def yt_token() -> str:
    """
    Токен YTsaurus. ``YT_TOKEN`` — то, что задаётся вне кластера;
    ``YT_SECURE_VAULT_YT_TOKEN`` YTsaurus кладёт в окружение операции сам,
    поэтому джобам на кластере токен передавать не нужно.
    """
    return (
        os.environ.get("YT_TOKEN")
        or os.environ.get("YT_SECURE_VAULT_YT_TOKEN")
        or ""
    )


def yt_client():
    global _yt_client
    if _yt_client is None:
        import yt.wrapper as yt

        _yt_client = yt.YtClient(proxy=proxy_url(), token=yt_token())
    return _yt_client


def load_h3():
    """
    Импортирует ``h3``, при необходимости распаковав ``h3.zip`` из рабочего
    каталога джобы.

    ``h3`` — расширение на C, а бинарники питон импортировать прямо из zip
    не умеет: архив приезжает на кластер через ``--files`` и распаковывается
    руками. Каталог берётся из ``mkdtemp``, а не фиксированный в ``/tmp``,
    иначе executor'ы на одном узле дерутся за один каталог. ``sys.path``
    дополняется в конец: если ``h3`` есть в образе, выигрывает он.
    """
    try:
        import h3
    except ImportError:
        target = tempfile.mkdtemp(prefix="h3-")
        with zipfile.ZipFile(H3_ZIP_NAME) as archive:
            archive.extractall(target)
        sys.path.append(target)
        import h3
    return h3
