export function googleBooksUrl(book: {
  provider?: string;
  providerId?: string;
  sourceUrl?: string | null;
}) {
  if (book.sourceUrl) {
    try {
      const url = new URL(book.sourceUrl);
      if (
        url.protocol === "https:" &&
        url.hostname === "books.google.com" &&
        !url.username &&
        !url.password
      ) {
        return url.href;
      }
    } catch {
      // Unsupported source URLs do not become external links.
    }
  }
  return book.provider === "GOOGLE_BOOKS" && book.providerId
    ? `https://books.google.com/books?id=${encodeURIComponent(book.providerId)}`
    : null;
}
