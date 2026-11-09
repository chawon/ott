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
        "넷플릭스", "디즈니+", "티빙", "웨이브", "쿠팡플레이", "애플TV", "프라임 비디오", "왓챠", "유튜브",
        "TV채널", "VOD", "DVD", "블루레이",
        "CGV", "롯데시네마", "메가박스", "씨네큐"
    ]
    public static let videoPlatformsEn = [
        "Netflix", "Disney+", "TVING", "Wavve", "Coupang Play", "Apple TV", "Prime Video", "Watcha", "YouTube",
        "TV Channel", "VOD", "DVD", "Blu-ray",
        "CGV", "Lotte Cinema", "Megabox", "CineQ"
    ]
    public static let bookPlatformsKo = [
        "교보문고", "영풍문고", "예스24", "알라딘",
        "리디북스", "밀리의서재", "윌라", "플레이북",
        "국공립도서관", "대학도서관", "학교도서관"
    ]
    public static let bookPlatformsEn = [
        "Kyobo", "Yeongpung", "Yes24", "Aladin",
        "Ridi", "Millie", "Willa", "Play Books",
        "Public Library", "Univ. Library", "School Library"
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
        case .home: return isEn ? "Home" : "집"
        case .theater: return isEn ? "Theater" : "극장"
        case .transit: return isEn ? "Transit" : "이동 중"
        case .cafe: return isEn ? "Cafe" : "카페"
        case .office: return isEn ? "Office" : "직장"
        case .library: return isEn ? "Library" : "도서관"
        case .bookstore: return isEn ? "Bookstore" : "서점"
        case .school: return isEn ? "School" : "학교"
        case .park: return isEn ? "Park" : "공원"
        case .outdoor: return isEn ? "Outdoor" : "야외"
        case .etc: return isEn ? "Etc" : "기타"
        }
    }

    public static func occasionLabel(_ occasion: Occasion, locale: String) -> String {
        let isEn = locale == "en"
        switch occasion {
        case .alone: return isEn ? "Alone" : "혼자"
        case .date: return isEn ? "Date" : "데이트"
        case .family: return isEn ? "Family" : "가족"
        case .friends: return isEn ? "Friends" : "친구"
        case .breakTime: return isEn ? "Break" : "휴식"
        case .etc: return isEn ? "Etc" : "기타"
        }
    }

    public static func reactionLabel(_ type: DiscussionReactionType, titleType: TitleType, locale: String) -> String {
        let isEn = locale == "en"
        let isBook = titleType == .book
        switch type {
        case .meToo:
            if isEn { return isBook ? "Read it too" : "Watched it too" }
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
        case .bug: return isEn ? "Bug" : "버그"
        case .idea: return isEn ? "Idea" : "제안"
        case .data: return isEn ? "Question" : "질문"
        case .other: return isEn ? "Other" : "기타"
        }
    }

    public static func feedbackStatusLabel(_ status: FeedbackStatus, locale: String) -> String {
        let isEn = locale == "en"
        switch status {
        case .open: return isEn ? "Open" : "확인 대기"
        case .answered: return isEn ? "Answered" : "답변 완료"
        case .closed: return isEn ? "Closed" : "종료"
        }
    }

    public static let personaPresets: [PersonaPreset] = [
        PersonaPreset(
            key: .cinemaKeeper,
            assetName: "avatar_cinema_keeper",
            titleKo: "영화 감상파",
            titleEn: "Cinema keeper",
            descKo: "극장과 화면 속 오래 남는 장면을 차곡차곡 기록해요",
            descEn: "Keeps lingering scenes from theaters and screens"
        ),
        PersonaPreset(
            key: .bookDrifter,
            assetName: "avatar_book_drifter",
            titleKo: "책 유랑가",
            titleEn: "Book drifter",
            descKo: "밑줄 긋고 싶은 문장과 책의 공기를 수첩에 남겨요",
            descEn: "Collects underlined sentences and quiet pages"
        ),
        PersonaPreset(
            key: .deepWatcher,
            assetName: "avatar_deep_watcher",
            titleKo: "몰입 감상가",
            titleEn: "Deep watcher",
            descKo: "엔딩 크레딧이 올라간 뒤의 생각을 천천히 적어요",
            descEn: "Writes down thoughts after the credits roll"
        ),
        PersonaPreset(
            key: .midnightLogger,
            assetName: "avatar_midnight_logger",
            titleKo: "심야 기록가",
            titleEn: "Midnight logger",
            descKo: "하루가 끝나는 조용한 밤, 나만의 타임라인을 채워요",
            descEn: "Fills the timeline in the quiet hours of night"
        ),
        PersonaPreset(
            key: .weekendCurator,
            assetName: "avatar_weekend_curator",
            titleKo: "주말 큐레이터",
            titleEn: "Weekend curator",
            descKo: "쉬는 날 만난 좋은 이야기를 소중히 골라 남겨요",
            descEn: "Curates favorite weekend films, series, and books"
        ),
        PersonaPreset(
            key: .archiveCollector,
            assetName: "avatar_archive_collector",
            titleKo: "기록 수집가",
            titleEn: "Timeline keeper",
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
