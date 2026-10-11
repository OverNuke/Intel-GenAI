/** Lower-case, accent-insensitive form used by every search box. */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Matches the display id (full "INC0001056", or its numeric part) or the summary. */
export function matchesIdOrSummary(id: string, summary: string, rawQuery: string): boolean {
  const query = normalize(rawQuery);
  if (!query) return true;
  const normalizedId = normalize(id);
  const numeric = /^\d+$/.test(query) && normalizedId.replace(/^inc/, "").includes(query);
  return normalizedId.includes(query) || numeric || normalize(summary).includes(query);
}
