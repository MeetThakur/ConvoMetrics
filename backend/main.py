import re
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import pandas as pd
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartException, MultiPartParser

from backend.parsers import detect_and_parse, preprocess_messages
from backend.analytics import calculate_chat_analytics

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB in-memory safety limit


class MemoryUploadParser(MultiPartParser):
    # The entire multipart body is bounded below, before it reaches this threshold.
    spool_max_size = MAX_FILE_SIZE + 64 * 1024 + 1

app = FastAPI(
    title="ConvoMetrics API",
    description="Privacy-first, in-memory chat analytics for Telegram and WhatsApp.",
    version="2.0.0",
)

# The word index makes responses large but very compressible
app.add_middleware(GZipMiddleware, minimum_size=1024)

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "service": "ConvoMetrics API",
        "storage": "in-memory only",
        "max_size_mb": MAX_FILE_SIZE // (1024 * 1024),
    }


DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _clean_date(value: Optional[str], name: str) -> Optional[str]:
    if not value:
        return None
    if not DATE_RE.match(value):
        raise HTTPException(status_code=400, detail=f"'{name}' must be a date like 2025-01-31.")
    return value


def _analyze_df(df: pd.DataFrame, platform: str, start: Optional[str], end: Optional[str]):
    """Analytics for `df`, optionally limited to start..end (inclusive, YYYY-MM-DD)."""
    start, end = _clean_date(start, "start"), _clean_date(end, "end")
    if start and end and start > end:
        raise HTTPException(status_code=400, detail="The start date is after the end date.")

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
            raise HTTPException(status_code=400, detail="No messages fall in that date range.")
        df = df.reset_index(drop=True)
        df.attrs["deleted"] = None  # deleted messages have no date, so they can't be filtered

    analytics = calculate_chat_analytics(df, platform=platform)
    analytics["range"] = {**full_range, "start": start, "end": end}
    return analytics


@app.post("/api/analyze")
async def analyze_chat(request: Request):
    """In-memory chat analysis. Strictly limited to 50MB and never written to disk."""
    if not request.headers.get("content-type", "").lower().startswith("multipart/form-data"):
        raise HTTPException(status_code=415, detail="Upload a multipart/form-data chat export.")

    async def bounded_body():
        total = 0
        async for chunk in request.stream():
            total += len(chunk)
            if total > MAX_FILE_SIZE + 64 * 1024:
                raise HTTPException(status_code=413, detail="File size exceeds the 50 MB limit.")
            yield chunk

    parser = MemoryUploadParser(request.headers, bounded_body(), max_files=1, max_fields=2)
    try:
        form = await parser.parse()
    except (HTTPException, MultiPartException) as exc:
        # Parser closes files on multipart errors; also close them for stream-limit errors.
        for temporary in parser._files_to_close_on_error:
            temporary.close()
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        file = form.get("file")
        if not isinstance(file, UploadFile):
            raise HTTPException(status_code=400, detail="No file provided")
        contents = await file.read(MAX_FILE_SIZE + 1)
        start, end = form.get("start"), form.get("end")
        if any(value is not None and not isinstance(value, str) for value in (start, end)):
            raise HTTPException(status_code=400, detail="Date filters must be text fields.")
        filename = file.filename
    finally:
        await form.close()

    return await run_in_threadpool(_analyze_upload, contents, filename, start, end)


def _analyze_upload(contents: bytes, filename: Optional[str], start: Optional[str], end: Optional[str]):
    """Run CPU-bound parsing and analytics outside the server's event loop."""
    if not filename:
        raise HTTPException(status_code=400, detail="No file provided")

    # Read with size guard to avoid unbounded memory consumption
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File size exceeds the 50 MB in-memory safety limit.",
        )

    try:
        raw_df, platform = detect_and_parse(contents, filename=filename)
        df = preprocess_messages(raw_df)
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to parse chat export: {str(e).rstrip('.')}. Please check the format.",
        )

    if df.empty:
        raise HTTPException(
            status_code=400,
            detail="No valid messages could be extracted from this export.",
        )

    return _analyze_df(df, platform, start, end)


