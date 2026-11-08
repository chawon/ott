package com.watchlog.api.service;

import com.watchlog.api.repo.DiscussionConnectionRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class DiscussionConnectionServiceTest {
    private final DiscussionConnectionRepository repository = mock(DiscussionConnectionRepository.class);
    private final DiscussionConnectionService service = new DiscussionConnectionService(repository);

    @Test
    void onlyReturnsTheExactPublicDestinationWithoutMutatingAnything() {
        UUID title = UUID.randomUUID(), viewer = UUID.randomUUID(), discussion = UUID.randomUUID();
        when(repository.findConnectionId(title, viewer)).thenReturn(Optional.of(discussion));

        var result = service.find(title, viewer);

        assertThat(result.titleId()).isEqualTo(title);
        assertThat(result.discussionId()).isEqualTo(discussion);
        verify(repository).findConnectionId(title, viewer);
        verifyNoMoreInteractions(repository);
    }

    @Test
    void noExistingContributionDoesNotCreateADiscussion() {
        UUID title = UUID.randomUUID(), viewer = UUID.randomUUID();
        when(repository.findConnectionId(title, viewer)).thenReturn(Optional.empty());
        assertThat(service.find(title, viewer)).isNull();
        verify(repository).findConnectionId(title, viewer);
        verifyNoMoreInteractions(repository);
    }

    @Test
    void missingIdentityDoesNotEvenQuery() {
        assertThat(service.find(UUID.randomUUID(), null)).isNull();
        assertThat(service.find(null, UUID.randomUUID())).isNull();
        verifyNoInteractions(repository);
    }
}
