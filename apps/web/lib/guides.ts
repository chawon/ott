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
    "느낌이나 메모는 선택이에요. 제목과 상태만 남겨도 타임라인이 시작돼요.",
};

const enHub: GuideHubDocument = {
  metaTitle: "Movie, series, and book log guides",
  metaDescription:
    "Learn how to keep an OTT watch log, remember movies and series, and build a personal book log with ottline.",
  eyebrow: "ottline guides",
  title: "A quieter way to remember what you watched and read",
  description:
    "Save the details that matter now and leave the rest for later. These guides walk through the simple path from finding a title to seeing it on your timeline.",
  cardLabel: "Read the guide",
  closingTitle: "Your records can be as simple as you like",
  closingDescription:
    "A title and a status are enough. You can add a feeling or a note whenever you like.",
};

const koGuides: Record<GuideSlug, GuideDocument> = {
  "ott-watch-log": {
    slug: "ott-watch-log",
    contentType: "video",
    metaTitle: "OTT 시청 기록, 가볍게 시작하는 방법",
    metaDescription:
      "ottline에서 영화와 시리즈를 검색하고 시청 상태를 고른 뒤, 느낌(평점), 플랫폼, 장소, 상황과 메모를 더해 나만의 OTT 시청 기록 타임라인을 만드는 방법을 안내합니다.",
    eyebrow: "OTT 시청 기록",
    title: "보고 난 순간을, 한곳에 가볍게 남겨요",
    summary:
      "어느 OTT에서 봤는지 흩어져 있어도 괜찮아요. 작품을 찾고 지금의 상태를 고른 뒤, 본 날짜나 플랫폼처럼 기억하고 싶은 것만 더해보세요. 여러 OTT의 기록이 한 타임라인에 모여요.",
    updatedAt: "2026-11-11",
    updatedLabel: "2026년 11월 11일 업데이트",
    image: {
      src: "/guides/v2-brand-ko-home.png",
      width: 2560,
      height: 1600,
      alt: "첫 기록을 시작하는 ottline 홈 화면에 기록 버튼과 영상·책 선택, 인기 작품 포스터가 보이는 모습",
      caption:
        "홈에서 기록 버튼을 누르면 작품 검색창이 열려요. 처음에는 인기 작품 포스터에서 바로 골라도 좋아요.",
    },
    cardTitle: "OTT 시청 기록을 시작하는 방법",
    cardDescription:
      "여러 OTT에서 본 영화와 시리즈를 하나의 타임라인에 모으는 흐름을 살펴봐요.",
    cardAction: "OTT 시청 기록 안내 보기",
    sections: [
      {
        title: "어디서 봤든, 작품을 한곳에 모아요",
        paragraphs: [
          "OTT마다 시청 이력은 따로 남아요. ottline에서는 여러 서비스에서 본 작품을 모으고, 원하면 어디서 봤는지도 함께 남길 수 있어요.",
          "플랫폼을 적지 않아도 괜찮아요. 제목과 상태만으로도 같은 타임라인에서 기록을 이어갈 수 있어요.",
        ],
      },
      {
        title: "상태를 고른 뒤 기록을 남겨요",
        paragraphs: [
          "홈에서 기록 버튼을 누르면 작품 검색창이 열려요. 긴 감상을 준비하지 않아도 괜찮아요.",
        ],
        ordered: true,
        items: [
          {
            title: "작품 찾기",
            description:
              "검색창에서 ‘영상’을 고르고 영화나 시리즈 제목을 검색해 작품을 선택해요.",
          },
          {
            title: "지금의 상태 남기기",
            description:
              "봤어요, 보는 중, 보고 싶어요 가운데 지금과 가까운 상태를 고른 뒤, 아래의 ‘기록 남기기’를 눌러요.",
          },
          {
            title: "원할 때 더 적기",
            description:
              "기록한 뒤 ‘그날의 순간’에 날짜·플랫폼·장소·상황을 더하거나, 느낌과 짧은 메모를 남길 수 있어요. 지금 더하지 않아도 기록은 남아 있어요.",
          },
        ],
      },
      {
        title: "개인 기록이 기본이고, 공유는 선택이에요",
        paragraphs: [
          "기록은 내 타임라인에 먼저 남아요. 메모를 적는 것만으로 공개되지는 않아요. ‘함께 화면에도 나누기’를 직접 선택하면 작품과 메모가 ‘함께’ 화면에 공개되고, 날짜·장소·상황은 공개되지 않아요.",
          "공유 카드도 원할 때 따로 만들 수 있어요. 나만 다시 읽을 기록은 개인 타임라인에 그대로 두어도 괜찮아요.",
        ],
      },
      {
        title: "날짜와 작은 단서가 기억을 불러와요",
        paragraphs: [
          "타임라인에는 영화, 시리즈, 책 기록이 날짜순으로 이어져요. 포스터와 제목만으로도 그때의 장면이 떠오르고, 함께 적은 장소나 상황, 메모는 기억을 조금 더 또렷하게 해줘요.",
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
    metaTitle: "영화·드라마 시청 기록 앱, 타임라인에 남기는 방법",
    metaDescription:
      "영화·드라마 시청 기록 앱 ottline에서 시청 상태와 시즌·에피소드를 남기고, 느낌(평점), 날짜, 장소, 상황과 메모를 더해 타임라인으로 돌아보는 방법을 알아보세요.",
    eyebrow: "영화·시리즈 기록",
    title: "영화와 시리즈 시청 기록을 한곳에 남겨요",
    summary:
      "같은 작품을 봐도 남는 기억은 저마다 달라요. 어디까지 봤는지, 누구와 있었는지, 어떤 마음이었는지 기억하고 싶은 만큼 적어두면 다시 만날 때 그 순간이 떠올라요.",
    updatedAt: "2026-11-11",
    updatedLabel: "2026년 11월 11일 업데이트",
    image: {
      src: "/guides/v2-brand-ko-recording.png",
      width: 2560,
      height: 1600,
      alt: "인셉션을 선택한 기록창에 봤어요·보는 중·보고 싶어요 버튼과 접힌 ‘그날의 순간 (선택)’ 영역이 보이는 모습",
      caption:
        "상태를 고른 뒤 아래의 ‘기록 남기기’를 눌러요. ‘그날의 순간’은 원할 때 펼쳐 더할 수 있어요.",
    },
    cardTitle: "영화·시리즈를 더 또렷하게 기억하는 방법",
    cardDescription:
      "상태와 시즌·에피소드부터 그날의 장소와 메모까지, 기억하고 싶은 것만 남겨요.",
    cardAction: "영화·시리즈 기록 안내 보기",
    sections: [
      {
        title: "영화와 시리즈에 맞는 상태를 골라요",
        paragraphs: [
          "홈의 기록 버튼으로 작품을 찾은 뒤, 봤어요·보는 중·보고 싶어요 가운데 지금과 가까운 상태를 골라요. 아래의 ‘기록 남기기’를 누르면 타임라인에 남아요.",
          "시리즈는 시즌과 에피소드도 함께 남길 수 있어요. 어디까지 봤는지 적어두면 다음에 이어볼 곳을 찾기 쉬워져요.",
        ],
      },
      {
        title: "그날의 순간을 더해도 좋아요",
        paragraphs: [
          "집에서 혼자 본 날, 가족과 함께한 주말처럼 장소와 상황을 남겨보세요. ‘그날의 순간’에서 날짜와 플랫폼도 더할 수 있어요. 모두 원할 때 적으면 되고, 느낌이나 메모가 없어도 충분한 기록이에요.",
        ],
        items: [
          {
            title: "날짜와 장소",
            description:
              "실제로 본 날짜와 집·극장처럼 기억의 배경이 된 장소를 남길 수 있어요.",
          },
          {
            title: "함께한 상황",
            description:
              "혼자, 가족과, 친구와처럼 그날의 분위기를 떠올릴 단서를 더해도 좋아요.",
          },
          {
            title: "느낌과 한 줄 메모",
            description:
              "느낌을 남기고 싶다면 최고예요, 볼만해요, 아쉬워요 가운데 하나를 고를 수 있어요. 메모도 선택이에요. 둘 다 나중에 더하거나 비워두어도 괜찮아요.",
          },
        ],
      },
      {
        title: "생각이 달라지면 기록을 이어 고쳐요",
        paragraphs: [
          "보는 중이던 시리즈를 다 봤거나, 시간이 지나 느낌과 메모가 달라졌다면 기존 기록을 수정할 수 있어요. 바뀐 내용은 히스토리에 남아, 처음의 인상과 나중의 마음을 함께 돌아볼 수 있어요.",
        ],
      },
      {
        title: "공개 기록은 가까운 흔적처럼 만나요",
        paragraphs: [
          "‘함께 화면에도 나누기’를 선택하면 작품과 메모가 ‘함께’ 화면에 공개돼요. 다른 사람들이 같은 작품에 남긴 짧은 이야기도 이곳에서 둘러볼 수 있어요. 개인 기록에 메모를 쓰는 것만으로 공개되지는 않아요.",
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
      "책 제목이나 저자를 검색하고 읽었어요·읽는 중·읽고 싶어요 상태를 고른 뒤, 날짜, 장소, 상황과 메모를 ottline 독서 기록 타임라인에 더하는 방법을 알아보세요.",
    eyebrow: "독서 기록",
    title: "책과 함께한 시간을 천천히 이어 적어요",
    summary:
      "읽기 시작한 날의 기대도, 덮고 난 뒤 남은 한 문장도 좋은 기록이 돼요. 완성된 서평을 쓰지 않아도 책과 함께한 시간이 타임라인에 자연스럽게 이어져요.",
    updatedAt: "2026-11-11",
    updatedLabel: "2026년 11월 11일 업데이트",
    image: {
      src: "/guides/v2-brand-ko-space.png",
      width: 2560,
      height: 1600,
      alt: "아직 기록이 없는 ottline 내 공간 화면에 프로필 안내, 내 기록 이어보기와 연결된 기기 영역이 보이는 모습",
      caption:
        "첫 기록이 서버와 동기화되면 ‘내 공간’에 기록 연결 코드가 생겨요. 다른 기기에서도 같은 기록을 이어볼 수 있어요.",
    },
    cardTitle: "부담 없이 독서 기록을 이어가는 방법",
    cardDescription:
      "읽는 중의 마음부터 다 읽은 뒤의 메모까지, 책과 함께한 시간을 모아봐요.",
    cardAction: "독서 기록 안내 보기",
    sections: [
      {
        title: "읽는 과정도 한 권의 기록이에요",
        paragraphs: [
          "책은 다 읽은 뒤에만 기록할 필요는 없어요. 읽기 시작할 때는 ‘읽는 중’, 나중을 위해 담아둘 때는 ‘읽고 싶어요’, 마지막 장을 덮은 뒤에는 ‘읽었어요’를 고르면 돼요.",
          "상태가 달라지면 기록을 고쳐 이어갈 수 있어요. 처음의 기대와 읽은 뒤의 마음이 한 권의 시간으로 쌓여요.",
        ],
      },
      {
        title: "책 제목이나 저자부터 찾아요",
        paragraphs: [
          "홈에서 기록 버튼을 눌러 검색창을 열고 ‘책’을 골라요. 제목이나 저자로 검색한 뒤 표지와 책 정보를 확인해 기록할 책을 선택해요.",
        ],
        ordered: true,
        items: [
          {
            title: "읽기 상태 고르기",
            description:
              "읽었어요, 읽는 중, 읽고 싶어요 가운데 지금과 가까운 상태를 고른 뒤, 아래의 ‘기록 남기기’를 눌러요.",
          },
          {
            title: "그날의 순간 더하기",
            description:
              "원하면 날짜와 집·카페·이동 중처럼 책을 펼친 장소, 함께한 상황을 더할 수 있어요. 나중에 더해도 괜찮아요.",
          },
          {
            title: "느낌이나 한 문장 더하기",
            description:
              "인생책, 무난해요, 아쉬워요 가운데 느낌을 고르거나 마음에 남은 생각을 메모할 수 있어요. 느낌과 메모는 모두 선택이에요.",
          },
        ],
      },
      {
        title: "영상과 책을 같은 타임라인에서 돌아봐요",
        paragraphs: [
          "영화와 시리즈, 책 기록이 날짜순으로 함께 놓여 그 시기에 무엇을 보고 읽었는지 돌아볼 수 있어요. 종류별로 나누어 보고 싶을 때는 타임라인 필터를 사용할 수 있어요.",
        ],
      },
      {
        title: "내 기록은 이어보고, 필요할 때 내보내요",
        paragraphs: [
          "첫 기록이 서버와 동기화되면 ‘내 공간’에서 기록 연결 코드를 확인할 수 있어요. 다른 기기의 ‘내 공간’에 이 코드를 입력하면 같은 기록을 이어볼 수 있어요. ‘내 기록 내보내기’에서는 기록을 CSV 파일로 보관할 수도 있어요.",
          "기록을 공개하는 일은 선택이에요. 메모를 적는 것만으로 공개되지는 않으니, 나만 다시 읽을 기록은 개인 타임라인에 그대로 두어도 괜찮아요.",
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
    metaTitle: "How to start an OTT watch log",
    metaDescription:
      "Keep an OTT watch log with ottline. Find movies and series, choose a watch status, and add optional feelings, platform, place, occasion, dates, or notes.",
    eyebrow: "OTT watch records",
    title: "Keep the moment, wherever you watched it",
    summary:
      "Bring titles from different streaming services into one personal timeline. Find a title, choose its current status, and add a date, platform, or any other details you want to remember.",
    updatedAt: "2026-11-11",
    updatedLabel: "Updated November 11, 2026",
    image: {
      src: "/guides/v2-brand-en-home.png",
      width: 2560,
      height: 1600,
      alt: "ottline Home before the first record, with a record button, Video and Book choices, and popular title posters",
      caption:
        "Open title search with the record button on Home, or start with one of the popular titles shown here.",
    },
    cardTitle: "Keep viewing records across streaming services",
    cardDescription:
      "See how movies and series from different services can meet in one personal timeline.",
    cardAction: "Read the OTT watch log guide",
    sections: [
      {
        title: "Bring titles from different services together",
        paragraphs: [
          "Each streaming service keeps its own viewing history. In ottline, you can keep those titles together and add where you watched them if you like.",
          "The platform is optional. A title and a status are enough to keep your records together on the same timeline.",
        ],
      },
      {
        title: "Choose a status, then keep your record",
        paragraphs: [
          "Use the record button on Home to open title search. You can keep a record with just the title and its current status.",
        ],
        ordered: true,
        items: [
          {
            title: "Find the movie or series",
            description:
              "Choose Video in search, find the title, and select the movie or series you want to keep.",
          },
          {
            title: "Choose its current status",
            description:
              "Choose Watched, Watching, or Want to watch, then tap ‘Keep this record’ below to add it to your timeline.",
          },
          {
            title: "Add more whenever you like",
            description:
              "After saving, you can add a date, platform, place, or occasion in The moment, or leave a feeling and a short note. These are optional, and you can come back to them later.",
          },
        ],
      },
      {
        title: "Private first, shared when you choose",
        paragraphs: [
          "Records start on your personal timeline. Adding a note does not make it public. If you choose to share in Together, the title and note become public. The date, place, and occasion stay private.",
          "You can also create a share card whenever you like. Records meant just for you can stay on your personal timeline.",
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
      label: "Keep a video record",
    },
  },
  "movie-series-log": {
    slug: "movie-series-log",
    contentType: "video",
    metaTitle: "Movie and series watch log app: build your timeline",
    metaDescription:
      "Keep a movie and series watch log in ottline with status, seasons, and episodes, plus optional feelings, dates, places, occasions, and notes.",
    eyebrow: "Movie and series records",
    title: "Keep movie and series watch history in one place",
    summary:
      "The part that stays with you may be an episode, a room, or the person beside you. A few small details make it easier to return to a series and to remember how a film met you at the time.",
    updatedAt: "2026-11-11",
    updatedLabel: "Updated November 11, 2026",
    image: {
      src: "/guides/v2-brand-en-recording.png",
      width: 2560,
      height: 1600,
      alt: "The recording dialog with Inception selected, Watched, Watching, and Want to watch buttons, and the collapsed ‘The moment (optional)’ section",
      caption:
        "Choose a status, then tap ‘Keep this record’ below. Open ‘The moment’ whenever you want to add a date, platform, place, or occasion.",
    },
    cardTitle: "Remember the details of a movie or series",
    cardDescription:
      "Keep your status, season or episode, and the small details that bring a viewing moment back.",
    cardAction: "Read the movie and series guide",
    sections: [
      {
        title: "Use a status that fits the way you watch",
        paragraphs: [
          "Use the record button on Home to find a movie or series. Choose Watched, Watching, or Want to watch, then tap ‘Keep this record’ below.",
          "For a series, you can also keep season and episode details to help you find where to continue.",
        ],
      },
      {
        title: "Add a few details from the day",
        paragraphs: [
          "A day at home, a weekend with family, or a cinema trip with a friend can bring the memory back. You can add the date, platform, place, and occasion in The moment whenever you like. Your record is complete even without a feeling or a note.",
        ],
        items: [
          {
            title: "Date and place",
            description:
              "If you like, keep the day you watched and the place that became part of the memory.",
          },
          {
            title: "Who you were with",
            description:
              "You can note whether it was time alone, with family, or with friends.",
          },
          {
            title: "A feeling and a short note",
            description:
              "If you want to leave a feeling, choose Excellent, Worth watching, or Disappointing. A note is optional too. You can add either later or leave both blank.",
          },
        ],
      },
      {
        title: "Let the record change as your thoughts do",
        paragraphs: [
          "When you finish a series or your feelings change over time, you can update the existing record. Its history keeps the changes, so you can look back at your first impression and your later thoughts.",
        ],
      },
      {
        title: "Find other people's stories in Together",
        paragraphs: [
          "If you choose to share in Together, your title and note appear beside other people's stories about the same work. Adding a note to a personal record does not share it automatically.",
        ],
      },
    ],
    cta: {
      title: "Is there a scene you still remember?",
      description:
        "Find the title and keep one small detail that can bring the scene back.",
      label: "Keep a movie or series record",
    },
  },
  "book-log": {
    slug: "book-log",
    contentType: "book",
    metaTitle: "A book log for every stage of reading",
    metaDescription:
      "Search by book title or author and save reading status, dates, places, occasions, and notes in your personal ottline book timeline.",
    eyebrow: "Reading records",
    title: "Keep the time you spent with a book",
    summary:
      "The anticipation at the first page and the thought that remains after the last are both worth keeping. Your reading records can grow along the way, with as much or as little detail as you like.",
    updatedAt: "2026-11-11",
    updatedLabel: "Updated November 11, 2026",
    image: {
      src: "/guides/v2-brand-en-space.png",
      width: 2560,
      height: 1600,
      alt: "ottline My space before the first record, with profile guidance, record connection guidance, and the Connected devices section",
      caption:
        "Your record connection code appears in My space after your first record syncs. Use it to continue with the same records on another device.",
    },
    cardTitle: "A simple place for your reading records",
    cardDescription:
      "Save the feeling of starting, the details along the way, and a note after the final page.",
    cardAction: "Read the book log guide",
    sections: [
      {
        title: "Keep a record while you read",
        paragraphs: [
          "A book does not need to be finished before it becomes a record. Choose Reading when you begin, Want to read when you are saving it for later, and Read after the final page.",
          "Update the status as it changes. The anticipation at the start and your thoughts at the end can stay connected as one stretch of time with the book.",
        ],
      },
      {
        title: "Begin with a title or author",
        paragraphs: [
          "Use the record button on Home to open search and choose Book. Search by title or author, then check the cover and book details to select the right edition.",
        ],
        ordered: true,
        items: [
          {
            title: "Choose your reading status",
            description:
              "Choose Read, Reading, or Want to read, then tap ‘Keep this record’ below to add it to your timeline.",
          },
          {
            title: "Add details in The moment",
            description:
              "If you like, add the date, where you read, and who you were with. You can come back to these details later.",
          },
          {
            title: "Add a feeling or a thought",
            description:
              "You can choose Life-changing, Not bad, or Disappointing, or leave a note about something that stayed with you. Both the feeling and the note are optional.",
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
          "After your first record syncs, you can find your record connection code in My space. Enter it in My space on another device to continue with the same records. Export my records also lets you keep a CSV copy.",
          "Sharing is optional. Adding a note does not make it public, so records meant just for you can stay on your personal timeline.",
        ],
      },
    ],
    cta: {
      title: "What book is beside you now?",
      description:
        "It is fine to be partway through. Start with the title and your current status.",
      label: "Keep a reading record",
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
