package com.watchlog.api.service;

import com.watchlog.api.domain.TitleEntity;
import com.watchlog.api.book.BookIsbn;
import com.watchlog.api.llm.RecommendationItem;

import java.text.Normalizer;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Stream;

/** Compare catalog identity first; fall back to names for old/local records. */
final class RecommendationTitleMatcher {
    private RecommendationTitleMatcher() {}

    static String normalize(String name) {
        return name == null ? "" : Normalizer.normalize(name, Normalizer.Form.NFKC)
                .toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]", "");
    }

    static Set<String> names(RecommendationItem item) {
        var names = new HashSet<String>();
        Stream.concat(Stream.of(item.name(), item.originalName()), item.alternateNames() == null ? Stream.empty() : item.alternateNames().stream())
                .map(RecommendationTitleMatcher::normalize).filter(n -> !n.isBlank()).forEach(names::add);
        return names;
    }

    static List<RecommendationItem> filter(List<RecommendationItem> items, List<TitleEntity> recorded, List<String> excluded) {
        return filter(items, recorded, excluded, List.of());
    }

    static List<RecommendationItem> filter(List<RecommendationItem> items, List<TitleEntity> recorded,
            List<String> excluded, List<RecommendationItem> storedExclusions) {
        Set<String> excludedNames = new HashSet<>();
        excluded.stream().map(RecommendationTitleMatcher::normalize).filter(n -> !n.isBlank()).forEach(excludedNames::add);
        var accepted = new java.util.ArrayList<RecommendationItem>();
        for (var item : items) {
            if (item == null || normalize(item.name()).isBlank()) continue;
            Set<String> names = names(item);
            if (names.stream().anyMatch(excludedNames::contains)) continue;
            if (recorded.stream().anyMatch(title -> matches(title, item, names))) continue;
            if (storedExclusions.stream().anyMatch(previous -> matches(previous, item))) continue;
            if (accepted.stream().anyMatch(previous -> matches(previous, item))) continue;
            accepted.add(item);
        }
        return List.copyOf(accepted);
    }

    private static boolean matches(TitleEntity title, RecommendationItem item, Set<String> names) {
        if (title.getType() == null || !title.getType().name().equals(item.type())) return false;
        if ("book".equals(item.type())) {
            return matches(new RecommendationItem(title.getName(), "book", "", List.of(), null,
                    title.getProvider(), title.getProviderId(), title.getYear(), List.of(), title.getAuthor(),
                    title.getIsbn10(), title.getIsbn13(), null, null), item);
        }
        if (comparableIds(title.getProvider(), title.getProviderId(), item.provider(), item.providerId())) {
            return title.getProviderId().equals(item.providerId());
        }
        if (title.getYear() != null && item.year() != null && Math.abs((long) title.getYear() - item.year()) > 1) return false;
        return names.contains(normalize(title.getName()));
    }

    static boolean matches(RecommendationItem first, RecommendationItem second) {
        // Old local exclusions did not store a type. Retain their original name-based meaning.
        if (first.type() != null && second.type() != null && !first.type().equals(second.type())) return false;
        boolean book = "book".equals(first.type()) && "book".equals(second.type());
        if (book) {
            String firstIsbn = isbn(first), secondIsbn = isbn(second);
            if (firstIsbn != null && firstIsbn.equals(secondIsbn)) return true;
        }
        if (comparableIds(first.provider(), first.providerId(), second.provider(), second.providerId())) {
            if (first.providerId().equals(second.providerId())) return true;
            if (!book) return false;
        }
        if (!book && first.year() != null && second.year() != null && Math.abs((long) first.year() - second.year()) > 1) return false;
        if (book && first.author() != null && second.author() != null && !authorsMatch(first.author(), second.author())) return false;
        Set<String> firstNames = names(first);
        return names(second).stream().anyMatch(firstNames::contains);
    }

    static boolean authorsMatch(String first, String second) {
        var names = java.util.Arrays.stream(first.split("[/,;|]")).map(RecommendationTitleMatcher::normalize)
                .filter(n -> !n.isBlank()).collect(java.util.stream.Collectors.toSet());
        return java.util.Arrays.stream(second.split("[/,;|]")).map(RecommendationTitleMatcher::normalize).anyMatch(names::contains);
    }

    static String isbn(RecommendationItem item) {
        return BookIsbn.parse((item.isbn13() == null ? "" : item.isbn13()) + " "
                + (item.isbn10() == null ? "" : item.isbn10())).isbn13();
    }

    static String key(RecommendationItem item) {
        String type = item.type() == null ? "legacy" : item.type();
        String identity;
        if ("book".equals(type) && !normalize(item.originalName()).isBlank() && !normalize(item.author()).isBlank()) {
            identity = "work:" + normalize(item.originalName()) + ":" + normalize(item.author().split("/")[0]);
        } else if ("book".equals(type) && isbn(item) != null) {
            identity = "isbn:" + isbn(item);
        } else if (item.provider() != null && !"LOCAL".equalsIgnoreCase(item.provider())
                && item.providerId() != null && !item.providerId().isBlank()) {
            identity = item.provider().toUpperCase(Locale.ROOT) + ":" + item.providerId();
        } else {
            identity = "name:" + normalize(item.name()) + ":" + normalize(item.author());
        }
        try {
            return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                    .digest((type + ":" + identity).getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }

    private static boolean comparableIds(String firstProvider, String firstId, String secondProvider, String secondId) {
        return firstProvider != null && secondProvider != null && !"LOCAL".equalsIgnoreCase(firstProvider)
                && firstProvider.equalsIgnoreCase(secondProvider) && firstId != null && !firstId.isBlank()
                && secondId != null && !secondId.isBlank();
    }
}
