package com.springboot.web.wikipulseproject.config;

import com.uber.h3core.H3Core;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;

@Configuration
public class H3Config {

    /** H3Core потокобезопасен, экземпляр один на приложение. */
    @Bean
    public H3Core h3Core() throws IOException {
        return H3Core.newInstance();
    }
}
