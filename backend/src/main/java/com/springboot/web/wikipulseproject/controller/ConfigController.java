package com.springboot.web.wikipulseproject.controller;

import com.springboot.web.wikipulseproject.model.dto.ConfigResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/config")
public class ConfigController {
    private final String ymapsApiKey;

    public ConfigController(@Value("${app.ymaps.api-key:}") String ymapsApiKey) {
        this.ymapsApiKey = ymapsApiKey;
    }

    @GetMapping
    public ResponseEntity<ConfigResponse> config() {
        return ResponseEntity.ok(new ConfigResponse(ymapsApiKey));
    }
}
