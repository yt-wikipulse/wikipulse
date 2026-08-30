package tech.wikipulse.backend.model.dto;

import java.util.List;

public record HexagonDto(
    String h3Index,
    long eventsCount,
    List<HexagonEventDto> events
) {}

