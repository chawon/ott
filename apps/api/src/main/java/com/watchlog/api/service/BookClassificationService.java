package com.watchlog.api.service;

import com.watchlog.api.data4library.Data4LibraryClient;
import com.watchlog.api.data4library.Data4LibraryUnavailableException;
import com.watchlog.api.domain.BookClassificationEntity;
import com.watchlog.api.domain.BookClassificationStatus;
import com.watchlog.api.dto.BookClassificationDto;
import com.watchlog.api.repo.BookClassificationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;

@Service
public class BookClassificationService {

    static final int MAX_BATCH_SIZE = 50;
    private static final long NOT_FOUND_TTL_DAYS = 30;

    private final BookClassificationRepository repository;
    private final Data4LibraryClient client;

    public BookClassificationService(
            BookClassificationRepository repository,
            Data4LibraryClient client
    ) {
        this.repository = repository;
        this.client = client;
    }

    public List<BookClassificationDto> resolve(List<String> requestedIsbn13s) {
        List<String> isbn13s = validateAndNormalize(requestedIsbn13s);
        OffsetDateTime now = OffsetDateTime.now();

        try {
            return isbn13s.stream()
                    .map(isbn13 -> resolveOne(isbn13, now))
                    .map(BookClassificationDto::from)
                    .toList();
        } catch (Data4LibraryUnavailableException exception) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Book classification is temporarily unavailable"
            );
        }
    }

    private BookClassificationEntity resolveOne(String isbn13, OffsetDateTime now) {
        Optional<BookClassificationEntity> cached = repository.findById(isbn13);
        if (cached.isPresent() && isFresh(cached.get(), now)) {
            return cached.get();
        }

        Optional<String> kdcCode = client.fetchKdcCode(isbn13);
        BookClassificationEntity entity = kdcCode
                .flatMap(BookClassificationService::kdcMajor)
                .map(major -> new BookClassificationEntity(
                        isbn13,
                        kdcCode.orElseThrow(),
                        major,
                        BookClassificationStatus.RESOLVED,
                        now
                ))
                .orElseGet(() -> new BookClassificationEntity(
                        isbn13,
                        null,
                        null,
                        BookClassificationStatus.NOT_FOUND,
                        now
                ));
        return repository.save(entity);
    }

    private static boolean isFresh(BookClassificationEntity entity, OffsetDateTime now) {
        if (entity.getStatus() == BookClassificationStatus.RESOLVED) {
            return true;
        }
        return entity.getFetchedAt().isAfter(now.minusDays(NOT_FOUND_TTL_DAYS));
    }

    static Optional<Integer> kdcMajor(String raw) {
        if (raw == null) {
            return Optional.empty();
        }
        String normalized = raw.trim();
        if (normalized.isEmpty() || !Character.isDigit(normalized.charAt(0))) {
            return Optional.empty();
        }
        int major = Character.digit(normalized.charAt(0), 10);
        return major >= 0 && major <= 9 ? Optional.of(major) : Optional.empty();
    }

    static List<String> validateAndNormalize(List<String> requested) {
        if (requested == null || requested.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "isbn13s is required");
        }
        if (requested.size() > MAX_BATCH_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "isbn13s accepts up to 50 items");
        }

        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        for (String raw : requested) {
            String isbn13 = raw == null ? "" : raw.replaceAll("[^0-9]", "");
            if (!isValidIsbn13(isbn13)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid ISBN13");
            }
            normalized.add(isbn13);
        }
        return List.copyOf(normalized);
    }

    static boolean isValidIsbn13(String value) {
        if (value == null || !value.matches("\\d{13}")) {
            return false;
        }
        int sum = 0;
        for (int index = 0; index < 12; index++) {
            int digit = value.charAt(index) - '0';
            sum += digit * (index % 2 == 0 ? 1 : 3);
        }
        int expectedCheckDigit = (10 - (sum % 10)) % 10;
        return expectedCheckDigit == value.charAt(12) - '0';
    }
}
