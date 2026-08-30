package tech.wikipulse.backend.service;

import tech.wikipulse.backend.error.BadRequestException;
import tech.wikipulse.backend.model.EnrichedEvent;
import tech.wikipulse.backend.model.dto.ActiveHexagonsResponse;
import tech.wikipulse.backend.model.dto.HexagonDto;
import tech.wikipulse.backend.model.dto.HexagonEventDto;
import tech.wikipulse.backend.repository.RecentEventsCache;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;

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

    /**
     * Активные гексагоны в видимом прямоугольнике на заданном зуме.
     *
     * <p>Свёртка идёт вверх: берётся снимок кэша целиком и каждый ключ
     * {@code h3_r9} переводится в родителя нужной резолюции. Обратное
     * направление — развернуть запрошенные ячейки вниз до потомков девятого
     * уровня — неприменимо: от резолюции 3 до 9 получается около 117 тысяч
     * потомков на одну ячейку, тогда как обход снимка ограничен окном кэша.
     *
     * <p>Невалидный ключ из кэша пропускается с записью в лог: одна битая
     * строка в очереди не должна гасить всю карту.
     *
     * <p>Массив событий гексагона обрезается до {@code app.live.hexagon-events-cap},
     * а {@code events_count} остаётся полным: счётчик отвечает за заливку карты,
     * массив — за список в поповере.
     */
    public ActiveHexagonsResponse active(double minLng, double minLat, double maxLng, double maxLat, int zoom) {
        validateInput(minLng, minLat, maxLng, maxLat, zoom);

        int resolution = h3Geo.resolutionZoom(zoom);
        Map<String, List<EnrichedEvent>> snapshot = cache.snapshot();

        Map<String, List<EnrichedEvent>> buckets = new HashMap<>();
        for (Map.Entry<String, List<EnrichedEvent>> entry : snapshot.entrySet()) {
            String r9Key =  entry.getKey();
            List<EnrichedEvent> events = entry.getValue();

            try {
                String parent = h3Geo.cellToParent(r9Key, resolution);
                buckets.computeIfAbsent(parent, key -> new ArrayList<>()).addAll(events);
            } catch (IllegalArgumentException ex) {
                log.warn("пропускаем невалидный h3_r9 ключ = {}", r9Key);
            }
        }

        List<HexagonDto> hexagons = new ArrayList<>();
        for (Map.Entry<String, List<EnrichedEvent>> bucket: buckets.entrySet()) {
            String parent = bucket.getKey();
            List<EnrichedEvent> events = bucket.getValue();

            if (!h3Geo.intersectsBbox(parent, resolution, minLng, minLat, maxLng, maxLat)) {
                continue;
            }

            hexagons.add(new HexagonDto(
                            parent,
                            events.size(),
                            events.stream()
                                .sorted(Comparator.comparingLong(EnrichedEvent::eventTs).reversed())
                                .limit(eventsCap)
                                .map(this::toEventDto)
                                .toList()));
        }

        return new ActiveHexagonsResponse(hexagons);
    }

    /**
     * Проверка параметров запроса. Стоит в сервисе, а не в контроллере: это
     * граница доверия, и она держится рядом с местом, где параметры
     * превращаются в геометрию.
     *
     * <p>Прямоугольник, пересекающий 180-й меридиан, приходит с
     * {@code min_lng > max_lng} и отбивается как невалидный — на этом
     * меридиане карта пустеет.
     */
    private void validateInput(double minLng, double minLat, double maxLng, double maxLat, int zoom) {
        if (minLng >= maxLng || minLat >= maxLat) {
            throw new BadRequestException("min_lng/min_lat must be less than max_lng/max_lat");
        }
        if (zoom < zoomMin || zoom > zoomMax) {
            throw new BadRequestException("zoom must be between 0 and 30");
        }
    }

    private HexagonEventDto toEventDto(EnrichedEvent e) {
        return new HexagonEventDto(e.eventId(), e.title(), e.url(), e.lengthUpdate(), e.diffUrl(), e.eventTs());
    }
}
