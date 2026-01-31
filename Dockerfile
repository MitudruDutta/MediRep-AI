FROM mcr.microsoft.com/playwright/python:v1.45.0-jammy

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install Python dependencies first for better Docker layer caching.
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --upgrade pip && pip install -r backend/requirements.txt

# Ensure Chromium is installed (Playwright base image already includes browsers,
# but this keeps the build deterministic if the base image changes).
RUN python -m playwright install --with-deps chromium

COPY backend /app/backend
WORKDIR /app/backend

ENV PORT=8000
EXPOSE 8000

# NOTE: Socket.IO does not work correctly with multiple workers unless you
# configure a shared message queue; keep workers=1.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --log-level info"]

