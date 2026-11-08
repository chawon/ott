package com.watchlog.api.dto;

import java.util.UUID;

/** A public destination only; no comment text or personal recording data. */
public record DiscussionConnectionDto(UUID discussionId, UUID titleId) {}
