package com.watchlog.api.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CreateCuratedDraftRequest(
        @NotNull UUID titleId,
        @Size(max = 10) String locale,
        @Size(max = 2000) String body
) {}
