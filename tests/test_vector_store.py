# tests/test_vector_store.py
import pytest
import tempfile
import shutil
from backend.vector_store import VectorStore

@pytest.fixture
def vs():
    tmpdir = tempfile.mkdtemp()
    store = VectorStore(novel_id="test-novel-001", chroma_path=tmpdir)
    yield store
    shutil.rmtree(tmpdir, ignore_errors=True)

def test_search_empty_returns_empty(vs):
    results = vs.search("主角遇到强敌", top_k=5)
    assert results == []

def test_add_and_search(vs):
    vs.add_events(1, ["叶辰在山洞中发现了上古剑法", "叶辰击败了宗门师兄"])
    vs.add_events(2, ["叶辰参加了宗门大比"])
    results = vs.search("叶辰的战斗经历", top_k=5)
    assert len(results) > 0
    assert all(isinstance(r, str) for r in results)

def test_top_k_respected(vs):
    for i in range(10):
        vs.add_events(i + 1, [f"事件{i}：主角做了某事"])
    results = vs.search("主角事件", top_k=3)
    assert len(results) <= 3

def test_duplicate_ids_dont_crash(vs):
    vs.add_events(1, ["第一次写入"])
    vs.add_events(1, ["第二次写入，相同章节"])
    results = vs.search("写入", top_k=5)
    assert len(results) > 0
