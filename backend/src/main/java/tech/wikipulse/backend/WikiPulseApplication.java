package tech.wikipulse.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class WikiPulseApplication {

    public static void main(String[] args) {
        SpringApplication.run(WikiPulseApplication.class, args);
    }
}
