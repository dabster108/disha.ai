"""Quick smoke test for all read-mostly API routes."""

from __future__ import annotations

import os
import sys

import httpx
from dotenv import load_dotenv

BASE = "http://127.0.0.1:8000"


def main() -> int:
    load_dotenv()
    admin_key = os.environ.get("ADMIN_API_KEY", "")
    client = httpx.Client(base_url=BASE, timeout=60.0)
    results: list[tuple[bool, str, object, str]] = []

    def check(
        method: str,
        path: str,
        *,
        json_body: dict | None = None,
        params: dict | None = None,
        headers: dict | None = None,
        expect: int | None = None,
        name: str | None = None,
    ) -> None:
        label = name or f"{method} {path}"
        try:
            response = client.request(
                method, path, json=json_body, params=params, headers=headers or {}
            )
            ok = response.status_code < 500 if expect is None else response.status_code == expect
            snippet = response.text[:120].replace("\n", " ")
            results.append((ok, label, response.status_code, snippet))
        except Exception as exc:  # noqa: BLE001
            results.append((False, label, "ERR", str(exc)[:120]))

    check("GET", "/health", expect=200)
    check("GET", "/health/db", expect=200)
    check("GET", "/api/skills", expect=200)
    check("GET", "/api/skills/by-role", params={"role": "Software Engineer"}, expect=200)
    check("GET", "/api/jobs/status", expect=200)
    check("GET", "/api/leaderboard", expect=200)

    admin_headers = {"X-Admin-Key": admin_key} if admin_key else {}
    check(
        "GET",
        "/api/admin/stats",
        headers=admin_headers,
        expect=200 if admin_key else 401,
    )

    users: list[dict] = []
    if admin_key:
        response = client.get("/api/admin/users", headers=admin_headers)
        if response.status_code == 200:
            users = response.json()

    if users:
        profile_id = str(users[0]["id"])
        student_id = users[0].get("student_id") or profile_id
        check("GET", f"/api/profile/{student_id}", expect=200)
        check("GET", f"/api/dashboard/{profile_id}", expect=200)
        check("GET", f"/api/gap/{profile_id}", expect=200)
        check("GET", f"/api/gap/{profile_id}/history", expect=200)
        check("GET", f"/api/jobs/match/{profile_id}", expect=200)
        check("GET", f"/api/roadmap/{profile_id}", expect=200)
        check("GET", f"/api/learning/{profile_id}", expect=200)
        check("GET", f"/api/interview/{profile_id}/history", expect=200)
        check("GET", f"/api/practice/history/{profile_id}", expect=200)
        check("GET", f"/api/admin/users/{profile_id}", headers=admin_headers, expect=200)
        check("GET", "/api/admin/gaps", headers=admin_headers, expect=200)
        check("GET", "/api/admin/roadmaps", headers=admin_headers, expect=200)
        check("GET", "/api/admin/learning", headers=admin_headers, expect=200)
        check("GET", "/api/admin/interviews", headers=admin_headers, expect=200)
        check("GET", "/api/admin/practice", headers=admin_headers, expect=200)
        check("GET", "/api/admin/scrape/runs", headers=admin_headers, expect=200)
    else:
        for path in (
            "/api/dashboard/missing-id",
            "/api/gap/missing-id",
            "/api/roadmap/missing-id",
        ):
            check("GET", path, expect=404)

    for origin in ("http://localhost:3000", "http://192.168.56.1:3000"):
        response = client.options(
            "/api/skills",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
            },
        )
        allow_origin = response.headers.get("access-control-allow-origin", "")
        results.append(
            (
                allow_origin == origin,
                f"CORS preflight {origin}",
                response.status_code,
                allow_origin or "missing",
            )
        )

    passed = sum(1 for ok, *_ in results if ok)
    print(f"API smoke test: {passed}/{len(results)} passed\n")
    for ok, name, code, detail in results:
        mark = "OK" if ok else "FAIL"
        print(f"  [{mark}] {name} -> {code} | {detail}")

    return 0 if all(ok for ok, *_ in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
