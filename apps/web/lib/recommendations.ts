import type {
  RecommendationExclusion,
  RecommendationItem,
  RecommendationSnapshot,
} from "./types";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export type DismissedRecommendation = Pick<
  RecommendationItem,
  | "name"
  | "provider"
  | "providerId"
  | "alternateNames"
  | "originalName"
  | "author"
  | "isbn10"
  | "isbn13"
  | "year"
> & { type?: RecommendationItem["type"] | null };

export type RecommendationPreferences = {
  dismissed: DismissedRecommendation[];
  lastRefreshedAt: string | null;
};

const LEGACY_DISMISSED_KEY = "watchlog.dismissedRecs";
const LEGACY_REFRESH_KEY = "watchlog.lastRecommendRefresh";
const LEGACY_OWNER_KEY = "watchlog.recommendations.legacyOwner";
const PREFERENCES_PREFIX = "watchlog.recommendations.v2:";

export function normalizeRecommendationName(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function names(item: DismissedRecommendation): string[] {
  return [item.name, item.originalName ?? "", ...(item.alternateNames ?? [])]
    .map(normalizeRecommendationName)
    .filter(Boolean);
}

function identity(item: DismissedRecommendation): string | null {
  return item.provider && item.providerId
    ? `${item.type ?? ""}:${item.provider.toLowerCase()}:${item.providerId}`
    : null;
}

export function recommendationIsDismissed(
  item: DismissedRecommendation,
  dismissed: DismissedRecommendation[],
): boolean {
  const itemNames = new Set(names(item));
  const itemIdentity = identity(item);
  return dismissed.some((previous) => {
    if (item.type && previous.type && item.type !== previous.type) return false;
    const overlap = names(previous).some((name) => itemNames.has(name));
    if (!item.type || !previous.type) return overlap; // Name-only legacy choices.
    if (item.type === "book") {
      const isbn = recommendationIsbn(item);
      const previousIsbn = recommendationIsbn(previous);
      if (isbn && isbn === previousIsbn) return true;
      const authors = authorNames(item.author);
      const previousAuthors = authorNames(previous.author);
      if (authors.length && previousAuthors.length) {
        if (!authors.some((author) => previousAuthors.includes(author)))
          return false;
        if (overlap) return true;
      }
      const previousIdentity = identity(previous);
      if (itemIdentity && previousIdentity && itemIdentity === previousIdentity)
        return true;
      return (
        overlap &&
        authors.length === 0 &&
        previousAuthors.length === 0 &&
        !isbn &&
        !previousIsbn
      );
    }
    const previousIdentity = identity(previous);
    if (itemIdentity && previousIdentity) {
      return itemIdentity === previousIdentity;
    }
    if (item.year && previous.year && Math.abs(item.year - previous.year) > 1)
      return false;
    return overlap;
  });
}

function authorNames(author?: string | null): string[] {
  return (author ?? "")
    .split("/")
    .map(normalizeRecommendationName)
    .filter(Boolean);
}

function recommendationIsbn(item: DismissedRecommendation): string | null {
  const thirteen = (item.isbn13 ?? "").replace(/\D/g, "");
  if (thirteen.length === 13) return thirteen;
  const ten = (item.isbn10 ?? "").replace(/[^\dX]/gi, "");
  if (ten.length !== 10) return null;
  const prefix = `978${ten.slice(0, 9)}`;
  const sum = [...prefix].reduce(
    (value, digit, index) => value + Number(digit) * (index % 2 ? 3 : 1),
    0,
  );
  return `${prefix}${(10 - (sum % 10)) % 10}`;
}

function parseDismissed(value: unknown): DismissedRecommendation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === "string") {
      return normalizeRecommendationName(entry)
        ? [
            {
              name: entry,
              type: undefined,
              provider: undefined,
              providerId: undefined,
              alternateNames: [],
              originalName: undefined,
              author: undefined,
              isbn10: undefined,
              isbn13: undefined,
              year: undefined,
            },
          ]
        : [];
    }
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.name !== "string" ||
      !normalizeRecommendationName(entry.name)
    )
      return [];
    return [
      {
        name: entry.name,
        type: ["movie", "series", "book"].includes(entry.type)
          ? entry.type
          : undefined,
        provider:
          typeof entry.provider === "string" ? entry.provider : undefined,
        providerId:
          typeof entry.providerId === "string" ? entry.providerId : undefined,
        alternateNames: Array.isArray(entry.alternateNames)
          ? entry.alternateNames.filter(
              (name: unknown) => typeof name === "string",
            )
          : [],
        originalName:
          typeof entry.originalName === "string"
            ? entry.originalName
            : undefined,
        author: typeof entry.author === "string" ? entry.author : undefined,
        isbn10: typeof entry.isbn10 === "string" ? entry.isbn10 : undefined,
        isbn13: typeof entry.isbn13 === "string" ? entry.isbn13 : undefined,
        year: typeof entry.year === "number" ? entry.year : undefined,
      },
    ];
  });
}

export type RecommendationOperation = {
  id: string;
  kind: "exclude" | "restore";
  item: RecommendationSnapshot;
  key?: string;
  sourceId?: string;
};

