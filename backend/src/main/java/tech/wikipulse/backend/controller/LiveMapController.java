package tech.wikipulse.backend.controller;

import tech.wikipulse.backend.model.dto.ActiveHexagonsResponse;
import tech.wikipulse.backend.service.LiveMapService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hexagons")
public class LiveMapController {

    private final LiveMapService liveMapService;

    public LiveMapController(LiveMapService liveMapService) {
        this.liveMapService = liveMapService;
    }

    @GetMapping("/active")
    public ResponseEntity<ActiveHexagonsResponse> active(
        @RequestParam("min_lng") double minLng,
        @RequestParam("min_lat") double minLat,
        @RequestParam("max_lng") double maxLng,
        @RequestParam("max_lat") double maxLat,
        @RequestParam("zoom") int zoom
    ) {
        return ResponseEntity.ok(liveMapService.active(minLng, minLat, maxLng, maxLat, zoom));
    }
}
