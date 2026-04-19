package com.watchlog.api.service;

import com.watchlog.api.repo.CommentRepository;
import com.watchlog.api.repo.DiscussionRepository;
import com.watchlog.api.repo.FeedbackThreadRepository;
import com.watchlog.api.repo.RecommendationCacheRepository;
import com.watchlog.api.repo.UserDeviceRepository;
import com.watchlog.api.repo.UserRepository;
import com.watchlog.api.repo.WatchLogRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class AccountDeletionService {

    private final RecommendationCacheRepository recommendationCacheRepository;
    private final FeedbackThreadRepository feedbackThreadRepository;
    private final CommentRepository commentRepository;
    private final DiscussionRepository discussionRepository;
    private final WatchLogRepository watchLogRepository;
    private final UserDeviceRepository userDeviceRepository;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;

    public AccountDeletionService(
            RecommendationCacheRepository recommendationCacheRepository,
            FeedbackThreadRepository feedbackThreadRepository,
            CommentRepository commentRepository,
            DiscussionRepository discussionRepository,
            WatchLogRepository watchLogRepository,
            UserDeviceRepository userDeviceRepository,
            UserRepository userRepository,
            JdbcTemplate jdbcTemplate
    ) {
        this.recommendationCacheRepository = recommendationCacheRepository;
        this.feedbackThreadRepository = feedbackThreadRepository;
        this.commentRepository = commentRepository;
        this.discussionRepository = discussionRepository;
        this.watchLogRepository = watchLogRepository;
        this.userDeviceRepository = userDeviceRepository;
        this.userRepository = userRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public void deleteAccount(UUID userId) {
        if (userId == null) return;

        recommendationCacheRepository.deleteByUserId(userId);
        jdbcTemplate.update("delete from analytics_events where user_id = ?", userId);
        feedbackThreadRepository.deleteByUserId(userId);

        List<UUID> affectedDiscussionIds = commentRepository.findDistinctDiscussionIdsByUserId(userId);
        if (!affectedDiscussionIds.isEmpty()) {
            commentRepository.deleteByUserId(userId);
            discussionRepository.syncCommentCounts(affectedDiscussionIds);
            discussionRepository.deleteEmptyDiscussions(affectedDiscussionIds);
        }

        watchLogRepository.deleteByUserId(userId);
        userDeviceRepository.deleteByUser_Id(userId);
        userRepository.deleteById(userId);
    }
}
