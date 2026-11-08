/** Calendar-date editing must not erase the time/offset of an untouched record. */
export function recordDateInput(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function editedRecordDate(original: string, chosenDate: string): string {
  if (!chosenDate || chosenDate === recordDateInput(original)) return original;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(chosenDate))
    throw new Error("Invalid calendar date");
  const date = new Date(`${chosenDate}T00:00:00`);
  if (
    !Number.isFinite(date.getTime()) ||
    recordDateInput(date.toISOString()) !== chosenDate
  ) {
    throw new Error("Invalid calendar date");
  }
  return date.toISOString();
}
