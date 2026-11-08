package com.watchlog.api.service;

import com.watchlog.api.domain.*;
import com.watchlog.api.llm.RecommendationItem;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

class RecommendationTitleMatcherTest {
    @Test
    void tmdbMovieAndSeriesHaveDifferentNamespacesEvenWithTheSameNumericId() {
        assertThat(RecommendationTitleMatcher.matches(video("A Story", "movie", "7"), video("A Story", "series", "7"))).isFalse();
        assertThat(RecommendationTitleMatcher.matches(video("A Story", "movie", "7"), video("A Story", "movie", "8"))).isFalse();
    }

    @Test
    void bookEditionsWithKnownAliasesAndTheSameAuthorAreTheSameWork() {
        var original = book("Harry Potter", "J. K. Rowling / J.K. 롤링", "9788983921987", 1997, "Harry Potter", List.of("해리 포터"));
        var translated = book("해리 포터", "J.K. 롤링", "9788983927620", 2025, "Harry Potter", List.of());
        assertThat(RecommendationTitleMatcher.matches(original, translated)).isTrue();
    }

    @Test
    void isbn10And13ResolveTheSameEditionAcrossProviders() {
        var first = book("One title", "One Author", null, 2000, null, List.of());
        first = new RecommendationItem(first.name(), first.type(), first.reason(), first.genres(), null, "NAVER", "legacy", first.year(), first.alternateNames(),
                first.author(), "8983921986", null, null, null);
        var second = book("A localized title", "Another localized author form", "9788983921987", 2024, null, List.of());
        assertThat(RecommendationTitleMatcher.matches(first, second)).isTrue();
    }

    @Test
    void sameNameBooksByDifferentAuthorsDoNotMatch() {
        assertThat(RecommendationTitleMatcher.matches(book("A Story", "One Author", null, 2020, null, List.of()),
                book("A Story", "Another Author", null, 2020, null, List.of()))).isFalse();
    }

    @Test
    void legacyUntypedNamesKeepTheirOriginalMeaningAndUnicodeNormalization() {
        var legacy = new RecommendationItem(" already seen ", null, "", List.of(), null);
        assertThat(RecommendationTitleMatcher.matches(legacy, new RecommendationItem("Ａｌｒｅａｄｙ—Ｓｅｅｎ", "book", "", List.of(), null))).isTrue();
    }

    @Test
    void knownBookWorkKeysDoNotChangeWithTheEditionOrDisplayLanguage() {
        var first = book("Harry Potter", "J. K. Rowling / J.K. 롤링", "9788983921987", 1997, "Harry Potter", List.of());
        var second = book("해리 포터", "J. K. Rowling / J.K. 롤링", "9788983927620", 2025, "Harry Potter", List.of());
        assertThat(RecommendationTitleMatcher.key(first)).isEqualTo(RecommendationTitleMatcher.key(second));
        assertThat(RecommendationTitleMatcher.key(first)).matches("[a-f0-9]{64}");
    }

    @Test
    void recordedBooksUseAuthorAndAliasesAcrossEditionYears() {
        var recorded = new TitleEntity(UUID.randomUUID(), TitleType.book, "해리 포터");
        recorded.setYear(2024);
        recorded.setAuthor("J.K. 롤링");
        var candidate = book("Harry Potter", "J. K. Rowling / J.K. 롤링", null, 1997, "Harry Potter", List.of("해리 포터"));
        assertThat(RecommendationTitleMatcher.filter(List.of(candidate), List.of(recorded), List.of())).isEmpty();
    }

    private static RecommendationItem video(String name, String type, String id) {
        return new RecommendationItem(name, type, "A story", List.of(), null, "TMDB", id, 2020, List.of());
    }
    private static RecommendationItem book(String name, String author, String isbn, int year, String original, List<String> aliases) {
        return new RecommendationItem(name, "book", "A few pages", List.of(), null, "KAKAO", isbn, year, aliases, author, null, isbn, original, null);
    }
}
