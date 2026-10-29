"""Shared types + helpers for crawlers."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass
class CrawledArticle:
    source: str
    url: str
    title: str
    published: datetime | None
    fulltext: str
