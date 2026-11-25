"""Serialize analytics for the browser worker."""

import json

from .engine import AnalysisError, analyze_sample, analyze_upload


def analyze(payload, filename: str, start: str, end: str) -> str:
    try:
        if filename:
            result = analyze_upload(payload.to_bytes(), filename, start, end)
        else:
            result = analyze_sample(start, end)
    except AnalysisError as exc:
        return json.dumps({"error": str(exc)})

    return json.dumps({"data": result}, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
