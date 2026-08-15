package com.springboot.web.wikipulseproject.service;

import com.uber.h3core.H3Core;
import com.uber.h3core.util.LatLng;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;


@Service
public class H3GeoService {

    private final H3Core h3;
    private final int zoomR3Max;
    private final int zoomR6Max;

    public H3GeoService(H3Core h3,
                        @Value("${app.live.zoom-r3-max:5}") int zoomR3Max,
                        @Value("${app.live.zoom-r6-max:11}") int zoomR6Max) {
        this.h3 = h3;
        this.zoomR3Max = zoomR3Max;
        this.zoomR6Max = zoomR6Max;
    }

    //зум нашей карты - чем сильне мы приблизили тем меньше шестиугольник видим
    public int resolutionZoom(int zoom) {
        if (zoom <= zoomR3Max) return 3;
        if (zoom <= zoomR6Max) return 6;
        return 9;
    }

    //в какой клетке resolution лежит R9 клетка?
    public String cellToParent(String h3R9, int resolution) {
        long cell = h3.stringToH3(h3R9);
        long parent = h3.cellToParent(cell, resolution);
        return h3.h3ToString(parent);
    }


     //пересекает ли клетка прямоугольник экрана
    public boolean intersectsBbox(String h3Index, int resolution,
                                  double minLng, double minLat,
                                  double maxLng, double maxLat) {

        long cell = h3.stringToH3(h3Index);

        return hexagonTouchesBox(cell, minLng, minLat, maxLng, maxLat) || boxTouchesHexagon(h3Index, resolution, minLng, minLat, maxLng, maxLat);
    }

    //гексагон втыкается в экран: центр или любая из 6 вершин внутри прямоугольника
    private boolean hexagonTouchesBox(long cell,
                                      double minLng, double minLat,
                                      double maxLng, double maxLat) {

        LatLng center = h3.cellToLatLng(cell);

        if (inBox(center.lat, center.lng, minLng, minLat, maxLng, maxLat)) {
            return true;
        }

        return h3.cellToBoundary(cell).stream().anyMatch(v -> inBox(v.lat, v.lng, minLng, minLat, maxLng, maxLat));
    }

    //экран втыкается в гексагон: любой из 4 углов прямоугольника попал в нашу клетку
    private boolean boxTouchesHexagon(String h3Index, int resolution,
                                      double minLng, double minLat,
                                      double maxLng, double maxLat) {

        return h3.latLngToCellAddress(minLat, minLng, resolution).equals(h3Index)
            || h3.latLngToCellAddress(minLat, maxLng, resolution).equals(h3Index)
            || h3.latLngToCellAddress(maxLat, maxLng, resolution).equals(h3Index)
            || h3.latLngToCellAddress(maxLat, minLng, resolution).equals(h3Index);
    }

    //координаты lat/lng внутри прямоугольника
    private boolean inBox(double lat, double lng,
                          double minLng, double minLat,
                          double maxLng, double maxLat) {

        return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
    }
}
