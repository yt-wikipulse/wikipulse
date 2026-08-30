import importlib

from bigdata import runtime


def test_bare_host_gets_https(monkeypatch):
    monkeypatch.setenv("YT_PROXY", "yt.example.tech")

    assert runtime.proxy_url() == "https://yt.example.tech"
    assert runtime.proxy_host() == "yt.example.tech"


def test_full_url_is_kept_and_host_extracted(monkeypatch):
    monkeypatch.setenv("YT_PROXY", "https://yt.example.tech/")

    assert runtime.proxy_url() == "https://yt.example.tech/"
    assert runtime.proxy_host() == "yt.example.tech"


def test_token_falls_back_to_secure_vault(monkeypatch):
    monkeypatch.delenv("YT_TOKEN", raising=False)
    monkeypatch.setenv("YT_SECURE_VAULT_YT_TOKEN", "from-vault")

    assert runtime.yt_token() == "from-vault"


def test_user_agent_carries_the_contact(monkeypatch):
    monkeypatch.setenv("WIKIPULSE_CONTACT", "https://example.org/wikipulse")
    reloaded = importlib.reload(runtime)

    assert reloaded.USER_AGENT == "WikiPulse/0.1 (https://example.org/wikipulse)"

    monkeypatch.undo()
    importlib.reload(runtime)
