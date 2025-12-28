package com.watchlog.api.service;

import com.watchlog.api.domain.TitleEntity;
import com.watchlog.api.domain.TitleType;
import com.watchlog.api.repo.TitleRepository;
import com.watchlog.api.tmdb.TmdbClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class TitleService {
    private final TitleRepository titleRepository;
    private final TmdbClient tmdbClient;

    public TitleService(TitleRepository titleRepository, TmdbClient tmdbClient) {
        this.titleRepository = titleRepository;
        this.tmdbClient = tmdbClient;
    }

    @Transactional(readOnly = true)
    public List<TitleEntity> search(String q) {
        String query = q == null ? "" : q.trim();
        if (query.isEmpty()) return List.of();
        return titleRepository.findTop10ByNameContainingIgnoreCaseOrderByNameAsc(query);
    }

    @Transactional(readOnly = true)
    public TitleEntity require(UUID id) {
        return titleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Title not found: " + id));
    }

    @Transactional
    public TitleEntity createIfNeeded(TitleType type, String name, Integer year, List<String> genres) {
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("titleName is required when titleId is missing");
        }
        var entity = new TitleEntity(UUID.randomUUID(), type == null ? TitleType.movie : type, name.trim());
        entity.setYear(year);
        if (genres != null) entity.setGenres(genres.toArray(String[]::new));
        entity.setUpdatedAt(java.time.OffsetDateTime.now());
        return titleRepository.save(entity);
    }

    @Transactional
    public TitleEntity upsertFromTmdb(String providerId, com.watchlog.api.domain.TitleType type) {
        var snapshot = tmdbClient.fetchDetails(type, providerId);

        var existing = titleRepository.findByProviderAndProviderId("TMDB", providerId);
        if (existing.isPresent()) {
            var t = existing.get();
            t.setProvider("TMDB");
            t.setProviderId(providerId);
            t.setYear(snapshot.year());
            t.setOverview(snapshot.overview());
            t.setPosterUrl(snapshot.posterUrl());
            if (snapshot.genres() != null) t.setGenres(snapshot.genres().toArray(String[]::new));
            if (snapshot.directors() != null) t.setDirectors(snapshot.directors().toArray(String[]::new));
            if (snapshot.cast() != null) t.setCastNames(snapshot.cast().toArray(String[]::new));
            t.setUpdatedAt(java.time.OffsetDateTime.now());
            return t;
        }

        var created = new TitleEntity(java.util.UUID.randomUUID(), snapshot.type(), snapshot.name());
        created.setProvider("TMDB");
        created.setProviderId(providerId);
        created.setYear(snapshot.year());
        created.setOverview(snapshot.overview());
        created.setPosterUrl(snapshot.posterUrl());
        if (snapshot.genres() != null) created.setGenres(snapshot.genres().toArray(String[]::new));
        if (snapshot.directors() != null) created.setDirectors(snapshot.directors().toArray(String[]::new));
        if (snapshot.cast() != null) created.setCastNames(snapshot.cast().toArray(String[]::new));
        created.setUpdatedAt(java.time.OffsetDateTime.now());
        return titleRepository.save(created);
    }
}
