import assert from "node:assert/strict";
import test from "node:test";
import { editedRecordDate, recordDateInput } from "./recordDate.ts";

for (const zone of ["Asia/Seoul", "America/Los_Angeles", "UTC"]) {
  test(`date-only edits preserve untouched timestamps and calendar dates in ${zone}`, () => {
    const previous = process.env.TZ;
    process.env.TZ = zone;
    try {
      for (const original of [
        "2026-11-01T01:30:00-07:00",
        "2026-03-08T10:30:00.123Z",
        "2026-11-03T18:45:12+09:00",
      ]) {
        assert.equal(
          editedRecordDate(original, recordDateInput(original)),
          original,
        );
        assert.equal(editedRecordDate(original, ""), original);
      }
      for (const date of ["2026-03-08", "2026-11-01", "2026-11-03"]) {
        const result = editedRecordDate("2026-01-01T00:00:00Z", date);
        assert.equal(recordDateInput(result), date);
      }
      assert.throws(() =>
        editedRecordDate("2026-01-01T00:00:00Z", "2026-02-30"),
      );
      assert.throws(() =>
        editedRecordDate("2026-01-01T00:00:00Z", "not-a-date"),
      );
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
}
