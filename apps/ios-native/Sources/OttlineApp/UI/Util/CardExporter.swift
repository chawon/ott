import Foundation
#if canImport(UIKit)
import UIKit
#endif

public enum ShareCardRatio: String, CaseIterable, Sendable {
    case story9x16 = "9:16"
    case feed4x5 = "4:5"

    public var width: Int { 1080 }
    public var height: Int { self == .story9x16 ? 1920 : 1350 }
}

public enum RecapCardKind: String, CaseIterable, Sendable {
    case weekly = "WEEKLY"
    case monthly = "MONTHLY"
    case halfYear = "HALF_YEAR"
}

#if canImport(UIKit)
public enum CardExporter {

    private static func pretendardFont(name: String, size: CGFloat, weight: UIFont.Weight) -> UIFont {
        UIFont(name: name, size: size) ?? UIFont.systemFont(ofSize: size, weight: weight)
    }

    // MARK: - 1. Log Share Card (`1080x1920` or `1080x1350`)

    public static func renderShareCardImage(
        log: WatchLog,
        ratio: ShareCardRatio,
        includeMoment: Bool = true,
        includeNote: Bool = true,
        includeSignature: Bool = false,
        nickname: String? = nil,
        personaKey: PersonaKey? = nil,
        locale: String = "ko"
    ) async -> UIImage {
        let w = CGFloat(ratio.width)
        let h = CGFloat(ratio.height)
        let scale: CGFloat = ratio == .feed4x5 ? 0.8 : 1.0
        func s(_ val: CGFloat) -> CGFloat { (val * scale).rounded() }

        let isBook = log.title.type == .book
        let posterUrl = (log.seasonPosterUrl?.isEmpty == false ? log.seasonPosterUrl : log.title.posterUrl)
        let posterImage = await fetchRemoteImage(tmdbResizeUrl(posterUrl, bucket: "w780") ?? posterUrl)

        let format = UIGraphicsImageRendererFormat()
        format.scale = 1.0
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: w, height: h), format: format)

        return renderer.image { ctx in
            let cg = ctx.cgContext
            let topHeight = h * 0.70
            let topColor = UIColor(red: 0.043, green: 0.047, blue: 0.063, alpha: 1.0) // #0B0C10
            let contentBgColor = UIColor(red: 0.043, green: 0.071, blue: 0.141, alpha: 1.0) // #0B1224

            topColor.setFill()
            cg.fill(CGRect(x: 0, y: 0, width: w, height: topHeight))
            contentBgColor.setFill()
            cg.fill(CGRect(x: 0, y: topHeight, width: w, height: h - topHeight))

            if let posterImage {
                drawAspectFill(
                    image: posterImage,
                    in: CGRect(x: 0, y: 0, width: w, height: topHeight),
                    verticalAnchor: isBook ? 0.0 : 0.12
                )
            } else {
                let fallbackFont = pretendardFont(name: "Pretendard-Bold", size: s(52), weight: .bold)
                let attrs: [NSAttributedString.Key: Any] = [
                    .font: fallbackFont,
                    .foregroundColor: UIColor.white.withAlphaComponent(0.35)
                ]
                (log.title.name as NSString).draw(
                    in: CGRect(x: s(88), y: topHeight * 0.4, width: w - s(176), height: s(200)),
                    withAttributes: attrs
                )
            }

            // Gradient fade at bottom 36% of poster area
            let gradTop = topHeight * 0.64
            let colors = [contentBgColor.withAlphaComponent(0.0).cgColor, contentBgColor.cgColor] as CFArray
            if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0.0, 1.0]) {
                cg.saveGState()
                cg.addRect(CGRect(x: 0, y: gradTop, width: w, height: topHeight - gradTop + 2))
                cg.clip()
                cg.drawLinearGradient(
                    gradient,
                    start: CGPoint(x: 0, y: gradTop),
                    end: CGPoint(x: 0, y: topHeight + 2),
                    options: []
                )
                cg.restoreGState()
            }

            // Content Stack
            let contentLeft = s(88)
            let maxWidth = w - s(176)
            var cursorY = topHeight + s(64)

            let titleFont = pretendardFont(name: "Pretendard-Bold", size: s(isBook ? 64 : 80), weight: .bold)
            let titleText = String(log.title.name.prefix(60))
            let titleRect = drawWrappedText(
                titleText,
                font: titleFont,
                color: .white,
                x: contentLeft,
                y: cursorY,
                maxWidth: maxWidth,
                maxHeight: s(190)
            )
            cursorY += titleRect.height + s(18)

            if includeNote, let note = log.note?.trimmingCharacters(in: .whitespacesAndNewlines), !note.isEmpty {
                let clamped = String(note.replacingOccurrences(of: "\n", with: " ").prefix(isBook ? 110 : 80))
                let noteFont = pretendardFont(name: "Pretendard-SemiBold", size: s(38), weight: .semibold)
                let noteColor = UIColor(red: 0.859, green: 0.894, blue: 1.0, alpha: 1.0) // #DBE4FF
                let noteRect = drawWrappedText(
                    "“\(clamped)”",
                    font: noteFont,
                    color: noteColor,
                    x: contentLeft,
                    y: cursorY,
                    maxWidth: maxWidth,
                    maxHeight: s(130)
                )
                cursorY += noteRect.height + s(18)
            }

            // Capsule pills
            let statusLabel = OttlineStrings.statusLabel(log.status, type: log.title.type, locale: locale)
            let feelingLabel = includeMoment ? RecordFeelings.resolveFeeling(rating: log.rating, isBook: isBook, locale: locale)?.label : nil
            let dateStr = RecordDate.recordDateInput(log.watchedAt.isEmpty ? log.createdAt : log.watchedAt).replacingOccurrences(of: "-", with: ".")

            var pills = ["👀 \(statusLabel)"]
            if let feelingLabel { pills.append("✨ \(feelingLabel)") }
            pills.append("🗓 \(dateStr)")

            let pillFont = pretendardFont(name: "Pretendard-SemiBold", size: s(26), weight: .semibold)
            let pillTextColor = UIColor(red: 0.796, green: 0.835, blue: 0.961, alpha: 1.0)
            var pillX = contentLeft
            let pillH = s(48)

            for pill in pills {
                let textSize = (pill as NSString).size(withAttributes: [.font: pillFont])
                let pillW = textSize.width + s(32)
                let rect = CGRect(x: pillX, y: cursorY, width: pillW, height: pillH)
                let path = UIBezierPath(roundedRect: rect, cornerRadius: pillH / 2)
                UIColor.white.withAlphaComponent(0.08).setFill()
                path.fill()
                (pill as NSString).draw(
                    at: CGPoint(x: pillX + s(16), y: cursorY + (pillH - textSize.height) / 2),
                    withAttributes: [.font: pillFont, .foregroundColor: pillTextColor]
                )
                pillX += pillW + s(12)
            }

            // Footer signature
            let footerY = h - s(92)
            let wmFont = pretendardFont(name: "Pretendard-SemiBold", size: s(26), weight: .semibold)
            let footerText: String = {
                if includeSignature, let nick = nickname?.trimmingCharacters(in: .whitespacesAndNewlines), !nick.isEmpty {
                    return "\(nick) · by ottline.app"
                }
                return "ottline.app"
            }()
            (footerText as NSString).draw(
                at: CGPoint(x: contentLeft, y: footerY),
                withAttributes: [.font: wmFont, .foregroundColor: UIColor.white.withAlphaComponent(0.78)]
            )
        }
    }

    // MARK: - 2. 9:16 Story Recap Card (`1080x1920`)

    public static func renderRecapCardImage(
        kind: RecapCardKind,
        report: PersonalReport,
        monthPosters: [SeasonalRecapPoster] = [],
        nickname: String? = nil,
        locale: String = "ko"
    ) async -> UIImage {
        let w: CGFloat = 1080
        let h: CGFloat = 1920
        let heroHeight: CGFloat = 1040
        let isEn = locale == "en"
        let topGenre = report.monthlyTopGenre.isEmpty ? "-" : report.monthlyTopGenre

        let (badge, headline, subtitle, metrics, posters): (String, String, String, [(String, String)], [SeasonalRecapPoster]) = {
            switch kind {
            case .weekly:
                return (
                    "WEEKLY",
                    isEn ? "Weekly record recap" : "지난주 기록 회고",
                    isEn
                        ? "\(report.previousWeekLogs) records from last week, gathered into one card."
                        : "지난주 남긴 \(report.previousWeekLogs)개의 기록을 한 장에 모았습니다.",
                    [
                        (isEn ? "Last week" : "지난주 기록", "\(report.previousWeekLogs)"),
                        (isEn ? "Total records" : "총 기록", "\(report.totalLogs)"),
                        (isEn ? "Streak" : "연속 기록", "\(report.streakDays)")
                    ],
                    Array((report.previousWeekPosters ?? []).prefix(6))
                )
            case .monthly:
                return (
                    "MONTHLY",
                    isEn ? "Monthly genre recap" : "이번 달 장르 회고",
                    topGenre != "-"
                        ? (isEn
                            ? "Your most logged genre this month is \(topGenre) (\(report.monthlyTopGenreCount))."
                            : "이번 달 가장 많이 남긴 장르는 \(topGenre)입니다. 총 \(report.monthlyTopGenreCount)회 기록했어요.")
                        : (isEn
                            ? "Log more this month to enrich your genre card."
                            : "이번 달 기록을 더 남기면 장르 회고 카드가 풍성해집니다."),
                    [
                        (isEn ? "This month" : "이번 달 기록", "\(report.thisMonthLogs)"),
                        (isEn ? "Top genre" : "이번 달 최다 장르", topGenre),
                        (isEn ? "With note" : "메모 비율", "\(report.noteFillPct)%")
                    ],
                    Array((monthPosters.isEmpty ? (report.previousWeekPosters ?? []) : monthPosters).prefix(6))
                )
            case .halfYear:
                let h1Count = report.seasonalRecap?.totalLogs ?? report.totalLogs
                return (
                    isEn ? "Jan 1 - Jun 30, 2026" : "2026.01.01 - 2026.06.30",
                    isEn ? "2026 first-half recap" : "2026년 상반기 돌아보기",
                    isEn
                        ? "A poster recap of your \(h1Count) records from H1 2026."
                        : "상반기에 남긴 \(h1Count)개의 기록을 포스터 카드로 모았어요.",
                    [
                        (isEn ? "H1 records" : "상반기 기록", "\(h1Count)"),
                        (isEn ? "Top type" : "최다 종류", report.seasonalRecap?.topType ?? report.topType),
                        (isEn ? "With note" : "메모 비율", "\(report.seasonalRecap?.noteFillPct ?? report.noteFillPct)%")
                    ],
                    Array((report.seasonalRecap?.posters ?? monthPosters).prefix(6))
                )
            }
        }()

        var posterImages: [UIImage?] = []
        for p in posters {
            let img = await fetchRemoteImage(tmdbResizeUrl(p.posterUrl, bucket: "w500") ?? p.posterUrl)
            posterImages.append(img)
        }

        let format = UIGraphicsImageRendererFormat()
        format.scale = 1.0
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: w, height: h), format: format)

        return renderer.image { ctx in
            let cg = ctx.cgContext
            let cream = UIColor(red: 0.973, green: 0.965, blue: 0.949, alpha: 1.0) // #F8F6F2
            cream.setFill()
            cg.fill(CGRect(x: 0, y: 0, width: w, height: h))

            // Hero Mosaic
            let slots = mosaicSlots(count: posters.count, heroHeight: heroHeight)
            for (idx, slot) in slots.enumerated() {
                let fallbackFill = idx % 2 == 0
                    ? UIColor(red: 0.129, green: 0.122, blue: 0.110, alpha: 1.0)
                    : UIColor(red: 0.227, green: 0.200, blue: 0.169, alpha: 1.0)
                fallbackFill.setFill()
                cg.fill(slot)

                if idx < posterImages.count, let img = posterImages[idx] {
                    drawAspectFill(image: img, in: slot, verticalAnchor: 0.25)
                } else if idx < posters.count {
                    let tFont = pretendardFont(name: "Pretendard-Bold", size: 30, weight: .bold)
                    (posters[idx].title as NSString).draw(
                        in: slot.insetBy(dx: 24, dy: 24),
                        withAttributes: [.font: tFont, .foregroundColor: UIColor.white]
                    )
                }
                cream.setStroke()
                cg.setLineWidth(6)
                cg.stroke(slot)
            }

            // Bottom Content
            let left: CGFloat = 72
            let contentW: CGFloat = w - 144
            var y: CGFloat = heroHeight + 62

            let orange = UIColor(red: 1.0, green: 0.6, blue: 0.2, alpha: 1.0) // #FF9933
            let ink = UIColor(red: 0.059, green: 0.059, blue: 0.059, alpha: 1.0) // #0F0F0F
            let muted = UIColor(red: 0.29, green: 0.29, blue: 0.29, alpha: 1.0) // #4A4A4A
            let border = UIColor(red: 0.925, green: 0.922, blue: 0.914, alpha: 1.0) // #ECEBE9

            let badgeFont = pretendardFont(name: "Pretendard-Bold", size: 26, weight: .bold)
            let badgeSize = (badge as NSString).size(withAttributes: [.font: badgeFont])
            let badgeRect = CGRect(x: left, y: y, width: badgeSize.width + 32, height: 50)
            UIColor.white.setFill()
            UIBezierPath(roundedRect: badgeRect, cornerRadius: 8).fill()
            border.setStroke()
            UIBezierPath(roundedRect: badgeRect, cornerRadius: 8).stroke()
            (badge as NSString).draw(at: CGPoint(x: left + 16, y: y + 10), withAttributes: [.font: badgeFont, .foregroundColor: orange])
            y += 72

            let headFont = pretendardFont(name: "Pretendard-Bold", size: 70, weight: .bold)
            let headRect = drawWrappedText(headline, font: headFont, color: ink, x: left, y: y, maxWidth: contentW, maxHeight: 160)
            y += headRect.height + 18

            let subFont = pretendardFont(name: "Pretendard-Regular", size: 34, weight: .regular)
            let subRect = drawWrappedText(subtitle, font: subFont, color: muted, x: left, y: y, maxWidth: contentW, maxHeight: 110)
            y += subRect.height + 28

            let gap: CGFloat = 14
            let boxW = (contentW - gap * 2) / 3.0
            let boxH: CGFloat = 148
            for (idx, metric) in metrics.prefix(3).enumerated() {
                let bx = left + CGFloat(idx) * (boxW + gap)
                let box = CGRect(x: bx, y: y, width: boxW, height: boxH)
                UIColor.white.setFill()
                UIBezierPath(roundedRect: box, cornerRadius: 8).fill()
                border.setStroke()
                UIBezierPath(roundedRect: box, cornerRadius: 8).stroke()

                let lFont = pretendardFont(name: "Pretendard-Regular", size: 22, weight: .regular)
                let vFont = pretendardFont(name: "Pretendard-Bold", size: metric.1.count > 7 ? 32 : 40, weight: .bold)
                (metric.0 as NSString).draw(at: CGPoint(x: bx + 20, y: y + 20), withAttributes: [.font: lFont, .foregroundColor: muted])
                (metric.1 as NSString).draw(at: CGPoint(x: bx + 20, y: y + boxH - 64), withAttributes: [.font: vFont, .foregroundColor: ink])
            }

            let footerTop = h - 134
            border.setFill()
            cg.fill(CGRect(x: left, y: footerTop, width: contentW, height: 2))

            let wmFont = pretendardFont(name: "Pretendard-Bold", size: 27, weight: .bold)
            ("ottline.app" as NSString).draw(
                at: CGPoint(x: left, y: footerTop + 28),
                withAttributes: [.font: wmFont, .foregroundColor: orange]
            )
        }
    }

    // MARK: - 3. Private Connection Code Recovery Card (`1080x1350`)

    public static func renderRecoveryCardImage(
        pairingCode: String,
        nickname: String?,
        locale: String
    ) -> UIImage {
        let w: CGFloat = 1080
        let h: CGFloat = 1350
        let isEn = locale == "en"

        let format = UIGraphicsImageRendererFormat()
        format.scale = 1.0
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: w, height: h), format: format)

        return renderer.image { ctx in
            let cg = ctx.cgContext
            let cream = UIColor(red: 0.973, green: 0.965, blue: 0.949, alpha: 1.0) // #F8F6F2
            cream.setFill()
            cg.fill(CGRect(x: 0, y: 0, width: w, height: h))

            let cardRect = CGRect(x: 64, y: 72, width: w - 128, height: h - 144)
            UIColor.white.setFill()
            UIBezierPath(roundedRect: cardRect, cornerRadius: 24).fill()
            UIColor(red: 0.898, green: 0.882, blue: 0.855, alpha: 1.0).setStroke()
            let borderPath = UIBezierPath(roundedRect: cardRect, cornerRadius: 24)
            borderPath.lineWidth = 3
            borderPath.stroke()

            let navy = UIColor(red: 0.118, green: 0.302, blue: 0.549, alpha: 1.0) // #1E4D8C
            let orange = UIColor(red: 1.0, green: 0.6, blue: 0.2, alpha: 1.0) // #FF9933
            let ink = UIColor(red: 0.059, green: 0.059, blue: 0.059, alpha: 1.0)
            let muted = UIColor(red: 0.29, green: 0.29, blue: 0.29, alpha: 1.0)

            let brandFont = pretendardFont(name: "Pretendard-ExtraBold", size: 46, weight: .heavy)
            ("ottline" as NSString).draw(at: CGPoint(x: 128, y: 120), withAttributes: [.font: brandFont, .foregroundColor: navy])
            let subBrandFont = pretendardFont(name: "Pretendard-Bold", size: 20, weight: .bold)
            ("ON THE TIMELINE · PRIVATE RECOVERY CARD" as NSString).draw(
                at: CGPoint(x: 128, y: 180),
                withAttributes: [.font: subBrandFont, .foregroundColor: orange]
            )

            let who = (nickname?.isEmpty == false) ? "\(nickname!) · " : ""
            let headline = isEn ? "\(who)Keep this card somewhere private" : "\(who)새 기기에서 기록을 이어보는 열쇠예요"
            let headFont = pretendardFont(name: "Pretendard-Bold", size: 40, weight: .bold)
            _ = drawWrappedText(headline, font: headFont, color: ink, x: 128, y: 248, maxWidth: w - 256, maxHeight: 120)

            let codeBox = CGRect(x: 128, y: 390, width: w - 256, height: 210)
            UIColor(red: 0.996, green: 0.976, blue: 0.933, alpha: 1.0).setFill()
            UIBezierPath(roundedRect: codeBox, cornerRadius: 16).fill()
            navy.setStroke()
            let codeBorder = UIBezierPath(roundedRect: codeBox, cornerRadius: 16)
            codeBorder.lineWidth = 4
            codeBorder.stroke()

            let codeFont = UIFont.monospacedSystemFont(ofSize: 60, weight: .bold)
            let codeSize = (pairingCode as NSString).size(withAttributes: [.font: codeFont])
            (pairingCode as NSString).draw(
                at: CGPoint(x: (w - codeSize.width) / 2, y: codeBox.midY - codeSize.height / 2),
                withAttributes: [.font: codeFont, .foregroundColor: ink]
            )

            let guideText = isEn
                ? "1. Open ottline on your new phone or browser.\n2. Go to My Space → Link with code.\n3. Enter the code above to restore your timeline."
                : "1. 새 휴대폰이나 웹에서 ottline을 열어요.\n2. [내 공간 → 연결 코드로 이어받기]를 선택해요.\n3. 위의 연결 코드를 입력하면 타임라인이 그대로 이어져요."
            let guideFont = pretendardFont(name: "Pretendard-Regular", size: 30, weight: .regular)
            _ = drawWrappedText(guideText, font: guideFont, color: muted, x: 128, y: 660, maxWidth: w - 256, maxHeight: 240)

            let warnBox = CGRect(x: 128, y: 940, width: w - 256, height: 170)
            UIColor(red: 1.0, green: 0.949, blue: 0.941, alpha: 1.0).setFill()
            UIBezierPath(roundedRect: warnBox, cornerRadius: 14).fill()
            let warnFont = pretendardFont(name: "Pretendard-SemiBold", size: 26, weight: .semibold)
            let warnColor = UIColor(red: 0.788, green: 0.231, blue: 0.169, alpha: 1.0)
            let warnText = isEn
                ? "Anyone with this code can access your timeline. Never post this card publicly."
                : "이 코드는 비밀번호와 같아요. SNS나 공개된 곳에 올리지 말고 나만 볼 수 있는 곳에 보관해 주세요."
            _ = drawWrappedText(warnText, font: warnFont, color: warnColor, x: 160, y: 974, maxWidth: w - 320, maxHeight: 120)

            let footerFont = pretendardFont(name: "Pretendard-Regular", size: 24, weight: .regular)
            let footerStr = "\(RecordDate.formatDisplayDate(RecordDate.nowIso(), locale: locale)) · ottline.app"
            (footerStr as NSString).draw(at: CGPoint(x: 128, y: 1185), withAttributes: [.font: footerFont, .foregroundColor: muted])
        }
    }

    // MARK: - Save / Share Helpers

    public static func saveImageToPhotos(_ image: UIImage) {
        UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
    }

    public static func writeTemporaryPng(_ image: UIImage, fileName: String) -> URL? {
        guard let data = image.pngData() else { return nil }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        try? data.write(to: url, options: .atomic)
        return url
    }

    // MARK: - Internal Drawing Helpers

    private static func fetchRemoteImage(_ urlString: String?) async -> UIImage? {
        guard let urlString, let url = URL(string: urlString) else { return nil }
        do {
            var req = URLRequest(url: url, timeoutInterval: 8)
            req.cachePolicy = .returnCacheDataElseLoad
            let (data, resp) = try await URLSession.shared.data(for: req)
            guard let http = resp as? HTTPURLResponse, (200...299).contains(http.statusCode) else { return nil }
            return UIImage(data: data)
        } catch {
            return nil
        }
    }

    private static func drawAspectFill(image: UIImage, in box: CGRect, verticalAnchor: CGFloat) {
        guard let cg = UIGraphicsGetCurrentContext() else { return }
        let imgSize = image.size
        guard imgSize.width > 0, imgSize.height > 0 else { return }
        let scale = max(box.width / imgSize.width, box.height / imgSize.height)
        let drawW = imgSize.width * scale
        let drawH = imgSize.height * scale
        let dx = box.minX + (box.width - drawW) * 0.5
        let dy = box.minY - max(0, drawH - box.height) * verticalAnchor
        cg.saveGState()
        cg.addRect(box)
        cg.clip()
        image.draw(in: CGRect(x: dx, y: dy, width: drawW, height: drawH))
        cg.restoreGState()
    }

    private static func drawWrappedText(
        _ text: String,
        font: UIFont,
        color: UIColor,
        x: CGFloat,
        y: CGFloat,
        maxWidth: CGFloat,
        maxHeight: CGFloat
    ) -> CGRect {
        let style = NSMutableParagraphStyle()
        style.lineBreakMode = .byWordWrapping
        style.lineSpacing = 6
        let attrs: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: color,
            .paragraphStyle: style
        ]
        let ns = text as NSString
        let bound = ns.boundingRect(
            with: CGSize(width: maxWidth, height: maxHeight),
            options: [.usesLineFragmentOrigin, .usesFontLeading],
            attributes: attrs,
            context: nil
        )
        let drawRect = CGRect(x: x, y: y, width: maxWidth, height: ceil(bound.height))
        ns.draw(in: drawRect, withAttributes: attrs)
        return drawRect
    }

    private static func mosaicSlots(count: Int, heroHeight: CGFloat) -> [CGRect] {
        switch count {
        case ...1:
            return [CGRect(x: 0, y: 0, width: 1080, height: heroHeight)]
        case 2:
            return [
                CGRect(x: 0, y: 0, width: 540, height: heroHeight),
                CGRect(x: 540, y: 0, width: 540, height: heroHeight)
            ]
        case 3:
            return [
                CGRect(x: 0, y: 0, width: 540, height: heroHeight),
                CGRect(x: 540, y: 0, width: 540, height: heroHeight * 0.5),
                CGRect(x: 540, y: heroHeight * 0.5, width: 540, height: heroHeight * 0.5)
            ]
        case 4:
            return [
                CGRect(x: 0, y: 0, width: 540, height: heroHeight * 0.5),
                CGRect(x: 540, y: 0, width: 540, height: heroHeight * 0.5),
                CGRect(x: 0, y: heroHeight * 0.5, width: 540, height: heroHeight * 0.5),
                CGRect(x: 540, y: heroHeight * 0.5, width: 540, height: heroHeight * 0.5)
            ]
        default:
            return [
                CGRect(x: 0, y: 0, width: 360, height: heroHeight * 0.5),
                CGRect(x: 360, y: 0, width: 360, height: heroHeight * 0.5),
                CGRect(x: 720, y: 0, width: 360, height: heroHeight * 0.5),
                CGRect(x: 0, y: heroHeight * 0.5, width: 360, height: heroHeight * 0.5),
                CGRect(x: 360, y: heroHeight * 0.5, width: 360, height: heroHeight * 0.5),
                CGRect(x: 720, y: heroHeight * 0.5, width: 360, height: heroHeight * 0.5)
            ]
        }
    }
}
#endif
