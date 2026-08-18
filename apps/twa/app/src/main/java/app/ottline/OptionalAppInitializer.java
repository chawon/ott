package app.ottline;

final class OptionalAppInitializer {

    interface FailureReporter {
        void report(Throwable error);
    }

    private OptionalAppInitializer() {}

    static void run(Runnable initializer, FailureReporter failureReporter) {
        try {
            initializer.run();
        } catch (RuntimeException | LinkageError error) {
            failureReporter.report(error);
        }
    }
}
