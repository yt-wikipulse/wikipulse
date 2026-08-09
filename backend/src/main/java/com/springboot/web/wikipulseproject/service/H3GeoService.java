package com.springboot.web.wikipulseproject.service;

import com.springboot.web.wikipulseproject.model.dto.HexagonDto;
import com.springboot.web.wikipulseproject.model.dto.HexagonEventDto;
import com.uber.h3core.H3Core;
import com.uber.h3core.util.LatLng;
import org.springframework.stereotype.Service;

import java.awt.geom.Path2D;
import java.awt.geom.Rectangle2D;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.SplittableRandom;
import java.util.TreeMap;

@Service
public class H3GeoService {

    private static final int MAX_DEMO_HEXAGONS = 500;
    private static final List<DemoCity> DEMO_CITIES = List.of(
        city("moscow", "Москва", "https://ru.wikipedia.org/wiki/Москва", 55.7558, 37.6173),
        city("saint-petersburg", "Санкт-Петербург", "https://ru.wikipedia.org/wiki/Санкт-Петербург", 59.9343, 30.3351),
        city("novosibirsk", "Новосибирск", "https://ru.wikipedia.org/wiki/Новосибирск", 55.0084, 82.9357),
        city("london", "London", "https://en.wikipedia.org/wiki/London", 51.5074, -0.1278),
        city("paris", "Paris", "https://en.wikipedia.org/wiki/Paris", 48.8566, 2.3522),
        city("berlin", "Berlin", "https://en.wikipedia.org/wiki/Berlin", 52.5200, 13.4050),
        city("madrid", "Madrid", "https://en.wikipedia.org/wiki/Madrid", 40.4168, -3.7038),
        city("rome", "Rome", "https://en.wikipedia.org/wiki/Rome", 41.9028, 12.4964),
        city("warsaw", "Warsaw", "https://en.wikipedia.org/wiki/Warsaw", 52.2297, 21.0122),
        city("stockholm", "Stockholm", "https://en.wikipedia.org/wiki/Stockholm", 59.3293, 18.0686),
        city("istanbul", "Istanbul", "https://en.wikipedia.org/wiki/Istanbul", 41.0082, 28.9784),
        city("cairo", "Cairo", "https://en.wikipedia.org/wiki/Cairo", 30.0444, 31.2357),
        city("lagos", "Lagos", "https://en.wikipedia.org/wiki/Lagos", 6.5244, 3.3792),
        city("johannesburg", "Johannesburg", "https://en.wikipedia.org/wiki/Johannesburg", -26.2041, 28.0473),
        city("new-york", "New York City", "https://en.wikipedia.org/wiki/New_York_City", 40.7128, -74.0060),
        city("san-francisco", "San Francisco", "https://en.wikipedia.org/wiki/San_Francisco", 37.7749, -122.4194),
        city("toronto", "Toronto", "https://en.wikipedia.org/wiki/Toronto", 43.6532, -79.3832),
        city("mexico-city", "Mexico City", "https://en.wikipedia.org/wiki/Mexico_City", 19.4326, -99.1332),
        city("sao-paulo", "São Paulo", "https://en.wikipedia.org/wiki/S%C3%A3o_Paulo", -23.5505, -46.6333),
        city("buenos-aires", "Buenos Aires", "https://en.wikipedia.org/wiki/Buenos_Aires", -34.6037, -58.3816),
        city("dubai", "Dubai", "https://en.wikipedia.org/wiki/Dubai", 25.2048, 55.2708),
        city("delhi", "Delhi", "https://en.wikipedia.org/wiki/Delhi", 28.6139, 77.2090),
        city("beijing", "Beijing", "https://en.wikipedia.org/wiki/Beijing", 39.9042, 116.4074),
        city("tokyo", "Tokyo", "https://en.wikipedia.org/wiki/Tokyo", 35.6762, 139.6503),
        city("seoul", "Seoul", "https://en.wikipedia.org/wiki/Seoul", 37.5665, 126.9780),
        city("singapore", "Singapore", "https://en.wikipedia.org/wiki/Singapore", 1.3521, 103.8198),
        city("jakarta", "Jakarta", "https://en.wikipedia.org/wiki/Jakarta", -6.2088, 106.8456),
        city("sydney", "Sydney", "https://en.wikipedia.org/wiki/Sydney", -33.8688, 151.2093),
        city("auckland", "Auckland", "https://en.wikipedia.org/wiki/Auckland", -36.8509, 174.7645)
    );

    private final H3Core h3;

    public H3GeoService(H3Core h3) {
        this.h3 = h3;
    }

    /** Deterministic demo activity: global at r3, clusters at r6, detail at r9. */
    public List<HexagonDto> demoHexagons(double minLng, double minLat, double maxLng, double maxLat, int resolution) {
        Map<String, List<HexagonEventDto>> eventsByHexagon = new TreeMap<>();
        int radius = switch (resolution) {
            case 3 -> 1;
            case 6 -> 3;
            default -> 8;
        };

        for (DemoCity city : DEMO_CITIES) {
            String origin = h3.latLngToCellAddress(city.latitude(), city.longitude(), resolution);
            for (String h3Index : h3.gridDisk(origin, radius)) {
                if (isVisibleDemoCell(h3Index)
                    && intersectsViewport(h3Index, minLng, minLat, maxLng, maxLat)) {
                    eventsByHexagon.computeIfAbsent(h3Index, ignored -> new ArrayList<>())
                        .add(new HexagonEventDto(city.id() + "-" + h3Index, city.name(), city.url()));
                }
            }
        }

        return eventsByHexagon.entrySet().stream()
            .limit(MAX_DEMO_HEXAGONS)
            .map(entry -> new HexagonDto(entry.getKey(), entry.getValue().size(), List.copyOf(entry.getValue())))
            .toList();
    }

    private boolean intersectsViewport(
        String h3Index,
        double minLng,
        double minLat,
        double maxLng,
        double maxLat
    ) {
        List<LatLng> boundary = h3.cellToBoundary(h3Index);
        Rectangle2D viewport = new Rectangle2D.Double(minLng, minLat, maxLng - minLng, maxLat - minLat);
        Path2D polygon = new Path2D.Double();

        LatLng first = boundary.get(0);
        polygon.moveTo(first.lng, first.lat);
        for (int index = 1; index < boundary.size(); index++) {
            LatLng vertex = boundary.get(index);
            polygon.lineTo(vertex.lng, vertex.lat);
        }
        polygon.closePath();

        if (polygon.contains(minLng, minLat)
            || polygon.contains(minLng, maxLat)
            || polygon.contains(maxLng, minLat)
            || polygon.contains(maxLng, maxLat)) {
            return true;
        }

        for (int index = 0; index < boundary.size(); index++) {
            LatLng from = boundary.get(index);
            LatLng to = boundary.get((index + 1) % boundary.size());
            if (viewport.contains(from.lng, from.lat)
                || viewport.intersectsLine(from.lng, from.lat, to.lng, to.lat)) {
                return true;
            }
        }

        return false;
    }

    private static boolean isVisibleDemoCell(String h3Index) {
        return new SplittableRandom(Long.parseUnsignedLong(h3Index, 16)).nextBoolean();
    }

    private static DemoCity city(String id, String name, String url, double latitude, double longitude) {
        return new DemoCity(id, name, url, latitude, longitude);
    }

    private record DemoCity(String id, String name, String url, double latitude, double longitude) {
    }
}
