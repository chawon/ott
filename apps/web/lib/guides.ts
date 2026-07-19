import "server-only";

export const GUIDE_SLUGS = [
  "ott-watch-log",
  "movie-series-log",
  "book-log",
] as const;

export type GuideSlug = (typeof GUIDE_SLUGS)[number];
export type GuideLocale = "ko" | "en";
export type GuideContentType = "video" | "book";

export type GuideImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
};

export type GuideSectionItem = {
  title: string;
  description: string;
};

export type GuideSection = {
  title: string;
  paragraphs: readonly string[];
  items?: readonly GuideSectionItem[];
  ordered?: boolean;
};

export type GuideDocument = {
  slug: GuideSlug;
  contentType: GuideContentType;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  summary: string;
  updatedAt: string;
  updatedLabel: string;
  image: GuideImage;
  cardTitle: string;
  cardDescription: string;
  cardAction: string;
  sections: readonly GuideSection[];
  cta: {
    title: string;
    description: string;
    label: string;
  };
};

export type GuideHubDocument = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  description: string;
  cardLabel: string;
  closingTitle: string;
  closingDescription: string;
};

export const GUIDE_LOCALES = ["ko", "en"] as const;

const koHub: GuideHubDocument = {
  metaTitle: "영상·책 기록 가이드",
  metaDescription:
    "OTT 시청 기록, 영화·시리즈 기록, 독서 기록을 ottline에 가볍게 남기고 타임라인으로 돌아보는 방법을 알아보세요.",
  eyebrow: "ottline 기록 안내",
  title: "가볍게 남긴 기록이, 나중의 기억이 돼요",
  description:
    "방금 본 작품도, 오래 곁에 둔 책도 필요한 만큼만 적어두세요. 검색부터 타임라인까지, ottline의 기록 흐름을 차근차근 안내할게요.",
  cardLabel: "안내 보기",
  closingTitle: "정답 없이, 내 방식대로 남겨요",
  closingDescription:
    "평점이나 긴 감상은 선택이에요. 제목과 상태만 남겨도 타임라인은 시작됩니다.",
};

const enHub: GuideHubDocument = {
  metaTitle: "Movie, Series, and Book Log Guides",
  metaDescription:
    "Learn how to keep an OTT watch log, remember movies and series, and build a personal book log with ottline.",
  eyebrow: "ottline guides",
  title: "A quieter way to remember what you watched and read",
  description:
    "Save the details that matter now and leave the rest for later. These guides walk through the simple path from finding a title to seeing it on your timeline.",
  cardLabel: "Read the guide",
  closingTitle: "Your log can be as simple as you like",
  closingDescription:
    "Ratings and long reviews are optional. A title and a status are enough to begin your timeline.",
};

