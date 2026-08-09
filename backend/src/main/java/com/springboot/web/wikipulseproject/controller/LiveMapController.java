package com.springboot.web.wikipulseproject.controller;

import com.springboot.web.wikipulseproject.model.dto.ActiveHexagonsResponse;
import com.springboot.web.wikipulseproject.model.dto.HexagonDto;
import com.springboot.web.wikipulseproject.model.dto.HexagonEventDto;
import com.springboot.web.wikipulseproject.error.BadRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * ВРЕМЕННЫЙ МОК живой карты по MVP-контракту.
 * Отдаёт захардкоженные, но ВАЛИДНЫЕ H3-клетки, чтобы фронт работал прямо сейчас.
 * Реальная логика (bbox -> polygonToCells -> RecentEventsCache) придёт в LiveMapService.
 */
@RestController
@RequestMapping("/api/v1/hexagons")
public class LiveMapController {

    private final int zoomR3Max;
    private final int zoomR6Max;

    public LiveMapController(@Value("${app.live.zoom-r3-max:5}") int zoomR3Max,
                             @Value("${app.live.zoom-r6-max:11}") int zoomR6Max) {
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
        return new ActiveHexagonsResponse(mockHexagons(resolutionForZoom(zoom)));
    }

    private int resolutionForZoom(int zoom) {
        if (zoom <= zoomR3Max) return 3;
        if (zoom <= zoomR6Max) return 6;
        return 9;
    }

    // Валидные H3 для координат городов из мок-событий — cellToBoundary на фронте не упадёт.
    private List<HexagonDto> mockHexagons(int resolution) {
        return switch (resolution) {
            case 3 -> List.of(
                hexagon("8311aafffffffff",
                    event("1234567890", "Москва", "https://ru.wikipedia.org/wiki/Москва")),
                hexagon("831f1dfffffffff",
                    event("1234567891", "Berlin", "https://en.wikipedia.org/wiki/Berlin")));
            case 6 -> List.of(
                hexagon("86283082fffffff",
                    event("2234567890", "San Francisco", "https://en.wikipedia.org/wiki/San_Francisco")),
                hexagon("861fb4677ffffff",
                    event("3234567890", "Eiffel Tower", "https://en.wikipedia.org/wiki/Eiffel_Tower")));
            default -> List.of(hexagon("8911aa7abd3ffff",
                event("4234567890", "Москва", "https://ru.wikipedia.org/wiki/Москва")));
        };
    }

    private HexagonDto hexagon(String h3, HexagonEventDto... events) {
        List<HexagonEventDto> list = List.of(events);
        return new HexagonDto(h3, list.size(), list);
    }

    private HexagonEventDto event(String id, String title, String url) {
        return new HexagonEventDto(id, title, url);
    }
}
