package com.watchlog.api.dto;

public record NetflixImportResult(int received, int inserted, int alreadyImported, int linked) {}
