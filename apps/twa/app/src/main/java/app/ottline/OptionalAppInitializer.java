package app.ottline;

import java.util.function.Consumer;

final class OptionalAppInitializer {

    private OptionalAppInitializer() {}

    static void run(Runnable initializer, Consumer<Throwable> failureReporter) {
        try {
            initializer.run();
        } catch (RuntimeException | LinkageError error) {
            failureReporter.accept(error);
        }
    }
}
