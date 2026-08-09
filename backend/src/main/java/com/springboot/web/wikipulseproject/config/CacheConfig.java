package com.springboot.web.wikipulseproject.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration
public class CacheConfig {

    /** Отдельным бином, чтобы в тестах подменять на Clock.fixed и двигать время. */
    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
