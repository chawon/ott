export type BookPlatformGroup = {
  label: string;
  options: readonly string[];
};

/** Recording presets for English UI; availability is not inferred from locale. */
export const EN_BOOK_PLATFORM_GROUPS: readonly BookPlatformGroup[] = [
  {
    label: "Bookstore",
    options: ["Amazon", "Bookshop.org", "Local bookstore"],
  },
  {
    label: "E-book",
    options: ["Kindle", "Apple Books", "Google Play Books", "Kobo"],
  },
  { label: "Audiobook", options: ["Audible"] },
  {
    label: "Library",
    options: [
      "Libby",
      "Public Library",
      "University Library",
      "School Library",
    ],
  },
];

export const EN_BOOK_PLATFORMS = EN_BOOK_PLATFORM_GROUPS.flatMap(
  (group) => group.options,
);
