package app.ottline.ui.i18n

import androidx.annotation.DrawableRes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import app.ottline.R
import app.ottline.model.FeedbackCategory
import app.ottline.model.FeedbackStatus
import app.ottline.model.LogStatus
import app.ottline.model.Occasion
import app.ottline.model.PersonaKey
import app.ottline.model.Place
import app.ottline.model.TitleType

val LocalAppLocale = staticCompositionLocalOf { "ko" }

@Composable
fun tr(ko: String, en: String): String =
    if (LocalAppLocale.current == "en") en else ko

object OttlineStrings {

    fun statusLabel(status: LogStatus, type: TitleType?, locale: String): String {
        val isBook = type == TitleType.BOOK
        return if (locale == "en") {
            when (status) {
                LogStatus.DONE -> if (isBook) "Read" else "Watched"
                LogStatus.IN_PROGRESS -> if (isBook) "Reading" else "Watching"
                LogStatus.WISHLIST -> if (isBook) "Want to read" else "Want to watch"
            }
        } else {
            when (status) {
                LogStatus.DONE -> if (isBook) "읽었어요" else "봤어요"
                LogStatus.IN_PROGRESS -> if (isBook) "읽는 중" else "보는 중"
                LogStatus.WISHLIST -> if (isBook) "읽고 싶어요" else "보고 싶어요"
            }
        }
    }

    fun titleTypeLabel(type: TitleType, locale: String): String = when (type) {
        TitleType.MOVIE -> if (locale == "en") "Movie" else "영화"
        TitleType.SERIES -> if (locale == "en") "Series" else "시리즈"
        TitleType.BOOK -> if (locale == "en") "Book" else "책"
    }

    fun placeLabel(place: Place, locale: String): String = if (locale == "en") {
        when (place) {
            Place.HOME -> "Home"
            Place.THEATER -> "Theater"
            Place.TRANSIT -> "Transit"
            Place.CAFE -> "Cafe"
            Place.OFFICE -> "Office"
            Place.LIBRARY -> "Library"
            Place.BOOKSTORE -> "Bookstore"
            Place.SCHOOL -> "School"
            Place.PARK -> "Park"
            Place.OUTDOOR -> "Outdoor"
            Place.ETC -> "Etc"
        }
    } else {
        when (place) {
            Place.HOME -> "집"
            Place.THEATER -> "극장"
            Place.TRANSIT -> "이동 중"
            Place.CAFE -> "카페"
            Place.OFFICE -> "직장"
            Place.LIBRARY -> "도서관"
            Place.BOOKSTORE -> "서점"
            Place.SCHOOL -> "학교"
            Place.PARK -> "공원"
            Place.OUTDOOR -> "야외"
            Place.ETC -> "기타"
        }
    }

    fun placesForType(type: TitleType?): List<Place> =
        if (type == TitleType.BOOK) {
            listOf(Place.HOME, Place.CAFE, Place.TRANSIT, Place.LIBRARY, Place.BOOKSTORE, Place.PARK, Place.SCHOOL, Place.OFFICE, Place.OUTDOOR, Place.ETC)
        } else {
            listOf(Place.HOME, Place.THEATER, Place.TRANSIT, Place.CAFE, Place.OUTDOOR, Place.OFFICE, Place.SCHOOL, Place.ETC)
        }

    fun occasionLabel(occasion: Occasion, locale: String): String = if (locale == "en") {
        when (occasion) {
            Occasion.ALONE -> "Alone"
            Occasion.DATE -> "Date"
            Occasion.FAMILY -> "Family"
            Occasion.FRIENDS -> "Friends"
            Occasion.BREAK -> "Break"
            Occasion.ETC -> "Etc"
        }
    } else {
        when (occasion) {
            Occasion.ALONE -> "혼자"
            Occasion.DATE -> "데이트"
            Occasion.FAMILY -> "가족"
            Occasion.FRIENDS -> "친구"
            Occasion.BREAK -> "휴식"
            Occasion.ETC -> "기타"
        }
    }

    fun personaLabel(key: PersonaKey, locale: String): String = if (locale == "en") {
        when (key) {
            PersonaKey.CINEMA_KEEPER -> "Cinema keeper"
            PersonaKey.BOOK_DRIFTER -> "Book drifter"
            PersonaKey.DEEP_WATCHER -> "Deep watcher"
            PersonaKey.MIDNIGHT_LOGGER -> "Midnight logger"
            PersonaKey.WEEKEND_CURATOR -> "Weekend curator"
            PersonaKey.ARCHIVE_COLLECTOR -> "Timeline keeper"
        }
    } else {
        when (key) {
            PersonaKey.CINEMA_KEEPER -> "영화 감상파"
            PersonaKey.BOOK_DRIFTER -> "책 유랑가"
            PersonaKey.DEEP_WATCHER -> "몰입 감상가"
            PersonaKey.MIDNIGHT_LOGGER -> "심야 기록가"
            PersonaKey.WEEKEND_CURATOR -> "주말 큐레이터"
            PersonaKey.ARCHIVE_COLLECTOR -> "기록 수집가"
        }
    }

