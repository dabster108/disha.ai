"""Shared embedding model for Chroma ingest and retrieval."""

from __future__ import annotations

import logging
from functools import lru_cache

from chromadb.api.types import Documents, EmbeddingFunction, Embeddings
from sentence_transformers import SentenceTransformer

from app.config import get_settings

logger = logging.getLogger("disha.rag.embeddings")

# BGE models use an asymmetric query prefix for better retrieval quality.
_BGE_QUERY_PREFIX = "Represent this sentence for searching relevant passages: "


class JobEmbeddingFunction(EmbeddingFunction[Documents]):
    """Document/query embedder with optional BGE query prefix."""

    def __init__(self, model_name: str) -> None:
        self.model_name = model_name
        self._model = SentenceTransformer(model_name)
        self.use_query_prefix = "bge" in model_name.casefold()
        logger.info("Loaded embedding model: %s (bge_query_prefix=%s)", model_name, self.use_query_prefix)

    def __call__(self, input: Documents) -> Embeddings:
        # Chroma calls this for both ingest documents and query_texts.
        # We only add the BGE prefix when a single short query is passed.
        texts = list(input)
        if self.use_query_prefix and len(texts) == 1 and len(texts[0]) < 256:
            texts = [f"{_BGE_QUERY_PREFIX}{texts[0]}"]
        vectors = self._model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        return vectors.tolist()

    def encode_documents(self, texts: list[str]) -> list[list[float]]:
        vectors = self._model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        return vectors.tolist()

    def encode_query(self, query: str) -> list[float]:
        text = f"{_BGE_QUERY_PREFIX}{query}" if self.use_query_prefix else query
        vector = self._model.encode(text, normalize_embeddings=True, show_progress_bar=False)
        return vector.tolist()


@lru_cache
def get_embedder() -> JobEmbeddingFunction:
    settings = get_settings()
    return JobEmbeddingFunction(settings.embedding_model)