export type RecommendationQueue = {
  legacyImported: boolean;
  operations: RecommendationOperation[];
  generationRequestIds: Record<string, string>;
};

const QUEUE_PREFIX = "watchlog.recommendations.sync.v1:";

export function readRecommendationQueue(
  userId: string,
  storage: StorageLike | null,
): RecommendationQueue {
  const empty: RecommendationQueue = {
    legacyImported: false,
    operations: [],
    generationRequestIds: {},
  };
  try {
    const raw = storage?.getItem(`${QUEUE_PREFIX}${userId}`);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    return {
      legacyImported: parsed.legacyImported === true,
      generationRequestIds: Object.fromEntries(
        Object.entries(parsed.generationRequestIds ?? {}).filter(
          (entry): entry is [string, string] =>
            ["ko", "en"].includes(entry[0]) &&
            typeof entry[1] === "string" &&
            /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(entry[1]),
        ),
      ),
      operations: Array.isArray(parsed.operations)
        ? parsed.operations.filter(
            (operation: RecommendationOperation) =>
              operation &&
              typeof operation.id === "string" &&
              ["exclude", "restore"].includes(operation.kind) &&
              operation.item &&
              typeof operation.item.name === "string" &&
              [null, "movie", "series", "book"].includes(operation.item.type),
          )
        : [],
    };
  } catch {
    return empty;
  }
}

export function saveRecommendationQueue(
  userId: string,
  queue: RecommendationQueue,
  storage: StorageLike | null,
) {
  try {
    storage?.setItem(`${QUEUE_PREFIX}${userId}`, JSON.stringify(queue));
  } catch {
    /* Current-session choices still work without browser persistence. */
  }
}

export function importLegacyRecommendationChoices(
  userId: string,
  queue: RecommendationQueue,
  storage: StorageLike | null,
  newId: () => string,
): RecommendationQueue {
  if (queue.legacyImported) return queue;
  const legacy = readRecommendationPreferences(userId, storage);
  const next: RecommendationQueue = {
    ...queue,
    legacyImported: true,
    operations: [
      ...queue.operations,
      ...legacy.dismissed.map((item) => ({
        id: newId(),
        kind: "exclude" as const,
        item: { ...item, type: item.type ?? null },
      })),
    ],
  };
  saveRecommendationQueue(userId, next, storage);
  return next;
}

export function effectiveRecommendationExclusions(
  server: RecommendationExclusion[],
  operations: RecommendationOperation[],
): RecommendationExclusion[] {
  let result = [...server];
  for (const operation of operations) {
    if (operation.kind === "exclude") {
      if (!recommendationIsDismissed(operation.item, result))
        result.push({
          ...operation.item,
          key: operation.key ?? `pending:${operation.id}`,
        });
    } else {
      result = result.filter(
        (item) =>
          item.key !== operation.key &&
          !recommendationIsDismissed(operation.item, [item]),
      );
    }
  }
  return result;
}

function validDate(value: unknown): string | null {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    ? value
    : null;
}

export function readRecommendationPreferences(
  userId: string,
  storage: StorageLike | null,
): RecommendationPreferences {
  const empty: RecommendationPreferences = {
    dismissed: [],
    lastRefreshedAt: null,
  };
  if (!storage) return empty;
  try {
    const raw = storage.getItem(`${PREFERENCES_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        dismissed: parseDismissed(parsed.dismissed),
        lastRefreshedAt: validDate(parsed.lastRefreshedAt),
      };
    }
    const legacyOwner = storage.getItem(LEGACY_OWNER_KEY);
    if (legacyOwner && legacyOwner !== userId) return empty;
    let dismissed: DismissedRecommendation[] = [];
    try {
      dismissed = parseDismissed(
        JSON.parse(storage.getItem(LEGACY_DISMISSED_KEY) ?? "[]"),
      );
    } catch {
      // Invalid legacy JSON does not prevent a valid refresh date from migrating.
    }
    const lastRefreshedAt = validDate(storage.getItem(LEGACY_REFRESH_KEY));
    if (!dismissed.length && !lastRefreshedAt) return empty;
    // Attribute the old browser-wide settings once. Preserve both old keys so an
    // interrupted migration or an older client does not destroy user choices.
    storage.setItem(LEGACY_OWNER_KEY, userId);
    const migrated = { dismissed, lastRefreshedAt };
    saveRecommendationPreferences(userId, migrated, storage);
    return migrated;
  } catch {
    return empty;
  }
}

export function saveRecommendationPreferences(
  userId: string,
  preferences: RecommendationPreferences,
  storage: StorageLike | null,
): void {
  try {
    storage?.setItem(
      `${PREFERENCES_PREFIX}${userId}`,
      JSON.stringify(preferences),
    );
  } catch {
    // In-memory exclusions still work when browser persistence is unavailable.
  }
}

export function withRecommendationRequest(
  queue: RecommendationQueue,
  locale: string,
  requestId: string | null,
): RecommendationQueue {
  const ids = { ...queue.generationRequestIds };
  if (requestId) ids[locale] = requestId;
  else delete ids[locale];
  return { ...queue, generationRequestIds: ids };
}