    fun personaDescription(key: PersonaKey, locale: String): String = if (locale == "en") {
        when (key) {
            PersonaKey.CINEMA_KEEPER -> "Loves lingering credits and theater air"
            PersonaKey.BOOK_DRIFTER -> "Wanders through sentences at cafes and trains"
            PersonaKey.DEEP_WATCHER -> "Dives deep into multi-season worlds"
            PersonaKey.MIDNIGHT_LOGGER -> "Writes quiet notes after midnight"
            PersonaKey.WEEKEND_CURATOR -> "Collects cozy weekend stories"
            PersonaKey.ARCHIVE_COLLECTOR -> "Keeps warm memories neatly on the timeline"
        }
    } else {
        when (key) {
            PersonaKey.CINEMA_KEEPER -> "엔딩 크레딧의 여운을 오래 간직해요"
            PersonaKey.BOOK_DRIFTER -> "문장 사이를 천천히 유랑하며 읽어요"
            PersonaKey.DEEP_WATCHER -> "한 세계관에 깊이 몰입해 정주행해요"
            PersonaKey.MIDNIGHT_LOGGER -> "조용한 밤에 그날의 마음을 적어둬요"
            PersonaKey.WEEKEND_CURATOR -> "주말마다 나만의 이야기를 골라 담아요"
            PersonaKey.ARCHIVE_COLLECTOR -> "지나간 순간을 차곡차곡 수첩에 모아요"
        }
    }

    @DrawableRes
    fun personaAvatarRes(key: PersonaKey?): Int = when (key) {
        PersonaKey.CINEMA_KEEPER -> R.drawable.avatar_cinema_keeper
        PersonaKey.BOOK_DRIFTER -> R.drawable.avatar_book_drifter
        PersonaKey.DEEP_WATCHER -> R.drawable.avatar_deep_watcher
        PersonaKey.MIDNIGHT_LOGGER -> R.drawable.avatar_midnight_logger
        PersonaKey.WEEKEND_CURATOR -> R.drawable.avatar_weekend_curator
        PersonaKey.ARCHIVE_COLLECTOR -> R.drawable.avatar_archive_collector
        null -> R.drawable.avatar_cinema_keeper
    }

    fun kdcCategoryTitle(major: Int, locale: String): String = if (locale == "en") {
        when (major) {
            0 -> "000 · Generalities"
            1 -> "100 · Philosophy & Psychology"
            2 -> "200 · Religion"
            3 -> "300 · Social Sciences"
            4 -> "400 · Natural Sciences"
            5 -> "500 · Technology & Engineering"
            6 -> "600 · Arts"
            7 -> "700 · Language"
            8 -> "800 · Literature"
            9 -> "900 · History & Geography"
            else -> "Unclassified"
        }
    } else {
        when (major) {
            0 -> "000 · 총류"
            1 -> "100 · 철학"
            2 -> "200 · 종교"
            3 -> "300 · 사회과학"
            4 -> "400 · 자연과학"
            5 -> "500 · 기술과학"
            6 -> "600 · 예술"
            7 -> "700 · 언어"
            8 -> "800 · 문학"
            9 -> "900 · 역사"
            else -> "미분류 서가"
        }
    }

    data class PlatformGroup(val label: String, val options: List<String>)

    fun platformGroups(isBook: Boolean, locale: String): List<PlatformGroup> {
        return if (isBook) {
            if (locale == "en") {
                listOf(
                    PlatformGroup("Bookstore & Print", listOf("Local bookstore", "Amazon", "Barnes & Noble", "Bookshop.org")),
                    PlatformGroup("eBook & Audio", listOf("Kindle", "Apple Books", "Kobo", "Libby", "Audible")),
                    PlatformGroup("Library", listOf("Public library", "University library", "Borrowed"))
                )
            } else {
                listOf(
                    PlatformGroup("서점·종이책", listOf("교보문고", "알라딘", "예스24", "영풍문고", "독립서점")),
                    PlatformGroup("전자책·오디오북", listOf("리디", "밀리의서재", "윌라", "Google Play 북")),
                    PlatformGroup("도서관", listOf("공공도서관", "대학도서관", "학교도서관"))
                )
            }
        } else {
            if (locale == "en") {
                listOf(
                    PlatformGroup("Streaming", listOf("Netflix", "Disney+", "Apple TV+", "Prime Video", "TVING", "Wavve", "Coupang Play", "Watcha")),
                    PlatformGroup("Theater & Physical", listOf("Theater", "VOD", "Blu-ray / DVD"))
                )
            } else {
                listOf(
                    PlatformGroup("OTT", listOf("넷플릭스", "디즈니플러스", "티빙", "웨이브", "쿠팡플레이", "애플티비", "프라임비디오", "왓챠")),
                    PlatformGroup("극장·기타", listOf("CGV", "롯데시네마", "메가박스", "씨네큐", "TV 채널", "VOD", "블루레이·DVD"))
                )
            }
        }
    }

    fun feedbackCategoryLabel(cat: FeedbackCategory, locale: String): String = if (locale == "en") {
        when (cat) {
            FeedbackCategory.QUESTION -> "Question"
            FeedbackCategory.BUG -> "Bug / Report"
            FeedbackCategory.IDEA -> "Idea"
            FeedbackCategory.OTHER -> "Other"
        }
    } else {
        when (cat) {
            FeedbackCategory.QUESTION -> "질문"
            FeedbackCategory.BUG -> "오류·신고"
            FeedbackCategory.IDEA -> "제안"
            FeedbackCategory.OTHER -> "기타"
        }
    }

    fun feedbackStatusLabel(status: FeedbackStatus, locale: String): String = if (locale == "en") {
        when (status) {
            FeedbackStatus.OPEN -> "Open"
            FeedbackStatus.ANSWERED -> "Answered"
            FeedbackStatus.CLOSED -> "Closed"
        }
    } else {
        when (status) {
            FeedbackStatus.OPEN -> "접수됨"
            FeedbackStatus.ANSWERED -> "답변 완료"
            FeedbackStatus.CLOSED -> "종료"
        }
    }
}
