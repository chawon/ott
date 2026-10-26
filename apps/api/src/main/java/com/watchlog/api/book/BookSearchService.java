package com.watchlog.api.book;

import com.watchlog.api.dto.TitleSearchItemDto;
import com.watchlog.api.kakao.KakaoBookClient;
import com.watchlog.api.googlebooks.GoogleBooksClient;
import com.watchlog.api.repo.TitleRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;

@Service
public class BookSearchService {
    private final KakaoBookClient kakao;
    private final GoogleBooksClient googleBooks;
    private final TitleRepository titles;

    public BookSearchService(KakaoBookClient kakao, GoogleBooksClient googleBooks, TitleRepository titles) {
        this.kakao = kakao;
        this.googleBooks = googleBooks;
        this.titles = titles;
    }

    public List<TitleSearchItemDto> search(String query, String language) {
        var results = prefersEnglish(language) ? googleBooks.search(query) : kakao.search(query);
        return results.stream().map(item -> titles.resolveExternalTitle(
                        item.provider(), item.providerId(), item.type(), item.isbn10(), item.isbn13())
                .map(existing -> new TitleSearchItemDto(existing.getProvider(), existing.getProviderId(),
                        item.type(), item.name(), item.year(), item.posterUrl(), item.overview(), item.author(),
                        item.publisher(), item.isbn10(), item.isbn13(), item.pubdate(), existing.getId(), item.sourceUrl()))
                .orElse(item)).toList();
    }

    private static boolean prefersEnglish(String language) {
        if (language == null || language.isBlank()) return false;
        try {
            return Locale.ENGLISH.equals(Locale.lookup(Locale.LanguageRange.parse(language),
                    List.of(Locale.KOREAN, Locale.ENGLISH)));
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }
}
