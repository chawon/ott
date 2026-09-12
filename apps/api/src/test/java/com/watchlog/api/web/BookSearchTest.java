package com.watchlog.api.web;

import com.watchlog.api.kakao.KakaoBookClient;
import com.watchlog.api.book.BookSearchService;
import com.watchlog.api.repo.TitleRepository;
import static org.mockito.Mockito.*;
import com.watchlog.api.kakao.KakaoProperties;
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
        var controller = new TitleController(null, null, new BookSearchService(client, mock(TitleRepository.class)));
        assertThat(controller.search("harry", "book", "ko")).singleElement().satisfies(book -> {
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
    }
}
