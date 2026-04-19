package com.watchlog.api.dto;

import java.util.List;

public record ChatGptClientRegistrationResponse(
        List<String> redirect_uris,
        String client_name,
        String token_endpoint_auth_method,
        List<String> grant_types,
        List<String> response_types,
        String scope,
        String client_id,
        long client_id_issued_at
) {}
