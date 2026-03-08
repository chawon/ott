package com.watchlog.api.service;

import com.watchlog.api.domain.FeedbackAuthorRole;
import com.watchlog.api.domain.FeedbackCategory;
import com.watchlog.api.domain.FeedbackMessageEntity;
import com.watchlog.api.domain.FeedbackThreadEntity;
import com.watchlog.api.dto.FeedbackMessageDto;
import com.watchlog.api.dto.FeedbackThreadDetailDto;
import com.watchlog.api.dto.FeedbackThreadSummaryDto;
import com.watchlog.api.repo.FeedbackMessageRepository;
import com.watchlog.api.repo.FeedbackThreadRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class FeedbackService {

    private final FeedbackThreadRepository feedbackThreadRepository;
    private final FeedbackMessageRepository feedbackMessageRepository;
    private final FeedbackTelegramNotifier feedbackTelegramNotifier;
    private final String adminFeedbackToken;

    public FeedbackService(
            FeedbackThreadRepository feedbackThreadRepository,
            FeedbackMessageRepository feedbackMessageRepository,
            FeedbackTelegramNotifier feedbackTelegramNotifier,
            @Value("${admin.feedback.token:${admin.analytics.token:}}") String adminFeedbackToken
    ) {
        this.feedbackThreadRepository = feedbackThreadRepository;
        this.feedbackMessageRepository = feedbackMessageRepository;
        this.feedbackTelegramNotifier = feedbackTelegramNotifier;
        this.adminFeedbackToken = adminFeedbackToken;
    }

    @Transactional
    public FeedbackThreadDetailDto createThread(UUID userId, FeedbackCategory category, String subject, String body) {
        requireUser(userId);
        if (category == null) {
            throw new IllegalArgumentException("category is required");
        }
        String safeBody = normalizeBody(body);
        String safeSubject = normalizeSubject(subject);

        FeedbackThreadEntity thread = feedbackThreadRepository.save(
                new FeedbackThreadEntity(UUID.randomUUID(), userId, category, safeSubject)
        );
        FeedbackMessageEntity firstMessage = feedbackMessageRepository.save(
                new FeedbackMessageEntity(UUID.randomUUID(), thread, FeedbackAuthorRole.USER, safeBody)
        );
        feedbackTelegramNotifier.notifyNewThread(thread, firstMessage);
        return getOwnThread(userId, thread.getId());
    }

    @Transactional(readOnly = true)
    public List<FeedbackThreadSummaryDto> listOwnThreads(UUID userId) {
        requireUser(userId);
        return feedbackThreadRepository.findByUserIdOrderByUpdatedAtDesc(userId).stream()
                .map(this::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public FeedbackThreadDetailDto getOwnThread(UUID userId, UUID threadId) {
        requireUser(userId);
        FeedbackThreadEntity thread = requireThread(threadId);
        if (!thread.getUserId().equals(userId)) {
            throw new IllegalArgumentException("Feedback thread not found");
        }
        return toDetail(thread);
    }

    @Transactional(readOnly = true)
    public List<FeedbackThreadSummaryDto> listAdminThreads(String token, int limit) {
        verifyAdminToken(token);
        int safeLimit = Math.max(1, Math.min(limit, 200));
        return feedbackThreadRepository.findAllByOrderByUpdatedAtDesc(PageRequest.of(0, safeLimit)).stream()
                .map(this::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public FeedbackThreadDetailDto getAdminThread(String token, UUID threadId) {
        verifyAdminToken(token);
        return toDetail(requireThread(threadId));
    }

    @Transactional
    public FeedbackThreadDetailDto replyAsAdmin(String token, UUID threadId, String body) {
        verifyAdminToken(token);
        FeedbackThreadEntity thread = requireThread(threadId);
        feedbackMessageRepository.save(
                new FeedbackMessageEntity(UUID.randomUUID(), thread, FeedbackAuthorRole.ADMIN, normalizeBody(body))
        );
        thread.markAnswered();
        feedbackThreadRepository.save(thread);
        return toDetail(thread);
    }

    private FeedbackThreadSummaryDto toSummary(FeedbackThreadEntity thread) {
        List<FeedbackMessageEntity> messages = feedbackMessageRepository.findByThread_IdOrderByCreatedAtAsc(thread.getId());
        FeedbackMessageEntity lastMessage = messages.isEmpty() ? null : messages.get(messages.size() - 1);
        return FeedbackThreadSummaryDto.from(thread, messages.size(), lastMessage);
    }

    private FeedbackThreadDetailDto toDetail(FeedbackThreadEntity thread) {
        return FeedbackThreadDetailDto.from(
                thread,
                feedbackMessageRepository.findByThread_IdOrderByCreatedAtAsc(thread.getId()).stream()
                        .map(FeedbackMessageDto::from)
                        .toList()
        );
    }

    private FeedbackThreadEntity requireThread(UUID threadId) {
        return feedbackThreadRepository.findById(threadId)
                .orElseThrow(() -> new IllegalArgumentException("Feedback thread not found: " + threadId));
    }

    private void requireUser(UUID userId) {
        if (userId == null) {
            throw new IllegalArgumentException("X-User-Id header is required");
        }
    }

    private void verifyAdminToken(String token) {
        if (adminFeedbackToken == null || adminFeedbackToken.isBlank()) {
            throw new IllegalArgumentException("Admin feedback token is not configured");
        }
        if (!adminFeedbackToken.equals(token)) {
            throw new IllegalArgumentException("Invalid admin token");
        }
    }

    private String normalizeBody(String body) {
        if (body == null || body.isBlank()) {
            throw new IllegalArgumentException("body is required");
        }
        String trimmed = body.trim();
        if (trimmed.length() > 4000) {
            throw new IllegalArgumentException("body must be 4000 characters or fewer");
        }
        return trimmed;
    }

    private String normalizeSubject(String subject) {
        if (subject == null || subject.isBlank()) return null;
        String trimmed = subject.trim();
        if (trimmed.length() > 120) {
            throw new IllegalArgumentException("subject must be 120 characters or fewer");
        }
        return trimmed;
    }
}
