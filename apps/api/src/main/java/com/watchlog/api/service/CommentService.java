package com.watchlog.api.service;

import com.watchlog.api.domain.CommentEntity;
import com.watchlog.api.domain.DiscussionEntity;
import com.watchlog.api.domain.Status;
import com.watchlog.api.domain.WatchLogEntity;
import com.watchlog.api.repo.CommentRepository;
import com.watchlog.api.repo.WatchLogRepository;
import com.watchlog.api.service.TitleService;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class CommentService {

    private final CommentRepository commentRepository;
    private final DiscussionService discussionService;
    private final TitleService titleService;
    private final WatchLogRepository watchLogRepository;
    private final WatchLogHistoryService historyService;

    public CommentService(
            CommentRepository commentRepository,
            DiscussionService discussionService,
            TitleService titleService,
            WatchLogRepository watchLogRepository,
            WatchLogHistoryService historyService
    ) {
        this.commentRepository = commentRepository;
        this.discussionService = discussionService;
        this.titleService = titleService;
        this.watchLogRepository = watchLogRepository;
        this.historyService = historyService;
    }

    @Transactional(readOnly = true)
    public List<CommentEntity> list(UUID discussionId, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 200));
        return commentRepository.findByDiscussion_IdOrderByCreatedAtAsc(discussionId, PageRequest.of(0, safeLimit));
    }

    @Transactional
    public CommentEntity create(UUID discussionId, String body, UUID userId, List<com.watchlog.api.dto.MentionRef> mentions) {
        if (body == null || body.trim().isEmpty()) {
            throw new IllegalArgumentException("Comment body is required");
        }

        DiscussionEntity discussion = discussionService.lock(discussionId);
        String originBaseName = normalizeTitleName(discussion.getTitle().getName());
        CommentEntity saved = createForDiscussion(discussion, body.trim(), userId, true, originBaseName);

        if (mentions != null && !mentions.isEmpty()) {
            var baseTitleId = discussion.getTitle().getId();
            var seen = new java.util.HashSet<String>();
            for (var m : mentions) {
                if (m == null || m.provider() == null || m.providerId() == null) continue;
                String key = m.provider() + ":" + m.providerId();
                if (!seen.add(key)) continue;
                var title = titleService.upsertFromTmdb(m.providerId(), m.titleType());
                if (title.getId().equals(baseTitleId)) continue;
                var target = discussionService.ensureForTitle(title);
                createForDiscussion(discussionService.lock(target.getId()), body.trim(), userId, false, originBaseName);
            }
        }

        return saved;
    }

    private CommentEntity createForDiscussion(DiscussionEntity discussion, String body, UUID userId, boolean updateHistory, String authorBaseName) {
        int nextSeq = discussion.getCommentSeq() + 1;
        discussion.setCommentSeq(nextSeq);

        String baseName = (authorBaseName == null || authorBaseName.isBlank())
                ? normalizeTitleName(discussion.getTitle().getName())
                : authorBaseName;
        String authorName = baseName + "-" + nextSeq;

        CommentEntity comment = new CommentEntity(UUID.randomUUID(), discussion, authorName, body.trim());
        comment.setUserId(userId);
        CommentEntity saved = commentRepository.save(comment);

        if (userId != null && updateHistory) {
            ensureLogAndHistory(discussion, userId, body.trim());
        }
        return saved;
    }

    private void ensureLogAndHistory(DiscussionEntity discussion, UUID userId, String body) {
        var title = discussion.getTitle();
        var existing = watchLogRepository.findByTitle_IdAndUserIdAndDeletedAtIsNull(title.getId(), userId);
        if (existing.isPresent()) {
            var log = existing.get();
            log.setNote(body);
            log.setUpdatedAt(OffsetDateTime.now());
            historyService.recordSnapshot(log);
            return;
        }

        var log = new WatchLogEntity(UUID.randomUUID(), title, Status.DONE);
        log.setUserId(userId);
        log.setNote(body);
        log.setWatchedAt(OffsetDateTime.now());
        log.setUpdatedAt(OffsetDateTime.now());
        var saved = watchLogRepository.save(log);
        historyService.recordSnapshot(saved);
    }

    private String normalizeTitleName(String titleName) {
        return (titleName == null || titleName.isBlank()) ? "컨텐츠" : titleName.replaceAll("\\s+", "");
    }
}
