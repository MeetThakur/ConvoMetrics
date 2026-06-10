import json
import math
import re
import string
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

import emoji
import matplotlib.pyplot as plt
import nltk
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
from nltk.corpus import stopwords
from wordcloud import WordCloud

# --- Page Configuration ---
st.set_page_config(page_title="Convo Metrics", layout="wide")


# --- NLTK Setup ---
@st.cache_resource
def download_nltk_data():
    nltk.download("stopwords", quiet=True)
    sw = set(stopwords.words("english"))
    # Add common chat artifacts that might skew word counts
    chat_artifacts = {
        "media",
        "omitted",
        "deleted",
        "image",
        "video",
        "sticker",
        "gif",
        "voice",
        "call",
        "missed",
    }
    return sw.union(chat_artifacts)


stop_words = download_nltk_data()
link_pattern = re.compile(r"(?:https?://|www\.)\S+", re.IGNORECASE)
ALMOST_UNIQUE_SHARE = 0.8
FINNISH_COMMON_WORDS_PATH = Path(__file__).with_name("sanat.txt")


@st.cache_resource
def load_finnish_common_words():
    if not FINNISH_COMMON_WORDS_PATH.exists():
        return set()

    with FINNISH_COMMON_WORDS_PATH.open("r", encoding="utf-8") as word_file:
        return {
            line.strip().lower()
            for line in word_file
            if line.strip() and not line.startswith("#")
        }


@st.cache_data
def extract_meaningful_words(text):
    clean = str(text).lower().translate(str.maketrans("", "", string.punctuation))
    return [word for word in clean.split() if word not in stop_words and len(word) > 2]


@st.cache_data
def normalize_message_text(text):
    return re.sub(r"\s+", " ", str(text).strip().lower())


@st.cache_data
def is_almost_unique_to_sender(sender_count, total_count, share_threshold=ALMOST_UNIQUE_SHARE):
    other_count = total_count - sender_count
    if other_count <= 0:
        return True
    return sender_count > other_count and (sender_count / total_count) >= share_threshold


@st.cache_data
def get_unique_words_by_sender(df_subset, limit=10):
    sender_counters = {
        sender: Counter(
            word
            for message in sender_df["message"]
            for word in extract_meaningful_words(message)
        )
        for sender, sender_df in df_subset.groupby("sender")
    }
    all_senders = list(sender_counters.keys())
    total_word_counts = Counter()
    for counter in sender_counters.values():
        total_word_counts.update(counter)
    unique_words = {}

    for sender in all_senders:
        unique_words[sender] = [
            {"Item": word, "Count": count}
            for word, count in sender_counters[sender].most_common()
            if is_almost_unique_to_sender(count, total_word_counts[word])
        ][:limit]

    return unique_words


@st.cache_data
def get_unique_messages_by_sender(df_subset, limit=10):
    normalized_df = df_subset[["sender", "message"]].copy()
    normalized_df["normalized_message"] = normalized_df["message"].apply(
        normalize_message_text
    )
    normalized_df = normalized_df[
        normalized_df["normalized_message"].str.split().str.len() >= 2
    ]

    if normalized_df.empty:
        return {}

    total_message_counts = normalized_df["normalized_message"].value_counts()

    unique_messages = {}
    for sender, sender_df in normalized_df.groupby("sender"):
        sender_counts = Counter(sender_df["normalized_message"])
        sender_examples = (
            sender_df.drop_duplicates(subset=["normalized_message"])
            .set_index("normalized_message")["message"]
            .to_dict()
        )
        unique_messages[sender] = [
            {"Item": sender_examples[message], "Count": count}
            for message, count in sender_counts.most_common()
            if is_almost_unique_to_sender(count, int(total_message_counts[message]))
        ][:limit]

    for sender in df_subset["sender"].unique():
        unique_messages.setdefault(sender, [])

    return unique_messages


@st.cache_data
def extract_links(text):
    return link_pattern.findall(str(text))


@st.cache_data
def normalize_domain(link):
    candidate = link if re.match(r"^https?://", link, re.IGNORECASE) else f"https://{link}"
    domain = urlparse(candidate).netloc.lower()
    if domain.startswith("www."):
        domain = domain[4:]
    return domain


finnish_common_words = load_finnish_common_words()


# --- Parsing Functions (Cached for Performance) ---
@st.cache_data
def parse_telegram(json_data):
    messages = []
    if "messages" in json_data:
        for m in json_data["messages"]:
            if m.get("type") == "message" and "from" in m:
                text = m.get("text", "")
                if isinstance(text, list):
                    parsed_text = ""
                    for part in text:
                        if isinstance(part, str):
                            parsed_text += part
                        elif isinstance(part, dict) and "text" in part:
                            parsed_text += part["text"]
                    text = parsed_text
                else:
                    text = str(text)

                messages.append(
                    {
                        "timestamp": m.get("date"),
                        "sender": m.get("from"),
                        "message": text,
                    }
                )
    return pd.DataFrame(messages)


@st.cache_data
def parse_whatsapp(txt_data):
    # Robust Regex to capture date, time, sender, and message across various regions and OS formats
    # Handles:
    # 1. 12/31/22, 11:59 PM - Sender: Message (Android US)
    # 2. [31/12/2022, 23:59:59] Sender: Message (iOS UK)
    # 3. 31.12.2022, 23:59 - Sender: Message (Android EU)
    pattern = re.compile(
        r"^\[?(?P<date>\d{1,4}[-./]\d{1,2}[-./]\d{1,4})[, ]\s*(?P<time>\d{1,2}:\d{2}(?::\d{2})?\s*(?:[aApP]\.?[mM]\.?)?)\]?\s*[-]?\s*(?P<sender>[^:]+):\s*(?P<message>.*)$",
        re.IGNORECASE,
    )
    messages = []
    current_msg = None

    for line in txt_data.splitlines():
        match = pattern.match(line)
        if match:
            if current_msg:
                messages.append(current_msg)
            date_str = match.group("date")
            time_str = match.group("time")
            sender = match.group("sender").strip()
            text = match.group("message").strip()
            current_msg = {
                "timestamp": f"{date_str} {time_str}",
                "sender": sender,
                "message": text,
            }
        else:
            # Handle multi-line messages
            if current_msg:
                current_msg["message"] += "\n" + line.strip()

    if current_msg:
        messages.append(current_msg)

    return pd.DataFrame(messages)


