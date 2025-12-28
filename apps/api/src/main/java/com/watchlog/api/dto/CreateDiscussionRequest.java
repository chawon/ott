package com.watchlog.api.dto;

import java.util.UUID;

public record CreateDiscussionRequest(
        UUID titleId
) {}
