"""All site adapters in one file, keyed by the SOURCES registry.

Per-source strategy (probed 2026-07):
- merojob      public JSON API (api.merojob.com)
- kumarijob    SSR cards, JS-assisted -> Crawl4AI + BeautifulSoup
- jobaxle      sitemap.xml -> detail pages with JSON-LD (Crawl4AI, JS-heavy)
- jobsnepal    Laravel SSR: /jobs listing -> detail info table (httpx)
- jobejee      SSR: homepage /job/<title>/<id> links -> JSON-LD (httpx)
- slicejob     NOT implemented: probed 2026-07 — job pages ship no app JS and
               never render content (sitemap stale since 2022), nothing to scrape
- merorojgari  WordPress REST API wp-json/wp/v2/job-listings (httpx)

Every adapter normalizes to the canonical JobPosting schema in scraper/models.py.
No LinkedIn (ToS).
"""

from __future__ import annotations

import asyncio
import json
import re
from collections.abc import Awaitable, Callable
from html import unescape
from urllib.parse import parse_qs, urlparse

import httpx
from bs4 import BeautifulSoup

from scraper.crawl import fetch_html
from scraper.models import JobPosting
from scraper.normalize import (
    clean_text,
    dedupe_preserve_order,
    extract_salary_from_text,
    format_merojob_salary,
    html_to_text,
    merge_skills,
)

API_UA = "DishaAI-Scraper/0.1"
BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

NEPAL_CITIES = (
    "Kathmandu", "Lalitpur", "Bhaktapur", "Pokhara", "Biratnagar", "Butwal",
    "Dharan", "Nepalgunj", "Chitwan", "Birgunj", "Hetauda", "Dhangadhi",
    "Janakpur", "Itahari", "Bharatpur",
)


def _find_nepal_city(text: str) -> str:
    for city in NEPAL_CITIES:
        if city.casefold() in text.casefold():
            return city
    return ""


def _clean_label_skills(parts: list[str]) -> list[str]:
    """Keep only list-like fragments from a 'Skills: a, b, c' line — not prose."""
    cleaned = []
    for part in parts:
        part = clean_text(part)
        if not (2 <= len(part) <= 40) or len(part.split()) > 4:
            continue
        if part.split()[0].casefold() in {"and", "or", "with", "the", "a", "an", "strong", "good"}:
            continue
        cleaned.append(part)
    return dedupe_preserve_order(cleaned)


def _parse_json_ld(soup: BeautifulSoup) -> dict:
    for script in soup.select('script[type="application/ld+json"]'):
        try:
            data = json.loads(script.string or "")
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict) and data.get("@type") == "JobPosting":
            return data
    return {}


async def _gather_postings(coros: list[Awaitable[JobPosting]], source: str) -> list[JobPosting]:
    results = await asyncio.gather(*coros, return_exceptions=True)
    jobs = [result for result in results if isinstance(result, JobPosting)]
    failed = len(results) - len(jobs)
    if failed:
        print(f"  ! {source}: {failed} of {len(results)} detail pages failed, kept {len(jobs)}")
    return jobs


# --------------------------------------------------------------------------
# merojob — public JSON API
# --------------------------------------------------------------------------

MEROJOB_API = "https://api.merojob.com/api/v1/jobs/"
MEROJOB_SITE = "https://merojob.com"


