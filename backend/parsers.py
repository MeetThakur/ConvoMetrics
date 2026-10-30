import io
import json
import re
import string
import zipfile
from typing import Optional, Tuple
import emoji
import nltk
from nltk.corpus import stopwords
import pandas as pd

# Initialize NLTK stopwords
try:
    nltk.data.find("corpora/stopwords")
except LookupError:
    nltk.download("stopwords", quiet=True)

DEFAULT_STOPWORDS = set(stopwords.words("english"))
CHAT_ARTIFACTS = {
    "media", "omitted", "deleted", "image", "video", "sticker", "gif",
    "voice", "call", "missed", "message", "audio", "attached", "null",
    "edited", "edit", "pm", "am", "http", "https", "www", "com", "none"
}
# Common Hindi/Hinglish filler, so chats written that way don't drown in it
HINGLISH_STOPWORDS = {
    "hai", "hain", "ki", "ka", "ke", "ko", "se", "bhi", "aur", "toh", "to", "ye", "yeh", "wo", "woh",
    "kya", "tha", "thi", "the", "mai", "main", "hum", "ab", "phir", "kuch", "koi", "karo", "kar", "kr",
    "raha", "rha", "rahi", "rhi", "hu", "hoon", "haan", "han", "na", "nhi", "nahi", "ni", "acha", "accha",
    "bhai", "yar", "yaar", "mera", "meri", "tera", "teri", "tu", "tum", "aap", "abhi", "kal", "bas",
}
COMBINED_STOPWORDS = DEFAULT_STOPWORDS.union(CHAT_ARTIFACTS, HINGLISH_STOPWORDS)

MEDIA_RE = re.compile(
    r"^(?:<media omitted>|(?:image|video|audio|sticker|gif|document|voice message|contact card)\s+omitted"
    r"|<attached: [^>]+>)$",
    re.IGNORECASE,
)
EDITED_RE = re.compile(r"\u200e?<This message was edited>\s*$", re.IGNORECASE)
DELETED_RE = re.compile(r"^(?:this message was deleted|you deleted this message)\.?$", re.IGNORECASE)


def parse_telegram(file_bytes: bytes) -> pd.DataFrame:
    """Parse Telegram JSON export in-memory without disk storage."""
    data = json.loads(file_bytes.decode("utf-8", errors="replace"))
    messages = []

    for m in data.get("messages", []):
        if m.get("type") == "message":
            sender = m.get("from") or m.get("actor") or m.get("sender_name") or "Unknown"
            text = m.get("text", "")
            if isinstance(text, list):
                parsed_text = ""
                for part in text:
                    if isinstance(part, str):
                        parsed_text += part
                    elif isinstance(part, dict) and "text" in part:
                        parsed_text += str(part["text"])
                text = parsed_text
            else:
                text = str(text)

            messages.append({
                "timestamp": m.get("date"),
                "sender": sender,
                "message": text,
                "is_media": bool(m.get("photo") or m.get("file") or m.get("media_type")),
            })

    return pd.DataFrame(messages)


def parse_whatsapp(file_bytes: bytes) -> pd.DataFrame:
    """Parse WhatsApp TXT export in-memory across multiple locale formats."""
    text_content = file_bytes.decode("utf-8", errors="replace")

    # Matches both Android and iOS formats:
    # 1. 12/31/22, 11:59 PM - Sender: Message
    # 2. [31/12/2022, 23:59:59] Sender: Message
    # 3. 31.12.2022, 23:59 - Sender: Message
    # 4. 2022-12-31, 23:59 - Sender: Message
    pattern = re.compile(
        r"^\[?(?P<date>\d{1,4}[-./]\d{1,2}[-./]\d{1,4})[, ]\s*(?P<time>\d{1,2}:\d{2}(?::\d{2})?\s*(?:[aApP]\.?[mM]\.?)?)\]?\s*[-~]?\s*(?P<sender>[^:\n]+):\s*(?P<message>.*)$",
        re.IGNORECASE,
    )

    messages = []
    current_msg = None

    for raw_line in text_content.splitlines():
        # Remove invisible RTL / LTR / non-breaking space markers
        cleaned_line = raw_line.replace("\u200e", "").replace("\u202f", " ")
        stripped_line = cleaned_line.strip()

        # Skip completely empty lines before any message starts
        if not current_msg and not stripped_line:
            continue

        match = pattern.match(stripped_line)
        if match:
            if current_msg:
                messages.append(current_msg)
            date_str = match.group("date")
            time_str = match.group("time")
            sender = match.group("sender").strip()
            msg_text = match.group("message").strip()

            current_msg = {
                "timestamp": f"{date_str} {time_str}",
                "sender": sender,
                "message": msg_text,
            }
        else:
            # Multi-line message continuation (preserve empty lines inside text)
            if current_msg:
                current_msg["message"] += "\n" + cleaned_line

    if current_msg:
        messages.append(current_msg)

    return pd.DataFrame(messages)


