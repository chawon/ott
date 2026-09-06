package com.watchlog.api.notify;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("curator.automation")
public record CuratorAutomationProperties(boolean enabled, String approverUserId, String locale,
                                           int dailyLimit, int pendingLimit) {
    public CuratorAutomationProperties {
        approverUserId = approverUserId == null ? "" : approverUserId.trim();
        locale = locale == null ? "ko" : locale;
        if (!locale.equals("ko") && !locale.equals("en")) throw new IllegalArgumentException("Curator locale must be ko or en");
        dailyLimit = Math.max(1, Math.min(dailyLimit, 2));
        pendingLimit = Math.max(1, Math.min(pendingLimit, 4));
        if (enabled && !approverUserId.matches("[1-9][0-9]*")) {
            throw new IllegalArgumentException("Curator requires a numeric Telegram approver user ID");
        }
    }
}
