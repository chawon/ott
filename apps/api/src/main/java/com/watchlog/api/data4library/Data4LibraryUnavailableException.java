package com.watchlog.api.data4library;

public class Data4LibraryUnavailableException extends RuntimeException {

    public Data4LibraryUnavailableException(String message) {
        super(message);
    }

    public Data4LibraryUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
