package com.watchlog.api.chatgpt;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "chatgpt")
public class ChatGptProperties {

    private String appSecret = "";
    private String oauthIssuer = "http://localhost:3000/chatgpt/oauth";
    private String resourceServerUrl = "http://localhost:3000/chatgpt/mcp";
    private String resourceDocumentationUrl = "http://localhost:3000/chatgpt";
    private long authorizationCodeTtlSeconds = 600;
    private long accessTokenTtlSeconds = 3600;
    private String reviewUsername = "";
    private String reviewPassword = "";
    private String reviewPairingCode = "";

    public String getAppSecret() {
        return appSecret;
    }

    public void setAppSecret(String appSecret) {
        this.appSecret = appSecret;
    }

    public String getOauthIssuer() {
        return oauthIssuer;
    }

    public void setOauthIssuer(String oauthIssuer) {
        this.oauthIssuer = oauthIssuer;
    }

    public String getResourceServerUrl() {
        return resourceServerUrl;
    }

    public void setResourceServerUrl(String resourceServerUrl) {
        this.resourceServerUrl = resourceServerUrl;
    }

    public String getResourceDocumentationUrl() {
        return resourceDocumentationUrl;
    }

    public void setResourceDocumentationUrl(String resourceDocumentationUrl) {
        this.resourceDocumentationUrl = resourceDocumentationUrl;
    }

    public long getAuthorizationCodeTtlSeconds() {
        return authorizationCodeTtlSeconds;
    }

    public void setAuthorizationCodeTtlSeconds(long authorizationCodeTtlSeconds) {
        this.authorizationCodeTtlSeconds = authorizationCodeTtlSeconds;
    }

    public long getAccessTokenTtlSeconds() {
        return accessTokenTtlSeconds;
    }

    public void setAccessTokenTtlSeconds(long accessTokenTtlSeconds) {
        this.accessTokenTtlSeconds = accessTokenTtlSeconds;
    }

    public String getReviewUsername() {
        return reviewUsername;
    }

    public void setReviewUsername(String reviewUsername) {
        this.reviewUsername = reviewUsername;
    }

    public String getReviewPassword() {
        return reviewPassword;
    }

    public void setReviewPassword(String reviewPassword) {
        this.reviewPassword = reviewPassword;
    }

    public String getReviewPairingCode() {
        return reviewPairingCode;
    }

    public void setReviewPairingCode(String reviewPairingCode) {
        this.reviewPairingCode = reviewPairingCode;
    }
}
