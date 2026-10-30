from collections import Counter
import string
from typing import Any, Dict, List
import pandas as pd
from backend.insights import compute_insights
from backend.parsers import COMBINED_STOPWORDS


_PUNCT = str.maketrans("", "", string.punctuation)


def tokenize(text: str) -> List[str]:
    """Lowercase, strip ASCII punctuation, split on whitespace. The browser mirrors this for search."""
    return str(text).lower().translate(_PUNCT).split()


def build_word_index(df: pd.DataFrame) -> Dict[str, Any]:
    """Every word with its counts per sender and per period, so the browser can search without re-uploading."""
    span_days = (df["timestamp"].max() - df["timestamp"].min()).days + 1
    granularity = "day" if span_days <= 90 else "month"
    period_of = df["date"] if granularity == "day" else df["date"].str.slice(0, 7)

    senders = [str(x) for x in df["sender"].unique()]
    periods = sorted(period_of.unique())
    sender_code = {n: i for i, n in enumerate(senders)}
    period_code = {p: i for i, p in enumerate(periods)}

    triples: Counter = Counter()
    for sender, period, message in zip(df["sender"], period_of, df["message"]):
        s, p = sender_code[str(sender)], period_code[period]
        for word in tokenize(message):
            triples[(word, s, p)] += 1

    words: Dict[str, Any] = {}
    for (word, s, p), count in triples.items():
        entry = words.setdefault(word, [0, {}, {}])
        entry[0] += count
        entry[1][s] = entry[1].get(s, 0) + count
        entry[2][p] = entry[2].get(p, 0) + count
    return {
        "granularity": granularity,
        "senders": senders,
        "periods": periods,
        "words": {w: [e[0], [[k, v] for k, v in e[1].items()], [[k, v] for k, v in sorted(e[2].items())]] for w, e in words.items()},
    }


def _top(rows: List[Dict[str, Any]], key: str, minimum: int = 1):
    """Row with the highest `key`, or None if nobody reaches `minimum`."""
    if not rows:
        return None
    best = max(rows, key=lambda r: r[key])
    return best if best[key] >= minimum else None


def _insight_awards(ins: Dict[str, Any]) -> List[Dict[str, Any]]:
    awards: List[Dict[str, Any]] = []
    style = ins["style"]

    inquisitor = _top(style, "questions")
    if inquisitor:
        awards.append({"title": "The Inquisitor", "recipient": inquisitor["name"],
                       "description": f"Asked {inquisitor['questions']:,} {'question' if inquisitor['questions'] == 1 else 'questions'}"})

    return awards