def _sample_df() -> pd.DataFrame:
    sample_data = [
        {"timestamp": "2023-01-01 07:15:00", "sender": "Sam", "message": "Morning Alex! Happy New Year! 🌅☕ Are we grabbing coffee today?"},
        {"timestamp": "2023-01-01 10:00:00", "sender": "Alex", "message": "Happy New Year! 🎉 Definitely, let's meet at 4 PM at the usual place."},
        {"timestamp": "2023-01-01 16:05:00", "sender": "Sam", "message": "On my way! Bringing along the new project sketches. 🙌🔥"},
        {"timestamp": "2023-01-01 23:45:00", "sender": "Alex", "message": "Still thinking about those design ideas! What if we add a dark mode toggle with smooth glassmorphism? 🦉✨"},
        {"timestamp": "2023-01-02 08:30:00", "sender": "Sam", "message": "That dark mode idea is pure genius. Let's build a prototype this morning! 🚀💻"},
        {"timestamp": "2023-01-02 18:30:00", "sender": "Alex", "message": "The demo went super well! Everyone loved the smooth animations and data charts. 🍕🍻"},
        {"timestamp": "2023-01-03 14:15:00", "sender": "Sam", "message": "I just checked the deployment metrics. Zero latency and super high response rate! ❤️❤️❤️"},
        {"timestamp": "2023-01-03 14:20:00", "sender": "Alex", "message": "I wrote a complete walkthrough guide for the team. Here is the outline of everything we covered today: architecture, caching, and state management. 📜✨"},
        {"timestamp": "2023-01-04 06:45:00", "sender": "Sam", "message": "Rise and shine! Ready for the new sprint planning kickoff? 🌅🏃‍♂️"},
        {"timestamp": "2023-01-04 09:02:00", "sender": "Alex", "message": "Morning! Yes, joining the call now."},
        {"timestamp": "2023-01-05 21:00:00", "sender": "Alex", "message": "Movie night tomorrow? We deserve a break! 🍿"},
        {"timestamp": "2023-01-05 21:05:00", "sender": "Sam", "message": "I'm in! Let's watch that new sci-fi film. I will bring the popcorn and snacks! 🍿🎉"},
        {"timestamp": "2023-01-06 19:00:00", "sender": "Sam", "message": "Got the popcorn ready! 🍿🚀 Waiting on your arrival."},
        {"timestamp": "2023-01-06 19:05:00", "sender": "Alex", "message": "On my way! 🏎️💨 See you in 5 minutes."},
        {"timestamp": "2023-01-06 19:05:40", "sender": "Sam", "message": "Door's open, come on up"},
        {"timestamp": "2023-01-06 19:06:10", "sender": "Alex", "message": "Coming up now"},
        {"timestamp": "2023-01-06 19:06:40", "sender": "Sam", "message": "Grab the snacks on the way!"},
        {"timestamp": "2023-01-07 01:15:00", "sender": "Alex", "message": "That ending twist blew my mind! 🤯 Definitely one of the best movies we watched this year."},
        {"timestamp": "2023-01-07 01:16:00", "sender": "Alex", "message": "haha did you see the face on the guy at the end?"},
        {"timestamp": "2023-01-07 01:16:30", "sender": "Alex", "message": "Also here is the trailer https://www.youtube.com/watch?v=abc123"},
        {"timestamp": "2023-01-07 01:40:00", "sender": "Sam", "message": "lol yes, who even wrote that?"},
        {"timestamp": "2023-01-07 01:41:00", "sender": "Sam", "message": "<Media omitted>"},
        {"timestamp": "2023-01-07 01:41:20", "sender": "Alex", "message": "This message was deleted"},
        {"timestamp": "2023-01-07 09:10:00", "sender": "Sam", "message": "Reading the review on https://github.com/example/repo/issues/1 now, thoughts?"},
        {"timestamp": "2023-01-07 09:55:00", "sender": "Alex", "message": "Sleeping in, but yes, will look later!"},
    ]
    return preprocess_messages(pd.DataFrame(sample_data))


@app.get("/api/sample")
def get_sample_analytics(start: Optional[str] = None, end: Optional[str] = None):
    """Analytics for a small built-in chat, for trying the app without an export."""
    return _analyze_df(_sample_df(), "Sample chat", start, end)


# Serve compiled React frontend in production if built
frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if frontend_dist.is_dir():
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = (frontend_dist / full_path).resolve()
        if not file_path.is_relative_to(frontend_dist.resolve()):
            raise HTTPException(status_code=404, detail="Not found")
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(frontend_dist / "index.html")
