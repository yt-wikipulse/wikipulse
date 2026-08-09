package com.springboot.web.wikipulseproject.model.dto;

import java.util.List;

//один гексагон (hexagons[])
public record HexagonDto(
    String h3Index,
    long eventsCount,
    List<HexagonEventDto> events
) {}

