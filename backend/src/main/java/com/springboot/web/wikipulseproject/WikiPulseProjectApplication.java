package com.springboot.web.wikipulseproject;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class WikiPulseProjectApplication {

    public static void main(String[] args) {
        SpringApplication.run(WikiPulseProjectApplication.class, args);
    }
}
