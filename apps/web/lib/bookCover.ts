/** Prefer the provided Kakao cover's original without changing stored title data. */
export function originalBookCoverUrl(source: string): string | null {
  try {
    const thumbnail = new URL(source);
    if (
      !["http:", "https:"].includes(thumbnail.protocol) ||
      !/^search\d+\.kakaocdn\.net$/.test(thumbnail.hostname) ||
      !/^\/thumb\/R\d+x\d+(?:\.q\d+)?\/?$/.test(thumbnail.pathname) ||
      thumbnail.username ||
      thumbnail.password ||
      thumbnail.port
    )
      return null;

    const filename = thumbnail.searchParams.get("fname");
    if (!filename) return null;
    const original = new URL(filename);
    if (
      !["http:", "https:"].includes(original.protocol) ||
      original.hostname !== "t1.daumcdn.net" ||
      !/^\/lbook\/image\/\d+$/.test(original.pathname) ||
      original.username ||
      original.password ||
      original.port
    )
      return null;

    original.protocol = "https:";
    original.hash = "";
    return original.href;
  } catch {
    return null;
  }
}
