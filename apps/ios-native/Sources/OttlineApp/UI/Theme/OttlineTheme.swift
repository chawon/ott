import SwiftUI

public struct OttlinePalette: Equatable, Sendable {
    public let isDark: Bool
    public let background: Color
    public let card: Color
    public let paperStrong: Color
    public let sageAccent: Color
    public let border: Color
    public let mutedBg: Color
    public let ink: Color
    public let mutedInk: Color
    public let subtleInk: Color
    public let brandNavy: Color
    public let onBrandNavy: Color
    public let brandOrange: Color
    public let onBrandOrange: Color
    public let danger: Color
    public let dangerSoft: Color
    public let success: Color
    public let successSoft: Color

    public static let light = OttlinePalette(
        isDark: false,
        background: Color(hex: 0xF8F6F2),
        card: Color(hex: 0xFFFFFF),
        paperStrong: Color(hex: 0xFEF9EE),
        sageAccent: Color(hex: 0xFAF5D7),
        border: Color(hex: 0xE5E1DA),
        mutedBg: Color(hex: 0xECEBE9),
        ink: Color(hex: 0x0F0F0F),
        mutedInk: Color(hex: 0x4A4A4A),
        subtleInk: Color(hex: 0x76716A),
        brandNavy: Color(hex: 0x1E4D8C),
        onBrandNavy: Color(hex: 0xFFFFFF),
        brandOrange: Color(hex: 0xFF9933),
        onBrandOrange: Color(hex: 0x0F0F0F),
        danger: Color(hex: 0xC93B2B),
        dangerSoft: Color(hex: 0xFFF2F0),
        success: Color(hex: 0x1D7A4C),
        successSoft: Color(hex: 0xEBF7F0)
    )

    public static let dark = OttlinePalette(
        isDark: true,
        background: Color(hex: 0x15120F),
        card: Color(hex: 0x211C18),
        paperStrong: Color(hex: 0x2B241F),
        sageAccent: Color(hex: 0x3A3027),
        border: Color(hex: 0x3D342C),
        mutedBg: Color(hex: 0x2C251F),
        ink: Color(hex: 0xFFF8EF),
        mutedInk: Color(hex: 0xD8CFC4),
        subtleInk: Color(hex: 0x9C9184),
        brandNavy: Color(hex: 0x8BB4EE),
        onBrandNavy: Color(hex: 0x15120F),
        brandOrange: Color(hex: 0xFF9933),
        onBrandOrange: Color(hex: 0x0F0F0F),
        danger: Color(hex: 0xF0796B),
        dangerSoft: Color(hex: 0x3A201D),
        success: Color(hex: 0x62C894),
        successSoft: Color(hex: 0x1D3327)
    )

    public var primaryAccent: Color {
        isDark ? ink : brandNavy
    }
}

public extension Color {
    init(hex: UInt32, alpha: Double = 1.0) {
        let r = Double((hex >> 16) & 0xFF) / 255.0
        let g = Double((hex >> 8) & 0xFF) / 255.0
        let b = Double(hex & 0xFF) / 255.0
        self.init(.sRGB, red: r, green: g, blue: b, opacity: alpha)
    }
}

public enum OttlineFont {
    public static func regular(_ size: CGFloat) -> Font {
        .custom("Pretendard-Regular", size: size)
    }
    public static func medium(_ size: CGFloat) -> Font {
        .custom("Pretendard-Medium", size: size)
    }
    public static func semiBold(_ size: CGFloat) -> Font {
        .custom("Pretendard-SemiBold", size: size)
    }
    public static func bold(_ size: CGFloat) -> Font {
        .custom("Pretendard-Bold", size: size)
    }
    public static func extraBold(_ size: CGFloat) -> Font {
        .custom("Pretendard-ExtraBold", size: size)
    }
}

private struct OttlinePaletteKey: EnvironmentKey {
    static let defaultValue: OttlinePalette = .light
}

private struct OttlineLocaleKey: EnvironmentKey {
    static let defaultValue: String = "ko"
}

public extension EnvironmentValues {
    var ottlinePalette: OttlinePalette {
        get { self[OttlinePaletteKey.self] }
        set { self[OttlinePaletteKey.self] = newValue }
    }

    var appLocale: String {
        get { self[OttlineLocaleKey.self] }
        set { self[OttlineLocaleKey.self] = newValue }
    }
}
