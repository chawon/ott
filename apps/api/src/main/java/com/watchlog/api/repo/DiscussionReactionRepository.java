package com.watchlog.api.repo;

import com.watchlog.api.domain.DiscussionReactionEntity;
import com.watchlog.api.domain.DiscussionReactionType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DiscussionReactionRepository extends JpaRepository<DiscussionReactionEntity, UUID> {

    interface ReactionCountRow {
        UUID getDiscussionId();
        DiscussionReactionType getType();
        long getCount();
    }

    Optional<DiscussionReactionEntity> findByDiscussion_IdAndUserId(UUID discussionId, UUID userId);

    @Query("""
            select r.discussion.id as discussionId, r.type as type, count(r) as count
            from DiscussionReactionEntity r
            where r.discussion.id in :discussionIds
            group by r.discussion.id, r.type
            """)
    List<ReactionCountRow> countByDiscussionIds(@Param("discussionIds") List<UUID> discussionIds);

    @Modifying
    @Query(value = """
            delete from discussion_reactions source
            where source.user_id = :fromUserId
              and exists (
                  select 1
                  from discussion_reactions target
                  where target.user_id = :toUserId
                    and target.discussion_id = source.discussion_id
              )
            """, nativeQuery = true)
    int deleteDuplicatesForMerge(@Param("fromUserId") UUID fromUserId, @Param("toUserId") UUID toUserId);

    @Modifying
    @Query("update DiscussionReactionEntity r set r.userId = :toUserId where r.userId = :fromUserId")
    int assignUser(@Param("fromUserId") UUID fromUserId, @Param("toUserId") UUID toUserId);

    void deleteByUserId(UUID userId);
}
