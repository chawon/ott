package com.watchlog.api.service;

import com.watchlog.api.domain.WatchLogEntity;
import com.watchlog.api.domain.WatchLogHistoryEntity;
import com.watchlog.api.repo.WatchLogHistoryRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class WatchLogHistoryService {

    private final WatchLogHistoryRepository repo;

    public WatchLogHistoryService(WatchLogHistoryRepository repo) {
        this.repo = repo;
    }

    @Transactional
    public void recordSnapshot(WatchLogEntity log) {
        var h = new WatchLogHistoryEntity(UUID.randomUUID(), log);
        h.setRecordedAt(OffsetDateTime.now());
        h.setStatus(log.getStatus());
        h.setRating(log.getRating());
        h.setNote(log.getNote());
        h.setSpoiler(log.isSpoiler());
        h.setOtt(log.getOtt());
        h.setWatchedAt(log.getWatchedAt());
        h.setPlace(log.getPlace());
        h.setOccasion(log.getOccasion());
        repo.save(h);
    }

    @Transactional(readOnly = true)
    public List<WatchLogHistoryEntity> list(UUID logId, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 200));
        return repo.findByLog_IdOrderByRecordedAtDesc(logId, PageRequest.of(0, safeLimit));
    }
}
