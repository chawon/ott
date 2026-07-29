package com.watchlog.api.service;

import com.watchlog.api.data4library.Data4LibraryClient;
import com.watchlog.api.data4library.Data4LibraryUnavailableException;
import com.watchlog.api.domain.BookClassificationEntity;
import com.watchlog.api.domain.BookClassificationStatus;
import com.watchlog.api.repo.BookClassificationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class BookClassificationServiceTest {

    private BookClassificationRepository repository;
    private Data4LibraryClient client;
    private BookClassificationService service;

    @BeforeEach
    void setUp() {
        repository = mock(BookClassificationRepository.class);
        client = mock(Data4LibraryClient.class);
        service = new BookClassificationService(repository, client);
        when(repository.save(any(BookClassificationEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void resolvesKdcAndUsesItsFirstDigitAsMajorCategory() {
        when(repository.findById("9788983921987")).thenReturn(Optional.empty());
        when(client.fetchKdcCode("9788983921987")).thenReturn(Optional.of("813.7"));

        var result = service.resolve(List.of("9788983921987"));

        assertThat(result).singleElement().satisfies(item -> {
            assertThat(item.status()).isEqualTo(BookClassificationStatus.RESOLVED);
            assertThat(item.kdcCode()).isEqualTo("813.7");
            assertThat(item.kdcMajor()).isEqualTo(8);
        });
    }

    @Test
    void reusesResolvedCacheWithoutCallingUpstream() {
        var cached = new BookClassificationEntity(
                "9788983921987",
                "813.7",
                8,
                BookClassificationStatus.RESOLVED,
                OffsetDateTime.now().minusYears(1)
        );
        when(repository.findById("9788983921987")).thenReturn(Optional.of(cached));

        var result = service.resolve(List.of("9788983921987"));

        assertThat(result).singleElement().extracting("kdcMajor").isEqualTo(8);
        verify(client, never()).fetchKdcCode(any());
    }

    @Test
    void retriesExpiredNotFoundCache() {
        var cached = new BookClassificationEntity(
                "9788983921987",
                null,
                null,
                BookClassificationStatus.NOT_FOUND,
                OffsetDateTime.now().minusDays(31)
        );
        when(repository.findById("9788983921987")).thenReturn(Optional.of(cached));
        when(client.fetchKdcCode("9788983921987")).thenReturn(Optional.of("300"));

        var result = service.resolve(List.of("9788983921987"));

        assertThat(result).singleElement().extracting("kdcMajor").isEqualTo(3);
        verify(client).fetchKdcCode("9788983921987");
    }

    @Test
    void reusesFreshNotFoundCacheWithoutCallingUpstream() {
        var cached = new BookClassificationEntity(
                "9788983921987",
                null,
                null,
                BookClassificationStatus.NOT_FOUND,
                OffsetDateTime.now().minusDays(29)
        );
        when(repository.findById("9788983921987")).thenReturn(Optional.of(cached));

        var result = service.resolve(List.of("9788983921987"));

        assertThat(result).singleElement().extracting("status")
                .isEqualTo(BookClassificationStatus.NOT_FOUND);
        verify(client, never()).fetchKdcCode(any());
    }

    @Test
    void mapsUnavailableUpstreamToServiceUnavailable() {
        when(repository.findById("9788983921987")).thenReturn(Optional.empty());
        when(client.fetchKdcCode("9788983921987"))
                .thenThrow(new Data4LibraryUnavailableException("unavailable"));

        assertThatThrownBy(() -> service.resolve(List.of("9788983921987")))
                .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                        assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE)
                );
    }

    @Test
    void deduplicatesValidIsbnsAndRejectsInvalidChecksums() {
        assertThat(BookClassificationService.validateAndNormalize(List.of(
                "978-89-8392-198-7",
                "9788983921987"
        ))).containsExactly("9788983921987");

        assertThatThrownBy(() ->
                BookClassificationService.validateAndNormalize(List.of("9788983921988"))
        ).isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST)
        );
    }

    @Test
    void extractsOnlyValidKdcMajorCategories() {
        assertThat(BookClassificationService.kdcMajor("024.4")).contains(0);
        assertThat(BookClassificationService.kdcMajor("813.7")).contains(8);
        assertThat(BookClassificationService.kdcMajor(" KDC 없음 ")).isEmpty();
    }
}
