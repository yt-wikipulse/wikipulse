package tech.wikipulse.backend.repository;

/**
 * Приведение значения {@code YT_PROXY} к виду, который ждёт Java-клиент.
 */
final class YtProxy {

    private YtProxy() {}

    /**
     * Дописывает {@code https://}, если схемы нет.
     *
     * <p>Без схемы клиент идёт на {@code http://<host>:80}, а кластер за TLS
     * отвечает на это редиректом 301, который клиент не разбирает: запуск
     * падает на discovery прокси с невнятным {@code Error: 301}. Локальному
     * кластеру по HTTP схему пишут явно — так же, как для {@code bigdata}.
     */
    static String withScheme(String proxy) {
        return proxy.contains("://") ? proxy : "https://" + proxy;
    }
}
