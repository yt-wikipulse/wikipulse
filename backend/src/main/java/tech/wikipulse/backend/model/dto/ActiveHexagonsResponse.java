package tech.wikipulse.backend.model.dto;

import java.util.List;

public record ActiveHexagonsResponse(
    List<HexagonDto> hexagons
) {}