async def _scrape_merojob(
    *,
    max_jobs: int | None = None,
    page_size: int = 20,
) -> list[JobPosting]:
    """Merojob exposes a public JSON API used by its Next.js frontend."""
    jobs: list[JobPosting] = []
    page = 1
    headers = {"Accept": "application/json", "User-Agent": API_UA}

    async with httpx.AsyncClient(timeout=30.0, headers=headers) as client:
        while True:
            response = await client.get(
                MEROJOB_API,
                params={"page": page, "page_size": page_size},
            )
            response.raise_for_status()
            payload = response.json()
            results = payload.get("results") or []
            if not results:
                break

            detail_targets: list[tuple[dict, JobPosting]] = []
            for item in results:
                if max_jobs is not None and len(jobs) + len(detail_targets) >= max_jobs:
                    break

                client_info = item.get("client") or {}
                locations = item.get("job_locations") or []
                location = ", ".join(
                    clean_text(loc.get("address") or loc.get("name"))
                    for loc in locations
                    if clean_text(loc.get("address") or loc.get("name"))
                )
                absolute_url = item.get("absolute_url") or f"/{item.get('slug')}/"
                if absolute_url.startswith("/"):
                    source_url = f"{MEROJOB_SITE}{absolute_url}"
                else:
                    source_url = absolute_url

                posting = JobPosting(
                    id=f"merojob-{item['id']}",
                    source="merojob",
                    title=clean_text(item.get("title")),
                    company=clean_text(client_info.get("client_name") or client_info.get("org_name")),
                    location=location or "Nepal",
                    required_skills=[clean_text(skill) for skill in item.get("skills") or [] if clean_text(skill)],
                    salary_range=format_merojob_salary(
                        item.get("offered_salary"),
                        hidden=bool(item.get("hide_salary")),
                    ),
                    source_url=source_url,
                )
                if posting.required_skills:
                    description = html_to_text(item.get("specification") or item.get("description"))
                    posting.required_skills = merge_skills(
                        posting.required_skills,
                        description=description,
                    )
                    jobs.append(posting)
                else:
                    detail_targets.append((item, posting))

            if detail_targets:
                detail_jobs = await asyncio.gather(
                    *[
                        _enrich_merojob_detail(client, item, posting)
                        for item, posting in detail_targets
                    ]
                )
                jobs.extend(detail_jobs)

            if max_jobs is not None and len(jobs) >= max_jobs:
                return jobs[:max_jobs]

            if not payload.get("next"):
                break
            page += 1

    return jobs


async def _enrich_merojob_detail(
    client: httpx.AsyncClient,
    item: dict,
    posting: JobPosting,
) -> JobPosting:
    response = await client.get(f"{MEROJOB_API}{item['id']}/")
    response.raise_for_status()
    detail = response.json()
    description = html_to_text(
        detail.get("specification")
        or detail.get("description")
        or detail.get("alternate_description")
        or detail.get("extra_description")
    )
    posting.required_skills = merge_skills(
        [clean_text(skill) for skill in detail.get("skills") or []],
        description=description,
    )
    detail_salary = format_merojob_salary(
        detail.get("offered_salary"),
        hidden=bool(detail.get("hide_salary")),
    )
    if detail_salary != "Not disclosed" or posting.salary_range == "Not disclosed":
        posting.salary_range = detail_salary
    if not posting.location:
        locations = detail.get("job_locations") or []
        posting.location = ", ".join(
            clean_text(loc.get("address") or loc.get("name"))
            for loc in locations
            if clean_text(loc.get("address") or loc.get("name"))
        ) or "Nepal"
    return posting


# --------------------------------------------------------------------------
# kumarijob — SSR cards rendered with JS assists (Crawl4AI)
# --------------------------------------------------------------------------

KUMARIJOB_HOME = "https://www.kumarijob.com/"
KUMARIJOB_LISTING_PAGES = [
    KUMARIJOB_HOME,
    "https://www.kumarijob.com/jobs-in-nepal",
]


async def _scrape_kumarijob(*, max_jobs: int | None = None) -> list[JobPosting]:
    listings = await _kumarijob_collect_listings(max_jobs=max_jobs)
    semaphore = asyncio.Semaphore(5)

    async def scrape_one(listing: dict) -> JobPosting:
        async with semaphore:
            return await _kumarijob_detail(listing)

    return await _gather_postings([scrape_one(listing) for listing in listings], "kumarijob")


