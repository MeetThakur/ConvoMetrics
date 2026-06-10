import json
import re
import string
from collections import Counter
from urllib.parse import urlparse

import emoji
import matplotlib.pyplot as plt
import nltk
import pandas as pd
import plotly.express as px
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
            tab_overview, tab_time, tab_words, tab_links, tab_search, tab_emojis = st.tabs(
                [
                    "Overview",
                    "Activity Timeline",
                    "Word Analysis",
                    "Link Analysis",
                    "Word Searcher",
                    "Emoji Usage",
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

                st.markdown("Per-person statistics for the current filtered timeline.")
                st.caption(
                    "Delta (%) columns compare against the previous equivalent period for each participant."
                )
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
                    line_shape="spline",
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

            with tab_words:
                st.subheader("Visual Word Cloud")
                st.markdown(
                    "A visual representation of the most frequently used words across the entire chat."
                )

                # Combine text and generate Word Cloud
                all_messages = " ".join(df["message"].astype(str))
                if len(all_messages.strip()) > 10:
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
                    st.pyplot(fig_wc)
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
