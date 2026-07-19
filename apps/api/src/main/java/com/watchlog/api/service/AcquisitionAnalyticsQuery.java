package com.watchlog.api.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Session-first acquisition aggregation for web entry points.
 *
 * <p>An acquisition session exists only when a web, PWA, or TWA app-open event
 * exists in the requested window. Later behavior is joined by the same session
 * id; events without a qualifying app open are reported separately as orphans.
 */
@Component
public class AcquisitionAnalyticsQuery {

    private static final String EXCLUDED_ADMIN_ACTOR =
            "u:" + AnalyticsMetricsQuery.EXCLUDED_ADMIN_ID;
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final Set<String> OWNED_ENTRY_SOURCES = Set.of(
            "android-watch-reminder",
            "android-revisit-reminder"
    );

    private static final String SESSION_BASE_CTE = """
            with client_identity as (
                select
                    client_id,
                    case
                        when count(distinct user_id) = 1 then min(user_id::text)
                        else null
                    end as mapped_user_id
                from analytics_events
                where client_id is not null
                  and user_id is not null
                  and occurred_at < ?
                group by client_id
            ),
            resolved as (
                select
                    e.*,
                    case
                        when e.user_id is not null then 'u:' || e.user_id::text
                        when ci.mapped_user_id is not null then 'u:' || ci.mapped_user_id
                        when e.client_id is not null then 'c:' || e.client_id::text
                        when nullif(btrim(e.session_id), '') is not null then 's:' || btrim(e.session_id)
                        else null
                    end as actor_key
                from analytics_events e
                left join client_identity ci on ci.client_id = e.client_id
                where e.occurred_at >= ?
                  and e.occurred_at < ?
                  and e.platform in ('web', 'pwa', 'twa')
            ),
            base as (
                select
                    resolved.*,
                    coalesce(
                        nullif(btrim(session_id), ''),
                        'event:' || event_id::text
                    ) as acquisition_session_key
                from resolved
                where actor_key is distinct from ?
            )
            """;

    private static final String SESSION_QUERY = SESSION_BASE_CTE + """
            , ranked_app_opens as (
                select
                    base.*,
                    row_number() over (
                        partition by acquisition_session_key
                        order by occurred_at asc, event_id asc
                    ) as app_open_rank
                from base
                where event_name = 'app_open'
            ),
            app_open_sessions as (
                select *
                from ranked_app_opens
                where app_open_rank = 1
            )
            select
                app_open.occurred_at as opened_at,
                app_open.properties->>'utmSource' as utm_source,
                app_open.properties->>'utmMedium' as utm_medium,
                app_open.properties->>'utmCampaign' as utm_campaign,
                app_open.properties->>'entrySource' as entry_source,
                app_open.properties->>'referrer' as referrer,
                app_open.properties->>'landingPath' as landing_path,
                app_open.properties->>'locale' as locale,
                bool_or(activity.event_name in (
                    'title_search', 'title_select', 'login_success', 'first_log_create', 'log_create'
                )) as engaged,
                bool_or(activity.event_name = 'first_log_create') as first_log,
                bool_or(activity.event_name = 'log_create') as log_create
            from app_open_sessions app_open
            left join base activity
              on activity.acquisition_session_key = app_open.acquisition_session_key
            group by
                app_open.acquisition_session_key,
                app_open.occurred_at,
                app_open.event_id,
                app_open.properties
            order by app_open.occurred_at asc, app_open.event_id asc
            """;

    private static final String ORPHAN_QUERY = SESSION_BASE_CTE + """
            select count(distinct conversion.acquisition_session_key)
            from base conversion
            where conversion.event_name in (
                'title_search', 'title_select', 'login_success', 'first_log_create', 'log_create'
            )
              and not exists (
                  select 1
                  from base app_open
                  where app_open.event_name = 'app_open'
                    and app_open.acquisition_session_key = conversion.acquisition_session_key
              )
            """;

    private final JdbcTemplate jdbcTemplate;

