package tech.wikipulse.backend.error;

public class YtReadException extends RuntimeException {
    public YtReadException(String message, Throwable cause) {
        super(message, cause);
    }
}
