"""Exercise real HTTP contracts and preserve a snapshot across API upgrades."""

import argparse
from datetime import datetime, timedelta
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--base-url", default="http://127.0.0.1:18080")
parser.add_argument("--snapshot", type=Path, required=True)
parser.add_argument("--seed", action="store_true")
args = parser.parse_args()
url = urlparse(args.base_url)
if url.scheme != "http" or url.hostname not in ("127.0.0.1", "localhost", "::1"):
    raise SystemExit("API verification must use a local test server")

TITLE = "Boot 4.1 검증 영화"
GENRES = ["드라마", "Science Fiction"]
NOTE = "동기화 후에도 수동 메모와 평점, 시청일을 보존합니다. Ω"
WATCHED_AT = "2026-10-07T10:00:00Z"


def request(path, auth=None, method="GET", body=None, expected_status=200):
    headers = {"Accept": "application/json", "User-Agent": "ottline-api-verifier"}
    if auth:
        headers.update({"X-User-Id": auth["userId"], "X-Device-Id": auth["deviceId"]})
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = Request(args.base_url.rstrip("/") + path, data, headers, method=method)
    try:
        response = urlopen(req, timeout=15)
    except HTTPError as error:
        response = error
    with response:
        payload = response.read().decode("utf-8")
        assert response.code == expected_status, (method, path, response.code, payload)
        assert "application/json" in response.headers.get("Content-Type", "")
        return json.loads(payload)


def read_state(auth, log_id):
    logs = request("/api/logs", auth)
    assert isinstance(logs, list) and len(logs) == 1
    log = logs[0]
    assert log["id"] == log_id
    assert log["status"] == "DONE" and log["rating"] == 4.5
    assert log["note"] == NOTE and log["watchedAt"] == WATCHED_AT
    assert log["title"]["name"] == TITLE and log["title"]["genres"] == GENRES

    page = request("/api/logs/page?limit=1", auth)
    assert page["items"] == logs and page.get("nextCursor") is None
    searched = request("/api/logs?" + urlencode({"q": "검증 영화"}), auth)
    assert searched == logs
    history = request(f"/api/logs/{log_id}/history", auth)
    assert len(history) >= 2 and all(item["logId"] == log_id for item in history)
    assert history[0]["note"] == NOTE

    pulled = request("/api/sync/pull", auth)
    assert isinstance(pulled["serverTime"], str)
    sync_logs = pulled["changes"]["logs"]
    assert len(sync_logs) == 1 and sync_logs[0]["id"] == log_id
    sync_log = sync_logs[0]
    for key in ("status", "rating", "note", "watchedAt", "createdAt", "updatedAt"):
        assert sync_log[key] == log[key], (key, sync_log[key], log[key])
    title = next(
        item for item in pulled["changes"]["titles"] if item["id"] == log["title"]["id"]
    )
    assert title["genres"] == GENRES and title["name"] == TITLE
    return {"log": log, "history": history, "syncLog": sync_log, "syncTitle": title}


if args.seed:
    auth = request("/api/auth/register", method="POST", body={})
    assert all(auth.get(key) for key in ("userId", "deviceId", "pairingCode"))
    request(
        "/api/logs",
        auth,
        method="POST",
        body={"titleType": "movie", "titleName": TITLE},
        expected_status=400,
    )
    created = request(
        "/api/logs",
        auth,
        method="POST",
        body={
            "titleType": "movie",
            "titleName": TITLE,
            "year": 2026,
            "genres": GENRES,
            "status": "IN_PROGRESS",
            "rating": 3.5,
            "note": "처음 저장한 메모",
            "watchedAt": WATCHED_AT,
        },
    )
    assert created["status"] == "IN_PROGRESS" and created["rating"] == 3.5
    patched = request(
        f"/api/logs/{created['id']}",
        auth,
        method="PATCH",
        body={"status": "DONE", "rating": 4.5, "note": "수정한 메모"},
    )
    assert patched["watchedAt"] == WATCHED_AT
    updated_at = (
        datetime.fromisoformat(patched["updatedAt"].replace("Z", "+00:00"))
        + timedelta(seconds=1)
    ).isoformat()
    change = {
        "id": created["id"],
        "op": "upsert",
        "updatedAt": updated_at,
        "payload": {
            "titleId": created["title"]["id"],
            "status": "DONE",
            "rating": 4.5,
            "note": NOTE,
            "watchedAt": WATCHED_AT,
        },
    }
    pushed = request(
        "/api/sync/push", auth, method="POST", body={"changes": {"logs": [change]}}
    )
    assert pushed == {"accepted": [created["id"]], "rejected": []}
    change["updatedAt"] = "2000-01-01T00:00:00Z"
    change["payload"]["note"] = "오래된 변경은 적용되면 안 됩니다."
    rejected = request(
        "/api/sync/push", auth, method="POST", body={"changes": {"logs": [change]}}
    )
    assert rejected == {
        "accepted": [],
        "rejected": [{"id": created["id"], "reason": "stale"}],
    }
    state = read_state(auth, created["id"])
    args.snapshot.write_text(
        json.dumps({"auth": auth, "state": state}, ensure_ascii=False, indent=2)
    )
    print("PASS API create/update, validation, cursor/search/history, sync push/pull and stale rejection")
else:
    saved = json.loads(args.snapshot.read_text())
    actual = read_state(saved["auth"], saved["state"]["log"]["id"])
    assert actual == saved["state"], "Persisted records or JSON contracts changed"
    print("PASS persisted API records, manual fields, JSONB genres, history and sync contracts")
