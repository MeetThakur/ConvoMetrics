"""Parse and analyze chats without tying the engine to an HTTP server."""

import re
from typing import Optional

import pandas as pd

from .analytics import calculate_chat_analytics
from .parsers import detect_and_parse, preprocess_messages
from .sample import sample_df


MAX_FILE_SIZE = 50 * 1024 * 1024


class AnalysisError(ValueError):
    """A validation or parsing error that can be shown to the user."""


DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _clean_date(value: Optional[str], name: str) -> Optional[str]:
    if not value:
        return None
    if not DATE_RE.match(value):
        raise AnalysisError(f"'{name}' must be a date like 2025-01-31.")
    return value


def _analyze_df(df: pd.DataFrame, platform: str, start: Optional[str], end: Optional[str]):
    """Analytics for `df`, optionally limited to start..end (inclusive, YYYY-MM-DD)."""
    start, end = _clean_date(start, "start"), _clean_date(end, "end")
    if start and end and start > end:
        raise AnalysisError("The start date is after the end date.")

    year_counts = df["timestamp"].dt.year.value_counts().sort_index()
    full_range = {
        "full_start": str(df["date"].min()),
        "full_end": str(df["date"].max()),
        "years": [{"year": int(y), "count": int(c)} for y, c in year_counts.items()],
    }

    if start or end:
        if start:
            df = df[df["date"] >= start]
        if end:
            df = df[df["date"] <= end]
        if df.empty:
            raise AnalysisError("No messages fall in that date range.")
        df = df.reset_index(drop=True)
        df.attrs["deleted"] = None  # deleted messages have no date, so they can't be filtered

    analytics = calculate_chat_analytics(df, platform=platform)
    analytics["range"] = {**full_range, "start": start, "end": end}
    return analytics


def analyze_upload(contents: bytes, filename: Optional[str], start: Optional[str], end: Optional[str]):
    """Analyze an in-memory export with the same limit before and after ZIP extraction."""
    if not filename:
        raise AnalysisError("No file provided")

    # Read with size guard to avoid unbounded memory consumption
    if not contents:
        raise AnalysisError("Uploaded file is empty")
    if len(contents) > MAX_FILE_SIZE:
        raise AnalysisError(
            "File size exceeds the 50 MB in-memory safety limit.",
        )

    try:
        raw_df, platform = detect_and_parse(contents, filename=filename)
        df = preprocess_messages(raw_df)
    except Exception as e:
        raise AnalysisError(
            f"Failed to parse chat export: {str(e).rstrip('.')}. Please check the format.",
        )

    if df.empty:
        raise AnalysisError(
            "No valid messages could be extracted from this export.",
        )

    return _analyze_df(df, platform, start, end)


def analyze_sample(start: Optional[str] = None, end: Optional[str] = None):
    return _analyze_df(sample_df(), "Sample chat", start, end)
