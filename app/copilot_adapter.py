"""
NIYANTRAN Regulatory Assistant Host Adapter
===========================================
Links the NIYANTRAN in-app assistant to the application's authentication
provider and database layer.
"""

from typing import Dict, Any
from app.auth import get_current_user
from app.db import get_connection

__all__ = ["get_current_user", "get_connection"]
