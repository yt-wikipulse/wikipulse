package com.springboot.web.wikipulseproject.service;

import com.springboot.web.wikipulseproject.error.BadRequestException;
import com.springboot.web.wikipulseproject.model.EnrichedEvent;
import com.springboot.web.wikipulseproject.model.dto.ActiveHexagonsResponse;
import com.springboot.web.wikipulseproject.model.dto.HexagonDto;
import com.springboot.web.wikipulseproject.model.dto.HexagonEventDto;
import com.springboot.web.wikipulseproject.yt_repo.RecentEventsCache;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class LiveMapService {

    private final RecentEventsCache cache;
    private final H3GeoService h3Geo;
    private final int eventsCap;
    private final int zoomMin;
    private final int zoomMax;

    public LiveMapService(RecentEventsCache cache,
                          H3GeoService h3Geo,
                          @Value("${app.live.hexagon-events-cap:50}") int eventsCap,
                          @Value("${app.live.zoom-min:0}") int zoomMin,
                          @Value("${app.live.zoom-max:30}") int zoomMax) {

        this.cache = cache;
        this.h3Geo = h3Geo;
        this.eventsCap = eventsCap;
        this.zoomMin = zoomMin;
        this.zoomMax = zoomMax;
    }

    public ActiveHexagonsResponse active(double minLng, double minLat, double maxLng, double maxLat, int zoom) {
        validateInput(minLng, minLat, maxLng, maxLat, zoom);

        //считаем размер шестиугольника
        int resolution = h3Geo.resolutionZoom(zoom);
        //берем данные кэша
        Map<String, List<EnrichedEvent>> snapshot = cache.snapshot();

        //сворачиваем r9 клетки вверх до запрошенной resolution фронтом
        Map<String, List<EnrichedEvent>> buckets = new HashMap<>();
        for (Map.Entry<String, List<EnrichedEvent>> entry : snapshot.entrySet()) {
            String r9Key =  entry.getKey();
            List<EnrichedEvent> events = entry.getValue();

            try {
                String parent = h3Geo.cellToParent(r9Key, resolution);
                buckets.computeIfAbsent(parent, key -> new ArrayList<>()).addAll(events);
            } catch (IllegalArgumentException ex) {
                //страховка  если встретится плохой ключ все не упадет
                log.warn("пропускаем невалидный h3_r9 ключ = {}", r9Key);
            }
        }

        List<HexagonDto> hexagons = new ArrayList<>();
        for (Map.Entry<String, List<EnrichedEvent>> bucket: buckets.entrySet()) {
            String parent = bucket.getKey();
            List<EnrichedEvent> events = bucket.getValue();

            //центр клетки вне видимого экрана - скипаем
            if (!h3Geo.intersectsBbox(parent, resolution, minLng, minLat, maxLng, maxLat)) {
                continue;
            }

            //сборка гексагона
            hexagons.add(new HexagonDto(
                            parent,
                            events.size(),
                            events.stream()
                                .limit(eventsCap)
                                .map(this::toEventDto)
                                .toList()));
        }

        return new ActiveHexagonsResponse(hexagons);
    }

    private void validateInput(double minLng, double minLat, double maxLng, double maxLat, int zoom) {
        if (minLng >= maxLng || minLat >= maxLat) {
            throw new BadRequestException("min_lng/min_lat must be less than max_lng/max_lat");
        }
        if (zoom < zoomMin || zoom > zoomMax) {
            throw new BadRequestException("zoom must be between 0 and 30");
        }
    }

    //внутреннее событие парсим во внешний контракт: id/title/url
    private HexagonEventDto toEventDto(EnrichedEvent e) {
        return new HexagonEventDto(e.eventId(), e.title(), e.url());
    }
}
