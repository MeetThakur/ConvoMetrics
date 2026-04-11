# 💬 ConvoMetrics: Chat Analytics Dashboard

**ConvoMetrics** is a powerful, Python-based chat analysis tool and interactive Streamlit dashboard. It takes your exported Telegram or WhatsApp chat histories and decodes them using **Pandas**, **Data Visualization (Plotly)**, and **Natural Language Processing (NLP)** superpowers to reveal fascinating conversational insights.

---

## 🚀 Key Features

- **Multi-Platform Support:** Seamlessly parses both **Telegram (JSON)** and **WhatsApp (TXT)** chat exports.
- **High-Level Statistics:** Instantly view total messages, words, characters, days talked, and participant breakdowns.
- **Activity & Time Trends:** Discover your busiest messaging days, hourly activity patterns, and conversational volume over time using beautiful, interactive Plotly charts.
- **NLP Word Analysis & Visual Word Cloud ☁️:** Automatically filters out common filler words (stopwords) using `NLTK` to reveal the *actual* topics, generating a beautiful Word Cloud and bar charts.
- **Word Searcher 🔍:** Wondering who said a specific word the most? Search for it and instantly see a breakdown of who used it and a timeline of when it was said!
- **Emoji Analytics 😂❤️🔥:** Extracts and counts emojis used in the chat, displaying the top emojis specific to each sender.
- **Lightning Fast:** Uses `pandas` DataFrames and Streamlit caching to process tens of thousands of messages in seconds.

---

## 🛠️ Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YourUsername/ConvoMetrics.git
   cd ConvoMetrics
   ```

2. **Install the required libraries:**
   Make sure you have Python installed. Then run:
   ```bash
   python -m pip install -r requirements.txt
   ```
   *(This will install `streamlit`, `pandas`, `plotly`, `nltk`, `emoji`, `wordcloud`, and `matplotlib`)*

3. **Run the Dashboard:**
   ```bash
   python -m streamlit run app.py
   ```
   Your browser will automatically open the dashboard at `http://localhost:8501`.

---

## 📥 How to Export Your Chats

To use ConvoMetrics, you need to provide your chat data. Here is how to get it:

### 📱 Telegram (Desktop)
1. Open the Telegram Desktop app.
2. Go to your preferred chat.
3. Click the three dots (top right corner) and select **Export chat history**.
4. Uncheck all media types (Photos, Videos, etc.) to keep the file small.
5. Under "Format", ensure you select **Machine-readable JSON**.
6. Export and upload the resulting `result.json` file to the app.

### 🟢 WhatsApp (Mobile)
1. Open WhatsApp on your phone and navigate to the chat you want to analyze.
2. Tap the contact's name at the top.
3. Scroll down and tap **Export Chat**.
4. Choose **Without Media**.
5. Save the generated `.txt` file to your computer and upload it to the app.

---

## 💻 Tech Stack
- **Frontend / Framework:** [Streamlit](https://streamlit.io/)
- **Data Manipulation:** [Pandas](https://pandas.pydata.org/)
- **Data Visualization:** [Plotly](https://plotly.com/python/), [WordCloud](https://github.com/amueller/word_cloud)
- **Natural Language Processing:** [NLTK](https://www.nltk.org/)
- **Emoji Parsing:** [emoji](https://pypi.org/project/emoji/)

---

<p align="center">Made with ❤️ by Meet. Consider Starring 🌟 the repository if you like it!</p>