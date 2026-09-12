package com.watchlog.api.book;

import com.watchlog.api.dto.TitleSearchItemDto;
import com.watchlog.api.kakao.KakaoBookClient;
import com.watchlog.api.repo.TitleRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class BookSearchService {
    private final KakaoBookClient client;
    private final TitleRepository titles;

    public BookSearchService(KakaoBookClient client, TitleRepository titles) {
        this.client = client;
        this.titles = titles;
    }

    public List<TitleSearchItemDto> search(String query) {
        return client.search(query).stream().map(item -> titles.resolveExternalTitle(
                        item.provider(), item.providerId(), item.type(), item.isbn10(), item.isbn13())
                .map(existing -> new TitleSearchItemDto(existing.getProvider(), existing.getProviderId(),
                        item.type(), item.name(), item.year(), item.posterUrl(), item.overview(), item.author(),
                        item.publisher(), item.isbn10(), item.isbn13(), item.pubdate(), existing.getId()))
                .orElse(item)).toList();
    }
}
