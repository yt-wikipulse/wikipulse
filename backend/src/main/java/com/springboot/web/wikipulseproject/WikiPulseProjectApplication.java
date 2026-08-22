package com.springboot.web.wikipulseproject;

import com.springboot.web.wikipulseproject.model.TopArticle;
import com.springboot.web.wikipulseproject.model.TopGeoPlace;
import com.springboot.web.wikipulseproject.model.TrendPoint;
import com.springboot.web.wikipulseproject.yt_repo.YtAggregatesRepository;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.List;

@SpringBootApplication
@EnableScheduling
public class WikiPulseProjectApplication {

    public static void main(String[] args) {
        SpringApplication.run(WikiPulseProjectApplication.class, args);
    }
}