async def _kumarijob_collect_listings(*, max_jobs: int | None) -> list[dict]:
    seen_urls: set[str] = set()
    listings: list[dict] = []

    for page_url in KUMARIJOB_LISTING_PAGES:
        html = await fetch_html(page_url, wait_seconds=1.5)
        soup = BeautifulSoup(html, "html.parser")
        for card in soup.select("[data-jobid]"):
            link = card.select_one("a.job-info[href], a.featured-job-title a[href], a[href]")
            if not link:
                continue
            source_url = clean_text(link.get("href"))
            if not source_url or source_url in seen_urls:
                continue
            seen_urls.add(source_url)

            title = clean_text(link.get("title") or link.get_text(" ", strip=True))
            company_el = card.select_one(".featured-job-company-name")
            company = clean_text(company_el.get_text(" ", strip=True) if company_el else "")
            listings.append(
                {
                    "job_id": card.get("data-jobid"),
                    "title": title,
                    "company": company,
                    "source_url": source_url,
                }
            )
            if max_jobs is not None and len(listings) >= max_jobs:
                return listings

    return listings


async def _kumarijob_detail(listing: dict) -> JobPosting:
    html = await fetch_html(listing["source_url"], wait_seconds=1.0)
    soup = BeautifulSoup(html, "html.parser")

    title_el = soup.select_one("h1.premium-job-title, h1")
    title = clean_text(title_el.get_text(" ", strip=True) if title_el else listing["title"])
    title = re.sub(r"\s*\([^)]*left\)\s*$", "", title, flags=re.I).strip()

    company = listing["company"]
    if not company:
        company_el = soup.select_one(".featured-job-company-name, .company-name, .employer-name")
        company = clean_text(company_el.get_text(" ", strip=True) if company_el else "")

    location = _kumarijob_location(soup)
    salary_range = extract_salary_from_text(soup.get_text(" ", strip=True))
    skills = [
        clean_text(node.get_text(" ", strip=True))
        for node in soup.select(".skill-labels-list .skill-label, .skill-labels-list li, .skill-labels-list a")
    ]
    description = _kumarijob_description(soup)
    skills = merge_skills(dedupe_preserve_order(skills), description=description)

    return JobPosting(
        id=f"kumarijob-{listing['job_id']}",
        source="kumarijob",
        title=title or listing["title"],
        company=company or "Unknown",
        location=location or "Nepal",
        required_skills=skills,
        salary_range=salary_range,
        source_url=listing["source_url"],
    )


def _kumarijob_location(soup: BeautifulSoup) -> str:
    for li in soup.select(".job-info-list li"):
        text = clean_text(li.get_text(" ", strip=True))
        if text.lower().startswith(("category:", "expiry", "no. of openings")):
            continue
        if any(token in text.casefold() for token in ("district", "kathmandu", "lalitpur", "bhaktapur", "nepal")) or "," in text:
            return text
    return ""


def _kumarijob_description(soup: BeautifulSoup) -> str:
    parts: list[str] = []
    for selector in (".job-description", ".job-detail", ".job-content", ".job-info-list"):
        for node in soup.select(selector):
            text = clean_text(node.get_text(" ", strip=True))
            if text:
                parts.append(text)
    return " ".join(parts)


# --------------------------------------------------------------------------
# jobaxle — sitemap.xml -> JS-rendered detail pages with JSON-LD (Crawl4AI)
# --------------------------------------------------------------------------

JOBAXLE_SITEMAP = "https://jobaxle.com/sitemap.xml"
JOBAXLE_URL_RE = re.compile(r"https://jobaxle\.com/jobs/[^<]+")


async def _scrape_jobaxle(*, max_jobs: int | None = None) -> list[JobPosting]:
    headers = {"User-Agent": API_UA}
    async with httpx.AsyncClient(timeout=60.0, headers=headers) as client:
        response = await client.get(JOBAXLE_SITEMAP)
        response.raise_for_status()
        urls = JOBAXLE_URL_RE.findall(response.text)
    if max_jobs is not None:
        urls = urls[:max_jobs]

    semaphore = asyncio.Semaphore(4)

    async def scrape_one(url: str) -> JobPosting:
        async with semaphore:
            return await _jobaxle_detail(url)

    return await _gather_postings([scrape_one(url) for url in urls], "jobaxle")


