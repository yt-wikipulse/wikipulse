package com.springboot.web.wikipulseproject.model.dto;

//одна правка внутри гексагона (events[])
public record HexagonEventDto(
    String id,
    String title,
    String url,
    long lengthUpdate,
    String diffUrl,
    long eventTs
) {}
