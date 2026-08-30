import os
import sys
import tempfile
import zipfile
from urllib.parse import urlsplit

DEFAULT_CONTACT = "https://github.com/yt-wikipulse/wikipulse"

USER_AGENT = "WikiPulse/0.1 ({})".format(
    os.environ.get("WIKIPULSE_CONTACT") or DEFAULT_CONTACT
)

H3_ZIP_NAME = "h3.zip"

_yt_client = None


def require_env(*names: str) -> None:
    missing = [name for name in names if not os.environ.get(name)]
    if missing:
        sys.exit(f"ОШИБКА: не заданы переменные окружения: {', '.join(missing)}")


def proxy_url() -> str:
    proxy = os.environ["YT_PROXY"]
    return proxy if "://" in proxy else f"https://{proxy}"


def proxy_host() -> str:
    return urlsplit(proxy_url()).netloc


def yt_token() -> str:
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
    try:
        import h3
    except ImportError:
        target = tempfile.mkdtemp(prefix="h3-")
        with zipfile.ZipFile(H3_ZIP_NAME) as archive:
            archive.extractall(target)
        sys.path.append(target)
        import h3
    return h3
