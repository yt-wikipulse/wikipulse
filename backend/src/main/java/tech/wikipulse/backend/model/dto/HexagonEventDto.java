package tech.wikipulse.backend.model.dto;

public record HexagonEventDto(
    String id,
    String title,
    String url,
    long lengthUpdate,
    String diffUrl,
    long eventTs
) {}
