package app.ottline;

import static org.junit.Assert.assertSame;

import java.util.concurrent.atomic.AtomicReference;

import org.junit.Test;

public class OptionalAppInitializerTest {

    @Test
    public void reportsRuntimeFailureWithoutPropagatingIt() {
        RuntimeException failure = new IllegalStateException("work manager unavailable");
        AtomicReference<Throwable> reported = new AtomicReference<>();

        OptionalAppInitializer.run(() -> {
            throw failure;
        }, reported::set);

        assertSame(failure, reported.get());
    }

    @Test
    public void reportsLinkageFailureWithoutPropagatingIt() {
        LinkageError failure = new NoClassDefFoundError("optimized dependency missing");
        AtomicReference<Throwable> reported = new AtomicReference<>();

        OptionalAppInitializer.run(() -> {
            throw failure;
        }, reported::set);

        assertSame(failure, reported.get());
    }

    @Test(expected = AssertionError.class)
    public void doesNotHideUnrelatedVirtualMachineErrors() {
        OptionalAppInitializer.run(() -> {
            throw new AssertionError("unexpected fatal error");
        }, ignored -> {});
    }
}
