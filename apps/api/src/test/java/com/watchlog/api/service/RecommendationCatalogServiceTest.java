package com.watchlog.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.watchlog.api.book.BookSearchService;
import com.watchlog.api.domain.TitleType;
import com.watchlog.api.dto.TitleSearchItemDto;
import com.watchlog.api.kakao.KakaoBookClient;
import com.watchlog.api.llm.RecommendationItem;
import com.watchlog.api.tmdb.TmdbClient;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class RecommendationCatalogServiceTest {
    private final TmdbClient tmdb = mock(TmdbClient.class);
    private final BookSearchService books = mock(BookSearchService.class);
    private final KakaoBookClient kakao = mock(KakaoBookClient.class);
    private final RecommendationCatalogService catalog = new RecommendationCatalogService(tmdb, books, kakao);

    @Test
    void translatedVideoGetsARealIdentityAndAReusableCatalogSnapshot() throws Exception {
        when(tmdb.searchMulti("Interstellar", "ko")).thenReturn(List.of(hit("157336", "인터스텔라", "Interstellar", "2014-11-05")));
        var result = catalog.enrich(List.of(movie("Interstellar", 2014)), "ko").getFirst();
        assertThat(result.providerId()).isEqualTo("157336");
        assertThat(result.alternateNames()).contains("Interstellar", "인터스텔라");
        assertThat(result.catalogTitle().providerId()).isEqualTo("157336");
    }

    @Test
    void anUndatedSameNameHitCannotReplaceTheRecommendedEdition() throws Exception {
        var undated = hit("1561951", "Solaris", "Solaris", null);
        var correct = hit("593", "Solaris", "Солярис", "1972-03-20");
        when(tmdb.searchMulti("Solaris", "ko")).thenReturn(List.of(undated));
        when(tmdb.searchMulti("Solaris", "en")).thenReturn(List.of(undated, correct));
        assertThat(catalog.enrich(List.of(movie("Solaris", 1972)), "ko").getFirst().providerId()).isEqualTo("593");
    }

    @Test
    void festivalAndTheatricalYearDifferencesCanResolveTheSameTitle() throws Exception {
        when(tmdb.searchMulti("Ex Machina", "en")).thenReturn(List.of(hit("264660", "Ex Machina", "Ex Machina", "2015-01-21")));
        assertThat(catalog.enrich(List.of(movie("Ex Machina", 2014)), "en").getFirst().providerId()).isEqualTo("264660");
    }

    @Test
    void unknownOrAmbiguousCatalogResultsNeverInventAnIdentity() {
        var item = movie("Unknown Story", null);
        when(tmdb.searchMulti(anyString(), anyString())).thenThrow(new IllegalStateException("provider unavailable"));
        assertThat(catalog.enrich(List.of(item), "ko")).containsExactly(item);
    }

    @Test
    void translatedBookMetadataHelpsExclusionButKeepsEditionSelectionExplicit() {
        var item = book("Project Hail Mary", "Andy Weir / 앤디 위어", List.of("프로젝트 헤일메리"));
        var edition = new TitleSearchItemDto("KAKAO", "9788925588735", TitleType.book, "프로젝트 헤일메리", 2024, null,
                "A story", "앤디 위어", "Publisher", null, "9788925588735", "20240101");
        when(books.search("Project Hail Mary", "ko")).thenReturn(List.of(edition));
        var result = catalog.enrich(List.of(item), "ko").getFirst();
        assertThat(result.name()).isEqualTo("프로젝트 헤일메리");
        assertThat(result.originalName()).isEqualTo("Project Hail Mary");
        assertThat(result.isbn13()).isEqualTo("9788925588735");
        assertThat(result.catalogTitle()).isNull();
    }

    @Test
    void anEnglishBookCatalogCanUseExistingKakaoWhenGoogleCredentialsAreUnavailable() {
        when(books.search("Project Hail Mary", "en")).thenThrow(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE));
        var edition = new TitleSearchItemDto("KAKAO", "edition", TitleType.book, "Project Hail Mary", 2021, null, null, "Andy Weir", null, null, null, null);
        when(kakao.search("Project Hail Mary")).thenReturn(List.of(edition));
        assertThat(catalog.search("Project Hail Mary", "book", null, null, "en")).containsExactly(edition);
    }

    @Test
    void aSameNameBookByAnotherAuthorDoesNotReceiveTheWrongEdition() {
        when(books.search(anyString(), eq("ko"))).thenReturn(List.of(new TitleSearchItemDto("KAKAO", "other", TitleType.book,
                "A Story", 2020, null, null, "Another Author", null, null, null, null)));
        var item = book("A Story", "One Author", List.of());
        assertThat(catalog.enrich(List.of(item), "ko")).containsExactly(item);
    }

    private static RecommendationItem movie(String name, Integer year) {
        return new RecommendationItem(name, "movie", "A quiet connection", List.of(), null, null, null, year, List.of());
    }
    private static RecommendationItem book(String name, String author, List<String> aliases) {
        return new RecommendationItem(name, "book", "A few pages", List.of(), null, null, null, 2021, aliases, author, null, null, name, null);
    }
    private static TmdbClient.SearchItem hit(String id, String title, String original, String date) throws Exception {
        return new ObjectMapper().readValue(new ObjectMapper().writeValueAsString(java.util.Map.of("id", Long.parseLong(id), "media_type", "movie",
                "title", title, "original_title", original, "release_date", date == null ? "" : date)), TmdbClient.SearchItem.class);
    }
}
