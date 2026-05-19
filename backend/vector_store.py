# backend/vector_store.py
import hashlib
import numpy as np
import chromadb
from chromadb.api.types import EmbeddingFunction, Documents, Embeddings


class _LocalHashEmbedding(EmbeddingFunction):
    """
    Deterministic, network-free embedding function for offline/test use.
    Each text is hashed into a fixed-length float32 vector.
    Semantic similarity is limited but sufficient for functional tests.
    """
    DIM = 128

    def __call__(self, input: Documents) -> Embeddings:
        results: Embeddings = []
        for text in input:
            digest = hashlib.sha256(text.encode("utf-8")).digest()
            # Repeat digest to fill DIM floats
            raw = (digest * ((self.DIM * 4 // len(digest)) + 1))[: self.DIM * 4]
            vec = np.frombuffer(raw, dtype=np.uint8).astype(np.float32) / 255.0
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            results.append(vec.tolist())
        return results


class VectorStore:
    def __init__(self, novel_id: str, chroma_path: str = "data/chroma",
                 embedding_function: EmbeddingFunction | None = None):
        self.novel_id = novel_id
        ef = embedding_function or _LocalHashEmbedding()
        client = chromadb.PersistentClient(path=chroma_path)
        self.collection = client.get_or_create_collection(
            name=f"novel_{novel_id.replace('-', '_')}",
            embedding_function=ef,
            metadata={"hnsw:space": "cosine"}
        )

    def add_events(self, chapter_num: int, events: list[str]):
        if not events:
            return
        ids = [f"ch{chapter_num}_ev{i}" for i in range(len(events))]
        # Upsert to handle re-generation of the same chapter
        self.collection.upsert(
            documents=events,
            ids=ids,
            metadatas=[{"chapter_num": chapter_num}] * len(events)
        )

    def search(self, query: str, top_k: int = 5) -> list[str]:
        count = self.collection.count()
        if count == 0:
            return []
        results = self.collection.query(
            query_texts=[query],
            n_results=min(top_k, count)
        )
        return results["documents"][0] if results["documents"] else []