def calculate_chat_analytics(df: pd.DataFrame, platform: str) -> Dict[str, Any]:
    """Compute high-level metrics, Chat Wrapped, and playful awards entirely in memory."""
    if df.empty:
        return {}
    deleted = df.attrs.get("deleted")  # None when the data was date-filtered

    # Sort chronologically
    df = df.sort_values("timestamp", kind="stable").reset_index(drop=True)  # stable: keeps file order for same-minute messages

    # 1. Basic counts
    total_msgs = int(len(df))
    total_words = int(df["word_count"].sum())
    total_chars = int(df["char_count"].sum())
    unique_dates = sorted(df["date"].unique())
    total_days = len(unique_dates)
    participants = [str(p) for p in df["sender"].unique() if pd.notna(p)]

    # 2. Advanced Metrics (Starters & Streaks)
    df["time_diff"] = df["timestamp"].diff()
    df["is_starter"] = df["time_diff"] > pd.Timedelta(hours=8)
    df.loc[0, "is_starter"] = True
    starters = df[df["is_starter"]]["sender"].value_counts()
    top_starter = str(starters.index[0]) if not starters.empty else (participants[0] if participants else "Someone")

    # Longest active texting streak
    date_series = pd.to_datetime(pd.Series(unique_dates))
    date_diff = date_series.diff().dt.days
    streak_groups = (date_diff != 1).cumsum()
    streak_lengths = streak_groups.value_counts()
    max_streak = int(streak_lengths.max()) if not streak_lengths.empty else 0

    streak_start_str = ""
    streak_end_str = ""
    if max_streak > 0:
        longest_id = streak_lengths.idxmax()
        matching_dates = date_series[streak_groups == longest_id]
        if not matching_dates.empty:
            streak_start_str = matching_dates.iloc[0].strftime("%b %d, %Y")
            streak_end_str = matching_dates.iloc[-1].strftime("%b %d, %Y")

    first_date_str = df["timestamp"].iloc[0].strftime("%b %d, %Y")
    first_sender = str(df["sender"].iloc[0])
    first_msg = str(df["message"].iloc[0])[:140]

    # Busiest day of all time
    daily_grouped = df.groupby("date").size()
    busiest_date = str(daily_grouped.idxmax()) if not daily_grouped.empty else ""
    busiest_count = int(daily_grouped.max()) if not daily_grouped.empty else 0
    busiest_date_formatted = pd.to_datetime(busiest_date).strftime("%B %d, %Y") if busiest_date else ""

    # Peak hour
    hour_grouped = df.groupby("hour").size()
    peak_hour_num = int(hour_grouped.idxmax()) if not hour_grouped.empty else 20
    peak_hour_str = f"{peak_hour_num:02d}:00"

    # 3. Superlatives
    awards = []
    if len(participants) >= 1:
        # Night Owl (midnight - 5am)
        night_df = df[df["hour"].isin([0, 1, 2, 3, 4])]
        if not night_df.empty:
            night_owl = night_df["sender"].value_counts().index[0]
            awards.append({
                "title": "The Night Owl",
                "recipient": str(night_owl),
                "description": "Most messages between midnight and 5 AM",
            })

        # Early Bird (5am - 9am)
        morning_df = df[df["hour"].isin([5, 6, 7, 8])]
        if not morning_df.empty:
            early_bird = morning_df["sender"].value_counts().index[0]
            awards.append({
                "title": "The Early Bird",
                "recipient": str(early_bird),
                "description": "Most messages between 5 AM and 9 AM",
            })

        # Emoji Champion (highest emoji count per message)
        emoji_ratios = []
        for sender, grp in df.groupby("sender"):
            tot_emojis = sum(len(e) for e in grp["emojis"])
            emoji_ratios.append((sender, tot_emojis / max(len(grp), 1)))
        if emoji_ratios:
            top_emoji_user = max(emoji_ratios, key=lambda x: x[1])[0]
            awards.append({
                "title": "Emoji Enthusiast",
                "recipient": str(top_emoji_user),
                "description": "Most emojis per message",
            })

        # Novelist (highest avg words per message)
        sender_lengths = df.groupby("sender")["word_count"].mean()
        if not sender_lengths.empty:
            novelist = sender_lengths.idxmax()
            awards.append({
                "title": "The Novelist",
                "recipient": str(novelist),
                "description": f"Longest messages, {round(sender_lengths.max(), 1)} words on average",
            })

        # Conversation Starter
        awards.append({
            "title": "The Icebreaker",
            "recipient": str(top_starter),
            "description": "Most often sends first after 8+ hours of quiet",
        })

    insights = compute_insights(df, deleted=deleted)
    awards.extend(_insight_awards(insights))

    # 4. Participant Breakdown
    part_stats: List[Dict[str, Any]] = []
    for sender, group in df.groupby("sender"):
        msg_count = len(group)
        p_words = int(group["word_count"].sum())
        p_chars = int(group["char_count"].sum())
        p_emojis = int(sum(len(e) for e in group["emojis"]))
        part_stats.append({
            "name": str(sender),
            "messages": msg_count,
            "percentage": round((msg_count / total_msgs) * 100, 1),
            "words": p_words,
            "chars": p_chars,
            "emojis": p_emojis,
            "avg_words": round(p_words / max(msg_count, 1), 1),
        })
    part_stats.sort(key=lambda x: x["messages"], reverse=True)

    # 5. Activity Over Time
    daily_counts = df.groupby("date").size().reset_index(name="count")
    daily_timeline = [
        {"date": str(row["date"]), "count": int(row["count"])}
        for _, row in daily_counts.iterrows()
    ]

    day_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    day_counts = df["day_name"].value_counts().reindex(day_order).fillna(0)
    day_of_week = [
        {"day": day, "count": int(count)}
        for day, count in day_counts.items()
    ]

    hour_counts = df["hour"].value_counts().reindex(range(24)).fillna(0)
    hourly_activity = [
        {"hour": f"{h:02d}:00", "count": int(count)}
        for h, count in hour_counts.items()
    ]

    # 6. Top Words (excluding stopwords and punctuation)
    def extract_top_words(messages: pd.Series, top_n: int = 25) -> List[Dict[str, Any]]:
        words = []
        for text in messages:
            clean = str(text).lower().translate(str.maketrans("", "", string.punctuation))
            for w in clean.split():
                if w not in COMBINED_STOPWORDS and len(w) > 2 and not w.isnumeric():
                    words.append(w)
        return [{"word": w, "count": c} for w, c in Counter(words).most_common(top_n)]

    top_words_overall = extract_top_words(df["message"], top_n=25)
    words_by_sender: Dict[str, List[Dict[str, Any]]] = {}
    for sender, group in df.groupby("sender"):
        words_by_sender[str(sender)] = extract_top_words(group["message"], top_n=15)

    # 7. Emojis Analytics
    def extract_top_emojis(emoji_lists: pd.Series, top_n: int = 15) -> List[Dict[str, Any]]:
        all_emojis = [e for row in emoji_lists for e in row]
        return [{"emoji": e, "count": c} for e, c in Counter(all_emojis).most_common(top_n)]

    top_emojis_overall = extract_top_emojis(df["emojis"], top_n=15)
    emojis_by_sender: Dict[str, List[Dict[str, Any]]] = {}
    for sender, group in df.groupby("sender"):
        emojis_by_sender[str(sender)] = extract_top_emojis(group["emojis"], top_n=10)

    return {
        "platform": platform,
        "wrapped": {
            "first_date": first_date_str,
            "first_sender": first_sender,
            "first_msg": first_msg,
            "total_words": total_words,
            "book_pages": total_words // 250,
            "max_streak": max_streak,
            "streak_start": streak_start_str,
            "streak_end": streak_end_str,
            "top_starter": top_starter,
            "busiest_date": busiest_date_formatted,
            "busiest_count": busiest_count,
            "peak_hour": peak_hour_str,
            "awards": awards,
        },
        "overview": {
            "total_messages": total_msgs,
            "total_words": total_words,
            "total_chars": total_chars,
            "days_talked": total_days,
            "participants_count": len(participants),
            "date_start": unique_dates[0] if unique_dates else "",
            "date_end": unique_dates[-1] if unique_dates else "",
        },
        "participants": part_stats,
        "insights": insights,
        "word_index": build_word_index(df),
        "timeline": {
            "daily": daily_timeline,
            "day_of_week": day_of_week,
            "hourly": hourly_activity,
        },
        "words": {
            "overall": top_words_overall,
            "by_sender": words_by_sender,
        },
        "emojis": {
            "overall": top_emojis_overall,
            "by_sender": emojis_by_sender,
        },
    }
