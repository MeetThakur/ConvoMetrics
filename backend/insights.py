"""Conversation-level stats: sessions, reply speed, style, time of day, media and links."""
import re
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import pandas as pd

SESSION_GAP = pd.Timedelta(hours=1)   # quiet time that ends a conversation
REPLY_CUTOFF = pd.Timedelta(hours=6)  # slower than this is a new conversation, not a reply
RALLY_GAP = pd.Timedelta(minutes=5)   # max gap between messages in a fast back-and-forth
RALLY_MIN_MESSAGES = 4

LINK_RE = re.compile(r"(?:https?://|www\.)[^\s<>]+", re.IGNORECASE)

PLATFORMS = {
    "YouTube": ("youtube.com", "youtu.be"),
    "Instagram": ("instagram.com",),
    "Spotify": ("spotify.com",),
    "X / Twitter": ("twitter.com", "x.com", "t.co"),
    "TikTok": ("tiktok.com",),
    "Reddit": ("reddit.com", "redd.it"),
    "GitHub": ("github.com",),
}

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _host(url: str) -> str:
    if not url.lower().startswith("http"):
        url = "http://" + url
    host = (urlparse(url).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


def _platform(host: str) -> str:
    for name, domains in PLATFORMS.items():
        if any(host == d or host.endswith("." + d) for d in domains):
            return name
    return "Other"


def _minutes(td: pd.Series) -> pd.Series:
    return td.dt.total_seconds() / 60


def _conversations(df: pd.DataFrame, gap: pd.Series) -> Dict[str, Any]:
    session_id = (gap > SESSION_GAP).cumsum().rename("session")
    sessions = df.groupby(session_id)["timestamp"].agg(["min", "max", "size"])
    sessions["minutes"] = _minutes(sessions["max"] - sessions["min"])
    multi = sessions[sessions["size"] > 1]

    longest = multi.nlargest(5, "minutes")
    silence_days, silence_end = 0.0, ""
    if gap.notna().any():
        idx = gap.idxmax()
        silence_days = round(gap[idx].total_seconds() / 86400, 1)
        silence_end = df["timestamp"][idx].strftime("%b %d, %Y")

    return {
        "total": int(len(sessions)),
        "avg_minutes": round(float(multi["minutes"].mean()), 1) if len(multi) else 0.0,
        "longest": [
            {
                "date": row["min"].strftime("%b %d, %Y"),
                "minutes": round(float(row["minutes"])),
                "messages": int(row["size"]),
            }
            for _, row in longest.iterrows()
        ],
        "longest_silence": {"days": silence_days, "ended": silence_end},
    }


def _double_texting(df: pd.DataFrame) -> List[Dict[str, Any]]:
    run_id = (df["sender"] != df["sender"].shift()).cumsum().rename("run")
    runs = df.groupby(run_id).agg(sender=("sender", "first"), length=("sender", "size"), when=("timestamp", "first"))
    best = runs.loc[runs.groupby("sender")["length"].idxmax()].sort_values("length", ascending=False)
    return [
        {"name": str(r["sender"]), "run": int(r["length"]), "date": r["when"].strftime("%b %d, %Y")}
        for _, r in best.iterrows()
    ]


def _responsiveness(df: pd.DataFrame, gap: pd.Series) -> Dict[str, Any]:
    is_reply = (df["sender"] != df["sender"].shift()) & gap.notna() & (gap <= REPLY_CUTOFF)
    minutes = _minutes(gap[is_reply])
    senders = df["sender"][is_reply]

    per_sender = [
        {
            "name": str(name),
            "median_minutes": round(float(vals.median()), 1),
            "avg_minutes": round(float(vals.mean()), 1),
            "replies": int(len(vals)),
        }
        for name, vals in minutes.groupby(senders)
    ]
    per_sender.sort(key=lambda r: r["median_minutes"])
    return {
        "median_minutes": round(float(minutes.median()), 1) if len(minutes) else 0.0,
        "avg_minutes": round(float(minutes.mean()), 1) if len(minutes) else 0.0,
        "per_sender": per_sender,
    }


def _style(df: pd.DataFrame, text: pd.Series) -> List[Dict[str, Any]]:
    frame = pd.DataFrame({
        "sender": df["sender"],
        "questions": text.str.contains(r"\?", regex=True).astype(int),
        "exclamations": text.str.contains("!", regex=False).astype(int),
        "night": (df["hour"] < 5).astype(int),
        "messages": 1,
    })
    totals = frame.groupby("sender").sum()
    return [
        {
            "name": str(name),
            "messages": int(r["messages"]),
            "questions": int(r["questions"]),
            "exclamations": int(r["exclamations"]),
            "night": int(r["night"]),
        }
        for name, r in totals.iterrows()
    ]


def _time_of_day(df: pd.DataFrame) -> Dict[str, Any]:
    hour = df["hour"]
    buckets = {
        "Late night (00–05)": int((hour < 5).sum()),
        "Morning (05–12)": int(((hour >= 5) & (hour < 12)).sum()),
        "Afternoon (12–17)": int(((hour >= 12) & (hour < 17)).sum()),
        "Evening (17–24)": int((hour >= 17).sum()),
    }
    total = max(len(df), 1)
    monthly = df["timestamp"].dt.month.value_counts().reindex(range(1, 13)).fillna(0)

    first, last = df["timestamp"].min().normalize(), df["timestamp"].max().normalize()
    span_days = (last - first).days + 1
    active_days = int(df["date"].nunique())
    return {
        "buckets": [{"label": k, "count": v, "percentage": round(v / total * 100, 1)} for k, v in buckets.items()],
        "monthly": [{"month": MONTHS[m - 1], "count": int(c)} for m, c in monthly.items()],
        "span_days": int(span_days),
        "active_days": active_days,
        "active_percentage": round(active_days / span_days * 100, 1),
        "messages_per_active_day": round(len(df) / max(active_days, 1), 1),
    }


def _media_and_links(df: pd.DataFrame, text: pd.Series) -> Dict[str, Any]:
    links_by_sender: Dict[str, int] = {}
    platforms: Dict[str, int] = {}
    domains: Dict[str, int] = {}
    for sender, body in zip(df["sender"], text):
        for url in LINK_RE.findall(body):
            host = _host(url.rstrip(".,)!?"))
            if not host:
                continue
            links_by_sender[sender] = links_by_sender.get(sender, 0) + 1
            platform = _platform(host)
            platforms[platform] = platforms.get(platform, 0) + 1
            domains[host] = domains.get(host, 0) + 1

    media_by_sender = df.groupby("sender")["is_media"].sum()
    names = sorted(set(df["sender"]))
    return {
        "media_total": int(df["is_media"].sum()),
        "media_share": round(float(df["is_media"].mean()) * 100, 1),
        "links_total": sum(links_by_sender.values()),
        "per_sender": [
            {"name": str(n), "media": int(media_by_sender.get(n, 0)), "links": links_by_sender.get(n, 0)}
            for n in names
        ],
        "platforms": [
            {"name": k, "count": v}
            for k, v in sorted(platforms.items(), key=lambda kv: (kv[0] == "Other", -kv[1]))
        ],
        "top_domains": [{"name": k, "count": v} for k, v in sorted(domains.items(), key=lambda kv: -kv[1])[:8]],
    }


def _chain_summaries(df: pd.DataFrame, link: pd.Series, top_n: int) -> List[Dict[str, Any]]:
    """Longest runs of consecutive messages where `link[i]` joins message i to the one before it."""
    chain_id = (~link).cumsum().rename("chain")  # a new chain starts at every unlinked message
    sizes = chain_id.value_counts()
    sizes = sizes[sizes >= RALLY_MIN_MESSAGES]
    ranked = sizes.reset_index()
    ranked.columns = ["chain", "size"]
    ranked = ranked.sort_values(["size", "chain"], ascending=[False, True])

    out: List[Dict[str, Any]] = []
    for _, row in ranked.iterrows():
        part = df[chain_id == row["chain"]]
        if part["sender"].nunique() < 2:
            continue  # one person talking to themselves is not an exchange
        start, end = part["timestamp"].iloc[0], part["timestamp"].iloc[-1]
        out.append({
            "messages": int(row["size"]),
            "date": start.strftime("%b %d, %Y"),
            "time": start.strftime("%H:%M"),
            "minutes": round((end - start).total_seconds() / 60, 1),
            "people": [str(n) for n in part["sender"].value_counts().index],
        })
        if len(out) == top_n:
            break
    return out


def _rallies(df: pd.DataFrame, gap: pd.Series, top_n: int = 5) -> Dict[str, Any]:
    """
    Rally: messages in a row where no two neighbours are more than RALLY_GAP apart.
    Ping-pong: the stricter version where the sender also changes on every message.
    """
    close = gap.notna() & (gap <= RALLY_GAP)
    ping_pong = _chain_summaries(df, close & (df["sender"] != df["sender"].shift()), 1)
    return {
        "longest": _chain_summaries(df, close, top_n),
        "ping_pong": ping_pong[0] if ping_pong else None,
    }


def _texting_hours(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Each person's messages by hour of day, with their busiest hour and the part of the day it falls in."""
    table = pd.crosstab(df["hour"], df["sender"]).reindex(range(24), fill_value=0)
    periods = [("late night", range(0, 5)), ("morning", range(5, 12)), ("afternoon", range(12, 17)), ("evening", range(17, 24))]
    out = []
    for name in [str(n) for n in df["sender"].value_counts().index]:
        hourly = [int(v) for v in table[name]]
        peak = max(range(24), key=lambda h: (hourly[h], -h))
        peak_period = next(label for label, hours in periods if peak in hours)
        out.append({"name": name, "hourly": hourly, "peak_hour": peak, "peak_period": peak_period})
    return out


MILESTONES = [100, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000]


def _busiest_days(df: pd.DataFrame, top_n: int = 10) -> List[Dict[str, Any]]:
    counts = df.groupby("date").size().reset_index(name="count")
    counts = counts.sort_values(["count", "date"], ascending=[False, True]).head(top_n)
    per_sender = df[df["date"].isin(counts["date"])].groupby(["date", "sender"]).size().reset_index(name="n")
    per_sender = per_sender.sort_values("n", ascending=False)

    def leader(date: str):
        """Top sender that day, or None when the top two are level."""
        rows = per_sender[per_sender["date"] == date]
        if len(rows) > 1 and rows["n"].iloc[0] == rows["n"].iloc[1]:
            return None
        return str(rows["sender"].iloc[0])

    return [
        {
            "date": pd.to_datetime(r["date"]).strftime("%b %d, %Y"),
            "count": int(r["count"]),
            "top_sender": leader(r["date"]),
        }
        for _, r in counts.iterrows()
    ]


def _share_over_time(df: pd.DataFrame) -> Dict[str, Any]:
    """Messages per person per month (per week for chats shorter than ~4 months)."""
    span_days = (df["timestamp"].max() - df["timestamp"].min()).days + 1
    freq = "M" if span_days > 120 else "W"
    period = df["timestamp"].dt.to_period(freq)
    table = pd.crosstab(period, df["sender"])
    table = table.reindex(pd.period_range(period.min(), period.max(), freq=freq), fill_value=0)

    people = [str(n) for n in df["sender"].value_counts().index]
    if len(people) > 6:
        # Beyond six people the colours blur together: keep the top five, fold the rest into "Others".
        keep, rest = people[:5], people[5:]
        table["Others"] = table[rest].sum(axis=1)
        table = table[keep + ["Others"]]
        people = keep + ["Others"]
    fmt = "%b %Y" if freq == "M" else "%b %d"
    return {
        "granularity": "month" if freq == "M" else "week",
        "people": people,
        "periods": [
            {"label": p.start_time.strftime(fmt), "counts": {n: int(row[n]) if n in row else 0 for n in people}}
            for p, row in table.iterrows()
        ],
    }


def _milestones(df: pd.DataFrame) -> Dict[str, Any]:
    total = len(df)
    messages = [
        {
            "number": n,
            "date": df["timestamp"].iloc[n - 1].strftime("%b %d, %Y"),
            "sender": str(df["sender"].iloc[n - 1]),
        }
        for n in MILESTONES
        if n <= total
    ]
    by_month = df["timestamp"].dt.to_period("M").value_counts()
    month = by_month.sort_values(ascending=False).index[0]
    by_year = df["timestamp"].dt.year.value_counts()
    return {
        "messages": messages,
        "busiest_month": {"label": month.start_time.strftime("%B %Y"), "count": int(by_month[month])},
        "busiest_year": (
            {"label": str(int(by_year.idxmax())), "count": int(by_year.max())} if len(by_year) > 1 else None
        ),
    }


def compute_insights(df: pd.DataFrame, deleted: Optional[int] = 0) -> Dict[str, Any]:
    """`df` must be sorted by timestamp with a clean RangeIndex."""
    gap = df["timestamp"].diff()
    text = df["message"].astype(str).where(~df["is_media"], "")
    return {
        "conversations": _conversations(df, gap),
        "double_texting": _double_texting(df),
        "responsiveness": _responsiveness(df, gap),
        "rallies": _rallies(df, gap),
        "rally_gap_minutes": int(RALLY_GAP.total_seconds() // 60),
        "texting_hours": _texting_hours(df),
        "style": _style(df, text),
        "time_of_day": _time_of_day(df),
        "media": _media_and_links(df, text),
        "busiest_days": _busiest_days(df),
        "share_over_time": _share_over_time(df),
        "milestones": _milestones(df),
        "deleted_messages": deleted,
    }
