import hashlib
import json
from pathlib import Path
from typing import Iterable

import numpy as np
from django.conf import settings
from sklearn.feature_extraction.text import TfidfVectorizer

try:
    from sentence_transformers import SentenceTransformer
except Exception:
    SentenceTransformer = None


MODEL_DIR = Path(settings.BASE_DIR) / "ai_models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
_CACHE_FILE = MODEL_DIR / "embedding_cache.json"

_ENCODER = None
_EMBED_CACHE: dict[str, list[float]] = {}


def _load_cache():
    global _EMBED_CACHE
    if _CACHE_FILE.exists():
        _EMBED_CACHE = json.loads(_CACHE_FILE.read_text())


def _save_cache():
    _CACHE_FILE.write_text(json.dumps(_EMBED_CACHE))


def get_encoder():
    global _ENCODER
    if _ENCODER is not None:
        return _ENCODER

    if SentenceTransformer is not None:
        local_path = MODEL_DIR / "all-MiniLM-L6-v2"
        _ENCODER = SentenceTransformer("all-MiniLM-L6-v2", cache_folder=str(MODEL_DIR))
        if not local_path.exists():
            local_path.mkdir(parents=True, exist_ok=True)
        return _ENCODER

    _ENCODER = TfidfVectorizer(max_features=4096, stop_words="english")
    return _ENCODER


def _hash_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def encode_texts(texts: Iterable[str]) -> np.ndarray:
    _load_cache()
    encoder = get_encoder()
    texts = list(texts)

    if SentenceTransformer is not None and isinstance(encoder, SentenceTransformer):
        output = []
        missing_indices = []
        missing_texts = []

        for idx, text in enumerate(texts):
            key = _hash_text(text)
            if key in _EMBED_CACHE:
                output.append(np.array(_EMBED_CACHE[key], dtype=float))
            else:
                output.append(None)
                missing_indices.append(idx)
                missing_texts.append(text)

        if missing_texts:
            vectors = encoder.encode(missing_texts, show_progress_bar=False, normalize_embeddings=True)
            for i, vector in enumerate(vectors):
                target_index = missing_indices[i]
                output[target_index] = np.array(vector, dtype=float)
                _EMBED_CACHE[_hash_text(texts[target_index])] = output[target_index].tolist()
            _save_cache()

        return np.array(output)

    matrix = encoder.fit_transform(texts)
    return matrix.toarray()
