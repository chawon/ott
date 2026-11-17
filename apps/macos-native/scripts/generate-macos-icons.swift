#!/usr/bin/env swift
import AppKit
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let scriptUrl = URL(fileURLWithPath: CommandLine.arguments[0]).resolvingSymlinksInPath()
let macRoot = scriptUrl.deletingLastPathComponent().deletingLastPathComponent()
let assetsDir = macRoot.appendingPathComponent("Sources/OttlineMacApp/Resources/Assets.xcassets", isDirectory: true)
let appIconDir = assetsDir.appendingPathComponent("AppIcon.appiconset", isDirectory: true)
let menuBarDir = assetsDir.appendingPathComponent("menubar_icon.imageset", isDirectory: true)

let fm = FileManager.default
try fm.createDirectory(at: appIconDir, withIntermediateDirectories: true)
try fm.createDirectory(at: menuBarDir, withIntermediateDirectories: true)

func makeRgbaContext(size: Int) -> CGContext {
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bitmapInfo = CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue)
    guard let ctx = CGContext(
        data: nil,
        width: size,
        height: size,
        bitsPerComponent: 8,
        bytesPerRow: size * 4,
        space: colorSpace,
        bitmapInfo: bitmapInfo.rawValue
    ) else {
        fatalError("Failed to create RGBA CGContext for size \(size)")
    }
    ctx.setAllowsAntialiasing(true)
    ctx.setShouldAntialias(true)
    ctx.clear(CGRect(x: 0, y: 0, width: size, height: size))
    return ctx
}

func savePng(_ image: CGImage, to url: URL) throws {
    guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
        fatalError("Failed to create CGImageDestination for \(url.path)")
    }
    CGImageDestinationAddImage(dest, image, nil)
    if !CGImageDestinationFinalize(dest) {
        fatalError("Failed to write PNG at \(url.path)")
    }
}

func buildOttlineMarkPaths(scale s: CGFloat, ox: CGFloat, oy: CGFloat) -> (book: CGMutablePath, play: CGMutablePath) {
    func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
        CGPoint(x: ox + x * s, y: oy + y * s)
    }

    let book = CGMutablePath()
    book.move(to: p(14, 34))
    book.addLine(to: p(14, 28))
    book.addCurve(to: p(24, 18), control1: p(14, 22.477), control2: p(18.477, 18))
    book.addCurve(to: p(48, 27), control1: p(34, 18), control2: p(41.5, 21.8))
    book.addCurve(to: p(77, 18), control1: p(55.8, 21.8), control2: p(65.5, 18))
    book.addCurve(to: p(87, 28), control1: p(82.523, 18), control2: p(87, 22.477))
    book.addLine(to: p(87, 64))
    book.addCurve(to: p(77, 74), control1: p(87, 69.523), control2: p(82.523, 74))
    book.addCurve(to: p(51.5, 81), control1: p(66.5, 74), control2: p(57.2, 76.9))

    let play = CGMutablePath()
    play.move(to: p(15, 49))
    play.addLine(to: p(36.5, 62.75))
    play.addLine(to: p(15, 76.5))
    play.closeSubpath()

    return (book, play)
}