@st.cache_data
def preprocess_dataframe(df):
    if df.empty:
        return df

    # Convert timestamp - infer_datetime_format is robust for different regions
    df["timestamp"] = pd.to_datetime(
        df["timestamp"], format="mixed", dayfirst=False, errors="coerce"
    )
    df = df.dropna(subset=["timestamp"])

    # Feature Engineering
    df["date"] = df["timestamp"].dt.date
    df["hour"] = df["timestamp"].dt.hour
    df["day_name"] = df["timestamp"].dt.day_name()

    # Word and Character Counts
    df["char_count"] = df["message"].apply(lambda x: len(str(x).replace(" ", "")))
    df["word_count"] = df["message"].apply(lambda x: len(str(x).split()))

    # NLP Features
    df["emojis"] = df["message"].apply(
        lambda x: [c for c in str(x) if c in emoji.EMOJI_DATA]
    )
    df["links"] = df["message"].apply(extract_links)
    df["link_count"] = df["links"].apply(len)

    return df


@st.cache_data
def build_conversations(df_subset, gap_hours=8):
    """Assign conversation IDs based on inactivity gaps between messages."""
    df = df_subset.sort_values("timestamp").reset_index(drop=True)
    time_diff = df["timestamp"].diff()
    new_convo = (time_diff > pd.Timedelta(hours=gap_hours)) | time_diff.isna()
    df["conversation_id"] = new_convo.cumsum().astype(int)
    return df


@st.cache_data
def build_interaction_matrix(ts_sender_tuples, window_minutes=5):
    """
    Count pairwise interactions using a sliding time window.
    If person B sends a message within window_minutes of person A, it counts
    as an interaction between A and B.
    ts_sender_tuples: tuple of (timestamp, sender) sorted by timestamp.
    """
    window = pd.Timedelta(minutes=window_minutes)
    interactions = Counter()
    n = len(ts_sender_tuples)
    j_start = 0
    for i in range(n):
        ts_i, sender_i = ts_sender_tuples[i]
        while j_start < i and (ts_i - ts_sender_tuples[j_start][0]) > window:
            j_start += 1
        for j in range(j_start, i):
            ts_j, sender_j = ts_sender_tuples[j]
            if sender_j != sender_i:
                pair = tuple(sorted([sender_i, sender_j]))
                interactions[pair] += 1
    return interactions


# --- Sidebar UI ---
st.sidebar.title("Convo Metrics")
st.sidebar.markdown(
    "Decode your conversations with **Pandas** & **NLP** superpowers!"
)

file_type = st.sidebar.radio("Platform", ["Telegram (JSON)", "WhatsApp (TXT)"])
uploaded_file = st.sidebar.file_uploader(
    "Upload your chat export", type=["json", "txt"]
)

st.sidebar.markdown("---")
st.sidebar.write("Made with love by Meet")
st.sidebar.write("Consider Starring the repository if you like it")

# --- Main App ---
st.title("Chat Analytics Dashboard")
st.markdown(
    "Dive deep into your chat history, track emoji usage, search for specific words, and visualize activity like never before!"
)

