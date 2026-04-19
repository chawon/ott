package com.watchlog.api.web;

import com.watchlog.api.chatgpt.ChatGptProperties;
import com.watchlog.api.dto.ChatGptClientRegistrationRequest;
import com.watchlog.api.dto.ChatGptClientRegistrationResponse;
import com.watchlog.api.dto.ChatGptTokenResponse;
import com.watchlog.api.service.ChatGptOAuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.util.HtmlUtils;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Controller
@RequestMapping("/oauth/chatgpt")
public class ChatGptOAuthController {

    private final ChatGptOAuthService oauthService;
    private final ChatGptProperties properties;

    public ChatGptOAuthController(ChatGptOAuthService oauthService, ChatGptProperties properties) {
        this.oauthService = oauthService;
        this.properties = properties;
    }

    @GetMapping("/.well-known/oauth-authorization-server")
    @ResponseBody
    public Map<String, Object> metadata() {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("issuer", properties.getOauthIssuer());
        metadata.put("authorization_endpoint", properties.getOauthIssuer() + "/authorize");
        metadata.put("token_endpoint", properties.getOauthIssuer() + "/token");
        metadata.put("registration_endpoint", properties.getOauthIssuer() + "/register");
        metadata.put("response_types_supported", List.of("code"));
        metadata.put("grant_types_supported", List.of("authorization_code"));
        metadata.put("token_endpoint_auth_methods_supported", List.of("none"));
        metadata.put("code_challenge_methods_supported", List.of("S256"));
        metadata.put("scopes_supported", oauthService.supportedScopes());
        metadata.put("protected_resources", List.of(properties.getResourceServerUrl()));
        metadata.put("service_documentation", properties.getResourceDocumentationUrl());
        return metadata;
    }

    @PostMapping(value = "/register", consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public ResponseEntity<?> register(@RequestBody ChatGptClientRegistrationRequest request) {
        try {
            ChatGptClientRegistrationResponse response = oauthService.registerClient(request);
            return ResponseEntity.status(201).body(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "invalid_client_metadata",
                    "error_description", e.getMessage()
            ));
        }
    }

    @GetMapping("/authorize")
    public ResponseEntity<String> authorizePage(
            @RequestParam("client_id") String clientId,
            @RequestParam("redirect_uri") String redirectUri,
            @RequestParam("response_type") String responseType,
            @RequestParam("code_challenge") String codeChallenge,
            @RequestParam("code_challenge_method") String codeChallengeMethod,
            @RequestParam(value = "scope", required = false) String scope,
            @RequestParam(value = "state", required = false) String state,
            @RequestParam(value = "resource", required = false) String resource,
            HttpServletRequest request
    ) {
        AuthCopy copy = resolveCopy(request.getHeader(HttpHeaders.ACCEPT_LANGUAGE));
        try {
            if (!"code".equals(responseType)) {
                throw new IllegalArgumentException("response_type must be code");
            }
            if (!"S256".equals(codeChallengeMethod)) {
                throw new IllegalArgumentException("code_challenge_method must be S256");
            }
            var client = oauthService.verifyClient(clientId, redirectUri);
            return html(renderAuthorizePage(copy, client.clientName(), clientId, redirectUri, codeChallenge, scope, state, resource, null));
        } catch (IllegalArgumentException e) {
            return html(renderAuthorizePage(copy, "ottline ChatGPT client", clientId, redirectUri, codeChallenge, scope, state, resource, e.getMessage()));
        }
    }

