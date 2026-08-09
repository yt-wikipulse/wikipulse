package com.springboot.web.wikipulseproject.service;

import com.springboot.web.wikipulseproject.controller.LiveMapController;
import com.springboot.web.wikipulseproject.model.dto.HexagonDto;
import com.uber.h3core.H3Core;
import com.uber.h3core.util.LatLng;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DemoHexagonServiceTest {

    private final H3Core h3 = h3Core();
    private final DemoHexagonService service = new DemoHexagonService(h3);

    @Test
    void returnsStableSparseHexagonsThatTouchBbox() {
        List<HexagonDto> hexagons = service.getHexagons(37.2, 55.4, 38.0, 56.1, 6);

        assertFalse(hexagons.isEmpty());
        assertTrue(hexagons.size() < 37);
        assertEquals(hexagons, service.getHexagons(37.2, 55.4, 38.0, 56.1, 6));

        String h3Index = hexagons.get(0).h3Index();
        List<LatLng> boundary = h3.cellToBoundary(h3Index);
        LatLng vertex = boundary.get(0);
        List<HexagonDto> touchingVertex = service.getHexagons(
            vertex.lng - 0.0001,
            vertex.lat - 0.0001,
            vertex.lng + 0.0001,
            vertex.lat + 0.0001,
            6
        );

        assertTrue(touchingVertex.stream().anyMatch(hexagon -> hexagon.h3Index().equals(h3Index)));
        LatLng center = h3.cellToLatLng(h3Index);
        assertFalse(center.lng >= vertex.lng - 0.0001
            && center.lng <= vertex.lng + 0.0001
            && center.lat >= vertex.lat - 0.0001
            && center.lat <= vertex.lat + 0.0001);

        double cellMaxLng = boundary.stream().mapToDouble(point -> point.lng).max().orElseThrow();
        List<HexagonDto> fullyOutside = service.getHexagons(
            cellMaxLng + 0.001,
            center.lat - 0.0001,
            cellMaxLng + 0.002,
            center.lat + 0.0001,
            6
        );
        assertFalse(fullyOutside.stream().anyMatch(hexagon -> hexagon.h3Index().equals(h3Index)));
    }

    @Test
    void usesConfiguredZoomThresholds() {
        LiveMapController controller = new LiveMapController(service, 7, 13);

        assertResolution(controller, 7, 3);
        assertResolution(controller, 8, 6);
        assertResolution(controller, 13, 6);
        assertResolution(controller, 14, 9);
    }

    private void assertResolution(LiveMapController controller, int zoom, int expectedResolution) {
        List<HexagonDto> hexagons = controller.active(-180, -85, 180, 85, zoom).hexagons();
        assertFalse(hexagons.isEmpty());
        assertTrue(hexagons.stream().allMatch(hexagon -> h3.getResolution(hexagon.h3Index()) == expectedResolution));
        assertEquals(expectedResolution, h3.getResolution(hexagons.get(0).h3Index()));
    }

    private static H3Core h3Core() {
        try {
            return H3Core.newInstance();
        } catch (IOException exception) {
            throw new IllegalStateException(exception);
        }
    }
}
