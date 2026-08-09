package com.springboot.web.wikipulseproject.model.dto;

import java.util.List;

//весь ответ /api/v1/hexagons/...
public record ActiveHexagonsResponse(
    List<HexagonDto> hexagons
) {}

