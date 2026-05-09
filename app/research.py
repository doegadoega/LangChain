from __future__ import annotations

import re
import urllib.error
import urllib.request
from html.parser import HTMLParser

from app.models import ResearchSourceResult


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_title = False
        self.title_parts: list[str] = []
        self.text_parts: list[str] = []
        self.skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "noscript"}:
            self.skip_depth += 1
        if tag == "title":
            self.in_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript"} and self.skip_depth > 0:
            self.skip_depth -= 1
        if tag == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        text = data.strip()
        if not text:
            return
        if self.in_title:
            self.title_parts.append(text)
        if self.skip_depth == 0:
            self.text_parts.append(text)


def _normalize_source_url(source: str) -> str:
    value = source.strip()
    if value.startswith(("http://", "https://")):
        return value
    return f"https://{value}"


def _compact_text(value: str, max_chars: int = 1200) -> str:
    compacted = re.sub(r"\s+", " ", value).strip()
    if len(compacted) <= max_chars:
        return compacted
    return compacted[:max_chars].rstrip() + "..."


def fetch_research_sources(
    sources: list[str],
    *,
    max_results: int = 5,
    timeout_sec: int = 10,
) -> list[ResearchSourceResult]:
    results: list[ResearchSourceResult] = []
    for source in sources[:max_results]:
        url = _normalize_source_url(source)
        request = urllib.request.Request(
            url,
            headers={
                "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
                "User-Agent": "AgentRefinementResearch/1.0",
            },
            method="GET",
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout_sec) as response:
                content_type = response.headers.get("content-type", "")
                body = response.read(512_000).decode("utf-8", errors="replace")
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            results.append(
                ResearchSourceResult(
                    source=source,
                    url=url,
                    error=str(exc),
                )
            )
            continue

        if "html" in content_type.lower():
            parser = _TextExtractor()
            parser.feed(body)
            title = _compact_text(" ".join(parser.title_parts), max_chars=200)
            snippet = _compact_text(" ".join(parser.text_parts))
        else:
            title = url
            snippet = _compact_text(body)
        results.append(
            ResearchSourceResult(
                source=source,
                url=url,
                title=title,
                snippet=snippet,
            )
        )
    return results
