export type ChatGptLocale = "ko" | "en";

export function resolveChatGptLocale(value?: string | null): ChatGptLocale {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.includes("ko")) {
    return "ko";
  }
  if (normalized.includes("en")) {
    return "en";
  }
  return "ko";
}

const chatGptCopy = {
  ko: {
    server: {
      resourceDescription:
        "ChatGPT 안에서 ottline 최근 기록 카드를 표시합니다.",
      recentLogsTitle: "최근 기록 가져오기",
      recentLogsDescription:
        "사용자의 최근 ottline 기록이나 필터링된 개인 로그가 필요할 때 사용합니다. 개인 계정 밖의 작품 탐색에는 사용하지 않습니다.",
    },
    widget: {
      metaTitle: "ottline ChatGPT 위젯",
      hero: {
        eyebrow: "ottline for ChatGPT",
        title: "내 기록을 대화 안으로 가져오기",
        copy: "ottline 기록을 불러와서 최근에 본 작품과 감상 메모를 ChatGPT가 읽을 수 있게 연결합니다.",
      },
      status: {
        signedOut:
          "ottline 기록을 불러올 준비가 됐습니다. 개인 기록이 필요한 요청을 하면 연결 화면이 열립니다.",
        authRequired:
          "개인 기록을 보려면 ottline 계정을 연결해야 합니다. 연결 후 같은 요청을 다시 실행하면 됩니다.",
      },
      actions: {
        loadTimeline: "최근 기록 불러오기",
        loadMovies: "최근 영화 보기",
        loadSeries: "최근 시리즈 보기",
      },
      timeline: {
        title: "내 최근 기록",
        copy: "최근에 본 작품과 메모를 불러옵니다. 이 데이터를 바탕으로 ChatGPT에게 취향 분석이나 다음 추천을 요청할 수 있습니다.",
        empty:
          "ottline.app에 최근 기록을 남긴 뒤 계정을 연결하면 여기에 표시됩니다.",
      },
      enums: {
        type: {
          movie: "영화",
          series: "시리즈",
          book: "책",
        },
        status: {
          DONE: "봤어요",
          IN_PROGRESS: "보는 중",
          WISHLIST: "보고 싶어요",
        },
        place: {
          HOME: "집",
          THEATER: "극장",
          TRANSIT: "이동 중",
          CAFE: "카페",
          OFFICE: "직장",
          LIBRARY: "도서관",
          BOOKSTORE: "서점",
          SCHOOL: "학교",
          PARK: "공원",
          OUTDOOR: "야외",
          ETC: "기타",
        },
        occasion: {
          ALONE: "혼자",
          DATE: "데이트",
          FAMILY: "가족",
          FRIENDS: "친구",
          BREAK: "휴식",
          ETC: "기타",
        },
      },
    },
    page: {
      metaTitle: "ottline for ChatGPT",
      metaDescription:
        "ottline 기록을 ChatGPT에 연결해 최근에 본 작품과 감상 메모를 불러오세요.",
      heroEyebrow: "ChatGPT App",
      heroTitle: "ottline 기록을 ChatGPT에 연결하세요",
      heroDescription:
        "ottline의 개인 기록을 ChatGPT 대화에 불러오면, 최근에 본 작품을 정리하거나 감상 메모를 바탕으로 취향을 해석하고 다음 추천을 ChatGPT에게 바로 요청할 수 있습니다.",
      cards: {
        connectTitle: "계정 연결",
        connectBody:
          "개인 기록이 필요한 요청을 처음 실행하면 OAuth 연결 화면이 열리고, ottline 설정(Account)의 페어링 또는 복구 코드를 입력합니다.",
        timelineTitle: "최근 기록 읽기",
        timelineBody:
          "ottline.app에 기록이 이미 있어야 최근에 본 작품과 메모를 필터링해서 읽을 수 있습니다.",
        promptTitle: "질문은 ChatGPT에게",
        promptBody:
          "ottline은 최근 기록을 가져오고, 정리와 추천은 ChatGPT가 맡습니다.",
      },
      accessTitle: "접근 방식",
      accessItems: [
        "ChatGPT에서 의미 있는 답을 받으려면 ottline.app에 최근 기록이 먼저 있어야 합니다.",
        "개인 기록이 필요한 요청을 처음 실행하면 OAuth 연결 화면이 열립니다.",
        "페어링 또는 복구 코드는 ottline 설정(Account)에서 확인한 뒤 승인 화면에서 입력합니다.",
        "ChatGPT 앱은 읽기 전용입니다. 기록 생성, 수정, 댓글 작성, 계정 삭제는 지원하지 않습니다.",
      ],
      toolSurfaceTitle: "현재 제공 기능",
      toolItems: [
        "timeline.list_recent_logs: 최근 기록을 필터링해서 가져옵니다.",
      ],
      reviewTitle: "사용 예시",
      reviewBody:
        "예: '내가 최근에 본 영화 기준으로 다음에 뭘 보면 좋을까?'처럼 물으면, ottline이 기록을 제공하고 ChatGPT가 그 기록을 바탕으로 답합니다.",
      privacyLabel: "개인정보처리방침",
      supportLabel: "문의",
    },
    tools: {
      authRequired:
        "인증이 필요합니다. 개인 ottline 기록을 보려면 계정을 연결해 주세요.",
      recentLogsLoaded: "최근 기록을 불러왔습니다.",
      recentMovieLogsLoaded: "최근 영화 기록을 불러왔습니다.",
      recentSeriesLogsLoaded: "최근 시리즈 기록을 불러왔습니다.",
      recentBookLogsLoaded: "최근 책 기록을 불러왔습니다.",
      recentLogsEmpty: "표시할 최근 기록이 없습니다.",
      recentLogsUnavailable:
        "최근 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    },
  },
  en: {
    server: {
      resourceDescription:
        "Interactive recent-history cards for ottline inside ChatGPT.",
      recentLogsTitle: "List recent logs",
      recentLogsDescription:
        "Use this when the user wants recent ottline entries or filtered personal logs. Do not use for title discovery outside the user's account.",
    },
    widget: {
      metaTitle: "ottline ChatGPT widget",
      hero: {
        eyebrow: "ottline for ChatGPT",
        title: "Bring your timeline into the conversation",
        copy: "Load your ottline history so ChatGPT can read your recent watches and notes before it helps you analyze or pick what to watch next.",
      },
      status: {
        signedOut:
          "Your ottline history is ready to connect. Ask for private timeline data and ChatGPT will open the sign-in flow when needed.",
        authRequired:
          "Connect your ottline account to load private history. After that, run the same request again.",
      },
      actions: {
        loadTimeline: "Load recent logs",
        loadMovies: "Recent movies",
        loadSeries: "Recent series",
      },
      timeline: {
        title: "Recent logs",
        copy: "Load recent watches and notes here, then ask ChatGPT to analyze your taste or recommend what to watch next.",
        empty:
          "Add recent logs on ottline.app first, then connect your account to see them here.",
      },
      enums: {
        type: {
          movie: "Movie",
          series: "Series",
          book: "Book",
        },
        status: {
          DONE: "Watched",
          IN_PROGRESS: "In progress",
          WISHLIST: "Want to watch",
        },
        place: {
          HOME: "Home",
          THEATER: "Theater",
          TRANSIT: "Transit",
          CAFE: "Cafe",
          OFFICE: "Office",
          LIBRARY: "Library",
          BOOKSTORE: "Bookstore",
          SCHOOL: "School",
          PARK: "Park",
          OUTDOOR: "Outdoor",
          ETC: "Other",
        },
        occasion: {
          ALONE: "Alone",
          DATE: "Date",
          FAMILY: "Family",
          FRIENDS: "Friends",
          BREAK: "Break",
          ETC: "Other",
        },
      },
    },
    page: {
      metaTitle: "ottline for ChatGPT",
      metaDescription:
        "Connect your ottline history to ChatGPT and load recent watches and notes into the conversation.",
      heroEyebrow: "ChatGPT App",
      heroTitle: "Connect your ottline history to ChatGPT",
      heroDescription:
        "Bring your personal ottline history into ChatGPT so it can organize what you watched, read your notes, and help you choose what to watch next.",
      cards: {
        connectTitle: "Connect account",
        connectBody:
          "When a request needs private history, ChatGPT opens the OAuth connect flow and you enter the pairing or recovery code from ottline Settings / Account.",
        timelineTitle: "Recent history",
        timelineBody:
          "This works only when your ottline.app account already has recent logs and notes.",
        promptTitle: "Ask ChatGPT",
        promptBody:
          "ottline supplies recent logs. ChatGPT handles interpretation and recommendations.",
      },
      accessTitle: "Access model",
      accessItems: [
        "You need existing recent logs on ottline.app before ChatGPT has useful history to read.",
        "When a request needs private history, ChatGPT opens the OAuth connect flow.",
        "Find your pairing or recovery code in ottline Settings / Account, then enter it on the authorization page.",
        "The ChatGPT app is read-only. It does not create logs, edit logs, write comments, or delete accounts.",
      ],
      toolSurfaceTitle: "Current tool surface",
      toolItems: ["timeline.list_recent_logs: filter and fetch recent logs."],
      reviewTitle: "How to use it",
      reviewBody:
        "Example: ask 'Based on the movies I watched recently, what should I watch next?' ottline provides the history, and ChatGPT does the reasoning.",
      privacyLabel: "Privacy policy",
      supportLabel: "Support",
    },
    tools: {
      authRequired:
        "Authentication required. Connect ottline to load your private timeline.",
      recentLogsLoaded: "Loaded your recent logs.",
      recentMovieLogsLoaded: "Loaded your recent movie logs.",
      recentSeriesLogsLoaded: "Loaded your recent series logs.",
      recentBookLogsLoaded: "Loaded your recent book logs.",
      recentLogsEmpty: "No recent logs found.",
      recentLogsUnavailable:
        "Could not load recent logs. Please try again in a moment.",
    },
  },
} as const;

export function getChatGptCopy(locale: ChatGptLocale) {
  return chatGptCopy[locale];
}

export const chatGptWidgetI18n = {
  ko: chatGptCopy.ko.widget,
  en: chatGptCopy.en.widget,
} as const;
