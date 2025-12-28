package com.watchlog.api.service;

import com.watchlog.api.domain.Status;
import com.watchlog.api.dto.TitleDto;
import com.watchlog.api.repo.TitleRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class RecommendationService {

    private final TitleRepository titleRepository;
    private final LogService logService;

    public RecommendationService(TitleRepository titleRepository, LogService logService) {
        this.titleRepository = titleRepository;
        this.logService = logService;
    }

    @Transactional(readOnly = true)
    public List<TitleDto> recommend(int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 50));

        var logs = logService.list(null, null, null, null, null, 200, null);

        var seenTitleIds = logs.stream()
                .map(l -> l.getTitle().getId())
                .collect(Collectors.toSet());

        var seeds = logs.stream()
                .filter(l -> l.getStatus() == Status.DONE)
                .filter(l -> l.getRating() != null && l.getRating().doubleValue() >= 4.0)
                .limit(5)
                .toList();

        var genreWeight = new HashMap<String, Integer>();
        for (var s : seeds) {
            for (var g : s.getTitle().getGenres()) {
                if (g == null || g.isBlank()) continue;
                genreWeight.merge(g, 1, Integer::sum);
            }
        }

        var allTitles = titleRepository.findAll();
        var candidates = allTitles.stream()
                .filter(t -> !seenTitleIds.contains(t.getId()))
                .toList();

        Comparator<UUID> stable = Comparator.comparing(UUID::toString);

        var ranked = candidates.stream()
                .map(t -> Map.entry(t, score(t.getGenres(), genreWeight)))
                .sorted((a, b) -> {
                    int byScore = Integer.compare(b.getValue(), a.getValue());
                    if (byScore != 0) return byScore;
                    return stable.compare(a.getKey().getId(), b.getKey().getId());
                })
                .limit(safeLimit)
                .map(e -> TitleDto.from(e.getKey()))
                .toList();

        if (!ranked.isEmpty()) return ranked;

        return allTitles.stream()
                .filter(t -> !seenTitleIds.contains(t.getId()))
                .limit(safeLimit)
                .map(TitleDto::from)
                .toList();
    }

    private int score(String[] genres, Map<String, Integer> genreWeight) {
        if (genres == null) return 0;
        int s = 0;
        for (var g : genres) {
            if (g == null) continue;
            s += genreWeight.getOrDefault(g, 0);
        }
        return s;
    }
}
