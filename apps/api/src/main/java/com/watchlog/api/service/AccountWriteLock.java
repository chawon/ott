package com.watchlog.api.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.Objects;
import java.util.UUID;

/** Shared before-read lock for all application paths that create or edit account records. */
@Component
public class AccountWriteLock {
    private final JdbcTemplate jdbc;

    public AccountWriteLock(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void acquire(UUID... userIds) {
        // Merge takes both account locks in one stable order; a normal writer takes one.
        // No publication fence or other account is held during metadata network requests.
        for (var userId : Arrays.stream(userIds).filter(Objects::nonNull).distinct().sorted().toList()) {
            jdbc.queryForObject("select pg_advisory_xact_lock(hashtextextended(current_schema() || '.ottline.sync.push.' || cast(? as text), 0))",
                    Object.class, userId);
        }
    }
}
