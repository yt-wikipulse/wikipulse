package tech.wikipulse.backend.repository;

import org.junit.jupiter.api.Test;
import tech.ytsaurus.core.cypress.YPath;

import static org.junit.jupiter.api.Assertions.assertEquals;

class YtProxyTest {

    @Test
    void адресБезСхемыПолучаетHttps() {
        assertEquals("https://cluster.example.com",
                YtProxy.withScheme("cluster.example.com"));
    }

    @Test
    void явнаяСхемаОстаётсяКакЕсть() {
        assertEquals("http://localhost:8000", YtProxy.withScheme("http://localhost:8000"));
        assertEquals("https://cluster.example.com",
                YtProxy.withScheme("https://cluster.example.com"));
    }

    /**
     * Запрос оффсетов консьюмера собирается подстановкой {@link YPath}
     * в текст запроса, поэтому путь обязан печататься голым — без атрибутов
     * и кавычек.
     */
    @Test
    void путьВЗапросеПечатаетсяГолым() {
        YPath consumer = YPath.simple("//home/wikipulse/consumers/c_backend");

        assertEquals("* FROM [//home/wikipulse/consumers/c_backend]",
                "* FROM [" + consumer + "]");
    }
}
