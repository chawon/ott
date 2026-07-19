/**
 * Reads the latest public-log timestamp for one locale. A missing backend or a
 * failed response intentionally yields undefined so sitemap generation remains
 * available without inventing a last-modified value.
 */
export async function loadLatestPublicLogDate({
  backendUrl,
  locale,
  fetchImpl = fetch,
}) {
  const normalizedBackendUrl = backendUrl?.replace(/\/+$/, "");
  if (!normalizedBackendUrl) return undefined;

  try {
    const response = await fetchImpl(
      `${normalizedBackendUrl}/api/discussions/all?limit=100`,
      {
        headers: { "Accept-Language": locale },
        next: { revalidate: 300 },
      },
    );
    if (!response.ok) return undefined;

    const rows = await response.json();
    const latestTimestamp = rows.reduce((latest, row) => {
      if (!row?.createdAt) return latest;
      const timestamp = Date.parse(row.createdAt);
      return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest;
    }, 0);

    return latestTimestamp > 0 ? new Date(latestTimestamp) : undefined;
  } catch {
    return undefined;
  }
}
