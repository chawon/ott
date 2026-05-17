package com.watchlog.api.service;

import com.watchlog.api.domain.UserEntity;
import com.watchlog.api.dto.UpdateUserProfileRequest;
import com.watchlog.api.repo.CommentRepository;
import com.watchlog.api.repo.UserDeviceRepository;
import com.watchlog.api.repo.UserRepository;
import com.watchlog.api.repo.WatchLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AuthServiceProfileTest {

    private UserRepository userRepository;
    private UserDeviceRepository userDeviceRepository;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        userDeviceRepository = mock(UserDeviceRepository.class);
        authService = new AuthService(
                userRepository,
                userDeviceRepository,
                mock(WatchLogRepository.class),
                mock(CommentRepository.class)
        );
    }

    @Test
    void updateProfileTrimsNicknameAndStoresPersonaKey() {
        var user = new UserEntity(UUID.randomUUID(), "ABCDEFGH");
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

        var profile = authService.updateProfile(
                user.getId(),
                new UpdateUserProfileRequest("  타임라인러  ", "Cinema_Keeper")
        );

        assertThat(profile.nickname()).isEqualTo("타임라인러");
        assertThat(profile.personaKey()).isEqualTo("cinema_keeper");
        assertThat(profile.profileUpdatedAt()).isNotNull();
        assertThat(user.getNickname()).isEqualTo("타임라인러");
        assertThat(user.getPersonaKey()).isEqualTo("cinema_keeper");
    }

    @Test
    void updateProfileRejectsBlankOrLongNickname() {
        var user = new UserEntity(UUID.randomUUID(), "ABCDEFGH");
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.updateProfile(
                user.getId(),
                new UpdateUserProfileRequest(" ", "cinema_keeper")
        )).isInstanceOf(IllegalArgumentException.class);

        assertThatThrownBy(() -> authService.updateProfile(
                user.getId(),
                new UpdateUserProfileRequest("a".repeat(33), "cinema_keeper")
        )).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void updateProfileRejectsUnknownPersonaKey() {
        var user = new UserEntity(UUID.randomUUID(), "ABCDEFGH");
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.updateProfile(
                user.getId(),
                new UpdateUserProfileRequest("타임라인러", "unknown")
        )).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void requireActiveDeviceRejectsMissingHeaders() {
        assertThatThrownBy(() -> authService.requireActiveDevice(null, UUID.randomUUID()))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED)
                );
    }
}
