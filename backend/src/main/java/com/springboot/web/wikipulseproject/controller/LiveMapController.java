package com.springboot.web.wikipulseproject.controller;

import com.springboot.web.wikipulseproject.model.dto.ActiveHexagonsResponse;
import com.springboot.web.wikipulseproject.error.BadRequestException;
import com.springboot.web.wikipulseproject.service.H3GeoService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * ВРЕМЕННЫЙ МОК живой карты по MVP-контракту.
 * Отдаёт детерминированные H3-клетки из каталога мировых городов для демо.
 */
@RestController
@RequestMapping("/api/v1/hexagons")
public class LiveMapController {

    private final int zoomR3Max;
    private final int zoomR6Max;
    private final H3GeoService h3GeoService;

    public LiveMapController(H3GeoService h3GeoService,
                             @Value("${app.live.zoom-r3-max:7}") int zoomR3Max,
                             @Value("${app.live.zoom-r6-max:12}") int zoomR6Max) {
        this.h3GeoService = h3GeoService;
        this.zoomR3Max = zoomR3Max;
        this.zoomR6Max = zoomR6Max;
    }

    @GetMapping("/active")
    public ActiveHexagonsResponse active(
        @RequestParam("min_lng") double minLng,
        @RequestParam("min_lat") double minLat,
        @RequestParam("max_lng") double maxLng,
        @RequestParam("max_lat") double maxLat,
        @RequestParam("zoom") int zoom) {

        if (minLng >= maxLng || minLat >= maxLat) {
            throw new BadRequestException("min_lng/min_lat must be less than max_lng/max_lat");
        }
        if (zoom < 0 || zoom > 30) {
            throw new BadRequestException("zoom must be between 0 and 30");
        }
        return new ActiveHexagonsResponse(h3GeoService.demoHexagons(
            minLng, minLat, maxLng, maxLat, resolutionForZoom(zoom)));
    }

    private int resolutionForZoom(int zoom) {
        if (zoom <= zoomR3Max) return 3;
        if (zoom <= zoomR6Max) return 6;
        return 9;
    }

}