func generateAppIcon(size: Int) throws {
    let px = CGFloat(size)
    let ctx = makeRgbaContext(size: size)

    let inset = (100.0 / 1024.0) * px
    let rect = CGRect(x: inset, y: inset, width: px - 2.0 * inset, height: px - 2.0 * inset)
    let radius = (185.4 / 1024.0) * px
    let squirclePath = CGPath(
        roundedRect: rect,
        cornerWidth: radius,
        cornerHeight: radius,
        transform: nil
    )

    // Warm cream squircle with subtle macOS Dock drop shadow kept well inside the 100px transparent gutter
    ctx.saveGState()
    ctx.setShadow(
        offset: CGSize(width: 0, height: (-10.0 / 1024.0) * px),
        blur: (22.0 / 1024.0) * px,
        color: CGColor(red: 0, green: 0, blue: 0, alpha: 0.20)
    )
    ctx.addPath(squirclePath)
    ctx.setFillColor(CGColor(red: 248.0 / 255.0, green: 246.0 / 255.0, blue: 242.0 / 255.0, alpha: 1.0))
    ctx.fillPath()
    ctx.restoreGState()

    // Flip to top-left SVG coordinates
    ctx.translateBy(x: 0, y: px)
    ctx.scaleBy(x: 1, y: -1)

    // Crisp inner paper edge
    ctx.saveGState()
    ctx.addPath(squirclePath)
    ctx.clip()
    ctx.addPath(squirclePath)
    ctx.setStrokeColor(CGColor(red: 226.0 / 255.0, green: 223.0 / 255.0, blue: 215.0 / 255.0, alpha: 0.95))
    ctx.setLineWidth(max(1.0, (3.0 / 1024.0) * px))
    ctx.strokePath()
    ctx.restoreGState()

    // Canonical OttlineBrandMark inside squircle
    let s = (px * 0.58) / 96.0
    let ox = 0.5 * px - 50.0 * s
    let oy = 0.5 * px - 49.5 * s
    let paths = buildOttlineMarkPaths(scale: s, ox: ox, oy: oy)

    ctx.saveGState()
    ctx.addPath(paths.play)
    ctx.setFillColor(CGColor(red: 255.0 / 255.0, green: 153.0 / 255.0, blue: 51.0 / 255.0, alpha: 0.18))
    ctx.fillPath()
    ctx.restoreGState()

    ctx.saveGState()
    ctx.setStrokeColor(CGColor(red: 30.0 / 255.0, green: 77.0 / 255.0, blue: 140.0 / 255.0, alpha: 1.0))
    ctx.setLineWidth(8.0 * s)
    ctx.setLineCap(.round)
    ctx.setLineJoin(.round)
    ctx.addPath(paths.book)
    ctx.strokePath()
    ctx.addPath(paths.play)
    ctx.strokePath()
    ctx.restoreGState()

    guard let cgImage = ctx.makeImage() else {
        fatalError("Failed to create CGImage for AppIcon size \(size)")
    }
    try savePng(cgImage, to: appIconDir.appendingPathComponent("icon_\(size).png"))
}

func generateMenuBarIcon(size: Int, filename: String) throws {
    let px = CGFloat(size)
    let ctx = makeRgbaContext(size: size)

    ctx.translateBy(x: 0, y: px)
    ctx.scaleBy(x: 1, y: -1)

    let s = (px * 0.86) / 96.0
    let ox = 0.5 * px - 50.5 * s
    let oy = 0.5 * px - 49.5 * s
    let paths = buildOttlineMarkPaths(scale: s, ox: ox, oy: oy)

    ctx.saveGState()
    ctx.setStrokeColor(CGColor(red: 0, green: 0, blue: 0, alpha: 1.0))
    ctx.setLineWidth(8.4 * s)
    ctx.setLineCap(.round)
    ctx.setLineJoin(.round)
    ctx.addPath(paths.book)
    ctx.strokePath()
    ctx.addPath(paths.play)
    ctx.strokePath()
    ctx.restoreGState()

    guard let cgImage = ctx.makeImage() else {
        fatalError("Failed to create CGImage for menu bar icon size \(size)")
    }
    try savePng(cgImage, to: menuBarDir.appendingPathComponent(filename))
}

for size in [16, 32, 64, 128, 256, 512, 1024] {
    try generateAppIcon(size: size)
}

try generateMenuBarIcon(size: 18, filename: "menubar_icon_18.png")
try generateMenuBarIcon(size: 36, filename: "menubar_icon_36.png")

let menuBarContents = """
{
  "images" : [
    {
      "filename" : "menubar_icon_18.png",
      "idiom" : "mac",
      "scale" : "1x"
    },
    {
      "filename" : "menubar_icon_36.png",
      "idiom" : "mac",
      "scale" : "2x"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  },
  "properties" : {
    "template-rendering-intent" : "template"
  }
}
"""
try menuBarContents.write(
    to: menuBarDir.appendingPathComponent("Contents.json"),
    atomically: true,
    encoding: .utf8
)

print("Generated transparent RGBA macOS AppIcon and template menubar_icon assets successfully.")
