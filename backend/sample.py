"""A fictional two-person chat, generated from a fixed seed, so the app can be tried without an export.

Nothing here comes from a real conversation. Sam and Alex are invented, and every line is drawn from
the phrase lists below. The generator is deterministic: the same numbers show up on every run.
"""
import random
from datetime import datetime, timedelta
from functools import lru_cache
from typing import List

import pandas as pd

from backend.parsers import preprocess_messages

PEOPLE = ["Sam", "Alex"]
START = datetime(2023, 1, 1, 9, 12)
DAYS = 700

OPENERS = [
    "Morning! ☀️", "good morning", "hey, you up?", "Hi hi", "yo", "Happy {day}!", "Morning 🌅",
    "so I had the weirdest dream", "ok important question", "guess what", "are you around?",
    "update:", "coffee? ☕", "hello hello", "psst", "long day today", "back from the gym 🏋️",
]
LINES = [
    "haha yes", "lol", "ok", "okay sounds good", "omg", "wait what", "no way", "seriously?", "that's amazing",
    "I can't believe it 😂", "hahaha", "same", "true", "fair", "ugh mondays", "the meeting ran long again",
    "did you see the game?", "what are you doing this weekend?", "pizza tonight? 🍕", "I'm so tired",
    "send me the link", "on my way", "running 10 min late sorry", "where are you?", "done! finally",
    "can you call me later?", "I'll be there at 7", "miss you", "love you ❤️", "❤️", "😂😂😂", "🙏", "👍",
    "good night 🌙", "night!", "sleep well", "talk tomorrow", "thanks!!", "thank you so much",
    "that movie was incredible", "the ending though 🤯", "I'm making pasta tonight", "recipe pls",
    "ok ok ok", "yesss", "nooo", "brb", "wfh today", "traffic is insane", "it's raining again ☔",
    "how was the interview?", "it went well I think!", "fingers crossed 🤞", "congrats!!! 🎉",
    "want to go hiking saturday? 🥾", "the trail was gorgeous", "look at this sunset 🌇", "<Media omitted>",
    "<Media omitted>", "<Media omitted>", "did you book the tickets?", "booked ✈️", "packing now",
    "flight's delayed 😩", "landed!", "the hotel is tiny but cute", "coffee here is unreal ☕",
    "what time is dinner?", "8 works", "I'll bring dessert", "cake 🎂", "happy birthday!!! 🎉🎂",
    "best day ever", "thanks for today", "that was so fun", "we should do that again", "100%",
    "my phone is dying", "charger?", "lol classic", "😅", "🙃", "🫠", "💀", "😭", "😍", "🔥", "✨",
    "WHAT", "NO WAY", "LET'S GO", "YESSSS", "THIS IS HUGE", "why is the wifi so bad",
    "I'll fix it tonight", "deploy went fine", "bug found 🐛", "fixed it", "ship it 🚀", "review pls",
    "lgtm", "merged", "the demo went great", "they loved the charts", "new project idea 💡",
    "what if we built a chat analyzer", "that's actually a great idea", "working on it",
    "https://github.com/example/convometrics", "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://open.spotify.com/track/abc123", "https://www.instagram.com/p/xyz/", "https://x.com/example/status/1",
    "https://en.wikipedia.org/wiki/Conversation", "https://www.reddit.com/r/dataisbeautiful/",
    "this song is on repeat 🎧", "add it to the playlist", "playlist updated", "chai time ☕",
    "kya haal hai", "sab theek", "chalo", "arre yaar", "bilkul", "acha ok", "kal milte hain",
    "good morning ☀️ did you sleep ok?", "barely 😴", "coffee first then we talk", "deal",
    "so about the trip", "I was thinking Lisbon?", "yes please 🇵🇹", "let me check prices", "found a good one",
    "I read the whole thread and honestly I think the second option is better because it keeps the "
    "schedule flexible, costs less, and we still get the weekend. Let me know what you think and I'll book it tonight.",
    "ok wow that was a long message", "I had a lot of thoughts", "😂", "fine fine, option two it is",
]
QUESTIONS = [
    "are you coming?", "what do you think?", "did you eat?", "when are you free?", "can you send it?",
    "should we go?", "what time?", "where?", "why though?", "how was your day?", "you ok?",
]
REPLIES = ["yes", "yep", "nope", "maybe", "ok", "sure", "haha", "lol", "true", "👍", "😂", "no", "idk", "soon"]


def _rng() -> random.Random:
    return random.Random(20230101)


def _day_weight(d: datetime) -> float:
    """Chats breathe: busier on weekends and in winter evenings, quieter in late summer."""
    weekend = 1.35 if d.weekday() >= 5 else 1.0
    season = 1.0 + 0.25 * (1 if d.month in (11, 12, 1, 2) else -1 if d.month in (7, 8) else 0)
    return weekend * season


def _hour_weight(h: int) -> float:
    if h < 6:
        return 0.08
    if h < 9:
        return 0.5
    if h < 12:
        return 0.9
    if h < 17:
        return 1.0
    if h < 23:
        return 1.8
    return 0.6


@lru_cache(maxsize=1)
def sample_messages() -> List[dict]:
    rng = _rng()
    out: List[dict] = []
    hours = list(range(24))
    weights = [_hour_weight(h) for h in hours]

    for day in range(DAYS):
        date = START + timedelta(days=day)
        # A few quiet stretches: a holiday in week 30, a bigger gap in month 14.
        if 203 <= day <= 209 or 420 <= day <= 438:
            continue
        if rng.random() < 0.08:
            continue  # ordinary quiet day
        n_sessions = max(1, int(rng.gauss(2.2 * _day_weight(date), 0.9)))
        for _ in range(n_sessions):
            hour = rng.choices(hours, weights)[0]
            t = date.replace(hour=hour, minute=rng.randrange(60), second=rng.randrange(60))
            opener = rng.choice(PEOPLE if rng.random() < 0.6 else ["Sam"])
            speaker = opener
            text = rng.choice(OPENERS).format(day=date.strftime("%A"))
            length = max(2, int(rng.gauss(9 * _day_weight(date), 6)))
            for i in range(length):
                out.append({"timestamp": t.strftime("%Y-%m-%d %H:%M:%S"), "sender": speaker, "message": text})
                # Next message: same person double-texts a third of the time.
                if rng.random() < 0.33:
                    gap = rng.uniform(5, 90)
                else:
                    speaker = PEOPLE[1] if speaker == PEOPLE[0] else PEOPLE[0]
                    gap = rng.choice([rng.uniform(10, 60), rng.uniform(60, 600), rng.uniform(600, 2400)])
                t += timedelta(seconds=gap)
                r = rng.random()
                if r < 0.12:
                    text = rng.choice(QUESTIONS)
                elif r < 0.35:
                    text = rng.choice(REPLIES)
                else:
                    text = rng.choice(LINES)
                # Alex writes a little longer and laughs a little more; Sam asks more questions.
                if speaker == "Alex" and rng.random() < 0.15:
                    text += " " + rng.choice(["haha", "😂", "lol", "honestly", "right?"])
                if speaker == "Sam" and rng.random() < 0.08:
                    text = rng.choice(QUESTIONS)
                if t.hour < 5 and rng.random() < 0.5:
                    text = rng.choice(["still awake?", "can't sleep", "go to sleep 😂", "night night", "🌙"])
    out.sort(key=lambda m: m["timestamp"])
    return out


def sample_df() -> pd.DataFrame:
    return preprocess_messages(pd.DataFrame(sample_messages()))
