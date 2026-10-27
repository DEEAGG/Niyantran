import os
import shutil
import tempfile
from pathlib import Path
import pytest

# Ensure environment variable is set as early as module load
_temp_dir = tempfile.mkdtemp(prefix="niyantran_test_isolated_")
_test_db_path = Path(_temp_dir) / "test_niyantran.db"

# Inherit authentic regulatory baseline (rules, sources, clauses) without altering production
_prod_db = Path("data/niyantran.db")
if _prod_db.exists():
    shutil.copy2(_prod_db, _test_db_path)

os.environ["NIYANTRAN_DB_PATH"] = str(_test_db_path)
os.environ["NIYANTRAN_ENV"] = "testing"


@pytest.fixture(scope="session", autouse=True)
def isolated_test_database():
    """
    Session-level fixture that isolates all automated test executions inside a temporary
    SQLite database copy. This guarantees:
    1. Zero test records, fixtures, or mock artifacts ever enter data/niyantran.db.
    2. Genuine user applications, documents, and regulatory sources remain pristine.
    3. The temporary database is automatically destroyed upon test suite completion.
    """
    yield _test_db_path

    # Clean up isolated test directory after all tests conclude
    try:
        shutil.rmtree(_temp_dir, ignore_errors=True)
    except Exception:
        pass
