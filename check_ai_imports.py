try:
    import numpy as np
    print("numpy imported")
except ImportError:
    print("numpy NOT found")

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    print("scikit-learn imported")
except ImportError:
    print("scikit-learn NOT found")

try:
    from sentence_transformers import SentenceTransformer
    print("sentence-transformers imported")
except ImportError:
    print("sentence-transformers NOT found")

try:
    import torch
    print("torch imported")
except ImportError:
    print("torch NOT found")
