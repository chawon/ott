"""Fail CI when a required PostgreSQL integration suite did not execute."""

from pathlib import Path
import xml.etree.ElementTree as ET


REPORTS = Path(__file__).resolve().parents[1] / "build/test-results/test"
REQUIRED_SUITES = (
    "com.watchlog.api.book.BookEditionRepositoryTest",
    "com.watchlog.api.repo.WatchLogPaginationRepositoryTest",
    "com.watchlog.api.service.AnalyticsMetricsQueryTest",
    "com.watchlog.api.service.CuratedAnalyticsQueryTest",
    "com.watchlog.api.service.CuratedContentAdminServiceTest",
    "com.watchlog.api.service.CuratedContentServiceTest",
    "com.watchlog.api.service.CuratorAutomationServiceTest",
)


def counts(report):
    return {
        key: int(report.get(key, "0"))
        for key in ("tests", "failures", "errors", "skipped")
    }


def main():
    problems = []
    for suite in REQUIRED_SUITES:
        path = REPORTS / f"TEST-{suite}.xml"
        if not path.is_file():
            problems.append(f"Missing PostgreSQL test report: {suite}")
            continue
        result = counts(ET.parse(path).getroot())
        print(f"PostgreSQL suite {suite}: {result}")
        if result["tests"] == 0 or any(
            result[key] for key in ("failures", "errors", "skipped")
        ):
            problems.append(f"PostgreSQL suite did not fully pass: {suite}")

    if problems:
        raise SystemExit("\n".join(problems))

    totals = dict.fromkeys(("tests", "failures", "errors", "skipped"), 0)
    for path in REPORTS.glob("TEST-*.xml"):
        for key, value in counts(ET.parse(path).getroot()).items():
            totals[key] += value
    print(f"PASS PostgreSQL integration suites executed; all API tests: {totals}")


if __name__ == "__main__":
    main()
