import Foundation

public struct PersonaPreset: Equatable, Sendable {
    public let key: PersonaKey
    public let assetName: String
    public let titleKo: String
    public let titleEn: String
    public let descKo: String
    public let descEn: String

    public func title(_ locale: String) -> String {
        locale == "en" ? titleEn : titleKo
    }

    public func desc(_ locale: String) -> String {
        locale == "en" ? descEn : descKo
    }
}

public enum OttlineStrings {
    public static func tr(_ ko: String, _ en: String, locale: String) -> String {
        locale == "en" ? en : ko
    }

    public static let videoPlatformsKo = [
        "Netflix", "TVING", "Coupang Play", "Disney+", "Wavve", "Watcha", "Prime Video", "Apple TV+", "Laftel", "극장"
    ]
    public static let videoPlatformsEn = [
        "Netflix", "TVING", "Coupang Play", "Disney+", "Wavve", "Watcha", "Prime Video", "Apple TV+", "Laftel", "Theater"
    ]
    public static let bookPlatformsKo = [
        "종이책", "전자책", "오디오북", "리디", "밀리의서재", "예스24", "교보문고", "알라딘", "도서관"
    ]
    public static let bookPlatformsEn = [
        "Paperback", "eBook", "Audiobook", "RIDI", "Millie", "YES24", "Kyobo", "Aladin", "Library"
    ]

    public static func videoPlatforms(_ locale: String) -> [String] {
        locale == "en" ? videoPlatformsEn : videoPlatformsKo
    }

    public static func bookPlatforms(_ locale: String) -> [String] {
        locale == "en" ? bookPlatformsEn : bookPlatformsKo
    }

    public static func statusLabel(_ status: LogStatus, type: TitleType, locale: String) -> String {
        let isEn = locale == "en"
        let isBook = type == .book
        switch status {
        case .done:
            if isEn { return isBook ? "Read" : "Watched" }
            return isBook ? "읽었어요" : "봤어요"
        case .inProgress:
            if isEn { return isBook ? "Reading" : "Watching" }
            return isBook ? "읽는 중" : "보는 중"
        case .wishlist:
            if isEn { return isBook ? "Want to read" : "Want to watch" }
            return isBook ? "읽고 싶어요" : "보고 싶어요"
        }
    }

    public static func titleTypeLabel(_ type: TitleType, locale: String) -> String {
        let isEn = locale == "en"
        switch type {
        case .movie: return isEn ? "Movie" : "영화"
        case .series: return isEn ? "Series" : "시리즈"
        case .book: return isEn ? "Book" : "책"
        }
    }

    public static func placeLabel(_ place: Place, locale: String) -> String {
        let isEn = locale == "en"
        switch place {
        case .home: return isEn ? "At home" : "집에서"
        case .theater: return isEn ? "Theater" : "극장에서"
        case .move: return isEn ? "On the move" : "이동 중에"
        case .cafe: return isEn ? "At a cafe" : "카페에서"
        case .other: return isEn ? "Somewhere else" : "다른 곳에서"
        }
    }

    public static func occasionLabel(_ occasion: Occasion, locale: String) -> String {
        let isEn = locale == "en"
        switch occasion {
        case .alone: return isEn ? "By myself" : "혼자서"
        case .date: return isEn ? "With a partner" : "연인과"
        case .family: return isEn ? "With family" : "가족과"
        case .friend: return isEn ? "With friends" : "친구와"
        case .breakTime: return isEn ? "Taking a break" : "쉬는 시간에"
        case .other: return isEn ? "Another moment" : "특별한 날에"
        }
    }

    public static func reactionLabel(_ type: DiscussionReactionType, titleType: TitleType, locale: String) -> String {
        let isEn = locale == "en"
        let isBook = titleType == .book
        switch type {
        case .meToo:
            if isEn { return isBook ? "Read it too" : "Watched too" }
            return isBook ? "나도 읽었어요" : "나도 봤어요"
        case .curious:
            return isEn ? "Curious" : "궁금해요"
        case .bookmark:
            return isEn ? "Save for later" : "저장해둘래요"
        }
    }

    public static func feedbackCategoryLabel(_ category: FeedbackCategory, locale: String) -> String {
        let isEn = locale == "en"
        switch category {
        case .bug: return isEn ? "Bug / Report" : "버그·신고"
        case .idea: return isEn ? "Idea" : "기능 제안"
        case .data: return isEn ? "Title info" : "작품 정보"
        case .other: return isEn ? "Other" : "기타 문의"
        }
    }

    public static func feedbackStatusLabel(_ status: FeedbackStatus, locale: String) -> String {
        let isEn = locale == "en"
        switch status {
        case .open: return isEn ? "Open" : "접수됨"
        case .answered: return isEn ? "Answered" : "답변 완료"
        case .closed: return isEn ? "Closed" : "종료됨"
        }
    }

    public static let personaPresets: [PersonaPreset] = [
        PersonaPreset(
            key: .cinemaKeeper,
            assetName: "avatar_cinema_keeper",
            titleKo: "장면을 모으는 관객",
            titleEn: "Scene Collector",
            descKo: "극장과 화면 속 오래 남는 장면을 차곡차곡 기록해요",
            descEn: "Keeps lingering scenes from theaters and screens"
        ),
        PersonaPreset(
            key: .bookDrifter,
            assetName: "avatar_book_drifter",
            titleKo: "문장 사이를 걷는 독서가",
            titleEn: "Page Wanderer",
            descKo: "밑줄 긋고 싶은 문장과 책의 공기를 수첩에 남겨요",
            descEn: "Collects underlined sentences and quiet pages"
        ),
        PersonaPreset(
            key: .deepWatcher,
            assetName: "avatar_deep_watcher",
            titleKo: "여운을 곱씹는 감상가",
            titleEn: "Deep Watcher",
            descKo: "엔딩 크레딧이 올라간 뒤의 생각을 천천히 적어요",
            descEn: "Writes down thoughts after the credits roll"
        ),
        PersonaPreset(
            key: .midnightLogger,
            assetName: "avatar_midnight_logger",
            titleKo: "자정의 기록자",
            titleEn: "Midnight Logger",
            descKo: "하루가 끝나는 조용한 밤, 나만의 타임라인을 채워요",
            descEn: "Fills the timeline in the quiet hours of night"
        ),
        PersonaPreset(
            key: .weekendCurator,
            assetName: "avatar_weekend_curator",
            titleKo: "주말의 작은 큐레이터",
            titleEn: "Weekend Curator",
            descKo: "쉬는 날 만난 좋은 이야기를 소중히 골라 남겨요",
            descEn: "Curates favorite weekend films, series, and books"
        ),
        PersonaPreset(
            key: .archiveCollector,
            assetName: "avatar_archive_collector",
            titleKo: "기억을 엮는 수집가",
            titleEn: "Memory Archivist",
            descKo: "언제 어디서 함께했는지 그날의 순간까지 함께 보관해요",
            descEn: "Archives not just titles, but the moments around them"
        )
    ]

    public static func personaPreset(_ key: PersonaKey?) -> PersonaPreset {
        guard let key, let found = personaPresets.first(where: { $0.key == key }) else {
            return personaPresets[0]
        }
        return found
    }
}