async def _jobaxle_detail(source_url: str) -> JobPosting:
    html = await fetch_html(source_url, wait_seconds=2.5)
    soup = BeautifulSoup(html, "html.parser")

    json_ld = _parse_json_ld(soup)
    slug = source_url.rstrip("/").split("/")[-1]
    title = clean_text(json_ld.get("title")) if json_ld else ""
    company = ""
    location = "Nepal"
    salary_range = "Not disclosed"
    description = ""

    if json_ld:
        org = json_ld.get("hiringOrganization") or {}
        company = clean_text(org.get("name"))
        description = clean_text(json_ld.get("description"))
        job_location = json_ld.get("jobLocation") or {}
        address = job_location.get("address") or {}
        location = clean_text(
            address.get("streetAddress")
            or address.get("addressLocality")
            or address.get("addressRegion")
        ) or "Nepal"
        base_salary = json_ld.get("baseSalary") or {}
        value = (base_salary.get("value") or {}).get("value")
        currency = base_salary.get("currency") or "NPR"
        if value:
            salary_range = f"{currency} {value}"

    badge_skills = _jobaxle_badge_skills(soup)
    if not title:
        title_el = soup.select_one("h1, h2")
        title = clean_text(title_el.get_text(" ", strip=True) if title_el else slug.replace("-", " "))
    if not company:
        company_el = soup.select_one("a[href*='/employer/']")
        company = clean_text(company_el.get_text(" ", strip=True) if company_el else "Unknown")

    page_text = soup.get_text(" ", strip=True)
    if salary_range == "Not disclosed":
        salary_range = extract_salary_from_text(page_text)

    skills = merge_skills(badge_skills, description=description or page_text)

    return JobPosting(
        id=f"jobaxle-{slug}",
        source="jobaxle",
        title=title,
        company=company or "Unknown",
        location=location,
        required_skills=skills,
        salary_range=salary_range,
        source_url=source_url,
    )


def _jobaxle_badge_skills(soup: BeautifulSoup) -> list[str]:
    skills: list[str] = []
    skills_heading = soup.find(
        lambda tag: tag.name == "p" and clean_text(tag.get_text()).casefold() == "skills"
    )
    if skills_heading:
        container = skills_heading.find_parent("div")
        if container:
            for badge in container.select(".mantine-Badge-label, span, li"):
                text = clean_text(badge.get_text(" ", strip=True))
                if text and text.casefold() not in {"skills", "location", "job details"}:
                    skills.append(text)
    return dedupe_preserve_order(skills)


# --------------------------------------------------------------------------
# jobsnepal — Laravel SSR: /jobs listing -> detail pages with an info table
# --------------------------------------------------------------------------

JOBSNEPAL_LISTING = "https://www.jobsnepal.com/jobs"
JOBSNEPAL_DETAIL_RE = re.compile(r"^https://www\.jobsnepal\.com/[a-z0-9-]+-\d{4,}$")


async def _scrape_jobsnepal(*, max_jobs: int | None = None) -> list[JobPosting]:
    headers = {"User-Agent": BROWSER_UA}
    async with httpx.AsyncClient(timeout=30.0, headers=headers, follow_redirects=True) as client:
        response = await client.get(JOBSNEPAL_LISTING)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        urls: list[str] = []
        seen: set[str] = set()
        for link in soup.select("a[href]"):
            href = clean_text(link.get("href"))
            if JOBSNEPAL_DETAIL_RE.match(href) and href not in seen:
                seen.add(href)
                urls.append(href)
        if max_jobs is not None:
            urls = urls[:max_jobs]

        semaphore = asyncio.Semaphore(5)

        async def scrape_one(url: str) -> JobPosting:
            async with semaphore:
                return await _jobsnepal_detail(client, url)

        return await _gather_postings([scrape_one(url) for url in urls], "jobsnepal")


