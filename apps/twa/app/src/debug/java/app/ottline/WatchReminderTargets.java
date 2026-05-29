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
        put(targets, "net.cj.cjhv.gs.tving", "tving", "TVING");
        put(targets, "kr.co.captv.pooqV2", "wavve", "Wavve");
        put(targets, "com.frograms.wplay", "watcha", "Watcha");
        put(targets, "com.coupang.mobile.play", "coupang", "Coupang Play");
        put(targets, "com.disney.disneyplus", "disney", "Disney+");
        TARGETS = Collections.unmodifiableMap(targets);
    }

    private WatchReminderTargets() {}

    static Map<String, Target> all() {
        return TARGETS;
    }

    static Target find(String packageName) {
        return TARGETS.get(packageName);
    }

    static boolean contains(String packageName) {
        return TARGETS.containsKey(packageName);
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
