"""Second batch of insights: heatmap, reply-time spread, openers and closers, laughter, vocabulary, signature words."""
import math
import re
from collections import Counter
from typing import Any, Dict, List

import pandas as pd

from backend.parsers import COMBINED_STOPWORDS

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

LAUGH_RE = re.compile(r"(?:\b(?:ha(?:ha)+|he(?:he)+|lo+l+|lmao+|lmfao|rofl|jaja+|xd+)\b|😂|🤣|💀)", re.IGNORECASE)
CAPS_RE = re.compile(r"^[^a-z]*[A-Z][^a-z]*$")  # no lowercase letters at all
WORD_RE = re.compile(r"[a-z']+")
TOKEN_STRIP = str.maketrans("", "", "!\"#$%&()*+,-./:;<=>?@[\\]^_`{|}~")

# Reply-time buckets: upper bound in minutes, label. None is "everything else under the reply cutoff".
REPLY_BUCKETS = [
    (1, "Under a minute"),
    (5, "1–5 min"),
    (15, "5–15 min"),
    (60, "15–60 min"),
    (180, "1–3 h"),
    (None, "3–6 h"),
]


def heatmap(df: pd.DataFrame) -> Dict[str, Any]:
    """Messages per weekday x hour, as 7 rows of 24."""
    table = pd.crosstab(df["day_name"], df["hour"]).reindex(index=DAYS, columns=range(24), fill_value=0)
    rows = [[int(v) for v in table.loc[d]] for d in DAYS]
    peak_val = max(max(r) for r in rows)
    peak_day, peak_hour = next((d, h) for d, r in zip(DAYS, rows) for h, v in enumerate(r) if v == peak_val)
    weekend = int(df["day_name"].isin(["Saturday", "Sunday"]).sum())
    return {
        "days": DAYS,
        "rows": rows,
        "peak": {"day": peak_day, "hour": peak_hour, "count": int(peak_val)},
        "weekend_share": round(weekend / max(len(df), 1) * 100, 1),
    }


def reply_distribution(df: pd.DataFrame, gap: pd.Series, reply_cutoff: pd.Timedelta) -> Dict[str, Any]:
    """How reply times spread out, overall and per person."""
    is_reply = (df["sender"] != df["sender"].shift()) & gap.notna() & (gap <= reply_cutoff)
    minutes = gap[is_reply].dt.total_seconds() / 60
    senders = df["sender"][is_reply]

    def bucketize(vals: pd.Series) -> List[Dict[str, Any]]:
        out, lower = [], 0.0
        for upper, label in REPLY_BUCKETS:
            if upper is None:
                n = int((vals >= lower).sum())
            else:
                n = int(((vals >= lower) & (vals < upper)).sum())
                lower = float(upper)
            out.append({"label": label, "count": n, "percentage": round(n / max(len(vals), 1) * 100, 1)})
        return out

    return {
        "labels": [label for _, label in REPLY_BUCKETS],
        "overall": bucketize(minutes),
        "per_sender": [
            {"name": str(name), "buckets": bucketize(vals), "fastest_share": round(float((vals < 1).mean()) * 100, 1)}
            for name, vals in minutes.groupby(senders)
        ],
    }


def openers_and_closers(df: pd.DataFrame, gap: pd.Series, session_gap: pd.Timedelta) -> Dict[str, Any]:
    """Who sends the first and last message of each conversation, and the first message of each day."""
    session_id = (gap > session_gap).cumsum()
    first = df.groupby(session_id)["sender"].first().value_counts()
    last = df.groupby(session_id)["sender"].last().value_counts()
    first_of_day = df.groupby("date")["sender"].first().value_counts()
    names = [str(n) for n in df["sender"].value_counts().index]
    total_sessions = int(session_id.nunique())
    total_days = int(df["date"].nunique())
    return {
        "conversations": total_sessions,
        "days": total_days,
        "per_sender": [
            {
                "name": n,
                "opened": int(first.get(n, 0)),
                "closed": int(last.get(n, 0)),
                "first_of_day": int(first_of_day.get(n, 0)),
                "opened_share": round(int(first.get(n, 0)) / max(total_sessions, 1) * 100, 1),
                "closed_share": round(int(last.get(n, 0)) / max(total_sessions, 1) * 100, 1),
                "first_of_day_share": round(int(first_of_day.get(n, 0)) / max(total_days, 1) * 100, 1),
            }
            for n in names
        ],
    }


def tone(df: pd.DataFrame, text: pd.Series) -> List[Dict[str, Any]]:
    """Laughter, shouting and emoji-only messages per person."""
    has_letters = text.str.contains(r"[A-Za-z]{4,}", regex=True)
    frame = pd.DataFrame({
        "sender": df["sender"],
        "messages": 1,
        "laughs": text.str.contains(LAUGH_RE).astype(int),
        "caps": (has_letters & text.str.match(CAPS_RE)).astype(int),
        "emoji_only": ((df["emojis"].str.len() > 0) & (text.str.replace(r"[\s\W]", "", regex=True) == "")).astype(int),
    })
    totals = frame.groupby("sender").sum()
    out = []
    for name, r in totals.iterrows():
        m = max(int(r["messages"]), 1)
        out.append({
            "name": str(name),
            "messages": int(r["messages"]),
            "laughs": int(r["laughs"]),
            "laugh_share": round(int(r["laughs"]) / m * 100, 1),
            "caps": int(r["caps"]),
            "caps_share": round(int(r["caps"]) / m * 100, 1),
            "emoji_only": int(r["emoji_only"]),
        })
    out.sort(key=lambda r: -r["messages"])
    return out