async def _jobsnepal_detail(client: httpx.AsyncClient, source_url: str) -> JobPosting:
    response = await client.get(source_url)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    title_el = soup.select_one("h1")
    title = clean_text(title_el.get_text(" ", strip=True) if title_el else "")

    info: dict[str, str] = {}
    for row in soup.select("table tr"):
        cells = [clean_text(cell.get_text(" ", strip=True)) for cell in row.select("th, td")]
        if len(cells) >= 2 and cells[0]:
            info[cells[0].casefold()] = cells[1]

    page_text = soup.get_text("\n", strip=True)

    location = info.get("city", "")
    if not location:
        match = re.search(r"Location:?\s*\n?([^\n]{3,80})", page_text)
        location = clean_text(match.group(1)) if match else ""

    salary_range = "Not disclosed"
    match = re.search(r"Salary:?\s*\n?([^\n]{3,120})", page_text)
    if match:
        salary_range = extract_salary_from_text(match.group(1))

    label_skills: list[str] = []
    match = re.search(r"Skills?:?\s*\n?([^\n]{3,200})", page_text)
    if match:
        label_skills = _clean_label_skills(re.split(r"[,;/]", match.group(1)))

    company_el = soup.select_one("a[href*='employer/']")
    company = clean_text(company_el.get_text(" ", strip=True) if company_el else "")

    slug_id = source_url.rstrip("/").rsplit("-", 1)[-1]
    skills = merge_skills(dedupe_preserve_order(label_skills), description=page_text)

    return JobPosting(
        id=f"jobsnepal-{slug_id}",
        source="jobsnepal",
        title=title or source_url.rsplit("/", 1)[-1].replace("-", " "),
        company=company or "Unknown",
        location=location or "Nepal",
        required_skills=skills,
        salary_range=salary_range,
        source_url=source_url,
    )


# --------------------------------------------------------------------------
# jobejee — SSR homepage /job/<title>/<id> links -> JSON-LD detail pages
# --------------------------------------------------------------------------

JOBEJEE_HOME = "https://jobejee.com/"
JOBEJEE_LINK_RE = re.compile(r'href="(/job/[^"]+/\d+)"')


async def _scrape_jobejee(*, max_jobs: int | None = None) -> list[JobPosting]:
    headers = {"User-Agent": BROWSER_UA}
    async with httpx.AsyncClient(timeout=30.0, headers=headers, follow_redirects=True) as client:
        response = await client.get(JOBEJEE_HOME)
        response.raise_for_status()

        urls: list[str] = []
        seen: set[str] = set()
        for path in JOBEJEE_LINK_RE.findall(response.text):
            url = f"https://jobejee.com{path}"
            if url not in seen:
                seen.add(url)
                urls.append(url)
        if max_jobs is not None:
            urls = urls[:max_jobs]

        semaphore = asyncio.Semaphore(5)

        async def scrape_one(url: str) -> JobPosting:
            async with semaphore:
                return await _jobejee_detail(client, url)

        return await _gather_postings([scrape_one(url) for url in urls], "jobejee")


async def _jobejee_detail(client: httpx.AsyncClient, source_url: str) -> JobPosting:
    response = await client.get(source_url)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    json_ld = _parse_json_ld(soup)
    job_id = source_url.rstrip("/").rsplit("/", 1)[-1]

    title = clean_text(json_ld.get("title")) if json_ld else ""
    company = ""
    location = "Nepal"
    salary_range = "Not disclosed"
    description = ""

    if json_ld:
        org = json_ld.get("hiringOrganization") or {}
        company = clean_text(org.get("name"))
        description = clean_text(html_to_text(json_ld.get("description") or ""))
        address = (json_ld.get("jobLocation") or {}).get("address") or {}
        location = clean_text(address.get("addressLocality") or address.get("addressRegion")) or "Nepal"
        base_salary = json_ld.get("baseSalary") or {}
        if isinstance(base_salary, dict):
            value = (base_salary.get("value") or {}).get("value") if isinstance(base_salary.get("value"), dict) else base_salary.get("value")
            if value:
                salary_range = f"{base_salary.get('currency') or 'NPR'} {value}"
        ld_skills = json_ld.get("skills")
        if isinstance(ld_skills, str):
            ld_skills = [part for part in re.split(r"[,;]", ld_skills)]
        elif not isinstance(ld_skills, list):
            ld_skills = []
    else:
        ld_skills = []

    if not title:
        title_el = soup.select_one("h1")
        title = clean_text(title_el.get_text(" ", strip=True) if title_el else "")

    page_text = soup.get_text(" ", strip=True)
    if salary_range == "Not disclosed":
        salary_range = extract_salary_from_text(page_text)

    skills = merge_skills(
        dedupe_preserve_order([clean_text(skill) for skill in ld_skills]),
        description=description or page_text,
    )

    return JobPosting(
        id=f"jobejee-{job_id}",
        source="jobejee",
        title=title or "Unknown",
        company=company or "Unknown",
        location=location,
        required_skills=skills,
        salary_range=salary_range,
        source_url=source_url,
    )