const koGuides: Record<GuideSlug, GuideDocument> = {
  "ott-watch-log": {
    slug: "ott-watch-log",
    contentType: "video",
    metaTitle: "OTT 시청 기록, 가볍게 시작하는 방법",
    metaDescription:
      "ottline에서 영화와 시리즈를 검색하고 상태, 평점, 장소, 상황, 메모를 남겨 나만의 OTT 시청 기록 타임라인을 만드는 방법을 안내합니다.",
    eyebrow: "OTT 시청 기록",
    title: "보고 난 순간을, 한곳에 가볍게 남겨요",
    summary:
      "어느 OTT에서 봤는지 흩어져 있어도 괜찮아요. 작품을 찾고 지금의 상태와 기억하고 싶은 맥락을 남기면, 기록은 한 타임라인에 차곡차곡 이어집니다.",
    updatedAt: "2026-07-19",
    updatedLabel: "2026년 7월 19일 업데이트",
    image: {
      src: "/play/screenshot-home-720x1280.png",
      width: 720,
      height: 1280,
      alt: "ottline 기록하기 화면에서 영상 제목, 상태, 평점, 플랫폼, 장소, 상황과 메모를 입력하는 모습",
      caption:
        "작품을 검색한 뒤 필요한 항목만 골라 기록할 수 있는 ottline 기록하기 화면",
    },
    cardTitle: "OTT 시청 기록을 시작하는 방법",
    cardDescription:
      "여러 OTT에서 본 영화와 시리즈를 하나의 타임라인에 모으는 흐름을 살펴봐요.",
    cardAction: "OTT 시청 기록 안내 보기",
    sections: [
      {
        title: "플랫폼보다 작품과 기억을 먼저 모아요",
        paragraphs: [
          "OTT 서비스마다 시청 이력은 따로 남습니다. ottline에서는 플랫폼을 기록의 한 가지 맥락으로 두고, 작품 제목과 내가 남긴 상태·메모를 중심으로 모아볼 수 있어요.",
          "어디에서 봤는지 적지 않아도 괜찮고, 기억해두고 싶은 날에만 플랫폼을 더해도 됩니다. 기록하는 방식이 달라도 같은 타임라인에서 이어집니다.",
        ],
      },
      {
        title: "세 단계면 타임라인에 남아요",
        paragraphs: [
          "기록하기 화면은 작품을 찾는 일부터 시작합니다. 긴 감상을 준비할 필요 없이, 지금 떠오르는 만큼만 남겨보세요.",
        ],
        ordered: true,
        items: [
          {
            title: "작품 찾기",
            description:
              "영화나 시리즈 제목을 검색해 내가 본 작품을 선택합니다.",
          },
          {
            title: "지금의 상태 남기기",
            description:
              "봤어요, 보는 중, 볼래요처럼 지금과 가까운 상태를 고릅니다.",
          },
          {
            title: "필요한 맥락만 더하기",
            description:
              "평점, 플랫폼, 장소, 상황, 날짜와 짧은 메모 가운데 기억하고 싶은 것만 더한 뒤 저장합니다.",
          },
        ],
      },
      {
        title: "개인 기록이 기본이고, 공유는 선택이에요",
        paragraphs: [
          "저장한 기록은 먼저 나의 타임라인에 쌓입니다. 다른 사람과 함께 보고 싶은 기록만 ‘함께 하는 기록’으로 남기거나 공유 이미지 카드로 꺼낼 수 있어요.",
          "공개하지 않은 메모까지 공유할 필요는 없습니다. 나중에 다시 읽을 나를 위한 기록과, 가볍게 나누고 싶은 흔적을 구분해 둘 수 있어요.",
        ],
      },
      {
        title: "나중에는 날짜와 맥락이 기억을 불러와요",
        paragraphs: [
          "타임라인에는 영화, 시리즈, 책 기록이 시간순으로 이어집니다. 포스터와 제목만으로도 그때의 장면이 떠오르고, 함께 적은 장소나 상황과 메모는 기억을 조금 더 또렷하게 해줍니다.",
        ],
      },
    ],
    cta: {
      title: "방금 본 작품부터 남겨볼까요?",
      description: "제목을 찾은 뒤, 지금 기억나는 만큼만 적어도 충분해요.",
      label: "영상 기록 시작하기",
    },
  },
  "movie-series-log": {
    slug: "movie-series-log",
    contentType: "video",
    metaTitle: "영화·시리즈 기록에 장면의 맥락까지 남기는 방법",
    metaDescription:
      "영화와 시리즈의 시청 상태, 시즌·에피소드, 평점, 날짜, 장소, 상황과 메모를 ottline에 기록하고 타임라인으로 돌아보는 방법을 알아보세요.",
    eyebrow: "영화·시리즈 기록",
    title: "제목 너머의 장면까지 기억해요",
    summary:
      "같은 작품을 봐도 남는 기억은 저마다 달라요. 어디까지 봤는지, 누구와 있었는지, 어떤 마음이었는지 필요한 만큼 적어두면 다시 만날 때 훨씬 쉽게 이어갈 수 있습니다.",
    updatedAt: "2026-07-19",
    updatedLabel: "2026년 7월 19일 업데이트",
    image: {
      src: "/play/screenshot-public-720x1280.png",
      width: 720,
      height: 1280,
      alt: "ottline 함께 화면에 영화와 시리즈 포스터, 제목과 기록 날짜가 목록으로 보이는 모습",
      caption:
        "영화와 시리즈의 포스터, 제목과 날짜가 차분하게 이어지는 ottline 함께 화면",
    },
    cardTitle: "영화·시리즈를 더 또렷하게 기억하는 방법",
    cardDescription:
      "상태와 시즌·에피소드부터 그날의 장소와 메모까지, 필요한 맥락만 남겨요.",
    cardAction: "영화·시리즈 기록 안내 보기",
    sections: [
      {
        title: "영화와 시리즈에 맞는 상태를 골라요",
        paragraphs: [
          "한 번에 본 영화와 여러 날 이어보는 시리즈는 기록의 리듬이 다릅니다. 영화는 봤어요·볼래요처럼 간단히, 시리즈는 보는 중이나 잠시 멈춤처럼 현재 상태를 남겨둘 수 있어요.",
          "시리즈를 선택하면 시즌과 에피소드 정보를 함께 적을 수 있어, 다음에 어디서 이어볼지 찾기 쉬워집니다.",
        ],
      },
      {
        title: "감상보다 먼저, 그날의 맥락을 적어도 좋아요",
        paragraphs: [
          "긴 리뷰가 떠오르지 않아도 기록은 충분합니다. 집에서 혼자 본 늦은 밤, 가족과 함께한 주말처럼 장소와 상황만 남겨도 시간이 지난 뒤 작품을 만났던 순간이 돌아와요.",
        ],
        items: [
          {
            title: "날짜와 장소",
            description:
              "실제로 본 날과 집·극장처럼 기억의 배경이 된 장소를 남깁니다.",
          },
          {
            title: "함께한 상황",
            description:
              "혼자, 가족과, 친구와처럼 그날의 분위기를 떠올릴 단서를 더합니다.",
          },
          {
            title: "평점과 한 줄 메모",
            description:
              "숫자나 짧은 문장 중 지금 마음에 맞는 방식만 고릅니다.",
          },
        ],
      },
      {
        title: "생각이 달라지면 기록을 이어 고쳐요",
        paragraphs: [
          "보는 중이던 시리즈를 다 봤거나, 시간이 지나 평점과 메모가 달라졌다면 기존 기록을 수정할 수 있어요. 수정한 내용은 변화의 흐름과 함께 남아, 처음의 인상과 나중의 마음을 이어서 돌아볼 수 있습니다.",
        ],
      },
      {
        title: "공개 기록은 가까운 흔적처럼 만나요",
        paragraphs: [
          "공개하기로 고른 기록은 ‘함께’ 화면에서 다른 사람의 기록과 나란히 놓입니다. 순위나 경쟁을 위한 피드가 아니라, 같은 작품을 만난 사람들의 짧은 흔적을 조용히 둘러보는 공간이에요.",
        ],
      },
    ],
    cta: {
      title: "기억에 남은 장면이 있나요?",
      description: "작품을 찾고, 그 장면을 떠올릴 작은 단서 하나만 남겨보세요.",
      label: "영화·시리즈 기록하기",
    },
  },
  "book-log": {
    slug: "book-log",
    contentType: "book",
    metaTitle: "독서 기록, 읽는 중부터 다 읽은 뒤까지",
    metaDescription:
      "책 제목이나 저자를 검색하고 읽는 중·다 읽었어요·읽고 싶어요 상태, 날짜, 장소, 상황과 메모를 ottline 독서 기록 타임라인에 남기는 방법을 알아보세요.",
    eyebrow: "독서 기록",
    title: "책과 함께한 시간을 천천히 이어 적어요",
    summary:
      "읽기 시작한 날의 기대도, 덮고 난 뒤 남은 한 문장도 좋은 기록이 됩니다. 완성된 서평을 쓰지 않아도 책과 함께한 시간이 타임라인에 자연스럽게 이어져요.",
    updatedAt: "2026-07-19",
    updatedLabel: "2026년 7월 19일 업데이트",
    image: {
      src: "/play/screenshot-account-720x1280.png",
      width: 720,
      height: 1280,
      alt: "ottline 설정 화면에 페어링 코드, 문의함과 내 기록 내보내기 영역이 보이는 모습",
      caption: "기록을 여러 기기에서 이어보고 내보낼 수 있는 ottline 설정 화면",
    },
    cardTitle: "부담 없이 독서 기록을 이어가는 방법",
    cardDescription:
      "읽는 중의 마음부터 다 읽은 뒤의 메모까지, 책과 함께한 시간을 모아봐요.",
    cardAction: "독서 기록 안내 보기",
    sections: [
      {
        title: "읽는 과정도 한 권의 기록이에요",
        paragraphs: [
          "책은 다 읽은 뒤에만 기록할 필요가 없습니다. 읽기 시작할 때는 ‘읽는 중’, 나중을 위해 담아둘 때는 ‘읽고 싶어요’, 마지막 장을 덮은 뒤에는 ‘다 읽었어요’를 골라 지금의 자리를 남길 수 있어요.",
          "상태가 달라지면 기록을 고쳐 이어가면 됩니다. 처음의 기대와 읽은 뒤의 마음이 한 권의 시간으로 쌓입니다.",
        ],
      },
      {
        title: "책 제목이나 저자부터 찾아요",
        paragraphs: [
          "기록하기 화면에서 ‘책’을 고르고 제목이나 저자를 검색합니다. 표지와 서지 정보를 확인해 책을 선택한 뒤, 기록하고 싶은 항목만 더하면 돼요.",
        ],
        ordered: true,
        items: [
          {
            title: "읽기 상태 고르기",
            description:
              "읽는 중, 다 읽었어요, 읽고 싶어요 가운데 지금과 가까운 상태를 선택합니다.",
          },
          {
            title: "시간과 장소 남기기",
            description:
              "읽은 날짜와 집·카페·이동 중처럼 책을 펼친 장소를 적습니다.",
          },
          {
            title: "한 문장 덧붙이기",
            description:
              "마음에 남은 생각이나 다음에 다시 보고 싶은 지점을 짧게 적습니다.",
          },
        ],
      },
      {
        title: "영상과 책을 같은 타임라인에서 돌아봐요",
        paragraphs: [
          "영화와 시리즈, 책 기록이 날짜순으로 함께 놓여 그 시기에 무엇을 보고 읽었는지 한눈에 돌아볼 수 있어요. 종류별로 나누어 보고 싶을 때는 타임라인 필터를 사용할 수 있습니다.",
        ],
      },
      {
        title: "내 기록은 이어보고, 필요할 때 내보내요",
        paragraphs: [
          "페어링 코드로 다른 기기에서도 같은 기록을 이어볼 수 있습니다. 첫 기록이 쌓인 뒤에는 설정의 ‘내 기록 내보내기’에서 CSV로 보관할 수도 있어요.",
          "기록을 공개하는 일은 선택입니다. 나만 다시 읽을 메모는 개인 타임라인에 그대로 둘 수 있어요.",
        ],
      },
    ],
    cta: {
      title: "지금 곁에 있는 책부터 적어볼까요?",
      description:
        "읽는 중이어도 괜찮아요. 제목과 지금의 상태만 먼저 남겨보세요.",
      label: "책 기록 시작하기",
    },
  },
};

