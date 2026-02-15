package com.watchlog.api.service;

import com.watchlog.api.domain.DiscussionEntity;
import com.watchlog.api.domain.TitleEntity;
import com.watchlog.api.repo.DiscussionRepository;
import com.watchlog.api.repo.WatchLogRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class DiscussionService {
    public record SeasonMeta(String posterUrl, Integer seasonYear) {}

    private final DiscussionRepository discussionRepository;
    private final WatchLogRepository watchLogRepository;

    public DiscussionService(DiscussionRepository discussionRepository, WatchLogRepository watchLogRepository) {
        this.discussionRepository = discussionRepository;
        this.watchLogRepository = watchLogRepository;
    }

    @Transactional
    public DiscussionEntity ensureForTitle(TitleEntity title) {
        return discussionRepository.findByTitle_Id(title.getId())
                .orElseGet(() -> discussionRepository.save(new DiscussionEntity(UUID.randomUUID(), title)));
    }

    @Transactional(readOnly = true)
    public DiscussionEntity require(UUID id) {
        return discussionRepository.findByIdWithTitle(id)
                .orElseThrow(() -> new IllegalArgumentException("Discussion not found: " + id));
    }

    @Transactional(readOnly = true)
    public DiscussionEntity findByTitle(UUID titleId) {
        return discussionRepository.findByTitle_Id(titleId).orElse(null);
    }


    @Transactional(readOnly = true)
    public List<DiscussionEntity> listLatest(int limit) {
        return listLatest(limit, null, null);
    }

    @Transactional(readOnly = true)
    public List<DiscussionEntity> listLatest(int limit, Integer minComments, Integer days) {
        int safeLimit = Math.max(1, Math.min(limit, 100));
        Integer safeMin = (minComments == null) ? null : Math.max(0, minComments);
        Integer safeDays = (days == null) ? null : Math.max(1, days);
        var since = (safeDays == null) ? null : java.time.OffsetDateTime.now().minusDays(safeDays);
        var ids = discussionRepository.findLatestIds(since, safeMin, PageRequest.of(0, safeLimit));
        if (ids.isEmpty()) return List.of();
        var items = discussionRepository.findByIdInWithTitle(ids);
        var index = new java.util.HashMap<java.util.UUID, Integer>();
        for (int i = 0; i < ids.size(); i++) {
            index.put(ids.get(i), i);
        }
        items.sort(java.util.Comparator.comparingInt(d -> index.getOrDefault(d.getId(), Integer.MAX_VALUE)));
        return items;
    }

    @Transactional
    public DiscussionEntity lock(UUID id) {
        return discussionRepository.findWithLockById(id)
                .orElseThrow(() -> new IllegalArgumentException("Discussion not found: " + id));
    }

    @Transactional(readOnly = true)
    public Map<UUID, SeasonMeta> findLatestSeasonMetaByTitleIds(List<UUID> titleIds) {
        if (titleIds == null || titleIds.isEmpty()) return Map.of();
        var rows = watchLogRepository.findLatestSeasonMetaByTitleIds(titleIds);
        return rows.stream()
                .filter(row -> row.length >= 3 && row[0] instanceof UUID)
                .collect(Collectors.toMap(
                        row -> (UUID) row[0],
                        row -> new SeasonMeta(
                                row[1] instanceof String ? (String) row[1] : null,
                                row[2] instanceof Number ? ((Number) row[2]).intValue() : null
                        ),
                        (a, b) -> a
                ));
    }
}