    public AcquisitionAnalyticsQuery(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Result summarize(OffsetDateTime from, OffsetDateTime to) {
        validateRange(from, to);
        List<SessionRow> sessions = jdbcTemplate.query(
                SESSION_QUERY,
                (rs, rowNum) -> new SessionRow(
                        rs.getObject("opened_at", OffsetDateTime.class),
                        rs.getString("utm_source"),
                        rs.getString("utm_medium"),
                        rs.getString("utm_campaign"),
                        rs.getString("entry_source"),
                        rs.getString("referrer"),
                        rs.getString("landing_path"),
                        rs.getString("locale"),
                        rs.getBoolean("engaged"),
                        rs.getBoolean("first_log"),
                        rs.getBoolean("log_create")
                ),
                to,
                from,
                to,
                EXCLUDED_ADMIN_ACTOR
        );
        Long orphanCount = jdbcTemplate.queryForObject(
                ORPHAN_QUERY,
                Long.class,
                to,
                from,
                to,
                EXCLUDED_ADMIN_ACTOR
        );

        MutableMetrics total = new MutableMetrics();
        Map<String, MutableMetrics> byChannel = new LinkedHashMap<>();
        Map<String, MutableMetrics> bySource = new LinkedHashMap<>();
        Map<String, MutableMetrics> byLandingPath = new LinkedHashMap<>();
        Map<String, MutableMetrics> byLocale = new LinkedHashMap<>();
        Map<String, MutableMetrics> byCampaign = new LinkedHashMap<>();
        Map<LocalDate, MutableMetrics> daily = new LinkedHashMap<>();

        for (SessionRow session : sessions) {
            Attribution attribution = classifyAttribution(
                    session.utmSource(),
                    session.utmMedium(),
                    session.entrySource(),
                    session.referrer()
            );
            String landingPath = normalizeLandingPath(session.landingPath());
            String locale = normalizeLocale(session.locale());
            String campaign = normalizeCampaign(session.utmCampaign());
            LocalDate day = session.openedAt().atZoneSameInstant(KST).toLocalDate();

            total.add(session);
            byChannel.computeIfAbsent(attribution.channel(), ignored -> new MutableMetrics()).add(session);
            bySource.computeIfAbsent(attribution.source(), ignored -> new MutableMetrics()).add(session);
            byLandingPath.computeIfAbsent(landingPath, ignored -> new MutableMetrics()).add(session);
            byLocale.computeIfAbsent(locale, ignored -> new MutableMetrics()).add(session);
            byCampaign.computeIfAbsent(campaign, ignored -> new MutableMetrics()).add(session);
            daily.computeIfAbsent(day, ignored -> new MutableMetrics()).add(session);
        }

        return new Result(
                total.toMetrics(),
                dimensions(byChannel),
                dimensions(bySource),
                dimensions(byLandingPath),
                dimensions(byLocale),
                dimensions(byCampaign),
                daily.entrySet().stream()
                        .sorted(Map.Entry.comparingByKey())
                        .map(entry -> new DailyMetrics(entry.getKey(), entry.getValue().toMetrics()))
                        .toList(),
                orphanCount == null ? 0 : orphanCount
        );
    }

    static Attribution classifyAttribution(
            String utmSource,
            String utmMedium,
            String entrySource,
            String referrer
    ) {
        String normalizedUtmSource = normalizeToken(utmSource);
        String normalizedMedium = normalizeToken(utmMedium);
        if (isMeaningfulUtmSource(normalizedUtmSource)) {
            String source = canonicalSource(normalizedUtmSource);
            return new Attribution(channelForUtm(source, normalizedMedium), source);
        }

        String normalizedEntrySource = normalizeToken(entrySource);
        if (normalizedEntrySource != null && OWNED_ENTRY_SOURCES.contains(normalizedEntrySource)) {
            return new Attribution("owned_reengagement", normalizedEntrySource);
        }

        String normalizedReferrer = clean(referrer);
        if (normalizedReferrer == null || "direct".equalsIgnoreCase(normalizedReferrer)) {
            return new Attribution("direct", "direct");
        }
        if ("unknown".equalsIgnoreCase(normalizedReferrer)) {
            return new Attribution("unknown", "unknown");
        }

        String host = referrerHost(normalizedReferrer);
        if (host == null) {
            return new Attribution("unknown", "unknown");
        }
        if (isSelfHost(host)) {
            return new Attribution("direct", "direct");
        }
        if (isHost(host, "ott.preview.pe.kr")) {
            return new Attribution("owned_reengagement", "legacy_domain");
        }

        String source = canonicalHostSource(host);
        return new Attribution(channelForKnownSource(source), source);
    }

    private static String channelForUtm(String source, String medium) {
        String safeMedium = medium == null ? "" : medium;
        if (Set.of("cpc", "ppc", "paid-search", "paidsearch", "sem").contains(safeMedium)) {
            return "paid_search";
        }
        if (Set.of("email", "push", "notification", "reminder", "owned").contains(safeMedium)) {
            return "owned_reengagement";
        }
        if (safeMedium.contains("social") || "social".equals(channelForKnownSource(source))) {
            return "social";
        }
        String sourceChannel = channelForKnownSource(source);
        if (!"referral".equals(sourceChannel)) {
            return sourceChannel;
        }
        if (Set.of("organic", "search").contains(safeMedium) && isSearchSource(source)) {
            return "organic_search";
        }
        return "referral";
    }

    private static String channelForKnownSource(String source) {
        if (isSearchSource(source)) return "organic_search";
        if (Set.of("chatgpt", "perplexity", "claude", "gemini", "copilot").contains(source)) {
            return "ai_referral";
        }
        if (Set.of(
                "instagram", "facebook", "x", "threads", "youtube", "linkedin", "reddit", "kakao"
        ).contains(source)) {
            return "social";
        }
        if (Set.of(
                "google_play", "app_store", "microsoft_store", "chrome_web_store", "edge_addons", "whale_store"
        ).contains(source)) {
            return "store_referral";
        }
        if ("legacy_domain".equals(source) || OWNED_ENTRY_SOURCES.contains(source)) {
            return "owned_reengagement";
        }
        return "referral";
    }

    private static boolean isSearchSource(String source) {
        return Set.of("google", "naver", "bing", "daum", "yahoo", "duckduckgo", "baidu", "yandex")
                .contains(source);
    }

    private static String canonicalSource(String source) {
        return switch (source) {
            case "googleadwords", "google-ads", "adwords" -> "google";
            case "fb", "facebook-ads" -> "facebook";
            case "twitter" -> "x";
            case "apple", "ios-app-store" -> "app_store";
            case "play-store", "google-play" -> "google_play";
            default -> source;
        };
    }

    private static String canonicalHostSource(String host) {
        if (isHost(host, "gemini.google.com")) return "gemini";
        if (isHost(host, "play.google.com")) return "google_play";
        if (isHost(host, "chromewebstore.google.com")) return "chrome_web_store";
        if (isHost(host, "store.whale.naver.com")) return "whale_store";
        if (isGoogleHost(host)) return "google";
        if (isHost(host, "naver.com")) return "naver";
        if (isHost(host, "bing.com")) return "bing";
        if (isHost(host, "daum.net")) return "daum";
        if (isHost(host, "yahoo.com")) return "yahoo";
        if (isHost(host, "duckduckgo.com")) return "duckduckgo";
        if (isHost(host, "baidu.com")) return "baidu";
        if (host.equals("yandex.ru") || host.endsWith(".yandex.ru") || host.startsWith("yandex.")) return "yandex";
        if (isHost(host, "chatgpt.com") || isHost(host, "openai.com")) return "chatgpt";
        if (isHost(host, "perplexity.ai")) return "perplexity";
        if (isHost(host, "claude.ai")) return "claude";
        if (isHost(host, "copilot.microsoft.com")) return "copilot";
        if (isHost(host, "instagram.com")) return "instagram";
        if (isHost(host, "facebook.com")) return "facebook";
        if (isHost(host, "x.com") || isHost(host, "twitter.com") || isHost(host, "t.co")) return "x";
        if (isHost(host, "threads.net")) return "threads";
        if (isHost(host, "youtube.com") || isHost(host, "youtu.be")) return "youtube";
        if (isHost(host, "linkedin.com")) return "linkedin";
        if (isHost(host, "reddit.com")) return "reddit";
        if (isHost(host, "kakao.com")) return "kakao";
        if (isHost(host, "apps.apple.com")) return "app_store";
        if (isHost(host, "apps.microsoft.com")) return "microsoft_store";
        if (isHost(host, "microsoftedge.microsoft.com")) return "edge_addons";
        return normalizeToken(host.startsWith("www.") ? host.substring(4) : host);
    }

    private static boolean isGoogleHost(String host) {
        return host.equals("google.com")
                || host.startsWith("google.")
                || host.contains(".google.");
    }

    private static boolean isSelfHost(String host) {
        return isHost(host, "ottline.app")
                || "localhost".equals(host)
                || "127.0.0.1".equals(host);
    }

    private static boolean isHost(String host, String domain) {
        return host.equals(domain) || host.endsWith("." + domain);
    }

    private static String referrerHost(String referrer) {
        try {
            URI uri = URI.create(referrer);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (host == null || !("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))) {
                return null;
            }
            return host.toLowerCase(Locale.ROOT);
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private static boolean isMeaningfulUtmSource(String value) {
        return value != null && !Set.of("direct", "none", "not-set", "null", "unknown").contains(value);
    }

    private static String normalizeLandingPath(String value) {
        String path = clean(value);
        if (path == null || !path.startsWith("/")) return "unknown";
        int queryIndex = path.indexOf('?');
        int fragmentIndex = path.indexOf('#');
        int endIndex = path.length();
        if (queryIndex >= 0) endIndex = Math.min(endIndex, queryIndex);
        if (fragmentIndex >= 0) endIndex = Math.min(endIndex, fragmentIndex);
        String normalized = path.substring(0, endIndex);
        return normalized.substring(0, Math.min(normalized.length(), 256));
    }

    private static String normalizeLocale(String value) {
        String locale = normalizeToken(value);
        if (locale == null) return "unknown";
        if (locale.equals("ko") || locale.startsWith("ko-")) return "ko";
        if (locale.equals("en") || locale.startsWith("en-")) return "en";
        return "unknown";
    }

    private static String normalizeCampaign(String value) {
        String campaign = normalizeToken(value);
        return campaign == null ? "none" : campaign;
    }

    private static String normalizeToken(String value) {
        String cleaned = clean(value);
        if (cleaned == null) return null;
        String normalized = cleaned.toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}._-]+", "-")
                .replaceAll("-{2,}", "-")
                .replaceAll("^-|-$", "");
        if (normalized.isBlank()) return null;
        return normalized.substring(0, Math.min(normalized.length(), 128));
    }

    private static String clean(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static List<DimensionMetrics> dimensions(Map<String, MutableMetrics> source) {
        return source.entrySet().stream()
                .map(entry -> new DimensionMetrics(entry.getKey(), entry.getValue().toMetrics()))
                .sorted(Comparator
                        .comparingLong((DimensionMetrics row) -> row.metrics().sessions()).reversed()
                        .thenComparing(DimensionMetrics::key))
                .toList();
    }

    private static void validateRange(OffsetDateTime from, OffsetDateTime to) {
        Objects.requireNonNull(from, "from is required");
        Objects.requireNonNull(to, "to is required");
        if (!from.isBefore(to)) {
            throw new IllegalArgumentException("from must be before to");
        }
    }

    private static final class MutableMetrics {
        private long sessions;
        private long engagedSessions;
        private long firstLogSessions;
        private long logCreateSessions;

        void add(SessionRow session) {
            sessions += 1;
            if (session.engaged()) engagedSessions += 1;
            if (session.firstLog()) firstLogSessions += 1;
            if (session.logCreate()) logCreateSessions += 1;
        }

        Metrics toMetrics() {
            return new Metrics(sessions, engagedSessions, firstLogSessions, logCreateSessions);
        }
    }

    private record SessionRow(
            OffsetDateTime openedAt,
            String utmSource,
            String utmMedium,
            String utmCampaign,
            String entrySource,
            String referrer,
            String landingPath,
            String locale,
            boolean engaged,
            boolean firstLog,
            boolean logCreate
    ) {}

    record Attribution(String channel, String source) {}

    public record Metrics(
            long sessions,
            long engagedSessions,
            long firstLogSessions,
            long logCreateSessions
    ) {}

    public record DimensionMetrics(String key, Metrics metrics) {}

    public record DailyMetrics(LocalDate day, Metrics metrics) {}

    public record Result(
            Metrics summary,
            List<DimensionMetrics> byChannel,
            List<DimensionMetrics> bySource,
            List<DimensionMetrics> byLandingPath,
            List<DimensionMetrics> byLocale,
            List<DimensionMetrics> byCampaign,
            List<DailyMetrics> daily,
            long orphanConversionSessions
    ) {}
}
