package com.watchlog.api.service;

import com.watchlog.api.chatgpt.ChatGptProperties;
import com.watchlog.api.domain.ChatGptAuthorizationCodeEntity;
import com.watchlog.api.dto.AuthPairResponse;
import com.watchlog.api.dto.ChatGptClientRegistrationRequest;
import com.watchlog.api.dto.ChatGptClientRegistrationResponse;
import com.watchlog.api.dto.ChatGptTokenResponse;
import com.watchlog.api.repo.ChatGptAuthorizationCodeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class ChatGptOAuthService {

    private static final List<String> SUPPORTED_SCOPES = List.of("timeline.read");
    private static final SecureRandom RANDOM = new SecureRandom();

    private final ChatGptProperties properties;
    private final ChatGptAuthorizationCodeRepository authorizationCodeRepository;
    private final ChatGptTokenService tokenService;
    private final AuthService authService;

    public ChatGptOAuthService(
            ChatGptProperties properties,
            ChatGptAuthorizationCodeRepository authorizationCodeRepository,
            ChatGptTokenService tokenService,
            AuthService authService
    ) {
        this.properties = properties;
        this.authorizationCodeRepository = authorizationCodeRepository;
        this.tokenService = tokenService;
        this.authService = authService;
    }

    public ChatGptClientRegistrationResponse registerClient(ChatGptClientRegistrationRequest request) {
        List<String> redirectUris = sanitizeRedirectUris(request.redirect_uris());
        long issuedAt = System.currentTimeMillis() / 1000;

        String clientId = tokenService.sign(new LinkedHashMap<>(Map.of(
                "type", "client",
                "redirect_uris", redirectUris,
                "client_name", request.client_name() == null ? "ottline ChatGPT client" : request.client_name(),
                "iat", issuedAt,
                "exp", issuedAt + (60L * 60 * 24 * 365 * 5)
        )));

        return new ChatGptClientRegistrationResponse(
                redirectUris,
                request.client_name() == null ? "ottline ChatGPT client" : request.client_name(),
                "none",
                List.of("authorization_code"),
                List.of("code"),
                String.join(" ", SUPPORTED_SCOPES),
                clientId,
                issuedAt
        );
    }

    public RegisteredClient verifyClient(String clientId, String redirectUri) {
        Map<String, Object> payload = tokenService.verify(clientId);
        if (!"client".equals(payload.get("type"))) {
            throw new IllegalArgumentException("Invalid client type");
        }
        @SuppressWarnings("unchecked")
        List<String> redirectUris = (List<String>) payload.get("redirect_uris");
        if (redirectUris == null || redirectUris.isEmpty()) {
            throw new IllegalArgumentException("Client has no redirect URIs");
        }
        if (redirectUri == null || redirectUri.isBlank()) {
            throw new IllegalArgumentException("redirect_uri is required");
        }
        if (!redirectUris.contains(redirectUri)) {
            throw new IllegalArgumentException("redirect_uri is not registered");
        }
        return new RegisteredClient(
                clientId,
                redirectUris,
                Objects.toString(payload.get("client_name"), "ottline ChatGPT client")
        );
    }

    @Transactional
    public String issueAuthorizationCode(
            String clientId,
            String redirectUri,
            String codeChallenge,
            List<String> scopes,
            String resource,
            String pairingCode,
            String reviewUsername,
            String reviewPassword,
            String userAgent
    ) {
        if (codeChallenge == null || codeChallenge.isBlank()) {
            throw new IllegalArgumentException("code_challenge is required");
        }

        String resolvedPairingCode = resolvePairingCode(pairingCode, reviewUsername, reviewPassword);
        AuthPairResponse auth = authService.pair(resolvedPairingCode, null, userAgent);

        String code = randomToken();
        authorizationCodeRepository.save(
                new ChatGptAuthorizationCodeEntity(
                        code,
                        clientId,
                        redirectUri,
                        codeChallenge,
                        String.join(" ", normalizeScopes(scopes)),
                        resource,
                        UUID.fromString(auth.userId().toString()),
                        UUID.fromString(auth.deviceId().toString()),
                        OffsetDateTime.now().plusSeconds(properties.getAuthorizationCodeTtlSeconds())
                )
        );

        return code;
    }

    @Transactional
    public ChatGptTokenResponse exchangeAuthorizationCode(
            String clientId,
            String code,
            String codeVerifier,
            String redirectUri,
            String resource
    ) {
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("code is required");
        }
        if (codeVerifier == null || codeVerifier.isBlank()) {
            throw new IllegalArgumentException("code_verifier is required");
        }

        ChatGptAuthorizationCodeEntity entity = authorizationCodeRepository.findById(code)
                .orElseThrow(() -> new IllegalArgumentException("Invalid authorization code"));
        if (entity.getUsedAt() != null) {
            throw new IllegalArgumentException("Authorization code has already been used");
        }
        if (entity.isExpired()) {
            throw new IllegalArgumentException("Authorization code has expired");
        }
        if (!Objects.equals(entity.getClientId(), clientId)) {
            throw new IllegalArgumentException("client_id does not match authorization code");
        }
        if (!Objects.equals(entity.getRedirectUri(), redirectUri)) {
            throw new IllegalArgumentException("redirect_uri does not match authorization code");
        }
        if (!Objects.equals(entity.getCodeChallenge(), toCodeChallenge(codeVerifier))) {
            throw new IllegalArgumentException("code_verifier does not match code_challenge");
        }
        if (resource != null && !resource.isBlank() && !Objects.equals(entity.getResource(), resource)) {
            throw new IllegalArgumentException("resource does not match authorization code");
        }

        authService.requireActiveDevice(entity.getUserId(), entity.getDeviceId());
        entity.markUsed();

        long issuedAt = System.currentTimeMillis() / 1000;
        long expiresAt = issuedAt + properties.getAccessTokenTtlSeconds();
        List<String> scopes = splitScopes(entity.getScopes());
        String audience = entity.getResource() == null || entity.getResource().isBlank()
                ? properties.getResourceServerUrl()
                : entity.getResource();

        String accessToken = tokenService.sign(new LinkedHashMap<>(Map.of(
                "type", "access",
                "iss", properties.getOauthIssuer(),
                "aud", audience,
                "cid", clientId,
                "uid", entity.getUserId().toString(),
                "did", entity.getDeviceId().toString(),
                "scp", scopes,
                "sub", entity.getUserId().toString(),
                "iat", issuedAt,
                "exp", expiresAt
        )));

        return new ChatGptTokenResponse(
                accessToken,
                "Bearer",
                properties.getAccessTokenTtlSeconds(),
                String.join(" ", scopes)
        );
    }

    public List<String> supportedScopes() {
        return SUPPORTED_SCOPES;
    }

    private List<String> sanitizeRedirectUris(List<String> redirectUris) {
        if (redirectUris == null || redirectUris.isEmpty()) {
            throw new IllegalArgumentException("redirect_uris is required");
        }
        List<String> sanitized = new ArrayList<>();
        for (String redirectUri : redirectUris) {
            if (redirectUri == null || redirectUri.isBlank()) {
                throw new IllegalArgumentException("redirect_uri cannot be blank");
            }
            URI uri = URI.create(redirectUri);
            if (uri.getScheme() == null || uri.getHost() == null) {
                throw new IllegalArgumentException("redirect_uri must be an absolute URI");
            }
            sanitized.add(uri.toString());
        }
        return sanitized;
    }

    private String resolvePairingCode(String pairingCode, String reviewUsername, String reviewPassword) {
        if (reviewUsername != null && !reviewUsername.isBlank() && reviewPassword != null && !reviewPassword.isBlank()) {
            if (!reviewUsername.equals(properties.getReviewUsername()) || !reviewPassword.equals(properties.getReviewPassword())) {
                throw new IllegalArgumentException("Invalid review credentials");
            }
            if (properties.getReviewPairingCode() == null || properties.getReviewPairingCode().isBlank()) {
                throw new IllegalArgumentException("Review pairing code is not configured");
            }
            return properties.getReviewPairingCode();
        }
        if (pairingCode == null || pairingCode.isBlank()) {
            throw new IllegalArgumentException("Pairing code is required");
        }
        return pairingCode.trim();
    }

    private List<String> normalizeScopes(List<String> scopes) {
        if (scopes == null || scopes.isEmpty()) {
            return SUPPORTED_SCOPES;
        }
        List<String> normalized = scopes.stream()
                .filter(scope -> scope != null && !scope.isBlank())
                .distinct()
                .toList();
        if (normalized.isEmpty()) {
            return SUPPORTED_SCOPES;
        }
        for (String scope : normalized) {
            if (!SUPPORTED_SCOPES.contains(scope)) {
                throw new IllegalArgumentException("Unsupported scope: " + scope);
            }
        }
        return normalized;
    }

    private List<String> splitScopes(String value) {
        if (value == null || value.isBlank()) {
            return SUPPORTED_SCOPES;
        }
        return Arrays.stream(value.split(" "))
                .filter(scope -> !scope.isBlank())
                .toList();
    }

    private String randomToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String toCodeChallenge(String verifier) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to compute code challenge", e);
        }
    }

    public record RegisteredClient(
            String clientId,
            List<String> redirectUris,
            String clientName
    ) {}
}
