package com.watchlog.api.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.watchlog.api.chatgpt.ChatGptProperties;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Map;

@Service
public class ChatGptTokenService {

    private static final String TOKEN_PREFIX = "ottcg";
    private static final String TOKEN_VERSION = "v1";

    private final ChatGptProperties properties;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ChatGptTokenService(ChatGptProperties properties) {
        this.properties = properties;
    }

    public String sign(Map<String, Object> payload) {
        if (properties.getAppSecret() == null || properties.getAppSecret().isBlank()) {
            throw new IllegalStateException("CHATGPT_APP_SECRET is required");
        }
        try {
            String payloadSegment = base64UrlEncode(objectMapper.writeValueAsBytes(payload));
            String signatureSegment = signPayloadSegment(payloadSegment);
            return String.join(".", TOKEN_PREFIX, TOKEN_VERSION, payloadSegment, signatureSegment);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to sign token", e);
        }
    }

    public Map<String, Object> verify(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 4) {
                throw new IllegalArgumentException("Malformed token");
            }
            if (!TOKEN_PREFIX.equals(parts[0]) || !TOKEN_VERSION.equals(parts[1])) {
                throw new IllegalArgumentException("Unsupported token version");
            }

            String payloadSegment = parts[2];
            String signatureSegment = parts[3];
            String expected = signPayloadSegment(payloadSegment);
            if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), signatureSegment.getBytes(StandardCharsets.UTF_8))) {
                throw new IllegalArgumentException("Invalid token signature");
            }

            Map<String, Object> payload = objectMapper.readValue(
                    base64UrlDecode(payloadSegment),
                    new TypeReference<>() {}
            );
            Number exp = (Number) payload.get("exp");
            long nowSeconds = System.currentTimeMillis() / 1000;
            if (exp == null || exp.longValue() <= nowSeconds) {
                throw new IllegalArgumentException("Expired token");
            }
            return payload;
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid token", e);
        }
    }

    private String signPayloadSegment(String payloadSegment) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(properties.getAppSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return base64UrlEncode(mac.doFinal(payloadSegment.getBytes(StandardCharsets.UTF_8)));
    }

    private String base64UrlEncode(byte[] value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }

    private byte[] base64UrlDecode(String value) {
        return Base64.getUrlDecoder().decode(value);
    }
}
