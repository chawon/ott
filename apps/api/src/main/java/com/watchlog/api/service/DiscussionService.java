package com.watchlog.api.service;

import com.watchlog.api.domain.DiscussionEntity;
import com.watchlog.api.domain.TitleEntity;
import com.watchlog.api.repo.DiscussionRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class DiscussionService {

    private final DiscussionRepository discussionRepository;

    public DiscussionService(DiscussionRepository discussionRepository) {
        this.discussionRepository = discussionRepository;
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
        int safeLimit = Math.max(1, Math.min(limit, 100));
        return discussionRepository.findLatest(PageRequest.of(0, safeLimit));
    }

    @Transactional(readOnly = true)
    public List<DiscussionEntity> listLatest(int limit, Integer minComments) {
        int safeLimit = Math.max(1, Math.min(limit, 100));
        if (minComments == null) {
            return discussionRepository.findLatest(PageRequest.of(0, safeLimit));
        }
        int safeMin = Math.max(0, minComments);
        return discussionRepository.findLatestWithMinComments(safeMin, PageRequest.of(0, safeLimit));
    }

    @Transactional
    public DiscussionEntity lock(UUID id) {
        return discussionRepository.findWithLockById(id)
                .orElseThrow(() -> new IllegalArgumentException("Discussion not found: " + id));
    }
}
