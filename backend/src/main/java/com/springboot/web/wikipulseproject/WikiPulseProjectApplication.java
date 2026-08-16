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
        ApplicationContext context = SpringApplication.run(WikiPulseProjectApplication.class, args);
        YtAggregatesRepository repository = context.getBean(YtAggregatesRepository.class);

        List<TopArticle> articles = repository.fetchTopArticles("100h", 100);
        List<TopGeoPlace> places = repository.fetchTopGeo("100h", 100);
        List<TrendPoint> points = repository.fetchTrends(1786644000);
        String s = "3";
    }
}
