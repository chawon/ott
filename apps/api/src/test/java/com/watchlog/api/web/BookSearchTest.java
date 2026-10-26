package com.watchlog.api.web;

import com.watchlog.api.kakao.KakaoBookClient;
import com.watchlog.api.book.BookSearchService;
import com.watchlog.api.repo.TitleRepository;
import static org.mockito.Mockito.*;
import com.watchlog.api.kakao.KakaoProperties;
import com.watchlog.api.googlebooks.GoogleBooksClient;
import com.watchlog.api.googlebooks.GoogleBooksProperties;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class BookSearchTest {
    @Test
    void searchesKakaoAndKeepsTheBookResponseContract() {
        var builder = RestClient.builder().baseUrl("https://dapi.kakao.com");
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://dapi.kakao.com/v3/search/book?query=harry&size=10&page=1"))
                .andExpect(header("Authorization", "KakaoAK test-key"))
                .andRespond(withSuccess("""
                        {"documents":[{"title":"Harry Potter", "authors":["J. K. Rowling"],
                        "publisher":"Publisher", "isbn":"8983921986 9788983921987",
                        "datetime":"1999-11-15T00:00:00.000+09:00", "contents":"Book description",
                        "thumbnail":"https://example.com/book.jpg", "url":"https://example.com/book"}]}
                        """, MediaType.APPLICATION_JSON));
        var client = new KakaoBookClient(builder.build(), new KakaoProperties(null, "test-key"));
        var google = mock(GoogleBooksClient.class);
        var controller = new TitleController(null, null, new BookSearchService(client, google, mock(TitleRepository.class)));
        assertThat(controller.search("harry", "book", "ko", null, null)).singleElement().satisfies(book -> {
            assertThat(book.provider()).isEqualTo("KAKAO");
            assertThat(book.providerId()).isEqualTo("9788983921987");
            assertThat(book.name()).isEqualTo("Harry Potter");
            assertThat(book.author()).isEqualTo("J. K. Rowling");
            assertThat(book.pubdate()).isEqualTo("19991115");
            assertThat(book.year()).isEqualTo(1999);
            assertThat(book.isbn10()).isEqualTo("8983921986");
            assertThat(book.overview()).isEqualTo("Book description");
        });
        server.verify();
        verifyNoInteractions(google);
    }

    @Test
    void englishSearchUsesGoogleAndKeepsTheBookResponseContract() {
        var builder = RestClient.builder().baseUrl("https://www.googleapis.com");
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://www.googleapis.com/books/v1/volumes?q=Atomic%20Habits&langRestrict=en&printType=books&maxResults=10"))
                .andExpect(header("X-Goog-Api-Key", "test-key"))
                .andRespond(withSuccess("""
                        {"totalItems":1,"items":[{"id":"volume-1","volumeInfo":{
                        "title":"Atomic Habits","authors":["James Clear"],"publisher":"Avery",
                        "publishedDate":"2018-10-16","description":"Description",
                        "industryIdentifiers":[{"type":"ISBN_13","identifier":"9780735211292"}],
                        "imageLinks":{"thumbnail":"http://books.google.com/cover.jpg"}}}]}
                        """, MediaType.APPLICATION_JSON));
        var client = new GoogleBooksClient(builder.build(), new GoogleBooksProperties(null, "test-key"));
        var kakao = mock(KakaoBookClient.class);
        var controller = new TitleController(null, null, new BookSearchService(kakao, client, mock(TitleRepository.class)));
        assertThat(controller.search("Atomic Habits", "book", "en-US", null, null)).singleElement().satisfies(book -> {
            assertThat(book.provider()).isEqualTo("GOOGLE_BOOKS");
            assertThat(book.providerId()).isEqualTo("volume-1");
            assertThat(book.name()).isEqualTo("Atomic Habits");
            assertThat(book.author()).isEqualTo("James Clear");
            assertThat(book.publisher()).isEqualTo("Avery");
            assertThat(book.pubdate()).isEqualTo("20181016");
            assertThat(book.year()).isEqualTo(2018);
            assertThat(book.isbn10()).isEqualTo("0735211299");
            assertThat(book.isbn13()).isEqualTo("9780735211292");
            assertThat(book.posterUrl()).startsWith("https://");
            assertThat(book.sourceUrl()).isEqualTo("https://books.google.com/books?id=volume-1");
        });
        server.verify();
        verifyNoInteractions(kakao);
    }

    @Test
    void negotiatesSupportedLanguagesAndKeepsLegacyDefaultForInvalidHeaders() {
        for (String language : new String[]{"en", "EN-gb", "en-US,en;q=0.9,ko;q=0.8", "ko;q=0.5,en;q=0.9", "fr-CA,en;q=0.8"}) {
            assertProvider(language, true);
        }
        for (String language : new String[]{null, "", "ko", "ko-KR,en;q=0.9", "en;q=0,ko;q=0.8", "fr", "*", "bad_header", "english"}) {
            assertProvider(language, false);
        }
    }

    private void assertProvider(String language, boolean english) {
        var kakao = mock(KakaoBookClient.class);
        var google = mock(GoogleBooksClient.class);
        var controller = new TitleController(null, null, new BookSearchService(kakao, google, mock(TitleRepository.class)));
        assertThat(controller.search("book", "book", language, null, null)).isEmpty();
        if (english) {
            verify(google).search("book");
            verifyNoInteractions(kakao);
        } else {
            verify(kakao).search("book");
            verifyNoInteractions(google);
        }
    }

    @Test
    void nativeSearchWaitsForABinaryThatSupportsGoogleAttribution() {
        var kakao = mock(KakaoBookClient.class);
        var google = mock(GoogleBooksClient.class);
        var controller = new TitleController(null, null, new BookSearchService(kakao, google, mock(TitleRepository.class)));
        controller.search("book", "book", "en", "ios_native", null);
        verify(kakao).search("book");
        verifyNoInteractions(google);
        controller.search("book", "book", "en", "ios_native", "google_books_v1");
        verify(google).search("book");
    }
}
