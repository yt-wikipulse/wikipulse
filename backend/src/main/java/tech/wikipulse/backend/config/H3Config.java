package tech.wikipulse.backend.config;

import com.uber.h3core.H3Core;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;

@Configuration
public class H3Config {

    @Bean
    public H3Core h3Core() {
        try {
            return H3Core.newInstance();
        } catch (IOException e) {
            throw new IllegalStateException("Не удалось загрузить нативную библиотеку H3", e);
        }
    }
}
