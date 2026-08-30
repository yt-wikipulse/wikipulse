package tech.wikipulse.backend.service;

import com.uber.h3core.H3Core;
import com.uber.h3core.util.LatLng;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;


@Service
public class H3GeoService {

    private final H3Core h3;
    private final int zoomR3Max;
    private final int zoomR4Max;
    private final int zoomR5Max;
    private final int zoomR6Max;
    private final int zoomR8Max;

    public H3GeoService(H3Core h3,
                        @Value("${app.live.zoom-r3-max:6}") int zoomR3Max,
                        @Value("${app.live.zoom-r4-max:7}") int zoomR4Max,
                        @Value("${app.live.zoom-r5-max:9}") int zoomR5Max,
                        @Value("${app.live.zoom-r6-max:11}") int zoomR6Max,
                        @Value("${app.live.zoom-r8-max:13}") int zoomR8Max) {
        this.h3 = h3;
        this.zoomR3Max = zoomR3Max;
        this.zoomR4Max = zoomR4Max;
        this.zoomR5Max = zoomR5Max;
        this.zoomR6Max = zoomR6Max;
        this.zoomR8Max = zoomR8Max;
    }

    public int resolutionZoom(int zoom) {
        if (zoom <= zoomR3Max) return 3;
        if (zoom <= zoomR4Max) return 4;
        if (zoom <= zoomR5Max) return 5;
        if (zoom <= zoomR6Max) return 6;
        if (zoom <= zoomR8Max) return 8;
        return 9;
    }

    public String cellToParent(String h3R9, int resolution) {
        long cell = h3.stringToH3(h3R9);
        long parent = h3.cellToParent(cell, resolution);
        return h3.h3ToString(parent);
    }


    public boolean intersectsBbox(String h3Index, int resolution,
                                  double minLng, double minLat,
                                  double maxLng, double maxLat) {

        long cell = h3.stringToH3(h3Index);

        return hexagonTouchesBox(cell, minLng, minLat, maxLng, maxLat) || boxTouchesHexagon(h3Index, resolution, minLng, minLat, maxLng, maxLat);
    }

    private boolean hexagonTouchesBox(long cell,
                                      double minLng, double minLat,
                                      double maxLng, double maxLat) {

        LatLng center = h3.cellToLatLng(cell);

        if (inBox(center.lat, center.lng, minLng, minLat, maxLng, maxLat)) {
            return true;
        }

        return h3.cellToBoundary(cell).stream().anyMatch(v -> inBox(v.lat, v.lng, minLng, minLat, maxLng, maxLat));
    }

    private boolean boxTouchesHexagon(String h3Index, int resolution,
                                      double minLng, double minLat,
                                      double maxLng, double maxLat) {

        return h3.latLngToCellAddress(minLat, minLng, resolution).equals(h3Index)
            || h3.latLngToCellAddress(minLat, maxLng, resolution).equals(h3Index)
            || h3.latLngToCellAddress(maxLat, maxLng, resolution).equals(h3Index)
            || h3.latLngToCellAddress(maxLat, minLng, resolution).equals(h3Index);
    }

    private boolean inBox(double lat, double lng,
                          double minLng, double minLat,
                          double maxLng, double maxLat) {

        return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
    }
}
