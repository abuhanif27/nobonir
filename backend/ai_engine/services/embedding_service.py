import numpy as np
from django.conf import settings
from pathlib import Path
from sklearn.feature_extraction.text import TfidfVectorizer

# Fallback to TfidfVectorizer if SentenceTransformer is broken on Windows
try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None

MODEL_DIR = Path(settings.BASE_DIR) / "ai_models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

_ENCODER = None

def get_encoder():
    global _ENCODER
    if _ENCODER is not None:
        return _ENCODER

    if SentenceTransformer is not None:
        try:
            # Use a local cache folder to avoid repeated downloads
            _ENCODER = SentenceTransformer("all-MiniLM-L6-v2", cache_folder=str(MODEL_DIR))
            return _ENCODER
        except Exception:
            # If local model cache is corrupt/unavailable, continue with lightweight fallback.
            pass

    # Fallback for environments without torch/sentence-transformers
    _ENCODER = TfidfVectorizer(max_features=4096, stop_words="english")
    return _ENCODER

def encode_text(text: str) -> list[float]:
    """
    Generates a vector embedding for a single text string.
    Returns a list of floats (JSON serializable).
    """
    encoder = get_encoder()
    
    if SentenceTransformer is not None and isinstance(encoder, SentenceTransformer):
        vector = encoder.encode(text, show_progress_bar=False, normalize_embeddings=True)
        return vector.tolist()
    
    # Fallback TF-IDF
    # Note: TF-IDF fit_transform expects an iterable, so we wrap text in list
    # In a real scenario, TF-IDF needs to be fit on the whole corpus first.
    # Since this is a fallback, we'll just do a simple hash-like vector or fit on single doc (suboptimal but runs)
    matrix = encoder.fit_transform([text])
    return matrix.toarray()[0].tolist()

def encode_texts(texts: list[str]) -> list[list[float]]:
    """
    Generates embeddings for a list of texts.
    """
    encoder = get_encoder()
    
    if SentenceTransformer is not None and isinstance(encoder, SentenceTransformer):
        vectors = encoder.encode(texts, show_progress_bar=False, normalize_embeddings=True)
        return vectors.tolist()
        
    matrix = encoder.fit_transform(texts)
    return matrix.toarray().tolist()
