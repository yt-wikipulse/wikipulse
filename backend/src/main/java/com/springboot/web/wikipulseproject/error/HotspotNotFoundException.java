package com.springboot.web.wikipulseproject.error;

/** Кидаем, когда в текущем окне нет активности по ячейке h3 (контракт требует 404). */
public class HotspotNotFoundException extends RuntimeException {
    private final String h3;

    public HotspotNotFoundException(String h3) {
        super(h3);
        this.h3 = h3;
    }

    public String h3() {
        return h3;
    }
}