def _tokens(message: str) -> List[str]:
    return str(message).lower().translate(TOKEN_STRIP).split()


def vocabulary(df: pd.DataFrame, text: pd.Series) -> Dict[str, Any]:
    """Unique words per person, vocabulary richness, longest message, and signature words."""
    per_sender_counts: Dict[str, Counter] = {}
    for sender, body in zip(df["sender"], text):
        words = [w for w in _tokens(body) if len(w) > 2 and not w.isnumeric()]
        per_sender_counts.setdefault(str(sender), Counter()).update(words)

    overall: Counter = Counter()
    for c in per_sender_counts.values():
        overall.update(c)

    longest = df.loc[df["char_count"].idxmax()] if len(df) else None
    per_sender_rows = []
    for name, counts in per_sender_counts.items():
        total = sum(counts.values())
        unique = len(counts)
        # Signature words: used far more by this person than by everyone else, ignoring filler.
        others_total = max(sum(overall.values()) - total, 1)
        scored = []
        for w, n in counts.items():
            if n < 4 or w in COMBINED_STOPWORDS:
                continue
            others = overall[w] - n
            rate_here = n / max(total, 1)
            rate_there = (others + 0.5) / others_total
            lift = rate_here / rate_there
            if lift < 2:
                continue
            scored.append((math.log(lift) * math.log1p(n), w, n, lift))
        scored.sort(reverse=True)
        own = df[df["sender"] == name]
        own_longest = own.loc[own["char_count"].idxmax()] if len(own) else None
        per_sender_rows.append({
            "name": name,
            "words": total,
            "unique_words": unique,
            # Root-TTR: unique / sqrt(total) is far less sensitive to how much someone writes than unique / total.
            "richness": round(unique / math.sqrt(total), 1) if total else 0.0,
            "signature": [{"word": w, "count": n, "lift": round(lift, 1)} for _, w, n, lift in scored[:8]],
            "longest_message": (
                {
                    "chars": int(own_longest["char_count"]),
                    "words": int(own_longest["word_count"]),
                    "date": own_longest["timestamp"].strftime("%b %d, %Y"),
                    "preview": str(own_longest["message"])[:160],
                }
                if own_longest is not None and int(own_longest["char_count"]) > 0
                else None
            ),
        })
    per_sender_rows.sort(key=lambda r: -r["words"])
    return {
        "unique_words_total": len(overall),
        "per_sender": per_sender_rows,
        "longest_message": (
            {
                "sender": str(longest["sender"]),
                "chars": int(longest["char_count"]),
                "words": int(longest["word_count"]),
                "date": longest["timestamp"].strftime("%b %d, %Y"),
                "preview": str(longest["message"])[:160],
            }
            if longest is not None and int(longest["char_count"]) > 0
            else None
        ),
    }


def common_messages(df: pd.DataFrame, text: pd.Series, top_n: int = 10) -> List[Dict[str, Any]]:
    """Exact messages sent over and over ("ok", "lol", "good night")."""
    norm = text.str.strip().str.lower()
    short = norm[(norm.str.len() > 0) & (norm.str.len() <= 40)]
    counts = short.value_counts()
    counts = counts[counts >= 3].head(top_n)
    out = []
    for msg, n in counts.items():
        who = df["sender"][norm == msg].value_counts()
        out.append({"text": str(msg), "count": int(n), "top_sender": str(who.index[0]), "top_sender_count": int(who.iloc[0])})
    return out


def yearly(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Messages per calendar year, with who sent most that year."""
    year = df["timestamp"].dt.year
    out = []
    for y, part in df.groupby(year):
        who = part["sender"].value_counts()
        out.append({
            "year": int(y),
            "count": int(len(part)),
            "days": int(part["date"].nunique()),
            "top_sender": str(who.index[0]),
            "top_share": round(float(who.iloc[0]) / len(part) * 100, 1),
        })
    return out


def balance_score(shares: List[float]) -> int:
    """100 when everyone sends the same amount, 0 when one person sends everything."""
    n = len(shares)
    if n < 2:
        return 100
    even = 100 / n
    deviation = sum(abs(s - even) for s in shares) / 2  # total mass moved away from an even split
    worst = 100 - even
    return int(round(max(0.0, 100 - deviation / worst * 100)))


def streaks(df: pd.DataFrame, min_days: int = 7) -> Dict[str, Any]:
    """Runs of consecutive days with at least one message."""
    dates = pd.to_datetime(pd.Series(sorted(df["date"].unique())))
    if dates.empty:
        return {"count_over_week": 0, "top": []}
    group = (dates.diff().dt.days != 1).cumsum()
    runs = dates.groupby(group).agg(["min", "max", "size"]).sort_values("size", ascending=False)
    return {
        "count_over_week": int((runs["size"] >= min_days).sum()),
        "top": [
            {"days": int(r["size"]), "start": r["min"].strftime("%b %d, %Y"), "end": r["max"].strftime("%b %d, %Y")}
            for _, r in runs.head(5).iterrows()
        ],
    }
