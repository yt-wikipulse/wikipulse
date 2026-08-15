package com.springboot.web.wikipulseproject.error;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BadRequestException.class)
    public ProblemDetail handleBadRequest(BadRequestException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, e.getMessage());
    }

    @ExceptionHandler(YtReadException.class)
    public ProblemDetail handleYtRead(YtReadException e) {
        log.error("Не удалось прочитать YT", e);

        return ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE, "data source temporarily unavailable, try again");
    }

}