MAX_UNZIPPED_BYTES = 50 * 1024 * 1024


def _extract_from_zip(file_bytes: bytes) -> Tuple[bytes, str]:
    """Pull the chat export out of a zip, entirely in memory."""
    try:
        zf = zipfile.ZipFile(io.BytesIO(file_bytes))
    except zipfile.BadZipFile:
        raise ValueError("The zip file is damaged or not a zip.")

    with zf:
        candidates = [
            i for i in zf.infolist()
            if not i.is_dir()
            and not i.filename.startswith("__MACOSX")
            and i.filename.lower().endswith((".txt", ".json"))
        ]
        if not candidates:
            raise ValueError("No .txt or .json chat export found inside the zip.")
        best = max(
            candidates,
            key=lambda i: (i.filename.lower().endswith("result.json"), i.filename.lower().endswith(".txt"), i.file_size),
        )
        with zf.open(best) as f:
            # Read with a hard cap: the declared size in a zip header can be forged.
            data = f.read(MAX_UNZIPPED_BYTES + 1)
        if len(data) > MAX_UNZIPPED_BYTES:
            raise ValueError("The file inside the zip exceeds the 50 MB limit.")
        return data, best.filename


def detect_and_parse(file_bytes: bytes, filename: str = "") -> Tuple[pd.DataFrame, str]:
    """Auto-detects file type (.txt, .json or a .zip of either) and parses into a standard DataFrame."""
    if filename.lower().endswith(".zip") or file_bytes[:4] == b"PK\x03\x04":
        file_bytes, filename = _extract_from_zip(file_bytes)
    lower_name = filename.lower()
    first_bytes = file_bytes[:200].strip()
    is_json = lower_name.endswith(".json") or first_bytes.startswith(b"{")

    if is_json:
        df = parse_telegram(file_bytes)
        platform = "Telegram"
    else:
        df = parse_whatsapp(file_bytes)
        platform = "WhatsApp"

    return df, platform


def preprocess_messages(df: pd.DataFrame) -> pd.DataFrame:
    """Preprocess, validate timestamps, and extract conversational features."""
    if df.empty:
        return df

    # Smart dayfirst detection by checking if first token ever exceeds 12
    sample_timestamps = df["timestamp"].dropna().head(100).astype(str)
    dayfirst = False
    for ts in sample_timestamps:
        parts = re.split(r"[-./]", ts.split()[0])
        # A 4-digit first token is a year (ISO), which says nothing about day order.
        if len(parts) >= 2 and parts[0].isdigit() and len(parts[0]) <= 2:
            if int(parts[0]) > 12:
                dayfirst = True
                break

    df["timestamp"] = pd.to_datetime(
        df["timestamp"], format="mixed", dayfirst=dayfirst, errors="coerce"
    )
    df = df.dropna(subset=["timestamp"]).copy()
    if df.empty:
        return df

    df["message"] = df["message"].astype(str).str.replace(EDITED_RE, "", regex=True)

    # Flag media placeholders and drop deleted messages so neither skews word stats
    stripped = df["message"].astype(str).str.replace("\u200e", "", regex=False).str.strip()
    if "is_media" not in df:
        df["is_media"] = False
    df["is_media"] = df["is_media"].astype(bool) | stripped.str.match(MEDIA_RE)
    deleted = stripped.str.match(DELETED_RE)
    df.loc[stripped.str.match(MEDIA_RE), "message"] = ""
    df = df[~deleted].reset_index(drop=True)
    df.attrs["deleted"] = int(deleted.sum())
    if df.empty:
        return df

    df["date"] = df["timestamp"].dt.strftime("%Y-%m-%d")
    df["hour"] = df["timestamp"].dt.hour
    df["day_name"] = df["timestamp"].dt.day_name()

    # Text length metrics
    df["char_count"] = df["message"].apply(lambda x: len(str(x).replace(" ", "")))
    df["word_count"] = df["message"].apply(lambda x: len(str(x).split()))

    # Robust compound Emoji extraction (ZWJ, skin tones, flags)
    df["emojis"] = df["message"].apply(
        lambda x: [e["emoji"] for e in emoji.emoji_list(str(x))]
    )

    return df
