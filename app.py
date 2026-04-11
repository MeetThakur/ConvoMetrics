import json
import re
import string
from collections import Counter

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
            tab_overview, tab_time, tab_words, tab_search, tab_emojis = st.tabs(
                [
                    "Overview",
                    "Activity Timeline",
                    "Word Analysis",
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

                col1, col2 = st.columns(2)
                with col1:
                    st.subheader("Messages by Participant")
                    msgs_per_user = df["sender"].value_counts().reset_index()
                    msgs_per_user.columns = ["Participant", "Messages"]
                    fig = px.pie(
                        msgs_per_user,
                        values="Messages",
                        names="Participant",
                        hole=0.4,
                        color_discrete_sequence=px.colors.sequential.Teal,
                    )
                    st.plotly_chart(fig, use_container_width=True)

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
                    st.plotly_chart(fig2, use_container_width=True)

            with tab_time:
                st.subheader("Activity Over Time")
                daily_msgs = df.groupby("date").size().reset_index(name="Messages")
                fig_time = px.line(
                    daily_msgs,
                    x="date",
                    y="Messages",
                    title="Messages per Day",
                    line_shape="spline",
                )
                fig_time.update_traces(line_color="#FF4B4B")
                st.plotly_chart(fig_time, use_container_width=True)

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
                    st.plotly_chart(fig_days, use_container_width=True)

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
                    st.plotly_chart(fig_hours, use_container_width=True)

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
                def get_top_words(df_subset):
                    words = []
                    for text in df_subset["message"]:
                        clean = (
                            str(text)
                            .lower()
                            .translate(str.maketrans("", "", string.punctuation))
                        )
                        words.extend(
                            [
                                w
                                for w in clean.split()
                                if w not in stop_words and len(w) > 2
                            ]
                        )
                    return Counter(words).most_common(15)

                selected_user_word = st.selectbox(
                    "Select Participant for Word Analysis",
                    ["All"] + list(df["sender"].unique()),
                )

                if selected_user_word == "All":
                    top_words = get_top_words(df)
                else:
                    top_words = get_top_words(df[df["sender"] == selected_user_word])

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
                    st.plotly_chart(fig_words, use_container_width=True)
                else:
                    st.info("Not enough textual data to analyze words.")

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
                            st.plotly_chart(fig_who, use_container_width=True)

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
                            st.plotly_chart(fig_when, use_container_width=True)
                    else:
                        st.warning(
                            f"The word **'{search_term_clean}'** was not found anywhere in this chat."
                        )

            with tab_emojis:
                st.subheader("Emoji Analytics")

                @st.cache_data
                def get_top_emojis(df_subset):
                    all_emojis = [
                        emoji
                        for emoji_list in df_subset["emojis"]
                        for emoji in emoji_list
                    ]
                    return Counter(all_emojis).most_common(10)

                selected_user_emoji = st.selectbox(
                    "Select Participant for Emojis",
                    ["All"] + list(df["sender"].unique()),
                )

                if selected_user_emoji == "All":
                    top_emojis = get_top_emojis(df)
                else:
                    top_emojis = get_top_emojis(df[df["sender"] == selected_user_emoji])

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
                    st.plotly_chart(fig_emojis, use_container_width=True)
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
