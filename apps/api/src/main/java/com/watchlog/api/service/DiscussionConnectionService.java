package com.watchlog.api.service;

import com.watchlog.api.dto.DiscussionConnectionDto;
import com.watchlog.api.repo.DiscussionConnectionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class DiscussionConnectionService {
    private final DiscussionConnectionRepository repository;

    public DiscussionConnectionService(DiscussionConnectionRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public DiscussionConnectionDto find(UUID titleId, UUID userId) {
        if (titleId == null || userId == null) return null;
        return repository.findConnectionId(titleId, userId)
                .map(id -> new DiscussionConnectionDto(id, titleId))
                .orElse(null);
    }
}
