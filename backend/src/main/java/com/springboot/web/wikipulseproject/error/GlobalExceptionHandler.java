package com.springboot.web.wikipulseproject.error;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BadRequestException.class)
    public ProblemDetail handleBadRequest(BadRequestException e) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST); // status 400
        problem.setTitle("Bad Request");
        problem.setDetail(e.getMessage());   // "resolution must be 6 or 9"
        return problem;
    }

    @ExceptionHandler(HotspotNotFoundException.class)
    public ProblemDetail handleHotspotNotFound(HotspotNotFoundException e) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);   // status 404
        problem.setTitle("Not Found");
        problem.setDetail("h3 cell " + e.h3() + " has no activity in current window");
        return problem;
    }
}
