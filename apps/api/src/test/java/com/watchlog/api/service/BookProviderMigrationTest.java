package com.watchlog.api.service;

import com.watchlog.api.book.BookSearchService;
import com.watchlog.api.domain.TitleEntity;
import com.watchlog.api.domain.TitleType;
import com.watchlog.api.domain.Status;
import com.watchlog.api.domain.WatchLogEntity;
import com.watchlog.api.dto.*;
import com.watchlog.api.kakao.KakaoBookClient;
import com.watchlog.api.googlebooks.GoogleBooksClient;
import com.watchlog.api.repo.TitleRepository;
import com.watchlog.api.repo.WatchLogRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class BookProviderMigrationTest {
    private final TitleRepository titles = mock(TitleRepository.class, CALLS_REAL_METHODS);
    private final TitleEntity legacy = new TitleEntity(UUID.randomUUID(), TitleType.book, "Existing book");

    private void seedLegacyEdition() {
        legacy.setProvider("NAVER");
        legacy.setProviderId("8983921986");
        when(titles.findByProviderAndProviderId(anyString(), anyString())).thenReturn(Optional.empty());
        when(titles.findBookEdition("8983921986", "9788983921987")).thenReturn(List.of(legacy));
    }

    @Test
    void searchReturnsTheExistingTitleIdAndIdentity() {
        seedLegacyEdition();
        var client = mock(KakaoBookClient.class);
        when(client.search("book")).thenReturn(List.of(new TitleSearchItemDto("KAKAO", "9788983921987",
                TitleType.book, "New metadata", 1999, null, null, null, null, null, "9788983921987", null)));
        assertThat(new BookSearchService(client, null, titles).search("book", "ko")).singleElement().satisfies(book -> {
            assertThat(book.titleId()).isEqualTo(legacy.getId());
            assertThat(book.provider()).isEqualTo("NAVER");
            assertThat(book.providerId()).isEqualTo("8983921986");
            assertThat(book.name()).isEqualTo("New metadata");
        });
    }

    @ParameterizedTest
    @ValueSource(strings = {"KAKAO", "GOOGLE_BOOKS"})
    void directSaveReusesLegacyIdentityWithoutCreatingAnotherBook(String provider) {
        seedLegacyEdition();
        var service = new TitleService(titles, null);
        var result = service.upsertFromSnapshot(provider, provider.equals("GOOGLE_BOOKS") ? "google-volume" : "9788983921987", TitleType.book, "New metadata",
                1999, null, null, null, null, null, null, "9788983921987", "19991115");
        assertThat(result.getId()).isEqualTo(legacy.getId());
        assertThat(result.getProvider()).isEqualTo("NAVER");
        verify(titles, never()).save(any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"KAKAO", "GOOGLE_BOOKS"})
    void offlineSyncReusesLegacyBookEvenWithOnlyIsbn10(String provider) {
        seedLegacyEdition();
        var incomingId = UUID.randomUUID();
        var incomingLogId = UUID.randomUUID();
        var timestamp = OffsetDateTime.now();
        var payload = new SyncTitlePayload(TitleType.book, "New metadata", null, null, null, null,
                null, null, null, null, "8983921986", null, null, provider,
                provider.equals("GOOGLE_BOOKS") ? "google-volume" : "8983921986");
        var logPayload = new SyncLogPayload(incomingId, Status.DONE, null, "My note", false, null,
                null, null, null, null, null, timestamp, null, null);
        var request = new SyncPushRequest(null, "test-device", timestamp,
                new SyncChanges(List.of(new SyncChange<>(incomingLogId, "upsert", timestamp, logPayload)),
                        List.of(new SyncChange<>(incomingId, "upsert", timestamp, payload))));
        var logs = mock(WatchLogRepository.class);
        when(titles.findById(legacy.getId())).thenReturn(Optional.of(legacy));
        var service = new SyncService(titles, logs, mock(WatchLogHistoryService.class), null);
        assertThat(service.push(request, "ko").accepted()).contains(incomingId, incomingLogId);
        var savedLog = org.mockito.ArgumentCaptor.forClass(WatchLogEntity.class);
        verify(logs).save(savedLog.capture());
        assertThat(savedLog.getValue().getTitle().getId()).isEqualTo(legacy.getId());
        assertThat(savedLog.getValue().getNote()).isEqualTo("My note");
        assertThat(legacy.getName()).isEqualTo("New metadata");
        assertThat(legacy.getProvider()).isEqualTo("NAVER");
        verify(titles, never()).save(any());
    }

    @Test
    void differentEditionAndNonBookTypesAreNotMerged() {
        seedLegacyEdition();
        assertThat(titles.resolveExternalTitle("KAKAO", "9788983927620", TitleType.book, null, "9788983927620")).isEmpty();
        assertThat(titles.resolveExternalTitle("TMDB", "9788983921987", TitleType.movie, null, "9788983921987")).isEmpty();
        assertThat(titles.resolveExternalTitle("GOOGLE_BOOKS", "other-volume", TitleType.book, null, "9788983927620")).isEmpty();
        assertThat(titles.resolveExternalTitle("GOOGLE_BOOKS", "9788983921987", TitleType.book, null, null)).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"KAKAO", "GOOGLE_BOOKS"})
    void oldNativeLocalFallbackCannotReplaceTheCanonicalBookProvider(String provider) {
        seedLegacyEdition();
        legacy.setProvider(provider);
        String providerId = provider.equals("GOOGLE_BOOKS") ? "google-volume" : "9788983921987";
        legacy.setProviderId(providerId);
        when(titles.findById(legacy.getId())).thenReturn(Optional.of(legacy));
        var timestamp = OffsetDateTime.now();
        var payload = new SyncTitlePayload(TitleType.book, "Existing book", null, null, null, null,
                null, null, null, null, null, null, null, "LOCAL", "9788983921987");
        var request = new SyncPushRequest(null, "old-native", timestamp, new SyncChanges(List.of(),
                List.of(new SyncChange<>(legacy.getId(), "upsert", timestamp, payload))));
        var service = new SyncService(titles, mock(WatchLogRepository.class), mock(WatchLogHistoryService.class), null);
        assertThat(service.push(request, "ko").accepted()).contains(legacy.getId());
        assertThat(legacy.getProvider()).isEqualTo(provider);
        assertThat(legacy.getProviderId()).isEqualTo(providerId);
    }

    @Test
    void googleSearchReturnsExistingCanonicalIdentityAndUnmatchedVolumeIdentity() {
        seedLegacyEdition();
        var google = mock(GoogleBooksClient.class);
        var edition = new TitleSearchItemDto("GOOGLE_BOOKS", "google-volume", TitleType.book, "New metadata",
                1999, null, null, null, null, "8983921986", "9788983921987", "1999", null,
                "https://books.google.com/books?id=google-volume");
        var noIsbn = new TitleSearchItemDto("GOOGLE_BOOKS", "no-isbn-volume", TitleType.book, "No ISBN",
                null, null, null, null, null, null, null, null);
        when(google.search("book")).thenReturn(List.of(edition, noIsbn));
        var results = new BookSearchService(null, google, titles).search("book", "en");
        assertThat(results.getFirst().titleId()).isEqualTo(legacy.getId());
        assertThat(results.getFirst().provider()).isEqualTo("NAVER");
        assertThat(results.getFirst().providerId()).isEqualTo("8983921986");
        assertThat(results.getFirst().sourceUrl()).isEqualTo(edition.sourceUrl());
        assertThat(results.get(1)).isEqualTo(noIsbn);
    }

    @Test
    void newGoogleBookWithoutIsbnCanBeSavedAndInferredAsBook() {
        when(titles.save(any(TitleEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        var result = new TitleService(titles, null).upsertFromSnapshot("GOOGLE_BOOKS", "opaque-volume", null,
                "No ISBN", 2020, null, null, null, "Author", null, null, null, "2020");
        assertThat(result.getType()).isEqualTo(TitleType.book);
        assertThat(result.getProviderId()).isEqualTo("opaque-volume");
        assertThat(result.getIsbn13()).isNull();
    }
}
