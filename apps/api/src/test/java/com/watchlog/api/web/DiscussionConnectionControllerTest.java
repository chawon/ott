package com.watchlog.api.web;

import com.watchlog.api.dto.DiscussionConnectionDto;
import com.watchlog.api.service.AuthService;
import com.watchlog.api.service.DiscussionConnectionService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class DiscussionConnectionControllerTest {
    private final AuthService auth = mock(AuthService.class);
    private final DiscussionConnectionService service = mock(DiscussionConnectionService.class);
    private final DiscussionConnectionController controller = new DiscussionConnectionController(auth, service);
    private final UUID title = UUID.randomUUID(), viewer = UUID.randomUUID(), device = UUID.randomUUID();

    @Test
    void validatesAnExistingDeviceAndNeverCachesTheViewerDependentResult() {
        var destination = new DiscussionConnectionDto(UUID.randomUUID(), title);
        when(service.find(title, viewer)).thenReturn(destination);

        var response = controller.get(title, viewer, device);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(destination);
        assertThat(response.getHeaders().getCacheControl()).contains("private", "no-store");
        var order = inOrder(auth, service);
        order.verify(auth).requireActiveDevice(viewer, device);
        order.verify(service).find(title, viewer);
        verifyNoMoreInteractions(auth, service);
    }

    @Test
    void anEmptyResultIsAlsoNotCached() {
        var response = controller.get(title, viewer, device);
        assertThat(response.getBody()).isNull();
        assertThat(response.getHeaders().getCacheControl()).contains("private", "no-store");
        verify(auth).requireActiveDevice(viewer, device);
        verify(service).find(title, viewer);
        verifyNoMoreInteractions(auth, service);
    }

    @Test
    void invalidOrMissingDeviceCannotTriggerAQueryOrRegistration() {
        doThrow(new ResponseStatusException(HttpStatus.UNAUTHORIZED))
                .when(auth).requireActiveDevice(viewer, device);
        assertThatThrownBy(() -> controller.get(title, viewer, device)).isInstanceOf(ResponseStatusException.class);
        verify(auth).requireActiveDevice(viewer, device);
        verifyNoMoreInteractions(auth);
        verifyNoInteractions(service);
    }
}
