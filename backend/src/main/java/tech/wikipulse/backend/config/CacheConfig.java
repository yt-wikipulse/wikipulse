package tech.wikipulse.backend.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.util.concurrent.TimeUnit;

@Configuration
@EnableCaching
public class CacheConfig {

    /**
     * Часы отдельным бином, чтобы тесты подменяли их на подвижные: окно живой
     * карты иначе пришлось бы проверять реальным ожиданием. Их же берёт
     * {@code MockPoller}, поэтому сдвиг времени в тестах двигает и
     * воспроизведение фикстур.
     */
    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }

    /**
     * Кэш ответа дашборда: минута жизни с момента записи. К кэшу живой карты
     * отношения не имеет — тот живёт в {@code InMemoryRecentEventsCache}.
     */
    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cm = new CaffeineCacheManager();
        cm.setCaffeine(Caffeine.newBuilder()
            .expireAfterWrite(60, TimeUnit.SECONDS));
        return cm;
    }
}
