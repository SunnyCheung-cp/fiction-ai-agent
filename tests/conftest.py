# tests/conftest.py
import pytest
import tempfile
import os
from backend.database import Database

@pytest.fixture
def db():
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        db_path = f.name
    database = Database(db_path)
    database.initialize()
    yield database
    os.unlink(db_path)
