package com.watchlog.api.service;

import com.watchlog.api.domain.Status;
import com.watchlog.api.domain.TitleEntity;
import com.watchlog.api.domain.TitleType;
import com.watchlog.api.domain.WatchLogEntity;
import com.watchlog.api.repo.WatchLogRepository;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;

import java.lang.reflect.Proxy;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class LogServicePaginationTest {
    @Test
    void requestsOneExtraRowAndBuildsCursorFromLastVisibleItem() {
        var userId = UUID.fromString("00000000-0000-4000-8000-000000000001");
        var first = log("00000000-0000-4000-8000-000000000103", "2026-09-14T03:00:00Z");
        var second = log("00000000-0000-4000-8000-000000000102", "2026-09-14T02:00:00Z");
        var extra = log("00000000-0000-4000-8000-000000000101", "2026-09-14T01:00:00Z");
        var capturedArguments = new AtomicReference<Object[]>();
        var repository = (WatchLogRepository) Proxy.newProxyInstance(
                WatchLogRepository.class.getClassLoader(),
                new Class<?>[]{WatchLogRepository.class},
                (proxy, method, arguments) -> {
                    if (method.getName().equals("findFiltered")) {
                        capturedArguments.set(arguments);
                        return List.of(first, second, extra);
                    }
                    throw new UnsupportedOperationException(method.getName());
                }
        );
        var service = new LogService(repository, null, null, null);

        var page = service.listPage(
                null, null, null, null, null, null, null,
                2, userId, true, "VIDEO", null
        );

        assertThat(page.items()).containsExactly(first, second);
        assertThat(page.nextCursor()).isNotBlank();
        var decoded = WatchLogCursor.decode(page.nextCursor(), true);
        assertThat(decoded.at().toInstant()).isEqualTo(second.getUpdatedAt().toInstant());
        assertThat(decoded.id()).isEqualTo(second.getId());
        assertThat(capturedArguments.get()[0]).isEqualTo(userId);
        assertThat(capturedArguments.get()[4]).isEqualTo("video");
        assertThat(capturedArguments.get()[9]).isNull();
        assertThat(capturedArguments.get()[10]).isNull();
        assertThat(capturedArguments.get()[11]).isEqualTo(true);
        assertThat((Pageable) capturedArguments.get()[12]).isEqualTo(Pageable.ofSize(3));
    }

    private WatchLogEntity log(String id, String updatedAt) {
        var uuid = UUID.fromString(id);
        var title = new TitleEntity(UUID.randomUUID(), TitleType.movie, "Title " + id);
        var log = new WatchLogEntity(uuid, title, Status.DONE);
        log.setUpdatedAt(OffsetDateTime.parse(updatedAt));
        return log;
    }
}
