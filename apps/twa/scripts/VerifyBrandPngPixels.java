import java.awt.image.BufferedImage;
import java.io.File;
import javax.imageio.ImageIO;

public final class VerifyBrandPngPixels {
    private VerifyBrandPngPixels() {}

    public static void main(String[] args) throws Exception {
        if (args.length != 2) {
            System.err.println("Usage: VerifyBrandPngPixels.java <expected.png> <actual.png>");
            System.exit(2);
        }

        BufferedImage expected = readPng(args[0]);
        BufferedImage actual = readPng(args[1]);

        if (expected.getWidth() != actual.getWidth() || expected.getHeight() != actual.getHeight()) {
            System.err.printf(
                    "PNG dimensions differ: expected %dx%d, actual %dx%d%n",
                    expected.getWidth(),
                    expected.getHeight(),
                    actual.getWidth(),
                    actual.getHeight());
            System.exit(1);
        }

        for (int y = 0; y < expected.getHeight(); y++) {
            for (int x = 0; x < expected.getWidth(); x++) {
                int expectedPixel = expected.getRGB(x, y);
                int actualPixel = actual.getRGB(x, y);
                if (expectedPixel != actualPixel) {
                    System.err.printf(
                            "PNG pixels differ at (%d,%d): expected %08x, actual %08x%n",
                            x,
                            y,
                            expectedPixel,
                            actualPixel);
                    System.exit(1);
                }
            }
        }

        System.out.printf(
                "Verified identical decoded pixels: %s (%dx%d)%n",
                args[1],
                expected.getWidth(),
                expected.getHeight());
    }

    private static BufferedImage readPng(String path) throws Exception {
        BufferedImage image = ImageIO.read(new File(path));
        if (image == null) {
            throw new IllegalArgumentException("Not a readable PNG: " + path);
        }
        return image;
    }
}
