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

    /** зум нашей карты - чем сильне мы приблизили тем меньше шестиугольник видим */
    public int resolutionZoom(int zoom) {
        if (zoom <= zoomR3Max) return 3;
        if (zoom <= zoomR6Max) return 6;
        return 9;
    }

    /** в какой клетке resolution лежит R9 клетка? */
    public String cellToParent(String h3R9, int resolution) {
        long cell = h3.stringToH3(h3R9);
        long parent = h3.cellToParent(cell, resolution);
        return h3.h3ToString(parent);
    }

    /** попадает ли центр */
    public boolean centerInBox(String h3Index,
                               double minLng, double minLat,
                               double maxLng, double maxLat) {

        LatLng center = h3.cellToLatLng(h3.stringToH3(h3Index));
        return center.lat >= minLat && center.lat <= maxLat && center.lng >= minLng && center.lng <= maxLng;
    }

    /** точка (lat, lng) строковая R9 клетка понадобится поллеру */
    public String latLngToR9(double lat, double lng) {
        return h3.h3ToString(h3.latLngToCell(lat, lng, 9));
    }
}