# --------------------------------------------------------------------------
# merorojgari — WordPress REST API (govt/NGO/private vacancy notices)
# --------------------------------------------------------------------------

MERROJGARI_API = "https://merorojgari.com/wp-json/wp/v2/job-listings"


async def _scrape_merorojgari(*, max_jobs: int | None = None) -> list[JobPosting]:
    jobs: list[JobPosting] = []
    page = 1
    per_page = min(max_jobs or 100, 100)
    headers = {"User-Agent": API_UA}

    async with httpx.AsyncClient(timeout=30.0, headers=headers) as client:
        while True:
            response = await client.get(
                MERROJGARI_API,
                params={"per_page": per_page, "page": page, "orderby": "date", "order": "desc"},
            )
            if response.status_code == 400:  # past the last page
                break
            response.raise_for_status()
            items = response.json()
            if not items:
                break

            for item in items:
                content_text = html_to_text((item.get("content") or {}).get("rendered"))
                title = clean_text(html_to_text((item.get("title") or {}).get("rendered")))
                jobs.append(
                    JobPosting(
                        id=f"merorojgari-{item['id']}",
                        source="merorojgari",
                        title=title or "Unknown",
                        company=_merorojgari_company(title, content_text),
                        location=_find_nepal_city(content_text) or "Nepal",
                        required_skills=merge_skills([], description=content_text),
                        salary_range=extract_salary_from_text(content_text),
                        source_url=item.get("link") or MERROJGARI_API,
                    )
                )
                if max_jobs is not None and len(jobs) >= max_jobs:
                    return jobs
            page += 1

    return jobs


def _merorojgari_company(title: str, content_text: str) -> str:
    # Vacancy notices sometimes carry the org in the body ("Organization: X");
    # require the colon — looser patterns match mid-sentence garbage.
    match = re.search(
        r"(?:Company|Organization|Office|Institution)\s*(?:Name)?\s*:\s*([^\n,.(]{3,60})",
        content_text,
        re.I,
    )
    if match:
        return clean_text(match.group(1))
    match = re.search(r"\bat\s+([A-Z][^,.]{3,60})", title)
    if match:
        return clean_text(match.group(1))
    return "Unknown"


# --------------------------------------------------------------------------
# Registry
# --------------------------------------------------------------------------

Adapter = Callable[..., Awaitable[list[JobPosting]]]

SOURCES: dict[str, Adapter] = {
    "merojob": _scrape_merojob,
    "kumarijob": _scrape_kumarijob,
    "jobaxle": _scrape_jobaxle,
    "jobsnepal": _scrape_jobsnepal,
    "jobejee": _scrape_jobejee,
    "merorojgari": _scrape_merorojgari,
}


async def scrape_source(name: str, *, max_jobs: int | None = None) -> list[JobPosting]:
    if name not in SOURCES:
        raise ValueError(f"Unknown source '{name}'. Available: {', '.join(SOURCES)}")
    return await SOURCES[name](max_jobs=max_jobs)


async def scrape_all(
    *,
    max_per_source: int | None = None,
    sources: list[str] | None = None,
) -> list[JobPosting]:
    names = sources or list(SOURCES)
    jobs: list[JobPosting] = []
    for name in names:
        print(f"Scraping {name} (max={max_per_source or 'all'})...")
        try:
            jobs.extend(await scrape_source(name, max_jobs=max_per_source))
        except Exception as exc:
            # One broken portal must not kill the whole run.
            print(f"  ! {name} failed: {type(exc).__name__}: {exc}")
    return jobs