if uploaded_file is not None:
    try:
        with st.spinner("Parsing and crunching data..."):
            if file_type == "Telegram (JSON)":
                raw_data = json.load(uploaded_file)
                df = parse_telegram(raw_data)
            else:
                raw_data = uploaded_file.getvalue().decode("utf-8")
                df = parse_whatsapp(raw_data)

            df = preprocess_dataframe(df)

        if df.empty:
            st.error("No valid messages found in the uploaded file.")
        else:
            st.sidebar.markdown("---")
            st.sidebar.subheader("Filters")

            # Participant Filter
            all_participants = df["sender"].unique()
            selected_participants = st.sidebar.multiselect(
                "Select Participants",
                options=all_participants,
                default=all_participants,
            )

            # Date Filter
            min_date = df["date"].min()
            max_date = df["date"].max()

            if min_date < max_date:
                date_range = st.sidebar.date_input(
                    "Select Date Range",
                    value=(min_date, max_date),
                    min_value=min_date,
                    max_value=max_date,
                )
            else:
                date_range = (min_date, max_date)

            # Apply Filters
            df = df[df["sender"].isin(selected_participants)]
            if len(date_range) == 2:
                start_date, end_date = date_range
                df = df[(df["date"] >= start_date) & (df["date"] <= end_date)]

            if df.empty:
                st.warning("No messages found for the selected filters.")
                st.stop()

            # --- Global Metrics ---
            total_msgs = len(df)
            total_words = df["word_count"].sum()
            total_chars = df["char_count"].sum()
            total_days = df["date"].nunique()
            participants = df["sender"].nunique()
            msgs_per_user = df["sender"].value_counts()

            unique_word_counts = {}
            for sender, sender_df in df.groupby("sender"):
                sender_words = set()
                for message in sender_df["message"]:
                    sender_words.update(extract_meaningful_words(message))
                unique_word_counts[sender] = len(sender_words)

            most_messages_person = msgs_per_user.idxmax() if not msgs_per_user.empty else ""
            most_messages_count = int(msgs_per_user.max()) if not msgs_per_user.empty else 0
            most_unique_words_person = (
                max(unique_word_counts, key=unique_word_counts.get)
                if unique_word_counts
                else ""
            )
            most_unique_words_count = (
                unique_word_counts[most_unique_words_person]
                if most_unique_words_person
                else 0
            )
            per_person_stats = pd.DataFrame(
                [
                    {
                        "Participant": sender,
                        "Messages": int(msgs_per_user.get(sender, 0)),
                        "Unique Words": unique_word_counts.get(sender, 0),
                    }
                    for sender in msgs_per_user.index
                ]
            )

            # --- Advanced Metrics (Starters & Streaks) ---
            df = df.sort_values("timestamp").reset_index(drop=True)
            df["time_diff"] = df["timestamp"].diff()
            df["is_starter"] = df["time_diff"] > pd.Timedelta(hours=8)
            df.loc[0, "is_starter"] = True
            starters = df[df["is_starter"]]["sender"].value_counts()
            top_starter = starters.index[0] if not starters.empty else "Someone"

            unique_dates = pd.Series(df["date"].unique()).sort_values()
            date_diff = pd.to_datetime(unique_dates).diff().dt.days
            streak_groups = (date_diff != 1).cumsum()
            streak_lengths = streak_groups.value_counts()
            max_streak = streak_lengths.max() if not streak_lengths.empty else 0
            if max_streak > 0:
                longest_streak_group = streak_lengths.idxmax()
                streak_dates = unique_dates[streak_groups == longest_streak_group]
                streak_start = streak_dates.iloc[0].strftime("%b %d, %Y")
                streak_end = streak_dates.iloc[-1].strftime("%b %d, %Y")
            else:
                streak_start, streak_end = "", ""

            first_date = (
                df["date"].iloc[0].strftime("%b %d, %Y") if not df.empty else ""
            )
            first_msg = df["message"].iloc[0] if not df.empty else ""
            first_sender = df["sender"].iloc[0] if not df.empty else ""

            # --- Tabs ---
            tab_overview, tab_time, tab_words, tab_links, tab_search, tab_emojis, tab_conversations = st.tabs(
                [
                    "Overview",
                    "Activity Timeline",
                    "Word Analysis",
                    "Link Analysis",
                    "Word Searcher",
                    "Emoji Usage",
                    "Conversations",
                ]
            )

            with tab_overview:
                st.subheader("Your Chat Wrapped")
                book_pages = total_words // 250
                st.info(
                    f'**It all started on {first_date}** when **{first_sender}** said: *"{first_msg}"*. '
                    f"Since then, you've shared enough words to write a **{book_pages}-page book**! "
                    f"Your longest texting streak was **{max_streak} days** straight ({streak_start} to {streak_end}). "
                    f"**{top_starter}** is usually the one to break the ice and start conversations after a break!"
                )

                st.markdown("---")
                st.subheader("High-Level Statistics")
                m1, m2, m3, m4, m5 = st.columns(5)
                m1.metric("Total Messages", f"{total_msgs:,}")
                m2.metric("Total Words", f"{total_words:,}")
                m3.metric("Characters", f"{total_chars:,}")
                m4.metric("Days Talked", f"{total_days:,}")
                m5.metric("Participants", f"{participants:,}")

                st.markdown("---")
                st.subheader("Per-Person Leaders")
                l1, l2 = st.columns(2)
                l1.metric(
                    "Most Messages",
                    most_messages_person or "N/A",
                    f"{most_messages_count:,} messages" if most_messages_count else None,
                )
                l2.metric(
                    "Most Unique Words",
                    most_unique_words_person or "N/A",
                    f"{most_unique_words_count:,} unique words"
                    if most_unique_words_count
                    else None,
                )

                if not per_person_stats.empty:
                    st.dataframe(
                        per_person_stats,
                        width='stretch',
                        hide_index=True,
                    )

                st.markdown("---")

                col1, col2 = st.columns(2)
                with col1:
                    st.subheader("Messages by Participant")
                    msgs_per_user_df = msgs_per_user.reset_index()
                    msgs_per_user_df.columns = ["Participant", "Messages"]
                    fig = px.pie(
                        msgs_per_user_df,
                        values="Messages",
                        names="Participant",
                        hole=0.4,
                        color_discrete_sequence=px.colors.sequential.Teal,
                    )
                    st.plotly_chart(fig, width='stretch')

                with col2:
                    st.subheader("Average Message Length")
                    avg_len = df.groupby("sender")["word_count"].mean().reset_index()
                    avg_len.columns = ["Participant", "Avg Words"]
                    fig2 = px.bar(
                        avg_len,
                        x="Participant",
                        y="Avg Words",
                        text="Avg Words",
                        color="Participant",
                        color_discrete_sequence=px.colors.qualitative.Pastel,
                    )
                    fig2.update_traces(texttemplate="%{text:.1f}")
                    st.plotly_chart(fig2, width='stretch')

            with tab_time:
                st.subheader("Activity Over Time")

                timeline_anchor = df["timestamp"].max().normalize()
                start_365 = timeline_anchor - pd.Timedelta(days=364)
                start_ytd = pd.Timestamp(year=timeline_anchor.year, month=1, day=1)
                current_month_start = pd.Timestamp(
                    year=timeline_anchor.year,
                    month=timeline_anchor.month,
                    day=1,
                )
                last_full_month_end = current_month_start - pd.Timedelta(days=1)
                last_full_month_start = pd.Timestamp(
                    year=last_full_month_end.year,
                    month=last_full_month_end.month,
                    day=1,
                )
                prev_365_start = start_365 - pd.Timedelta(days=365)
                prev_365_end = start_365 - pd.Timedelta(days=1)
                ytd_days = (timeline_anchor - start_ytd).days + 1
                prev_ytd_start = start_ytd - pd.DateOffset(years=1)
                prev_ytd_end = prev_ytd_start + pd.Timedelta(days=ytd_days - 1)
                prev_month_end = last_full_month_start - pd.Timedelta(days=1)
                prev_month_start = pd.Timestamp(
                    year=prev_month_end.year,
                    month=prev_month_end.month,
                    day=1,
                )

                def period_counts(start_ts, end_ts):
                    mask = (df["timestamp"] >= start_ts) & (df["timestamp"] <= end_ts)
                    return df.loc[mask].groupby("sender").size()

                counts_365 = period_counts(start_365, timeline_anchor)
                counts_ytd = period_counts(start_ytd, timeline_anchor)
                counts_last_full_month = period_counts(
                    last_full_month_start,
                    last_full_month_end + pd.Timedelta(hours=23, minutes=59, seconds=59),
                )
                prev_counts_365 = period_counts(
                    prev_365_start,
                    prev_365_end + pd.Timedelta(hours=23, minutes=59, seconds=59),
                )
                prev_counts_ytd = period_counts(
                    prev_ytd_start,
                    prev_ytd_end + pd.Timedelta(hours=23, minutes=59, seconds=59),
                )
                prev_counts_last_full_month = period_counts(
                    prev_month_start,
                    prev_month_end + pd.Timedelta(hours=23, minutes=59, seconds=59),
                )

                def format_pct_change(current_value, previous_value):
                    if previous_value <= 0:
                        return "N/A"
                    pct = ((current_value - previous_value) / previous_value) * 100
                    return f"{pct:+.1f}%"

                def trend_label(current_value, previous_value):
                    if current_value == 0 and previous_value == 0:
                        return "No recent activity"
                    if previous_value == 0:
                        return "More active"

                    pct_change = ((current_value - previous_value) / previous_value) * 100
                    if pct_change >= 15:
                        return "More active"
                    if pct_change <= -15:
                        return "Less active"
                    return "Steady"

                def recent_window_counts(days, offset_days=0):
                    end_ts = timeline_anchor - pd.Timedelta(days=offset_days)
                    start_ts = end_ts - pd.Timedelta(days=days - 1)
                    return period_counts(
                        start_ts,
                        end_ts + pd.Timedelta(hours=23, minutes=59, seconds=59),
                    )

                timeline_person_stats = (
                    df.groupby("sender")
                    .agg(
                        Messages=("message", "size"),
                        Active_Days=("date", "nunique"),
                        First_Message=("timestamp", "min"),
                        Last_Message=("timestamp", "max"),
                    )
                    .reset_index()
                    .rename(columns={"sender": "Participant"})
                )
                timeline_person_stats["Avg Messages / Active Day"] = (
                    timeline_person_stats["Messages"]
                    / timeline_person_stats["Active_Days"].replace(0, pd.NA)
                ).round(2)
                timeline_person_stats["Share of Total Messages (%)"] = (
                    timeline_person_stats["Messages"] / max(total_msgs, 1) * 100
                ).round(1)
                timeline_person_stats["First Message"] = timeline_person_stats[
                    "First_Message"
                ].dt.strftime("%Y-%m-%d %H:%M")
                timeline_person_stats["Last Message"] = timeline_person_stats[
                    "Last_Message"
                ].dt.strftime("%Y-%m-%d %H:%M")
                timeline_person_stats["Last 365 Days"] = timeline_person_stats[
                    "Participant"
                ].map(counts_365).fillna(0).astype(int)
                timeline_person_stats["YTD"] = timeline_person_stats[
                    "Participant"
                ].map(counts_ytd).fillna(0).astype(int)
                timeline_person_stats["Last Full Month"] = timeline_person_stats[
                    "Participant"
                ].map(counts_last_full_month).fillna(0).astype(int)
                timeline_person_stats["Last 365 Days Delta (%)"] = timeline_person_stats.apply(
                    lambda row: format_pct_change(
                        row["Last 365 Days"],
                        int(prev_counts_365.get(row["Participant"], 0)),
                    ),
                    axis=1,
                )
                timeline_person_stats["YTD Delta (%)"] = timeline_person_stats.apply(
                    lambda row: format_pct_change(
                        row["YTD"],
                        int(prev_counts_ytd.get(row["Participant"], 0)),
                    ),
                    axis=1,
                )
                timeline_person_stats["Last Full Month Delta (%)"] = timeline_person_stats.apply(
                    lambda row: format_pct_change(
                        row["Last Full Month"],
                        int(prev_counts_last_full_month.get(row["Participant"], 0)),
                    ),
                    axis=1,
                )

                counts_30 = recent_window_counts(30)
                prev_counts_30 = recent_window_counts(30, offset_days=30)
                counts_90 = recent_window_counts(90)
                prev_counts_90 = recent_window_counts(90, offset_days=90)

                trend_summary = timeline_person_stats[
                    ["Participant", "Last_Message"]
                ].copy()
                trend_summary["Messages (Last 30d)"] = trend_summary["Participant"].map(
                    counts_30
                ).fillna(0).astype(int)
                trend_summary["30d vs Previous 30d"] = trend_summary.apply(
                    lambda row: f"{trend_label(row['Messages (Last 30d)'], int(prev_counts_30.get(row['Participant'], 0)))} ({format_pct_change(row['Messages (Last 30d)'], int(prev_counts_30.get(row['Participant'], 0)))})",
                    axis=1,
                )
                trend_summary["Messages (Last 90d)"] = trend_summary["Participant"].map(
                    counts_90
                ).fillna(0).astype(int)
                trend_summary["90d vs Previous 90d"] = trend_summary.apply(
                    lambda row: f"{trend_label(row['Messages (Last 90d)'], int(prev_counts_90.get(row['Participant'], 0)))} ({format_pct_change(row['Messages (Last 90d)'], int(prev_counts_90.get(row['Participant'], 0)))})",
                    axis=1,
                )
                trend_summary["Last Active"] = trend_summary["Last_Message"].dt.strftime(
                    "%Y-%m-%d %H:%M"
                )
                trend_summary = trend_summary.drop(columns=["Last_Message"]).sort_values(
                    by=["Messages (Last 30d)", "Messages (Last 90d)"],
                    ascending=False,
                )

                st.markdown("Simple per-person activity trends for the current filtered timeline.")
                st.caption(
                    "\"More active\" and \"Less active\" compare each participant's recent 30-day and 90-day message counts against the immediately preceding matching window. \"Steady\" means the change stayed within +/-15%."
                )
                st.dataframe(
                    trend_summary,
                    width='stretch',
                    hide_index=True,
                )
                with st.expander("Show detailed timeline metrics"):
                    st.dataframe(
                        timeline_person_stats[
                            [
                                "Participant",
                                "Messages",
                                "Active_Days",
                                "Avg Messages / Active Day",
                                "Share of Total Messages (%)",
                                "Last 365 Days",
                                "Last 365 Days Delta (%)",
                                "YTD",
                                "YTD Delta (%)",
                                "Last Full Month",
                                "Last Full Month Delta (%)",
                                "First Message",
                                "Last Message",
                            ]
                        ],
                        width='stretch',
                        hide_index=True,
                    )
                st.markdown("---")

                daily_msgs = df.groupby("date").size().reset_index(name="Messages")
                fig_time = px.line(
                    daily_msgs,
                    x="date",
                    y="Messages",
                    title="Messages per Day",
                )
                fig_time.update_traces(line_color="#FF4B4B")
                st.plotly_chart(fig_time, width='stretch')

                col1, col2 = st.columns(2)
                with col1:
                    st.subheader("Busiest Days of the Week")
                    day_order = [
                        "Monday",
                        "Tuesday",
                        "Wednesday",
                        "Thursday",
                        "Friday",
                        "Saturday",
                        "Sunday",
                    ]
                    day_counts = (
                        df["day_name"].value_counts().reindex(day_order).reset_index()
                    )
                    day_counts.columns = ["Day", "Messages"]
                    fig_days = px.bar(
                        day_counts,
                        x="Day",
                        y="Messages",
                        color="Messages",
                        color_continuous_scale="Blues",
                    )
                    st.plotly_chart(fig_days, width='stretch')

                with col2:
                    st.subheader("Activity by Hour")
                    hour_counts = df["hour"].value_counts().sort_index().reset_index()
                    hour_counts.columns = ["Hour", "Messages"]
                    fig_hours = px.bar(
                        hour_counts,
                        x="Hour",
                        y="Messages",
                        color="Messages",
                        color_continuous_scale="Purples",
                    )
                    fig_hours.update_xaxes(tickmode="linear", tick0=0, dtick=1)
                    st.plotly_chart(fig_hours, width='stretch')

                st.markdown("---")
                st.subheader("Per-Person Activity Patterns")

                day_order = [
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                ]
                day_counts_per_person = (
                    df.groupby(["sender", "day_name"]).size().reset_index(name="Messages")
                )
                day_counts_per_person["day_name"] = pd.Categorical(
                    day_counts_per_person["day_name"],
                    categories=day_order,
                    ordered=True,
                )
                day_counts_per_person = day_counts_per_person.sort_values(
                    ["sender", "Messages", "day_name"],
                    ascending=[True, False, True],
                )
                busiest_day_per_person = day_counts_per_person.drop_duplicates(
                    subset=["sender"],
                    keep="first",
                ).rename(
                    columns={
                        "sender": "Participant",
                        "day_name": "Busiest Day",
                        "Messages": "Messages on Busiest Day",
                    }
                )

                st.markdown("#### Busiest Day for Each Person")
                st.dataframe(
                    busiest_day_per_person[
                        ["Participant", "Busiest Day", "Messages on Busiest Day"]
                    ],
                    width='stretch',
                    hide_index=True,
                )

            with tab_words:
                st.subheader("Visual Word Cloud")
                st.markdown(
                    "A visual representation of the most frequently used words across the entire chat."
                )

                # Combine text and generate Word Cloud
                all_messages = " ".join(df["message"].astype(str))
                if len(all_messages.strip()) > 10:
                    word_cloud_col, long_word_cloud_col = st.columns(2)

                    wordcloud = WordCloud(
                        width=1200,
                        height=500,
                        background_color="white",
                        stopwords=stop_words,
                        colormap="viridis",
                        max_words=150,
                    ).generate(all_messages)

                    fig_wc, ax = plt.subplots(figsize=(15, 6))
                    ax.imshow(wordcloud, interpolation="bilinear")
                    ax.axis("off")
                    with word_cloud_col:
                        st.markdown("#### All Meaningful Words")
                        st.pyplot(fig_wc)

                    long_words = []
                    for message in df["message"]:
                        long_words.extend(
                            word
                            for word in extract_meaningful_words(message)
                            if len(word) > 6
                        )

                    with long_word_cloud_col:
                        st.markdown("#### Longer Words (>6 Characters)")
                        if long_words:
                            long_wordcloud = WordCloud(
                                width=1200,
                                height=500,
                                background_color="white",
                                stopwords=stop_words,
                                colormap="magma",
                                max_words=150,
                            ).generate(" ".join(long_words))

                            fig_long_wc, ax_long = plt.subplots(figsize=(15, 6))
                            ax_long.imshow(long_wordcloud, interpolation="bilinear")
                            ax_long.axis("off")
                            st.pyplot(fig_long_wc)
                        else:
                            st.info("No words longer than 6 characters were found.")

                    st.markdown("#### Words Outside Finnish Common Word List")
                    uncommon_words = []
                    for message in df["message"]:
                        uncommon_words.extend(
                            word
                            for word in extract_meaningful_words(message)
                            if word.isalpha() and word not in finnish_common_words
                        )

                    if uncommon_words:
                        uncommon_wordcloud = WordCloud(
                            width=1200,
                            height=500,
                            background_color="white",
                            stopwords=stop_words,
                            colormap="cividis",
                            max_words=150,
                        ).generate(" ".join(uncommon_words))

                        fig_uncommon_wc, ax_uncommon = plt.subplots(figsize=(15, 6))
                        ax_uncommon.imshow(uncommon_wordcloud, interpolation="bilinear")
                        ax_uncommon.axis("off")
                        st.pyplot(fig_uncommon_wc)
                    else:
                        st.info(
                            "All detected words are present in sanat.txt for the current filters."
                        )
                else:
                    st.info("Not enough textual data to generate a Word Cloud.")

                st.markdown("---")
                st.subheader("Top Words Used (Excluding Stopwords)")

                @st.cache_data
                def get_top_words(messages):
                    words = []
                    for text in messages:
                        words.extend(extract_meaningful_words(text))
                    return Counter(words).most_common(15)

                selected_user_word = st.selectbox(
                    "Select Participant for Word Analysis",
                    ["All"] + list(df["sender"].unique()),
                )

                if selected_user_word == "All":
                    top_words = get_top_words(df["message"])
                else:
                    top_words = get_top_words(
                        df.loc[df["sender"] == selected_user_word, "message"]
                    )

                if top_words:
                    word_df = pd.DataFrame(top_words, columns=["Word", "Count"])
                    fig_words = px.bar(
                        word_df,
                        x="Count",
                        y="Word",
                        orientation="h",
                        color="Count",
                        color_continuous_scale="Viridis",
                    )
                    fig_words.update_layout(yaxis={"categoryorder": "total ascending"})
                    st.plotly_chart(fig_words, width='stretch')
                else:
                    st.info("Not enough textual data to analyze words.")

                st.markdown("---")
                st.subheader("Per-Person Unique Language")
                st.markdown(
                    "These lists show words and repeated phrases that are strongly associated with one participant in the current filtered view, even if someone else used them occasionally."
                )

                sender_message_df = df[["sender", "message"]].copy()
                unique_words_by_sender = get_unique_words_by_sender(sender_message_df)
                unique_messages_by_sender = get_unique_messages_by_sender(
                    sender_message_df
                )

                for sender in df["sender"].unique():
                    st.markdown(f"#### {sender}")
                    col1, col2 = st.columns(2)

                    with col1:
                        st.markdown("**Top Unique Words**")
                        sender_unique_words = unique_words_by_sender.get(sender, [])
                        if sender_unique_words:
                            st.dataframe(
                                pd.DataFrame(sender_unique_words),
                                width='stretch',
                                hide_index=True,
                            )
                        else:
                            st.info("No unique words found for this participant.")

                    with col2:
                        st.markdown("**Top Unique Phrases**")
                        sender_unique_messages = unique_messages_by_sender.get(sender, [])
                        if sender_unique_messages:
                            st.dataframe(
                                pd.DataFrame(sender_unique_messages),
                                width='stretch',
                                hide_index=True,
                                column_config={
                                    "Item": st.column_config.TextColumn(
                                        "Item",
                                        width="large",
                                    )
                                },
                            )
                        else:
                            st.info("No unique phrases found for this participant.")

            with tab_links:
                st.subheader("Link Analysis")
                st.markdown(
                    "Track who shares the most internet links and which domains show up most often in the current filtered view."
                )

                link_df = df[df["link_count"] > 0].copy()

                if link_df.empty:
                    st.info("No internet links found for the current selection.")
                else:
                    total_links = int(link_df["link_count"].sum())
                    total_link_messages = int(len(link_df))
                    links_per_sender = (
                        link_df.groupby("sender")["link_count"].sum().sort_values(ascending=False)
                    )
                    link_messages_per_sender = (
                        link_df.groupby("sender").size().sort_values(ascending=False)
                    )
                    domain_counts = Counter(
                        normalize_domain(link)
                        for links in link_df["links"]
                        for link in links
                        if normalize_domain(link)
                    )

                    m1, m2 = st.columns(2)
                    m1.metric("Messages With Links", f"{total_link_messages:,}")
                    m2.metric("Total Links Shared", f"{total_links:,}")

                    col1, col2 = st.columns(2)

                    with col1:
                        st.subheader("Who Posts Most Links")
                        sender_links_df = links_per_sender.reset_index()
                        sender_links_df.columns = ["Participant", "Links"]
                        fig_sender_links = px.bar(
                            sender_links_df,
                            x="Participant",
                            y="Links",
                            text="Links",
                            color="Participant",
                            color_discrete_sequence=px.colors.qualitative.Safe,
                        )
                        st.plotly_chart(fig_sender_links, width='stretch')

                        sender_link_message_df = link_messages_per_sender.reset_index()
                        sender_link_message_df.columns = ["Participant", "Messages With Links"]
                        st.dataframe(
                            sender_link_message_df,
                            width='stretch',
                            hide_index=True,
                        )

                    with col2:
                        st.subheader("Top Domains")
                        if domain_counts:
                            domain_df = pd.DataFrame(
                                domain_counts.most_common(15),
                                columns=["Domain", "Links"],
                            )
                            fig_domains = px.bar(
                                domain_df,
                                x="Links",
                                y="Domain",
                                orientation="h",
                                color="Links",
                                color_continuous_scale="Tealgrn",
                            )
                            fig_domains.update_layout(
                                yaxis={"categoryorder": "total ascending"}
                            )
                            st.plotly_chart(fig_domains, width='stretch')
                            st.dataframe(
                                domain_df,
                                width='stretch',
                                hide_index=True,
                            )
                        else:
                            st.info("No domains could be extracted from the links found.")

                    st.markdown("---")
                    st.subheader("Recent Messages With Links")
                    recent_links_df = link_df.sort_values("timestamp", ascending=False)[
                        ["timestamp", "sender", "message", "link_count"]
                    ].head(20)
                    st.dataframe(
                        recent_links_df,
                        width='stretch',
                        hide_index=True,
                        column_config={
                            "timestamp": "Timestamp",
                            "sender": "Participant",
                            "message": st.column_config.TextColumn(
                                "Message",
                                width="large",
                            ),
                            "link_count": "Links",
                        },
                    )

            with tab_search:
                st.subheader("'Who Said It?' Word Searcher")
                st.markdown(
                    "Find out who uses a specific word the most, and when it was used!"
                )

                search_term = st.text_input(
                    "Enter a word to search (e.g., 'coffee', 'love', 'sorry'):"
                )

                if search_term:
                    search_term_clean = search_term.lower().strip()

                    # Function to count exact word matches (ignoring punctuation)
                    def count_specific_word(text):
                        clean_text = (
                            str(text)
                            .lower()
                            .translate(str.maketrans("", "", string.punctuation))
                        )
                        return clean_text.split().count(search_term_clean)

                    df["search_count"] = df["message"].apply(count_specific_word)
                    total_occurrences = df["search_count"].sum()

                    if total_occurrences > 0:
                        st.success(
                            f"The word **'{search_term_clean}'** was used **{total_occurrences}** times in this chat!"
                        )

                        col1, col2 = st.columns(2)

                        with col1:
                            # Who said it the most
                            who_df = (
                                df.groupby("sender")["search_count"].sum().reset_index()
                            )
                            who_df = who_df[who_df["search_count"] > 0]

                            fig_who = px.pie(
                                who_df,
                                values="search_count",
                                names="sender",
                                title=f"Who said '{search_term_clean}'?",
                                hole=0.3,
                            )
                            st.plotly_chart(fig_who, width='stretch')

                        with col2:
                            # Timeline of the word
                            time_df = (
                                df.groupby("date")["search_count"].sum().reset_index()
                            )
                            time_df = time_df[time_df["search_count"] > 0]

                            fig_when = px.line(
                                time_df,
                                x="date",
                                y="search_count",
                                title=f"When was '{search_term_clean}' used?",
                                markers=True,
                            )
                            st.plotly_chart(fig_when, width='stretch')
                    else:
                        st.warning(
                            f"The word **'{search_term_clean}'** was not found anywhere in this chat."
                        )

            with tab_emojis:
                st.subheader("Emoji Analytics")

                @st.cache_data
                def get_top_emojis(emoji_sequences):
                    all_emojis = [
                        emoji
                        for emoji_list in emoji_sequences
                        for emoji in emoji_list
                    ]
                    return Counter(all_emojis).most_common(10)

                selected_user_emoji = st.selectbox(
                    "Select Participant for Emojis",
                    ["All"] + list(df["sender"].unique()),
                )

                if selected_user_emoji == "All":
                    top_emojis = get_top_emojis(tuple(tuple(v) for v in df["emojis"]))
                else:
                    top_emojis = get_top_emojis(
                        tuple(
                            tuple(v)
                            for v in df.loc[
                                df["sender"] == selected_user_emoji, "emojis"
                            ]
                        )
                    )

                if top_emojis:
                    emoji_df = pd.DataFrame(top_emojis, columns=["Emoji", "Count"])
                    fig_emojis = px.bar(
                        emoji_df,
                        x="Emoji",
                        y="Count",
                        text="Emoji",
                        color="Count",
                        color_continuous_scale="Sunset",
                    )
                    fig_emojis.update_traces(textposition="outside", textfont_size=20)
                    st.plotly_chart(fig_emojis, width='stretch')
                else:
                    st.info("No emojis found for this selection.")

            with tab_conversations:
                st.subheader("Conversation Explorer")
                st.markdown(
                    "Messages are grouped into conversations based on inactivity gaps. "
                    "The relationship graph shows how often participants respond to each other."
                )

                gap_hours = st.slider(
                    "Conversation gap (hours) — a new conversation starts after this much silence",
                    min_value=1, max_value=48, value=8, step=1,
                )

                df_convos = build_conversations(
                    df[["timestamp", "sender", "message"]], gap_hours=gap_hours
                )

                convo_summary = (
                    df_convos.groupby("conversation_id")
                    .agg(
                        Start=("timestamp", "min"),
                        End=("timestamp", "max"),
                        Messages=("message", "count"),
                        Participants=("sender", lambda x: ", ".join(sorted(x.unique()))),
                        Unique_Participants=("sender", "nunique"),
                    )
                    .reset_index(drop=True)
                )
                convo_summary["Duration"] = (convo_summary["End"] - convo_summary["Start"]).apply(
                    lambda d: (
                        f"{int(d.total_seconds() // 3600)}h {int((d.total_seconds() % 3600) // 60)}m"
                        if d.total_seconds() >= 60
                        else "< 1 min"
                    )
                )
                convo_summary["Start_fmt"] = convo_summary["Start"].dt.strftime("%Y-%m-%d %H:%M")
                convo_summary["End_fmt"] = convo_summary["End"].dt.strftime("%Y-%m-%d %H:%M")

                total_convos = len(convo_summary)
                avg_msgs = convo_summary["Messages"].mean()
                max_msgs = int(convo_summary["Messages"].max())

                m1, m2, m3 = st.columns(3)
                m1.metric("Total Conversations", f"{total_convos:,}")
                m2.metric("Avg Messages / Conversation", f"{avg_msgs:.1f}")
                m3.metric("Longest Conversation", f"{max_msgs:,} messages")

                st.markdown("---")
                st.subheader("All Conversations")
                st.dataframe(
                    convo_summary[["Start_fmt", "End_fmt", "Duration", "Messages", "Unique_Participants", "Participants"]].rename(
                        columns={
                            "Start_fmt": "Start",
                            "End_fmt": "End",
                            "Unique_Participants": "# Participants",
                        }
                    ),
                    width='stretch',
                    hide_index=True,
                )

                col1, col2 = st.columns(2)
                with col1:
                    st.subheader("Conversation Length Distribution")
                    fig_hist = px.histogram(
                        convo_summary,
                        x="Messages",
                        nbins=30,
                        labels={"Messages": "Messages per Conversation"},
                        color_discrete_sequence=["#636EFA"],
                    )
                    fig_hist.update_layout(bargap=0.05)
                    st.plotly_chart(fig_hist, width='stretch')

                with col2:
                    st.subheader("Conversations by Month")
                    convo_months = convo_summary["Start"].dt.to_period("M").astype(str).value_counts().sort_index().reset_index()
                    convo_months.columns = ["Month", "Conversations"]
                    fig_monthly = px.bar(
                        convo_months,
                        x="Month",
                        y="Conversations",
                        color_discrete_sequence=["#EF553B"],
                    )
                    st.plotly_chart(fig_monthly, width='stretch')

                st.markdown("---")
                st.subheader("Browse a Conversation")
                convo_options = [
                    f"#{i + 1} — {row['Start_fmt']}  ({row['Messages']} messages · {row['Participants']})"
                    for i, row in convo_summary.iterrows()
                ]
                selected_label = st.selectbox("Select a conversation to inspect", convo_options)
                if selected_label:
                    selected_idx = convo_options.index(selected_label)
                    # conversation_id is 1-indexed (cumsum starts at 1)
                    convo_msgs = df_convos[df_convos["conversation_id"] == selected_idx + 1][
                        ["timestamp", "sender", "message"]
                    ].sort_values("timestamp").copy()
                    convo_msgs["timestamp"] = convo_msgs["timestamp"].dt.strftime("%Y-%m-%d %H:%M:%S")
                    st.dataframe(
                        convo_msgs,
                        width='stretch',
                        hide_index=True,
                        column_config={
                            "timestamp": "Time",
                            "sender": "Participant",
                            "message": st.column_config.TextColumn("Message", width="large"),
                        },
                    )

                st.markdown("---")
                st.subheader("Interaction Relationship Graph")
                st.markdown(
                    "Edges connect participants who exchange messages within a short time window. "
                    "Thicker edges and larger nodes indicate more frequent interactions."
                )

                window_minutes = st.slider(
                    "Interaction window (minutes) — how quickly a reply counts as a direct response",
                    min_value=1, max_value=60, value=10, step=1,
                )

                ts_sender_tuples = tuple(
                    zip(df["timestamp"].tolist(), df["sender"].tolist())
                )
                interactions = build_interaction_matrix(ts_sender_tuples, window_minutes=window_minutes)

                senders = list(df["sender"].unique())

                if len(senders) < 2:
                    st.info("Need at least 2 participants to draw a relationship graph.")
                elif not interactions:
                    st.info("No interactions found within the selected time window. Try increasing it.")
                else:
                    n_senders = len(senders)
                    angles = [2 * math.pi * i / n_senders for i in range(n_senders)]
                    node_x = [math.cos(a) for a in angles]
                    node_y = [math.sin(a) for a in angles]
                    sender_pos = {s: (node_x[i], node_y[i]) for i, s in enumerate(senders)}
                    max_count = max(interactions.values())

                    edge_traces = []
                    for (s1, s2), count in interactions.items():
                        if s1 not in sender_pos or s2 not in sender_pos:
                            continue
                        x0, y0 = sender_pos[s1]
                        x1, y1 = sender_pos[s2]
                        width = 2 + 12 * (count / max_count)
                        opacity = 0.3 + 0.7 * (count / max_count)
                        mid_x = (x0 + x1) / 2
                        mid_y = (y0 + y1) / 2
                        edge_traces.append(
                            go.Scatter(
                                x=[x0, x1, None],
                                y=[y0, y1, None],
                                mode="lines",
                                line=dict(width=width, color=f"rgba(99,110,250,{opacity:.2f})"),
                                hoverinfo="skip",
                                showlegend=False,
                            )
                        )
                        # Edge label showing count
                        edge_traces.append(
                            go.Scatter(
                                x=[mid_x],
                                y=[mid_y],
                                mode="text",
                                text=[f"{count:,}"],
                                textfont=dict(size=10, color="#444"),
                                hoverinfo="skip",
                                showlegend=False,
                            )
                        )

                    node_interaction_totals = Counter()
                    for (s1, s2), count in interactions.items():
                        node_interaction_totals[s1] += count
                        node_interaction_totals[s2] += count

                    max_node_total = max(node_interaction_totals.values(), default=1)
                    node_sizes = [
                        25 + 35 * (node_interaction_totals.get(s, 0) / max_node_total)
                        for s in senders
                    ]
                    node_hover = [
                        f"<b>{s}</b><br>Total interactions: {node_interaction_totals.get(s, 0):,}"
                        for s in senders
                    ]

                    node_trace = go.Scatter(
                        x=node_x,
                        y=node_y,
                        mode="markers+text",
                        text=senders,
                        textposition="top center",
                        hovertext=node_hover,
                        hoverinfo="text",
                        marker=dict(
                            size=node_sizes,
                            color=[node_interaction_totals.get(s, 0) for s in senders],
                            colorscale="Viridis",
                            showscale=True,
                            colorbar=dict(title="Interactions"),
                            line=dict(width=2, color="white"),
                        ),
                        showlegend=False,
                    )

                    fig_network = go.Figure(data=edge_traces + [node_trace])
                    fig_network.update_layout(
                        height=560,
                        showlegend=False,
                        xaxis=dict(visible=False, range=[-1.6, 1.6]),
                        yaxis=dict(visible=False, range=[-1.6, 1.6]),
                        plot_bgcolor="white",
                        paper_bgcolor="white",
                        margin=dict(l=20, r=20, t=20, b=20),
                    )
                    st.plotly_chart(fig_network, width='stretch')

                    st.markdown("---")
                    col1, col2 = st.columns(2)

                    with col1:
                        st.subheader("Interaction Heatmap")
                        matrix = pd.DataFrame(0, index=senders, columns=senders)
                        for (s1, s2), count in interactions.items():
                            if s1 in matrix.index and s2 in matrix.columns:
                                matrix.loc[s1, s2] = count
                                matrix.loc[s2, s1] = count
                        fig_heat = px.imshow(
                            matrix,
                            text_auto=True,
                            color_continuous_scale="Blues",
                            aspect="auto",
                            labels=dict(x="Participant", y="Participant", color="Interactions"),
                        )
                        st.plotly_chart(fig_heat, width='stretch')

                    with col2:
                        st.subheader("Top Pairs by Interaction Count")
                        interaction_rows = [
                            {"Participant A": s1, "Participant B": s2, "Interactions": count}
                            for (s1, s2), count in sorted(
                                interactions.items(), key=lambda x: x[1], reverse=True
                            )
                        ]
                        if interaction_rows:
                            st.dataframe(
                                pd.DataFrame(interaction_rows),
                                width='stretch',
                                hide_index=True,
                            )

    except Exception as e:
        st.error(f"An error occurred while parsing the file: {e}")
        st.info(
            "Make sure you've uploaded a valid Telegram (JSON) or WhatsApp (TXT) file."
        )
else:
    st.info("👈 Please upload your chat export from the sidebar to begin analysis.")

    st.markdown("""
    ### Export Instructions:
    **For Telegram:**
    1. Open Telegram Desktop
    2. Go to chat -> Top right menu -> Export chat history
    3. Uncheck all media, format as **Machine-readable JSON**

    **For WhatsApp:**
    1. Open chat on mobile
    2. Tap contact name -> Export Chat
    3. Choose **Without Media** (will generate a `.txt` file)
    """)
