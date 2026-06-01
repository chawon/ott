package app.ottline;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

final class WatchReminderTargets {
    static final class Target {
        final String packageName;
        final String key;
        final String label;

        Target(String packageName, String key, String label) {
            this.packageName = packageName;
            this.key = key;
            this.label = label;
        }
    }

    private static final Map<String, Target> TARGETS;

    static {
        Map<String, Target> targets = new HashMap<>();
        put(targets, "com.netflix.mediaclient", "netflix", "Netflix");
        put(targets, "com.netflix.ninja", "netflix", "Netflix");
        put(targets, "net.cj.cjhv.gs.tving", "tving", "TVING");
        put(targets, "kr.co.captv.pooqV2", "wavve", "Wavve");
        put(targets, "com.frograms.wplay", "watcha", "Watcha");
        put(targets, "com.coupang.mobile.play", "coupang", "Coupang Play");
        put(targets, "com.disney.disneyplus", "disney", "Disney+");
        put(targets, "com.amazon.avod.thirdpartyclient", "prime_video", "Prime Video");
        put(targets, "com.apple.atve.androidtv.appletv", "apple_tv", "Apple TV");
        TARGETS = Collections.unmodifiableMap(targets);
    }

    private WatchReminderTargets() {}

    static Map<String, Target> all() {
        return TARGETS;
    }

    static Target find(String packageName) {
        return resolve(packageName);
    }

    static boolean contains(String packageName) {
        return resolve(packageName) != null;
    }

    static Target resolve(String packageName) {
        if (packageName == null) return null;
        Target exact = TARGETS.get(packageName);
        if (exact != null) return exact;

        String lowerPackageName = packageName.toLowerCase(java.util.Locale.ROOT);
        if (lowerPackageName.contains("netflix")) {
            return new Target(packageName, "netflix", "Netflix");
        }
        if (lowerPackageName.contains("tving")) {
            return new Target(packageName, "tving", "TVING");
        }
        if (lowerPackageName.contains("pooq") || lowerPackageName.contains("wavve")) {
            return new Target(packageName, "wavve", "Wavve");
        }
        if (lowerPackageName.contains("watcha") || lowerPackageName.contains("wplay")) {
            return new Target(packageName, "watcha", "Watcha");
        }
        if (lowerPackageName.contains("coupang") && lowerPackageName.contains("play")) {
            return new Target(packageName, "coupang", "Coupang Play");
        }
        if (lowerPackageName.contains("disneyplus")) {
            return new Target(packageName, "disney", "Disney+");
        }
        if (lowerPackageName.contains("amazon")
                && (lowerPackageName.contains("avod")
                || lowerPackageName.contains("primevideo")
                || lowerPackageName.contains("prime.video"))) {
            return new Target(packageName, "prime_video", "Prime Video");
        }
        if (lowerPackageName.contains("apple")
                && (lowerPackageName.contains("atve")
                || lowerPackageName.contains("appletv")
                || lowerPackageName.contains("apple.tv"))) {
            return new Target(packageName, "apple_tv", "Apple TV");
        }

        return null;
    }

    private static void put(
            Map<String, Target> targets,
            String packageName,
            String key,
            String label
    ) {
        targets.put(packageName, new Target(packageName, key, label));
    }
}
