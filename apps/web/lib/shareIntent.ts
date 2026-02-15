export type ShareIntentParseResult = {
  query: string;
  contentType: "video" | "book";
};

type PlatformLabel =
  | "넷플릭스"
  | "디즈니플러스"
  | "애플티비"
  | "프라임비디오"
  | "티빙"
  | "쿠팡플레이"
  | "왓챠";

function normalizeText(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripUrls(text: string): string {
  return text.replace(/https?:\/\/\S+/gi, " ").replace(/[ ]{2,}/g, " ").trim();
}

function extractUrls(text: string): string[] {
  return text.match(/https?:\/\/\S+/gi) ?? [];
}

export function extractShareIntentUrls(sharedText?: string | null, sharedSubject?: string | null): string[] {
  const merged = normalizeText([sharedSubject ?? "", sharedText ?? ""].filter(Boolean).join("\n"));
  if (!merged) return [];
  return extractUrls(merged);
}

function inferPlatformFromText(text: string): PlatformLabel | null {
  const t = text.toLowerCase();
  if (/(넷플릭스|netflix)/i.test(t)) return "넷플릭스";
  if (/(디즈니\+|디즈니플러스|disney\+)/i.test(t)) return "디즈니플러스";
  if (/(apple\s*tv|애플\s*tv|애플티비)/i.test(t)) return "애플티비";
  if (/(prime video|프라임\s*비디오|프라임비디오)/i.test(t)) return "프라임비디오";
  if (/(tving|티빙)/i.test(t)) return "티빙";
  if (/(coupang play|coupangplay|쿠팡플레이)/i.test(t)) return "쿠팡플레이";
  if (/(watcha|왓챠)/i.test(t)) return "왓챠";
  return null;
}

function inferPlatformFromUrl(urlRaw: string): PlatformLabel | null {
  try {
    const host = new URL(urlRaw).hostname.toLowerCase();
    if (host.includes("netflix.com")) return "넷플릭스";
    if (host.includes("disneyplus.com")) return "디즈니플러스";
    if (host.includes("apple.com")) return "애플티비";
    if (host.includes("primevideo.com")) return "프라임비디오";
    if (host.includes("tving.com")) return "티빙";
    if (host.includes("coupangplay") || host.includes("app.link")) return "쿠팡플레이";
    if (host.includes("watcha")) return "왓챠";
    return null;
  } catch {
    return null;
  }
}

export function inferShareIntentPlatform(sharedText?: string | null, sharedSubject?: string | null): PlatformLabel | null {
  const merged = normalizeText([sharedSubject ?? "", sharedText ?? ""].filter(Boolean).join("\n"));
  if (!merged) return null;

  const byText = inferPlatformFromText(merged);
  if (byText) return byText;

  for (const u of extractUrls(merged)) {
    const byUrl = inferPlatformFromUrl(u);
    if (byUrl) return byUrl;
  }
  return null;
}

export function sanitizeResolvedTitle(rawTitle?: string | null): string | null {
  const source = (rawTitle ?? "").trim();
  if (!source) return null;

  const cleaned = source
    // 플랫폼 꼬리표 제거
    .replace(/\s*[|｜]\s*(TVING|티빙|쿠팡플레이|COUPANG PLAY|NETFLIX|DISNEY\+?|APPLE TV|PRIME VIDEO)\s*$/i, "")
    // 회차 표기 제거 (예: 1화, 12회, EP 3, E03)
    .replace(/\s*(\d{1,3}\s*(화|회)|EP?\s*\d{1,3}|E\d{1,3})\s*$/i, "")
    // 시즌 꼬리표 제거 (검색 정확도 향상 목적)
    .replace(/\s*(시즌|season)\s*\d{1,2}\s*$/i, "")
    .replace(/[ ]{2,}/g, " ")
    .trim();

  return cleaned || null;
}

function pickQuotedTitle(text: string): string | null {
  const quotePatterns = [
    /"([^"\n]{1,80})"/,
    /“([^”\n]{1,80})”/,
    /'([^'\n]{1,80})'/,
    /‘([^’\n]{1,80})’/,
    /《([^》\n]{1,80})》/,
    /〈([^〉\n]{1,80})〉/,
    /「([^」\n]{1,80})」/,
    /『([^』\n]{1,80})』/,
  ];
  for (const pattern of quotePatterns) {
    const m = text.match(pattern);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function pickFallbackLine(text: string): string {
  const withoutUrls = stripUrls(text);
  const line =
    withoutUrls
      .split("\n")
      .map((v) => v.trim())
      .find((v) => v.length > 0) ?? "";
  return line.slice(0, 160);
}

function pickSeasonStyledTitle(text: string): string | null {
  const patterns = [
    /(.+?)\s*[-:]\s*시즌\s*(\d{1,2})/i,
    /(.+?)\s*[-:]\s*season\s*(\d{1,2})/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (!m?.[1]) continue;
    const title = m[1].trim().replace(/[.!?]+$/g, "");
    if (!title) continue;
    // 작품 검색 정확도를 위해 시즌 정보는 제외하고 제목만 사용
    return title.slice(0, 160);
  }
  return null;
}

function pickPlatformTaggedTitle(text: string): string | null {
  const m = text.match(/(.+?)\s*[-–—]\s*.+?\((apple\s*tv|disney\+?|prime video|netflix|tving|watcha|coupang play)\)/i);
  if (!m?.[1]) return null;
  const base = m[1].trim().replace(/^['"“‘《〈「『]+|['"”’》〉」』]+$/g, "");
  if (!base) return null;
  return base.slice(0, 160);
}

function cleanPromotionalText(text: string): string {
  return text
    .replace(/저는 지금\s+(.+?)\s+보고 있습니다[.!?]?/gi, "$1")
    .replace(/여러분도\s+지금\s+바로\s+.+$/gi, "")
    .replace(
      /[-–—]\s*(프라임 비디오|prime video|넷플릭스|netflix|디즈니\+?|disney\+?|티빙|tving|왓챠|watcha).*/gi,
      "",
    )
    .replace(/감상하세요[.!?]?/gi, "")
    .replace(/\(\s*을\s*\)|\(\s*를\s*\)/g, "")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

function pickQueryFromUrl(urlRaw: string): string | null {
  try {
    const u = new URL(urlRaw);
    const segments = u.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return null;

    const last = decodeURIComponent(segments[segments.length - 1] ?? "").trim();
    if (!last) return null;

    // slug 스타일이면 검색 친화적으로 변환
    if (/[a-zA-Z]/.test(last) && /[-_]/.test(last)) {
      return last.replace(/[-_]+/g, " ").trim().slice(0, 160);
    }

    // app.link 등 단축 URL의 opaque token은 검색 품질이 낮아 제외
    const opaqueId = /^[A-Za-z0-9]{8,}$/.test(last);
    if (opaqueId) {
      return null;
    }

    // TVING처럼 ID만 있는 경우도 최소한 검색창에 남겨서 사용자가 이어서 수정 가능하게 함
    return last.slice(0, 160);
  } catch {
    return null;
  }
}

function isLowSignalQuery(query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const onlyPromo =
    /(쿠팡\s*회원이라면|쿠팡플레이에서 보세요|지금 바로|감상해보세요|프라임 비디오에서 감상하세요|watch on|available on)/i.test(
      query,
    ) && !/[《〈「『"“][^"”》〉」』\n]+["”》〉」』]/.test(query);

  const platformOnly = /^(쿠팡플레이|넷플릭스|디즈니\+?|프라임 비디오|티빙|왓챠|youtube|유튜브)$/i.test(q);

  return onlyPromo || platformOnly;
}

export function parseShareIntentText(sharedText?: string | null, sharedSubject?: string | null): ShareIntentParseResult | null {
  const merged = normalizeText([sharedSubject ?? "", sharedText ?? ""].filter(Boolean).join("\n"));
  if (!merged) return null;

  const looksBook = /(isbn|책|도서|book|author|저자|출판|교보|알라딘|yes24|리디)/i.test(merged);
  const contentType: "video" | "book" = looksBook ? "book" : "video";

  const quoted = pickQuotedTitle(merged);
  if (quoted) {
    return { query: quoted, contentType };
  }

  const seasonStyled = pickSeasonStyledTitle(merged);
  if (seasonStyled) {
    return { query: seasonStyled, contentType };
  }

  const platformTagged = pickPlatformTaggedTitle(merged);
  if (platformTagged) {
    return { query: platformTagged, contentType };
  }

  const cleaned = cleanPromotionalText(
    stripUrls(merged)
    .replace(/혹시 .*에서 /i, "")
    .replace(/보셨나요\??/i, "")
    .replace(/읽어보셨나요\??/i, "")
    .trim(),
  );
  const query = (cleaned || pickFallbackLine(merged)).slice(0, 160);
  if (!query) {
    const urlQuery = extractUrls(merged)
      .map((v) => pickQueryFromUrl(v))
      .find((v): v is string => Boolean(v && v.trim()));
    if (!urlQuery) return null;
    return { query: urlQuery, contentType };
  }

  if (isLowSignalQuery(query)) {
    const urlQuery = extractUrls(merged)
      .map((v) => pickQueryFromUrl(v))
      .find((v): v is string => Boolean(v && v.trim()));
    if (!urlQuery) return null;
    return { query: urlQuery, contentType };
  }

  // 넷플릭스/유튜브/왓챠/디즈니 등 공유 문구가 길면 첫 문장만 사용
  const firstSentence = query.split(/[.!?]\s/)[0]?.trim() || query;
  return { query: firstSentence.slice(0, 160), contentType };
}
