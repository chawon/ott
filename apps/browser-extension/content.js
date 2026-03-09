const SITE_CONFIGS = [
  {
    host: "www.netflix.com",
    sourceSite: "netflix",
    platform: "넷플릭스",
    patterns: [/\/title\//, /\/watch\//, /\/browse/],
    suffixes: ["| Netflix", "- Netflix", "Netflix"],
    titleSelectors: [
      "[data-uia='previewModal-title']",
      "[data-uia='title-info-title']",
      ".previewModal--boxarttitle",
      ".previewModal--wrapper img[alt]",
      ".previewModal--player-titleTreatment-logo",
      ".video-title h4",
      ".video-title h3",
      ".previewModal--detailsMetadata-left h3",
      ".previewModal--detailsMetadata-left h4",
      "img[alt][class*='titleTreatment']",
      "img[alt][class*='boxart']",
    ],
    isSupported(url) {
      return (
        this.patterns.some((pattern) => pattern.test(url.pathname)) &&
        (url.pathname.includes("/title/") ||
          url.pathname.includes("/watch/") ||
          url.searchParams.has("jbv") ||
          url.searchParams.has("movieid") ||
          !!document.querySelector("[data-uia='previewModal-title'], .previewModal--wrapper"))
      );
    },
  },
  {
    host: "www.disneyplus.com",
    sourceSite: "disneyplus",
    platform: "디즈니플러스",
    patterns: [/\/ko-kr\/browse\/entity-/, /\/en-gb\/browse\/entity-/, /\/video\//, /\/series\//, /\/movies\//],
    suffixes: ["| Disney+", "- Disney+", "Disney+"],
    titleSelectors: [
      "[data-testid='details-title']",
      "[data-testid='series-title']",
      "[data-testid='hero-title']",
      "h1",
      "img[alt][class*='title']",
      "img[alt][class*='logo']",
      "section img[alt]",
    ],
    isSupported(url) {
      return (
        this.patterns.some((pattern) => pattern.test(url.pathname)) ||
        !!document.querySelector(
          "[data-testid='details-title'], [data-testid='hero-title'], img[alt][class*='logo']",
        )
      );
    },
  },
  {
    host: "www.tving.com",
    sourceSite: "tving",
    platform: "티빙",
    patterns: [/\/contents\//],
    suffixes: ["| TVING", "- TVING", "TVING"],
    titleSelectors: ["h1", "meta[property='og:title']", "meta[name='twitter:title']"],
  },
  {
    host: "www.wavve.com",
    sourceSite: "wavve",
    platform: "웨이브",
    patterns: [/\/player\//, /\/vod\//, /\/content\//],
    suffixes: ["| wavve", "- wavve", "wavve", "| Wavve", "- Wavve", "Wavve"],
    titleSelectors: [
      ".detail-view-content-area .preview-title",
      ".detail-view-content-area .thumb-img",
      ".detail-view-content-area .detail-info-box .thumb-img",
      "h1",
      "h2",
      "[class*='title']",
      "[class*='Title']",
      "[class*='vod-name']",
      "[class*='player-title']",
      "img[alt][class*='poster']",
      "meta[property='og:title']",
      "meta[name='twitter:title']",
    ],
    isSupported(url) {
      return (
        this.patterns.some((pattern) => pattern.test(url.pathname)) ||
        url.searchParams.has("programid")
      );
    },
  },
  {
    host: "www.coupangplay.com",
    sourceSite: "coupangplay",
    platform: "쿠팡플레이",
    patterns: [/\/content\//, /\/play\//, /\/titles\//],
    suffixes: ["| 쿠팡플레이", "- 쿠팡플레이", "쿠팡플레이", "| Coupang Play", "- Coupang Play", "Coupang Play"],
    titleSelectors: [
      ".TitleV2_shared_title__efPxd",
      "[class*='TitleV2_shared_title__']",
      "h1",
      "img[alt][class*='title']",
      "meta[property='og:title']",
      "meta[name='twitter:title']",
    ],
  },
  {
    host: "watcha.com",
    sourceSite: "watcha",
    platform: "왓챠",
    patterns: [/\/contents\//],
    suffixes: ["| 왓챠", "- 왓챠", "왓챠", "| WATCHA", "- WATCHA", "WATCHA"],
    titleSelectors: ["h1", "meta[property='og:title']", "meta[name='twitter:title']"],
  },
];

function findSiteConfig(url) {
  const nextUrl = new URL(url);
  return SITE_CONFIGS.find(
    (site) =>
      nextUrl.hostname === site.host &&
      (typeof site.isSupported === "function"
        ? site.isSupported(nextUrl)
        : site.patterns.some((pattern) => pattern.test(nextUrl.pathname))),
  );
}

function selectorText(selector) {
  const node = document.querySelector(selector);
  if (!node) return "";
  if (node instanceof HTMLImageElement) {
    return node.alt?.trim() ?? "";
  }
  return node.textContent?.trim() ?? "";
}

function isVisibleElement(node) {
  if (!(node instanceof HTMLElement || node instanceof SVGElement)) return false;
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function scanNetflixModalTitle() {
  const modalRoot =
    document.querySelector(".previewModal--wrapper") ||
    document.querySelector("[data-uia='preview-modal']");
  if (!modalRoot) return "";

  const priorityCandidates = Array.from(
    modalRoot.querySelectorAll(
      "img[alt][class*='title'], img[alt][class*='logo'], .previewModal--boxarttitle img[alt], .previewModal--player-titleTreatment-logo img[alt], [data-uia='previewModal-title'], [data-uia='title-info-title'], .video-title h4, .video-title h3, .previewModal--detailsMetadata-left h3, .previewModal--detailsMetadata-left h4",
    ),
  )
    .filter((node) => isVisibleElement(node))
    .map((node) => {
      if (node instanceof HTMLImageElement) return node.alt?.trim() ?? "";
      return node.textContent?.trim() ?? "";
    })
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter(
      (value) =>
        value.length >= 2 &&
        value.length <= 80 &&
        !/총\s*\d+\s*분\s*중\s*\d+\s*분\s*재생/i.test(value) &&
        !/^\d+\s*분\s*재생/i.test(value) &&
        !/^(재생|저장|찜|내가 찜한 리스트|상세 정보|예고편|회차 정보|에피소드|시즌 \d+|모두 재생|홈|Netflix 홈)$/i.test(
          value,
        ),
    );

  if (priorityCandidates[0]) {
    return priorityCandidates[0];
  }

  const textNodes = Array.from(
    modalRoot.querySelectorAll("img[alt], h1, h2, h3, h4, span, div"),
  )
    .filter((node) => isVisibleElement(node))
    .map((node) => {
      if (node instanceof HTMLImageElement) return node.alt?.trim() ?? "";
      return node.textContent?.trim() ?? "";
    })
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((value) => value.length >= 2 && value.length <= 80)
    .filter(
      (value) =>
        !/총\s*\d+\s*분\s*중\s*\d+\s*분\s*재생/i.test(value) &&
        !/^\d+\s*분\s*재생/i.test(value) &&
        !/^\d+\s*화$/i.test(value) &&
        !/^(재생|저장|찜|내가 찜한 리스트|상세 정보|예고편|회차 정보|에피소드|시즌 \d+|모두 재생|홈|Netflix 홈)$/i.test(
          value,
        ),
    );

  return textNodes[0] ?? "";
}

function readTitle(site) {
  const selectorCandidates = (site.titleSelectors ?? [])
    .map((selector) => selectorText(selector))
    .filter(Boolean);

  const siteCandidates = [];
  if (site.sourceSite === "netflix") {
    siteCandidates.push(scanNetflixModalTitle());
  }
  if (site.sourceSite === "wavve") {
    const wavveRoots = [
      document.querySelector(".detail-view-content-area"),
      document.querySelector("#app"),
      document.querySelector("[class*='player']"),
      document.querySelector("[class*='vod']"),
      document.querySelector("[class*='detail']"),
      document.body,
    ].filter(Boolean);

    const wavveCandidates = [];
    for (const root of wavveRoots) {
      wavveCandidates.push(
        ...Array.from(root.querySelectorAll("img[alt], h1, h2, h3, h4, span, div"))
          .filter((node) => isVisibleElement(node))
          .map((node) => {
            if (node instanceof HTMLImageElement) return node.alt?.trim() ?? "";
            return node.textContent?.trim() ?? "";
          })
          .map((value) => value.replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .filter((value) => value.length >= 2 && value.length <= 80)
          .filter(
            (value) =>
              !/^(Wavve\(웨이브\)|웨이브|Wavve|재생|이어보기|전체회차|회차정보|공지사항|로그인|회원가입|이용권|편성표)$/i.test(
                value,
              ),
          ),
      );
      if (wavveCandidates.length > 0) break;
    }
    siteCandidates.push(...wavveCandidates);
  }

  const genericCandidates = [
    document.querySelector("meta[property='og:title']")?.getAttribute("content"),
    document.querySelector("meta[name='twitter:title']")?.getAttribute("content"),
    document.querySelector("meta[name='title']")?.getAttribute("content"),
    document.querySelector("h1")?.textContent,
    document.title,
  ];

  const candidates = [...selectorCandidates, ...siteCandidates, ...genericCandidates];

  return candidates.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() ?? "";
}

function normalizeTitle(rawTitle, site) {
  let title = rawTitle.trim();
  for (const suffix of site.suffixes) {
    if (title.endsWith(suffix)) {
      title = title.slice(0, -suffix.length).trim();
    }
  }
  title = title
    .replace(/\s*\|\s*(넷플릭스|Netflix|디즈니\+|Disney\+|TVING|wavve|Wavve|WATCHA|왓챠|쿠팡플레이|Coupang Play)\s*$/i, "")
    .replace(/\s*-\s*(넷플릭스|Netflix|디즈니\+|Disney\+|TVING|wavve|Wavve|WATCHA|왓챠|쿠팡플레이|Coupang Play)\s*$/i, "")
    .replace(/^\s*(넷플릭스|Netflix|디즈니\+|Disney\+)\s*[:|-]\s*/i, "")
    .trim();
  if (/^(Netflix 홈|넷플릭스 홈|Netflix 대한민국|넷플릭스 대한민국)$/i.test(title)) {
    return "";
  }
  if (/^(Wavve\(웨이브\)|웨이브|Wavve)$/i.test(title)) {
    return "";
  }
  if (site.sourceSite === "tving") {
    title = title
      .replace(/^['"](.+?)['"]\s*-\s*.+$/, "$1")
      .replace(/\s+시즌\s*\d+\s*\d+\s*화$/i, "")
      .replace(/\s+시즌\s*\d+\s*$/i, "")
      .replace(/\s+\d+\s*화$/i, "")
      .trim();
  }
  if (site.sourceSite === "wavve") {
    title = title
      .replace(/\s+시즌\s*\d+\s*$/i, "")
      .replace(/\s+\d+\s*화$/i, "")
      .trim();
  }
  if (/^(공지사항|로그인|회원가입|이용권|편성표)$/i.test(title)) {
    return "";
  }
  return title.replace(/\s+/g, " ").trim();
}

function getCapturePayload() {
  try {
    const site = findSiteConfig(window.location.href);
    if (!site) {
      return { ok: false, reason: "unsupported" };
    }

    const title = normalizeTitle(readTitle(site), site);
    if (!title || title.length < 2) {
      return { ok: false, reason: "empty_title" };
    }

    return {
      ok: true,
      title,
      contentType: "video",
      sourceSite: site.sourceSite,
      platform: site.platform,
      sourceUrl: window.location.href,
    };
  } catch {
    return { ok: false, reason: "capture_failed" };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "OTT_CAPTURE_PAGE") {
    sendResponse(getCapturePayload());
  }
});
