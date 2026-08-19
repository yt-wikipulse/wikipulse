package com.springboot.web.wikipulseproject.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.util.concurrent.TimeUnit;

@Configuration
@EnableCaching  // включает обработку @Cacheable / @CacheEvict
public class CacheConfig {

    /** Отдельным бином, чтобы в тестах подменять на Clock.fixed и двигать время. */
    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cm = new CaffeineCacheManager();
        cm.setCaffeine(Caffeine.newBuilder()
            .expireAfterWrite(60, TimeUnit.SECONDS));
        return cm;
    }
}