    @PostMapping(value = "/authorize", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public ResponseEntity<?> authorizeSubmit(
            @RequestParam("client_id") String clientId,
            @RequestParam("redirect_uri") String redirectUri,
            @RequestParam("code_challenge") String codeChallenge,
            @RequestParam(value = "scope", required = false) String scope,
            @RequestParam(value = "state", required = false) String state,
            @RequestParam(value = "resource", required = false) String resource,
            @RequestParam(value = "pairing_code", required = false) String pairingCode,
            @RequestParam(value = "review_username", required = false) String reviewUsername,
            @RequestParam(value = "review_password", required = false) String reviewPassword,
            @RequestParam(value = "decision", defaultValue = "approve") String decision,
            HttpServletRequest request
    ) {
        AuthCopy copy = resolveCopy(request.getHeader(HttpHeaders.ACCEPT_LANGUAGE));
        try {
            var client = oauthService.verifyClient(clientId, redirectUri);
            if (!"approve".equals(decision)) {
                return ResponseEntity.status(HttpStatus.SEE_OTHER)
                        .header(HttpHeaders.CACHE_CONTROL, "no-store")
                        .header(HttpHeaders.LOCATION, errorRedirect(redirectUri, "access_denied", copy.accessDeniedDescription(), state))
                        .build();
            }

            List<String> scopes = scope == null || scope.isBlank()
                    ? oauthService.supportedScopes()
                    : List.of(scope.split(" "));

            String authorizationCode = oauthService.issueAuthorizationCode(
                    clientId,
                    redirectUri,
                    codeChallenge,
                    scopes,
                    resource,
                    pairingCode,
                    reviewUsername,
                    reviewPassword,
                    request.getHeader(HttpHeaders.USER_AGENT)
            );

            String redirectLocation = UriComponentsBuilder.fromUriString(redirectUri)
                    .queryParam("code", authorizationCode)
                    .queryParamIfPresent("state", java.util.Optional.ofNullable(state))
                    .build(true)
                    .toUriString();

            return ResponseEntity.status(HttpStatus.SEE_OTHER)
                    .header(HttpHeaders.CACHE_CONTROL, "no-store")
                    .header(HttpHeaders.LOCATION, redirectLocation)
                    .build();
        } catch (IllegalArgumentException e) {
            return html(renderAuthorizePage(copy, "ottline ChatGPT client", clientId, redirectUri, codeChallenge, scope, state, resource, e.getMessage()));
        }
    }

    @PostMapping(value = "/token", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    @ResponseBody
    public ResponseEntity<?> token(@RequestParam MultiValueMap<String, String> form) {
        try {
            String grantType = form.getFirst("grant_type");
            if (!"authorization_code".equals(grantType)) {
                return oauthError("unsupported_grant_type", "Only authorization_code is supported");
            }

            String clientId = form.getFirst("client_id");
            String code = form.getFirst("code");
            String codeVerifier = form.getFirst("code_verifier");
            String redirectUri = form.getFirst("redirect_uri");
            String resource = form.getFirst("resource");

            oauthService.verifyClient(clientId, redirectUri);
            ChatGptTokenResponse response = oauthService.exchangeAuthorizationCode(
                    clientId,
                    code,
                    codeVerifier,
                    redirectUri,
                    resource
            );

            return ResponseEntity.ok()
                    .header(HttpHeaders.CACHE_CONTROL, "no-store")
                    .body(response);
        } catch (IllegalArgumentException e) {
            return oauthError("invalid_grant", e.getMessage());
        }
    }

    private ResponseEntity<String> html(String body) {
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .body(body);
    }

    private ResponseEntity<Map<String, String>> oauthError(String code, String description) {
        return ResponseEntity.badRequest()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(Map.of(
                        "error", code,
                        "error_description", description
                ));
    }

    private String errorRedirect(String redirectUri, String error, String description, String state) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(redirectUri)
                .queryParam("error", error)
                .queryParam("error_description", description);
        if (state != null && !state.isBlank()) {
            builder.queryParam("state", state);
        }
        return builder.build(true).toUriString();
    }

    private String renderAuthorizePage(
            AuthCopy copy,
            String clientName,
            String clientId,
            String redirectUri,
            String codeChallenge,
            String scope,
            String state,
            String resource,
            String error
    ) {
        String escapedClientId = HtmlUtils.htmlEscape(clientId == null ? "" : clientId);
        String escapedRedirectUri = HtmlUtils.htmlEscape(redirectUri == null ? "" : redirectUri);
        String escapedChallenge = HtmlUtils.htmlEscape(codeChallenge == null ? "" : codeChallenge);
        String escapedScope = HtmlUtils.htmlEscape(scope == null ? String.join(" ", oauthService.supportedScopes()) : scope);
        String escapedState = HtmlUtils.htmlEscape(state == null ? "" : state);
        String escapedResource = HtmlUtils.htmlEscape(resource == null ? properties.getResourceServerUrl() : resource);
        String errorHtml = error == null
                ? ""
                : """
                    <div class="notice error">%s</div>
                """.formatted(HtmlUtils.htmlEscape(localizeError(error, copy)));

        return """
                <!doctype html>
                <html lang="%s">
                  <head>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width,initial-scale=1" />
                    <title>%s</title>
                    <style>
                      :root {
                        color-scheme: light;
                        --bg: linear-gradient(180deg, #f8fbff 0%%, #edf4ff 100%%);
                        --card: rgba(255,255,255,0.94);
                        --border: rgba(148,163,184,0.24);
                        --ink: #0f172a;
                        --muted: #475569;
                        --brand: #1e4d8c;
                        --soft: #dff2ff;
                      }
                      * { box-sizing: border-box; }
                      body {
                        margin: 0;
                        min-height: 100vh;
                        display: grid;
                        place-items: center;
                        padding: 24px;
                        background: var(--bg);
                        color: var(--ink);
                        font: 15px/1.55 "Pretendard Variable", Pretendard, "Poppins", system-ui, sans-serif;
                      }
                      .card {
                        width: min(100%%, 720px);
                        border: 1px solid var(--border);
                        border-radius: 28px;
                        padding: 28px;
                        background: var(--card);
                        box-shadow: 0 24px 70px rgba(15,23,42,0.10);
                      }
                      h1, h2, p { margin: 0; }
                      .eyebrow {
                        display: inline-flex;
                        padding: 6px 10px;
                        border-radius: 999px;
                        background: var(--soft);
                        color: var(--brand);
                        font-size: 12px;
                        font-weight: 700;
                        letter-spacing: 0.14em;
                        text-transform: uppercase;
                      }
                      h1 { margin-top: 14px; font-size: 34px; line-height: 1.08; }
                      .lead { margin-top: 10px; color: var(--muted); }
                      .grid { display: grid; gap: 16px; margin-top: 22px; }
                      .meta {
                        display: grid;
                        gap: 10px;
                        padding: 16px;
                        border-radius: 20px;
                        background: rgba(248,250,252,0.94);
                        border: 1px solid rgba(148,163,184,0.15);
                      }
                      .meta strong { display: block; font-size: 13px; }
                      .meta span { color: var(--muted); word-break: break-word; }
                      form { display: grid; gap: 14px; margin-top: 22px; }
                      input {
                        width: 100%%;
                        min-height: 46px;
                        border-radius: 16px;
                        border: 1px solid rgba(148,163,184,0.28);
                        padding: 0 14px;
                      }
                      .actions {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 10px;
                        margin-top: 8px;
                      }
                      button {
                        min-height: 44px;
                        border-radius: 999px;
                        border: 0;
                        padding: 0 18px;
                        font: inherit;
                        cursor: pointer;
                      }
                      .approve { background: var(--brand); color: white; }
                      .deny { background: white; border: 1px solid rgba(148,163,184,0.28); color: var(--ink); }
                      .notice {
                        padding: 12px 14px;
                        border-radius: 16px;
                        font-size: 14px;
                      }
                      .error {
                        background: rgba(239,68,68,0.10);
                        color: #b91c1c;
                        border: 1px solid rgba(239,68,68,0.18);
                      }
                      .help {
                        color: var(--muted);
                        font-size: 13px;
                      }
                    </style>
                  </head>
                  <body>
                    <main class="card">
                      <span class="eyebrow">%s</span>
                      <h1>%s</h1>
                      <p class="lead">
                        %s
                      </p>
                      %s
                      <section class="grid">
                        <div class="meta">
                          <strong>%s</strong>
                          <span>%s</span>
                        </div>
                        <div class="meta">
                          <strong>%s</strong>
                          <span>%s</span>
                        </div>
                        <div class="meta">
                          <strong>%s</strong>
                          <span>%s</span>
                        </div>
                      </section>

                      <form method="post" action="%s/authorize">
                        <input type="hidden" name="client_id" value="%s" />
                        <input type="hidden" name="redirect_uri" value="%s" />
                        <input type="hidden" name="code_challenge" value="%s" />
                        <input type="hidden" name="scope" value="%s" />
                        <input type="hidden" name="state" value="%s" />
                        <input type="hidden" name="resource" value="%s" />

                        <div>
                          <label for="pairing_code">%s</label>
                          <input id="pairing_code" name="pairing_code" autocomplete="off" placeholder="%s" />
                          <p class="help">%s</p>
                        </div>

                        <div>
                          <label for="review_username">%s</label>
                          <input id="review_username" name="review_username" autocomplete="username" placeholder="%s" />
                        </div>

                        <div>
                          <label for="review_password">%s</label>
                          <input id="review_password" type="password" name="review_password" autocomplete="current-password" placeholder="%s" />
                          <p class="help">%s</p>
                        </div>

                        <div class="actions">
                          <button class="approve" type="submit" name="decision" value="approve">%s</button>
                          <button class="deny" type="submit" name="decision" value="deny">%s</button>
                        </div>
                      </form>
                    </main>
                  </body>
                </html>
                """.formatted(
                copy.lang(),
                HtmlUtils.htmlEscape(copy.pageTitle()),
                HtmlUtils.htmlEscape(copy.eyebrow()),
                HtmlUtils.htmlEscape(copy.headingTemplate().formatted(clientName)),
                HtmlUtils.htmlEscape(copy.lead()),
                errorHtml,
                HtmlUtils.htmlEscape(copy.requestedScopesLabel()),
                escapedScope,
                HtmlUtils.htmlEscape(copy.redirectUriLabel()),
                escapedRedirectUri,
                HtmlUtils.htmlEscape(copy.resourceServerLabel()),
                escapedResource,
                HtmlUtils.htmlEscape(properties.getOauthIssuer()),
                escapedClientId,
                escapedRedirectUri,
                escapedChallenge,
                escapedScope,
                escapedState,
                escapedResource,
                HtmlUtils.htmlEscape(copy.pairingCodeLabel()),
                HtmlUtils.htmlEscape(copy.pairingCodePlaceholder()),
                HtmlUtils.htmlEscape(copy.pairingCodeHelp()),
                HtmlUtils.htmlEscape(copy.reviewUsernameLabel()),
                HtmlUtils.htmlEscape(copy.reviewUsernamePlaceholder()),
                HtmlUtils.htmlEscape(copy.reviewPasswordLabel()),
                HtmlUtils.htmlEscape(copy.reviewPasswordPlaceholder()),
                HtmlUtils.htmlEscape(copy.reviewPasswordHelp()),
                HtmlUtils.htmlEscape(copy.approveLabel()),
                HtmlUtils.htmlEscape(copy.denyLabel())
        );
    }

    private AuthCopy resolveCopy(String acceptLanguage) {
        String normalized = acceptLanguage == null ? "" : acceptLanguage.toLowerCase(Locale.ROOT);
        if (normalized.contains("ko")) {
            return new AuthCopy(
                    "ko",
                    "ottline ChatGPT 연결 승인",
                    "ottline for ChatGPT",
                    "%s 연결 승인",
                    "ChatGPT가 ottline 최근 기록과 감상 메모를 읽기 전용으로 요청하고 있습니다.",
                    "요청된 권한",
                    "리디렉션 URI",
                    "리소스 서버",
                    "페어링 코드",
                    "ottline 페어링 코드를 입력하세요",
                    "ottline 설정(Account)에서 확인한 페어링 또는 복구 코드를 입력하세요. ottline.app에 기록이 있어야 ChatGPT에서 읽을 내용이 생깁니다.",
                    "리뷰용 사용자명",
                    "앱 심사용으로만 사용",
                    "리뷰용 비밀번호",
                    "앱 심사용으로만 사용",
                    "리뷰용 자격증명은 플랫폼 심사자와 데모 계정 전용입니다.",
                    "읽기 전용 접근 허용",
                    "거부",
                    "사용자가 접근을 거부했습니다."
            );
        }

        return new AuthCopy(
                "en",
                "Authorize ottline for ChatGPT",
                "ottline for ChatGPT",
                "Authorize %s",
                "ChatGPT is requesting read-only access to your ottline recent logs and notes.",
                "Requested scopes",
                "Redirect URI",
                "Resource server",
                "Pairing code",
                "Enter your ottline pairing code",
                "Use the pairing or recovery code shown in ottline Settings / Account. ChatGPT only becomes useful after your ottline.app account already has recent logs.",
                "Review username",
                "Only for app review",
                "Review password",
                "Only for app review",
                "Review credentials are intended only for platform reviewers and demo accounts.",
                "Allow read-only access",
                "Deny",
                "The user denied access."
        );
    }

    private String localizeError(String error, AuthCopy copy) {
        if (!"ko".equals(copy.lang())) {
            return error;
        }

        return switch (error) {
            case "response_type must be code" -> "response_type은 code여야 합니다.";
            case "code_challenge_method must be S256" -> "code_challenge_method는 S256이어야 합니다.";
            case "Invalid client type" -> "유효하지 않은 클라이언트 타입입니다.";
            case "Client has no redirect URIs" -> "등록된 redirect URI가 없습니다.";
            case "redirect_uri is required" -> "redirect_uri가 필요합니다.";
            case "redirect_uri is not registered" -> "등록되지 않은 redirect_uri입니다.";
            case "code_challenge is required" -> "code_challenge이 필요합니다.";
            case "Pairing code is required" -> "페어링 코드가 필요합니다.";
            case "Invalid review credentials" -> "리뷰용 자격증명이 올바르지 않습니다.";
            case "Review credentials are not configured" -> "리뷰용 자격증명이 아직 설정되지 않았습니다.";
            default -> error;
        };
    }

    private record AuthCopy(
            String lang,
            String pageTitle,
            String eyebrow,
            String headingTemplate,
            String lead,
            String requestedScopesLabel,
            String redirectUriLabel,
            String resourceServerLabel,
            String pairingCodeLabel,
            String pairingCodePlaceholder,
            String pairingCodeHelp,
            String reviewUsernameLabel,
            String reviewUsernamePlaceholder,
            String reviewPasswordLabel,
            String reviewPasswordPlaceholder,
            String reviewPasswordHelp,
            String approveLabel,
            String denyLabel,
            String accessDeniedDescription
    ) {
    }
}
