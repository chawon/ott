package com.watchlog.api.service;

import com.watchlog.api.book.BookSearchService;
import com.watchlog.api.domain.TitleEntity;
import com.watchlog.api.domain.TitleType;
import com.watchlog.api.domain.Status;
import com.watchlog.api.domain.WatchLogEntity;
import com.watchlog.api.dto.*;
import com.watchlog.api.kakao.KakaoBookClient;
import com.watchlog.api.repo.TitleRepository;
import com.watchlog.api.repo.WatchLogRepository;
import org.junit.jupiter.api.Test;

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
        assertThat(new BookSearchService(client, titles).search("book")).singleElement().satisfies(book -> {
            assertThat(book.titleId()).isEqualTo(legacy.getId());
            assertThat(book.provider()).isEqualTo("NAVER");
            assertThat(book.providerId()).isEqualTo("8983921986");
            assertThat(book.name()).isEqualTo("New metadata");
        });
    }

    @Test
    void directSaveReusesLegacyIdentityWithoutCreatingAnotherBook() {
        seedLegacyEdition();
        var service = new TitleService(titles, null);
        var result = service.upsertFromSnapshot("KAKAO", "9788983921987", TitleType.book, "New metadata",
                1999, null, null, null, null, null, null, "9788983921987", "19991115");
        assertThat(result.getId()).isEqualTo(legacy.getId());
        assertThat(result.getProvider()).isEqualTo("NAVER");
        verify(titles, never()).save(any());
    }

    @Test
    void offlineSyncReusesLegacyBookEvenWithOnlyIsbn10() {
        seedLegacyEdition();
        var incomingId = UUID.randomUUID();
        var incomingLogId = UUID.randomUUID();
        var timestamp = OffsetDateTime.now();
        var payload = new SyncTitlePayload(TitleType.book, "New metadata", null, null, null, null,
                null, null, null, null, "8983921986", null, null, "KAKAO", "8983921986");
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
    }

    @Test
    void oldNativeLocalFallbackCannotReplaceTheCanonicalBookProvider() {
        seedLegacyEdition();
        legacy.setProvider("KAKAO");
        legacy.setProviderId("9788983921987");
        when(titles.findById(legacy.getId())).thenReturn(Optional.of(legacy));
        var timestamp = OffsetDateTime.now();
        var payload = new SyncTitlePayload(TitleType.book, "Existing book", null, null, null, null,
                null, null, null, null, null, null, null, "LOCAL", "9788983921987");
        var request = new SyncPushRequest(null, "old-native", timestamp, new SyncChanges(List.of(),
                List.of(new SyncChange<>(legacy.getId(), "upsert", timestamp, payload))));
        var service = new SyncService(titles, mock(WatchLogRepository.class), mock(WatchLogHistoryService.class), null);
        assertThat(service.push(request, "ko").accepted()).contains(legacy.getId());
        assertThat(legacy.getProvider()).isEqualTo("KAKAO");
        assertThat(legacy.getProviderId()).isEqualTo("9788983921987");
    }
}
