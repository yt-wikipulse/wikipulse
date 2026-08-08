package com.springboot.web.wikipulseproject.config;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.springboot.web.wikipulseproject.model.EnrichedEdit;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

@Configuration
public class CacheConfig {

    @Bean
    public Cache<String, EnrichedEdit> recentEditsCache(
            @Value("${app.live-window-minutes:10}") int windowMinutes) {
        return Caffeine.newBuilder()
                .expireAfterWrite(Duration.ofMinutes(windowMinutes))
                .maximumSize(200_000)
                .build();
    }
}
