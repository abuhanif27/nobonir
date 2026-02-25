POSITIVE_WORDS = {"good", "great", "excellent", "awesome", "love", "best", "nice"}
NEGATIVE_WORDS = {"bad", "poor", "terrible", "worst", "hate", "slow", "broken"}


def analyze_sentiment(text: str):
    words = {item.strip(".,!?;:").lower() for item in text.split()}
    pos = len(words & POSITIVE_WORDS)
    neg = len(words & NEGATIVE_WORDS)
    score = pos - neg
    if score > 0:
        label = "positive"
    elif score < 0:
        label = "negative"
    else:
        label = "neutral"
    return {"label": label, "score": score}
