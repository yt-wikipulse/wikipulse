package com.springboot.web.wikipulseproject.error;

/** Кидаем, когда фронт прислал кривые параметры (resolution=5, window=99h...). */
public class BadRequestException extends RuntimeException {
    public BadRequestException(String message) {
        super(message);
    }
}