const enGuides: Record<GuideSlug, GuideDocument> = {
  "ott-watch-log": {
    slug: "ott-watch-log",
    contentType: "video",
    metaTitle: "How to Start an OTT Watch Log",
    metaDescription:
      "Learn how to find movies and series, save watch status, ratings, platform, place, occasion, and notes, and build a personal watch timeline with ottline.",
    eyebrow: "OTT watch log",
    title: "Keep the moment, wherever you watched it",
    summary:
      "Your viewing history may be scattered across streaming services, but your memories do not have to be. Save a title, its current status, and any context worth keeping in one personal timeline.",
    updatedAt: "2026-07-19",
    updatedLabel: "Updated July 19, 2026",
    image: {
      src: "/play/screenshot-home-720x1280.png",
      width: 720,
      height: 1280,
      alt: "The ottline log screen with fields for a video title, status, rating, platform, place, occasion, and note",
      caption:
        "The ottline log screen lets you begin with a title and add only the details you want to remember.",
    },
    cardTitle: "Start one watch log across streaming services",
    cardDescription:
      "See how movies and series from different services can meet in one personal timeline.",
    cardAction: "Read the OTT watch log guide",
    sections: [
      {
        title: "Let the title lead, not the platform",
        paragraphs: [
          "Streaming services keep separate histories. ottline treats the platform as useful context while keeping the title, your status, and your own note at the center of the record.",
          "The platform field is optional. Add it when it helps, skip it when it does not, and your records will still sit together on the same timeline.",
        ],
      },
      {
        title: "Three small steps are enough",
        paragraphs: [
          "A log begins by finding the title. There is no review to finish and no form to perfect—save what is fresh now and leave the rest open.",
        ],
        ordered: true,
        items: [
          {
            title: "Find the movie or series",
            description:
              "Search by title and choose the work you watched or want to remember.",
          },
          {
            title: "Choose where you are with it",
            description:
              "Pick a status such as watched, watching, or want to watch.",
          },
          {
            title: "Add only useful context",
            description:
              "Keep a rating, platform, place, occasion, date, or short note, then save the record.",
          },
        ],
      },
      {
        title: "Private first, shared when you choose",
        paragraphs: [
          "Saved records belong on your personal timeline first. You can choose a record for the Together space or turn it into a share image when you genuinely want to pass it on.",
          "A personal note does not have to become public. The detail you keep for your future self can stay separate from the trace you share with others.",
        ],
      },
      {
        title: "Dates and details help the memory return",
        paragraphs: [
          "Movies, series, and books appear together in time order. A poster may bring back the scene on its own; a place, occasion, or one-line note can make the memory clearer years later.",
        ],
      },
    ],
    cta: {
      title: "Have something fresh in mind?",
      description:
        "Find the title and keep only the details you can remember right now.",
      label: "Start a video log",
    },
  },
  "movie-series-log": {
    slug: "movie-series-log",
    contentType: "video",
    metaTitle: "How to Remember Movies and Series Beyond the Title",
    metaDescription:
      "Keep movie and series status, seasons, episodes, ratings, dates, places, occasions, and notes in ottline, then revisit them on your timeline.",
    eyebrow: "Movie and series log",
    title: "Remember more than the title",
    summary:
      "The part that stays with you may be an episode, a room, or the person beside you. A few small details make it easier to return to a series and to remember how a film met you at the time.",
    updatedAt: "2026-07-19",
    updatedLabel: "Updated July 19, 2026",
    image: {
      src: "/play/screenshot-public-720x1280.png",
      width: 720,
      height: 1280,
      alt: "The ottline Together screen showing movie and series posters, titles, and log dates",
      caption:
        "Posters, titles, and dates sit quietly together in the ottline Together view.",
    },
    cardTitle: "Remember movies and series in context",
    cardDescription:
      "Keep your status, season or episode, and the small details that bring a viewing moment back.",
    cardAction: "Read the movie and series guide",
    sections: [
      {
        title: "Use a status that fits the way you watch",
        paragraphs: [
          "A film finished in one sitting and a series followed over weeks have different rhythms. A movie can simply be watched or saved for later; a series can stay in progress or pause until you return.",
          "For a series, season and episode details help you find the right place when it is time to continue.",
        ],
      },
      {
        title: "Context can matter more than a review",
        paragraphs: [
          "You do not need a polished opinion. A late night at home, a weekend with family, or a cinema trip with a friend may be the detail that brings the whole experience back.",
        ],
        items: [
          {
            title: "Date and place",
            description:
              "Keep the day you watched and the setting that became part of the memory.",
          },
          {
            title: "Who or what shaped the occasion",
            description:
              "Note whether it was time alone, with family, or with friends.",
          },
          {
            title: "A rating or one line",
            description:
              "Choose a number, a sentence, both, or neither—whatever feels true now.",
          },
        ],
      },
      {
        title: "Let the record change as your thoughts do",
        paragraphs: [
          "When an in-progress series ends or your response changes over time, update the existing record. The history keeps those changes connected, so the first impression and the later one can both remain part of the story.",
        ],
      },
      {
        title: "Shared logs stay close and uncompetitive",
        paragraphs: [
          "Records you choose to make public appear in Together beside other people's traces. It is a quiet place to notice how the same work met someone else, without rankings or pressure.",
        ],
      },
    ],
    cta: {
      title: "Is there a scene you still remember?",
      description:
        "Find the title and keep one small detail that can bring the scene back.",
      label: "Log a movie or series",
    },
  },
  "book-log": {
    slug: "book-log",
    contentType: "book",
    metaTitle: "A Book Log for Reading, Finished, and Want to Read",
    metaDescription:
      "Search by book title or author and save reading status, dates, places, occasions, and notes in your personal ottline book timeline.",
    eyebrow: "Book log",
    title: "Keep the time you spent with a book",
    summary:
      "The anticipation at the first page and the thought that remains after the last are both worth keeping. Your book log can grow while you read—there is no finished review to write.",
    updatedAt: "2026-07-19",
    updatedLabel: "Updated July 19, 2026",
    image: {
      src: "/play/screenshot-account-720x1280.png",
      width: 720,
      height: 1280,
      alt: "The ottline settings screen with pairing code, feedback, and export my logs sections",
      caption:
        "ottline settings let you continue records on another device and export a copy when you need it.",
    },
    cardTitle: "Keep a book log without turning it into homework",
    cardDescription:
      "Save the feeling of starting, the details along the way, and a note after the final page.",
    cardAction: "Read the book log guide",
    sections: [
      {
        title: "The reading process belongs in the log too",
        paragraphs: [
          "A book does not need to be finished before it becomes a record. Choose Reading when you begin, Want to read when you are saving it for later, and Read after the final page.",
          "Update the status as it changes. The anticipation at the start and your thoughts at the end can stay connected as one stretch of time with the book.",
        ],
      },
      {
        title: "Begin with a title or author",
        paragraphs: [
          "Choose Book on the log screen and search by title or author. Check the cover and book details, select the right edition, then add only what you want to keep.",
        ],
        ordered: true,
        items: [
          {
            title: "Choose your reading status",
            description:
              "Pick Reading, Read, or Want to read to match where you are now.",
          },
          {
            title: "Keep the time and place",
            description:
              "Add a date and a setting such as home, a café, or a journey.",
          },
          {
            title: "Leave one thought",
            description:
              "Save a feeling, an idea, or a point you would like to find again.",
          },
        ],
      },
      {
        title: "See books and viewing memories on one timeline",
        paragraphs: [
          "Books, films, and series sit together in date order, showing what you were watching and reading during the same season of life. Timeline filters are there when you want to focus on one kind of record.",
        ],
      },
      {
        title: "Continue your records and keep a copy",
        paragraphs: [
          "Use a pairing code to continue the same records on another device. After your first log, Export my logs in Settings can also save a CSV copy for you.",
          "Sharing remains optional. Notes meant only for your future self can stay on your personal timeline.",
        ],
      },
    ],
    cta: {
      title: "What book is beside you now?",
      description:
        "It is fine to be partway through. Start with the title and your current status.",
      label: "Start a book log",
    },
  },
};

export function isGuideLocale(locale: string): locale is GuideLocale {
  return GUIDE_LOCALES.some((candidate) => candidate === locale);
}

export function isGuideSlug(slug: string): slug is GuideSlug {
  return GUIDE_SLUGS.some((candidate) => candidate === slug);
}

export function getGuideHub(locale: GuideLocale): GuideHubDocument {
  return locale === "ko" ? koHub : enHub;
}

export function getGuideDocument(
  locale: GuideLocale,
  slug: GuideSlug,
): GuideDocument {
  return locale === "ko" ? koGuides[slug] : enGuides[slug];
}

export function getGuideDocuments(
  locale: GuideLocale,
): readonly GuideDocument[] {
  return GUIDE_SLUGS.map((slug) => getGuideDocument(locale, slug));
}
