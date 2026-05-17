package com.watchlog.api.service;

import com.watchlog.api.domain.DiscussionReactionEntity;
import com.watchlog.api.domain.DiscussionReactionType;
import com.watchlog.api.dto.DiscussionReactionStateDto;
import com.watchlog.api.dto.DiscussionReactionSummaryDto;
import com.watchlog.api.repo.DiscussionReactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class DiscussionReactionService {

    private final DiscussionReactionRepository reactionRepository;
    private final DiscussionService discussionService;

    public DiscussionReactionService(
            DiscussionReactionRepository reactionRepository,
            DiscussionService discussionService
    ) {
        this.reactionRepository = reactionRepository;
        this.discussionService = discussionService;
    }

    @Transactional(readOnly = true)
    public Map<UUID, DiscussionReactionSummaryDto> summarize(List<UUID> discussionIds) {
        if (discussionIds == null || discussionIds.isEmpty()) return Map.of();
        var grouped = new java.util.HashMap<UUID, Map<DiscussionReactionType, Long>>();
        for (var row : reactionRepository.countByDiscussionIds(discussionIds)) {
            grouped
                    .computeIfAbsent(row.getDiscussionId(), ignored -> new EnumMap<>(DiscussionReactionType.class))
                    .put(row.getType(), row.getCount());
        }
        return discussionIds.stream()
                .distinct()
                .collect(Collectors.toMap(
                        id -> id,
                        id -> DiscussionReactionSummaryDto.fromCounts(grouped.get(id))
                ));
    }

    @Transactional(readOnly = true)
    public DiscussionReactionSummaryDto summarize(UUID discussionId) {
        return summarize(List.of(discussionId)).getOrDefault(discussionId, DiscussionReactionSummaryDto.empty());
    }

    @Transactional(readOnly = true)
    public Set<DiscussionReactionType> selectedTypes(UUID discussionId, UUID userId) {
        if (discussionId == null || userId == null) return Set.of();
        return reactionRepository.findByDiscussion_IdAndUserId(discussionId, userId)
                .map(reaction -> Set.of(reaction.getType()))
                .orElseGet(Set::of);
    }

    @Transactional
    public DiscussionReactionStateDto toggle(UUID discussionId, UUID userId, DiscussionReactionType type) {
        if (type == null) {
            throw new IllegalArgumentException("Reaction type is required");
        }
        var discussion = discussionService.lock(discussionId);
        var existing = reactionRepository.findByDiscussion_IdAndUserId(discussionId, userId);
        boolean selected;

        if (existing.isPresent() && existing.get().getType() == type) {
            reactionRepository.delete(existing.get());
            selected = false;
        } else if (existing.isPresent()) {
            existing.get().setType(type);
            selected = true;
        } else {
            reactionRepository.save(new DiscussionReactionEntity(UUID.randomUUID(), discussion, userId, type));
            selected = true;
        }

        return new DiscussionReactionStateDto(
                summarize(discussionId),
                selectedTypes(discussionId, userId),
                selected
        );
    }

    @Transactional
    public void deleteByUserId(UUID userId) {
        if (userId == null) return;
        reactionRepository.deleteByUserId(userId);
    }
}
