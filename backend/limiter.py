"""Single slowapi Limiter shared across all routers.

Lives in its own module so routes/* can import it without pulling in the full
FastAPI app from backend/main.py (which would cause a circular import).
"""

import os

from slowapi import Limiter
from slowapi.util import get_remote_address

RATE_LIMIT_ENABLED = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"

limiter = Limiter(key_func=get_remote_address, enabled=RATE_LIMIT_ENABLED)
