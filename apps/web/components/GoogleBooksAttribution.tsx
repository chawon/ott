export default function GoogleBooksAttribution({
  href = "https://books.google.com/",
  logo = true,
}: {
  href?: string;
  logo?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-12 shrink-0 items-center gap-2 px-3 text-sm text-[#1E4D8C] underline underline-offset-4 dark:text-foreground"
    >
      {logo ? (
        <img
          src="/google-books-powered-by.png"
          width={62}
          height={30}
          alt="Powered by Google"
        />
      ) : null}
      <span>Google Books</span>
    </a>
  );
}
